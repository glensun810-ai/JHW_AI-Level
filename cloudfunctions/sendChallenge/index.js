const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    const { targetOpenid, score, tier } = event;
    if (!targetOpenid || !score || !tier) {
      return { code: 400, message: '参数错误：缺少 targetOpenid/score/tier', data: null };
    }

    if (targetOpenid === OPENID) {
      return { code: 400, message: '不能挑战自己', data: null };
    }

    // 检查是否已有 pending 挑战
    const { data: existing } = await db.collection('challenges')
      .where({
        challengerOpenid: OPENID,
        targetOpenid,
        status: 'pending',
      })
      .get();

    if (existing.length > 0) {
      return { code: 400, message: '已发送过挑战，请等待对方回应', data: null };
    }

    // 查询发起者信息
    const { data: users } = await db.collection('users')
      .where({ _openid: OPENID })
      .get();
    const user = users[0] || {};
    const challengerName = user.nickname || '匿名用户';

    // 查询被挑战者昵称
    const { data: targetUsers } = await db.collection('users')
      .where({ _openid: targetOpenid })
      .field({ nickname: true })
      .get();
    const targetName = targetUsers[0]?.nickname || '好友';

    // 写入挑战记录
    const record = {
      challengerOpenid: OPENID,
      challengerName,
      challengerScore: score,
      challengerTier: tier,
      targetOpenid,
      targetName,
      targetScore: null,
      targetTier: null,
      status: 'pending',
      result: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    const result = await db.collection('challenges').add({ data: record });

    // 发送订阅消息通知被挑战者
    const TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || '';
    if (TEMPLATE_ID) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: targetOpenid,
          templateId: TEMPLATE_ID,
          page: '/pages/quiz/quiz?challengeId=' + result._id,
          data: {
            thing1: { value: 'AI段位挑战' },
            thing6: { value: challengerName.slice(0, 20) },
            thing5: { value: targetName.slice(0, 20) },
          },
          miniprogramState: 'developer',
        });
        console.log(`[sendChallenge] 订阅消息已发送 → ${targetOpenid.slice(0, 8)}...`);
      } catch (e) {
        // 订阅消息发送失败不影响主流程（用户可能未订阅）
        console.log(`[sendChallenge] 订阅消息发送失败(可能未订阅): ${e.message}`);
      }
    }

    console.log(`[sendChallenge] ${OPENID.slice(0,8)}... → ${targetOpenid.slice(0,8)}... tier=${tier} id=${result._id}`);

    return {
      code: 0,
      message: '挑战已发送',
      data: {
        challengeId: result._id,
        targetName,
      },
    };
  } catch (err) {
    console.error('[sendChallenge] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};
