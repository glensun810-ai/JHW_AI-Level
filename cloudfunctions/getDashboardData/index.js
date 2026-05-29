const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * getDashboardData — 管理面板数据聚合
 * 从 monitor_results 读取 K-factor、漏斗、告警快照，计算趋势 delta
 */

// ── 时间段辅助 ──
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000);
}

function daysAgo(d) {
  return new Date(Date.now() - d * 86400000);
}

// ── 从 monitor_results 取最新快照 ──
async function getLatestSnapshot() {
  const { data } = await db.collection('monitor_results')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return data[0] || null;
}

// ── 从 monitor_results 取时间段内的快照列表 ──
async function getSnapshotsInRange(start, end) {
  const { data } = await db.collection('monitor_results')
    .where({ createdAt: _.gte(start).and(_.lte(end)) })
    .orderBy('createdAt', 'asc')
    .get();
  return data;
}

// ── 计算指标趋势 ──
function computeTrend(current, previousList) {
  if (!previousList.length || !current) return { delta: 0, direction: 'flat' };
  const prevAvg = previousList.reduce((sum, s) => {
    const m = s.metrics || {};
    for (const [k, v] of Object.entries(m)) {
      sum[k] = (sum[k] || 0) + v.value;
    }
    return sum;
  }, {});
  const prevCount = previousList.length;
  const trends = {};
  for (const [key, m] of Object.entries(current.metrics || {})) {
    const prevVal = prevAvg[key] ? prevAvg[key] / prevCount : m.value;
    const delta = +(m.value - prevVal).toFixed(2);
    let direction = 'flat';
    if (delta > 0.01) direction = 'up';
    else if (delta < -0.01) direction = 'down';
    trends[key] = { current: m.value, previous: +prevVal.toFixed(2), delta, direction };
  }
  return trends;
}

// ── DAU 统计 ──
async function computeDAU() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const [{ total: dauToday }, { total: dauYesterday }] = await Promise.all([
    db.collection('analytics_logs')
      .where({ event: 'page_view_home', serverTime: _.gte(todayStart) })
      .count(),
    db.collection('analytics_logs')
      .where({
        event: 'page_view_home',
        serverTime: _.gte(yesterdayStart).and(_.lt(todayStart)),
      })
      .count(),
  ]);

  const newUserToday = await db.collection('users')
    .where({ createdAt: _.gte(todayStart) })
    .count();

  const returningToday = await db.collection('users')
    .where({ createdAt: _.lt(todayStart), updatedAt: _.gte(todayStart) })
    .count();

  return {
    dau: dauToday,
    dauYesterday,
    newUsers: newUserToday.total,
    returningUsers: returningToday.total,
  };
}

// ── A/B 变体转化对比 ──
async function computeABComparison() {
  const weekAgo = daysAgo(7);
  const { data: logs } = await db.collection('analytics_logs')
    .where({
      event: _.in(['test_complete', 'share_success', 'page_view_home']),
      serverTime: _.gte(weekAgo),
    })
    .field({ event: true, 'params.ab_variant': true })
    .limit(2000)
    .get();

  const variants = {};
  for (const log of logs) {
    const v = (log.params && log.params.ab_variant) || 'unknown';
    if (!variants[v]) variants[v] = { home: 0, complete: 0, share: 0 };
    if (log.event === 'page_view_home') variants[v].home++;
    if (log.event === 'test_complete') variants[v].complete++;
    if (log.event === 'share_success') variants[v].share++;
  }

  const result = {};
  for (const [v, counts] of Object.entries(variants)) {
    result[v] = {
      homeViews: counts.home,
      completions: counts.complete,
      shares: counts.share,
      completionRate: counts.home > 0 ? Math.round((counts.complete / counts.home) * 100) : 0,
      shareRate: counts.complete > 0 ? Math.round((counts.share / counts.complete) * 100) : 0,
    };
  }
  return result;
}

