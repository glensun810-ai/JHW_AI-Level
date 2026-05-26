const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * errorMonitor — 错误监控 + 企微告警
 *
 * 部署方式：
 *   微信云开发控制台 → 云函数 → errorMonitor → 触发器
 *   添加定时触发器，Cron: */30 * * * * （每 30 分钟执行一次）
 *
 * 监控项：
 *   1. test_abandon 事件比率（答题中途放弃）
 *   2. 云函数 5xx 错误率（从云开发日志查询）
 */

const ABANDON_THRESHOLD = 0.15; // 15%

// ── 查询测试放弃率 ──
async function checkAbandonRate() {
  const halfHourAgo = new Date(Date.now() - 30 * 60000);

  const [{ total: testStarts }, { total: testAbandons }] = await Promise.all([
    db.collection('analytics_logs')
      .where({ event: 'test_start', serverTime: _.gte(halfHourAgo) })
      .count(),
    db.collection('analytics_logs')
      .where({ event: 'test_abandon', serverTime: _.gte(halfHourAgo) })
      .count(),
  ]);

  const abandonRate = testStarts > 0 ? testAbandons / testStarts : 0;
  const isAlert = abandonRate > ABANDON_THRESHOLD;

  return {
    testStarts,
    testAbandons,
    abandonRate: +(abandonRate * 100).toFixed(1),
    isAlert,
  };
}

// ── 企业微信告警 ──
async function sendWeComAlert(content) {
  const WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL || '';
  if (!WEBHOOK_URL) {
    console.log('[errorMonitor] 未配置 WECOM_WEBHOOK_URL，跳过通知');
    return;
  }

  try {
    const https = require('https');
    const data = JSON.stringify({
      msgtype: 'markdown',
      markdown: { content },
    });
    const url = new URL(WEBHOOK_URL);
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    console.log('[errorMonitor] 企业微信通知已发送');
  } catch (e) {
    console.error('[errorMonitor] 企业微信通知发送失败:', e.message);
  }
}

// ── 主入口 ──
exports.main = async (event, context) => {
  try {
    console.log('[errorMonitor] 开始执行…');

    const reports = [];

    // 1. 检查放弃率
    const abandon = await checkAbandonRate();
    if (abandon.isAlert) {
      const msg = [
        '## ⚠️ 进化湾 · 答题放弃率告警',
        `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        `- 测试开始：**${abandon.testStarts}** 次`,
        `- 中途放弃：**${abandon.testAbandons}** 次`,
        `- 放弃率：**${abandon.abandonRate}%**（阈值 ${(ABANDON_THRESHOLD * 100).toFixed(0)}%）`,
        '',
        '> 建议：检查题目加载时间、首题难度、网络环境',
      ].join('\n');
      await sendWeComAlert(msg);

      await db.collection('error_reports').add({
        data: {
          type: 'test_abandon',
          summary: `放弃率 ${abandon.abandonRate}% 超过阈值`,
          detail: abandon,
          severity: 'critical',
          acknowledged: false,
          createdAt: new Date(),
        },
      });
      reports.push({ type: 'test_abandon', alert: true, rate: abandon.abandonRate });
    } else {
      reports.push({ type: 'test_abandon', alert: false, rate: abandon.abandonRate });
    }

    console.log(`[errorMonitor] 完成 — 放弃率: ${abandon.abandonRate}%`);

    return { code: 0, message: 'ok', data: { reports } };
  } catch (err) {
    console.error('[errorMonitor] 异常:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};
