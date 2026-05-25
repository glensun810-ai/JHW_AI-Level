<template>
  <view class="page-rank">
    <!-- 今日结算倒计时 -->
    <view class="page-rank__countdown-bar">
      <text class="page-rank__countdown-icon">⏳</text>
      <text class="page-rank__countdown-text">距离今日段位榜结算还剩 {{ countdownText }}</text>
    </view>

    <!-- F12: 截图引导 -->
    <view v-if="showScreenshotHint" class="page-rank__screenshot-hint">
      <text>📸 截个图发给好友，让他们看看你的排名</text>
    </view>

    <!-- 隐私开关 -->
    <view class="page-rank__privacy-bar">
      <text class="page-rank__privacy-label">🔒 隐藏我的排名</text>
      <switch
        :checked="privacyHidden"
        color="#7c3aed"
        @change="onPrivacyToggle"
      />
    </view>
    <view class="page-rank__privacy-link" @click="showPrivacyModal = true">
      <text>📜 隐私政策与用户协议</text>
    </view>

    <!-- 4 Tab -->
    <view class="page-rank__tabs">
      <view
        v-for="t in tabs"
        :key="t.key"
        class="page-rank__tab"
        :class="{ 'page-rank__tab--active': activeTab === t.key }"
        @click="switchTab(t.key)"
      >
        <text>{{ t.label }}</text>
        <view v-if="activeTab === t.key" class="page-rank__tab-line" />
      </view>
    </view>

    <!-- Tab 1: 好友段位榜 -->
    <scroll-view v-if="activeTab === 'friend'" scroll-y class="page-rank__list">
      <view v-if="friendLoading" class="page-rank__loading">加载中…</view>
      <template v-else>
        <!-- 段位悬赏结果通知 -->
        <view v-if="bountyResults.length > 0" class="page-rank__bounty-section">
          <view v-for="b in bountyResults" :key="b._id" class="page-rank__bounty-card" @click="dismissBounty(b._id)">
            <view class="page-rank__bounty-header">
              <text class="page-rank__bounty-icon">{{ b.isCorrect ? '🎯' : '❌' }}</text>
              <text class="page-rank__bounty-title">
                {{ b.isCorrect ? '猜对了！' : '猜错了…' }}
              </text>
            </view>
            <text class="page-rank__bounty-detail">
              你猜 {{ b.targetName }} 是「{{ b.guessedTier }}」→ 实际是「{{ b.actualTier }}」（{{ b.actualScore }}分）
            </text>
            <text class="page-rank__bounty-hint">点击关闭</text>
          </view>
        </view>
        <view v-if="isGlobalFallback && friendList.length > 0" class="page-rank__fallback-notice">
          <text>ℹ️ 暂未添加好友，展示全服高手榜。分享给好友即可查看好友排名</text>
        </view>
        <view v-if="friendList.length > 0" class="page-rank__items">
          <view
            v-for="(f, i) in friendList"
            :key="f._openid || i"
            class="page-rank__item"
            :class="{ 'page-rank__item--me': f._openid === myOpenid }"
          >
            <text class="page-rank__rank" :class="{ 'page-rank__rank--top': i < 3 }">
              {{ i + 1 }}
            </text>
            <image class="page-rank__avatar" :src="f.avatar || defaultAvatar" mode="aspectFill" />
            <view class="page-rank__info">
              <text class="page-rank__name">{{ f.nickname || '匿名用户' }}</text>
              <text class="page-rank__tier-tag">{{ f.currentTier || '?' }}</text>
            </view>
            <text class="page-rank__score">{{ f.highestScore || 0 }}分</text>
          </view>
        </view>
        <view v-else class="page-rank__empty">
          <text class="page-rank__empty-icon">👋</text>
          <text class="page-rank__empty-text">暂无好友数据</text>
          <text class="page-rank__empty-hint">分享给好友，看看他们的段位吧</text>
          <button class="page-rank__empty-btn" open-type="share">📤 邀请好友来测</button>
        </view>
      </template>
    </scroll-view>

    <!-- Tab 1.5: 知识星榜 -->
    <scroll-view v-if="activeTab === 'star'" scroll-y class="page-rank__list">
      <view v-if="starLoading" class="page-rank__loading">加载中…</view>
      <template v-else>
        <view v-if="myCollectRank" class="page-rank__star-my">
          <text class="page-rank__star-my-icon">🌟</text>
          <text class="page-rank__star-my-text">你收集了 {{ myCollectCount }} 颗星，排名第 {{ myCollectRank }} 位</text>
        </view>
        <view v-if="starList.length > 0" class="page-rank__items">
          <view v-for="(s, i) in starList" :key="s._openid || i" class="page-rank__item"
            :class="{ 'page-rank__item--me': s._openid === myOpenid }">
            <text class="page-rank__rank" :class="{ 'page-rank__rank--top': i < 3 }">{{ i + 1 }}</text>
            <image class="page-rank__avatar" :src="s.avatar || defaultAvatar" mode="aspectFill" />
            <view class="page-rank__info">
              <text class="page-rank__name">{{ s.nickname || '匿名用户' }}</text>
            </view>
            <text class="page-rank__score">🌟 {{ s.collectCount || 0 }}颗</text>
          </view>
        </view>
        <view v-else class="page-rank__empty">
          <text class="page-rank__empty-icon">🌌</text>
          <text class="page-rank__empty-text">暂无好友收集数据</text>
          <text class="page-rank__empty-hint">分享给好友，比比谁的知识星更多</text>
        </view>
      </template>
    </scroll-view>

    <!-- Tab 2: 全国段位分布 -->
    <scroll-view v-if="activeTab === 'national'" scroll-y class="page-rank__list">
      <view v-if="distLoading" class="page-rank__loading">加载中…</view>
      <template v-else>
        <view class="page-rank__dist-header">
          <text class="page-rank__dist-total">全国共 {{ totalUsers.toLocaleString() }} 人参与测试</text>
          <text v-if="userTier" class="page-rank__dist-mytier">
            我的段位：<text class="page-rank__dist-mytier-name">{{ userTier }}</text>（前 {{ userPercentile }}%）
          </text>
        </view>
        <view class="page-rank__bars">
          <view
            v-for="d in distribution"
            :key="d.tier"
            class="page-rank__bar-row"
            :class="{ 'page-rank__bar-row--me': d.tier === userTier }"
          >
            <view class="page-rank__bar-label">
              <text class="page-rank__bar-emoji">{{ getTierEmoji(d.tier) }}</text>
              <text class="page-rank__bar-name">{{ d.tier }}</text>
            </view>
            <view class="page-rank__bar-track">
              <view
                class="page-rank__bar-fill"
                :style="{ width: Math.max(d.percentage, 2) + '%', background: getTierBarColor(d.tier) }"
              />
            </view>
            <text class="page-rank__bar-pct">{{ d.percentage }}%</text>
          </view>
        </view>
      </template>
    </scroll-view>

    <!-- Tab 3: 本周晋升最快 -->
    <scroll-view v-if="activeTab === 'weekly'" scroll-y class="page-rank__list">
      <view v-if="weeklyLoading" class="page-rank__loading">加载中…</view>
      <template v-else>
        <view v-if="weeklyRising.length > 0" class="page-rank__items">
          <view v-for="(r, i) in weeklyRising" :key="i" class="page-rank__item">
            <text class="page-rank__rank" :class="{ 'page-rank__rank--top': i < 3 }">{{ i + 1 }}</text>
            <view class="page-rank__info">
              <text class="page-rank__name">{{ r.nickname }}</text>
              <view class="page-rank__rise">
                <text class="page-rank__rise-from">{{ r.prevTier }}</text>
                <text class="page-rank__rise-arrow">→</text>
                <text class="page-rank__rise-to">{{ r.currentTier }}</text>
                <text class="page-rank__rise-badge">⬆️ 晋升</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="page-rank__empty">
          <text class="page-rank__empty-icon">📭</text>
          <text class="page-rank__empty-text">本周尚无晋升记录</text>
          <text class="page-rank__empty-hint">加油测试，争取本周上榜！</text>
        </view>
      </template>
    </scroll-view>

    <!-- Tab 4: 群段位挑战榜 -->
    <scroll-view v-if="activeTab === 'group'" scroll-y class="page-rank__list">
      <view v-if="groupLoading" class="page-rank__loading">加载中…</view>
      <template v-else>
        <view v-if="groupList.length > 0" class="page-rank__items">
          <view v-for="(g, i) in groupList" :key="g._openid || i" class="page-rank__item">
            <text class="page-rank__rank" :class="{ 'page-rank__rank--top': i < 3 }">{{ i + 1 }}</text>
            <image class="page-rank__avatar" :src="g.avatar || defaultAvatar" mode="aspectFill" />
            <view class="page-rank__info">
              <text class="page-rank__name">{{ g.nickname || '匿名用户' }}</text>
              <text class="page-rank__tier-tag">{{ g.currentTier || '?' }}</text>
            </view>
            <text class="page-rank__score">{{ g.highestScore || 0 }}分</text>
          </view>
        </view>
        <view v-else class="page-rank__empty">
          <text class="page-rank__empty-icon">👥</text>
          <text class="page-rank__empty-text">群段位挑战榜</text>
          <text class="page-rank__empty-hint">将小程序分享到微信群，即可查看群内好友段位排名</text>
          <button class="page-rank__empty-btn" open-type="share">📤 分享到群聊</button>
        </view>
      </template>
    </scroll-view>
    <PrivacyModal :forceShow="showPrivacyModal" @close="showPrivacyModal = false" />
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { fetchFriendRank, fetchTierDistribution, fetchWeeklyStats, updatePrivacy, markBountyViewed, getUserOpenidSync } from '@/utils/api.js';
import { TIERS } from '@/utils/tier.js';
import { trackPageView, trackRankingView } from '@/utils/analytics.js';
import PrivacyModal from '@/components/PrivacyModal/PrivacyModal.vue';

