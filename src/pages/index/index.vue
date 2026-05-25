<template>
  <view class="page-index">
    <ParticleBg ref="particleRef" />
    <PrivacyModal ref="privacyRef" />
    <view v-if="showOverlay" class="page-index__overlay" />

    <!-- 帮朋友测 Banner -->
    <view v-if="friendName" class="page-index__friend-banner">
      <text class="page-index__friend-banner-text">
        🔍 <text class="page-index__friend-banner-name">@{{ friendName }}</text> 帮 TA 测测AI段位
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
      <button
        class="page-index__cta"
        :class="{ 'page-index__cta--urgent': isUrgent }"
        :disabled="transitioning"
        @click="handleStart"
      >{{ ctaText }}</button>
      <text v-if="showHint" class="page-index__hint">3秒测出你的AI段位</text>
      <view class="page-index__proof">
        <text class="page-index__proof-num">{{ displayUsers.toLocaleString() }}</text>
        <text class="page-index__proof-label">人已完成定段</text>
      </view>

      <!-- F2: 好友段位预览气泡 -->
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

      <!-- F14: 进化值展示 -->
      <view class="page-index__exp-bar">
        <text class="page-index__exp-label">Lv.{{ expStore.level }} {{ expStore.levelName }}</text>
        <view class="page-index__exp-track">
          <view class="page-index__exp-fill" :style="{ width: expStore.levelProgress + '%' }" />
        </view>
      </view>

      <!-- v0.9: 深度定段入口 (Lv.18+ 解锁) -->
      <view v-if="expStore.unlocks.deepMode" class="page-index__deep-entry" @click="handleDeepStart">
        <text class="page-index__deep-entry-icon">🧬</text>
        <text class="page-index__deep-entry-text">深度定段 · 10题版</text>
        <text class="page-index__deep-entry-hint">满分100 · 仅自己可见</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import ParticleBg from '@/components/ParticleBg/ParticleBg.vue';
import PrivacyModal from '@/components/PrivacyModal/PrivacyModal.vue';
import { fetchTierDistribution, fetchFriendRank, preloadDailyQuestions } from '@/utils/api.js';
import { MAX_FREE_TESTS } from '@/utils/numeric-constants.js';
import { trackPageViewHome, trackHomeHesitate, trackInviteUnlock, trackTestStart, trackShareClick } from '@/utils/analytics.js';
import { canWatchAd, getAvailableUnlocks, showRewardedAd } from '@/utils/ad.js';
import { useExperienceStore } from '@/store/experience.js';
import { useQuizStore } from '@/store/quiz.js';
import { TIERS } from '@/utils/tier.js';

const particleRef = ref(null);
const privacyRef = ref(null);
const displayUsers = ref(0);
const isUrgent = ref(false);
const showHint = ref(false);
const transitioning = ref(false);
const btnShrink = ref(false);
const showOverlay = ref(false);
const friendName = ref('');
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

  const today = new Date().toISOString().slice(0, 10);
  if (uni.getStorageSync('test_date') !== today) {
    uni.setStorageSync('test_date', today);
    uni.setStorageSync('test_count', 0);
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
  const res = await fetchTierDistribution();
  if (res.code === 0 && res.data) animateNumber(res.data.totalUsers || 0);

  // F2: 静默加载好友段位数据
  loadFriendBubble();

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
  } catch { /* 静默 */ }
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
  const count = uni.getStorageSync('test_count') || 0;
  const effectiveMax = expStore.unlocks.extraDailyTest ? MAX_FREE_TESTS + 1 : MAX_FREE_TESTS;
  if (count >= effectiveMax) {
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
          trackInviteUnlock(0);
          uni.showToast({ title: '广告加载中…', icon: 'loading', duration: 5000 });
          const adResult = await showRewardedAd();
          uni.hideToast();
          if (adResult === 'completed') {
            uni.showToast({ title: '解锁成功！', icon: 'success' });
            startQuiz();
          } else {
            uni.showToast({ title: '广告未完成，请重试', icon: 'none' });
          }
        } else if (choice.includes('邀请好友')) {
          trackInviteUnlock(0);
          wx.shareAppMessage({
            title: '测测你的AI段位！我在进化湾等你',
            path: '/pages/index/index',
          });
        }
      },
    });
    return;
  }
  startQuiz();
}

function startQuiz() {
  quizStore.setDeepMode(false);
  trackTestStart('new', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => { uni.navigateTo({ url: '/pages/quiz/quiz' }); }, 500);
}

function handleDeepStart() {
  if (transitioning.value) return;
  const count = uni.getStorageSync('test_count') || 0;
  const effectiveMax = expStore.unlocks.extraDailyTest ? MAX_FREE_TESTS + 1 : MAX_FREE_TESTS;
  if (count >= effectiveMax) {
    uni.showToast({ title: '今日次数已用完，明天再来深度定段吧', icon: 'none' });
    return;
  }
  quizStore.setDeepMode(true);
  trackTestStart('deep', ctaText.value);
  transitioning.value = true;
  if (particleRef.value) particleRef.value.accelerate();
  btnShrink.value = true;
  setTimeout(() => { showOverlay.value = true; }, 300);
  setTimeout(() => { uni.navigateTo({ url: '/pages/quiz/quiz' }); }, 500);
}

onShareAppMessage(() => {
  trackShareClick('home', 'share');
  return {
    title: '测测你的AI段位！我在进化湾等你 🧬',
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

  &__cta {
    width: 400rpx; height: 112rpx; margin-top: 80rpx;
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
    display: flex; align-items: baseline; gap: 8rpx; margin-top: 48rpx;
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
