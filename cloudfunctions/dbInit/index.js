/**
 * 进化湾 v0.6 — 数据库初始化脚本
 *
 * 在微信云开发控制台创建以下 10 张集合后，
 * 将该脚本部署为云函数或直接在控制台执行创建索引。
 *
 * 部署方式：
 * 1. 复制到 cloudfunctions/dbInit/index.js
 * 2. 云开发控制台 → 数据库 → 新建集合（10个）
 * 3. 调用一次 dbInit 云函数创建索引
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ═══════════════════════════════════════
// 10 张数据库表 Schema
// ═══════════════════════════════════════

const SCHEMAS = {
  // ── 表 1：users（用户主表） ──
  users: {
    description: '用户主表，存储用户基本信息和当前段位',
    fields: {
      _openid:    { type: 'string', required: true,  description: '微信 OpenID（主键，自动生成）' },
      nickname:   { type: 'string', required: false, description: '用户昵称' },
      avatar:     { type: 'string', required: false, description: '头像 URL' },
      highestScore:  { type: 'number', required: false, default: 0, description: '历史最高分（只升不降）' },
      currentTier:   { type: 'string', required: false, default: '', description: '当前段位名称' },
      testCount:     { type: 'number', required: false, default: 0, description: '累计测试次数' },
      consecutiveDays: { type: 'number', required: false, default: 0, description: '连续签到天数' },
      collectedCards: { type: 'array', required: false, default: [], description: '已收集的知识卡 ID 列表' },
      bonusTestsRemaining: { type: 'number', required: false, default: 0, description: '签到奖励剩余测试次数' },
      inviteUnlocks: { type: 'number', required: false, default: 0, description: '邀请好友解锁的测试次数（v1.0）' },
      subscribeTemplates: { type: 'array', required: false, default: [], description: '订阅消息模板 [{templateId, status, subscribedAt}]' },
      privacyHidden:   { type: 'boolean', required: false, default: false, description: '是否隐藏排名' },
      createdAt:    { type: 'date', required: false, description: '创建时间' },
      updatedAt:    { type: 'date', required: false, description: '更新时间' },
    },
    indexes: [
      { keys: { _openid: 1 }, options: { unique: true } },
      { keys: { highestScore: -1 } },
      { keys: { currentTier: 1 } },
    ],
    security: { read: 'doc._openid == auth.openid', write: 'doc._openid == auth.openid' },
  },

  // ── 表 2：test_records（测试记录） ──
  test_records: {
    description: '每次测试的详细记录',
    fields: {
      _id:         { type: 'auto', description: '自动生成' },
      _openid:     { type: 'string', required: true,  description: '用户 OpenID' },
      answers:     { type: 'array',  required: true,  description: '[{questionId, selectedIndex, score, feedback}]' },
      totalScore:  { type: 'number', required: true,  description: '总分（5-50 或 10-100）' },
      tier:        { type: 'string', required: true,  description: '本次段位名称' },
      questionSetId: { type: 'string', required: true, description: '题本 ID' },
      testType:    { type: 'string', required: false, default: 'free', description: 'free | ad | invite' },
      prevTier:    { type: 'string', required: false, description: '上次段位（首次为空）' },
      tierChanged:  { type: 'boolean', required: false, description: '本次是否段位变化' },
      createdAt:   { type: 'date',   required: false, description: '创建时间' },
    },
    indexes: [
      { keys: { _openid: 1, createdAt: -1 } },
      { keys: { _openid: 1, questionSetId: 1, createdAt: -1 } },
      { keys: { createdAt: -1 } },
      { keys: { totalScore: 1 } },
    ],
    security: { read: true, write: 'doc._openid == auth.openid' },
  },

  // ── 表 3：questions（题库） ──
  questions: {
    description: '题目库，后台导入',
    fields: {
      _id:         { type: 'auto', description: '自动生成' },
      stem:        { type: 'string', required: true,  description: '题干' },
      emoji:       { type: 'string', required: false, description: '题目标题 emoji' },
      options:     { type: 'array',  required: true,  description: '["A. 选项一", ...] 4个选项' },
      scores:      { type: 'array',  required: true,  description: '[1,3,5,7] 每选项分值 1-10' },
      commentary:  { type: 'array',  required: false, description: '每选项的解读文案' },
      dimension:   { type: 'string', required: false, description: '测评维度：信息感知|工具应用|内容辨别|时代心态|思维深度' },
      theme:       { type: 'string', required: false, description: '主题：tech|workplace|fun|life|comprehensive' },
      difficulty:  { type: 'number', required: false, description: '难度 1-10' },
      status:      { type: 'string', required: false, default: 'active', description: 'active | inactive' },
      createdAt:   { type: 'date',   required: false },
    },
    indexes: [
      { keys: { status: 1 } },
      { keys: { theme: 1, status: 1 } },
      { keys: { dimension: 1 } },
    ],
    security: { read: true, write: false },
  },

  // ── 表 4：challenges（挑战记录） ──
  challenges: {
    description: '1v1 挑战记录',
    fields: {
      _id:              { type: 'auto', description: '自动生成' },
      challengerOpenid: { type: 'string', required: true,  description: '挑战者 OpenID' },
      challengerName:   { type: 'string', required: false, description: '挑战者昵称' },
      challengerScore:  { type: 'number', required: true,  description: '挑战者分数' },
      challengerTier:   { type: 'string', required: true,  description: '挑战者段位' },
      targetOpenid:     { type: 'string', required: true,  description: '被挑战者 OpenID' },
      targetName:       { type: 'string', required: false, description: '被挑战者昵称' },
      targetScore:      { type: 'number', required: false, description: '被挑战者分数（接受后回填）' },
      targetTier:       { type: 'string', required: false, description: '被挑战者段位（接受后回填）' },
      status:           { type: 'string', required: false, default: 'pending', description: 'pending | accepted | completed' },
      result:           { type: 'string', required: false, description: 'challenger_win | target_win | draw | null' },
      createdAt:        { type: 'date',   required: false },
      completedAt:      { type: 'date',   required: false },
    },
    indexes: [
      { keys: { targetOpenid: 1, status: 1 } },
      { keys: { challengerOpenid: 1, status: 1 } },
      { keys: { createdAt: -1 } },
    ],
    security: { read: true, write: 'doc.challengerOpenid == auth.openid' },
  },

  // ── 表 5：check_ins（签到记录） ──
  check_ins: {
    description: '每日签到记录',
    fields: {
      _id:              { type: 'auto', description: '自动生成' },
      _openid:          { type: 'string', required: true,  description: '用户 OpenID' },
      date:             { type: 'string', required: true,  description: '签到日期 YYYY-MM-DD' },
      consecutiveDays:  { type: 'number', required: false, description: '连续签到天数' },
      reward:           { type: 'string', required: false, description: '本次签到奖励标识' },
      createdAt:        { type: 'date',   required: false },
    },
    indexes: [
      { keys: { _openid: 1, date: 1 }, options: { unique: true } },
      { keys: { date: 1 } },
    ],
    security: { read: true, write: 'doc._openid == auth.openid' },
  },

  // ── 表 6：weekly_rankings（每周排行榜快照） ──
  weekly_rankings: {
    description: '每周排行榜快照，用于周环比和晋升榜',
    fields: {
      _id:         { type: 'auto', description: '自动生成' },
      weekStart:   { type: 'string', required: true,  description: '周一日期 YYYY-MM-DD' },
      _openid:     { type: 'string', required: true,  description: '用户 OpenID' },
      tier:        { type: 'string', required: true,  description: '本周段位' },
      score:       { type: 'number', required: true,  description: '本周分数' },
      rankChange:  { type: 'number', required: false, default: 0, description: '排名变化（正=上升）' },
      createdAt:   { type: 'date',   required: false },
    },
    indexes: [
      { keys: { weekStart: 1, score: -1 } },
      { keys: { _openid: 1, weekStart: 1 } },
    ],
    security: { read: true, write: false },
  },

  // ── 表 7：feedback（用户反馈） ──
  feedback: {
    description: '用户对段位准确性的反馈',
    fields: {
      _id:          { type: 'auto', description: '自动生成' },
      _openid:      { type: 'string', required: true,  description: '用户 OpenID' },
      testRecordId: { type: 'string', required: false, description: '关联的测试记录 ID' },
      isAccurate:   { type: 'boolean', required: true, description: '段位是否准确' },
      comment:      { type: 'string', required: false, description: '附加评论（可选）' },
      createdAt:    { type: 'date',   required: false },
    },
    indexes: [
      { keys: { _openid: 1 } },
      { keys: { createdAt: -1 } },
    ],
    security: { read: false, write: 'doc._openid == auth.openid' },
  },

  // ── 表 8：share_logs（分享效果追踪） ──
  share_logs: {
    description: '分享行为追踪，用于病毒系数计算',
    fields: {
      _id:         { type: 'auto', description: '自动生成' },
      _openid:     { type: 'string', required: true,  description: '分享者 OpenID' },
      channel:     { type: 'string', required: true,  description: "'group' | 'timeline' | 'private'" },
      tier:        { type: 'string', required: false, description: '分享时段位' },
      shareStyle:  { type: 'string', required: false, description: "'showoff' | 'selfmock' | 'challenge'" },
      fromUid:     { type: 'string', required: false, description: '通过谁的分享进入（被分享者首次记录时回填）' },
      impressions: { type: 'number', required: false, default: 0, description: '带参曝光量' },
      clicks:      { type: 'number', required: false, default: 0, description: '点击进入量' },
      sharedAt:    { type: 'date',   required: false },
      createdAt:   { type: 'date',   required: false },
    },
    indexes: [
      { keys: { _openid: 1, sharedAt: -1 } },
      { keys: { fromUid: 1 } },
      { keys: { channel: 1 } },
    ],
    security: { read: false, write: true },
  },

  // ── 表 9：analytics_logs（埋点日志，v0.6 新增） ──
  analytics_logs: {
    description: '全站埋点日志，用于监控指标计算和用户行为分析',
    fields: {
      _id:        { type: 'auto', description: '自动生成' },
      event:      { type: 'string', required: true,  description: '事件名（18个核心事件之一）' },
      params:     { type: 'object', required: false, description: '事件参数（键值对）' },
      openid:     { type: 'string', required: false, description: '用户 OpenID' },
      session:    { type: 'string', required: false, description: '会话 ID' },
      page:       { type: 'string', required: false, description: '触发页面路径' },
      clientTime: { type: 'number', required: false, description: '客户端时间戳' },
      serverTime: { type: 'date',   required: false, description: '服务端写入时间' },
    },
    indexes: [
      { keys: { event: 1, serverTime: -1 } },
      { keys: { openid: 1, serverTime: -1 } },
      { keys: { session: 1 } },
      { keys: { serverTime: -1 } },
    ],
    security: { read: false, write: true },
  },

  // ── 表 10：friendships（双向好友关系，基于分享链） ──
  friendships: {
    description: '双向好友关系表，基于分享转化构建',
    fields: {
      _id:       { type: 'auto', description: '自动生成' },
      pairId:    { type: 'string', required: true, description: 'userA_userB（字典序，唯一）' },
      userA:     { type: 'string', required: true, description: 'OpenID（字母序较小）' },
      userB:     { type: 'string', required: true, description: 'OpenID（字母序较大）' },
      createdAt: { type: 'date', required: false },
      updatedAt: { type: 'date', required: false },
    },
    indexes: [
      { keys: { userA: 1, userB: 1 }, options: { unique: true } },
      { keys: { pairId: 1 }, options: { unique: true } },
      { keys: { userB: 1 } },
    ],
    security: { read: true, write: false },
  },

  // ── 表 11：bounty_results（段位悬赏结果） ──
  bounty_results: {
    description: '段位悬赏结果，记录猜测段位 vs 实际段位对比',
    fields: {
      _id:             { type: 'auto', description: '自动生成' },
      predictorOpenid: { type: 'string', required: true, description: '悬赏者 OpenID' },
      targetOpenid:    { type: 'string', required: true, description: '被测者 OpenID' },
      targetName:      { type: 'string', required: false, description: '被测者昵称' },
      guessedTier:     { type: 'string', required: true, description: '猜测的段位名称' },
      actualTier:      { type: 'string', required: true, description: '实际段位名称' },
      actualScore:     { type: 'number', required: true, description: '实际分数（5-50）' },
      isCorrect:       { type: 'boolean', required: true, description: '是否猜中' },
      viewed:          { type: 'boolean', required: false, default: false, description: '悬赏者是否已查看' },
      createdAt:       { type: 'date', required: false },
    },
    indexes: [
      { keys: { predictorOpenid: 1, viewed: 1, createdAt: -1 } },
      { keys: { targetOpenid: 1, createdAt: -1 } },
    ],
    security: { read: true, write: false },
  },

  // ── 表 12：invites（邀请记录，v1.0 新增） ──
  invites: {
    description: '邀请记录表，追踪社交邀请的发起与完成',
    fields: {
      _id:            { type: 'auto', description: '自动生成' },
      inviterOpenid:  { type: 'string', required: true, description: '邀请人 OpenID' },
      inviteeOpenid:  { type: 'string', required: true, description: '被邀请人 OpenID' },
      completed:      { type: 'boolean', required: false, default: false, description: '被邀请人是否完成测试' },
      inviteeTier:    { type: 'string', required: false, description: '被邀请人完成测试时的段位' },
      completedAt:    { type: 'date', required: false },
      createdAt:      { type: 'date', required: false },
    },
    indexes: [
      { keys: { inviterOpenid: 1, completed: 1 } },
      { keys: { inviteeOpenid: 1 } },
      { keys: { inviterOpenid: 1, inviteeOpenid: 1 }, options: { unique: true } },
    ],
    security: { read: true, write: false },
  },

  // ── 表 13：monitor_results（监控结果快照，v0.6 新增） ──
  monitor_results: {
    description: '每小时监控指标计算结果快照，用于 Dashboard 展示',
    fields: {
      _id:       { type: 'auto', description: '自动生成' },
      metrics:   { type: 'object', required: true,  description: '9项指标的完整计算结果' },
      report:    { type: 'object', required: true,  description: '{ reds, yellows, greens, overall }' },
      createdAt: { type: 'date',   required: false, description: '创建时间' },
    },
    indexes: [
      { keys: { createdAt: -1 } },
      { keys: { 'report.overall': 1, createdAt: -1 } },
    ],
    security: { read: false, write: false },
  },

  // ── 表 14：group_sessions（群聊会话记录，v1.1 新增，用于群挑战榜） ──
  group_sessions: {
    description: '记录用户从群聊分享进入小程序的会话，用于群排行过滤',
    fields: {
      _id:       { type: 'auto', description: '自动生成' },
      openGId:   { type: 'string', required: true, description: '群聊标识（解密后的 openGId 或 shareTicket hash）' },
      openid:    { type: 'string', required: true, description: '用户 OpenID' },
      enterTime: { type: 'date', required: false },
    },
    indexes: [
      { keys: { openGId: 1 } },
      { keys: { openid: 1 } },
    ],
    security: { read: true, write: false },
  },
};

// ═══════════════════════════════════════
// 创建索引（实际执行部分）
// ═══════════════════════════════════════

exports.main = async (event, context) => {
  const results = [];
  const action = event.action || 'createIndexes';

  if (action === 'schema') {
    // 仅返回 Schema 文档
    return { code: 0, message: 'ok', data: { schemas: SCHEMAS } };
  }

  if (action === 'migrateScores') {
    // Bug #6 修复：归一化历史 deep mode 用户的 highestScore（>50 → 除以2）
    const batchSize = 100;
    let cursor = null;
    let totalMigrated = 0;
    const migratedUsers = [];

    while (true) {
      const query = { highestScore: _.gt(50) };
      const { data: users } = cursor
        ? await db.collection('users').where(query).skip(cursor).limit(batchSize).get()
        : await db.collection('users').where(query).limit(batchSize).get();

      if (!users || users.length === 0) break;

      for (const user of users) {
        const oldScore = user.highestScore;
        const newScore = Math.round(oldScore / 2);
        const clamped = Math.min(50, Math.max(5, newScore));
        try {
          await db.collection('users').doc(user._id).update({
            data: { highestScore: clamped },
          });
          migratedUsers.push({ _openid: user._openid, oldScore, newScore: clamped });
          totalMigrated++;
        } catch (e) {
          results.push({ user: user._openid, status: 'error', error: e.message });
        }
      }

      if (users.length < batchSize) break;
      cursor = (cursor || 0) + batchSize;
    }

    console.log(`[dbInit] migrateScores 完成，迁移 ${totalMigrated} 个用户`);
    return {
      code: 0, message: 'ok',
      data: { totalMigrated, sample: migratedUsers.slice(0, 5) },
    };
  }

  if (action === 'createIndexes') {
    // 逐个表创建索引
    for (const [collName, schema] of Object.entries(SCHEMAS)) {
      if (!schema.indexes || schema.indexes.length === 0) continue;

      for (const idx of schema.indexes) {
        try {
          await db.collection(collName).createIndex(idx.keys, idx.options || {});
          results.push({ collection: collName, status: 'ok', index: idx.keys });
        } catch (err) {
          // 索引可能已存在
          if (err.errCode === -1 || err.message?.includes('already exists')) {
            results.push({ collection: collName, status: 'skipped (exists)', index: idx.keys });
          } else {
            results.push({ collection: collName, status: 'error', index: idx.keys, error: err.message });
          }
        }
      }
    }

    console.log(`[dbInit] 索引创建完成，共 ${results.length} 个`);
    return { code: 0, message: 'ok', data: { results } };
  }

  return { code: 400, message: '未知操作，可选：schema | createIndexes', data: null };
};

// 导出 Schema 供其他云函数参考
exports.SCHEMAS = SCHEMAS;
