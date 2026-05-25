<template>
  <view class="page-result">
    <!-- 阶段0：评估中 -->
    <view v-if="stage === 'evaluating'" class="page-result__evaluating">
      <view class="page-result__ripple" />
      <text class="page-result__eval-text">AI 正在评估你的段位…</text>
    </view>

    <!-- 阶段0.5：反转惊喜 -->
    <ReversalReveal
      v-if="stage === 'reversal'"
      :fake-tier="fakeTier"
      :real-tier="result.tier"
      :real-emoji="result.tierEmoji"
      :real-color="tierColor"
      @done="onReversalDone"
    />

    <!-- 阶段1-5：内容揭晓 -->
    <scroll-view v-if="stage === 'revealing'" scroll-y class="page-result__scroll">
      <view class="page-result__content">
        <!-- 段位徽章 + 分数（阶段1） -->
        <view class="page-result__section" :class="{ 'page-result__fade-in': stageNum >= 1 }">
          <TierBadge :tier="result.tier" :score="result.totalScore" size="large" :animated="true" />
          <view v-if="result.persona" class="page-result__persona">
            <text>{{ result.persona.emoji }} {{ result.persona.name }}</text>
          </view>
          <view class="page-result__score">
            <text class="page-result__score-num">{{ displayScore }}</text>
            <text class="page-result__score-label">分</text>
          </view>
          <view v-if="showScreenshotHint" class="page-result__screenshot-hint">
            <text>📸 截图保存你的段位！</text>
          </view>
          <!-- v0.9: 进化值获得提示 -->
          <view v-if="showXpGain" class="page-result__xp-gain">
            <text class="page-result__xp-gain-text">+{{ xpGained }} XP ✨ 进化值已累积</text>
            <view class="page-result__xp-gain-bar">
              <view class="page-result__xp-gain-fill" :style="{ width: expStore.levelProgress + '%' }" />
            </view>
            <text class="page-result__xp-gain-lv">Lv.{{ expStore.level }} {{ expStore.levelName }}</text>
          </view>
        </view>

        <!-- 超越百分比 + 下一段位（阶段2） -->
        <view v-if="stageNum >= 2" class="page-result__section page-result__fade-in">
          <view class="page-result__percentile">
            <text class="page-result__percentile-num">前 {{ result.percentile }}%</text>
            <text class="page-result__percentile-sub">超越了全国 {{ result.percentile }}% 的用户</text>
          </view>
          <view class="page-result__next-tier">
            <template v-if="result.nextTier">
              距离 <text class="page-result__next-name">{{ result.nextTier }}</text> 还差 <text class="page-result__next-pts">{{ result.pointsToNext }} 分</text>
            </template>
            <template v-else>
              🌊 你已达到最高段位！
            </template>
          </view>
          <!-- A1: 差一分戏剧感 -->
          <view v-if="result.pointsToNext === 1 && result.nextTier" class="page-result__one-point">
            <text class="page-result__one-point-icon">🔥</text>
            <text class="page-result__one-point-text">就差 1 分！只差 1 分就能晋升 <text class="page-result__one-point-tier">{{ result.nextTier }}</text>！</text>
            <text class="page-result__one-point-sub">再测一次，说不定你就是 {{ result.nextTier }} 了！</text>
          </view>
        </view>

        <!-- v0.9: 进化建议（阶段2） -->
        <view v-if="stageNum >= 2 && result.evolutionTip && result.evolutionTip.length > 0" class="page-result__section page-result__fade-in">
          <view class="page-result__evo-tip">
            <text class="page-result__evo-tip-title">🧬 想从「{{ result.tier }}」再进一步？</text>
            <view v-for="(tip, i) in result.evolutionTip" :key="i" class="page-result__evo-tip-item">
              <text class="page-result__evo-tip-dot">▸</text>
              <text class="page-result__evo-tip-text">{{ tip }}</text>
            </view>
          </view>
        </view>

        <!-- 最强维度快览（阶段2） -->
        <view v-if="stageNum >= 2 && strongestDimension" class="page-result__section page-result__fade-in">
          <view class="page-result__dim-highlight">
            <text class="page-result__dim-icon">🧭</text>
            <text class="page-result__dim-label">你的最强维度</text>
            <text class="page-result__dim-name">{{ strongestDimension.name }}</text>
            <text class="page-result__dim-arrow">↓ 下滑查看完整雷达图</text>
          </view>
        </view>

        <!-- 分享操作区（阶段2） -->
        <view v-if="stageNum >= 2" class="page-result__section page-result__fade-in">
          <view class="page-result__actions-block page-result__actions-block--early">
            <!-- 分享风格选择 + 一键转发 -->
            <view class="page-result__share-tabs">
              <view
                v-for="s in shareStyles"
                :key="s.key"
                class="page-result__share-tab"
                :class="{ 'page-result__share-tab--active': shareStyle === s.key }"
                @click="onShareTabClick(s.key)"
              >
                {{ s.label }}
              </view>
            </view>

            <!-- 非群挑战：展示一键分享按钮 -->
            <view v-if="shareStyle !== 'group'" class="page-result__actions">
              <button class="page-result__btn-share" open-type="share">
                {{ shareButtonText }}
              </button>
              <button class="page-result__btn-poster" @click="generatePoster">📸 生成段位长图</button>
            </view>

            <!-- 群挑战专用 -->
            <view v-if="shareStyle === 'group'" class="page-result__actions">
              <button class="page-result__btn-share page-result__btn-group" open-type="share">
                📤 分享到群，发起段位挑战
              </button>
              <button class="page-result__btn-poster" @click="generatePoster">📸 生成段位长图</button>
            </view>

            <!-- 挑战好友 -->
            <button class="page-result__btn-challenge" @click="challengeFriend">⚔️ 挑战好友</button>

            <!-- C1: @好友预测段位 -->
            <view class="page-result__predict">
              <text class="page-result__predict-title">🎯 赌一把好友的段位？</text>
              <view class="page-result__predict-row">
                <input
                  v-model="predictFriendName"
                  class="page-result__predict-input"
                  placeholder="输入好友名字"
                  maxlength="10"
                  @confirm="sharePrediction"
                />
                <button class="page-result__predict-btn" @click="sharePrediction" :disabled="!predictFriendName">
                  📤 发给TA
                </button>
              </view>
              <text v-if="predictCopy" class="page-result__predict-copy">{{ predictCopy }}</text>
            </view>

            <button class="page-result__btn-retry" @click="retryQuiz">
              🔄 再测一次（今日剩余 {{ remainingTests }} 次）
            </button>

            <view v-if="showCollectTip" class="page-result__collect-tip" @click="showCollectTip = false">
              <text>⭐ 点击右上角 ··· 收藏小程序，每天测测段位变了吗？</text>
            </view>
          </view>
        </view>

        <!-- AI锐评（阶段3） -->
        <view v-if="stageNum >= 3" class="page-result__section">
          <AiComment
            :tier-name="result.tier"
            :tier-emoji="result.tierEmoji"
            :tier-color="tierColor"
            :commentary="result.tierCommentary"
          />
        </view>

        <!-- 雷达图 + 成长路径（阶段4） -->
        <view v-if="stageNum >= 4" class="page-result__section page-result__fade-in">
          <view v-if="result.radarData" class="page-result__radar-card">
            <text class="page-result__section-title">🧭 能力雷达</text>
            <view class="page-result__radar-wrap">
              <RadarChart
                :dimensions="result.radarData.dimensions"
                :values="result.radarData.values"
                :width="280"
                :height="280"
              />
            </view>
          </view>

          <GrowthPath :tier-name="result.tier" :tier-index="tierIndex" />

          <view class="page-result__friend-rank">
            <text class="page-result__section-title">🏆 好友排行</text>
            <view v-if="friendComparisonText" class="page-result__friend-compare">
              <text>{{ friendComparisonText }}</text>
            </view>
            <view v-if="friendLoaded" class="page-result__friend-list">
              <view v-for="(f, i) in topFriends" :key="f.openid || i" class="page-result__friend-item">
                <text class="page-result__friend-rank">#{{ i + 1 }}</text>
                <image class="page-result__friend-avatar" :src="f.avatar || defaultAvatar" mode="aspectFill" />
                <text class="page-result__friend-name">{{ f.nickname || '匿名用户' }}</text>
                <text class="page-result__friend-tier">{{ f.tier || '?' }}</text>
              </view>
              <view v-if="topFriends.length === 0" class="page-result__friend-empty">
                <text>暂无好友数据，分享给好友看看他们的段位吧 👋</text>
              </view>
            </view>
            <view v-else class="page-result__friend-loading">
              <text>加载好友排名中…</text>
            </view>
          </view>
        </view>

        <!-- 回顾：进化之路（阶段4） -->
        <view v-if="stageNum >= 4 && reviewData" class="page-result__section page-result__fade-in">
          <text class="page-result__section-title">📅 你的进化之路</text>
          <view class="page-result__review">
            <view v-for="(h, i) in reviewData.history" :key="i" class="page-result__review-row">
              <text class="page-result__review-date">{{ h.date }}</text>
              <text class="page-result__review-arrow">→</text>
              <text class="page-result__review-tier">{{ h.emoji }} {{ h.tier }}</text>
              <text class="page-result__review-score">({{ h.score }}分)</text>
            </view>
            <view class="page-result__review-change" :class="'page-result__review-change--' + reviewData.change">
              {{ reviewData.changeDetail }}
            </view>
          </view>
        </view>

        <!-- 分数明细 + B4: 如果选别的（阶段4） -->
        <view v-if="stageNum >= 4 && result.commentary" class="page-result__section page-result__fade-in">
          <text class="page-result__section-title">📋 答题回顾</text>
          <view class="page-result__details">
            <view v-for="(c, i) in result.commentary" :key="i" class="page-result__detail-item">
              <view class="page-result__detail-header">
                <text class="page-result__detail-q">Q{{ i + 1 }}</text>
                <text class="page-result__detail-stem">{{ getQuestionStem(i) }}</text>
              </view>
              <text class="page-result__detail-c">{{ c }}</text>
              <!-- v0.9: 知识卡 -->
              <KnowledgeCard
                v-if="getKnowledgeCard(i)"
                :card="getKnowledgeCard(i)"
                @helpful="onKnowledgeHelpful"
                @collect="onKnowledgeCollect"
              />
              <view v-if="getOtherOptions(i).length > 0" class="page-result__detail-whatif">
                <text class="page-result__detail-whatif-label">如果选别的：</text>
                <text
                  v-for="opt in getOtherOptions(i)"
                  :key="opt.label"
                  class="page-result__detail-whatif-opt"
                  :class="{ 'page-result__detail-whatif-opt--better': opt.score > getMyScore(i) }"
                >
                  {{ opt.label }}: {{ opt.score }}分
                </text>
              </view>
            </view>
          </view>
          <!-- C3: 纠正一个选择 -->
          <view class="page-result__correct">
            <text class="page-result__correct-text">对某个答案不满意？</text>
            <button class="page-result__correct-btn" @click="retryQuiz">🔄 纠正一个选择，再测一次</button>
          </view>
        </view>

        <!-- 快速反馈（阶段5） -->
        <view v-if="stageNum >= 5" class="page-result__section page-result__fade-in">
          <view class="page-result__feedback">
            <text class="page-result__feedback-label">这个段位准不准？</text>
            <view class="page-result__feedback-btns">
              <button class="page-result__feedback-btn" @click="submitFeedback(true)">👍 准</button>
              <button class="page-result__feedback-btn" @click="submitFeedback(false)">👎 不准</button>
            </view>
          </view>
        </view>

        <view style="height: 60rpx" />
      </view>
    </scroll-view>

    <TierCard
      ref="tierCardRef"
      :tier-name="result.tier"
      :total-score="result.totalScore"
      :percentile="result.percentile"
      :tier-commentary="result.tierCommentary"
      :friend-rank="friendRankData"
      @generated="onCardGenerated"
      @saved="onCardSaved"
      @shared="onCardShared"
    />

    <ChallengeModal
      :visible="showChallengeModal"
      :my-score="result.totalScore"
      :my-tier="result.tier"
      @close="showChallengeModal = false"
      @challenged="onChallengeSent"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import TierBadge from '@/components/TierBadge/TierBadge.vue';
