const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;
    const action = event.action || 'rank';

    if (action === 'markBountyViewed') {
      const { bountyId } = event;
      if (!bountyId) return { code: 400, message: '缺少 bountyId', data: null };
      try {
        await db.collection('bounty_results').doc(bountyId).update({
          data: { viewed: true },
        });
        return { code: 0, message: 'ok', data: null };
      } catch (e) {
        console.log('[getFriendRank] markBountyViewed 失败:', e.message);
        return { code: 500, message: '操作失败', data: null };
      }
    }

    if (action === 'updatePrivacy') {
      const { privacyHidden } = event;
      const { data: users } = await db.collection('users')
        .where({ _openid: OPENID })
        .get();

      if (users.length > 0) {
        await db.collection('users')
          .where({ _openid: OPENID })
          .update({
            data: {
              privacyHidden: !!privacyHidden,
              updatedAt: new Date(),
            },
          });
      } else {
        await db.collection('users').add({
          data: {
            _openid: OPENID,
            nickname: '',
            avatar: '',
            highestScore: 0,
            currentTier: '',
            testCount: 0,
            consecutiveDays: 0,
            privacyHidden: !!privacyHidden,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      console.log(`[getFriendRank] privacy updated openid=${OPENID.slice(0, 8)}... hidden=${privacyHidden}`);
      return { code: 0, message: 'ok', data: { privacyHidden: !!privacyHidden } };
    }

    // Phase 1: 获取挑战详情（供首页应战模式使用）
    if (action === 'getChallenge') {
      const { challengeId } = event;
      if (!challengeId) return { code: 400, message: '缺少 challengeId', data: null };
      try {
        const { data: challenges } = await db.collection('challenges')
          .where({ _id: challengeId, status: 'pending' })
          .get();
        if (challenges.length === 0) {
          return { code: 404, message: '挑战不存在或已结束', data: null };
        }
        const ch = challenges[0];
        return {
          code: 0, message: 'ok',
          data: {
            _id: ch._id,
            challengerName: ch.challengerName || '好友',
            challengerTier: ch.challengerTier || '',
            challengerScore: ch.challengerScore || 0,
            targetName: ch.targetName || '',
          },
        };
      } catch (e) {
        console.log('[getFriendRank] getChallenge 失败:', e.message);
        return { code: 500, message: '查询失败', data: null };
      }
    }

    // Phase 2: 获取邀请解锁统计（邀请人数 + 可用解锁次数）
    if (action === 'getInviteStats') {
      try {
        const { data: users } = await db.collection('users')
          .where({ _openid: OPENID })
          .field({ inviteUnlocks: true })
          .get();
        const inviteUnlocks = users.length > 0 ? (users[0].inviteUnlocks || 0) : 0;

        let inviteCount = 0;
        try {
          const result = await db.collection('invites')
            .where({ inviterOpenid: OPENID, completed: true })
            .count();
          inviteCount = result.total || 0;
        } catch (e) { /* invites 集合可能不存在 */ }

        return {
          code: 0, message: 'ok',
          data: { inviteCount, inviteUnlocks },
        };
      } catch (e) {
        console.log('[getFriendRank] getInviteStats 失败:', e.message);
        return { code: 500, message: '查询失败', data: null };
      }
    }

    if (action === 'collectRank') {
      // 获取好友列表
      let friendOpenids = [];
      try {
        const { data: friendships } = await db.collection('friendships')
          .where(_.or([{ userA: OPENID }, { userB: OPENID }]))
          .field({ userA: true, userB: true })
          .get();
        for (const f of (friendships || [])) {
          const friendId = f.userA === OPENID ? f.userB : f.userA;
          if (!friendOpenids.includes(friendId)) friendOpenids.push(friendId);
        }
      } catch (e) {
        console.warn('[getFriendRank] collectRank friendships 查询失败:', e.message);
      }

      // 包含自己 + 好友
      const allIds = [OPENID, ...friendOpenids];
      const { data: users } = await db.collection('users')
        .where({ _openid: _.in(allIds) })
        .field({ _openid: true, nickname: true, avatar: true, collectedCards: true })
        .get();

      const ranked = (users || [])
        .map(u => ({
          _openid: u._openid,
          nickname: u.nickname || '匿名用户',
          avatar: u.avatar || '',
          collectCount: (u.collectedCards || []).length,
        }))
        .sort((a, b) => b.collectCount - a.collectCount);

      const myRank = ranked.findIndex(u => u._openid === OPENID) + 1;

      return {
        code: 0, message: 'ok',
        data: {
          collectRankings: ranked,
          myCollectRank: myRank > 0 ? myRank : null,
          myCollectCount: ranked.find(u => u._openid === OPENID)?.collectCount || 0,
        },
      };
    }

    // 默认：获取好友排名
    const limit = Math.min(event.limit || 50, 100);

    // 修复3：从 friendships 集合获取真实好友列表（基于分享链关系图）
    let friendOpenids = [];
    let isGlobalFallback = false;
    try {
      const { data: friendships } = await db.collection('friendships')
        .where(_.or([{ userA: OPENID }, { userB: OPENID }]))
        .field({ userA: true, userB: true })
        .get();

      for (const f of (friendships || [])) {
        const friendId = f.userA === OPENID ? f.userB : f.userA;
        if (!friendOpenids.includes(friendId)) {
          friendOpenids.push(friendId);
        }
      }
      console.log(`[getFriendRank] friendships查询: 好友数=${friendOpenids.length}`);
    } catch (e) {
      console.warn('[getFriendRank] friendships 查询失败，降级为全服榜:', e.message);
      isGlobalFallback = true;
    }

    // 无好友 → 降级为全服高手榜
    if (friendOpenids.length === 0) {
      isGlobalFallback = true;
    }

    // 拉取用户数据
    let allUsers = [];
    const baseQuery = isGlobalFallback
      ? db.collection('users').where({ testCount: _.gt(0) })
      : db.collection('users').where({ _openid: _.in(friendOpenids) });

    try {
      const { data } = await baseQuery
        .field({
          _openid: true,
          nickname: true,
          avatar: true,
          currentTier: true,
          highestScore: true,
          privacyHidden: true,
        })
        .limit(isGlobalFallback ? limit : 200)
        .get();
      allUsers = (data || []).filter(u => !u.privacyHidden);
    } catch (e) {
      console.warn('[getFriendRank] 用户查询失败，尝试降级查询:', e.message);
      try {
        const { data } = await db.collection('users')
          .field({
            _openid: true,
            nickname: true,
            avatar: true,
            currentTier: true,
            highestScore: true,
            privacyHidden: true,
          })
          .limit(limit)
          .get();
        allUsers = (data || []).filter(u => u.testCount > 0 && !u.privacyHidden);
        isGlobalFallback = true;
      } catch (e2) {
        console.error('[getFriendRank] 降级查询也失败:', e2.message);
        allUsers = [];
      }
    }

    // 代码中排序（避免 orderBy 需要复合索引）
    allUsers.sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));

    // 修复6：群挑战榜 action — 按 openGId 过滤同群用户
    if (action === 'groupRank') {
      const openGId = event.openGId || '';
      let groupList = [];

      if (openGId) {
        try {
          // 查询同群会话的用户
          const { data: sessions } = await db.collection('group_sessions')
            .where({ openGId })
            .field({ openid: true })
            .limit(100)
            .get();

          if (sessions.length > 0) {
            const groupOpenids = [...new Set(sessions.map(s => s.openid))];
            // 从 allUsers 中筛选同群用户
            groupList = allUsers.filter(u => groupOpenids.includes(u._openid));
          }
        } catch (e) {
          console.log('[getFriendRank] groupRank 查询失败:', e.message);
        }
      }

      // 降级：无 openGId 或无群会话记录时，返回邀请好友列表
      if (groupList.length === 0) {
        groupList = allUsers.slice(0, 10);
      }

      return {
        code: 0,
        message: 'ok',
        data: {
          groupRankings: groupList,
          isGlobalFallback: groupList.length === 0 || !openGId,
          friendCount: groupList.length,
          invitedCount: groupList.length,
        },
      };
    }

    // 并行查询挑战数据 + 悬赏结果（不阻塞，失败返回空）
    const [
      winRes, loseRes, drawAsChallenger,
      opponentWinRes, opponentLoseRes, drawAsTarget,
      pendingRes, sentRes,
      bountyRes,
    ] = await Promise.all([
      safeCount(db, 'challenges', { challengerOpenid: OPENID, status: 'completed', result: 'challenger_win' }),
      safeCount(db, 'challenges', { challengerOpenid: OPENID, status: 'completed', result: 'target_win' }),
      safeCount(db, 'challenges', { challengerOpenid: OPENID, status: 'completed', result: 'draw' }),
      safeCount(db, 'challenges', { targetOpenid: OPENID, status: 'completed', result: 'target_win' }),
      safeCount(db, 'challenges', { targetOpenid: OPENID, status: 'completed', result: 'challenger_win' }),
      safeCount(db, 'challenges', { targetOpenid: OPENID, status: 'completed', result: 'draw' }),
      safeGet(db, 'challenges', { targetOpenid: OPENID, status: 'pending' }, { orderBy: ['createdAt', 'desc'], limit: 10 }),
      safeGet(db, 'challenges', { challengerOpenid: OPENID, status: 'pending' }, { field: { targetOpenid: true } }),
      safeGet(db, 'bounty_results', { predictorOpenid: OPENID, viewed: false }, { orderBy: ['createdAt', 'desc'], limit: 5 }),
    ]);

    // 查找用户排名
    const userIndex = allUsers.findIndex(u => u._openid === OPENID);
    const userRank = userIndex >= 0 ? userIndex + 1 : null;

    // 当前用户数据
    let userData = null;
    if (userIndex < 0) {
      try {
        const { data: self } = await db.collection('users')
          .where({ _openid: OPENID })
          .field({ currentTier: true, highestScore: true, nickname: true, avatar: true })
          .get();
        if (self.length > 0) userData = self[0];
      } catch (e) {
        console.warn('[getFriendRank] 查询当前用户失败:', e.message);
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        friendRankings: allUsers,
        userRank,
        userOpenid: OPENID,
        userData: userIndex >= 0 ? allUsers[userIndex] : (userData || null),
        isGlobalFallback,
        friendCount: friendOpenids.length,
        winCount: winRes.total + opponentLoseRes.total,
        loseCount: loseRes.total + opponentWinRes.total,
        drawCount: drawAsChallenger.total + drawAsTarget.total,
        pendingChallenges: (pendingRes.data || []).map(c => ({
          _id: c._id,
          challengerOpenid: c.challengerOpenid,
          challengerName: c.challengerName || '匿名用户',
          challengerTier: c.challengerTier,
          challengerScore: c.challengerScore,
          targetName: c.targetName || '',
        })),
        sentChallengeTargets: (sentRes.data || []).map(c => c.targetOpenid),
        bountyResults: (bountyRes.data || []).map(b => ({
          _id: b._id,
          targetName: b.targetName,
          guessedTier: b.guessedTier,
          actualTier: b.actualTier,
          actualScore: b.actualScore,
          isCorrect: b.isCorrect,
          createdAt: b.createdAt,
        })),
      },
    };
  } catch (err) {
    console.error('[getFriendRank] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};

// 安全 count 查询（集合不存在时返回 0）
async function safeCount(db, collection, where) {
  try {
    const result = await db.collection(collection).where(where).count();
    return result || { total: 0 };
  } catch (e) {
    console.warn(`[getFriendRank] count ${collection} 失败:`, e.message);
    return { total: 0 };
  }
}

// 安全 get 查询（集合不存在时返回空数组）
async function safeGet(db, collection, where, opts = {}) {
  try {
    let query = db.collection(collection).where(where);
    if (opts.field) query = query.field(opts.field);
    if (opts.orderBy) query = query.orderBy(opts.orderBy[0], opts.orderBy[1]);
    if (opts.limit) query = query.limit(opts.limit);
    const { data } = await query.get();
    return { data: data || [] };
  } catch (e) {
    console.warn(`[getFriendRank] get ${collection} 失败:`, e.message);
    return { data: [] };
  }
}