const tabs = ref([
  { key: 'friend', label: '好友段位榜' },
  { key: 'star', label: '知识星榜' },
  { key: 'national', label: '全国分布' },
  { key: 'weekly', label: '本周晋升最快' },
  { key: 'group', label: '群挑战榜' },
]);

const activeTab = ref('friend');
const privacyHidden = ref(false);
const showPrivacyModal = ref(false);
const myOpenid = ref('');

// Tab 1
const friendLoading = ref(true);
const friendList = ref([]);

// Tab 2
const distLoading = ref(true);
const distribution = ref([]);
const totalUsers = ref(0);
const userTier = ref('');
const userPercentile = ref(0);

// Tab 3
const weeklyLoading = ref(true);
const weeklyRising = ref([]);

// Tab 4
const groupLoading = ref(true);
const groupList = ref([]);

// Tab 1.5: 知识星榜
const starLoading = ref(true);
const starList = ref([]);
const myCollectRank = ref(null);
const myCollectCount = ref(0);

// 好友榜降级标记
const isGlobalFallback = ref(false);

// 段位悬赏结果
const bountyResults = ref([]);

const defaultAvatar = '/static/icons/default-avatar.png';

const loadedTabs = ref({});
const countdownText = ref('');
const showScreenshotHint = ref(true);
let countdownTimer = null;

