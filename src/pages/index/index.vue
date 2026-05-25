<template>
  <view class="page-index">
    <ParticleBg ref="particleRef" />
    <PrivacyModal ref="privacyRef" />
    <view v-if="showOverlay" class="page-index__overlay" />

    <!-- 段位悬赏结果通知 -->
    <view v-if="bountyNotifications.length > 0" class="page-index__bounty-toast">
      <view v-for="b in bountyNotifications" :key="b._id" class="page-index__bounty-toast-card" @click="dismissBountyNotify(b._id)">
        <text class="page-index__bounty-toast-icon">{{ b.isCorrect ? '🎯' : '😅' }}</text>
        <view class="page-index__bounty-toast-body">
          <text class="page-index__bounty-toast-title">{{ b.isCorrect ? '猜对了！' : '猜错了…' }}</text>
          <text class="page-index__bounty-toast-detail">你猜 {{ b.targetName }} 是「{{ b.guessedTier }}」→ 实际「{{ b.actualTier }}」</text>
        </view>
        <text class="page-index__bounty-toast-close">✕</text>
      </view>
    </view>

    <!-- 帮朋友测 Banner（个性化：显示好友段位） -->
    <view v-if="friendName" class="page-index__friend-banner">
      <text class="page-index__friend-banner-text">
        <template v-if="friendTier">
          <text class="page-index__friend-banner-tier">{{ friendTierEmoji }} {{ friendTier }}</text>
          <text class="page-index__friend-banner-name">@{{ friendName }}</text> 邀你来测AI段位
        </template>
        <template v-else>
          🔍 <text class="page-index__friend-banner-name">@{{ friendName }}</text> 帮 TA 测测AI段位
        </template>
      </text>
    </view>

    <view class="page-index__body" :class="{ 'page-index__body--shrink': btnShrink }">
      <text class="page-index__title">你的AI段位</text>
      <text class="page-index__subtitle">AI时代，你处在哪个段位？</text>
      <!-- A3: AI实时评价 -->
      <view class="page-index__ai-eval">
        <text class="page-index__ai-eval-dot" />
        <text class="page-index__ai-eval-text">{{ aiEvalText }}</text>
      </view>
      <!-- C2: 首次AI身份预判 -->
      <view v-if="isFirstVisit" class="page-index__prejudge">
        <text class="page-index__prejudge-emoji">🔮</text>
        <text class="page-index__prejudge-text">{{ prejudgeText }}</text>
        <text class="page-index__prejudge-hint">测完就知道准不准 →</text>
      </view>
      <text class="page-index__guide">5道情景题 · 2分钟 · 测出你的AI真实段位</text>

      <!-- 每日主题预告 -->
      <view class="page-index__theme-badge">
        <text class="page-index__theme-icon">{{ themeIcon }}</text>
        <text class="page-index__theme-label">{{ themeLabel }}</text>
      </view>

      <!-- 今日状态条 -->
      <view class="page-index__status-bar">
        <text v-if="!freeTestUsed">🎁 今日首次测评 · 免费</text>
        <text v-else>📺 看 15 秒广告继续测 · 结果计入段位</text>
      </view>

      <!-- 实时：X 人正在测试 -->
      <view v-if="testingNow > 0" class="page-index__testing-now">
        <text class="page-index__testing-now-dot" />
        <text class="page-index__testing-now-text">{{ testingNow }} 人正在测试</text>
      </view>

      <!-- 社交证明：总用户数 + 好友段位气泡（CTA 上方，最大化决策影响力） -->
      <view class="page-index__proof">
        <text class="page-index__proof-num">{{ displayUsers.toLocaleString() }}</text>
        <text class="page-index__proof-label">人已完成定段</text>
      </view>

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

      <button
        class="page-index__cta"
        :class="{ 'page-index__cta--urgent': isUrgent }"
        :disabled="transitioning"
        @click="handleStart"
      >{{ ctaText }}</button>
      <text v-if="showHint" class="page-index__hint">3秒测出你的AI段位</text>

      <!-- F14: 进化值展示 -->
      <view class="page-index__exp-bar">
        <text class="page-index__exp-label">Lv.{{ expStore.level }} {{ expStore.levelName }}</text>
        <view class="page-index__exp-track">
          <view class="page-index__exp-fill" :style="{ width: expStore.levelProgress + '%' }" />
        </view>
      </view>

      <!-- 段位晋升进度条（回访用户） -->
      <view v-if="nextTierInfo" class="page-index__tier-teaser" @click="handleStart">
        <text class="page-index__tier-teaser-text">
          距「{{ nextTierInfo.name }}」{{ nextTierInfo.emoji }} 还差 {{ nextTierInfo.gap }} 分
        </text>
        <view class="page-index__tier-teaser-bar">
          <view class="page-index__tier-teaser-fill" :style="{ width: nextTierInfo.progress + '%' }" />
        </view>
        <text class="page-index__tier-teaser-cta">再测一次很可能就升段 →</text>
      </view>

      <!-- v0.9: 深度定段入口 (Lv.5+ 解锁) -->
      <view v-if="expStore.unlocks.deepMode" class="page-index__deep-entry" @click="handleDeepStart">
        <text class="page-index__deep-entry-icon">🧬</text>
        <text class="page-index__deep-entry-text">深度定段 · 10题版</text>
        <text class="page-index__deep-entry-hint">满分100 · 仅自己可见</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import ParticleBg from '@/components/ParticleBg/ParticleBg.vue';
