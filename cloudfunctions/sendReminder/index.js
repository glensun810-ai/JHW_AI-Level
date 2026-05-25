/**
 * 进化湾 v1.0 — 定时提醒云函数
 *
 * 触发：
 *   - 每天 20:00 签到提醒（连续签到 >=3 天但今日未签到的用户）
 *   - 每天 10:00 测试提醒（3 天未测试的用户）
 *
 * 配置 config.json：
 *   { "triggers": [{ "name": "checkinReminder", "type": "timer", "config": "0 0 20 * * * *" },
 *                  { "name": "testReminder", "type": "timer", "config": "0 0 10 * * * *" }] }
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 每日发送上限（防止骚扰用户）
const MAX_DAILY_SENDS = 2000;

exports.main = async (event, context) => {
  const triggerName = event.triggerName || '';
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  console.log(`[sendReminder] trigger=${triggerName} time=${now.toISOString()}`);

  try {
    if (triggerName === 'checkinReminder') {
      return await sendCheckinReminders(today);
    }
    if (triggerName === 'testReminder') {
      return await sendTestReminders(today);
    }
    // 手动调用：同时执行两种
    const [r1, r2] = await Promise.all([
      sendCheckinReminders(today),
      sendTestReminders(today),
    ]);
    return { code: 0, message: 'ok', data: { checkin: r1.data, test: r2.data } };
  } catch (err) {
    console.error('[sendReminder] error:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};

// ── 签到提醒：连续签到 >=3 天但今日未签到 ──
async function sendCheckinReminders(today) {
  // 查询连续签到 >=3 天、未开启隐私隐藏的用户
  const { data: users } = await db.collection('users')
    .where({
      consecutiveDays: _.gte(3),
      privacyHidden: false,
    })
    .limit(MAX_DAILY_SENDS)
    .get();

  let sent = 0;
  for (const user of users) {
    // 检查用户是否订阅了 checkinReminder 模板
    const subs = user.subscribeTemplates || [];
    const checkinSub = subs.find(s => s.status === 'accept' && s.templateId);
    if (!checkinSub) continue;

    // 检查今日是否已签到
    const { data: todayCheckins } = await db.collection('check_ins')
      .where({ _openid: user._openid, date: today })
      .limit(1)
      .get();
    if (todayCheckins.length > 0) continue; // 今日已签到

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: user._openid,
        templateId: checkinSub.templateId,
        data: {
          thing1: { value: '进化湾签到提醒' },
          number2: { value: String(user.consecutiveDays) },
          thing3: { value: '你今天还没签到哦，断签会重置连续天数' },
          date4: { value: today },
        },
        page: 'pages/checkin/checkin',
      });
      sent++;
    } catch (e) {
      // 用户可能取消了订阅或模板被拒
      if (e.errCode === 43101) {
        // user refuse to accept
        await db.collection('users').where({ _openid: user._openid }).update({
          data: {
            subscribeTemplates: subs.map(s =>
              s.templateId === checkinSub.templateId ? { ...s, status: 'rejected' } : s
            ),
          },
        });
      }
    }
  }

  console.log(`[sendReminder] checkin sent=${sent}/${users.length}`);
  return { code: 0, message: 'ok', data: { sent, total: users.length } };
}

// ── 测试提醒：3 天未测试 + 流失预警（7 天未打开）──
async function sendTestReminders(today) {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // 查询有测试历史但最近 3 天未测试的用户
  const { data: users } = await db.collection('users')
    .where({
      testCount: _.gte(1),
      updatedAt: _.lt(threeDaysAgo),
      privacyHidden: false,
    })
    .limit(MAX_DAILY_SENDS)
    .get();

  let sent = 0;
  for (const user of users) {
    const subs = user.subscribeTemplates || [];
    const testSub = subs.find(s => s.status === 'accept' && s.templateId);
    if (!testSub) continue;

    const daysSince = Math.floor((Date.now() - new Date(user.updatedAt).getTime()) / 86400000);
    const isDormant = new Date(user.updatedAt) < sevenDaysAgo;

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: user._openid,
        templateId: testSub.templateId,
        data: {
          thing1: { value: isDormant ? '你已经一周没来进化湾了' : `${daysSince}天没测段位了` },
          time2: { value: new Date(user.updatedAt).toISOString().slice(0, 10) },
          thing3: { value: isDormant ? '你的AI段位可能已经发生变化，快来重新测试' : '坚持测试，追踪你的AI段位进化' },
          phrase4: { value: isDormant ? '快回来看看' : '继续进化' },
        },
        page: 'pages/index/index',
      });
      sent++;
    } catch (e) {
      if (e.errCode === 43101) {
        await db.collection('users').where({ _openid: user._openid }).update({
          data: {
            subscribeTemplates: subs.map(s =>
              s.templateId === testSub.templateId ? { ...s, status: 'rejected' } : s
            ),
          },
        });
      }
    }
  }

  console.log(`[sendReminder] test sent=${sent}/${users.length}`);
  return { code: 0, message: 'ok', data: { sent, total: users.length } };
}
