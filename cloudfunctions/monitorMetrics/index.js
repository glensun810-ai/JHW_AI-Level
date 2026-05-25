const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * monitorMetrics — 数据预警定时任务
 *
 * 部署方式：
 *   微信云开发控制台 → 云函数 → monitorMetrics → 触发器
 *   添加定时触发器，Cron: 0 * * * * （每小时执行一次）
 *
 * 监控 9 项核心指标，绿/黄/红三级阈值。
 * 任一红色指标 → 企业微信通知（通过 Webhook）
 * 汇总结果写入 monitor_results 集合供 Dashboard 查询。
 */

// ═══════════════════════════════════════
// 指标阈值配置
// ═══════════════════════════════════════
const METRICS = {
  card_ctr: {
    name: '卡片点击率',
    green: 80,    // >= 80% 绿
    yellow: 60,   // >= 60% 黄，< 60% 红
    red: 0,
    unit: '%',
    weight: 'critical',
    help: '分享卡片曝光 → 点击进入小程序的比率',
  },
  home_to_start: {
    name: '首页→测试转化率',
    green: 90,
    yellow: 70,
    red: 0,
    unit: '%',
    weight: 'critical',
    help: '首页浏览 → 点击开始测试的比率',
  },
  completion_rate: {
    name: '答题完成率',
    green: 85,
    yellow: 60,
    red: 0,
    unit: '%',
    weight: 'critical',
    help: '开始测试 → 完成全部5题的比率',
  },
  share_rate: {
    name: '分享率',
    green: 60,
    yellow: 35,
    red: 0,
    unit: '%',
    weight: 'critical',
    help: '看到结果 → 完成分享的比率',
  },
  viral_coef: {
    name: '病毒系数 K',
    green: 1.5,
    yellow: 0.8,
    red: 0,
    unit: '',
    weight: 'critical',
    help: '每用户平均带来新用户数，K>1 病毒增长',
  },
  day7_retention: {
    name: '7日留存率',
    green: 35,
    yellow: 20,
    red: 0,
    unit: '%',
    weight: 'important',
    help: '首次使用后第7天仍活跃的用户占比',
  },
  nps: {
    name: '净推荐值 (NPS)',
    green: 50,
    yellow: 30,
    red: 0,
    unit: '',
    weight: 'important',
    help: 'quick_feedback 中 👍 占比 × 100 - 50',
  },
  tier_distribution: {
    name: '段位分布健康度',
    green: 'normal',
    yellow: 'skewed',
    red: 'extreme',
    unit: '',
    weight: 'important',
    help: '最高段位(无界)占比 >15% 为极度偏斜',
  },
  toolman_share: {
    name: '「工具人」段位分享率',
    green: 'above_avg',
    yellow: '0.7x_avg',
    red: 'below_0.7x',
    unit: '',
    weight: 'watch',
    help: '工具人段位用户的分享率 vs 全体平均',
  },
};

// ═══════════════════════════════════════
// 应急动作建议（红色指标 → 推送建议）
// ═══════════════════════════════════════
const RED_ACTIONS = {
  card_ctr: '① A/B 测试 3 套不同标题+封面（48h出结果）\n② 检查不同机型渲染效果',
  home_to_start: '① 优化首页 CTA 按钮文案和动效\n② 缩短首页加载时间\n③ 增加紧迫感元素',
  completion_rate: '① 缩短选题/作答间隔\n② 增加答题过程中的正反馈\n③ 排查中途断点恢复体验',
  share_rate: '① 紧急重构结果页情感触发\n② 增强 AI 锐评毒舌程度\n③ 增加分享奖励（如额外测试次数）',
  viral_coef: '① 检查挑战完成率\n② 增强好友变动通知\n③ 启动 Plan B 渠道',
  day7_retention: '① 加速题库更新频率\n② 强化签到打卡奖励\n③ 增加推送触达（订阅消息）',
  nps: '① 检查 AI 锐评是否引发反感\n② 调研用户不满意的原因\n③ 优化题目质量',
  tier_distribution: '① 检查题目难度是否过低\n② 调整 scores 权重分布',
  toolman_share: '① 为「工具人」段位定制专属分享文案\n② 增加该段位的自嘲风格分享比例',
};

// ── 时间段（过去 1 小时） ──
function getTimeRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 3600000);
  return { start, end: now };
}

// ── 汇总查询（事件计数） ──
async function countEvent(eventName, extra = {}) {
  const { start, end } = getTimeRange();
  const where = {
    event: eventName,
    serverTime: _.gte(start).and(_.lte(end)),
    ...extra,
  };
  const { total } = await db.collection('analytics_logs')
    .where(where)
    .count();
  return total;
}

