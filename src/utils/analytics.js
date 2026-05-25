/**
 * 埋点工具 — v0.6
 *
 * 18 个核心事件，覆盖完整用户旅程：
 *   分享卡片 → 首页 → 开始测试 → 答题 → 结果 → 分享 → 排行榜 → 签到
 *
 * 上报策略：
 *   - 实时：关键事件通过 callCloudFunction 实时上报
 *   - 批量：非关键事件队列暂存，页面卸载或满 10 条时批量刷新
 *   - 降级：云函数不可用时写入 storage，下次触发时重试
 */

import { callCloudFunction } from './api.js';

const PREFIX = '[analytics]';
const FLUSH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30s 兜底刷新
const RETRY_KEY = 'analytics_retry_queue';

// ── 事件队列 ──
let eventQueue = [];
let flushTimer = null;
let sessionId = '';

function getSessionId() {
  if (!sessionId) {
    sessionId = uni.getStorageSync('analytics_sid');
    if (!sessionId) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      uni.setStorageSync('analytics_sid', sessionId);
    }
  }
  return sessionId;
}

// ── 获取当前页面路径 ──
function getCurrentPage() {
  try {
    const pages = getCurrentPages();
    return pages.length > 0 ? pages[pages.length - 1].route : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

// ── 刷新队列 ──
async function flush() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0);
  clearTimeout(flushTimer);
  flushTimer = null;

  try {
    await callCloudFunction('analyticsLog', {
      action: 'batch',
      events: batch,
    });
  } catch (e) {
    // 降级：写回队列（最多保留 50 条）
    const retry = (uni.getStorageSync(RETRY_KEY) || []).concat(batch).slice(-50);
    uni.setStorageSync(RETRY_KEY, retry);
  }
}

// ── 重试历史失败 ──
function drainRetry() {
  const retry = uni.getStorageSync(RETRY_KEY);
  if (!retry || retry.length === 0) return;
  uni.removeStorageSync(RETRY_KEY);
  eventQueue = retry.concat(eventQueue);
  if (eventQueue.length >= FLUSH_SIZE) flush();
  else scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL);
}