import PrivacyModal from '@/components/PrivacyModal/PrivacyModal.vue';
import { fetchTierDistribution, fetchFriendRank, preloadDailyQuestions, fetchWeeklyStats, getUserOpenid, getUserOpenidSync, markBountyViewed, callCloudFunction } from '@/utils/api.js';
import { trackPageViewHome, trackHomeHesitate, trackInviteUnlock, trackTestStart, trackShareClick } from '@/utils/analytics.js';
import { hasUsedFreeTestToday, markFreeTestUsed, showRewardedAd } from '@/utils/ad.js';
import { useExperienceStore } from '@/store/experience.js';
import { useQuizStore } from '@/store/quiz.js';
import { TIERS, pointsToNextTier, getNextTier, getTier } from '@/utils/tier.js';

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
let t5 = null, t10 = null, ctaTimer = null;

// F1: CTA 按钮文案轮换
const CTA_COPIES = [
  '开始定段 ⚡',
  '我赌你是工具人 🛠️',
  '3秒揭穿你的AI水平',
  '你敢让AI给你打分吗？',
  '测完别哭 😂',
  '看看你是不是AI小白',
];
const ctaText = ref(CTA_COPIES[0]);

// F2: 好友段位气泡
const friendBubble = ref(null); // { count, topTier, topTierEmoji }

// 段位悬赏通知
const bountyNotifications = ref([]);

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
  'AI说：这个人有点意思 👀',
  '你的段位可能比你想的高…',
  '数据加载中… 咦，有点特别',
  'AI正在猜测你的段位…',
];
const aiEvalText = ref(AI_EVAL_TEXTS[0]);
let aiEvalTimer = null;
let animateTimer = null;

// C2: 首次AI身份预判
const PREJUDGE_TEXTS = [
  '我们赌你是个「工具人」🛠️… 不服来测！',
  'AI说你可能是「调戏师」💬… 测测看？',
  '系统预判：你有「驾驭者」潜质 ⚡',
  '初步扫描：像是个「协作者」🤝',
  'AI猜测：萌新 🐣… 但也有可能是隐藏大佬',
];
const isFirstVisit = ref(!uni.getStorageSync('has_tested'));
const prejudgeText = ref(PREJUDGE_TEXTS[Math.floor(Math.random() * PREJUDGE_TEXTS.length)]);

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

// ── 段位进度（回访用户）──
const nextTierInfo = ref(null);

async function loadTierProgress() {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data && res.data.consecutiveDays !== undefined) {
      // 用户已完成过测试，有签到/测试记录
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
        nextTierInfo.value = {
          name: nextTier,
          emoji: nextTierObj ? nextTierObj.emoji : '',
          gap,
          progress: Math.min(99, Math.max(1, progress)),
        };
      }
    }
  } catch (e) { /* 静默 */ }
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

  // 段位悬赏：接收分享链接中的悬赏参数
  if (options.bounty_tier && options.target_name) {
    app.globalData.bountyTier = decodeURIComponent(options.bounty_tier);
    app.globalData.bountyTargetName = decodeURIComponent(options.target_name);
    // 同时用于个性化 banner：显示好友的段位
    if (!friendName.value) {
      friendName.value = decodeURIComponent(options.target_name);
    }
    friendTier.value = decodeURIComponent(options.bounty_tier);
    friendTierEmoji.value = getTierEmojiForName(friendTier.value);
  }
  if (options.from_uid) {
    app.globalData.shareFromUid = options.from_uid;
  }

  // F1: CTA 按钮文案轮换（随机起始 + 8s 轮换）
  const startIdx = Math.floor(Math.random() * CTA_COPIES.length);
  ctaText.value = CTA_COPIES[startIdx];
  let copyIdx = startIdx;
  ctaTimer = setInterval(() => {
    copyIdx = (copyIdx + 1) % CTA_COPIES.length;
    ctaText.value = CTA_COPIES[copyIdx];
  }, 8000);

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
onShow(() => {
  transitioning.value = false;
  btnShrink.value = false;
  showOverlay.value = false;
});

