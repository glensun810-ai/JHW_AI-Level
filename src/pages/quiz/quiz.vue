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
        v-if="!store.dailyMode"
        ref="progressRef"
        :answered="answers.length"
        :total="store.totalQuestions"
        @complete="onProgressComplete"
      />
      <text v-if="store.deepMode" class="page-quiz__deep-badge">深度定段</text>
      <text v-if="store.dailyMode" class="page-quiz__deep-badge">每日一题</text>
      <text class="page-quiz__home-btn" @click="goHome">🏠</text>
    </view>

    <!-- 加载中 -->
    <view v-if="quizState === 'loading'" class="page-quiz__loading">
      <view class="page-quiz__loading-spinner" />
      <text>正在加载题目…</text>
    </view>

    <!-- 加载失败 -->
    <view v-if="quizState === 'error'" class="page-quiz__error">
      <text class="page-quiz__error-icon">😵</text>
      <text class="page-quiz__error-title">题目加载失败</text>
      <text class="page-quiz__error-hint">可能是网络波动，请重试</text>
      <button class="page-quiz__error-retry" @click="loadFresh">重新加载</button>
      <text class="page-quiz__error-back" @click="goBack">← 返回首页</text>
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
        <view v-if="currentQuestion" class="page-quiz__stem-wrap">
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
        <!-- 逐题反馈 -->
        <view v-if="quizState === 'commenting' && !answerFeedbackGiven" class="page-quiz__feedback">
          <text class="page-quiz__feedback-label">这题怎么样？</text>
          <view class="page-quiz__feedback-btns">
            <text class="page-quiz__feedback-btn" @click="giveAnswerFeedback('up')">👍</text>
            <text class="page-quiz__feedback-btn" @click="giveAnswerFeedback('down')">👎</text>
          </view>
        </view>
        <!-- 手动推进按钮 -->
        <view v-if="quizState === 'commenting'" class="page-quiz__next-wrap">
          <text class="page-quiz__next-btn" @click="goNext">
            {{ store.isLastQuestion ? '查看结果 →' : '下一题 →' }}
          </text>
        </view>
      </view>

      <!-- F5: 即时段位预览 -->
      <view v-if="store.answeredCount >= 2 && store.runningTier" class="page-quiz__running-tier">
        <text class="page-quiz__running-tier-label">当前趋势</text>
        <text class="page-quiz__running-tier-value">{{ store.runningTier.emoji }} {{ store.runningTier.name }}</text>
      </view>

      <!-- P2-H: 中间惊喜卡片（答完第3题弹出） -->
      <view v-if="showMidSurprise" class="page-quiz__mid-surprise" @click="showMidSurprise = false">
        <view class="page-quiz__mid-surprise-card">
          <text class="page-quiz__mid-surprise-emoji">{{ midSurpriseTier.emoji }}</text>
          <text class="page-quiz__mid-surprise-name">趋势预测：{{ midSurpriseTier.name }}</text>
          <text class="page-quiz__mid-surprise-suspense">还差 2 题揭晓…</text>
          <text class="page-quiz__mid-surprise-hint">继续答题，验证这个预测 →</text>
        </view>
      </view>

      <!-- 进度 -->
      <view v-if="!store.dailyMode" class="page-quiz__footer">
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
import { createSoundEngine } from '@/utils/sound-engine.js';
import { useExperienceStore } from '@/store/experience.js';
import { trackQuestionAnswer, trackTestAbandon, trackTestComplete, trackTestStart, trackInviteConversion } from '@/utils/analytics.js';
import { hasUsedFreeTestToday, markFreeTestUsed } from '@/utils/ad.js';
import { getUserOpenidSync } from '@/utils/api.js';

// P2-H: 中间惊喜卡片状态
const showMidSurprise = ref(false);
const midSurpriseTier = ref({ emoji: '', name: '' });

const store = useQuizStore();
const expStore = useExperienceStore();
const progressRef = ref(null);

// 挑战ID（从订阅消息跳转携带）
const challengeId = ref('');
// 换题交叉淡入控制
const questionFading = ref(false);

