/**
 * 激励视频广告管理
 * 统一广告加载、展示、回调处理，按日跟踪广告解锁次数
 */
import { MAX_AD_TESTS } from './numeric-constants.js';

// 广告位 ID（需在微信公众平台 → 流量主 → 广告管理 → 新建广告位获取）
const AD_UNIT_ID = ''; // TODO: 替换为实际广告位 ID

let rewardedVideoAd = null;
let pendingCallback = null;

function getAdTestCount() {
  const today = new Date().toISOString().slice(0, 10);
  if (uni.getStorageSync('ad_test_date') !== today) {
    uni.setStorageSync('ad_test_date', today);
    uni.setStorageSync('ad_test_count', 0);
    return 0;
  }
  return uni.getStorageSync('ad_test_count') || 0;
}

function incrementAdTestCount() {
  const count = getAdTestCount() + 1;
  uni.setStorageSync('ad_test_count', count);
  return count;
}

function remainingAdTests() {
  return Math.max(0, MAX_AD_TESTS - getAdTestCount());
}

/**
 * 检查广告是否可用
 */
export function canWatchAd() {
  return remainingAdTests() > 0;
}

/**
 * 获取当前可用解锁渠道
 * @returns {{ ad: number, invite: boolean }}
 */
export function getAvailableUnlocks() {
  return {
    ad: remainingAdTests(),
    invite: true, // 邀请始终可用
  };
}

/**
 * 展示激励视频广告
 * @returns {Promise<'completed'|'interrupted'|'error'>}
 */
export function showRewardedAd() {
  return new Promise((resolve) => {
    if (!canWatchAd()) {
      resolve('error');
      return;
    }

    if (!AD_UNIT_ID) {
      console.warn('[ad] 广告位 ID 未配置，跳过广告，不消耗次数');
      resolve('completed');
      return;
    }

    try {
      if (!rewardedVideoAd) {
        rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
        rewardedVideoAd.onError((err) => {
          console.error('[ad] 广告加载失败:', err);
          if (pendingCallback) {
            pendingCallback('error');
            pendingCallback = null;
          }
        });
        rewardedVideoAd.onClose((res) => {
          if (pendingCallback) {
            if (res && res.isEnded) {
              incrementAdTestCount();
              pendingCallback('completed');
            } else {
              pendingCallback('interrupted');
            }
            pendingCallback = null;
          }
        });
      }

      pendingCallback = resolve;
      rewardedVideoAd.show().catch(() => {
        // 广告未加载完成，先 load 再 show
        rewardedVideoAd.load().then(() => rewardedVideoAd.show()).catch((err) => {
          console.error('[ad] 广告展示失败:', err);
          pendingCallback = null;
          resolve('error');
        });
      });
    } catch (e) {
      console.error('[ad] 广告异常:', e);
      resolve('error');
    }
  });
}

export { getAdTestCount, remainingAdTests };
