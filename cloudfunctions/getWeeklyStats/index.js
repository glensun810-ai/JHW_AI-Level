const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;
    const action = event.action || 'stats';

    // 获取当前用户 openid（供前端分享跟踪用）
    if (action === 'getOpenid') {
      return { code: 0, data: { openid: OPENID } };
    }

    // XP 进化值服务端同步
    if (action === 'syncExp') {
      const { exp, level } = event;
      if (event.mode === 'get') {
        // 从服务端读取 XP，供 app 启动时合并
        const { data: userData } = await db.collection('users')
          .where({ _openid: OPENID })
          .field({ exp: true, level: true })
          .get();
        if (userData.length > 0) {
          return { code: 0, data: { exp: userData[0].exp || 0, level: userData[0].level || 1 } };
        }
        return { code: 0, data: { exp: 0, level: 1 } };
      }
      // 写入：取客户端和服务端的最大值
      if (exp !== undefined) {
        const { data: existing } = await db.collection('users')
          .where({ _openid: OPENID })
          .field({ exp: true })
          .get();
        const serverExp = existing.length > 0 ? (existing[0].exp || 0) : 0;
        const mergedExp = Math.max(exp, serverExp);
        const mergedLevel = Math.max(level || 1, existing.length > 0 ? (existing[0].level || 1) : 1);
        await db.collection('users')
          .where({ _openid: OPENID })
          .update({
            data: { exp: mergedExp, level: mergedLevel, updatedAt: new Date() },
          });
        return { code: 0, data: { exp: mergedExp, level: mergedLevel } };
      }
      return { code: 0, data: null };
    }

    // 签到打卡
    if (action === 'checkin') {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await db.collection('check_ins')
        .where({ _openid: OPENID, date: today })
        .get();

      if (existing.length > 0) {
        return { code: 0, message: '今日已签到', data: { alreadyChecked: true } };
      }

      // 计算连续天数
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const { data: yesterdayCheck } = await db.collection('check_ins')
        .where({ _openid: OPENID, date: yesterday })
        .get();

      const prevConsecutive = yesterdayCheck.length > 0
        ? (yesterdayCheck[0].consecutiveDays || 0)
        : 0;
      const consecutiveDays = prevConsecutive + 1;

      try {
        await db.collection('check_ins').add({
          data: {
            _openid: OPENID,
            date: today,
            consecutiveDays,
            reward: getReward(consecutiveDays),
            createdAt: new Date(),
          },
        });
      } catch (e) {
        // 并发写入触发唯一索引冲突，降级为"已签到"
        if (e.errCode === -1 || (e.message && e.message.includes('duplicate'))) {
          console.log(`[getWeeklyStats] checkin 并发冲突，降级为已签到 openid=${OPENID.slice(0,8)}...`);
          return { code: 0, message: '今日已签到', data: { alreadyChecked: true } };
        }
        throw e;
      }

      // 更新用户连续签到天数
      await db.collection('users')
        .where({ _openid: OPENID })
        .update({
          data: { consecutiveDays, updatedAt: new Date() },
        });

      console.log(`[getWeeklyStats] checkin openid=${OPENID.slice(0,8)}... day=${consecutiveDays}`);

      return {
        code: 0,
        message: '签到成功',
        data: { consecutiveDays, reward: getReward(consecutiveDays) },
      };
    }

    // 提交反馈
    if (action === 'feedback') {
      const { testRecordId, isAccurate, comment } = event;

      // 内容安全检测（如果有评论文字）
      if (comment && comment.trim().length > 0) {
        try {
          const secRes = await cloud.openapi.security.msgSecCheck({
            content: comment.trim(),
            scene: 2,
          });
          if (secRes.result && secRes.result.suggest === 'risky') {
            return { code: 403, message: '内容包含违规信息，请修改后重新提交', data: null };
          }
        } catch (secErr) {
          // msgSecCheck 调用失败时降级放行（避免阻塞正常功能）
          console.log('[getWeeklyStats] msgSecCheck 调用失败:', secErr.message);
        }
      }

      await db.collection('feedback').add({
        data: {
          _openid: OPENID,
          testRecordId: testRecordId || '',
          isAccurate: !!isAccurate,
          comment: comment || '',
          createdAt: new Date(),
        },
      });
      return { code: 0, message: '反馈已记录', data: null };
    }

    // 知识卡收藏
    if (action === 'collectCard') {
      const { cardId } = event;
      if (!cardId) return { code: 400, message: '缺少 cardId', data: null };
      await db.collection('users')
        .where({ _openid: OPENID })
        .update({
          data: {
            collectedCards: _.addToSet(cardId),
            updatedAt: new Date(),
          },
        });
      const { data: updated } = await db.collection('users')
        .where({ _openid: OPENID })
        .field({ collectedCards: true })
        .get();
      return {
        code: 0,
        data: { collectedCards: updated.length > 0 ? (updated[0].collectedCards || []) : [] },
      };
    }

    // 获取小程序码（供段位长图使用）
    if (action === 'getMiniCode') {
      try {
        const qrRes = await cloud.openapi.wxacode.getUnlimited({
          scene: 'share',
          page: 'pages/index/index',
          width: 280,
          autoColor: false,
          lineColor: { r: 255, g: 215, b: 0 },
          isHyaline: true,
        });
        const fileID = await cloud.uploadFile({
          cloudPath: `qrcodes/${OPENID}_share.png`,
          fileContent: qrRes.buffer,
        });
        return {
          code: 0,
          data: { miniCodeUrl: fileID.fileID },
        };
      } catch (e) {
        // getUnlimited 需要云函数权限，降级返回空
        console.log('[getWeeklyStats] getMiniCode failed:', e.message);
        return { code: 0, data: { miniCodeUrl: '' } };
      }
    }

    // 默认：获取每周统计
    // 本周晋升最快
    const weekStart = getWeekStart();
    const { data: weeklyRising } = await db.collection('test_records')
      .where({
        createdAt: _.gte(weekStart),
        tierChanged: true,
      })
      .field({
        _openid: true,
        prevTier: true,
        tier: true,
      })
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    // 获取昵称映射
    const openids = [...new Set(weeklyRising.map(r => r._openid))];
    const nicknameMap = {};
    if (openids.length > 0) {
      const { data: users } = await db.collection('users')
        .where({ _openid: _.in(openids) })
        .field({ _openid: true, nickname: true })
        .get();
      users.forEach(u => { nicknameMap[u._openid] = u.nickname || '匿名用户'; });
    }

    // 签到状态
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayCheck } = await db.collection('check_ins')
      .where({ _openid: OPENID, date: today })
      .get();

    const { data: userData } = await db.collection('users')
      .where({ _openid: OPENID })
      .field({ consecutiveDays: true, collectedCards: true })
      .get();
    const consecutiveDays = userData[0]?.consecutiveDays || 0;
    const collectedCards = userData[0]?.collectedCards || [];

    // 获取所有签到日期（用于日历展示）
    const { data: allCheckIns } = await db.collection('check_ins')
      .where({ _openid: OPENID })
      .field({ date: true })
      .orderBy('date', 'desc')
      .limit(62)
      .get();
    const checkedDates = allCheckIns.map(c => c.date);

    // 回顾数据 — 最近5次测试记录
    const { data: pastRecords } = await db.collection('test_records')
      .where({ _openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    let review = null;
    if (pastRecords.length >= 2) {
      const latest = pastRecords[0];
      const previous = pastRecords[1];
      const latestIdx = TIER_ORDER(latest.tier);
      const prevIdx = TIER_ORDER(previous.tier);
      const diff = latestIdx - prevIdx;
      const change = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
      const tierNames = ['萌新', '调戏师', '工具人', '协作者', '驾驭者', '炼金术士', '觉醒者', '无界'];
      const changeDetail = change === 'up'
        ? `⬆️ 晋升 ${diff} 段！继续加油！`
        : change === 'down'
          ? `⬇️ 下降 ${Math.abs(diff)} 段，再接再厉！`
          : '保持稳定，持续精进！';

      review = {
        history: pastRecords.slice(0, 2).map(r => ({
          date: formatRelativeDate(r.createdAt),
          tier: r.tier,
          emoji: getTierEmoji(r.tier),
          score: r.totalScore,
        })),
        change,
        changeDetail,
        totalTests: pastRecords.length,
      };
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        checkedToday: todayCheck.length > 0,
        consecutiveDays,
        checkedDates,
        collectedCards,
        weeklyRising: weeklyRising.map(r => ({
          nickname: nicknameMap[r._openid] || '匿名用户',
          prevTier: r.prevTier,
          currentTier: r.tier,
        })),
        review,
      },
    };
  } catch (err) {
    console.error('[getWeeklyStats] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function TIER_ORDER(name) {
  const order = ['萌新', '调戏师', '工具人', '协作者', '驾驭者', '炼金术士', '觉醒者', '无界'];
  return order.indexOf(name);
}

function getReward(day) {
  const rewards = {
    1: '「坚持打卡」徽章',
    3: '额外 1 次免费测试次数',
    5: '解锁 1 道签到专属趣味题',
    7: '解锁隐藏称号「AI践行者」+ 额外 2 次测试',
    14: '解锁称号「AI探索家」',
    30: '解锁称号「AI进化者」+ 专属段位卡边框',
  };
  return rewards[day] || '';
}

function formatRelativeDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays <= 7) return `${diffDays}天前`;
    if (diffDays <= 30) return `${Math.floor(diffDays / 7)}周前`;
    return `${Math.floor(diffDays / 30)}个月前`;
  } catch (e) {
    return '未知';
  }
}

function getTierEmoji(tierName) {
  const map = {
    '萌新': '🐣', '调戏师': '💬', '工具人': '🛠️', '协作者': '🤝',
    '驾驭者': '⚡', '炼金术士': '🧪', '觉醒者': '🧠', '无界': '🌊',
  };
  return map[tierName] || '';
}
