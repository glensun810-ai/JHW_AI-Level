<template>
  <view class="reversal" :class="{ 'reversal--flip': phase === 'flip' }">
    <!-- 阶段1：假段位抖动 -->
    <view v-if="phase === 'fake'" class="reversal__fake">
      <text class="reversal__fake-tier">{{ fakeTier }}</text>
      <text class="reversal__fake-sub">你的AI段位是...</text>
    </view>

    <!-- 阶段2：粒子爆炸 -->
    <view v-if="phase === 'explosion'" class="reversal__burst">
      <view
        v-for="p in particles"
        :key="p.i"
        class="reversal__particle"
        :style="{
          '--dx': p.dx + 'rpx',
          '--dy': p.dy + 'rpx',
          '--size': p.size + 'rpx',
          '--delay': p.delay + 's',
          '--color': p.color,
        }"
      />
      <text class="reversal__burst-text">假的！</text>
    </view>

    <!-- 阶段3-4：翻转揭晓 -->
    <view v-if="phase === 'flip' || phase === 'reveal'" class="reversal__card">
      <view class="reversal__card-inner" :class="{ 'reversal__card-inner--flipped': phase === 'reveal' }">
        <!-- 正面：空白占位 -->
        <view class="reversal__card-front" />
        <!-- 背面：真实段位 -->
        <view class="reversal__card-back">
          <view class="reversal__real-glow" :style="{ background: realColor }" />
          <text class="reversal__real-emoji">{{ realEmoji }}</text>
          <text class="reversal__real-tier" :style="{ color: realColor }">{{ realTier }}</text>
          <text class="reversal__real-label">你的真实AI段位</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  fakeTier: { type: String, required: true },
  realTier: { type: String, required: true },
  realEmoji: { type: String, default: '' },
  realColor: { type: String, default: '#2e7d32' },
});

const emit = defineEmits(['done']);

const phase = ref('fake');
const particles = ref([]);

const PARTICLE_COLORS = ['#ff4444', '#ff6b6b', '#ff8c8c', '#ffd700', '#ff9f43'];

onMounted(() => {
  // 阶段1：假段位抖动 0.6s
  setTimeout(() => {
    phase.value = 'explosion';
    // 生成40个粒子
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 160;
      pts.push({
        i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 4 + Math.random() * 10,
        delay: Math.random() * 0.3,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }
    particles.value = pts;

    // 阶段3：爆炸持续 0.7s 后开始翻转
    setTimeout(() => {
      phase.value = 'flip';
      // 阶段4：翻转完成 0.5s 后揭晓
      setTimeout(() => {
        phase.value = 'reveal';
        // 揭晓后 0.6s 通知完成
        setTimeout(() => {
          emit('done');
        }, 600);
      }, 500);
    }, 700);
  }, 600);
});
</script>

<style scoped lang="scss">
.reversal {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500rpx;
  position: relative;
  overflow: hidden;

  // ====== 假段位 ======
  &__fake {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: shake-in 0.4s ease-out;
  }

  &__fake-tier {
    font-size: 64rpx;
    font-weight: bold;
    color: #ff4444;
    text-shadow: 0 0 20rpx rgba(255,68,68,0.5);
  }

  &__fake-sub {
    margin-top: 16rpx;
    font-size: 26rpx;
    color: rgba(255,255,255,0.4);
  }

  // ====== 粒子爆炸 ======
  &__burst {
    position: relative;
    width: 400rpx;
    height: 400rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__burst-text {
    font-size: 48rpx;
    font-weight: bold;
    color: #ffd700;
    z-index: 2;
    animation: pop-in 0.3s ease-out;
  }

  &__particle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--color);
    animation: particle-fly 0.8s ease-out var(--delay) forwards;
    opacity: 0;
  }

  // ====== 3D 翻转卡片 ======
  &__card {
    width: 400rpx;
    height: 400rpx;
    perspective: 1000rpx;
  }

  &__card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);

    &--flipped {
      transform: rotateY(180deg);
    }
  }

  &__card-front,
  &__card-back {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__card-front {
    background: rgba(255,255,255,0.03);
  }

  &__card-back {
    background: rgba(255,255,255,0.06);
    border: 2rpx solid rgba(255,255,255,0.08);
    transform: rotateY(180deg);
  }

  &__real-glow {
    position: absolute;
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    filter: blur(60rpx);
    opacity: 0.25;
  }

  &__real-emoji {
    font-size: 80rpx;
    position: relative;
    z-index: 1;
    animation: tier-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  &__real-tier {
    font-size: 52rpx;
    font-weight: bold;
    margin-top: 12rpx;
    position: relative;
    z-index: 1;
    animation: tier-pop 0.5s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }

  &__real-label {
    font-size: 24rpx;
    color: rgba(255,255,255,0.4);
    margin-top: 8rpx;
  }
}

// ====== 动画关键帧 ======
@keyframes shake-in {
  0% { transform: translateX(0); opacity: 0; }
  10% { transform: translateX(-16rpx); opacity: 1; }
  30% { transform: translateX(16rpx); }
  50% { transform: translateX(-12rpx); }
  70% { transform: translateX(12rpx); }
  90% { transform: translateX(-4rpx); }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes particle-fly {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1);
    opacity: 0;
  }
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes tier-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
</style>