onMounted(() => {
  privacyHidden.value = !!uni.getStorageSync('privacy_hidden');
  loadFriendRank();
  trackRankingView('friend');
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
  // F12: 截图引导 3 秒后自动消失
  setTimeout(() => { showScreenshotHint.value = false; }, 3000);
});

onBeforeUnmount(() => {
  clearInterval(countdownTimer);
});

function updateCountdown() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  countdownText.value = `${hours}小时${minutes}分钟${seconds}秒`;
}

function switchTab(key) {
  activeTab.value = key;
  trackRankingView(key);
  if (!loadedTabs.value[key]) {
    loadedTabs.value[key] = true;
    if (key === 'star') loadStarRank();
    if (key === 'national') loadDistribution();
    if (key === 'weekly') loadWeeklyRising();
    if (key === 'group') loadGroupRank();
  }
}

// ── Tab 1: 好友段位榜 ──
async function loadFriendRank() {
  friendLoading.value = true;
  try {
    const res = await fetchFriendRank();
    if (res.code === 0 && res.data) {
      friendList.value = res.data.friendRankings || [];
      myOpenid.value = res.data.userOpenid || '';
      isGlobalFallback.value = res.data.isGlobalFallback || false;
      bountyResults.value = res.data.bountyResults || [];
      tabs.value[0].label = isGlobalFallback.value ? '全服高手榜' : '好友段位榜';
    }
  } catch (e) {
    console.error('[rank] loadFriendRank failed:', e);
  } finally {
    friendLoading.value = false;
  }
}

