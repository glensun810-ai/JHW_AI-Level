<template>
  <view class="page-quiz">
    <!-- 自定义导航 -->
    <view class="page-quiz__nav">
      <view
        class="page-quiz__back"
        :class="{ 'page-quiz__back--hidden': currentIndex === 0 && store.answeredCount < 2 }"
        @click="goBack"
      >← 返回</view>
      <ProgressBar
        ref="progressRef"
        :answered="answers.length"
        :total="store.totalQuestions"
        @complete="onProgressComplete"
      />
      <!-- v0.9: 深度定段模式标记 -->
      <text v-if="store.deepMode" class="page-quiz__deep-badge">🧬 深度定段</text>
    </view>

    <!-- 加载中 -->
    <view v-if="quizState === 'loading'" class="page-quiz__loading">
      <view class="page-quiz__loading-spinner" />
      <text>正在加载题目…</text>
    </view>

    <!-- 题目区 -->
    <view v-else class="page-quiz__body">
      <!-- 鼓励提示（绝对定位浮层，不挤占布局） -->
      <view v-if="showEncouragement" class="page-quiz__encourage">
        {{ encouragementText }}
      </view>

      <!-- 温和选择提示 -->
      <view v-if="nudgeText" class="page-quiz__nudge">
        <text>{{ nudgeText }}</text>
      </view>

      <!-- 题干+选项核心区（位置稳定，仅做交叉淡入） -->
      <view class="page-quiz__question-area" :class="{ 'page-quiz__question-area--fading': questionFading }">
        <view class="page-quiz__stem-wrap">
          <text v-if="currentQuestion.emoji" class="page-quiz__q-emoji">{{ currentQuestion.emoji }}</text>
          <text class="page-quiz__stem">{{ currentQuestion.stem }}</text>
        </view>

        <view class="page-quiz__options" :class="{ 'page-quiz__options--pulse': showOptionsPulse }">
          <OptionCard
            v-for="(opt, idx) in parsedOptions"
            :key="idx"
            :label="opt.label"
            :text="opt.text"
            :tag="opt.tag"
            :score="opt.score"
            :selected="selectedIndex === idx"
            :disabled="quizState !== 'ready'"
            @select="handleSelect(idx)"
          />
        </view>
      </view>

      <!-- 短评区（固定高度占位，内容淡入，不触发重排） -->
      <view class="page-quiz__comment-slot">
        <view v-if="selectedComment" class="page-quiz__comment">
          <text>{{ selectedComment }}</text>
        </view>
        <!-- F4: 选项分布 -->
        <view v-if="showRarity" class="page-quiz__rarity">
          <text>{{ showRarity }}</text>
        </view>
        <!-- 题目反馈 -->
        <view v-if="selectedComment && !questionFeedback" class="page-quiz__q-feedback">
          <text class="page-quiz__q-feedback-label">这道题有意思吗？</text>
          <text class="page-quiz__q-feedback-btn" @click="handleQuestionFeedback('like')">👍</text>
          <text class="page-quiz__q-feedback-btn" @click="handleQuestionFeedback('dislike')">👎</text>
        </view>
        <view v-if="questionFeedback" class="page-quiz__q-feedback-done">
          <text>{{ questionFeedback === 'like' ? '👍 感谢反馈' : '👎 感谢反馈' }}</text>
        </view>
      </view>

      <!-- F5: 即时段位预览 -->
      <view v-if="store.answeredCount >= 2 && store.runningTier" class="page-quiz__running-tier">
        <text class="page-quiz__running-tier-label">当前趋势</text>
        <text class="page-quiz__running-tier-value">{{ store.runningTier.emoji }} {{ store.runningTier.name }}</text>
      </view>

      <!-- 进度 -->
      <view class="page-quiz__footer">
        <text>{{ currentIndex + 1 }} / {{ store.totalQuestions }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import ProgressBar from '@/components/ProgressBar/ProgressBar.vue';
import OptionCard from '@/components/OptionCard/OptionCard.vue';
import { useQuizStore } from '@/store/quiz.js';
import { useExperienceStore } from '@/store/experience.js';
import { trackQuestionAnswer, trackTestAbandon, trackTestComplete, trackTestStart, trackInviteUnlock } from '@/utils/analytics.js';
import { MAX_FREE_TESTS } from '@/utils/numeric-constants.js';
import { canWatchAd, getAvailableUnlocks, showRewardedAd } from '@/utils/ad.js';

const store = useQuizStore();
const expStore = useExperienceStore();
const progressRef = ref(null);

// 挑战ID（从订阅消息跳转携带）
const challengeId = ref('');
// 换题交叉淡入控制
const questionFading = ref(false);
// 本次测试类型：free | ad
const testType = ref('free');

// ── UI 状态 ──
const quizState = ref('loading'); // loading | ready | selected | commenting | submitting
const selectedIndex = ref(-1);
const selectedComment = ref('');
const showRarity = ref('');
const questionFeedback = ref(null); // null | 'like' | 'dislike'
const showEncouragement = ref(false);
const encouragementText = ref('');
let encTimer = null;
let transitionTimer = null;
let commentTimer = null;

// 温和选择提示：不给压力，仅视觉脉冲 + 鼓励文字
const NUDGE_PULSE_SEC = 20;
const NUDGE_TEXT_SEC = 40;
const showOptionsPulse = ref(false);
	const nudgeText = ref('');
let nudgePulseTimer = null;
let nudgeTextTimer = null;

// ── 派生 ──
const currentQuestion = computed(() => store.currentQuestion);
const currentIndex = computed(() => store.currentIndex);
const answers = computed(() => store.answers);

const parsedOptions = computed(() => {
  if (!currentQuestion.value) return [];
  const opts = currentQuestion.value._parsedOptions || [];
  // F3: 附加 optionTags
  const tags = currentQuestion.value.optionTags || [];
  return opts.map((opt, i) => ({
    ...opt,
    tag: tags[i] || '',
  }));
});

// ── 鼓励文案 ──
function getEncouragement(answered) {
  const total = store.totalQuestions || 5;
  const remaining = total - answered;
  if (remaining <= 0) return '';
  if (remaining === 1) return '最后 1 题了！';
  if (remaining === 2) return '还剩 2 题，即将揭晓！';
  if (remaining <= Math.ceil(total * 0.4)) return `还剩 ${remaining} 题，你的段位即将揭晓…`;
  return '';
}

onMounted(async () => {
  // 读取挑战ID（从订阅消息跳转）
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  challengeId.value = (page.options && page.options.challengeId) || '';

  // 重置每日计数
  const today = new Date().toISOString().slice(0, 10);
  if (uni.getStorageSync('test_date') !== today) {
    uni.setStorageSync('test_date', today);
    uni.setStorageSync('test_count', 0);
  }
  if (uni.getStorageSync('ad_test_date') !== today) {
    uni.setStorageSync('ad_test_date', today);
    uni.setStorageSync('ad_test_count', 0);
  }

  const freeCount = uni.getStorageSync('test_count') || 0;
  const effectiveMax = expStore.unlocks.extraDailyTest ? MAX_FREE_TESTS + 1 : MAX_FREE_TESTS;
  if (freeCount >= effectiveMax) {
    const unlocked = await showUnlockModal('entry');
    if (!unlocked) return;
  }

  // 检查断点恢复
  const bp = uni.getStorageSync('quiz_breakpoint');
  if (bp && bp.questionSetId) {
    uni.showModal({
      title: '继续上次测试？',
      content: `你上次答到第 ${(bp.currentIndex || 0) + 1} 题`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (r) => {
        if (r.confirm) {
          store.questions = bp.questions || [];
          store.questionSetId = bp.questionSetId;
          store.currentIndex = bp.currentIndex || 0;
          store.answers = bp.answers || [];
          quizState.value = 'ready';
          // B1: 回退恢复时显示之前选中的答案
          restoreSavedSelection();
          store.startQuestion();
          startNudgeTimers();
          trackTestStart('return');
        } else {
          uni.removeStorageSync('quiz_breakpoint');
          loadFresh();
        }
      },
    });
  } else {
    loadFresh();
  }
});

onBeforeUnmount(() => {
  clearTimeout(encTimer);
  clearTimeout(transitionTimer);
  clearTimeout(commentTimer);
  clearNudgeTimers();

  // 中途退出埋点
  if (quizState.value !== 'submitting' && quizState.value !== 'loading') {
    trackTestAbandon(
      currentIndex.value + 1,
      answers.value.length,
      store.testStartTime ? Date.now() - store.testStartTime : 0,
    );
  }

  // 保存断点
  if (quizState.value !== 'submitting' && store.questions.length > 0) {
    uni.setStorageSync('quiz_breakpoint', {
      questions: store.questions,
      questionSetId: store.questionSetId,
      currentIndex: store.currentIndex,
      answers: store.answers,
    });
  }
});

// B1: 当切题时恢复已保存的选中状态
watch(currentIndex, () => {
  restoreSavedSelection();
});

function restoreSavedSelection() {
  const saved = store.currentSavedAnswer;
  selectedIndex.value = saved ? saved.selectedIndex : -1;
  questionFeedback.value = (saved && saved.feedback) || null;
}


	// 温和选择脉冲提示（不给压力，永不自动选择）
	function startNudgeTimers() {
	  clearNudgeTimers();
	  showOptionsPulse.value = false;
	  nudgeText.value = '';

	  // 20s 后选项区呼吸脉冲
	  nudgePulseTimer = setTimeout(() => {
	    if (quizState.value !== 'ready') return;
	    showOptionsPulse.value = true;
	    setTimeout(() => { showOptionsPulse.value = false; }, 600);
	  }, NUDGE_PULSE_SEC * 1000);

	  // 40s 后显示鼓励文字
	  nudgeTextTimer = setTimeout(() => {
	    if (quizState.value !== 'ready') return;
	    nudgeText.value = '选一个最像你的~';
	  }, NUDGE_TEXT_SEC * 1000);
	}

	function clearNudgeTimers() {
	  clearTimeout(nudgePulseTimer);
	  clearTimeout(nudgeTextTimer);
	  showOptionsPulse.value = false;
	  nudgeText.value = '';
	}

async function loadFresh() {
  quizState.value = 'loading';
  uni.removeStorageSync('quiz_breakpoint');
  store.reset();

  // 15秒超时保护：防止云函数无响应导致用户卡死
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve({ code: 500, message: 'timeout' }), 15000);
  });
  const result = await Promise.race([store.fetchQuestions(), timeout]);

  if (result.code === 0 && store.totalQuestions > 0) {
    quizState.value = 'ready';
    store.startQuestion();
    startNudgeTimers();
    trackTestStart('new');
  } else {
    // 超时或加载失败 → 自动重试一次
    uni.showToast({ title: '加载超时，正在重试…', icon: 'loading', duration: 2000 });
    setTimeout(async () => {
      const retryRes = await store.fetchQuestions();
      if (retryRes.code === 0 && store.totalQuestions > 0) {
        quizState.value = 'ready';
        store.startQuestion();
        startNudgeTimers();
        trackTestStart('new');
      } else {
        uni.showToast({ title: '题目加载失败，请退出重试', icon: 'none', duration: 3000 });
      }
    }, 2000);
  }
}

