/**
 * 激励视频广告管理
 * v1.0 — 广告前置模型：每日首次免费，后续需看广告再进答题
 * 当 AD_UNIT_ID 未配置时，降级为邀请解锁提示
 */
const AD_UNIT_ID = ''; // TODO: 在微信公众平台→流量主→广告位管理中创建激励视频广告位后填入

let rewardedVideoAd = null;
let pendingCallback = null;

// 广告是否可用（已配置且有广告位ID）
export function isAdAvailable() {
  return !!AD_UNIT_ID;
}

// ── 免费测试状态（storage key: free_test_date / free_test_used）──

export function hasUsedFreeTestToday() {
  const today = new Date().toISOString().slice(0, 10);
  return uni.getStorageSync('free_test_date') === today
    && uni.getStorageSync('free_test_used') === true;
}

export function markFreeTestUsed() {
  const today = new Date().toISOString().slice(0, 10);
  uni.setStorageSync('free_test_date', today);
  uni.setStorageSync('free_test_used', true);
}

// ── 广告观看状态（storage key: ad_watched_date / ad_watched_today）──

export function hasWatchedAdToday() {
  const today = new Date().toISOString().slice(0, 10);
  return uni.getStorageSync('ad_watched_date') === today
    && uni.getStorageSync('ad_watched_today') === true;
}

export function markAdWatchedToday() {
  const today = new Date().toISOString().slice(0, 10);
  uni.setStorageSync('ad_watched_date', today);
  uni.setStorageSync('ad_watched_today', true);
}

// ── 广告展示 ──

/**
 * 展示激励视频广告
 * @returns {Promise<'completed'|'interrupted'|'error'>}
 */
export function showRewardedAd() {
  return new Promise((resolve) => {
    // 发布前 AD_UNIT_ID 为空时，跳过广告直接放行
    if (!AD_UNIT_ID) {
      console.warn('[ad] 广告位 ID 未配置，跳过广告');
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
              markAdWatchedToday();
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
