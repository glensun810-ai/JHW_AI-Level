<template>
  <view class="page-challenge">
    <!-- 加载中 -->
    <view v-if="loading" class="page-challenge__loading">
      <text>加载中…</text>
    </view>

    <template v-else>
    <!-- 挑战说明 -->
    <view class="page-challenge__header">
      <text class="page-challenge__title">挑战好友</text>
      <text class="page-challenge__desc">选择一位微信好友，发起AI段位挑战。不论输赢，都是话题。</text>
    </view>

    <!-- 我的战绩 -->
    <view class="page-challenge__my-stats">
      <text class="page-challenge__section-label">我的战绩</text>
      <view class="page-challenge__stats-row">
        <view class="page-challenge__stat">
          <text class="page-challenge__stat-num">{{ winCount }}</text>
          <text class="page-challenge__stat-label">胜</text>
        </view>
        <view class="page-challenge__stat">
          <text class="page-challenge__stat-num">{{ loseCount }}</text>
          <text class="page-challenge__stat-label">负</text>
        </view>
        <view class="page-challenge__stat">
          <text class="page-challenge__stat-num">{{ drawCount }}</text>
          <text class="page-challenge__stat-label">平</text>
        </view>
      </view>
    </view>

    <!-- 邀请方式 -->
    <view class="page-challenge__actions">
      <button class="page-challenge__btn" open-type="share">
        分享到群聊 / 好友
      </button>
      <text class="page-challenge__hint">好友点击你的分享卡片进入测试，完成后自动比较段位</text>

      <!-- 订阅通知 -->
      <view v-if="!showSubscribePrompt" class="page-challenge__subscribe-trigger" @click="showSubscribePrompt = true">
        <text class="page-challenge__subscribe-trigger-text">好友应战后通知我</text>
      </view>
      <view v-else class="page-challenge__subscribe-prompt" @click="requestSubscribe">
        <text class="page-challenge__subscribe-text">点击开启挑战通知，好友应战后第一时间收到提醒</text>
      </view>
    </view>

    <!-- 待处理挑战 -->
    <view v-if="pendingChallenges.length > 0" class="page-challenge__pending">
      <text class="page-challenge__section-label">待处理挑战</text>
      <view v-for="c in pendingChallenges" :key="c._id" class="page-challenge__pending-item">
        <text class="page-challenge__pending-from">{{ c.challengerName }}</text>
        <text class="page-challenge__pending-tier">{{ c.challengerTier }}</text>
        <text class="page-challenge__pending-score">{{ toAIQ(c.challengerScore) }}</text>
        <button class="page-challenge__accept-btn" @click="acceptChallenge(c)">应战</button>
      </view>
    </view>

    <view v-else class="page-challenge__no-pending">
      <text class="page-challenge__no-pending-icon">⚔️</text>
      <text class="page-challenge__no-pending-text">暂无可应战的挑战</text>
      <text class="page-challenge__no-pending-hint">分享给好友，邀他们来挑战你</text>
      <button class="page-challenge__share-btn" open-type="share">📤 发起挑战</button>
    </view>
    </template>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { fetchFriendRank, getUserOpenidSync, requestSubscribeMessage } from '@/utils/api.js';
import { trackPageView } from '@/utils/analytics.js';
import { toAIQuotient } from '@/utils/tier.js';

function toAIQ(rawScore) {
  if (!rawScore || rawScore === 0) return '—';
  return 'AI商数' + toAIQuotient(rawScore);
}

const winCount = ref(0);
const loseCount = ref(0);
const drawCount = ref(0);
const pendingChallenges = ref([]);
const loading = ref(true);
const showSubscribePrompt = ref(false);

onMounted(async () => {
  trackPageView('challenge');
  try {
    const res = await fetchFriendRank();
    if (res.code === 0 && res.data) {
      winCount.value = res.data.winCount || 0;
      loseCount.value = res.data.loseCount || 0;
      drawCount.value = res.data.drawCount || 0;
      pendingChallenges.value = res.data.pendingChallenges || [];
    }
  } catch (e) {
    // 静默失败
  } finally {
    loading.value = false;
  }
});

function acceptChallenge(challenge) {
  uni.navigateTo({ url: '/pages/quiz/quiz?challengeId=' + challenge._id });
}