// ── 选择选项 ──
function handleSelect(idx) {
  if (quizState.value !== 'ready') return;
  quizState.value = 'selected';
  selectedIndex.value = idx;
  clearNudgeTimers();

  // 触觉反馈
  wx.vibrateShort({ type: 'light' });

  const result = store.selectAnswer(idx);
  if (!result) return;

  // 埋点
  trackQuestionAnswer(
    currentQuestion.value._id,
    result.label,
    result.score,
    result.timeSpent,
  );

  // 保存断点
  uni.setStorageSync('quiz_breakpoint', {
    questions: store.questions,
    questionSetId: store.questionSetId,
    currentIndex: store.currentIndex,
    answers: store.answers,
  });

  // 显示短评（200ms 后）
  commentTimer = setTimeout(() => {
    selectedComment.value = result.comment;
    quizState.value = 'commenting';

    // F4: 显示选项分布
    const dist = currentQuestion.value.optionDistribution;
    if (dist && dist.length === 4) {
      const pct = dist[idx];
      if (pct > 50) {
        showRarity.value = `${pct}% 的人和你一样 🤝`;
      } else if (pct < 20) {
        showRarity.value = `只有 ${pct}% 的人选了这个！你挺特别 👀`;
      }
    }

    // 鼓励提示
    const answered = store.answeredCount;
    encouragementText.value = getEncouragement(answered);
    if (encouragementText.value) {
      showEncouragement.value = true;
      encTimer = setTimeout(() => { showEncouragement.value = false; }, 2000);
    }

    // 过渡到下一题（600ms 后）
    transitionTimer = setTimeout(() => {
      goNext();
    }, 600);
  }, 200);
}

