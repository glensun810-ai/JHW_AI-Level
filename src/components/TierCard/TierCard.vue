<template>
  <!-- Canvas 始终渲染（屏幕外，微信需要可见元素才能 toTempFilePath） -->
  <canvas
    type="2d"
    :id="canvasId"
    :style="{ width: '375px', height: '500px', position: 'fixed', left: '-9999px', top: '0' }"
  />

  <!-- Loading 遮罩层 -->
  <view v-if="loading" class="tier-card__loading" @click.stop>
    <view class="tier-card__loading-spinner" />
    <text class="tier-card__loading-text">正在生成段位卡…</text>
  </view>

  <!-- 全屏预览 -->
  <view v-if="previewVisible" class="tier-card__overlay" @click="closePreview">
    <view class="tier-card__preview" @click.stop>
      <image
        v-if="previewImage"
        :src="previewImage"
        mode="widthFix"
        class="tier-card__image"
      />
      <view class="tier-card__actions">
        <button class="tier-card__btn tier-card__btn--save" @click="saveToAlbum">
          💾 保存到相册
        </button>
        <button class="tier-card__btn tier-card__btn--share" open-type="share" @click="onShareClick">
          ↗️ 转发给朋友
        </button>
      </view>
      <view class="tier-card__close" @click="closePreview">×</view>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue';
import { generateTierCardImage, generatePersonaCardImage, generateReversalCardImage } from '@/utils/canvas-renderer.js';
import { getShareCopy } from '@/utils/share-helper.js';
import { getTierIndex, getTier } from '@/utils/tier.js';

const props = defineProps({
  mode: { type: String, default: 'tier' },
  canvasId: { type: String, default: 'tier-card-canvas' },
  tierName: { type: String, default: '' },
  totalScore: { type: Number, default: 0 },
  percentile: { type: Number, default: 0 },
  tierCommentary: { type: String, default: '' },
  friendRank: { type: Object, default: null },
  miniCodeUrl: { type: String, default: '' },
  // persona mode props
  personaName: { type: String, default: '' },
  personaEmoji: { type: String, default: '' },
  personaDesc: { type: String, default: '' },
  strongestName: { type: String, default: '' },
  strongestHint: { type: String, default: '' },
  weakestName: { type: String, default: '' },
  weakestHint: { type: String, default: '' },
  personaRarity: { type: String, default: '' },
  // reversal mode props
  fakeTier: { type: String, default: '' },
  // 用户身份（头像昵称，非阻断式授权）
  userAvatar: { type: String, default: '' },
  userNickname: { type: String, default: '' },
});

const emit = defineEmits(['generated', 'saved', 'shared']);

const loading = ref(false);
const previewVisible = ref(false);
const previewImage = ref('');
const tierImageCache = {};

async function generate(showPreview = true) {
  if (loading.value) return;

  const cacheKey = props.mode === 'persona'
    ? `persona_${props.personaName}`
    : props.mode === 'reversal'
    ? `reversal_${props.tierName}`
    : `${props.tierName}_${props.totalScore}`;

  if (tierImageCache[cacheKey]) {
    previewImage.value = tierImageCache[cacheKey];
    if (showPreview) previewVisible.value = true;
    emit('generated', previewImage.value);
    return;
  }

  loading.value = true;

  try {
    const instance = getCurrentInstance();
    let imagePath;

    if (props.mode === 'persona') {
      imagePath = await generatePersonaCardImage({
        personaName: props.personaName || '均衡的进化者',
        personaEmoji: props.personaEmoji || '⚖️',
        personaDesc: props.personaDesc || '',
        strongestName: props.strongestName || '',
        strongestHint: props.strongestHint || '',
        weakestName: props.weakestName || '',
        weakestHint: props.weakestHint || '',
        personaRarity: props.personaRarity || '',
        miniCodeUrl: props.miniCodeUrl,
        userAvatar: props.userAvatar,
        userNickname: props.userNickname,
      }, instance, props.canvasId);
    } else if (props.mode === 'reversal') {
      imagePath = await generateReversalCardImage({
        fakeTier: props.fakeTier || '',
        realTier: props.tierName || '',
        realEmoji: props.tierName ? (getTier(props.totalScore)?.emoji || '') : '',
        miniCodeUrl: props.miniCodeUrl,
        userAvatar: props.userAvatar,
        userNickname: props.userNickname,
      }, instance, props.canvasId);
    } else {
      const tier = getTier(props.totalScore);
      imagePath = await generateTierCardImage({
        tierName: props.tierName || (tier ? tier.name : '萌新'),
        totalScore: props.totalScore,
        percentile: props.percentile,
        tierCommentary: props.tierCommentary,
        friendRank: props.friendRank,
        miniCodeUrl: props.miniCodeUrl,
        userAvatar: props.userAvatar,
        userNickname: props.userNickname,
      }, instance, props.canvasId);
    }

    tierImageCache[cacheKey] = imagePath;
    previewImage.value = imagePath;
    if (showPreview) previewVisible.value = true;
    emit('generated', imagePath);
  } catch (e) {
    console.error('[TierCard] 生成失败:', e);
    uni.showToast({ title: '卡片生成失败，请重试', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function saveToAlbum() {
  if (!previewImage.value) return;

  uni.saveImageToPhotosAlbum({
    filePath: previewImage.value,
    success: () => {
      uni.showToast({ title: '已保存到相册', icon: 'success' });
      emit('saved', previewImage.value);
    },
    fail: (err) => {
      if (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize')) {
        uni.showModal({
          title: '需要相册权限',
          content: '请在设置中允许小程序保存图片到相册',
          success: (r) => {
            if (r.confirm) {
              uni.openSetting({});
            }
          },
        });
      } else {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    },
  });
}

function onShareClick() {
  const tierIndex = getTierIndex(props.totalScore);
  const tier = getTier(props.totalScore);
  const copy = getShareCopy(tierIndex, 'showoff');

  emit('shared', {
    tierName: props.tierName,
    shareStyle: 'showoff',
    channel: 'friend',
  });

  // 分享配置由页面级 onShareAppMessage 控制
  // 这里仅上报埋点
  return {
    title: copy,
    path: '/pages/index/index',
    imageUrl: previewImage.value,
  };
}

function closePreview() {
  previewVisible.value = false;
}

defineExpose({ generate, previewImage, tierImageCache });
</script>

<style scoped lang="scss">
.tier-card {
  &__loading {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24rpx;
  }

  &__loading-spinner {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 3rpx solid rgba(124, 58, 237, 0.2);
    border-top-color: $color-accent;
    animation: spin 0.6s linear infinite;
  }

  &__loading-text {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.7);
  }

  &__overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40rpx;
  }

  &__preview {
    width: 100%;
    max-width: 560rpx;
    position: relative;
    animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  &__image {
    width: 100%;
    border-radius: 16rpx;
    box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.5);
  }

  &__actions {
    display: flex;
    gap: 20rpx;
    margin-top: 32rpx;
  }

  &__btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    color: #fff;
    border: none;
    text-align: center;

    &--save {
      background: rgba(255, 255, 255, 0.12);
    }

    &--share {
      background: linear-gradient(135deg, #7c3aed, #f59e0b);
    }
  }

  &__close {
    position: absolute;
    top: -60rpx;
    right: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 48rpx;
    width: 60rpx;
    height: 60rpx;
    text-align: center;
    line-height: 60rpx;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pop-in {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
