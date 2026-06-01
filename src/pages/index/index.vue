<template>
  <view class="page-index">
    <ParticleBg ref="particleRef" />
    <PrivacyModal ref="privacyRef" />
    <view v-if="showOverlay" class="page-index__overlay" />


    <!-- Phase 7: 被邀请欢迎卡（含奖励信息） -->
    <view v-if="friendName && !showReversalBanner" class="page-index__friend-banner" @click="handleStart">
      <template v-if="friendTier">
        <view class="page-index__friend-banner-gift">🎁 @{{ friendName }} 邀请你来测AI段位</view>
        <text class="page-index__friend-banner-friendtier">{{ friendTierEmoji }} {{ friendName }} 的段位：{{ friendTier }}</text>
        <view class="page-index__friend-banner-bonus">
          <text>✨ 被邀请用户首次测试额外 +10 XP</text>
          <text>📊 测完看看你能不能超过 {{ friendName }}</text>
        </view>
      </template>
      <template v-else>
        <view class="page-index__friend-banner-gift">🎁 @{{ friendName }} 邀请你来测AI段位</view>
        <view class="page-index__friend-banner-bonus">
          <text>✨ 被邀请用户首次测试额外 +10 XP</text>
        </view>
      </template>
    </view>

    <!-- 反转 Banner：好友的AI段位被AI耍了 -->
    <view v-if="showReversalBanner" class="page-index__reversal-banner">
      <text class="page-index__reversal-banner-text">
        你的好友测出了一个AI段位，但<text class="page-index__reversal-banner-highlight">先被AI骗了</text>… 反转后才知道真相。你敢来测吗？
      </text>
    </view>

    <!-- Phase 1: 挑战应战模式 -->
    <view v-if="challengeMode && challengeData" class="page-index__challenge-banner">
      <view class="page-index__challenge-badge">⚔️ 段位挑战</view>
      <text class="page-index__challenge-title">
        <text class="page-index__challenge-name">{{ challengeData.challengerName }}</text>
        <text v-if="challengeData.challengerTier">（{{ challengeData.challengerTier }} · AI商数 {{ challengeAIQ }}）</text>
      </text>
      <text class="page-index__challenge-sub">向你发起 AI 段位挑战</text>
      <text class="page-index__challenge-vs">你能超过 TA 吗？</text>
    </view>

    <!-- ====== 首屏可见区 ====== -->
    <view class="page-index__hero" :class="{ 'page-index__hero--shrink': btnShrink }">
      <text v-if="!showReturningHero" class="page-index__title">进化湾 · AI段位测评</text>
      <text v-if="!showReturningHero" class="page-index__subtitle">AI时代，你处在哪个段位？</text>

      <!-- Phase 4: 回访用户段位卡片（始终可见，不消耗额度） -->
      <view v-if="showReturningHero" class="page-index__returning-card">
        <image
          v-if="returningTierBadge"
          class="page-index__returning-badge"
          :src="returningTierBadge"
          mode="aspectFit"
        />
        <text class="page-index__returning-tier">{{ returningTierEmoji }} {{ returningTierName }}</text>
        <text class="page-index__returning-aiq">AI商数 {{ returningAIQ }}</text>
        <text class="page-index__returning-pct">超越全国 {{ returningPercentile }}% 用户</text>
        <view class="page-index__returning-actions">
          <button class="page-index__returning-btn page-index__returning-btn--view" @click="viewMyResult">
            📋 查看我的结果
          </button>
          <button class="page-index__returning-btn page-index__returning-btn--share" open-type="share" @click="trackShareClick('home', 'returning_hero')">
            📤 分享段位卡
          </button>
        </view>
      </view>

      <!-- A3: AI实时评价 -->
      <view class="page-index__ai-eval">
        <text class="page-index__ai-eval-dot" />
        <text class="page-index__ai-eval-text">{{ aiEvalText }}</text>
      </view>

      <!-- C2: 首次AI身份预判 -->
      <view v-if="isFirstVisit" class="page-index__prejudge">
        <text class="page-index__prejudge-text">{{ prejudgeText }}</text>
      </view>

      <!-- 新用户引导：三步流程可视化 -->
      <view v-if="isFirstVisit" class="page-index__onboarding">
        <view class="page-index__onboarding-steps">
          <view class="page-index__onboarding-step">
            <text class="page-index__onboarding-step-num">①</text>
            <text class="page-index__onboarding-step-text">答5题</text>
          </view>
          <text class="page-index__onboarding-arrow">→</text>
          <view class="page-index__onboarding-step">
            <text class="page-index__onboarding-step-num">②</text>
            <text class="page-index__onboarding-step-text">AI分析</text>
          </view>
          <text class="page-index__onboarding-arrow">→</text>
          <view class="page-index__onboarding-step">
            <text class="page-index__onboarding-step-num">③</text>
            <text class="page-index__onboarding-step-text">分享比一比</text>
          </view>
        </view>
        <text class="page-index__onboarding-time">⏱ 仅需2分钟 · 测出你的AI真实水平</text>
      </view>

      <!-- 连续进化天数 -->
      <view v-if="streakDays >= 1" class="page-index__streak">
        <view class="page-index__streak-flame">
          <text class="page-index__streak-emoji">{{ streakDays >= 30 ? '👑' : streakDays >= 7 ? '⚡' : '🔥' }}</text>
          <text class="page-index__streak-count">{{ streakDays }}</text>
        </view>
        <text class="page-index__streak-label">连续进化 {{ streakDays }} 天</text>
        <text v-if="streakBest > streakDays" class="page-index__streak-best">最长记录 {{ streakBest }} 天</text>
        <text v-if="!testedToday && streakDays > 0" class="page-index__streak-risk">⚡ 今天还没测，连续记录要断了！</text>
      </view>

      <!-- CTA 按钮 -->
      <button
        class="page-index__cta"
        :class="{ 'page-index__cta--urgent': isUrgent }"
        :disabled="transitioning"
        @click="handleStart"
      >{{ ctaText }}</button>

      <!-- CTA下方轻量社交证明 -->
      <view class="page-index__proof">
        <text class="page-index__proof-num">{{ displayUsers.toLocaleString() }}</text>
        <text class="page-index__proof-label">人已完成定段 · 5题2分钟</text>
      </view>

      <text v-if="showHint" class="page-index__hint">3秒测出你的AI段位</text>
    </view>

    <!-- Phase 2: 邀请进度横幅 -->
    <view v-if="inviteStatsLoaded" class="page-index__invite-banner" :class="{ 'page-index__invite-banner--has-unlocks': inviteStats.inviteUnlocks > 0 }">
      <template v-if="inviteStats.inviteUnlocks > 0">
        <view class="page-index__invite-banner-inner" @click="handleStart">
          <text class="page-index__invite-banner-icon">🎁</text>
          <text class="page-index__invite-banner-text">{{ inviteStats.inviteUnlocks }} 次额外测试机会可用</text>
          <text class="page-index__invite-banner-action">立即使用 →</text>
        </view>
      </template>
      <template v-else-if="inviteStats.inviteCount > 0">
        <view class="page-index__invite-banner-inner">
          <text class="page-index__invite-banner-icon">📤</text>
          <text class="page-index__invite-banner-text">已邀请 {{ inviteStats.inviteCount }} 位好友完成测试，累计 {{ inviteStats.inviteCount }} 次额外机会</text>
        </view>
      </template>
      <template v-else>
        <button class="page-index__invite-banner-share-btn" open-type="share" @click="trackInviteSent('private')">
          <text class="page-index__invite-banner-icon">👥</text>
          <text class="page-index__invite-banner-text">邀请好友测试 → 解锁额外次数</text>
        </button>
      </template>
    </view>

    <!-- Phase 3: 本周排名徽章 -->
    <view v-if="myWeeklyRank" class="page-index__weekly-rank" @click="goToWeeklyRank">
      <text class="page-index__weekly-rank-icon">📊</text>
      <text class="page-index__weekly-rank-text">本周排名：第 {{ myWeeklyRank }} 位 · 共 {{ weeklyTotalParticipants }} 人</text>
      <text class="page-index__weekly-rank-arrow">→</text>
    </view>

    <!-- ====== 滚动探索区 ====== -->
    <view class="page-index__scroll">
      <!-- 每日一题快速入口 -->
      <view class="page-index__daily-entry" @click="handleDailyStart">
        <text class="page-index__daily-entry-icon">⚡</text>
        <text class="page-index__daily-entry-text">每日一题 · 30秒</text>
        <text class="page-index__daily-entry-arrow">→</text>
      </view>

      <!-- 每日主题预告 -->
      <view class="page-index__theme-badge">
        <text class="page-index__theme-icon">{{ themeIcon }}</text>
        <text class="page-index__theme-label">{{ themeLabel }}</text>
      </view>

      <!-- 今日状态条 -->
      <view class="page-index__status-bar">
        <text v-if="freeTestRemaining > 0">今日剩余 {{ freeTestRemaining }} 次免费测评</text>
        <text v-else>今日免费次数已用完 · 邀请好友或看广告继续</text>
      </view>

      <!-- 实时：X 人正在测试 -->
      <view v-if="testingNow > 0" class="page-index__testing-now">
        <text class="page-index__testing-now-dot" />
        <text class="page-index__testing-now-text">{{ testingNow }} 人正在测试</text>
      </view>

      <!-- 好友段位气泡 -->
      <view v-if="friendBubble" class="page-index__friend-bubble" @click="handleStart">
        <text class="page-index__friend-bubble-text">
          <template v-if="friendBubble.isGlobalFallback">
            已有 {{ friendBubble.count }} 人测出 {{ friendBubble.topTier }} {{ friendBubble.topTierEmoji }}，你呢？
          </template>
          <template v-else>
            你的 {{ friendBubble.count }} 位好友已是 {{ friendBubble.topTier }} {{ friendBubble.topTierEmoji }}，你呢？
          </template>
        </text>
      </view>

      <!-- 段位晋升进度条（回访用户） -->
      <view v-if="nextTierInfo" class="page-index__tier-teaser" @click="handleStart">
        <text class="page-index__tier-teaser-text">
          距「{{ nextTierInfo.name }}」{{ nextTierInfo.emoji }} 还差 {{ nextTierInfo.gap }} 点AI商数
        </text>
        <view class="page-index__tier-teaser-bar">
          <view class="page-index__tier-teaser-fill" :style="{ width: nextTierInfo.progress + '%' }" />
        </view>
        <text class="page-index__tier-teaser-cta">再测一次很可能就升段 →</text>
      </view>

      <!-- F14: 进化值展示 -->
      <view class="page-index__exp-bar">
        <text class="page-index__exp-label">Lv.{{ expStore.level }} {{ expStore.levelName }}</text>
        <view class="page-index__exp-track">
          <view class="page-index__exp-fill" :style="{ width: expStore.levelProgress + '%' }" />
        </view>
      </view>

      <!-- v0.9: 深度定段入口 -->
      <view v-if="expStore.unlocks.deepMode" class="page-index__deep-entry" @click="handleDeepStart">
        <text class="page-index__deep-entry-text">🔬 深度定段 · 10题版</text>
        <text class="page-index__deep-entry-hint">满分100 · 仅自己可见</text>
      </view>
      <view v-else class="page-index__deep-entry page-index__deep-entry--locked">
        <text class="page-index__deep-entry-text">🔒 深度定段 · 10题版</text>
        <text class="page-index__deep-entry-hint">Lv.5 解锁 · 当前 Lv.{{ expStore.level }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import ParticleBg from '@/components/ParticleBg/ParticleBg.vue';
import PrivacyModal from '@/components/PrivacyModal/PrivacyModal.vue';
import { fetchTierDistribution, fetchFriendRank, preloadDailyQuestions, fetchWeeklyStats, fetchWeeklyLeaderboard, getUserOpenid, getUserOpenidSync, callCloudFunction, fetchChallenge, fetchInviteStats, fetchLastResult } from '@/utils/api.js';
import { trackPageViewHome, trackHomeHesitate, trackInviteUnlock, trackTestStart, trackShareClick, trackInviteSent } from '@/utils/analytics.js';
import { hasUsedFreeTestToday, getFreeTestsRemaining, markFreeTestUsed, showRewardedAd } from '@/utils/ad.js';
import { useExperienceStore } from '@/store/experience.js';
import { useQuizStore } from '@/store/quiz.js';
import { TIERS, pointsToNextTier, getNextTier, getTier, toAIQuotient } from '@/utils/tier.js';
import { TIER_BADGE_IMAGES } from '@/utils/constants.js';
import { createSoundEngine } from '@/utils/sound-engine.js';

const particleRef = ref(null);
const privacyRef = ref(null);
const displayUsers = ref(0);
const testingNow = ref(0);
const isUrgent = ref(false);
const showHint = ref(false);
const transitioning = ref(false);
const btnShrink = ref(false);
const showOverlay = ref(false);
const friendName = ref('');
const friendTier = ref('');
const friendTierEmoji = ref('');
const showReversalBanner = ref(false);
const inviteUnlockCached = ref(null); // null=未加载, true=可用, false=不可用
// Phase 1: 挑战应战模式
const challengeMode = ref(false);
const challengeData = ref(null); // { _id, challengerName, challengerTier, challengerScore }
const challengeAIQ = ref(0);
// Phase 2: 邀请进度
const inviteStats = ref({ inviteCount: 0, inviteUnlocks: 0 });
const inviteStatsLoaded = ref(false);
// Phase 3: 本周排名
const myWeeklyRank = ref(null);
const weeklyTotalParticipants = ref(0);
// Phase 4: 回访用户段位展示（分享零门槛）
const showReturningHero = ref(false);
const returningTierName = ref('');
const returningTierEmoji = ref('');
const returningAIQ = ref(0);
const returningPercentile = ref(0);
const returningTierBadge = ref('');
let t5 = null, t10 = null, ctaTimer = null;

// F1: CTA 按钮文案轮换
const CTA_COPIES = [
  '开始定段',
  '我赌你是实践者',
  '3秒揭穿你的AI水平',
  '你敢让AI给你打分吗',
  '测完别哭',
  '看看你是不是AI小白',
];
const ctaText = ref(CTA_COPIES[0]);

// F2: 好友段位气泡
const friendBubble = ref(null); // { count, topTier, topTierEmoji }

// F14: 进化值
const expStore = useExperienceStore();
const quizStore = useQuizStore();

// A3: AI实时评价轮换
const AI_EVAL_TEXTS = [
  '正在扫描你的AI使用痕迹…',
  '检测到你上周用了 47 次 AI…',
  'AI 正在分析你的数字足迹…',
  '你的AI熟练度可能超乎想象…',
  '系统怀疑你是个隐藏的高手…',
  '正在比对全国用户数据…',
  'AI说：这个人有点意思',
  '你的段位可能比你想的高…',
  '数据加载中… 咦，有点特别',
  'AI正在猜测你的段位…',
];
const aiEvalText = ref(AI_EVAL_TEXTS[0]);
let aiEvalTimer = null;
let animateTimer = null;

// C2: 首次AI身份预判
const PREJUDGE_TEXTS = [
  '我们赌你是个「实践者」… 不服来测',
  'AI说你可能是「探索者」… 测测看',
  '系统预判：你有「驾驭者」潜质',
  '初步扫描：像是个「协作者」',
  'AI猜测：萌新… 但也有可能是隐藏大佬',
];
const isFirstVisit = ref(!uni.getStorageSync('has_tested'));
const prejudgeText = ref(PREJUDGE_TEXTS[Math.floor(Math.random() * PREJUDGE_TEXTS.length)]);

// 连续测试天数
const streakDays = ref(0);
const streakBest = ref(0);
const testedToday = ref(false);

// 每日一题
function handleDailyStart() {
  if (transitioning.value) return;
  quizStore.reset();
  quizStore.setDeepMode(false);
  uni.removeStorageSync('quiz_breakpoint');
  trackTestStart('daily', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => {
    navigateToQuiz('mode=daily');
  }, 500);
}

// ── 每日主题 ──
const THEME_MAP = {
  1: { icon: '🔬', label: '周一硬核 — 你在 AI 浪潮的第几层？' },
  2: { icon: '💼', label: '周二职场 — AI 替你干活时，老板知道吗？' },
  3: { icon: '🛠️', label: '周三应用 — AI 同事来了，你准备好了吗？' },
  4: { icon: '🎨', label: '周四脑洞 — 如果 AI 有朋友圈，它会发什么？' },
  5: { icon: '🎮', label: '周五趣味 — 周末模式，测测 AI 有多懂你' },
  6: { icon: '🌿', label: '周末感悟 — AI 时代的生活智慧，你有几分？' },
  0: { icon: '🌿', label: '周末感悟 — AI 时代的生活智慧，你有几分？' },
};
const themeIcon = computed(() => THEME_MAP[new Date().getDay()]?.icon || '🔬');
const themeLabel = computed(() => THEME_MAP[new Date().getDay()]?.label || '每日 AI 段位测试');

// ── 今日状态 ──
const freeTestUsed = computed(() => hasUsedFreeTestToday());
const freeTestRemaining = ref(getFreeTestsRemaining());

// ── 段位进度（回访用户）──
const nextTierInfo = ref(null);

async function loadTierProgress() {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      // 连续测试天数
      streakDays.value = res.data.testConsecutiveDays || 0;
      streakBest.value = res.data.streakBest || 0;
      testedToday.value = res.data.testedToday || false;

      // 连续进化中但今天还没测 → 紧迫模式
      if (streakDays.value >= 2 && !testedToday.value) {
        isUrgent.value = true;
        ctaText.value = streakDays.value >= 7
          ? `守护 ${streakDays.value} 天连冠，现在开测`
          : `连续 ${streakDays.value} 天了！别让它断掉`;
      }

      // 用户已完成过测试，有签到/测试记录
      if (res.data.consecutiveDays === undefined) return;
      const lastScore = res.data.lastScore; // 可能来自 userData
      if (!lastScore) {
        // 尝试从 test_records 推断
        return;
      }
      const nextTier = getNextTier(lastScore);
      const gap = pointsToNextTier(lastScore);
      if (nextTier && gap > 0) {
        const currentTierObj = getTier(lastScore);
        const nextTierObj = TIERS.find(t => t.name === nextTier);
        const currentMin = currentTierObj ? currentTierObj.min : 5;
        const nextMin = nextTierObj ? nextTierObj.min : 50;
        const totalRange = nextMin - currentMin;
        const progressInTier = lastScore - currentMin;
        const progress = totalRange > 0 ? Math.floor((progressInTier / totalRange) * 100) : 0;
        const aiqGap = toAIQuotient(nextTierObj ? nextTierObj.min : 50) - toAIQuotient(lastScore);
        nextTierInfo.value = {
          name: nextTier,
          emoji: nextTierObj ? nextTierObj.emoji : '',
          gap: aiqGap,
          progress: Math.min(99, Math.max(1, progress)),
        };
      }
    }
  } catch (e) { /* 静默 */ }
}