import RadarChart from '@/components/RadarChart/RadarChart.vue';
import ReversalReveal from '@/components/ReversalReveal/ReversalReveal.vue';
import AiComment from '@/components/AiComment/AiComment.vue';
import GrowthPath from '@/components/GrowthPath/GrowthPath.vue';
import TierCard from '@/components/TierCard/TierCard.vue';
import KnowledgeCard from '@/components/KnowledgeCard/KnowledgeCard.vue';
import ChallengeModal from '@/components/ChallengeModal/ChallengeModal.vue';
import { MAX_FREE_TESTS } from '@/utils/numeric-constants.js';
import { REVERSAL_FAKE_TIERS } from '@/utils/constants.js';
import { getTierColor, getTierIndex } from '@/utils/tier.js';
import { getShareTitle, getGroupChallengeCopy, getPredictionCopy } from '@/utils/share-helper.js';
import { fetchFriendRank, fetchWeeklyStats, submitFeedback as submitFeedbackApi } from '@/utils/api.js';
import { trackResultView, trackShareClick, trackShareSuccess, trackChallenge, trackQuickFeedback, trackReversalStart, trackReversalEnd, trackResultLinger, trackTestRetry } from '@/utils/analytics.js';
import { getAvailableUnlocks, showRewardedAd } from '@/utils/ad.js';
import { useQuizStore } from '@/store/quiz.js';
import { useExperienceStore } from '@/store/experience.js';

