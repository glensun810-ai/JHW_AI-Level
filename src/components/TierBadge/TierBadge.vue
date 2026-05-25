<template>
  <view class="tier-badge" :class="[`tier-badge--${size}`, { 'tier-badge--animated': animated }]">
    <view class="tier-badge__glow" :style="{ background: tierColor }"></view>
    <image
      class="tier-badge__icon"
      :src="badgeSrc"
      :style="{ width: iconSize + 'rpx', height: iconSize + 'rpx' }"
      mode="aspectFit"
    />
    <text class="tier-badge__name" :style="{ fontSize: nameSize + 'rpx' }">{{ tierName }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { TIERS, getTier, getTierColor } from '@/utils/tier.js';
import { TIER_BADGE_IMAGES } from '@/utils/constants.js';

const props = defineProps({
  tier: { type: String, default: '萌新' },
  score: { type: Number, default: 0 },
  size: { type: String, default: 'medium' }, // small | medium | large
  animated: { type: Boolean, default: true },
  showName: { type: Boolean, default: true },
});

const tierData = computed(() => {
  if (props.score > 0) return getTier(props.score);
  return TIERS.find(t => t.name === props.tier) || TIERS[0];
});

const tierName = computed(() => tierData.value.name);
const tierColor = computed(() => tierData.value.color);
const badgeSrc = computed(() => TIER_BADGE_IMAGES[tierName.value] || TIER_BADGE_IMAGES['萌新']);

const sizeMap = { small: { icon: 80, name: 24 }, medium: { icon: 160, name: 32 }, large: { icon: 240, name: 40 } };
const iconSize = computed(() => sizeMap[props.size].icon);
const nameSize = computed(() => sizeMap[props.size].name);
</script>

<style scoped lang="scss">
.tier-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;

  &--small { padding: 8rpx; }
  &--medium { padding: 16rpx; }
  &--large { padding: 24rpx; }

  &__glow {
    position: absolute;
    width: 60%;
    height: 60%;
    border-radius: 50%;
    filter: blur(40rpx);
    opacity: 0.3;
  }

  &__icon {
    position: relative;
    z-index: 1;
  }

  &__name {
    color: #ffffff;
    font-weight: bold;
    margin-top: 8rpx;
    text-shadow: 0 2rpx 8rpx rgba(0,0,0,0.5);
  }

  &--animated {
    .tier-badge__icon {
      animation: tier-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
  }
}

@keyframes tier-pop-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
</style>