// Phase 3: 静默加载本周排名
async function loadWeeklyRank() {
  try {
    const res = await fetchWeeklyLeaderboard();
    if (res.code === 0 && res.data && res.data.myEntry) {
      myWeeklyRank.value = res.data.myEntry.rank;
      weeklyTotalParticipants.value = res.data.totalParticipants || 0;
    }
  } catch (e) { /* 静默 */ }
}

function goToWeeklyRank() {
  uni.switchTab({ url: '/pages/rank/rank' });
  getApp().globalData.rankDefaultTab = 'weekly';
}

// Phase 4: 加载回访用户段位数据（三级降级：localStorage → cloud → 无）
async function loadReturningUserData() {
  try {
    // Priority 1: 完整 localStorage 数据
    const savedResult = uni.getStorageSync('last_result_data');
    if (savedResult && savedResult.tier) {
      applyReturningData(savedResult);
      return;
    }

    // Priority 2: 降级数据（last_tier_name + last_score）
    const lastTier = uni.getStorageSync('last_tier_name');
    const lastScore = Number(uni.getStorageSync('last_score') || 0);
    if (lastTier && lastScore > 0) {
      const tierObj = TIERS.find(t => t.name === lastTier);
      returningTierName.value = lastTier;
      returningTierEmoji.value = tierObj ? tierObj.emoji : '';
      returningAIQ.value = Math.round((lastScore / 50) * 80 + 70);
      returningTierBadge.value = tierObj ? TIER_BADGE_IMAGES[tierObj.name] || '' : '';
      showReturningHero.value = true;
      return;
    }

    // Priority 3: 云端兜底
    const res = await fetchLastResult();
    if (res.code === 0 && res.data) {
      applyReturningData(res.data);
    }
  } catch (e) {
    console.warn('[index] loadReturningUserData 失败:', e);
  }
}