// ── Tab 2: 全国分布 ──
async function loadDistribution() {
  distLoading.value = true;
  try {
    const res = await fetchTierDistribution();
    if (res.code === 0 && res.data) {
      distribution.value = res.data.distribution || [];
      totalUsers.value = res.data.totalUsers || 0;
      userTier.value = res.data.userTier || '';
      userPercentile.value = res.data.userPercentile || 0;
    }
  } catch (e) {
    console.error('[rank] loadDistribution failed:', e);
  } finally {
    distLoading.value = false;
  }
}

// ── Tab 3: 本周晋升最快 ──
async function loadWeeklyRising() {
  weeklyLoading.value = true;
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      weeklyRising.value = res.data.weeklyRising || [];
    }
  } catch (e) {
    console.error('[rank] loadWeeklyRising failed:', e);
  } finally {
    weeklyLoading.value = false;
  }
}

// ── Tab 4: 群挑战榜 ──
async function loadGroupRank() {
  groupLoading.value = true;
  try {
    const app = getApp();
    const groupId = app.globalData.groupId || '';
    const res = await fetchFriendRank('groupRank', { openGId: groupId });
    if (res.code === 0 && res.data) {
      groupList.value = res.data.groupRankings || [];
    }
  } catch (e) {
    // 静默失败
  } finally {
    groupLoading.value = false;
  }
}

// ── 知识星榜 ──
async function loadStarRank() {
  starLoading.value = true;
  try {
    const res = await fetchFriendRank('collectRank');
    if (res.code === 0 && res.data) {
      starList.value = res.data.collectRankings || [];
      myCollectRank.value = res.data.myCollectRank;
      myCollectCount.value = res.data.myCollectCount;
    }
  } catch (e) {
    console.error('[rank] loadStarRank failed:', e);
  } finally {
    starLoading.value = false;
  }
}

// ── 隐私开关 ──
async function onPrivacyToggle(e) {
  privacyHidden.value = e.detail.value;
  uni.setStorageSync('privacy_hidden', privacyHidden.value);
  // 同步到云端
  await updatePrivacy(privacyHidden.value);
  uni.showToast({
    title: privacyHidden.value ? '已隐藏排名' : '已公开排名',
    icon: 'none',
  });
  await loadFriendRank();
}

// ── 段位悬赏：关闭通知 ──
async function dismissBounty(bountyId) {
  await markBountyViewed(bountyId);
  bountyResults.value = bountyResults.value.filter(b => b._id !== bountyId);
}

// ── 辅助函数 ──
function getTierEmoji(tierName) {
  const t = TIERS.find(t => t.name === tierName);
  return t ? t.emoji : '';
}

function getTierBarColor(tierName) {
  const t = TIERS.find(t => t.name === tierName);
  return t ? t.color : '#7c3aed';
}

onShareAppMessage(() => {
  const uid = getUserOpenidSync();
  return {
    title: '测测你的AI段位！看看你在好友中排第几 🏆',
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: '/static/images/default-share.png',
  };
});

onShareTimeline(() => {
  const uid = getUserOpenidSync();
  return {
    title: '你的AI段位排第几？看看全国段位分布 →',
    query: uid ? `from_uid=${uid}` : '',
  };
});
</script>