function handleQuestionFeedback(feedback) {
  if (questionFeedback.value) return; // 已评价
  questionFeedback.value = feedback;
  store.setAnswerFeedback(currentIndex.value, feedback);
  // 触觉反馈
  wx.vibrateShort({ type: 'light' });
}

// ── 前进到下一题 ──
function goNext() {
  if (store.isLastQuestion) {
    quizState.value = 'submitting';
    selectedComment.value = '';
    showRarity.value = '';
    submitAndGo();
  } else {
    // 核心区交叉淡入，不移动位置
    questionFading.value = true;
    setTimeout(() => {
      store.advanceQuestion();
      selectedIndex.value = -1;
      selectedComment.value = '';
      questionFeedback.value = null;
      quizState.value = 'ready';
      store.startQuestion();
      startNudgeTimers();
      questionFading.value = false;
    }, 200);
  }
}

// ── 进度条完成回调 ──
function onProgressComplete() {
  // ProgressBar flash done, proceed
}

// ── 返回上一题 / 退出 ──
function goBack() {
  // 第一题 → 退出（同之前逻辑）
  if (currentIndex.value <= 0) {
    if (store.answeredCount >= 2) {
      const total = store.totalQuestions || 5;
      const remaining = total - store.answeredCount;
      uni.showModal({
        title: '确定放弃吗？',
        content: `你已答了 ${store.answeredCount}/${total} 题，只差 ${remaining} 题就知道你的AI段位了！`,
        confirmText: '继续答题',
        cancelText: '残忍放弃',
        success: (r) => {
          if (r.cancel) {
            uni.removeStorageSync('quiz_breakpoint');
            uni.navigateBack();
          }
        },
      });
      return;
    }
    uni.removeStorageSync('quiz_breakpoint');
    uni.navigateBack();
    return;
  }

  // B1: 移除回退次数限制，允许回退到任意已答题目
  store.currentIndex--;
  selectedIndex.value = -1;
  selectedComment.value = '';
  questionFeedback.value = null;
  quizState.value = 'ready';
  store.startQuestion();
  startNudgeTimers();

  // B1: 恢复该题之前保存的答案选中状态
  restoreSavedSelection();

  uni.setStorageSync('quiz_breakpoint', {
    questions: store.questions,
    questionSetId: store.questionSetId,
    currentIndex: store.currentIndex,
    answers: store.answers,
  });
}