function applyReturningData(data) {
  returningTierName.value = data.tier || '';
  returningTierEmoji.value = data.tierEmoji || '';
  returningAIQ.value = data.totalScore
    ? Math.round((data.totalScore / 50) * 80 + 70)
    : 0;
  returningPercentile.value = data.percentile || 0;
  const tierObj = TIERS.find(t => t.name === data.tier);
  returningTierBadge.value = tierObj ? TIER_BADGE_IMAGES[tierObj.name] || '' : '';
  showReturningHero.value = true;
  // 更新 CTA 文案
  ctaText.value = '再测一次，看段位变了没';
}

function viewMyResult() {
  uni.navigateTo({
    url: '/pages/result/result?mode=review',
    fail: () => {
      uni.showToast({ title: '页面跳转失败', icon: 'none' });
    },
  });
}

onMounted(async () => {
  // 隐私政策检查（首次启动弹窗）
  if (privacyRef.value) privacyRef.value.check();

  // 记录首页加载时间
  const app = getApp();
  const loadTime = app.globalData.appLaunchTime ? Date.now() - app.globalData.appLaunchTime : 0;

  // 检查是否有帮朋友测的参数
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const options = page.options || {};
  if (options.friend_name) {
    friendName.value = decodeURIComponent(options.friend_name);
    uni.setStorageSync('friend_name', friendName.value);
  }
  if (options.friend_tier) {
    friendTier.value = decodeURIComponent(options.friend_tier);
    const tier = TIERS.find(t => t.name === friendTier.value);
    if (tier) friendTierEmoji.value = tier.emoji;
  }

  if (options.from_uid) {
    app.globalData.shareFromUid = options.from_uid;
  }

  if (options.reversal === '1') {
    showReversalBanner.value = true;
  }

  // Phase 1: 挑战应战模式
  if (options.challengeId) {
    challengeMode.value = true;
    ctaText.value = '⚔️ 接受挑战';
    loadChallengeData(options.challengeId);
  }

  // F1: CTA 按钮文案轮换（随机起始 + 8s 轮换）
  // Phase 1: 挑战模式下跳过轮换，保持 '⚔️ 接受挑战'
  if (!challengeMode.value) {
    const startIdx = Math.floor(Math.random() * CTA_COPIES.length);
    ctaText.value = CTA_COPIES[startIdx];
    let copyIdx = startIdx;
    ctaTimer = setInterval(() => {
      copyIdx = (copyIdx + 1) % CTA_COPIES.length;
      ctaText.value = CTA_COPIES[copyIdx];
    }, 8000);
  }

  // A3: AI实时评价轮换（随机起始 + 3s 轮换）
  aiEvalText.value = AI_EVAL_TEXTS[Math.floor(Math.random() * AI_EVAL_TEXTS.length)];
  let evalIdx = AI_EVAL_TEXTS.indexOf(aiEvalText.value);
  aiEvalTimer = setInterval(() => {
    evalIdx = (evalIdx + 1) % AI_EVAL_TEXTS.length;
    aiEvalText.value = AI_EVAL_TEXTS[evalIdx];
  }, 3000);

  preloadDailyQuestions();
  getUserOpenid(); // 预加载用户 openid，供分享跟踪（静默）
  const res = await fetchTierDistribution();
  if (res.code === 0 && res.data) {
    animateNumber(res.data.totalUsers || 0);
    testingNow.value = res.data.testingNow || 0;
  }

  // F2: 静默加载好友段位数据
  loadFriendBubble();
  loadTierProgress(); // 回访用户段位进度（静默）
  preloadInviteStatus(); // 预加载邀请解锁状态
  loadWeeklyRank(); // Phase 3: 静默加载本周排名
  loadReturningUserData(); // Phase 4: 回访用户段位展示

  // Phase 5: 挑战/反转 Banner 到达音效
  if (showReversalBanner.value || (friendName.value && !showReversalBanner.value)) {
    setTimeout(() => createSoundEngine().play('home_arrive'), 600);
  }

  // 埋点：首页浏览
  trackPageViewHome({
    source: options.friend_name ? 'share' : 'direct',
    from_uid: options.friend_name || '',
    load_time: loadTime,
  });

  // 停留 5s 后触发犹豫埋点
  t5 = setTimeout(() => {
    isUrgent.value = true;
    trackHomeHesitate(5000);
  }, 5000);
  t10 = setTimeout(() => { showHint.value = true; }, 10000);
});