const tierCardRef = ref(null);
const result = ref({ tier: '', tierEmoji: '', totalScore: 0, percentile: 0, nextTier: null, pointsToNext: 0, radarData: null, commentary: [], tierCommentary: '', persona: null });
const stage = ref('evaluating');
const stageNum = ref(0);
const displayScore = ref(0);
const fakeTier = ref('');
const shareStyle = ref('showoff');
const remainingTests = ref(0);
const topFriends = ref([]);
const friendLoaded = ref(false);
const generatedCardUrl = ref('');
const showChallengeModal = ref(false);
const reviewData = ref(null);
const showCollectTip = ref(false);

const predictFriendName = ref('');
const predictCopy = ref('');
const questions = ref([]);

const defaultAvatar = '/static/icons/default-avatar.png';
let lingerTimer = null;
let resultRevealTime = 0;

const quizStore = useQuizStore();
const expStore = useExperienceStore();
const showScreenshotHint = ref(false);
const showXpGain = ref(false);
const xpGained = ref(0);

const shareStyles = [
  { key: 'showoff', label: '😎 炫耀' },
  { key: 'selfmock', label: '😂 自嘲' },
  { key: 'challenge', label: '⚔️ 挑战' },
  { key: 'group', label: '👥 群挑战' },
];

const shareButtonText = computed(() => {
  const map = {
    showoff: '📤 一键炫耀段位',
    selfmock: '📤 一键自嘲分享',
    challenge: '📤 一键发起挑战',
    group: '📤 分享到群，发起段位挑战',
  };
  return map[shareStyle.value] || '📤 分享段位';
});

