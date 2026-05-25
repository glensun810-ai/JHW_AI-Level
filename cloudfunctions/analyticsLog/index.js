const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * analyticsLog — 埋点日志云函数
 *
 * 两种模式：
 *   - action: 'single'  单条写入（实时关键事件）
 *   - action: 'batch'   批量写入（非关键事件队列刷新）
 *
 * 写入策略：直接 insert，不等待返回
 */

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || 'anonymous';
    const action = event.action || 'single';

    // ── 月度题目质量检查 ──
    if (action === 'quality-check') {
      const days = event.days || 30;
      const since = new Date(Date.now() - days * 86400000);

      // 获取所有活跃题目
      const { data: activeQuestions } = await db.collection('questions')
        .where({ status: 'active' })
        .field({ _id: true, stem: true })
        .get();

      if (activeQuestions.length === 0) {
        return { code: 0, message: '无活跃题目', data: null };
      }

      console.log(`[analyticsLog] quality-check: 检查 ${activeQuestions.length} 道题目`);

      // 查询近期测试记录（限制 2000 条）
      const { data: records } = await db.collection('test_records')
        .where({ createdAt: _.gte(since) })
        .field({ answers: true })
        .limit(2000)
        .get();

      // 聚合：questionId → [option0Count, option1Count, option2Count, option3Count]
      const counts = {};
      for (const rec of records) {
        for (const ans of (rec.answers || [])) {
          if (!ans.questionId) continue;
          if (!counts[ans.questionId]) counts[ans.questionId] = [0, 0, 0, 0];
          const idx = ans.selectedIndex;
          if (idx >= 0 && idx < 4) counts[ans.questionId][idx]++;
        }
      }

      // 检查每题的选择集中度
      const flagged = [];
      for (const q of activeQuestions) {
        const c = counts[q._id];
        if (!c) continue; // 无答题数据，跳过
        const total = c[0] + c[1] + c[2] + c[3];
        if (total < 10) continue; // 样本量不足，跳过

        const maxCount = Math.max(...c);
        const maxRatio = maxCount / total;
        const maxOption = c.indexOf(maxCount);

        if (maxRatio > 0.8) {
          // 标记为待审查
          await db.collection('questions').doc(q._id).update({
            data: {
              status: 'review',
              _reviewReason: `选项集中度过高：${Math.round(maxRatio * 100)}% 用户选择选项${maxOption}`,
              _reviewedAt: new Date(),
            },
          });
          flagged.push({
            questionId: q._id,
            stem: (q.stem || '').slice(0, 30),
            maxOption,
            ratio: Math.round(maxRatio * 100),
          });
          console.log(`[analyticsLog] 标记待审查: ${q._id.slice(0,8)}... "${(q.stem||'').slice(0,20)}..." 选项${maxOption}=${Math.round(maxRatio*100)}%`);
        }
      }

      console.log(`[analyticsLog] quality-check 完成: ${flagged.length} 道标记待审查`);
      return {
        code: 0,
        message: `检查完成：${flagged.length} 道题目标记待审查`,
        data: { flagged, total: activeQuestions.length },
      };
    }

    if (action === 'batch') {
      const events = event.events || [];
      if (!Array.isArray(events) || events.length === 0) {
        return { code: 0, message: 'empty batch', data: null };
      }

      // 补全 openid + 服务端时间戳
      const now = new Date();
      const docs = events.map(e => ({
        event: e.event || 'unknown',
        params: e.params || {},
        openid: e.openid || openid,
        session: e.session || '',
        page: e.page || '',
        clientTime: e.timestamp || 0,
        serverTime: now,
      }));

      // 逐条插入（CloudBase add() 不支持数组批量写入）
      await Promise.all(
        docs.map(doc =>
          db.collection('analytics_logs').add({ data: doc }).catch(err => {
            console.warn('[analyticsLog] 单条写入失败:', err.message);
          })
        )
      );

      console.log(`[analyticsLog] batch: ${docs.length} events written`);
      return { code: 0, message: 'ok', data: { count: docs.length } };
    }

    // 单条写入
    const ev = event.eventData || event;
    await db.collection('analytics_logs').add({
      data: {
        event: ev.event || 'unknown',
        params: ev.params || {},
        openid: openid,
        session: ev.session || '',
        page: ev.page || '',
        clientTime: ev.timestamp || 0,
        serverTime: new Date(),
      },
    });

    return { code: 0, message: 'ok', data: null };
  } catch (err) {
    console.error('[analyticsLog] error:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};