onBeforeUnmount(() => { clearTimeout(t5); clearTimeout(t10); clearInterval(ctaTimer); clearInterval(aiEvalTimer); clearInterval(animateTimer); });

// 页面重新显示时重置状态（修复从 quiz 返回后按钮卡死）
// P1-3: 也刷新存储相关的状态，修复状态栏滞后
onShow(() => {
  transitioning.value = false;
  btnShrink.value = false;
  showOverlay.value = false;
  // 刷新免费测试状态（storage 可能已被其他页面修改）
  freeTestRemaining.value = getFreeTestsRemaining();
  loadTierProgress();
  loadWeeklyRank();
  loadReturningUserData(); // Phase 4: 回访用户段位展示
  preloadInviteStatus(); // 刷新邀请解锁状态
});

// Phase 1: 加载挑战数据
async function loadChallengeData(challengeId) {
  try {
    const res = await fetchChallenge(challengeId);
    if (res.code === 0 && res.data) {
      challengeData.value = res.data;
      challengeAIQ.value = res.data.challengerScore > 0
        ? Math.round((res.data.challengerScore / 50) * 80 + 70)
        : 0;
      // 挑战模式也设置 friend 参数，复用部分逻辑
      friendName.value = res.data.challengerName;
      friendTier.value = res.data.challengerTier;
    } else {
      // 挑战不存在或已结束，回退到普通模式
      challengeMode.value = false;
    }
  } catch (e) {
    // 网络异常等，回退到普通模式
    challengeMode.value = false;
  }
}

