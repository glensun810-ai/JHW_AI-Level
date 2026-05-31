<template>
  <view v-if="visible" class="privacy-modal">
    <view class="privacy-modal__mask" @click="handleDecline" />
    <view class="privacy-modal__panel">
      <view class="privacy-modal__header">
        <text class="privacy-modal__title">隐私政策与用户协议</text>
      </view>

      <scroll-view class="privacy-modal__body" scroll-y>
        <text class="privacy-modal__section-title">一、信息收集说明</text>
        <text class="privacy-modal__text">
          进化湾是一款 AI 时代段位测评小程序。为提供测评服务，我们需要收集以下信息：
        </text>
        <text class="privacy-modal__bullet">• 微信 OpenID：用于标识用户身份，保存您的测试记录和段位信息</text>
        <text class="privacy-modal__bullet">• 昵称与头像：仅用于排行榜展示和好友挑战功能</text>
        <text class="privacy-modal__bullet">• 测评作答数据：用于计算您的 AI 段位和生成个性化结果</text>

        <text class="privacy-modal__section-title">二、信息使用规则</text>
        <text class="privacy-modal__bullet">• 您的测试记录仅用于计算段位和生成排行榜</text>
        <text class="privacy-modal__bullet">• 昵称和段位将在排行榜中公开展示（可在设置中关闭）</text>
        <text class="privacy-modal__bullet">• 我们不会将您的数据出售或共享给任何第三方</text>
        <text class="privacy-modal__bullet">• 所有数据存储于微信云开发环境，遵循微信数据安全规范</text>

        <text class="privacy-modal__section-title">三、用户权益</text>
        <text class="privacy-modal__bullet">• 您可以在设置页面随时删除所有历史测试数据</text>
        <text class="privacy-modal__bullet">• 您可以开启隐私模式隐藏排名信息</text>
        <text class="privacy-modal__bullet">• 如对数据使用有任何疑问，可通过客服联系我们</text>

        <text class="privacy-modal__section-title">四、免责声明</text>
        <text class="privacy-modal__text">
          本小程序的测评结果仅为趣味性参考，不构成任何形式的心理评估、职业建议或能力认证。我们努力保证测评逻辑的合理性，但不对测评结果的准确性做任何明示或暗示的保证。
        </text>
      </scroll-view>

      <view class="privacy-modal__footer">
        <button class="privacy-modal__btn privacy-modal__btn--decline" @click="handleDecline">
          不同意并退出
        </button>
        <button class="privacy-modal__btn privacy-modal__btn--agree" @click="handleAgree">
          同意并继续
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  forceShow: { type: Boolean, default: false },
});

const visible = ref(false);

const STORAGE_KEY = 'privacy_agreed';

watch(() => props.forceShow, (val) => {
  if (val) visible.value = true;
});

function check() {
  const agreed = uni.getStorageSync(STORAGE_KEY);
  if (!agreed) {
    visible.value = true;
    return false;
  }
  return true;
}

function handleAgree() {
  uni.setStorageSync(STORAGE_KEY, Date.now());
  visible.value = false;
  emit('close');
}

function handleDecline() {
  visible.value = false;
  if (props.forceShow) {
    emit('close');
    return;
  }
  // 退出小程序
  if (typeof wx !== 'undefined' && wx.exitMiniProgram) {
    wx.exitMiniProgram();
  }
}

const emit = defineEmits(['close']);
defineExpose({ check });
</script>

<style scoped lang="scss">
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;

  &__mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
  }

  &__panel {
    position: relative;
    width: 640rpx;
    max-height: 80vh;
    background: linear-gradient(180deg, #1a2744 0%, #0d1b2a 100%);
    border-radius: 24rpx;
    border: 1rpx solid rgba(124, 58, 237, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__header {
    padding: 32rpx 32rpx 16rpx;
    text-align: center;
  }

  &__title {
    font-size: 34rpx;
    font-weight: bold;
    color: #fff;
  }

  &__body {
    flex: 1;
    padding: 0 32rpx 16rpx;
    max-height: 60vh;
  }

  &__section-title {
    display: block;
    font-size: 28rpx;
    font-weight: bold;
    color: $color-gold;
    margin-top: 20rpx;
    margin-bottom: 10rpx;
  }

  &__text {
    display: block;
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.7;
    margin-bottom: 8rpx;
    word-break: break-all;
    overflow-wrap: break-word;
  }

  &__bullet {
    display: block;
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.7;
    padding-left: 8rpx;
    word-break: break-all;
    overflow-wrap: break-word;
  }

  &__footer {
    display: flex;
    gap: 16rpx;
    padding: 20rpx 32rpx 32rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  &__btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    font-weight: 500;
    text-align: center;
    border: none;

    &--decline {
      background: rgba(255, 255, 255, 0.06);
      color: $color-text-secondary;
    }

    &--agree {
      background: linear-gradient(135deg, #7c3aed, #f59e0b);
      color: #fff;
    }
  }
}
</style>
