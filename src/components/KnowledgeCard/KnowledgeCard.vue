<template>
  <view class="kc" :class="{ 'kc--expanded': expanded }">
    <view class="kc__header" @click="toggle">
      <text class="kc__emoji">{{ card.emoji || '💡' }}</text>
      <view class="kc__header-text">
        <text class="kc__skill-tag">{{ card.skillName || '进化知识' }}</text>
        <text class="kc__title">{{ card.title }}</text>
      </view>
      <text class="kc__arrow">{{ expanded ? '▲' : '▼' }}</text>
    </view>

    <view class="kc__body" v-if="expanded">
      <text class="kc__hook">{{ card.hook }}</text>

      <view class="kc__divider" />

      <text class="kc__body-text">{{ card.body }}</text>

      <view v-if="card.actionTip" class="kc__action-tip">
        <text class="kc__action-label">👉 试试这样</text>
        <text class="kc__action-text">{{ card.actionTip }}</text>
      </view>

      <view v-if="card.funFact && showFunFact" class="kc__funfact">
        <text class="kc__funfact-label">💬 趣事</text>
        <text class="kc__funfact-text">{{ card.funFact }}</text>
      </view>

      <view class="kc__footer">
        <view class="kc__btn" :class="{ 'kc__btn--done': feedbackDone }" @click.stop="onHelpful">
          <text>{{ feedbackDone ? '✓ 已反馈' : '👍 有帮助' }}</text>
        </view>
        <view v-if="canCollect" class="kc__btn" :class="{ 'kc__btn--done': collected }" @click.stop="onCollect">
          <text>{{ collected ? '★ 已收藏' : '☆ 收藏' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useExperienceStore } from '@/store/experience.js';

const props = defineProps({
  card: { type: Object, required: true },
});

const emit = defineEmits(['helpful', 'collect']);

const expStore = useExperienceStore();
const expanded = ref(false);
const feedbackDone = ref(false);
const showFunFact = ref(false);
const canCollect = ref(false); // Lv.8+ 解锁

// v0.9: 收藏持久化到本地存储
const COLLECTED_KEY = 'collected_knowledge_cards';
const collected = ref(false);

let readTimer = null;
let funFactTimer = null;

function loadCollected() {
  try {
    const list = uni.getStorageSync(COLLECTED_KEY) || [];
    collected.value = list.includes(props.card.id);
  } catch {
    collected.value = false;
  }
}

function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    startReadTracking();
  } else {
    stopReadTracking();
  }
}

function startReadTracking() {
  stopReadTracking();
  // 5 秒后展示趣味事实
  funFactTimer = setTimeout(() => { showFunFact.value = true; }, 3000);
  // 5 秒后触发进化值奖励（仅首次阅读）
  readTimer = setTimeout(() => {
    if (!feedbackDone.value) {
      expStore.addExp('knowledge');
    }
  }, 5000);
}

function stopReadTracking() {
  if (readTimer) { clearTimeout(readTimer); readTimer = null; }
  if (funFactTimer) { clearTimeout(funFactTimer); funFactTimer = null; }
}

function onHelpful() {
  if (feedbackDone.value) return;
  feedbackDone.value = true;
  expStore.addExp('knowledge');
  emit('helpful', { cardId: props.card.id, helpful: true });
}

function onCollect() {
  if (collected.value) return;
  collected.value = true;
  // 持久化
  try {
    const list = uni.getStorageSync(COLLECTED_KEY) || [];
    if (!list.includes(props.card.id)) {
      list.push(props.card.id);
      uni.setStorageSync(COLLECTED_KEY, list);
    }
  } catch { /* ignore */ }
  emit('collect', { cardId: props.card.id });
}

onMounted(() => {
  canCollect.value = expStore.level >= 8;
  loadCollected();
});

onBeforeUnmount(() => {
  stopReadTracking();
});
</script>

<style scoped lang="scss">
.kc {
  width: 100%;
  margin-top: 20rpx;
  background: rgba(255, 255, 255, 0.03);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 16rpx;
  overflow: hidden;
  transition: all 0.3s ease;

  &--expanded {
    background: rgba(0, 200, 255, 0.04);
    border-color: rgba(0, 200, 255, 0.15);
  }

  &__header {
    display: flex;
    align-items: center;
    padding: 16rpx 24rpx;
    gap: 12rpx;
    cursor: pointer;

    &:active { opacity: 0.7; }
  }

  &__emoji {
    font-size: 36rpx;
    flex-shrink: 0;
  }

  &__header-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
    min-width: 0;
  }

  &__skill-tag {
    font-size: 20rpx;
    color: $color-gold;
    opacity: 0.7;
  }

  &__title {
    font-size: 26rpx;
    font-weight: 600;
    color: $color-text-primary;
  }

  &__arrow {
    font-size: 20rpx;
    color: $color-text-muted;
    flex-shrink: 0;
  }

  &__body {
    padding: 0 24rpx 24rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    animation: kc-fade-in 0.3s ease-out;
  }

  &__hook {
    font-size: 26rpx;
    color: $color-accent;
    line-height: 1.6;
    font-style: italic;
  }

  &__divider {
    width: 60rpx;
    height: 2rpx;
    background: rgba(255, 255, 255, 0.08);
  }

  &__body-text {
    font-size: 26rpx;
    color: $color-text-secondary;
    line-height: 1.7;
  }

  &__action-tip {
    background: rgba(0, 200, 255, 0.06);
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
  }

  &__action-label {
    font-size: 22rpx;
    color: $color-accent;
    font-weight: 600;
  }

  &__action-text {
    font-size: 24rpx;
    color: $color-text-primary;
    line-height: 1.6;
  }

  &__funfact {
    background: rgba(245, 158, 11, 0.06);
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    animation: kc-fade-in 0.3s ease-out;
  }

  &__funfact-label {
    font-size: 20rpx;
    color: $color-gold;
    font-weight: 600;
  }

  &__funfact-text {
    font-size: 22rpx;
    color: $color-text-secondary;
    line-height: 1.6;
    opacity: 0.85;
  }

  &__footer {
    display: flex;
    gap: 16rpx;
    margin-top: 4rpx;
  }

  &__btn {
    padding: 10rpx 24rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.06);
    font-size: 22rpx;
    color: $color-text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:active { background: rgba(255, 255, 255, 0.12); }

    &--done {
      color: $color-gold;
      background: rgba(245, 158, 11, 0.08);
    }
  }
}

@keyframes kc-fade-in {
  from { opacity: 0; transform: translateY(-8rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