// ── UI 状态 ──
const quizState = ref('loading'); // loading | ready | selected | commenting | submitting | error
const selectedIndex = ref(-1);
const selectedComment = ref('');
const showRarity = ref('');
const showEncouragement = ref(false);
const encouragementText = ref('');
const answerFeedbackGiven = ref(false);
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
  // 读取页面参数
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  challengeId.value = (page.options && page.options.challengeId) || '';
  const pageMode = (page.options && page.options.mode) || '';

  // 每日一题模式
  if (pageMode === 'daily') {
    store.setDailyMode(true);
  }

  // 检查断点恢复（需验证日期，隔天过期）
  const today = new Date().toISOString().slice(0, 10);
  const bp = uni.getStorageSync('quiz_breakpoint');
  if (bp && bp.questionSetId && bp.date === today) {
    // 断点恢复超时保护：3秒内用户未响应则自动重新开始
    let breakpointHandled = false;
    const bpTimeout = setTimeout(() => {
      if (!breakpointHandled) {
        breakpointHandled = true;
        uni.removeStorageSync('quiz_breakpoint');
        loadFresh();
      }
    }, 3000);
    uni.showModal({
      title: '继续上次测试？',
      content: `你上次答到第 ${(bp.currentIndex || 0) + 1} 题`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (r) => {
        clearTimeout(bpTimeout);
        if (breakpointHandled) return;
        breakpointHandled = true;
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
    // 清除过期断点
    if (bp) uni.removeStorageSync('quiz_breakpoint');
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
      date: new Date().toISOString().slice(0, 10),
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
    return;
  }

  // 自动重试一次
  const retryRes = await store.fetchQuestions();
  if (retryRes.code === 0 && store.totalQuestions > 0) {
    quizState.value = 'ready';
    store.startQuestion();
    startNudgeTimers();
    trackTestStart('new');
    return;
  }

  // 两次都失败 → 显示错误页（提供手动重试按钮）
  quizState.value = 'error';
}

// ── 选择选项 ──
function handleSelect(idx) {
  if (quizState.value !== 'ready') return;
  quizState.value = 'selected';
  selectedIndex.value = idx;
  clearNudgeTimers();

  // 触觉反馈
  if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });

  const result = store.selectAnswer(idx);
  if (!result) return;

  // Phase 5: 选项音效（高分=上行，低分=中性）
  if (result.score >= 7) {
    createSoundEngine().play('quiz_select_high');
  } else {
    createSoundEngine().play('quiz_select_low');
  }

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
    date: new Date().toISOString().slice(0, 10),
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
        showRarity.value = `${pct}% 的人和你一样`;
      } else if (pct < 20) {
        showRarity.value = `只有 ${pct}% 的人选了这个！你挺特别`;
      }
    }

    // 鼓励提示
    const answered = store.answeredCount;
    encouragementText.value = getEncouragement(answered);
    if (encouragementText.value) {
      showEncouragement.value = true;
      encTimer = setTimeout(() => { showEncouragement.value = false; }, 2000);
    }

    // P2-H: 中间惊喜 — 答完第3题弹出趋势预测卡片
    if (!store.deepMode && !store.dailyMode && answered === 3 && store.runningTier) {
      setTimeout(() => {
        midSurpriseTier.value = {
          emoji: store.runningTier.emoji,
          name: store.runningTier.name,
        };
        showMidSurprise.value = true;
        // Phase 5: 趋势预测卡悬念音效
        createSoundEngine().play('quiz_surprise');
        setTimeout(() => { showMidSurprise.value = false; }, 2000);
      }, 400);
    }
  }, 200);
}

// ── 前进到下一题 ──
function giveAnswerFeedback(fb) {
  if (answerFeedbackGiven.value) return;
  answerFeedbackGiven.value = true;
  store.setAnswerFeedback(currentIndex.value, fb);
}

function goNext() {
  // Phase 5: 进入下一题音效
  createSoundEngine().play('quiz_next');
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
      answerFeedbackGiven.value = false;
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
function goHome() { uni.switchTab({ url: '/pages/index/index' }); }
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
    date: new Date().toISOString().slice(0, 10),
  });
}

