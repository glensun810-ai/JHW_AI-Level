<template>
  <view v-if="visible" class="challenge-modal" @click="close">
    <view class="challenge-modal__panel" @click.stop>
      <!-- 头部 -->
      <view class="challenge-modal__header">
        <text class="challenge-modal__title">⚔️挑战好友</text>
        <text class="challenge-modal__close" @click="close">×</text>
      </view>

      <!-- 挑战说明 -->
      <view class="challenge-modal__intro">
        选择一位好友发起AI段位挑战。不论输赢，都是话题。
      </view>

      <!-- 我的段位 -->
      <view class="challenge-modal__my-tier" v-if="myScore > 0">
        <text class="challenge-modal__my-label">我的段位</text>
        <text class="challenge-modal__my-value">{{ myTier }} · {{ toAIQ(myScore) }}</text>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="challenge-modal__loading">加载好友列表中…</view>

      <!-- 已测过的好友 -->
      <template v-else>
        <view v-if="testedFriends.length > 0" class="challenge-modal__section">
          <text class="challenge-modal__section-title">已测过的好友（可直接挑战）</text>
          <scroll-view scroll-y class="challenge-modal__friend-scroll">
            <view
              v-for="f in testedFriends"
              :key="f._openid"
              class="challenge-modal__friend"
              :class="{ 'challenge-modal__friend--challenged': challengedIds.has(f._openid) }"
              @click="challengeFriend(f)"
            >
              <image class="challenge-modal__avatar" :src="f.avatar || defaultAvatar" mode="aspectFill" />
              <view class="challenge-modal__friend-info">
                <text class="challenge-modal__friend-name">{{ f.nickname || '匿名用户' }}</text>
                <text class="challenge-modal__friend-tier">{{ f.currentTier || '?' }}</text>
              </view>
              <text class="challenge-modal__friend-score">{{ toAIQ(f.highestScore) }}</text>
              <text v-if="challengedIds.has(f._openid)" class="challenge-modal__challenged-tag">已挑战</text>
              <text v-else class="challenge-modal__challenge-btn">挑战 ›</text>
            </view>
          </scroll-view>
        </view>

        <!-- 未测过的好友：引导分享 -->
        <view class="challenge-modal__section">
          <text class="challenge-modal__section-title">好友还没测过？</text>
          <text class="challenge-modal__untested-hint">
            分享小程序给好友，TA测完后自动比较段位
          </text>
          <button class="challenge-modal__share-btn" open-type="share" @click="onShareClick">
            📤 邀请好友来测
          </button>
        </view>
      </template>

      <!-- 挑战成功提示 -->
      <view v-if="challengeSent" class="challenge-modal__success">
        <text class="challenge-modal__success-icon">✅</text>
        <text class="challenge-modal__success-text">挑战已发送！</text>
        <text class="challenge-modal__success-hint">等待对方接受挑战并完成测试</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { fetchFriendRank, sendChallengeRequest } from '@/utils/api.js';
import { toAIQuotient } from '@/utils/tier.js';

function toAIQ(rawScore) {
  if (!rawScore || rawScore === 0) return '—';
  return 'AI商数' + toAIQuotient(rawScore);
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  myScore: { type: Number, default: 0 },
  myTier: { type: String, default: '' },
});

const emit = defineEmits(['close', 'challenged']);

const loading = ref(false);
const testedFriends = ref([]);
const challengedIds = ref(new Set());
const challengeSent = ref(false);
const defaultAvatar = '/static/icons/default-avatar.png';

watch(() => props.visible, (val) => {
  if (val) {
    challengeSent.value = false;
    loadFriends();
  }
});

async function loadFriends() {
  loading.value = true;
  const res = await fetchFriendRank();
  if (res.code === 0 && res.data) {
    testedFriends.value = (res.data.friendRankings || []).slice(0, 20);
    // 标记已发过挑战的（从 sentChallengeTargets 取正确数据）
    const sentTargets = res.data.sentChallengeTargets || [];
    sentTargets.forEach(id => challengedIds.value.add(id));
  }
  loading.value = false;
}

async function challengeFriend(friend) {
  if (challengedIds.value.has(friend._openid)) return;

  const res = await sendChallengeRequest(friend._openid, props.myScore, props.myTier);
  if (res.code === 0) {
    challengedIds.value.add(friend._openid);
    challengeSent.value = true;
    emit('challenged', { targetOpenid: friend._openid, challengeId: res.data?.challengeId });
    setTimeout(() => { challengeSent.value = false; }, 3000);
  }
}

function onShareClick() {
  // 分享由页面级 onShareAppMessage 处理
}

function close() {
  emit('close');
}
</script>

<style scoped lang="scss">
.challenge-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 900;
  display: flex;
  align-items: flex-end;
  animation: overlay-in 0.25s ease-out;

  &__panel {
    width: 100%;
    max-height: 80vh;
    background: #121826;
    border-radius: 32rpx 32rpx 0 0;
    padding: 32rpx 28rpx;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.3s ease-out;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__title {
    font-size: 36rpx;
    font-weight: bold;
    color: $color-text-primary;
  }

  &__close {
    font-size: 44rpx;
    color: $color-text-muted;
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__intro {
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.5;
    margin-bottom: 20rpx;
  }

  &__my-tier {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 14rpx 20rpx;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 10rpx;
    margin-bottom: 24rpx;
  }

  &__my-label {
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__my-value {
    font-size: 26rpx;
    color: $color-gold;
    font-weight: bold;
  }

  &__loading {
    text-align: center;
    padding: 40rpx 0;
    font-size: 24rpx;
    color: $color-text-muted;
  }

  &__section {
    margin-bottom: 24rpx;
  }

  &__section-title {
    font-size: 24rpx;
    color: $color-text-muted;
    margin-bottom: 12rpx;
    display: block;
  }

  &__friend-scroll {
    max-height: 360rpx;
  }

  &__friend {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding: 16rpx 16rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;
    margin-bottom: 8rpx;
    transition: background 0.15s;

    &:active {
      background: rgba(255, 255, 255, 0.06);
    }

    &--challenged {
      opacity: 0.5;
    }
  }

  &__avatar {
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  &__friend-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__friend-name {
    font-size: 26rpx;
    color: $color-text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__friend-tier {
    font-size: 22rpx;
    color: $color-accent;
  }

  &__friend-score {
    font-size: 26rpx;
    font-weight: bold;
    color: $color-gold;
  }

  &__challenge-btn {
    font-size: 24rpx;
    color: $color-accent;
    flex-shrink: 0;
    padding: 4rpx 8rpx;
  }

  &__challenged-tag {
    font-size: 20rpx;
    color: $color-text-muted;
    flex-shrink: 0;
  }

  &__untested-hint {
    font-size: 24rpx;
    color: $color-text-muted;
    display: block;
    margin-bottom: 16rpx;
    text-align: center;
  }

  &__share-btn {
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 40rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    text-align: center;
  }

  &__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24rpx 0;
    gap: 8rpx;

    &-icon {
      font-size: 48rpx;
    }

    &-text {
      font-size: 28rpx;
      color: $color-gold;
      font-weight: bold;
    }

    &-hint {
      font-size: 22rpx;
      color: $color-text-muted;
    }
  }
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
