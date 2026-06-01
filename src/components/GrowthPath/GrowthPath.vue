<template>
  <view class="growth" :class="{ 'growth--in': animated }">
    <view class="growth__header">
      <text class="growth__header-icon">🔮</text>
      <text class="growth__header-text">你的 AI 进化路线</text>
    </view>

    <!-- 8段位进度条 -->
    <view class="growth__ladder">
      <view
        v-for="(t, i) in TIERS"
        :key="t.name"
        class="growth__ladder-step"
        :class="{
          'growth__ladder-step--passed': i < tierIndex,
          'growth__ladder-step--current': i === tierIndex,
          'growth__ladder-step--future': i > tierIndex,
        }"
      >
        <view class="growth__ladder-dot">
          <text class="growth__ladder-emoji">{{ t.emoji }}</text>
        </view>
        <view v-if="i < TIERS.length - 1" class="growth__ladder-connector"
          :class="{ 'growth__ladder-connector--passed': i < tierIndex }" />
        <text class="growth__ladder-label" :class="{ 'growth__ladder-label--current': i === tierIndex }">
          {{ i === tierIndex ? '你在这' : '' }}
        </text>
      </view>
    </view>

    <!-- 当前段位 + 下一段位 -->
    <view class="growth__status">
      <text class="growth__status-current">{{ TIERS[tierIndex]?.emoji }} {{ TIERS[tierIndex]?.name }}</text>
      <template v-if="nextTier">
        <text class="growth__status-arrow">→</text>
        <text class="growth__status-next">{{ nextTierEmoji }} {{ nextTier }}</text>
        <text class="growth__status-gap">还差 {{ aiqPointsToNext }} 点AI商数</text>
      </template>
      <template v-else>
        <text class="growth__status-max">已达进化顶点</text>
      </template>
    </view>

    <!-- 个性化下一步行动 -->
    <view v-if="weakestDimension" class="growth__action">
      <text class="growth__action-label">📌 下一步行动</text>
      <text class="growth__action-dim">你的进化方向是「{{ weakestDimension.name }}」</text>
      <text class="growth__action-hint">{{ weakestDimension.hint }}</text>
    </view>

    <!-- 推荐工具 -->
    <view v-if="recommendedTool" class="growth__tool" @click="openTool">
      <text class="growth__tool-label">🔧 推荐工具</text>
      <view class="growth__tool-card">
        <text class="growth__tool-emoji">{{ recommendedTool.emoji }}</text>
        <view class="growth__tool-info">
          <text class="growth__tool-name">{{ recommendedTool.name }}</text>
          <text class="growth__tool-desc">{{ recommendedTool.desc }}</text>
        </view>
        <text class="growth__tool-arrow">›</text>
      </view>
    </view>

    <!-- 好友动态 -->
    <view v-if="friendActivity" class="growth__friend">
      <text class="growth__friend-icon">🏆</text>
      <text class="growth__friend-text">{{ friendActivity }}</text>
    </view>

    <!-- 7天提醒 -->
    <view class="growth__reminder">
      <text class="growth__reminder-icon">📅</text>
      <text class="growth__reminder-text">{{ reminderText }}</text>
    </view>
    <button class="growth__btn" @click="setReminder">
      {{ reminderSet ? '✅ 已设置提醒' : '⏰ 7天后提醒我再测' }}
    </button>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { TIERS } from '@/utils/tier.js';

const props = defineProps({
  tierIndex: { type: Number, default: 0 },
  weakestDimension: { type: Object, default: null },
  nextTier: { type: String, default: '' },
  nextTierEmoji: { type: String, default: '' },
  aiqPointsToNext: { type: Number, default: 0 },
  friendActivity: { type: String, default: '' },
});

const animated = ref(false);
const reminderSet = ref(false);

// 工具推荐：基于最弱维度匹配
const toolMap = {
  '信息感知': { name: 'Readhub', desc: 'AI科技新闻早报，培养信息敏感度', emoji: '📰' },
  '工具应用': { name: '扣子(Coze)', desc: '零代码搭建AI工作流，让工具为你所用', emoji: '🔧' },
  '内容辨别': { name: '秘塔AI搜索', desc: '搜索结果带来源追溯，练出辨别力', emoji: '🔍' },
  '时代心态': { name: 'WaytoAGI社区', desc: 'AI前沿资讯与深度讨论，拓宽视野', emoji: '🌐' },
  '思维深度': { name: 'Claude', desc: '长文深度分析助手，陪你一步步推演', emoji: '💎' },
};

const recommendedTool = computed(() => {
  if (!props.weakestDimension?.name) return null;
  return toolMap[props.weakestDimension.name] || null;
});

const reminderText = computed(() => {
  if (props.nextTier) {
    return `7 天后回来再测，看看能不能升到「${props.nextTier}」🔼`;
  }
  return '7 天后回来再测，保持你的无界之境 🌊';
});

onMounted(() => {
  setTimeout(() => { animated.value = true; }, 150);
  const stored = uni.getStorageSync('growth_reminder');
  if (stored) {
    const d7 = new Date(stored);
    if (d7 > new Date()) reminderSet.value = true;
  }
});