function onShareTabClick(key) {
  shareStyle.value = key;
  if (key !== 'group') {
    uni.showToast({ title: `已选"${shareStyles.find(s => s.key === key).label}"风格，点击下方按钮分享`, icon: 'none', duration: 1500 });
  }
}

const tierColor = computed(() => {
  try { return getTierColor(result.value.tier); } catch { return '#7c3aed'; }
});

const tierIndex = computed(() => {
  try { return getTierIndex(result.value.totalScore); } catch { return 0; }
});

const friendRankData = computed(() => {
  if (topFriends.value.length === 0) return null;
  const myScore = result.value.totalScore;
  let rank = 1;
  for (const f of topFriends.value) {
    if (f.score > myScore) rank++;
  }
  return { rank, total: topFriends.value.length + 1 };
});

const friendComparisonText = computed(() => {
  const data = friendRankData.value;
  if (!data) return '';
  if (data.rank === 1) return '🏆 你暂时领先所有好友！快去炫耀一下 →';

  const firstPlace = topFriends.value[0];
  if (!firstPlace) return '';
  const myTierIdx = tierIndex.value;
  const firstPlaceTierIdx = getTierIndex(firstPlace.score);

  if (myTierIdx >= firstPlaceTierIdx - 1 && firstPlace.score - result.value.totalScore <= 5) {
    return `@${firstPlace.nickname || '好友'} 比你高一段 🤏 差一点点，不服来战？`;
  }

  const sameTierAhead = topFriends.value.find(
    f => getTierIndex(f.score) === myTierIdx && f.score > result.value.totalScore
  );
  if (sameTierAhead) {
    return `@${sameTierAhead.nickname || '好友'} 跟你同段位但高 ${sameTierAhead.score - result.value.totalScore} 分 ⚡ 差一点点！`;
  }

  return `你目前排在好友榜第 ${data.rank} 名 📊 再测一次说不定就上去了`;
});

const strongestDimension = computed(() => {
  const data = result.value.radarData;
  if (!data || !data.values || data.values.length === 0) return null;
  const maxVal = Math.max(...data.values);
  const idx = data.values.indexOf(maxVal);
  return { name: data.dimensions[idx], value: maxVal };
});

function getQuestionStem(index) {
  const q = questions.value[index];
  if (!q) return '';
  return (q.emoji || '') + ' ' + (q.stem || '');
}

function getMyScore(index) {
  const q = questions.value[index];
  if (!q || !q._parsedOptions) return 0;
  const answers = quizStore.lastAnswers || [];
  const ans = answers[index];
  if (ans !== undefined && q._parsedOptions[ans.selectedIndex]) {
    return q._parsedOptions[ans.selectedIndex].score || 0;
  }
  return 0;
}

function getOtherOptions(index) {
  const q = questions.value[index];
  if (!q || !q._parsedOptions) return [];
  const answers = quizStore.lastAnswers || [];
  const ans = answers[index];
  if (ans === undefined) return [];
  return q._parsedOptions
    .map((opt, i) => ({ label: opt.label, score: opt.score }))
    .filter((_, i) => i !== ans.selectedIndex);
}

// v0.9: 获取某题对应的知识卡
function getKnowledgeCard(index) {
  const cards = result.value.knowledgeCards;
  if (!cards || cards.length === 0) return null;
  const match = cards.find(c => c.questionIndex === index);
  return match ? match.card : null;
}

// v0.9: 知识卡事件
function onKnowledgeHelpful({ cardId }) {
  console.log('[result] 知识卡有帮助:', cardId);
}

function onKnowledgeCollect({ cardId }) {
  uni.showToast({ title: '已收藏到进化手册', icon: 'success' });
  console.log('[result] 知识卡收藏:', cardId);
}

function sharePrediction() {
  if (!predictFriendName.value.trim()) return;
  const copy = getPredictionCopy(
    result.value.tier,
    result.value.tierEmoji,
    result.value.totalScore,
    predictFriendName.value.trim(),
  );
  predictCopy.value = copy;
  wx.shareAppMessage({
    title: copy,
    path: '/pages/index/index',
  });
  expStore.addExp('share');
}

onMounted(() => {
  if (quizStore.lastResult) {
    // 防止页面重新挂载时重复播放动画
    if (result.value && result.value.totalScore) return;

    result.value = quizStore.lastResult;
    if (quizStore.lastQuestions) {
      questions.value = quizStore.lastQuestions;
    }
    // 保留 store 数据以防页面重新挂载时丢失
    // 数据会在下次开始新测试时由 store.reset() 清空
    startSequence();
  } else {
    uni.showToast({ title: '数据加载失败，请重新测试', icon: 'none' });
    setTimeout(() => { uni.redirectTo({ url: '/pages/index/index' }); }, 1500);
    return;
  }

  const count = uni.getStorageSync('test_count') || 0;
  const effectiveMax = expStore.unlocks.extraDailyTest ? MAX_FREE_TESTS + 1 : MAX_FREE_TESTS;
  remainingTests.value = Math.max(0, effectiveMax - count);

  loadFriendRank();
  loadReview();
});

