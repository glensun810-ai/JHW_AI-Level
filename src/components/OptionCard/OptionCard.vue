<template>
  <view
    class="option-card"
    :class="{
      'option-card--selected': selected,
      'option-card--disabled': disabled,
      'option-card--high-score': selected && score >= 7,
      'option-card--low-score': selected && score <= 3,
      'option-card--mid-score': selected && score >= 4 && score <= 6,
    }"
    @click="handleClick"
  >
    <view class="option-card__label">{{ label }}</view>
    <view class="option-card__body">
      <text class="option-card__text">{{ text }}</text>
      <text v-if="tag" class="option-card__tag">{{ tag }}</text>
    </view>
    <view v-if="selected" class="option-card__check">✓</view>
  </view>
</template>

<script setup>
const props = defineProps({
  label: { type: String, default: 'A' },
  text: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  tag: { type: String, default: '' },
  score: { type: Number, default: 0 },
});

const emit = defineEmits(['select']);

function handleClick() {
  if (props.disabled) return;
  emit('select');
}
</script>

<style scoped lang="scss">
.option-card {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  margin-bottom: 16rpx;
  background: $color-bg-card;
  border: 2rpx solid rgba(255,255,255,0.08);
  border-radius: $radius-md;
  transition: all 0.2s ease;
  position: relative;

  &:active {
    transform: scale(0.98);
  }

  &--selected {
    background: rgba(0, 200, 255, 0.1);
    border-color: $color-accent;
    box-shadow: 0 0 20rpx rgba(0, 200, 255, 0.15);
  }

  // F11: 高分选项金色光效
  &--high-score.option-card--selected {
    background: rgba(245, 158, 11, 0.08);
    border-color: $color-gold;
    box-shadow: 0 0 28rpx rgba(245, 158, 11, 0.25);
    transform: scale(1.02);

    .option-card__label {
      background: $color-gold;
      color: #000;
    }
    .option-card__check {
      background: $color-gold;
      color: #000;
    }
  }

  // F11: 中分选项默认高亮
  &--mid-score.option-card--selected {
    border-color: rgba(0, 200, 255, 0.5);
    box-shadow: 0 0 16rpx rgba(0, 200, 255, 0.12);
  }

  // F11: 低分选项灰化
  &--low-score.option-card--selected {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.06);
    box-shadow: none;
    transform: scale(0.98);

    .option-card__label {
      background: rgba(255, 255, 255, 0.08);
      color: $color-text-muted;
    }
    .option-card__check {
      background: rgba(255, 255, 255, 0.1);
      color: $color-text-muted;
    }
  }

  &--disabled {
    pointer-events: none;
  }

  &__label {
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    color: $color-text-secondary;
    font-size: $font-size-sm;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20rpx;
    flex-shrink: 0;

    .option-card--selected & {
      background: $color-accent;
      color: #fff;
    }
  }

  &__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__text {
    font-size: $font-size-md;
    color: $color-text-primary;
    line-height: 1.5;
  }

  &__tag {
    font-size: 20rpx;
    color: $color-gold;
    margin-top: 4rpx;
    opacity: 0.8;
  }

  &__check {
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: $color-accent;
    color: #fff;
    font-size: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 12rpx;
    flex-shrink: 0;
  }
}
</style>
