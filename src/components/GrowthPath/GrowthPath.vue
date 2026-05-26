<template>
  <view class="growth" v-if="visible" :class="{ 'growth--in': animated }">
    <view class="growth__header">
      <text class="growth__header-icon">🔮</text>
      <text class="growth__header-text">你的 AI 进化路线</text>
    </view>

    <view class="growth__intro">
      别担心，每个无界都是从萌新开始的。今天试试这 3 个：
    </view>

    <view class="growth__tools">
      <view
        v-for="tool in tools"
        :key="tool.name"
        class="growth__tool"
        @click="openTool(tool)"
      >
        <text class="growth__tool-emoji">{{ tool.emoji }}</text>
        <view class="growth__tool-info">
          <text class="growth__tool-name">{{ tool.name }}</text>
          <text class="growth__tool-desc">{{ tool.desc }}</text>
        </view>
        <text class="growth__tool-arrow">›</text>
      </view>
    </view>

    <view class="growth__reminder">
      <text class="growth__reminder-icon">📅</text>
      <text class="growth__reminder-text">{{ reminderText }}</text>
    </view>

    <button class="growth__btn" @click="setReminder">
      {{ reminderSet ? '✅ 已设置提醒' : '⏰ 30天后提醒我再测' }}
    </button>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  tierName: { type: String, default: '' },
  tierIndex: { type: Number, default: 0 },
});

const visible = computed(() => props.tierIndex <= 2);
const animated = ref(false);
const reminderSet = ref(false);

const tools = [
  { name: '豆包 / Kimi', desc: '免费的AI对话助手', emoji: '🤖' },
  { name: '通义千问', desc: '阿里的全能AI工具', emoji: '☁️' },
  { name: '秘塔AI', desc: '学术搜索神器', emoji: '🔍' },
];

const reminderText = computed(() => {
  const nextTiers = ['探索者', '实践者', '协作者'];
  const target = nextTiers[props.tierIndex] || '协作者';
  return `30 天后回来再测，看看你能不能升到「${target}」🔼`;
});

onMounted(() => {
  setTimeout(() => { animated.value = true; }, 200);
  const stored = uni.getStorageSync('growth_reminder');
  if (stored) {
    const d30 = new Date(stored);
    if (d30 > new Date()) reminderSet.value = true;
  }
});

function setReminder() {
  if (reminderSet.value) return;
  const d30 = new Date();
  d30.setDate(d30.getDate() + 30);
  uni.setStorageSync('growth_reminder', d30.toISOString());
  reminderSet.value = true;
  uni.showToast({ title: '已设置提醒，30天后见！', icon: 'success' });
}

function openTool(tool) {
  // 小程序内无法直接打开外部链接，提供复制提示
  uni.setClipboardData({
    data: tool.name,
    success: () => {
      uni.showToast({ title: `已复制「${tool.name}」，去搜索试试吧`, icon: 'none' });
    },
  });
}
</script>

<style scoped lang="scss">
.growth {
  width: 100%;
  margin-top: 32rpx;
  padding: 28rpx;
  background: rgba(124, 58, 237, 0.08);
  border-radius: 16rpx;
  border: 1rpx solid rgba(124, 58, 237, 0.15);
  opacity: 0;
  transform: translateY(20rpx);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;

  &--in {
    opacity: 1;
    transform: translateY(0);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 16rpx;

    &-icon { font-size: 32rpx; }
    &-text {
      font-size: 28rpx;
      font-weight: bold;
      color: $color-accent;
    }
  }

  &__intro {
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.6;
    margin-bottom: 20rpx;
  }

  &__tools {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__tool {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding: 16rpx 20rpx;
    background: rgba(255,255,255,0.04);
    border-radius: 12rpx;
    transition: background 0.15s;

    &:active {
      background: rgba(255,255,255,0.08);
    }
  }

  &__tool-emoji {
    font-size: 40rpx;
    flex-shrink: 0;
  }

  &__tool-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  &__tool-name {
    font-size: 26rpx;
    color: $color-text-primary;
    font-weight: 500;
  }

  &__tool-desc {
    font-size: 22rpx;
    color: $color-text-muted;
    margin-top: 2rpx;
  }

  &__tool-arrow {
    font-size: 32rpx;
    color: $color-text-muted;
    flex-shrink: 0;
  }

  &__reminder {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: 24rpx;
    padding: 16rpx;
    background: rgba(245, 158, 11, 0.08);
    border-radius: 10rpx;

    &-icon { font-size: 26rpx; }
    &-text {
      font-size: 24rpx;
      color: $color-gold;
      line-height: 1.5;
    }
  }

  &__btn {
    width: 100%;
    margin-top: 16rpx;
    height: 72rpx;
    line-height: 72rpx;
    background: rgba(124, 58, 237, 0.15);
    border: 1rpx solid rgba(124, 58, 237, 0.25);
    border-radius: 36rpx;
    font-size: 26rpx;
    color: $color-accent;
    text-align: center;
  }
}
</style>
