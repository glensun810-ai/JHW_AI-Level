/**
 * 云函数调用封装 — v0.6
 * 统一错误处理、Loading状态、自动重试
 */

const MAX_RETRIES = 2;
const RETRY_DELAYS = [800, 2000]; // 指数退避：800ms → 2000ms

/**
 * 调用云函数（自动重试网络瞬时错误）
 * @param {string} name - 云函数名称
 * @param {Object} data - 入参
 * @param {Object} options - 选项 { showLoading, loadingText, retry }
 * @returns {Promise<{code: number, message: string, data: any}>}
 */
export async function callCloudFunction(name, data = {}, options = {}) {
  const { showLoading = false, loadingText = '加载中...', retry = true } = options;

  if (showLoading) {
    uni.showLoading({ title: loadingText, mask: true });
  }

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await wx.cloud.callFunction({ name, data });
      const result = res.result || {};

      if (result.code !== 0 && result.code !== 500) {
        // 业务错误不重试，直接返回
        if (showLoading) uni.hideLoading();
        uni.showToast({ title: result.message || '请求失败', icon: 'none' });
        return result;
      }

      // 服务端 500 可能是瞬时错误，允许重试
      if (result.code === 500 && retry && attempt < MAX_RETRIES) {
        throw new Error(`Server 500: ${result.message}`);
      }

      if (showLoading) uni.hideLoading();
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[api] ${name} 调用失败 (第${attempt + 1}次):`, err.message);

      if (!retry || attempt >= MAX_RETRIES) {
        if (showLoading) uni.hideLoading();
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        return { code: 500, message: '网络异常', data: null };
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  if (showLoading) uni.hideLoading();
  return { code: 500, message: '网络异常', data: null };
}

// 题目预加载缓存（首页后台 fetch，答题页命中免等待）
let questionCache = null;
let questionCacheIndex = -1;

/**
 * 首页预加载每日题目（后台静默调用，不阻塞 UI）
 */
export async function preloadDailyQuestions() {
  const freeCount = uni.getStorageSync('test_count') || 0;
  const adCount = uni.getStorageSync('ad_test_count') || 0;
  const totalCount = freeCount + adCount;
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = uni.getStorageSync('test_date');
  if (storedDate === today && freeCount >= 3 && adCount >= 2) return;

  try {
    // 预加载普通模式(5题)，setIdx 基于当前计数
    const setIdx = Math.min(totalCount, 4);
    const cacheDate = today;
    questionCache = await callCloudFunction('getDailyQuestions', { setIndex: setIdx, count: 5 }, { retry: false });
    if (questionCache.code === 0) {
      questionCache._cacheDate = cacheDate;
    }
    questionCacheIndex = setIdx * 100 + 5;
  } catch (e) {
    // 预加载失败不影响首页展示
  }
}

/**
 * 获取每日题目（优先命中预加载缓存，带日期校验）
 */
export function fetchDailyQuestions(date, setIndex = 0, count = 5) {
  const cacheKey = setIndex * 100 + count;
  const today = new Date().toISOString().slice(0, 10);

  if (questionCache && questionCache.code === 0 && questionCacheIndex === cacheKey) {
    // 日期校验：缓存过期（非今日数据）则丢弃
    if (questionCache._cacheDate === today) {
      const cached = questionCache;
      questionCache = null;
      questionCacheIndex = -1;
      return Promise.resolve(cached);
    }
    // 过期缓存丢弃
    questionCache = null;
    questionCacheIndex = -1;
  }
  return callCloudFunction('getDailyQuestions', { date, setIndex, count });
}

/**
 * 提交分数
 */
export function submitTestScore(questionSetId, answers, fromUid = '', challengeId = '', testType = 'free') {
  return callCloudFunction('submitScore', { questionSetId, answers, fromUid, challengeId, testType }, { showLoading: true, loadingText: 'AI正在评估...' });
}

/**
 * 获取全国段位分布
 */
export function fetchTierDistribution() {
  return callCloudFunction('getTierDistribution');
}

/**
 * 获取好友段位排名
 * @param {string} action - 'rank'(默认) | 'updatePrivacy' | 'groupRank'
 */
export function fetchFriendRank(action = 'rank') {
  return callCloudFunction('getFriendRank', { action });
}

/**
 * 发起挑战
 */
export function sendChallengeRequest(targetOpenid, score, tier) {
  return callCloudFunction('sendChallenge', { targetOpenid, score, tier });
}

/**
 * 获取每周统计（晋升榜 + 签到状态 + 回顾数据）
 */
export function fetchWeeklyStats() {
  return callCloudFunction('getWeeklyStats');
}

/**
 * 签到打卡
 */
export function doCheckIn() {
  return callCloudFunction('getWeeklyStats', { action: 'checkin' });
}

/**
 * 提交快速反馈
 */
export function submitFeedback(testRecordId, isAccurate) {
  return callCloudFunction('getWeeklyStats', { action: 'feedback', testRecordId, isAccurate });
}

/**
 * 更新隐私设置
 */
export function updatePrivacy(privacyHidden) {
  return callCloudFunction('getFriendRank', { action: 'updatePrivacy', privacyHidden });
}
