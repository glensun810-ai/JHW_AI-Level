<template>
  <view class="ai-comment" :class="{ 'ai-comment--visible': visible }">
    <view class="ai-comment__header">
      <text class="ai-comment__icon">💬</text>
      <text class="ai-comment__label">AI 锐评</text>
      <view class="ai-comment__badge" :style="{ background: tierColor }">
        <text>{{ tierEmoji }} {{ tierName }}</text>
      </view>
    </view>
    <view class="ai-comment__body" :style="{ borderLeftColor: tierColor }">
      <text class="ai-comment__quote-mark" :style="{ color: tierColor }">"</text>
      <text class="ai-comment__text">{{ commentary }}</text>
      <text class="ai-comment__quote-mark ai-comment__quote-mark--end" :style="{ color: tierColor }">"</text>
    </view>
    <view class="ai-comment__byline">—— 进化湾 AI 裁判团</view>
    <view v-if="showScreenshotHint" class="ai-comment__screenshot-hint">
      <text>截图分享你的AI锐评</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  tierName: { type: String, default: '' },
  tierEmoji: { type: String, default: '' },
  tierColor: { type: String, default: '#7c3aed' },
  commentary: { type: String, default: '' },
});

const visible = ref(false);
const showScreenshotHint = ref(false);

onMounted(() => {
  setTimeout(() => { visible.value = true; }, 100);
  setTimeout(() => { showScreenshotHint.value = true; }, 3000);
});
</script>

<style scoped lang="scss">
.ai-comment {
  width: 100%;
  margin-top: 32rpx;
  opacity: 0;
  transform: translateY(20rpx);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;

  &--visible {
    opacity: 1;
    transform: translateY(0);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 16rpx;
  }

  &__icon {
    font-size: 28rpx;
  }

  &__label {
    font-size: 26rpx;
    color: $color-text-primary;
    font-weight: 600;
  }

  &__badge {
    margin-left: auto;
    padding: 4rpx 16rpx;
    border-radius: 16rpx;
    font-size: 22rpx;
    color: #fff;
    opacity: 0.9;
  }

  &__body {
    position: relative;
    padding: 24rpx 28rpx;
    background: rgba(255,255,255,0.04);
    border-radius: 12rpx;
    border-left: 4rpx solid;
  }

  &__quote-mark {
    font-size: 48rpx;
    font-weight: bold;
    line-height: 1;
    font-family: Georgia, serif;

    &--end {
      display: block;
      text-align: right;
      margin-top: 8rpx;
    }
  }

  &__text {
    font-size: 28rpx;
    color: $color-text-primary;
    line-height: 1.7;
    word-break: break-all;
    overflow-wrap: break-word;
  }

  &__byline {
    text-align: right;
    font-size: 22rpx;
    color: $color-text-muted;
    margin-top: 10rpx;
    font-style: italic;
  }

  &__screenshot-hint {
    text-align: center;
    margin-top: 20rpx;
    padding: 12rpx 20rpx;
    background: rgba(255, 255, 255, 0.03);
    border: 1rpx dashed rgba(255, 255, 255, 0.1);
    border-radius: 10rpx;
    font-size: 22rpx;
    color: $color-text-muted;
    animation: fade-in 0.5s ease-out both;
  }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