// F2: 加载好友段位气泡
async function loadFriendBubble() {
  try {
    const res = await fetchFriendRank();
    if (res.code === 0 && res.data && res.data.friendRankings) {
      const friends = res.data.friendRankings;
      const isGlobalFallback = res.data.isGlobalFallback;
      if (friends.length > 0) {
        // 取最高频段位
        const tierCount = {};
        friends.forEach(f => {
          const t = f.currentTier || f.tier;
          if (t) tierCount[t] = (tierCount[t] || 0) + 1;
        });
        let topTier = '';
        let maxCount = 0;
        for (const [t, c] of Object.entries(tierCount)) {
          if (c > maxCount) { maxCount = c; topTier = t; }
        }
        const topTierEmoji = getTierEmojiForName(topTier);
        friendBubble.value = {
          count: friends.length,
          topTier,
          topTierEmoji,
          isGlobalFallback,
        };
      }
    }
  } catch (e) { /* 静默 */ }
}

function getTierEmojiForName(name) {
  const tier = TIERS.find(t => t.name === name);
  return tier ? tier.emoji : '';
}

function animateNumber(target) {
  if (animateTimer) clearInterval(animateTimer);
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 50));
  animateTimer = setInterval(() => {
    cur = Math.min(cur + step, target);
    displayUsers.value = cur;
    if (cur >= target) { clearInterval(animateTimer); animateTimer = null; }
  }, 40);
}

// 预加载邀请解锁状态，减少 handleStart 中的云函数等待
async function preloadInviteStatus() {
  try {
    const statsRes = await fetchInviteStats();
    if (statsRes.code === 0 && statsRes.data) {
      inviteStats.value = {
        inviteCount: statsRes.data.inviteCount || 0,
        inviteUnlocks: statsRes.data.inviteUnlocks || 0,
      };
    }
  } catch (e) { /* silent */ }
  inviteStatsLoaded.value = true;

  if (!hasUsedFreeTestToday()) {
    inviteUnlockCached.value = false;
    return;
  }
  // 仅检查可用次数，不实际消费（消费在 handleStart 点击时进行）
  if (inviteStats.value.inviteUnlocks > 0) {
    inviteUnlockCached.value = true;
  } else {
    inviteUnlockCached.value = null; // null = 需要实时查询
  }
}

async function handleStart() {
  if (transitioning.value) return;

  // Phase 1: 挑战应战模式 — 零摩擦直接进入答题
  if (challengeMode.value) {
    startQuiz();
    return;
  }

  // Phase 7: 被邀请用户首次测试 — 零摩擦入口，不拦门控
  if (friendName.value && isFirstVisit.value) {
    startQuiz();
    return;
  }

  // ① 每日免费测试
  if (!hasUsedFreeTestToday()) {
    getApp().globalData.gatePath = 'free';
    startQuiz();
    return;
  }

  // ② 邀请解锁（优先 — 社交裂变）
  // 缓存命中 → 乐观启动 + 后台核销
  if (inviteUnlockCached.value === true) {
    trackInviteUnlock(1);
    inviteUnlockCached.value = false;
    // 后台核销（不阻塞启动）
    callCloudFunction('submitScore', { action: 'claimInviteUnlock' }, { retry: false })
      .then(res => {
        if (res.code === 0 && res.data?.available) {
          uni.showToast({ title: '已使用邀请解锁次数！', icon: 'success' });
        } else {
          uni.showToast({ title: '解锁次数不足，本次为免费额度', icon: 'none' });
        }
      }).catch(() => {});
    startQuiz();
    return;
  }
  // 缓存未命中 → 实时查询（含 3s 超时保护）
  if (inviteUnlockCached.value === null) {
    try {
      const claimPromise = callCloudFunction('submitScore', { action: 'claimInviteUnlock' }, { retry: false });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ code: -1, data: null }), 3000));
      const claimRes = await Promise.race([claimPromise, timeoutPromise]);
      if (claimRes.code === 0 && claimRes.data && claimRes.data.available) {
        trackInviteUnlock(1);
        uni.showToast({ title: '已使用邀请解锁次数！', icon: 'success' });
        startQuiz();
        return;
      }
    } catch (e) {
      console.warn('[handleStart] claimInviteUnlock 失败，降级:', e);
    }
  }

  // ③ 连续签到奖励（>=5 天）
  const streak = Number(uni.getStorageSync('checkin_streak') || 0);
  if (streak >= 5) {
    const { confirm: useStreak } = await new Promise((resolve) => {
      uni.showModal({
        title: `连续签到 ${streak} 天奖励`,
        content: '你已连续签到超过5天，可使用签到奖励再测一次！',
        confirmText: '使用奖励',
        cancelText: '稍后再说',
        success: resolve,
      });
    });
    if (useStreak) {
      trackInviteUnlock(2);
      startQuiz();
      return;
    }
  }

  // ④ 广告降级方案
  const { confirm } = await new Promise((resolve) => {
    uni.showModal({
      title: '今日免费测评已用完',
      content: '邀请好友完成测试可解锁新次数，或看一段广告即可继续',
      confirmText: '看广告解锁',
      cancelText: '稍后再说',
      success: resolve,
    });
  });
  if (!confirm) return;

  trackInviteUnlock(0);
  uni.showToast({ title: '广告加载中…', icon: 'loading' });
  const adResult = await showRewardedAd();
  uni.hideToast();

  if (adResult === 'completed') {
    uni.showToast({ title: '解锁成功！', icon: 'success' });
    startQuiz();
  } else {
    uni.showToast({ title: '广告未完成，请重试', icon: 'none' });
  }
}