onBeforeUnmount(() => {
  if (lingerTimer) clearTimeout(lingerTimer);
});

async function loadReview() {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data && res.data.review) {
      reviewData.value = res.data.review;
    }
  } catch { /* ignore */ }
}

async function loadFriendRank() {
  const res = await fetchFriendRank();
  if (res.code === 0 && res.data) {
    topFriends.value = (res.data.friendRankings || []).slice(0, 3);
  }
  friendLoaded.value = true;
}

function startSequence() {
  setTimeout(() => {
    const isFirstTime = !uni.getStorageSync('has_tested');
    if (isFirstTime) {
      stage.value = 'reversal';
      fakeTier.value = REVERSAL_FAKE_TIERS[result.value.tier] || '系统错误 ⚠️';
      uni.setStorageSync('has_tested', true);
      showCollectTip.value = true;
      trackReversalStart(fakeTier.value, result.value.tier);
      trackResultView(result.value.tier, tierIndex.value, true);
    } else {
      stage.value = 'revealing';
      stageNum.value = 1;
      animateScore();
      showXpAnimation();
      scheduleStages();
      setTimeout(() => { showScreenshotHint.value = true; }, 1000);
      setTimeout(() => { showScreenshotHint.value = false; }, 4500);
      trackResultView(result.value.tier, tierIndex.value, false);
    }
    resultRevealTime = Date.now();
    lingerTimer = setTimeout(() => {
      trackResultLinger(10000, tierIndex.value);
    }, 10000);
  }, 1800);
}

function onReversalDone() {
  stage.value = 'revealing';
  stageNum.value = 1;
  animateScore();
  showXpAnimation();
  scheduleStages();
  setTimeout(() => { showScreenshotHint.value = true; }, 1000);
  setTimeout(() => { showScreenshotHint.value = false; }, 4500);
  trackReversalEnd(result.value.tier);
}

function showXpAnimation() {
  xpGained.value = expStore.getLastGain() || expStore.getExpForAction('test');
  // 如果之前的 gain 为 0，确保显示测试的基本经验值
  if (xpGained.value === 0) xpGained.value = 10;
  showXpGain.value = true;
  setTimeout(() => { showXpGain.value = false; }, 3000);
}

function scheduleStages() {
  setTimeout(() => { stageNum.value = 2; }, 600);
  setTimeout(() => { stageNum.value = 3; }, 1200);
  setTimeout(() => { stageNum.value = 4; }, 1800);
  setTimeout(() => { stageNum.value = 5; }, 2400);
}

function animateScore() {
  const target = result.value.totalScore;
  let current = 0;
  const duration = 800;
  const step = Math.max(1, Math.floor(target / 30));
  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    displayScore.value = current;
  }, duration / (target / step));
}

function generatePoster() { if (tierCardRef.value) tierCardRef.value.generate(); }
function onCardGenerated(imagePath) { generatedCardUrl.value = imagePath; }
function onCardSaved(imagePath) { trackShareSuccess(result.value.tier, 'save'); expStore.addExp('share'); }
function onCardShared({ tierName, shareStyle, channel }) { trackShareSuccess(tierName, channel); expStore.addExp('share'); }
function challengeFriend() { showChallengeModal.value = true; }
function onChallengeSent({ targetOpenid, challengeId }) { trackChallenge(targetOpenid); uni.showToast({ title: '挑战已发送！', icon: 'success' }); }

async function retryQuiz() {
  const count = uni.getStorageSync('test_count') || 0;
  const timeSinceLast = resultRevealTime ? Date.now() - resultRevealTime : 0;
  const effectiveMax = expStore.unlocks.extraDailyTest ? MAX_FREE_TESTS + 1 : MAX_FREE_TESTS;

  if (count >= effectiveMax) {
    trackTestRetry(result.value.tier, timeSinceLast, 'limited');
    const { ad } = getAvailableUnlocks();
    const hasAd = ad > 0;

    const itemList = [];
    if (hasAd) itemList.push('📺 看广告再测 1 次');
    itemList.push('📤 邀请好友解锁');

    uni.showActionSheet({
      itemList,
      success: async (res) => {
        const choice = itemList[res.tapIndex];
        if (choice.includes('看广告')) {
          uni.showToast({ title: '广告加载中…', icon: 'loading', duration: 5000 });
          const adResult = await showRewardedAd();
          uni.hideToast();
          if (adResult === 'completed') {
            uni.removeStorageSync('quiz_breakpoint');
            uni.redirectTo({ url: '/pages/quiz/quiz' });
          } else {
            uni.showToast({ title: '广告未完成，请重试', icon: 'none' });
          }
        } else if (choice.includes('邀请好友')) {
          wx.shareAppMessage({
            title: '测测你的AI段位！我在进化湾等你',
            path: '/pages/index/index',
          });
        }
      },
    });
    return;
  }
  trackTestRetry(result.value.tier, timeSinceLast, 'free');
  uni.removeStorageSync('quiz_breakpoint');
  uni.redirectTo({ url: '/pages/quiz/quiz' });
}