// ── 计算指标 ──
async function computeMetrics() {
  const results = {};

  // 1. card_ctr: share_card_click / share_card_impression（impression 暂用 page_view_home from_uid 不为空近似）
  const cardClicks = await countEvent('share_card_click');
  const homeFromShare = await countEvent('page_view_home', { 'params.from_uid': _.neq('') });
  const cardCtr = homeFromShare > 0 ? Math.round((cardClicks / homeFromShare) * 100) : 100;
  results.card_ctr = { value: cardCtr, ...METRICS.card_ctr };

  // 2. home_to_start: test_start / page_view_home
  const homeViews = await countEvent('page_view_home');
  const testStarts = await countEvent('test_start');
  const homeToStart = homeViews > 0 ? Math.round((testStarts / homeViews) * 100) : 0;
  results.home_to_start = { value: homeToStart, ...METRICS.home_to_start };

  // 3. completion_rate: test_complete / test_start
  const testCompletes = await countEvent('test_complete');
  const completionRate = testStarts > 0 ? Math.round((testCompletes / testStarts) * 100) : 0;
  results.completion_rate = { value: completionRate, ...METRICS.completion_rate };

  // 4. share_rate: share_success / result_view
  const resultViews = await countEvent('result_view');
  const shareSuccesses = await countEvent('share_success');
  const shareRate = resultViews > 0 ? Math.round((shareSuccesses / resultViews) * 100) : 0;
  results.share_rate = { value: shareRate, ...METRICS.share_rate };

  // 5. viral_coef: page_view_home(from_uid != '') / total page_view_home （近似计算）
  const totalHomeViews = homeViews || 1;
  const viralCoef = +(homeFromShare / totalHomeViews).toFixed(2);
  results.viral_coef = { value: viralCoef, ...METRICS.viral_coef };

  // 6. day7_retention: 从 users 表查询（暂时用 check_in 事件近似）
  const { start } = getTimeRange();
  const sevenDaysAgo = new Date(start.getTime() - 6 * 86400000);
  const { total: createdBefore7d } = await db.collection('users')
    .where({ createdAt: _.lte(sevenDaysAgo), highestScore: _.gt(0) })
    .count();
  let day7Retention = 0;
  if (createdBefore7d > 0) {
    // 过去1小时内签到且注册>7天的用户
    const checkIns = await countEvent('check_in_click');
    day7Retention = Math.round((checkIns / createdBefore7d) * 100);
  }
  results.day7_retention = { value: day7Retention, ...METRICS.day7_retention };

  // 7. nps: (👍数 / 总反馈数) × 100 - 50
  const { start: hStart, end: hEnd } = getTimeRange();
  const { total: accurateCount } = await db.collection('analytics_logs')
    .where({
      event: 'quick_feedback',
      'params.is_accurate': true,
      serverTime: _.gte(hStart).and(_.lte(hEnd)),
    })
    .count();
  const { total: totalFeedback } = await db.collection('analytics_logs')
    .where({
      event: 'quick_feedback',
      serverTime: _.gte(hStart).and(_.lte(hEnd)),
    })
    .count();
  const nps = totalFeedback > 0 ? Math.round((accurateCount / totalFeedback) * 100 - 50) : 0;
  results.nps = { value: nps, ...METRICS.nps };

  // 8. tier_distribution: 从 users 表查段位分布
  const { data: tierData } = await db.collection('users')
    .where({ highestScore: _.gt(0) })
    .field({ currentTier: true })
    .limit(1000)
    .get();
  const tierCounts = {};
  tierData.forEach(u => {
    tierCounts[u.currentTier] = (tierCounts[u.currentTier] || 0) + 1;
  });
  const totalUsers = tierData.length || 1;
  const wujieRatio = (tierCounts['无界'] || 0) / totalUsers;
  let tierDistributionStatus = 'normal';
  if (wujieRatio > 0.15) tierDistributionStatus = 'extreme';
  else if (wujieRatio > 0.08) tierDistributionStatus = 'skewed';
  results.tier_distribution = {
    value: tierDistributionStatus,
    detail: `无界占比 ${(wujieRatio * 100).toFixed(1)}%`,
    ...METRICS.tier_distribution,
  };

  // 9. toolman_share: 工具人段位分享率 vs 全体平均
  const toolmanShareCount = await countEvent('share_success', { 'params.tier_level': '工具人' });
  const toolmanResultViews = await countEvent('result_view', { 'params.tier_name': '工具人' });
  const toolmanShareRate = toolmanResultViews > 0 ? toolmanShareCount / toolmanResultViews : 0;
  const avgShareRate = shareRate / 100;
  let toolmanShareStatus = 'above_avg';
  if (avgShareRate > 0) {
    const ratio = toolmanShareRate / avgShareRate;
    if (ratio < 0.7) toolmanShareStatus = 'below_0.7x';
    else if (ratio < 1.0) toolmanShareStatus = '0.7x_avg';
  }
  results.toolman_share = {
    value: toolmanShareStatus,
    detail: `工具人分享率 ${(toolmanShareRate * 100).toFixed(1)}% vs 平均 ${shareRate}%`,
    ...METRICS.toolman_share,
  };

  return results;
}