// ── 多渠道解锁弹窗（入口用 / 答题完成被拒用）
async function showUnlockModal(context = 'entry') {
  const { ad } = getAvailableUnlocks();
  const hasAd = ad > 0;

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; clearTimeout(timeout); resolve(val); } };
    const timeout = setTimeout(() => { done(false); }, 30000);

    uni.showActionSheet({
      itemList: [
        ...(hasAd ? ['📺 看广告解锁'] : []),
        '📤 邀请好友解锁',
      ],
      success: async (r) => {
        const itemList = hasAd ? ['📺 看广告解锁', '📤 邀请好友解锁'] : ['📤 邀请好友解锁'];
        const choice = itemList[r.tapIndex];
        if (choice.includes('看广告')) {
          trackInviteUnlock(0);
          uni.showToast({ title: '广告加载中…', icon: 'loading', duration: 5000 });
          const adResult = await showRewardedAd();
          uni.hideToast();
          if (adResult === 'completed') {
            testType.value = 'ad';
            uni.showToast({ title: '解锁成功！', icon: 'success' });
            done(true);
          } else {
            uni.showToast({ title: '广告未完成，请重试', icon: 'none' });
            done(false);
          }
        } else if (choice.includes('邀请好友')) {
          trackInviteUnlock(context === 'blocked' ? 1 : 0);
          wx.shareAppMessage({
            title: '测测你的AI段位！我在进化湾等你',
            path: '/pages/index/index',
          });
          uni.showToast({ title: '请分享后等待好友进入', icon: 'none', duration: 2000 });
          done(false);
        }
      },
      fail: () => {
        done(false);
      },
    });
  });
}

// ── 提交答案 ──
async function submitAndGo() {
  trackTestComplete(
    store.testStartTime ? Date.now() - store.testStartTime : 0,
    store.answers,
  );

  let res = await store.submitTest(challengeId.value, testType.value);
  if (res.code === 0 && res.data) {
    const today = new Date().toISOString().slice(0, 10);
    if (testType.value === 'free') {
      const count = (uni.getStorageSync('test_count') || 0) + 1;
      uni.setStorageSync('test_count', count);
      uni.setStorageSync('test_date', today);
    }
    // 经验值由 store.submitTest 统一发放（含 isNewHighest 判断），此处不重复发放
    uni.removeStorageSync('quiz_breakpoint');
    uni.redirectTo({ url: '/pages/result/result' });
  } else if (res.code === 403) {
    const unlocked = await showUnlockModal('blocked');
    if (unlocked) {
      res = await store.submitTest(challengeId.value, testType.value);
      if (res.code === 0 && res.data) {
        uni.removeStorageSync('quiz_breakpoint');
        uni.redirectTo({ url: '/pages/result/result' });
      } else {
        uni.showToast({ title: '提交失败，请重试', icon: 'none' });
        quizState.value = 'ready';
      }
    } else {
      uni.removeStorageSync('quiz_breakpoint');
      uni.navigateBack();
    }
  } else {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
    quizState.value = 'ready';
  }
}

