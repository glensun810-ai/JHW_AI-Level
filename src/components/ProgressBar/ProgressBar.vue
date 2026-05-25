<template>
  <view class="progress-bar">
    <view class="progress-bar__track">
      <view
        v-for="(tier, idx) in tiers"
        :key="tier.name"
        class="progress-bar__chip"
        :class="{
          'progress-bar__chip--active': idx < litCount,
          'progress-bar__chip--flash': isFlashing,
        }"
        :style="idx < litCount ? { borderColor: tier.color, boxShadow: `0 0 12rpx ${tier.color}40` } : {}"
      >
        <text class="progress-bar__emoji">{{ tier.emoji }}</text>
      </view>
    </view>
    <text class="progress-bar__label">{{ answered }} / {{ total }}</text>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { TIERS } from '@/utils/tier.js';

const props = defineProps({
  answered: { type: Number, default: 0 },
  total: { type: Number, default: 5 },
});

const emit = defineEmits(['complete']);

// Lighting map: answered count → tier count lit
const LIT_MAP = [0, 2, 4, 6, 7, 8];

const tiers = TIERS;
const isFlashing = ref(false);

const litCount = computed(() => LIT_MAP[props.answered] || 0);

watch(() => props.answered, (val) => {
  if (val >= props.total) {
    isFlashing.value = true;
    setTimeout(() => {
      isFlashing.value = false;
      emit('complete');
    }, 800);
  }
});
</script>

<style scoped lang="scss">
.progress-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;

  &__track {
    flex: 1;
    display: flex;
    justify-content: space-between;
  }

  &__chip {
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 2rpx solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.5s ease;

    &--active {
      background: rgba(255, 255, 255, 0.1);
      border-width: 2rpx;
      transform: scale(1.1);
    }

    &--flash {
      animation: tier-flash 0.2s ease-in-out 2;
    }
  }

  &__emoji {
    font-size: 22rpx;
    line-height: 1;
  }

  &__label {
    color: #8899aa;
    font-size: 24rpx;
    white-space: nowrap;
    min-width: 60rpx;
    text-align: right;
  }
}

@keyframes tier-flash {
  0%, 100% { opacity: 1; transform: scale(1.1); }
  50% { opacity: 0.3; transform: scale(0.9); }
}
</style>