// 统一导航到答题页（带失败重试 + 用户提示）
function navigateToQuiz(params = '') {
  const quizUrl = '/pages/quiz/quiz' + (params ? ('?' + params) : '');
  const doNav = (isRetry) => {
    uni.navigateTo({
      url: quizUrl,
      success: () => {
        // 导航成功，状态在 onShow 中重置
      },
      fail: (err) => {
        console.warn('[index] navigateTo quiz 失败:', err?.errMsg || 'unknown');
        if (!isRetry) {
          // 重试一次（等待页面生命周期完成）
          setTimeout(() => doNav(true), 300);
        } else {
          // 重试仍失败，降级为 reLaunch
          uni.reLaunch({
            url: quizUrl,
            fail: () => {
              uni.showToast({ title: '启动失败，请重试', icon: 'none' });
              transitioning.value = false;
              btnShrink.value = false;
              showOverlay.value = false;
            },
          });
        }
      },
    });
  };
  doNav(false);
}

function startQuiz() {
  // Phase 5: CTA 入口音效
  createSoundEngine().play('cta_press');
  quizStore.reset();
  quizStore.setDeepMode(false);
  uni.removeStorageSync('quiz_breakpoint'); // 清除旧断点，确保全新开始
  trackTestStart(challengeMode.value ? 'challenge' : 'new', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => {
    const params = (challengeMode.value && challengeData.value)
      ? 'challengeId=' + encodeURIComponent(challengeData.value._id) : '';
    navigateToQuiz(params);
  }, 500);
}

function handleDeepStart() {
  if (transitioning.value) return;
  // Phase 5: 深度模式入口音效
  createSoundEngine().play('cta_press');
  quizStore.reset();
  quizStore.setDeepMode(true);
  uni.removeStorageSync('quiz_breakpoint');
  trackTestStart('deep', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => {
    const params = (challengeMode.value && challengeData.value)
      ? 'challengeId=' + encodeURIComponent(challengeData.value._id) : '';
    navigateToQuiz(params);
  }, 500);
}

onShareAppMessage(() => {
  trackShareClick('home', 'share');
  // Phase 7: 分享即时奖励
  try { useExperienceStore().addExp('share_action'); } catch (e) { /* */ }
  const uid = getUserOpenidSync();
  // Phase 4: 回访用户个性化分享文案
  const tierName = returningTierName.value;
  const tierEmoji = returningTierEmoji.value;
  const aiq = returningAIQ.value;
  let title;
  if (tierName && aiq > 0) {
    const copies = [
      `我是「${tierName}」${tierEmoji}，AI商数 ${aiq}！测测你是什么段位？`,
      `${tierEmoji} ${tierName} · AI商数${aiq} — 我在进化湾等你来战！`,
      `测出AI段位：${tierName} ${tierEmoji}！你也来测测看？`,
    ];
    title = copies[Math.floor(Math.random() * copies.length)];
  } else {
    title = '测测你的AI段位！我在进化湾等你';
  }
  return {
    title,
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: getApp().globalData.defaultShareImage || '/static/images/default-share.png',
  };
});

onShareTimeline(() => {
  const tierName = returningTierName.value;
  const aiq = returningAIQ.value;
  const title = tierName && aiq > 0
    ? `我是AI「${tierName}」· AI商数${aiq}！你也来测测你的AI段位？`
    : '你的AI段位是什么？3秒揭晓 →';
  return {
    title,
    query: '',
  };
});
</script>