onShareAppMessage(() => {
  return {
    title: '测测你的AI段位！5道题揭晓你的AI真实水平 🧬',
    path: '/pages/index/index',
  };
});

onShareTimeline(() => {
  return {
    title: '你的AI段位是什么？3秒揭晓 →',
    query: '',
  };
});
</script>

<style scoped lang="scss">
.page-quiz {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a0533 0%, #0d1b2a 100%);
  padding: 24rpx 32rpx;

  &__nav {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding-top: 60rpx;
    margin-bottom: 48rpx;
  }

  &__back {
    font-size: 28rpx;
    color: $color-accent;
    flex-shrink: 0;
    padding: 4rpx 8rpx;
    opacity: 1;
    transition: opacity 0.2s;

    &--hidden {
      opacity: 0;
      pointer-events: none;
    }
  }

  &__deep-badge {
    font-size: 22rpx;
    color: rgba(124, 58, 237, 0.7);
    background: rgba(124, 58, 237, 0.08);
    padding: 4rpx 14rpx;
    border-radius: 20rpx;
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    flex-shrink: 0;
    margin-left: auto;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 300rpx;
    color: $color-text-secondary;
    font-size: 28rpx;
    gap: 24rpx;
  }

  &__loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    border: 3rpx solid rgba(124, 58, 237, 0.2);
    border-top-color: $color-accent;
    animation: spin 0.8s linear infinite;
  }

  &__body {
    position: relative;
  }

  &__encourage {
    position: absolute;
    top: -8rpx;
    left: 0;
    right: 0;
    z-index: 10;
    text-align: center;
    font-size: 26rpx;
    color: $color-gold;
    pointer-events: none;
    animation: encourage-float-in 0.4s ease-out;
  }

  // 温和选择提示
  &__nudge {
    position: absolute;
    top: -8rpx;
    left: 0;
    right: 0;
    z-index: 10;
    text-align: center;
    font-size: 24rpx;
    color: $color-text-muted;
    pointer-events: none;
    animation: encourage-float-in 0.4s ease-out;
  }

  &__question-area {
    transition: opacity 0.2s ease;

    &--fading {
      opacity: 0;
    }
  }

  &__stem-wrap {
    padding: 16rpx 0 32rpx;
  }

  &__q-emoji {
    font-size: 40rpx;
    margin-right: 8rpx;
    vertical-align: middle;
  }

  &__stem {
    font-size: 36rpx;
    color: $color-text-primary;
    line-height: 1.6;
    font-weight: 500;
  }

  &__options {
    flex: 1;

    &--pulse {
      animation: options-pulse 0.6s ease-in-out;
    }
  }

  &__comment-slot {
    min-height: 80rpx;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  &__comment {
    width: 100%;
    margin-top: 24rpx;
    padding: 16rpx 24rpx;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 12rpx;
    border-left: 3rpx solid $color-accent;
    font-size: 26rpx;
    color: $color-text-secondary;
    line-height: 1.5;
    animation: comment-fade-in 0.25s ease-out;
  }

  // F4: 选项分布
  &__rarity {
    width: 100%;
    margin-top: 12rpx;
    padding: 12rpx 24rpx;
    background: rgba(245, 158, 11, 0.06);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: $color-gold;
    text-align: center;
    animation: comment-fade-in 0.25s ease-out;
  }

  // 题目反馈
  &__q-feedback {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    margin-top: 16rpx;
    animation: comment-fade-in 0.25s ease-out;

    &-label {
      font-size: 22rpx;
      color: $color-text-muted;
    }

    &-btn {
      font-size: 36rpx;
      padding: 4rpx;
      opacity: 0.6;
      transition: opacity 0.15s;

      &:active {
        opacity: 1;
        transform: scale(1.2);
      }
    }
  }

  &__q-feedback-done {
    margin-top: 12rpx;
    text-align: center;
    font-size: 22rpx;
    color: $color-text-muted;
    animation: comment-fade-in 0.25s ease-out;
  }

  // F5: 即时段位预览
  &__running-tier {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    margin-top: 20rpx;
    opacity: 0.6;

    &-label {
      font-size: 22rpx;
      color: $color-text-muted;
    }

    &-value {
      font-size: 24rpx;
      color: $color-text-secondary;
      font-weight: 500;
    }
  }

  &__footer {
    display: flex;
    justify-content: center;
    padding: 40rpx 0;
    color: $color-text-muted;
    font-size: 24rpx;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-8rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes encourage-float-in {
  from { opacity: 0; transform: translateY(-12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes comment-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes options-pulse {
  0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  50% { box-shadow: 0 0 24rpx 4rpx rgba(124, 58, 237, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
}
</style>