function setReminder() {
  if (reminderSet.value) return;
  const d7 = new Date();
  d7.setDate(d7.getDate() + 7);
  uni.setStorageSync('growth_reminder', d7.toISOString());
  reminderSet.value = true;
  uni.showToast({ title: '已设置7天后提醒！', icon: 'success' });
}

function openTool() {
  if (!recommendedTool.value) return;
  uni.setClipboardData({
    data: recommendedTool.value.name,
    success: () => {
      uni.showToast({ title: `已复制「${recommendedTool.value.name}」，去搜索试试吧`, icon: 'none' });
    },
  });
}
</script>

<style scoped lang="scss">
.growth {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
    margin-bottom: 20rpx;

    &-icon { font-size: 32rpx; }
    &-text {
      font-size: 28rpx;
      font-weight: bold;
      color: $color-accent;
    }
  }

  // 8段位阶梯
  &__ladder {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 8rpx 0 16rpx;
    gap: 0;
  }

  &__ladder-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    width: 68rpx;
  }

  &__ladder-dot {
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: 2rpx solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s;
  }

  &__ladder-emoji {
    font-size: 24rpx;
    line-height: 1;
  }

  &__ladder-step--passed &__ladder-dot {
    background: rgba(124, 58, 237, 0.2);
    border-color: rgba(124, 58, 237, 0.4);
  }

  &__ladder-step--current &__ladder-dot {
    background: rgba(124, 58, 237, 0.35);
    border-color: $color-accent;
    width: 60rpx;
    height: 60rpx;
    box-shadow: 0 0 16rpx rgba(0, 200, 255, 0.3);
  }

  &__ladder-step--current &__ladder-emoji {
    font-size: 28rpx;
  }

  &__ladder-step--future &__ladder-dot {
    opacity: 0.4;
  }

  &__ladder-connector {
    position: absolute;
    top: 26rpx;
    left: 50%;
    width: 60rpx;
    height: 3rpx;
    background: rgba(255, 255, 255, 0.08);

    &--passed {
      background: rgba(124, 58, 237, 0.35);
    }
  }

  &__ladder-label {
    font-size: 16rpx;
    color: $color-text-muted;
    margin-top: 6rpx;
    height: 20rpx;

    &--current {
      color: $color-accent;
      font-weight: bold;
      font-size: 18rpx;
    }
  }

  // 段位状态
  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    padding: 16rpx 0;
    margin-bottom: 8rpx;

    &-current {
      font-size: 28rpx;
      font-weight: bold;
      color: $color-text-primary;
    }

    &-arrow {
      font-size: 24rpx;
      color: $color-text-muted;
    }

    &-next {
      font-size: 28rpx;
      font-weight: bold;
      color: $color-gold;
    }

    &-gap {
      font-size: 22rpx;
      color: $color-text-secondary;
      margin-left: 4rpx;
    }

    &-max {
      font-size: 24rpx;
      color: $color-gold;
    }
  }

  // 下一步行动
  &__action {
    padding: 20rpx;
    background: rgba(245, 158, 11, 0.08);
    border-radius: 12rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.12);
    margin-bottom: 12rpx;

    &-label {
      display: block;
      font-size: 22rpx;
      color: $color-gold;
      font-weight: bold;
      margin-bottom: 8rpx;
    }

    &-dim {
      display: block;
      font-size: 26rpx;
      color: $color-text-primary;
      font-weight: 600;
      margin-bottom: 6rpx;
    }

    &-hint {
      display: block;
      font-size: 24rpx;
      color: $color-text-secondary;
      line-height: 1.6;
    }
  }

  // 推荐工具
  &__tool {
    margin-bottom: 12rpx;

    &-label {
      display: block;
      font-size: 22rpx;
      color: $color-accent;
      font-weight: bold;
      margin-bottom: 8rpx;
    }

    &-card {
      display: flex;
      align-items: center;
      gap: 14rpx;
      padding: 16rpx 20rpx;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 12rpx;
      transition: background 0.15s;

      &:active { background: rgba(255, 255, 255, 0.08); }
    }

    &-emoji { font-size: 40rpx; flex-shrink: 0; }

    &-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    &-name {
      font-size: 26rpx;
      color: $color-text-primary;
      font-weight: 500;
    }

    &-desc {
      font-size: 22rpx;
      color: $color-text-muted;
      margin-top: 2rpx;
    }

    &-arrow {
      font-size: 32rpx;
      color: $color-text-muted;
      flex-shrink: 0;
    }
  }

  // 好友动态
  &__friend {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 16rpx;
    background: rgba(0, 200, 255, 0.06);
    border-radius: 10rpx;
    margin-bottom: 12rpx;

    &-icon { font-size: 26rpx; flex-shrink: 0; }

    &-text {
      font-size: 24rpx;
      color: $color-accent;
      line-height: 1.5;
    }
  }

  // 提醒
  &__reminder {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 16rpx;
    background: rgba(245, 158, 11, 0.06);
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
    margin-top: 12rpx;
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