// F2: 加载好友段位气泡
async function loadFriendBubble() {
  try {
    const res = await fetchFriendRank();
    if (res.code === 0 && res.data && res.data.friendRankings) {
      const friends = res.data.friendRankings;
      const isGlobalFallback = res.data.isGlobalFallback;
      // 段位悬赏结果
      if (res.data.bountyResults && res.data.bountyResults.length > 0) {
        bountyNotifications.value = res.data.bountyResults;
      }
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

async function dismissBountyNotify(bountyId) {
  await markBountyViewed(bountyId);
  bountyNotifications.value = bountyNotifications.value.filter(b => b._id !== bountyId);
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

async function handleStart() {
  if (transitioning.value) return;

  // ① 每日免费测试
  if (!hasUsedFreeTestToday()) {
    startQuiz();
    return;
  }

  // ② 邀请解锁（优先 — 社交裂变）
  try {
    // 3s 超时保护：云函数冷启动或网络波动时自动降级
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

function startQuiz() {
  quizStore.reset();
  quizStore.setDeepMode(false);
  uni.removeStorageSync('quiz_breakpoint'); // 清除旧断点，确保全新开始
  trackTestStart('new', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => {
    uni.navigateTo({
      url: '/pages/quiz/quiz',
      fail: () => {
        transitioning.value = false;
        btnShrink.value = false;
        showOverlay.value = false;
      },
    });
  }, 500);
}

function handleDeepStart() {
  if (transitioning.value) return;
  quizStore.reset();
  quizStore.setDeepMode(true);
  uni.removeStorageSync('quiz_breakpoint');
  trackTestStart('deep', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => {
    uni.navigateTo({
      url: '/pages/quiz/quiz',
      fail: () => {
        transitioning.value = false;
        btnShrink.value = false;
        showOverlay.value = false;
      },
    });
  }, 500);
}

onShareAppMessage(() => {
  trackShareClick('home', 'share');
  const uid = getUserOpenidSync();
  return {
    title: '测测你的AI段位！我在进化湾等你 🧬',
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: '/static/images/default-share.png',
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
.page-index {
  position: relative; min-height: 100vh; overflow: hidden;
  background: linear-gradient(180deg, #1a0533 0%, #0d1b2a 100%);

  &__overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: #000; z-index: 200; animation: fade-in 0.2s ease-out;
  }

  &__friend-banner {
    position: relative;
    z-index: 10;
    margin: 120rpx 32rpx 0;
    padding: 20rpx 28rpx;
    background: rgba(245, 158, 11, 0.12);
    border: 1rpx solid rgba(245, 158, 11, 0.25);
    border-radius: 16rpx;
    text-align: center;

    &-text {
      font-size: 28rpx;
      color: #fff;
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
  }

  &__body {
    position: relative; z-index: 10;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 35vh; transition: transform 0.3s ease-out;
    &--shrink { transform: scale(0.92); opacity: 0.7; }
  }

  &__title {
    font-size: 72rpx; font-weight: 700; color: #fff;
    text-shadow: 0 0 40rpx rgba(124, 58, 237, 0.5);
  }

  &__subtitle {
    font-size: 28rpx; color: rgba(255, 255, 255, 0.45); margin-top: 16rpx;
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

  &__guide {
    font-size: 24rpx;
    color: rgba(124, 58, 237, 0.7);
    margin-top: 12rpx;
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
    width: 400rpx; height: 112rpx; margin-top: 44rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 56rpx; font-size: 36rpx; font-weight: 700;
    color: #fff; border: none;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8rpx 40rpx rgba(124, 58, 237, 0.4);
    animation: breathe 1.5s ease-in-out infinite;
    &--urgent { animation: breathe-fast 0.8s ease-in-out infinite; }
  }

  &__hint {
    font-size: 26rpx; color: #f59e0b; margin-top: 24rpx;
    animation: fade-in 0.4s ease-out;
  }

  &__proof {
    display: flex; align-items: baseline; gap: 8rpx; margin-top: 28rpx;
    &-num { font-size: 32rpx; font-weight: 700; color: rgba(255,255,255,0.55); }
    &-label { font-size: 24rpx; color: rgba(255,255,255,0.3); }
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
    transition: all 0.2s;

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
</style>
