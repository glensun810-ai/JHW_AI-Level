<template>
  <view v-if="visible" class="help-modal" @click="close">
    <view class="help-modal__panel" @click.stop>
      <view class="help-modal__header">
        <text class="help-modal__title">🔍 帮朋友测</text>
        <text class="help-modal__close" @click="close">×</text>
      </view>

      <!-- 步骤1：输入名字 -->
      <view v-if="!generated" class="help-modal__step">
        <text class="help-modal__label">输入朋友的名字/昵称</text>
        <input
          v-model="friendName"
          class="help-modal__input"
          placeholder="例如：小明"
          maxlength="20"
          @confirm="onConfirm"
        />
        <button
          class="help-modal__btn"
          :disabled="!friendName.trim()"
          @click="onConfirm"
        >
          🔗 生成专属测试链接
        </button>
      </view>

      <!-- 步骤2：展示结果 -->
      <view v-else class="help-modal__step">
        <view class="help-modal__result">
          <text class="help-modal__result-icon">✅</text>
          <text class="help-modal__result-text">
            帮 <text class="help-modal__result-name">@{{ friendName }}</text> 测测TA的AI段位？
          </text>
          <text class="help-modal__result-hint">
            TA点击你的分享后，测试页会显示你的名字。测完后你会收到结果通知。
          </text>
        </view>
        <button class="help-modal__share-btn" open-type="share" @click="onShareClick">
          📤 分享给 {{ friendName }}
        </button>
        <button class="help-modal__redo-btn" @click="reset">
          🔄 换个朋友
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  myOpenid: { type: String, default: '' },
});

const emit = defineEmits(['close', 'generated']);

const friendName = ref('');
const generated = ref(false);

watch(() => props.visible, (val) => {
  if (val) {
    friendName.value = '';
    generated.value = false;
  }
});

function onConfirm() {
  if (!friendName.value.trim()) return;
  generated.value = true;
  emit('generated', { friendName: friendName.value.trim() });
}

function onShareClick() {
  // 分享配置由父组件 onShareAppMessage 返回
}

function reset() {
  generated.value = false;
  friendName.value = '';
}

function close() {
  emit('close');
}
</script>

<style scoped lang="scss">
.help-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  animation: overlay-in 0.2s ease-out;

  &__panel {
    width: 100%;
    max-width: 560rpx;
    background: #121826;
    border-radius: 24rpx;
    padding: 36rpx 32rpx;
    animation: pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28rpx;
  }

  &__title {
    font-size: 34rpx;
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

  &__step {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  &__label {
    font-size: 26rpx;
    color: $color-text-secondary;
  }

  &__input {
    height: 80rpx;
    padding: 0 24rpx;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12rpx;
    font-size: 30rpx;
    color: $color-text-primary;
    border: 1rpx solid rgba(255, 255, 255, 0.1);

    &:focus {
      border-color: $color-accent;
    }
  }

  &__btn {
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border-radius: 44rpx;
    font-size: 30rpx;
    color: #fff;
    border: none;
    text-align: center;

    &:disabled {
      opacity: 0.4;
    }
  }

  &__result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    padding: 24rpx 0;
    text-align: center;
  }

  &__result-icon {
    font-size: 56rpx;
  }

  &__result-text {
    font-size: 30rpx;
    color: $color-text-primary;
    line-height: 1.5;
  }

  &__result-name {
    color: $color-gold;
    font-weight: bold;
  }

  &__result-hint {
    font-size: 24rpx;
    color: $color-text-muted;
    line-height: 1.5;
    margin-top: 4rpx;
  }

  &__share-btn {
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 44rpx;
    font-size: 30rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    text-align: center;
  }

  &__redo-btn {
    width: 100%;
    height: 72rpx;
    line-height: 72rpx;
    background: transparent;
    border: 1rpx solid rgba(255, 255, 255, 0.1);
    border-radius: 36rpx;
    font-size: 26rpx;
    color: $color-text-secondary;
    text-align: center;
  }
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pop-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
