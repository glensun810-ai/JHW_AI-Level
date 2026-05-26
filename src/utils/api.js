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
  let lastResult = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await wx.cloud.callFunction({ name, data });
      const result = (res && res.result) ? res.result : { code: -1, message: '云函数返回异常', data: null };

      // 服务端 500 可能是瞬时错误，允许重试
      if (result.code === 500 && retry && attempt < MAX_RETRIES) {
        lastResult = result;
        throw new Error(`Server 500: ${result.message}`);
      }

      if (showLoading) uni.hideLoading();
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[api] ${name} 调用失败 (第${attempt + 1}次):`, err.message);

      if (!retry || attempt >= MAX_RETRIES) {
        if (showLoading) uni.hideLoading();
        // 如果是 500 且有 lastResult，返回它（让调用方根据 code 处理）
        if (lastResult && lastResult.code === 500) {
          return lastResult;
        }
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
  const today = new Date().toISOString().slice(0, 10);

  try {
    questionCache = await callCloudFunction('getDailyQuestions', { setIndex: 0, count: 5 }, { retry: false });
    if (questionCache.code === 0) {
      questionCache._cacheDate = today;
    }
    questionCacheIndex = 5;
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
export function submitTestScore(questionSetId, answers, fromUid = '', challengeId = '') {
  return callCloudFunction('submitScore', { questionSetId, answers, fromUid, challengeId }, { showLoading: true, loadingText: 'AI正在评估...' });
}

/**
 * 获取全国段位分布
 */
export function fetchTierDistribution() {
  return callCloudFunction('getTierDistribution');
}

/**
 * 获取好友段位排名
 * @param {string} action - 'rank'(默认) | 'updatePrivacy' | 'groupRank' | 'collectRank'
 */
export function fetchFriendRank(action = 'rank', extra = {}) {
  return callCloudFunction('getFriendRank', { action, ...extra });
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
 * 更新用户头像昵称（非阻断式授权）
 */
export function updateProfile(nickname, avatar) {
  return callCloudFunction('getWeeklyStats', { action: 'updateProfile', nickname, avatar });
}

/**
 * 更新隐私设置
 */
export function updatePrivacy(privacyHidden) {
  return callCloudFunction('getFriendRank', { action: 'updatePrivacy', privacyHidden });
}

/**
 * 获取管理面板数据（K-factor、漏斗、告警）
 */
export function fetchDashboard(adminToken) {
  return callCloudFunction('getDashboardData', { adminToken });
}

/**
 * K-factor 角标（轻量模式，无需鉴权）
 */
export function fetchKFactorBadge() {
  return callCloudFunction('getDashboardData', { lite: true });
}

// 当前用户 openid 缓存
let cachedOpenid = null;

/**
 * 获取当前用户 openid（带缓存，供分享跟踪用）
 */
export async function getUserOpenid() {
  if (cachedOpenid) return cachedOpenid;
  try {
    const res = await callCloudFunction('getWeeklyStats', { action: 'getOpenid' });
    if (res.code === 0 && res.data && res.data.openid) {
      cachedOpenid = res.data.openid;
      getApp().globalData.userOpenid = cachedOpenid;
      uni.setStorageSync('user_openid', cachedOpenid);
      return cachedOpenid;
    }
  } catch (e) { /* 静默失败 */ }
  return '';
}

/**
 * 同步获取当前用户 openid（供分享回调使用，需提前通过 getUserOpenid 预加载）
 */
export function getUserOpenidSync() {
  if (cachedOpenid) return cachedOpenid;
  cachedOpenid = uni.getStorageSync('user_openid') || '';
  return cachedOpenid;
}

// ── v1.0 订阅消息 ──

/**
 * 订阅消息模板 ID 配置（需在微信公众平台申请后替换）
 * 模板在 mp-backend → 开发 → 订阅消息 中申请
 */
const SUBSCRIBE_TEMPLATE_IDS = {
  testReminder:  '', // 测试提醒：3天未测提醒
  challengeNotify: '', // 挑战通知：好友发起挑战
  checkinReminder: '', // 签到提醒：当日未签到（晚20:00）
  tierChange: '', // 段位变化：被好友超越 / 段位晋升
};

/**
 * 请求订阅消息授权
 * @param {'testReminder'|'challengeNotify'|'checkinReminder'|'tierChange'|string[]} templates - 要请求的模板 key 数组
 * @returns {Promise<Object>} - 订阅结果 { templateId: 'accept'|'reject'|'ban' }
 */
export function requestSubscribeMessage(templates = ['challengeNotify', 'tierChange']) {
  return new Promise((resolve) => {
    const keys = Array.isArray(templates) ? templates : [templates];
    const tmplIds = keys
      .map(k => SUBSCRIBE_TEMPLATE_IDS[k])
      .filter(Boolean);

    // 未配置模板 ID 时静默跳过
    if (tmplIds.length === 0) {
      resolve({});
      return;
    }

    if (typeof wx === 'undefined' || !wx.requestSubscribeMessage) {
      resolve({});
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds,
      success(res) {
        // 回写订阅状态到服务端
        const results = {};
        keys.forEach((k, i) => {
          const tid = SUBSCRIBE_TEMPLATE_IDS[k];
          if (tid) {
            results[tid] = res[tid] || 'reject';
          }
        });
        // 静默回写
        callCloudFunction('submitScore', {
          action: 'updateSubscribe',
          subscriptions: results,
        }, { retry: false }).catch(() => {});
        resolve(res);
      },
      fail(err) {
        console.warn('[api] requestSubscribeMessage 失败:', err.errMsg);
        resolve({});
      },
    });
  });
}