<style scoped lang="scss">
.page-rank {
  min-height: 100vh;
  background: $color-bg-primary;
  display: flex;
  flex-direction: column;

  // ====== 今日结算倒计时 ======
  &__countdown-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    padding: 14rpx 24rpx;
    margin: 8rpx 28rpx 0;
    background: rgba(245, 158, 11, 0.06);
    border: 1rpx solid rgba(245, 158, 11, 0.12);
    border-radius: 12rpx;
  }

  &__countdown-icon {
    font-size: 24rpx;
  }

  &__countdown-text {
    font-size: 22rpx;
    color: $color-gold;
  }

  // F12: 截图引导
  &__screenshot-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12rpx 24rpx;
    margin: 4rpx 28rpx 0;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10rpx;
    font-size: 22rpx;
    color: $color-gold;
    animation: fade-in 0.3s ease-out;
  }

  // ====== 隐私开关 ======
  &__privacy-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 16rpx 28rpx;
    gap: 10rpx;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
  }

  &__privacy-label {
    font-size: 22rpx;
    color: $color-text-muted;
  }

  &__privacy-link {
    display: flex;
    justify-content: flex-end;
    padding: 8rpx 28rpx 16rpx;
    font-size: 22rpx;
    color: $color-gold;
    opacity: 0.8;
    text-decoration: underline;
  }

  // ====== Tab 栏 ======
  &__tabs {
    display: flex;
    padding: 20rpx 16rpx 0;
    gap: 4rpx;
  }

  &__tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14rpx 0;
    font-size: 24rpx;
    color: $color-text-muted;
    position: relative;
    transition: color 0.2s;

    &--active {
      color: $color-accent;
      font-weight: 600;
    }
  }

  &__tab-line {
    position: absolute;
    bottom: 0;
    width: 40rpx;
    height: 4rpx;
    border-radius: 2rpx;
    background: $color-accent;
    animation: slide-in 0.2s ease-out;
  }

  // ====== 列表 ======
  &__list {
    flex: 1;
    padding: 16rpx 28rpx;
  }

  &__loading {
    text-align: center;
    padding-top: 120rpx;
    color: $color-text-secondary;
    font-size: 26rpx;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    padding-bottom: 40rpx;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding: 16rpx 20rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;
    border: 2rpx solid transparent;
    transition: background 0.15s;

    &--me {
      background: rgba(124, 58, 237, 0.08);
      border-color: rgba(245, 158, 11, 0.4);
      box-shadow: 0 0 16rpx rgba(245, 158, 11, 0.08);
    }
  }

  &__rank {
    width: 50rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: $color-text-muted;
    text-align: center;

    &--top {
      color: $color-gold;
    }
  }

  &__avatar {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-size: 26rpx;
    color: $color-text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tier-tag {
    font-size: 22rpx;
    color: $color-accent;
    margin-top: 2rpx;
  }

  &__score {
    font-size: 28rpx;
    font-weight: bold;
    color: $color-gold;
    flex-shrink: 0;
  }

  // ====== 晋升信息 ======
  &__rise {
    display: flex;
    align-items: center;
    gap: 6rpx;
    margin-top: 4rpx;
    font-size: 22rpx;
  }

  &__rise-from {
    color: $color-text-muted;
    text-decoration: line-through;
  }

  &__rise-arrow {
    color: $color-accent;
  }

  &__rise-to {
    color: $color-gold;
    font-weight: 500;
  }

  &__rise-badge {
    color: #4caf50;
    font-size: 20rpx;
    margin-left: 4rpx;
  }

  // ====== 分布图 ======
  &__dist-header {
    padding: 16rpx 0 24rpx;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__dist-total {
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__dist-mytier {
    font-size: 24rpx;
    color: $color-text-secondary;

    &-name {
      color: $color-gold;
      font-weight: bold;
    }
  }

  &__bars {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-bottom: 40rpx;
  }

  &__bar-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 8rpx 12rpx;
    border-radius: 10rpx;
    border: 2rpx solid transparent;
    transition: all 0.2s;

    &--me {
      background: rgba(124, 58, 237, 0.06);
      border-color: rgba(245, 158, 11, 0.3);
      box-shadow: 0 0 20rpx rgba(245, 158, 11, 0.06);
    }
  }

  &__bar-label {
    width: 120rpx;
    display: flex;
    align-items: center;
    gap: 6rpx;
    flex-shrink: 0;
  }

  &__bar-emoji {
    font-size: 26rpx;
  }

  &__bar-name {
    font-size: 22rpx;
    color: $color-text-primary;
  }

  &__bar-track {
    flex: 1;
    height: 22rpx;
    border-radius: 11rpx;
    background: rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    border-radius: 11rpx;
    opacity: 0.8;
    transition: width 0.6s ease-out;
  }

  &__bar-pct {
    width: 72rpx;
    font-size: 22rpx;
    color: $color-text-secondary;
    text-align: right;
    flex-shrink: 0;
  }

  // ====== 空状态 ======
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 120rpx;
    gap: 12rpx;

    &-icon {
      font-size: 64rpx;
    }

    &-text {
      font-size: 28rpx;
      color: $color-text-secondary;
    }

    &-hint {
      font-size: 24rpx;
      color: $color-text-muted;
      text-align: center;
      line-height: 1.5;
    }

    &-btn {
      margin-top: 20rpx;
      height: 72rpx;
      line-height: 72rpx;
      padding: 0 40rpx;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      border-radius: 36rpx;
      font-size: 26rpx;
      color: #fff;
      border: none;
    }
  }
}

@keyframes slide-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
</style>