// ── 提交答案 ──
async function submitAndGo() {
  try {
    trackTestComplete(
      store.testStartTime ? Date.now() - store.testStartTime : 0,
      store.answers,
    );

    const wasFree = getApp().globalData.gatePath === 'free' && !hasUsedFreeTestToday();
    const res = await store.submitTest(challengeId.value);

    if (res.code === 0 && res.data) {
      if (wasFree) { markFreeTestUsed(); getApp().globalData.gatePath = ''; }
      // 邀请转化追踪
      const inviterUid = getApp().globalData.shareFromUid || '';
      if (inviterUid) {
        trackInviteConversion(inviterUid, res.data.tier || '');
      }
      uni.removeStorageSync('quiz_breakpoint');
      uni.redirectTo({ url: '/pages/result/result' });
      return;
    }

    // code=0 但 data 为空 → 重复提交被幂等拦截，仍尝试跳转结果页
    if (res.code === 0 && store.lastResult) {
      uni.removeStorageSync('quiz_breakpoint');
      uni.redirectTo({ url: '/pages/result/result' });
      return;
    }

    // 403：内容违规或限制响应，放行到结果页但不消耗免费次数
    // 用户已完成答题，绝不因后台限制拦截展示
    if (res.code === 403) {
      uni.removeStorageSync('quiz_breakpoint');
      uni.redirectTo({ url: '/pages/result/result' });
      return;
    }

    // 其他错误：显示服务端消息
    const errMsg = res.message || '提交失败，请重试';
    uni.showToast({ title: errMsg, icon: 'none', duration: 2500 });
    console.error('[submitAndGo] 提交失败:', res.code, res.message);
    quizState.value = 'ready';
  } catch (err) {
    console.error('[submitAndGo] 异常:', err);
    uni.showToast({ title: '网络异常，请重试', icon: 'none', duration: 2500 });
    quizState.value = 'ready';
  }
}

onShareAppMessage(() => {
  const uid = getUserOpenidSync();
  return {
    title: '测测你的AI段位！5道题揭晓你的AI真实水平',
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: getApp().globalData.defaultShareImage || '/static/images/default-share.png',
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

  &__home-btn {
    font-size: 32rpx;
    padding: 4rpx 8rpx;
    margin-left: 12rpx;
    flex-shrink: 0;
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

  // 加载失败状态
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 260rpx;
    gap: 16rpx;
  }

  &__error-icon {
    font-size: 80rpx;
    margin-bottom: 8rpx;
  }

  &__error-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #fff;
  }

  &__error-hint {
    font-size: 24rpx;
    color: $color-text-secondary;
    margin-bottom: 24rpx;
  }

  &__error-retry {
    width: 360rpx;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 44rpx;
    font-size: 30rpx;
    font-weight: 600;
    color: #fff;
    border: none;
    text-align: center;
  }

  &__error-back {
    margin-top: 20rpx;
    font-size: 26rpx;
    color: $color-gold;
    opacity: 0.7;
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
    white-space: normal;
    word-break: normal;
    overflow-wrap: break-word;
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
    white-space: normal;
    word-break: normal;
    overflow-wrap: break-word;
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

  // 手动推进按钮
  &__next-wrap {
    display: flex;
    justify-content: center;
    align-self: stretch;
    margin-top: 48rpx;
    animation: comment-fade-in 0.3s ease-out;
  }

  &__next-btn {
    font-size: 28rpx;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    padding: 24rpx 48rpx;
    border-radius: 36rpx;
    font-weight: 500;
    letter-spacing: 2rpx;
    transition: all 0.2s;

    &:active {
      transform: scale(0.96);
      opacity: 0.85;
    }
  }

  // 逐题反馈
  &__feedback {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    margin-top: 14rpx;
    animation: comment-fade-in 0.3s ease-out;
  }

  &__feedback-label {
    font-size: 22rpx;
    color: $color-text-muted;
  }

  &__feedback-btns {
    display: flex;
    gap: 20rpx;
  }

  &__feedback-btn {
    font-size: 36rpx;
    padding: 4rpx 12rpx;
    border-radius: 12rpx;
    background: rgba(255, 255, 255, 0.04);
    transition: transform 0.15s;

    &:active { transform: scale(1.2); }
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

// P2-H: 中间惊喜卡片
.page-quiz__mid-surprise {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 0.25s ease-out;
}

.page-quiz__mid-surprise-card {
  background: linear-gradient(135deg, #1a1040 0%, #0d1b3e 100%);
  border: 2rpx solid rgba(124, 58, 237, 0.4);
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  box-shadow: 0 16rpx 48rpx rgba(124, 58, 237, 0.3);
  animation: mid-surprise-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  max-width: 500rpx;
  width: 80%;
}

.page-quiz__mid-surprise-emoji {
  font-size: 72rpx;
  margin-bottom: 4rpx;
}

.page-quiz__mid-surprise-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #ffd700;
  text-align: center;
}

.page-quiz__mid-surprise-suspense {
  font-size: 26rpx;
  color: #b0bec5;
  text-align: center;
  margin-top: 4rpx;
}

.page-quiz__mid-surprise-hint {
  font-size: 22rpx;
  color: $color-text-secondary;
  margin-top: 12rpx;
  opacity: 0.7;
}

@keyframes mid-surprise-pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