// ── 核心 track 函数 ──
function track(event, params = {}) {
  const payload = {
    event,
    params,
    timestamp: Date.now(),
    session: getSessionId(),
    page: getCurrentPage(),
  };

  // #ifdef DEV
  console.log(PREFIX, event, payload);
  // #endif

  // 关键事件实时上报，其他事件批量上报
  const criticalEvents = [
    'share_card_click', 'test_complete', 'reversal_end',
    'share_success', 'check_in_click', 'test_retry',
  ];

  eventQueue.push(payload);

  if (criticalEvents.includes(event)) {
    // 实时：立即把当前队列（含这条）一起刷掉
    flush();
  } else if (eventQueue.length >= FLUSH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

// ── 页面卸载时刷新 ──
export function flushAnalytics() {
  if (eventQueue.length > 0) flush();
}

// ═══════════════════════════════════════
// 18 个事件定义（按用户旅程顺序）
// ═══════════════════════════════════════

/** 1. 分享卡片被点击 */
export function trackShareCardClick(params = {}) {
  track('share_card_click', {
    from_uid: params.from_uid || '',
    share_channel: params.share_channel || 'unknown',
  });
}

/** 2. 进入首页 */
export function trackPageViewHome(params = {}) {
  track('page_view_home', {
    source: params.source || 'direct',
    from_uid: params.from_uid || '',
    load_time: params.load_time || 0,
  });
}

/** 3. 首页停留 >5s */
export function trackHomeHesitate(duration) {
  track('home_hesitate', { stay_duration: Math.round(duration) });
}

/** 4. 点击开始测试 */
export function trackTestStart(userType = 'new', ctaCopy = '') {
  track('test_start', { user_type: userType, cta_copy: ctaCopy, cta_variant: getShareVariant() });
}

/** 5. 每题作答 */
export function trackQuestionAnswer(qId, answer, score, timeSpent) {
  track('question_answer', {
    q_id: qId,
    answer,
    score,
    time_spent: Math.round(timeSpent),
  });
}

/** 6. 答题中途退出 */
export function trackTestAbandon(currentQ, answeredCount, timeSpent) {
  track('test_abandon', {
    current_q: currentQ,
    answered_count: answeredCount,
    time_spent: Math.round(timeSpent),
  });
}

/** 7. 完成全部答题 */
export function trackTestComplete(totalTime, answers) {
  track('test_complete', {
    total_time: Math.round(totalTime),
    answers: answers.map(a => ({ qId: a.questionId, idx: a.selectedIndex })),
  });
}

/** 8. 反转动画开始 */
export function trackReversalStart(fakeTier, realTier) {
  track('reversal_start', { fake_tier: fakeTier, real_tier: realTier });
}

/** 9. 反转动画结束 */
export function trackReversalEnd(realTier) {
  track('reversal_end', { real_tier: realTier });
}

/** 10. 看到结果页 */
export function trackResultView(tierName, tierLevel, isFirstTime) {
  track('result_view', {
    tier_level: tierLevel,
    tier_name: tierName,
    is_first_time: isFirstTime,
  });
}

/** 11. 结果页停留 >10s */
export function trackResultLinger(duration, tierLevel) {
  track('result_linger', {
    duration: Math.round(duration),
    tier_level: tierLevel,
  });
}

/** 12. 点击分享按钮 */
export function trackShareClick(tierName, shareTarget) {
  track('share_click', {
    tier_level: tierName,
    share_target: shareTarget,
    variant: getShareVariant(),
  });
}

/** 13. 完成分享 */
export function trackShareSuccess(tierName, shareChannel, shareCopyStyle = '') {
  track('share_success', {
    tier_level: tierName,
    share_channel: shareChannel,
    share_copy_style: shareCopyStyle,
    variant: getShareVariant(),
  });
}

/** 14. 查看排行榜 */
export function trackRankingView(rankingType) {
  track('ranking_view', { ranking_type: rankingType });
}

/** 15. 点击签到 */
export function trackCheckIn(consecutiveDays) {
  track('check_in_click', { consecutive_days: consecutiveDays });
}

/** 16. 再次测试 */
export function trackTestRetry(prevTier, timeSinceLast, unlockMethod = 'free') {
  track('test_retry', {
    prev_tier: prevTier,
    time_since_last: Math.round(timeSinceLast),
    unlock_method: unlockMethod,
  });
}

/** 17. 快速反馈 */
export function trackQuickFeedback(isAccurate, tierLevel) {
  track('quick_feedback', {
    is_accurate: isAccurate,
    tier_level: tierLevel,
  });
}

/** 18. 邀请解锁点击 */
export function trackInviteUnlock(remainingFreeTests) {
  track('invite_unlock_click', { remaining_free_tests: remainingFreeTests });
}

// ── 辅助事件（非核心漏斗，但被多页面使用）──

/** 通用页面浏览 */
export function trackPageView(page, extra = {}) {
  track('page_view', { page, ...extra });
}

/** 挑战好友 */
export function trackChallenge(targetUid) {
  track('challenge_friend', { target_uid: targetUid });
}

// ═══════════════════════════════════════
// v1.0 新增：邀请漏斗 + A/B 分流
// ═══════════════════════════════════════

/** 19. 邀请发起（分享时触发） */
export function trackInviteSent(shareChannel = 'private') {
  track('invite_sent', { share_channel: shareChannel, variant: getShareVariant() });
}

/** 20. 邀请点击（被邀请人打开小程序） */
export function trackInviteClick(inviterUid, shareChannel = 'private') {
  track('invite_click', { inviter_uid: inviterUid, share_channel: shareChannel });
}

/** 21. 邀请转化（被邀请人完成测试） */
export function trackInviteConversion(inviterUid, inviteeTier) {
  track('invite_conversion', { inviter_uid: inviterUid, invitee_tier: inviteeTier });
}

// A/B 分流：根据用户 openid hash 确定性分流
function getShareVariant() {
  try {
    const uid = uni.getStorageSync('analytics_sid') || '';
    const hash = uid.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return hash % 2 === 0 ? 'A' : 'B';
  } catch (e) {
    return 'A';
  }
}

/** 获取 A/B variant（供页面使用） */
export function getABVariant() {
  return getShareVariant();
}

// ═══════════════════════════════════════
// 初始化：加载重试队列 + 监听页面卸载
// ═══════════════════════════════════════
export function initAnalytics() {
  drainRetry();
  // 监听 app 隐藏时刷新
  if (typeof uni !== 'undefined') {
    uni.onAppHide?.(() => {
      if (eventQueue.length > 0) flush();
    });
  }
}

export default {
  track,
  flush: flushAnalytics,
  init: initAnalytics,
  trackShareCardClick,
  trackPageViewHome,
  trackHomeHesitate,
  trackTestStart,
  trackQuestionAnswer,
  trackTestAbandon,
  trackTestComplete,
  trackReversalStart,
  trackReversalEnd,
  trackResultView,
  trackResultLinger,
  trackShareClick,
  trackShareSuccess,
  trackRankingView,
  trackCheckIn,
  trackTestRetry,
  trackQuickFeedback,
  trackInviteUnlock,
  trackPageView,
  trackChallenge,
  trackInviteSent,
  trackInviteClick,
  trackInviteConversion,
  getABVariant,
};