// ── 实时 K-factor 计算（不依赖 monitor_results cron）──
async function computeRealtimeKFactor() {
  const weekAgo = daysAgo(7);

  // 1. 分享率 = share_success / test_complete
  const [{ total: testComplete7d }, { total: shareSuccess7d }, { total: shareCardClick7d }] = await Promise.all([
    db.collection('analytics_logs').where({ event: 'test_complete', serverTime: _.gte(weekAgo) }).count(),
    db.collection('analytics_logs').where({ event: 'share_success', serverTime: _.gte(weekAgo) }).count(),
    db.collection('analytics_logs').where({ event: 'share_card_click', serverTime: _.gte(weekAgo) }).count(),
  ]);

  // 2. 转化率 = 通过分享进入并完成测试 / 分享卡点击
  const { data: fromShareLogs } = await db.collection('analytics_logs')
    .where({ event: 'test_complete', 'params.from_uid': _.exists(true), serverTime: _.gte(weekAgo) })
    .field({ 'params.from_uid': true })
    .limit(500)
    .get();
  const fromShareComplete = fromShareLogs.length;

  const shareRate = testComplete7d > 0 ? shareSuccess7d / testComplete7d : 0;
  const clickRate = shareSuccess7d > 0 ? shareCardClick7d / shareSuccess7d : 0;
  const conversionRate = shareCardClick7d > 0 ? fromShareComplete / shareCardClick7d : 0;
  const avgInvitees = shareSuccess7d > 0 ? shareCardClick7d / shareSuccess7d : 0;
  const kFactor = +(shareRate * avgInvitees * clickRate * conversionRate).toFixed(4);

  // 3. 总用户数 & 周增长
  const [{ total: totalUsers }, { total: newUsers7d }, { total: activeUsers7d }] = await Promise.all([
    db.collection('users').count(),
    db.collection('users').where({ createdAt: _.gte(weekAgo) }).count(),
    db.collection('analytics_logs').where({ event: 'page_view_home', serverTime: _.gte(weekAgo) }).count(),
  ]);

  return {
    kFactor,
    shareRate: +(shareRate * 100).toFixed(1),
    clickRate: +(clickRate * 100).toFixed(1),
    conversionRate: +(conversionRate * 100).toFixed(1),
    avgInvitees: +(avgInvitees).toFixed(1),
    totalUsers,
    newUsers7d: newUsers7d.total,
    activeUsers7d: activeUsers7d.total,
    period: '7d',
  };
}

// ── 管理员鉴权 ──
function checkAdminAuth(event) {
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) return 'full'; // 未配置密码时允许完整访问（兼容旧行为）
  if (event.adminToken === password) return 'full';
  if (event.lite) return 'lite'; // K-factor 角标等轻量数据
  return 'denied';
}

// ── 主入口 ──
exports.main = async (event, context) => {
  const authResult = checkAdminAuth(event);
  if (authResult === 'denied') {
    return { code: 403, message: '无权限访问', data: null };
  }

  try {
    const latest = await getLatestSnapshot();

    // Lite 模式：仅返回实时 K-factor（供 rank 页角标使用）
    if (authResult === 'lite') {
      const rt = await computeRealtimeKFactor();
      return {
        code: 0,
        message: 'ok',
        data: {
          kFactor: { current: rt.kFactor },
          shareRate: rt.shareRate,
          totalUsers: rt.totalUsers,
          lite: true,
        },
      };
    }

    const [snapshots24h, snapshots7d, snapshots30d, dauData, abComparison, realtimeKF] = await Promise.all([
      getSnapshotsInRange(hoursAgo(24), new Date()),
      getSnapshotsInRange(daysAgo(7), new Date()),
      getSnapshotsInRange(daysAgo(30), new Date()),
      computeDAU(),
      computeABComparison(),
      computeRealtimeKFactor(),
    ]);

    // 前一时间段快照（用于趋势对比）
    const snapshotsPrev24h = await getSnapshotsInRange(hoursAgo(48), hoursAgo(24));
    const snapshotsPrev7d = await getSnapshotsInRange(daysAgo(14), daysAgo(7));

    const trends24h = computeTrend(latest, snapshotsPrev24h);
    const trends7d = computeTrend(latest, snapshotsPrev7d);

    // 提取 K-factor
    const kFactor = latest
      ? (latest.metrics && latest.metrics.viral_coef ? latest.metrics.viral_coef.value : 0)
      : 0;

    // 漏斗数据
    const funnel = latest && latest.metrics ? {
      cardCtr: latest.metrics.card_ctr ? latest.metrics.card_ctr.value : 0,
      homeToStart: latest.metrics.home_to_start ? latest.metrics.home_to_start.value : 0,
      completionRate: latest.metrics.completion_rate ? latest.metrics.completion_rate.value : 0,
      shareRate: latest.metrics.share_rate ? latest.metrics.share_rate.value : 0,
      viralCoef: kFactor,
    } : null;

    // 告警状态
    const alerts = latest && latest.report ? {
      overall: latest.report.overall,
      reds: latest.report.reds || [],
      yellows: latest.report.yellows || [],
    } : { overall: 'unknown', reds: [], yellows: [] };

    return {
      code: 0,
      message: 'ok',
      data: {
        kFactor: {
          current: kFactor,
          trend24h: trends24h.viral_coef || { delta: 0, direction: 'flat' },
          trend7d: trends7d.viral_coef || { delta: 0, direction: 'flat' },
        },
        realtimeKF,
        funnel,
        alerts,
        dau: dauData,
        abComparison,
        updatedAt: latest ? latest.createdAt : null,
        snapshotCount24h: snapshots24h.length,
        snapshotCount7d: snapshots7d.length,
        snapshotCount30d: snapshots30d.length,
      },
    };
  } catch (err) {
    console.error('[getDashboardData] 异常:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};