function submitFeedback(isAccurate) {
  trackQuickFeedback(isAccurate, result.value.tier);
  submitFeedbackApi(null, isAccurate);
  uni.showToast({ title: isAccurate ? '感谢认可！' : '感谢反馈，我们持续优化', icon: 'none' });
}

onShareAppMessage(() => {
  const tierName = result.value.tier || '神秘段位';
  trackShareClick(tierName, shareStyle.value);

  let title;
  if (shareStyle.value === 'group') {
    title = getGroupChallengeCopy(result.value.tier, result.value.tierEmoji, result.value.totalScore);
  } else {
    title = getShareTitle(tierIndex.value, shareStyle.value, {
      score: result.value.totalScore,
      persona: result.value.persona ? result.value.persona.name : '',
    });
  }

  expStore.addExp('share');

  return {
    title,
    path: '/pages/index/index',
    imageUrl: generatedCardUrl.value || '',
  };
});

onShareTimeline(() => {
  const tierName = result.value.tier || '神秘段位';
  return {
    title: `我是AI「${tierName}」！你也来测测你的AI段位？`,
    query: '',
  };
});
</script>

<style scoped lang="scss">
.page-result {
  min-height: 100vh;
  background: $color-bg-primary;

  &__evaluating {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  &__ripple {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(124, 58, 237, 0.3);
    animation: ripple-pulse 1.5s ease-out infinite;
  }

  &__eval-text {
    margin-top: 40rpx;
    font-size: 28rpx;
    color: $color-text-secondary;
    animation: text-blink 1.5s ease-in-out infinite;
  }

  &__scroll {
    height: 100vh;
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32rpx 32rpx 0;
  }

  &__section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__section-title {
    font-size: 26rpx;
    color: $color-text-secondary;
    margin-bottom: 16rpx;
    align-self: flex-start;
  }

  &__score {
    display: flex;
    align-items: baseline;
    margin-top: 4rpx;

    &-num {
      font-size: 96rpx;
      font-weight: bold;
      color: $color-gold;
    }

    &-label {
      font-size: 32rpx;
      color: $color-gold;
      margin-left: 8rpx;
    }
  }

  &__percentile {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 24rpx;

    &-num {
      font-size: 48rpx;
      font-weight: bold;
      color: $color-accent;
    }

    &-sub {
      font-size: 24rpx;
      color: $color-text-secondary;
      margin-top: 4rpx;
    }
  }

  &__next-tier {
    margin-top: 16rpx;
    padding: 12rpx 32rpx;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 24rpx;
    font-size: 24rpx;
    color: $color-text-secondary;
    text-align: center;
  }

  &__next-name,
  &__next-pts {
    color: $color-gold;
    font-weight: bold;
  }

  // A1: 差一分戏剧感
  &__one-point {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20rpx;
    padding: 16rpx 28rpx;
    background: rgba(245, 158, 11, 0.1);
    border: 1rpx solid rgba(245, 158, 11, 0.3);
    border-radius: 16rpx;
    animation: one-point-pulse 1.5s ease-in-out infinite;

    &-icon {
      font-size: 40rpx;
      margin-bottom: 4rpx;
    }

    &-text {
      font-size: 26rpx;
      color: $color-gold;
      text-align: center;
      line-height: 1.5;
    }

    &-tier {
      font-weight: bold;
      text-decoration: underline;
    }

    &-sub {
      font-size: 22rpx;
      color: $color-text-secondary;
      margin-top: 6rpx;
    }
  }

  &__radar-card {
    width: 100%;
    padding: 24rpx 20rpx;
    margin-top: 24rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 20rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  &__radar-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 12rpx;
    overflow: hidden;
  }

  &__friend-rank {
    width: 100%;
    margin-top: 32rpx;
  }

  &__friend-compare {
    width: 100%;
    margin-bottom: 16rpx;
    padding: 14rpx 20rpx;
    background: rgba(245, 158, 11, 0.08);
    border-radius: 12rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.15);
    font-size: 24rpx;
    color: $color-gold;
    text-align: center;
    line-height: 1.5;
    animation: fade-in 0.4s ease-out both;
  }

  &__friend-list {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__friend-item {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding: 14rpx 18rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;
  }

  &__friend-rank {
    font-size: 26rpx;
    font-weight: bold;
    color: $color-gold;
    width: 50rpx;
  }

  &__friend-avatar {
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }

  &__friend-name {
    flex: 1;
    font-size: 26rpx;
    color: $color-text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__friend-tier {
    font-size: 24rpx;
    color: $color-accent;
    font-weight: 500;
  }

  &__friend-empty,
  &__friend-loading {
    padding: 28rpx;
    text-align: center;
    font-size: 24rpx;
    color: $color-text-muted;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12rpx;
  }

  &__review {
    width: 100%;
    padding: 20rpx 24rpx;
    background: rgba(124, 58, 237, 0.06);
    border-radius: 14rpx;
    border: 1rpx solid rgba(124, 58, 237, 0.1);
  }

  &__review-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding: 8rpx 0;
  }

  &__review-date {
    font-size: 24rpx;
    color: $color-text-muted;
    width: 100rpx;
  }

  &__review-arrow {
    font-size: 22rpx;
    color: $color-accent;
    flex-shrink: 0;
  }

  &__review-tier {
    font-size: 24rpx;
    color: $color-text-primary;
    font-weight: 500;
  }

  &__review-score {
    font-size: 24rpx;
    color: $color-gold;
  }

  &__review-change {
    margin-top: 12rpx;
    padding: 10rpx 18rpx;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8rpx;
    font-size: 26rpx;
    text-align: center;
    font-weight: 500;

    &--up { color: #4caf50; }
    &--down { color: #ff6b6b; }
    &--same { color: $color-text-secondary; }
  }

  &__details {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__detail-item {
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    padding: 14rpx 16rpx;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10rpx;
  }

  &__detail-header {
    display: flex;
    align-items: flex-start;
    gap: 10rpx;
  }

  &__detail-q {
    font-size: 22rpx;
    color: $color-accent;
    font-weight: bold;
    flex-shrink: 0;
    width: 36rpx;
  }

  &__detail-stem {
    font-size: 22rpx;
    color: $color-text-primary;
    line-height: 1.4;
    flex: 1;
  }

  &__detail-c {
    font-size: 22rpx;
    color: $color-text-secondary;
    line-height: 1.5;
    padding-left: 46rpx;
  }

  // B4: 如果选别的答案
  &__detail-whatif {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding-left: 46rpx;
    flex-wrap: wrap;

    &-label {
      font-size: 20rpx;
      color: $color-text-muted;
    }

    &-opt {
      font-size: 20rpx;
      color: $color-text-muted;
      padding: 2rpx 10rpx;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 6rpx;

      &--better {
        color: #4caf50;
        background: rgba(76, 175, 80, 0.08);
      }
    }
  }

  // C3: 纠正一个选择
  &__correct {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    margin-top: 24rpx;
    padding: 20rpx;
    background: rgba(124, 58, 237, 0.04);
    border-radius: 14rpx;
    border: 1rpx dashed rgba(124, 58, 237, 0.15);
  }

  &__correct-text {
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__correct-btn {
    padding: 10rpx 36rpx;
    border-radius: 28rpx;
    font-size: 24rpx;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: none;
  }

  &__feedback {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    margin-top: 8rpx;

    &-label {
      font-size: 24rpx;
      color: $color-text-secondary;
    }

    &-btns {
      display: flex;
      gap: 12rpx;
    }

    &-btn {
      padding: 8rpx 24rpx;
      border-radius: 16rpx;
      font-size: 22rpx;
      color: $color-text-secondary;
      background: rgba(255, 255, 255, 0.06);
      border: 1rpx solid rgba(255, 255, 255, 0.1);

      &:active {
        background: rgba(124, 58, 237, 0.15);
      }
    }
  }

  &__actions-block {
    width: 100%;
    margin-top: 40rpx;
    padding: 32rpx 24rpx 24rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 24rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 18rpx;

    &--early {
      margin-top: 24rpx;
      background: rgba(124, 58, 237, 0.06);
      border-color: rgba(124, 58, 237, 0.15);
    }
  }

  &__share-tabs {
    display: flex;
    gap: 12rpx;
    justify-content: center;
  }

  &__share-tab {
    padding: 8rpx 24rpx;
    border-radius: 20rpx;
    font-size: 22rpx;
    color: $color-text-secondary;
    background: rgba(255, 255, 255, 0.06);
    border: 1rpx solid transparent;
    transition: all 0.2s;

    &--active {
      color: #fff;
      background: rgba(124, 58, 237, 0.15);
      border-color: $color-accent;
    }
  }

  &__actions {
    display: flex;
    gap: 20rpx;
  }

  &__btn-share {
    flex: 1.5;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, #00c8ff, #7c3aed);
    border-radius: 48rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    box-shadow: 0 6rpx 24rpx rgba(0, 200, 255, 0.4);
    text-align: center;
    animation: share-pulse 2s ease-in-out infinite;

    &:active { transform: scale(0.97); }
  }

  &__btn-challenge {
    width: 100%;
    height: 72rpx;
    line-height: 72rpx;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border-radius: 36rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    box-shadow: 0 6rpx 24rpx rgba(124, 58, 237, 0.35);
    text-align: center;

    &:active { transform: scale(0.97); }
  }

  &__btn-poster {
    flex: 1;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, #f59e0b, #f97316);
    border-radius: 48rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    box-shadow: 0 6rpx 24rpx rgba(245, 158, 11, 0.35);
    text-align: center;

    &:active { transform: scale(0.97); }
  }

  &__btn-group {
    background: linear-gradient(135deg, #f59e0b, #ef4444) !important;
    box-shadow: 0 6rpx 24rpx rgba(245, 158, 11, 0.4) !important;
    flex: 1.5;
  }

  &__btn-retry {
    width: 100%;
    height: 72rpx;
    line-height: 72rpx;
    background: rgba(255, 255, 255, 0.04);
    border: 1rpx solid rgba(255, 255, 255, 0.1);
    border-radius: 36rpx;
    color: $color-text-secondary;
    font-size: 24rpx;
    text-align: center;

    &:active { background: rgba(255, 255, 255, 0.08); }
  }

  // C1: @好友预测段位
  &__predict {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    padding: 16rpx 20rpx;
    background: rgba(245, 158, 11, 0.04);
    border-radius: 14rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.1);
  }

  &__predict-title {
    font-size: 24rpx;
    color: $color-gold;
  }

  &__predict-row {
    display: flex;
    gap: 12rpx;
  }

  &__predict-input {
    flex: 1;
    height: 60rpx;
    padding: 0 16rpx;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: #fff;
    border: 1rpx solid rgba(255, 255, 255, 0.1);
  }

  &__predict-btn {
    flex-shrink: 0;
    height: 60rpx;
    line-height: 60rpx;
    padding: 0 24rpx;
    background: linear-gradient(135deg, #f59e0b, #f97316);
    border-radius: 10rpx;
    font-size: 24rpx;
    color: #fff;
    border: none;

    &[disabled] { opacity: 0.4; }
  }

  &__predict-copy {
    font-size: 22rpx;
    color: $color-text-muted;
    line-height: 1.4;
  }

  &__screenshot-hint {
    margin-top: 16rpx;
    padding: 12rpx 28rpx;
    background: rgba(0, 0, 0, 0.7);
    border: 1rpx solid $color-gold;
    border-radius: 24rpx;
    font-size: 24rpx;
    color: $color-gold;
    animation: screenshot-hint-in 0.5s ease-out, screenshot-hint-out 0.5s ease-in 4s forwards;
  }

  // v0.9: 进化值获得提示
  &__xp-gain {
    margin-top: 20rpx;
    padding: 16rpx 28rpx;
    background: rgba(0, 200, 255, 0.06);
    border: 1rpx solid rgba(0, 200, 255, 0.15);
    border-radius: 16rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    animation: kc-fade-in 0.4s ease-out;
  }

  &__xp-gain-text {
    font-size: 26rpx;
    color: $color-accent;
    font-weight: 600;
  }

  &__xp-gain-bar {
    width: 200rpx;
    height: 8rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4rpx;
    overflow: hidden;
  }

  &__xp-gain-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-accent, #7c3aed);
    border-radius: 4rpx;
    transition: width 0.6s ease-out;
  }

  &__xp-gain-lv {
    font-size: 22rpx;
    color: $color-text-muted;
  }

  // v0.9: 进化建议
  &__evo-tip {
    width: 100%;
    padding: 24rpx 28rpx;
    background: rgba(124, 58, 237, 0.06);
    border: 1rpx solid rgba(124, 58, 237, 0.12);
    border-radius: 16rpx;
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__evo-tip-title {
    font-size: 26rpx;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 4rpx;
  }

  &__evo-tip-item {
    display: flex;
    gap: 10rpx;
    align-items: flex-start;
  }

  &__evo-tip-dot {
    color: #7c3aed;
    font-size: 24rpx;
    flex-shrink: 0;
  }

  &__evo-tip-text {
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.6;
  }

  &__persona {
    margin-top: 12rpx;
    padding: 10rpx 28rpx;
    background: rgba(245, 158, 11, 0.08);
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 20rpx;
    font-size: 26rpx;
    color: $color-gold;
    font-weight: 500;
  }

  &__dim-highlight {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    flex-wrap: wrap;
    margin-top: 16rpx;
    padding: 14rpx 20rpx;
    background: rgba(0, 200, 255, 0.06);
    border-radius: 12rpx;
    border: 1rpx solid rgba(0, 200, 255, 0.1);
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__dim-icon { font-size: 24rpx; }
  &__dim-label { color: $color-text-muted; }
  &__dim-name { color: #00c8ff; font-weight: bold; }
  &__dim-arrow { font-size: 20rpx; color: $color-text-muted; margin-left: 8rpx; }

  &__collect-tip {
    margin-top: 8rpx;
    padding: 14rpx 20rpx;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 12rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    text-align: center;
    font-size: 22rpx;
    color: $color-gold;
    line-height: 1.4;
    animation: fade-in 0.5s ease-out both;
  }
}

.page-result__fade-in {
  animation: fade-in 0.5s ease-out both;
}

@keyframes ripple-pulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 0.2; }
  100% { transform: scale(0.8); opacity: 0.6; }
}

@keyframes text-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes screenshot-hint-in {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes screenshot-hint-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes one-point-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
  50% { box-shadow: 0 0 24rpx rgba(245, 158, 11, 0.2); }
}

@keyframes share-pulse {
  0%, 100% { box-shadow: 0 6rpx 24rpx rgba(0, 200, 255, 0.4); }
  50% { box-shadow: 0 6rpx 36rpx rgba(0, 200, 255, 0.7), 0 0 60rpx rgba(124, 58, 237, 0.3); }
}
</style>