<style scoped lang="scss">
.page-index {
  position: relative; min-height: 100vh; overflow-x: hidden;
  background: linear-gradient(180deg, #1a0533 0%, #0d1b2a 100%);

  &__overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: #000; z-index: 200; animation: fade-in 0.2s ease-out;
  }

  &__friend-banner {
    position: relative;
    z-index: 10;
    margin: 80rpx 32rpx 0;
    padding: 20rpx 28rpx;
    background: rgba(245, 158, 11, 0.12);
    border: 1rpx solid rgba(245, 158, 11, 0.25);
    border-radius: 16rpx;
    text-align: center;

    &-text {
      font-size: 28rpx;
      color: #fff;
    }

    &-challenge {
      display: block;
      font-size: 48rpx;
      margin-bottom: 6rpx;
      line-height: 1.2;
    }

    &-name {
      color: $color-gold;
      font-weight: bold;
    }

    &-tier {
      color: $color-gold;
      font-weight: bold;
      margin-right: 4rpx;
    }

    &-vs {
      display: block;
      margin-top: 10rpx;
      font-size: 26rpx;
      color: $color-accent;
      font-weight: 600;
      animation: pulse-vs 1.8s ease-in-out infinite;
    }

    // Phase 7: 被邀请欢迎卡新增样式
    &-gift {
      font-size: 28rpx;
      color: #f59e0b;
      font-weight: bold;
      margin-bottom: 6rpx;
    }

    &-friendtier {
      display: block;
      font-size: 26rpx;
      color: rgba(255,255,255,0.8);
      margin-bottom: 8rpx;
    }

    &-bonus {
      display: flex;
      flex-direction: column;
      gap: 4rpx;
      padding-top: 8rpx;
      border-top: 1rpx solid rgba(255,255,255,0.1);
      font-size: 22rpx;
      color: rgba(255,255,255,0.55);
      text-align: center;
    }
  }

  @keyframes pulse-vs {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.03); }
  }

  &__reversal-banner {
    position: relative;
    z-index: 10;
    margin: 80rpx 32rpx 0;
    padding: 20rpx 28rpx;
    background: rgba(124, 58, 237, 0.12);
    border: 1rpx solid rgba(124, 58, 237, 0.3);
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    gap: 12rpx;
    animation: reversal-glow 2s ease-in-out infinite;

    &-emoji {
      font-size: 40rpx;
      flex-shrink: 0;
    }

    &-text {
      font-size: 26rpx;
      color: #fff;
      line-height: 1.5;
      flex: 1;
    }

    &-highlight {
      color: #f59e0b;
      font-weight: bold;
    }
  }

  // Phase 1: 挑战应战模式
  &__challenge-banner {
    position: relative;
    z-index: 10;
    margin: 60rpx 32rpx 0;
    padding: 28rpx;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 83, 80, 0.08));
    border: 1rpx solid rgba(245, 158, 11, 0.35);
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    animation: challenge-glow 2s ease-in-out infinite;
    will-change: transform, opacity;
  }

  &__challenge-badge {
    font-size: 22rpx;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.12);
    padding: 4rpx 16rpx;
    border-radius: 8rpx;
    letter-spacing: 2rpx;
  }

  &__challenge-title {
    font-size: 26rpx;
    color: #fff;
    text-align: center;
    line-height: 1.5;
  }

  &__challenge-name {
    color: #f59e0b;
    font-weight: bold;
    font-size: 30rpx;
  }

  &__challenge-sub {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.6);
  }

  &__challenge-vs {
    font-size: 32rpx;
    color: #ffd700;
    font-weight: bold;
    margin-top: 4rpx;
    text-shadow: 0 0 20rpx rgba(255, 215, 0, 0.3);
  }

  // ====== 首屏英雄区 ======
  &__hero {
    position: relative; z-index: 10;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 120rpx; transition: transform 0.3s ease-out;
    &--shrink { transform: scale(0.92); opacity: 0.7; }
  }

  &__title {
    font-size: 72rpx; font-weight: 700; color: #fff;
    text-shadow: 0 0 40rpx rgba(124, 58, 237, 0.5);
  }

  &__subtitle {
    font-size: 28rpx; color: rgba(255, 255, 255, 0.45); margin-top: 16rpx;
  }

  // Phase 4: 回访用户段位卡片
  &__returning-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    margin-top: 20rpx;
    padding: 28rpx 24rpx;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(124, 58, 237, 0.08));
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 24rpx;
    animation: fade-in 0.5s ease-out both;
  }

  &__returning-badge {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    margin-bottom: 4rpx;
  }

  &__returning-tier {
    font-size: 40rpx;
    font-weight: bold;
    color: #fff;
  }

  &__returning-aiq {
    font-size: 32rpx;
    font-weight: bold;
    color: #f59e0b;
    text-shadow: 0 0 16rpx rgba(245, 158, 11, 0.3);
  }

  &__returning-pct {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 8rpx;
  }

  &__returning-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 12rpx;
  }

  &__returning-btn {
    padding: 16rpx 28rpx;
    border-radius: 32rpx;
    font-size: 26rpx;
    font-weight: 600;
    border: none;
    line-height: 1.4;

    &--view {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 1rpx solid rgba(255, 255, 255, 0.15);
    }

    &--share {
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      color: #fff;
      box-shadow: 0 4rpx 16rpx rgba(124, 58, 237, 0.3);
    }
  }

  // 新用户简化引导
  &__quick-guide {
    font-size: 22rpx;
    color: rgba(124, 58, 237, 0.6);
    margin-top: 18rpx;
    animation: fade-in 0.5s ease-out both;
  }

  // P0-4: 新用户三步引导
  &__onboarding {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    margin-top: 24rpx;
    padding: 20rpx 28rpx;
    background: rgba(124, 58, 237, 0.06);
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    border-radius: 20rpx;
    animation: fade-in 0.5s ease-out both;
  }

  &__onboarding-steps {
    display: flex;
    align-items: center;
    gap: 8rpx;
  }

  &__onboarding-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
  }

  &__onboarding-step-num {
    font-size: 22rpx;
    color: #7c3aed;
    font-weight: bold;
  }

  &__onboarding-step-text {
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.6);
  }

  &__onboarding-arrow {
    font-size: 20rpx;
    color: rgba(124, 58, 237, 0.3);
  }

  &__onboarding-time {
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.35);
  }

  // 连续进化天数
  &__streak {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    margin-top: 20rpx;
    padding: 14rpx 32rpx;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 152, 0, 0.04));
    border: 1rpx solid rgba(245, 158, 11, 0.25);
    border-radius: 20rpx;
    animation: fade-in 0.4s ease-out both;
  }

  &__streak-flame {
    display: flex;
    align-items: center;
    gap: 6rpx;
  }

  &__streak-emoji {
    font-size: 36rpx;
    animation: flame-bounce 0.6s ease-in-out infinite alternate;
  }

  &__streak-count {
    font-size: 48rpx;
    font-weight: bold;
    color: $color-gold;
    text-shadow: 0 0 16rpx rgba(245, 158, 11, 0.5);
  }

  &__streak-label {
    font-size: 22rpx;
    color: $color-gold;
    font-weight: 500;
  }

  &__streak-best {
    font-size: 20rpx;
    color: rgba(245, 158, 11, 0.5);
  }

  &__streak-risk {
    font-size: 22rpx;
    color: #ff6b6b;
    font-weight: 600;
    animation: risk-pulse 1.5s ease-in-out infinite;
  }

  // A3: AI实时评价
  &__ai-eval {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: 14rpx;
    padding: 8rpx 20rpx;
    background: rgba(0, 200, 255, 0.06);
    border-radius: 14rpx;
    border: 1rpx solid rgba(0, 200, 255, 0.08);
  }

  &__ai-eval-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: #00c8ff;
    animation: eval-dot-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  &__ai-eval-text {
    font-size: 22rpx;
    color: rgba(0, 200, 255, 0.7);
    transition: opacity 0.3s ease;
  }

  // C2: 首次AI身份预判
  &__prejudge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    margin-top: 20rpx;
    padding: 14rpx 24rpx;
    background: rgba(245, 158, 11, 0.06);
    border: 1rpx solid rgba(245, 158, 11, 0.15);
    border-radius: 14rpx;
    animation: fade-in 0.5s ease-out both;
  }

  &__prejudge-emoji {
    font-size: 32rpx;
  }

  &__prejudge-text {
    font-size: 24rpx;
    color: $color-gold;
    text-align: center;
    line-height: 1.5;
  }

  &__prejudge-hint {
    font-size: 20rpx;
    color: rgba(245, 158, 11, 0.5);
    margin-top: 2rpx;
  }

  // ====== 滚动探索区 ======
  &__scroll {
    position: relative; z-index: 10;
    display: flex; flex-direction: column; align-items: center;
    padding: 32rpx 0 160rpx;
  }

  // 每日一题快速入口
  &__daily-entry {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 14rpx 24rpx;
    background: rgba(0, 200, 255, 0.08);
    border: 1rpx solid rgba(0, 200, 255, 0.15);
    border-radius: 20rpx;
    margin-bottom: 20rpx;
    transition: background 0.15s, transform 0.15s;
    &:active { background: rgba(0, 200, 255, 0.15); transform: scale(0.97); }

    &-icon { font-size: 22rpx; }
    &-text { font-size: 24rpx; color: rgba(0, 200, 255, 0.85); font-weight: 500; }
    &-arrow { font-size: 22rpx; color: rgba(0, 200, 255, 0.5); }
  }

  // 每日主题预告
  &__theme-badge {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: 20rpx;
    padding: 10rpx 24rpx;
    background: rgba(124, 58, 237, 0.08);
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    border-radius: 20rpx;
    animation: fade-in 0.5s ease-out both;
  }

  &__theme-icon {
    font-size: 28rpx;
    flex-shrink: 0;
  }

  &__theme-label {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.4;
  }

  // 今日状态条
  &__status-bar {
    margin-top: 14rpx;
    padding: 8rpx 24rpx;
    background: rgba(245, 158, 11, 0.06);
    border: 1rpx solid rgba(245, 158, 11, 0.12);
    border-radius: 12rpx;
    font-size: 22rpx;
    color: $color-gold;
    text-align: center;
  }

  // 实时：X 人正在测试
  &__testing-now {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    margin-top: 14rpx;
    animation: fade-in 0.5s ease-out both;
  }

  &__testing-now-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: #22c55e;
    animation: eval-dot-pulse 1.5s ease-in-out infinite;
  }

  &__testing-now-text {
    font-size: 22rpx;
    color: rgba(34, 197, 94, 0.7);
  }

  &__cta {
    width: 400rpx; height: 112rpx; margin-top: 32rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 56rpx; font-size: 36rpx; font-weight: 700;
    color: #fff; border: none;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8rpx 40rpx rgba(124, 58, 237, 0.4);
    animation: breathe 1.5s ease-in-out infinite;
    will-change: transform;
    &--urgent { animation: breathe-fast 0.8s ease-in-out infinite; will-change: transform; }
  }

  &__hint {
    font-size: 26rpx; color: #f59e0b; margin-top: 16rpx;
    animation: fade-in 0.4s ease-out;
  }

  &__proof {
    display: flex; align-items: baseline; gap: 6rpx; margin-top: 20rpx;
    &-num { font-size: 28rpx; font-weight: 700; color: rgba(255,255,255,0.5); }
    &-label { font-size: 22rpx; color: rgba(255,255,255,0.3); }
  }

  // Phase 2: 邀请进度横幅
  &__invite-banner {
    position: relative;
    z-index: 10;
    margin: 24rpx 32rpx 0;
    border-radius: 16rpx;
    overflow: hidden;

    &--has-unlocks {
      animation: invite-glow 2s ease-in-out infinite;
      will-change: transform, opacity;
    }

    &-inner {
      display: flex;
      align-items: center;
      gap: 10rpx;
      padding: 18rpx 28rpx;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 152, 0, 0.05));
      border: 1rpx solid rgba(245, 158, 11, 0.25);
      border-radius: 16rpx;
    }

    &-share-btn {
      display: flex;
      align-items: center;
      gap: 10rpx;
      padding: 18rpx 28rpx;
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.03));
      border: 1rpx solid rgba(124, 58, 237, 0.2);
      border-radius: 16rpx;
      width: 100%;
      text-align: left;
      font-size: 24rpx;

      &::after { border: none; }
    }

    &-icon {
      font-size: 32rpx;
      flex-shrink: 0;
    }

    &-text {
      font-size: 24rpx;
      color: #fff;
      flex: 1;
      line-height: 1.4;
    }

    &-action {
      font-size: 24rpx;
      color: #f59e0b;
      font-weight: bold;
      flex-shrink: 0;
    }
  }

  @keyframes invite-glow {
    0%, 100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
    50% { box-shadow: 0 0 20rpx rgba(245, 158, 11, 0.25); }
  }

  // Phase 3: 本周排名徽章
  &__weekly-rank {
    margin: 20rpx 32rpx 0;
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 14rpx 24rpx;
    background: rgba(124, 58, 237, 0.06);
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    border-radius: 20rpx;
    &-icon { font-size: 28rpx; }
    &-text { font-size: 24rpx; color: rgba(255, 255, 255, 0.7); flex: 1; }
    &-arrow { font-size: 22rpx; color: rgba(124, 58, 237, 0.6); }
  }

  // F2: 好友段位气泡
  &__friend-bubble {
    margin-top: 24rpx;
    padding: 16rpx 28rpx;
    background: rgba(245, 158, 11, 0.08);
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 20rpx;
    animation: bubble-pulse 2s ease-in-out infinite;

    &-text {
      font-size: 24rpx;
      color: $color-gold;
      text-align: center;
      line-height: 1.5;
    }
  }

  // F14: 进化值展示
  &__exp-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    margin-top: 32rpx;
  }

  &__exp-label {
    font-size: 20rpx;
    color: rgba(255, 255, 255, 0.35);
  }

  &__exp-track {
    width: 240rpx;
    height: 6rpx;
    border-radius: 3rpx;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__exp-fill {
    height: 100%;
    border-radius: 3rpx;
    background: linear-gradient(90deg, #7c3aed, $color-gold);
    transition: width 0.5s ease;
  }

  // 段位晋升进度条（回访用户）
  &__tier-teaser {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    margin-top: 24rpx;
    padding: 16rpx 28rpx;
    background: rgba(245, 158, 11, 0.06);
    border: 1rpx solid rgba(245, 158, 11, 0.12);
    border-radius: 16rpx;
    animation: fade-in 0.5s ease-out both;

    &-text {
      font-size: 24rpx;
      color: $color-gold;
      font-weight: 500;
    }

    &-bar {
      width: 280rpx;
      height: 8rpx;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4rpx;
      overflow: hidden;
    }

    &-fill {
      height: 100%;
      background: linear-gradient(90deg, $color-gold, $color-accent);
      border-radius: 4rpx;
      transition: width 0.6s ease-out;
    }

    &-cta {
      font-size: 22rpx;
      color: $color-accent;
      opacity: 0.8;
    }
  }

  // v0.9: 深度定段入口
  &__deep-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    margin-top: 28rpx;
    padding: 18rpx 32rpx;
    background: rgba(124, 58, 237, 0.08);
    border: 1rpx solid rgba(124, 58, 237, 0.2);
    border-radius: 16rpx;
    transition: background 0.2s, transform 0.2s;

    &--locked {
      opacity: 0.5;
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.08);
      &:active { transform: none; background: rgba(255, 255, 255, 0.03); }
    }

    &:active {
      background: rgba(124, 58, 237, 0.15);
      transform: scale(0.97);
    }

    &-icon {
      font-size: 36rpx;
    }

    &-text {
      font-size: 26rpx;
      font-weight: 600;
      color: rgba(124, 58, 237, 0.9);
    }

    &-hint {
      font-size: 20rpx;
      color: rgba(124, 58, 237, 0.5);
    }
  }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes breathe-fast {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bubble-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(245,158,11,0); }
  50% { box-shadow: 0 0 20rpx rgba(245,158,11,0.15); }
}

@keyframes eval-dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes reversal-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(124, 58, 237, 0); }
  50% { box-shadow: 0 0 24rpx rgba(124, 58, 237, 0.25); }
}

@keyframes flame-bounce {
  from { transform: scale(1); }
  to { transform: scale(1.15); }
}

@keyframes risk-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@keyframes challenge-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); border-color: rgba(245, 158, 11, 0.25); }
  50% { box-shadow: 0 0 30rpx rgba(245, 158, 11, 0.2); border-color: rgba(245, 158, 11, 0.5); }
}
</style>