// ── 评估状态 ──
function evaluate(allMetrics) {
  const reds = [];
  const yellows = [];
  const greens = [];

  for (const [key, m] of Object.entries(allMetrics)) {
    const status = getStatus(m);
    const entry = { key, name: m.name, value: m.value, detail: m.detail || '', weight: m.weight };
    if (status === 'red') reds.push(entry);
    else if (status === 'yellow') yellows.push(entry);
    else greens.push(entry);
  }

  return { reds, yellows, greens, timestamp: new Date(), overall: reds.length > 0 ? 'red' : yellows.length > 0 ? 'yellow' : 'green' };
}

function getStatus(metric) {
  const v = metric.value;
  if (typeof v === 'string') {
    // 字符串类指标
    if (v === 'extreme' || v === 'below_0.7x') return 'red';
    if (v === 'skewed' || v === '0.7x_avg') return 'yellow';
    return 'green';
  }
  // 数值类指标
  if (v >= metric.green) return 'green';
  if (v >= metric.yellow) return 'yellow';
  return 'red';
}

// ── 企业微信通知（Webhook 机器人） ──
async function sendWeComAlert(reds, yellows, overall) {
  // TODO: 替换为实际的企业微信机器人 Webhook URL
  const WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL || '';
  if (!WEBHOOK_URL) {
    console.log('[monitorMetrics] 未配置 WECOM_WEBHOOK_URL，跳过通知');
    return;
  }

  const lines = [
    `## 🚨 进化湾数据预警 — ${overall === 'red' ? '🔴 红色警报' : overall === 'yellow' ? '🟡 黄色预警' : '🟢 正常'}`,
    `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    '',
  ];

  if (reds.length > 0) {
    lines.push('### 🔴 红色指标');
    reds.forEach(r => {
      lines.push(`- **${r.name}**：${r.value}${r.detail ? ' (' + r.detail + ')' : ''}`);
      if (RED_ACTIONS[r.key]) {
        lines.push(`  > 应急动作：${RED_ACTIONS[r.key].replace(/\n/g, '\n  > ')}`);
      }
    });
  }

  if (yellows.length > 0) {
    lines.push('');
    lines.push('### 🟡 黄色指标');
    yellows.forEach(r => {
      lines.push(`- **${r.name}**：${r.value}${r.detail ? ' (' + r.detail + ')' : ''}`);
    });
  }

  try {
    const https = require('https');
    const data = JSON.stringify({
      msgtype: 'markdown',
      markdown: { content: lines.join('\n') },
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
    console.log('[monitorMetrics] 企业微信通知已发送');
  } catch (e) {
    console.error('[monitorMetrics] 企业微信通知发送失败:', e.message);
  }
}

// ═══════════════════════════════════════
// 主入口
// ═══════════════════════════════════════
exports.main = async (event, context) => {
  try {
    console.log('[monitorMetrics] 开始执行定时监控…');

    const allMetrics = await computeMetrics();
    const report = evaluate(allMetrics);

    // 写入监控结果
    await db.collection('monitor_results').add({
      data: {
        metrics: allMetrics,
        report: {
          reds: report.reds,
          yellows: report.yellows,
          greens: report.greens,
          overall: report.overall,
        },
        createdAt: new Date(),
      },
    });

    // 红色/黄色 → 推送通知
    if (report.overall !== 'green') {
      await sendWeComAlert(report.reds, report.yellows, report.overall);
    }

    console.log(`[monitorMetrics] 完成 — 状态: ${report.overall}，红色: ${report.reds.length}，黄色: ${report.yellows.length}`);

    return {
      code: 0,
      message: 'ok',
      data: {
        overall: report.overall,
        redCount: report.reds.length,
        yellowCount: report.yellows.length,
        timestamp: report.timestamp,
      },
    };
  } catch (err) {
    console.error('[monitorMetrics] 异常:', err.message, err.stack);
    return { code: 500, message: err.message, data: null };
  }
};

// 导出供测试
exports.METRICS = METRICS;
exports.RED_ACTIONS = RED_ACTIONS;
