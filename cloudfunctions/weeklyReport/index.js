/**
 * 进化湾 v1.0 — 周报推送云函数
 *
 * 每周一 10:00 向订阅用户推送 AI 进化周报
 * config.json:
 *   { "triggers": [{ "name": "weeklyReport", "type": "timer", "config": "0 0 10 * * 1 *" }] }
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TIERS = [
  { name: '萌新' }, { name: '调戏师' }, { name: '工具人' }, { name: '协作者' },
  { name: '驾驭者' }, { name: '炼金术士' }, { name: '觉醒者' }, { name: '无界' },
];

const MAX_WEEKLY_SENDS = 1000;

exports.main = async (event, context) => {
  console.log('[weeklyReport] start');

  try {
    // 查询本周有活动的用户（最近 7 天有更新）+ 订阅了模板
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const { data: users } = await db.collection('users')
      .where({
        updatedAt: _.gte(weekAgo),
      })
      .limit(MAX_WEEKLY_SENDS)
      .get();

    let sent = 0;
    for (const user of users) {
      const subs = user.subscribeTemplates || [];
      const activeSub = subs.find(s => s.status === 'accept' && s.templateId);
      if (!activeSub) continue;

      // 统计本周测试记录
      const { data: records } = await db.collection('test_records')
        .where({ _openid: user._openid, createdAt: _.gte(weekAgo) })
        .get();

      const weeklyTests = records.length;
      if (weeklyTests === 0) continue;

      // 收集的知识卡数量
      const cardCount = (user.collectedCards || []).length;

      // 好友排名
      let friendRankText = '?';
      try {
        const { data: friendships } = await db.collection('friendships')
          .where(_.or([{ userA: user._openid }, { userB: user._openid }]))
          .get();

        const friendIds = friendships.map(f =>
          f.userA === user._openid ? f.userB : f.userA
        );

        if (friendIds.length > 0) {
          const { data: friendUsers } = await db.collection('users')
            .where({ _openid: _.in(friendIds) })
            .field({ highestScore: true })
            .get();

          const sorted = [user, ...friendUsers].sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));
          const myRank = sorted.findIndex(u => u._openid === user._openid) + 1;
          friendRankText = `第 ${myRank} 名（共 ${sorted.length} 位好友）`;
        }
      } catch (e) { /* 静默 */ }

      // 稀有/传说卡统计
      const rareCount = 0; // cards-data 不在云端，留待后续优化
      const legendCount = 0;

      try {
        await cloud.openapi.subscribeMessage.send({
          touser: user._openid,
          templateId: activeSub.templateId,
          data: {
            thing1: { value: `进化湾 AI 周报` },
            number2: { value: String(weeklyTests) },
            thing3: { value: `${(user.collectedCards || []).length} 颗（稀有${rareCount} 传说${legendCount}）` },
            thing4: { value: friendRankText },
            thing5: { value: user.currentTier || '未知' },
          },
          page: 'pages/index/index',
        });
        sent++;
      } catch (e) {
        if (e.errCode === 43101) {
          await db.collection('users').where({ _openid: user._openid }).update({
            data: {
              subscribeTemplates: subs.map(s =>
                s.templateId === activeSub.templateId ? { ...s, status: 'rejected' } : s
              ),
            },
          });
        }
      }
    }

    console.log(`[weeklyReport] sent=${sent}/${users.length}`);
    return { code: 0, message: 'ok', data: { sent, total: users.length } };
  } catch (err) {
    console.error('[weeklyReport] error:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};