async function requestSubscribe() {
  await requestSubscribeMessage(['challengeNotify']);
  uni.showToast({ title: '设置成功！', icon: 'success' });
  showSubscribePrompt.value = false;
}

onShareAppMessage(() => {
  const uid = getUserOpenidSync();
  return {
    title: '测测你的AI段位！我在进化湾等你来战',
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: getApp().globalData.defaultShareImage || '/static/images/default-share.png',
  };
});

onShareTimeline(() => {
  const uid = getUserOpenidSync();
  return {
    title: '挑战好友AI段位！来进化湾一决高下',
    query: uid ? `from_uid=${uid}` : '',
  };
});
</script>

<style scoped lang="scss">
.page-challenge {
  min-height: 100vh;
  background: $color-bg-primary;
  padding: 32rpx;

  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 60vh;
    font-size: 28rpx;
    color: $color-text-muted;
  }

  &__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40rpx 0 32rpx;
  }

  &__title {
    font-size: 44rpx;
    font-weight: bold;
    color: $color-text-primary;
  }

  &__desc {
    font-size: 26rpx;
    color: $color-text-secondary;
    margin-top: 16rpx;
    text-align: center;
    line-height: 1.5;
  }

  &__my-stats {
    background: rgba(124, 58, 237, 0.06);
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 32rpx;
  }

  &__section-label {
    font-size: 24rpx;
    color: $color-text-secondary;
    display: block;
    margin-bottom: 12rpx;
  }

  &__stats-row {
    display: flex;
    justify-content: space-around;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__stat-num {
    font-size: 48rpx;
    font-weight: bold;
    color: $color-gold;
  }

  &__stat-label {
    font-size: 22rpx;
    color: $color-text-secondary;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32rpx;
  }

  &__btn {
    width: 100%;
    height: 96rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 48rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6rpx 24rpx rgba(124, 58, 237, 0.35);
  }

  &__hint {
    font-size: 22rpx;
    color: $color-text-muted;
    margin-top: 12rpx;
    text-align: center;
  }

  &__subscribe-trigger {
    margin-top: 20rpx;
    padding: 16rpx 28rpx;
    background: rgba(0, 200, 255, 0.06);
    border: 1rpx solid rgba(0, 200, 255, 0.12);
    border-radius: 12rpx;
    text-align: center;

    &-text {
      font-size: 24rpx;
      color: $color-accent;
    }
  }

  &__subscribe-prompt {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-top: 20rpx;
    padding: 18rpx 24rpx;
    background: rgba(0, 200, 255, 0.1);
    border: 1rpx solid rgba(0, 200, 255, 0.25);
    border-radius: 14rpx;

    &:active { background: rgba(0, 200, 255, 0.15); }
  }

  &__subscribe-icon {
    font-size: 32rpx;
    flex-shrink: 0;
  }

  &__subscribe-text {
    font-size: 24rpx;
    color: $color-accent;
    line-height: 1.4;
    flex: 1;
  }

  &__pending {
    margin-top: 16rpx;
  }

  &__pending-item {
    display: flex;
    align-items: center;
    padding: 16rpx 20rpx;
    background: rgba(255,255,255,0.03);
    border-radius: 12rpx;
    margin-bottom: 8rpx;
    gap: 12rpx;
  }

  &__pending-from {
    font-size: 26rpx;
    color: $color-text-primary;
    flex: 1;
  }

  &__pending-tier {
    font-size: 22rpx;
    color: $color-accent;
  }

  &__pending-score {
    font-size: 22rpx;
    color: $color-gold;
  }

  &__accept-btn {
    padding: 8rpx 20rpx;
    border-radius: 16rpx;
    font-size: 22rpx;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: none;
  }

  &__no-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    padding: 60rpx 28rpx;
    text-align: center;

    &-icon { font-size: 56rpx; }
    &-text { font-size: 28rpx; color: #fff; font-weight: 600; }
    &-hint { font-size: 24rpx; color: $color-text-muted; }
  }

  &__share-btn {
    margin-top: 12rpx;
    padding: 18rpx 40rpx;
    background: linear-gradient(135deg, #7c3aed, #a78bfa);
    border-radius: 32rpx;
    font-size: 26rpx; color: #fff; font-weight: 600; border: none;
  }
}
</style>
