const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 知识卡内容库
const KNOWLEDGE_CARDS = require('./cards-data.js');

const MAX_FREE_TESTS = 3;
const MAX_AD_TESTS = 2;

// 段位定义 — v0.6 进化叙事流
const TIERS = [
  { name: '萌新',     emoji: '🐣', min: 5,  max: 9  },
  { name: '调戏师',   emoji: '💬', min: 10, max: 18 },
  { name: '工具人',   emoji: '🛠️', min: 19, max: 27 },
  { name: '协作者',   emoji: '🤝', min: 28, max: 35 },
  { name: '驾驭者',   emoji: '⚡', min: 36, max: 42 },
  { name: '炼金术士', emoji: '🧪', min: 43, max: 46 },
  { name: '觉醒者',   emoji: '🧠', min: 47, max: 49 },
  { name: '无界',     emoji: '🌊', min: 50, max: 50 },
];

function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

function getNextTier(score) {
  const current = getTier(score);
  const idx = TIERS.findIndex(t => t.name === current.name);
  if (idx >= TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

// F10：AI 人格画像
function getPersona(radarValues) {
  // 按优先级匹配，命中第一个即返回
  const PERSONAS = [
    { name: 'AI 原住民',    emoji: '🧬', rule: (r) => r[0] >= 70 && r[1] >= 70 && r[2] >= 70 },
    { name: '谨慎的探索者', emoji: '🔍', rule: (r) => r[1] >= 60 && r[4] >= 70 },
    { name: '激进的AI信徒', emoji: '🤖', rule: (r) => r[0] >= 80 && r[2] >= 60 },
    { name: '冷酷的理性派', emoji: '🧊', rule: (r) => r[4] >= 80 && r[3] >= 70 },
    { name: '热血的实践者', emoji: '🔥', rule: (r) => r[1] >= 70 && r[2] <= 40 },
    { name: '佛系的工具人', emoji: '😌', rule: (r) => r[3] <= 40 && r[1] >= 50 },
    { name: '时代的旁观者', emoji: '👀', rule: (r) => r[0] <= 40 && r[3] <= 40 },
    { name: '传统的守望者', emoji: '🏛️', rule: (r) => r[3] >= 70 && r[4] <= 30 },
    { name: '均衡的进化者', emoji: '⚖️', rule: () => true },
  ];
  for (const p of PERSONAS) {
    if (p.rule(radarValues)) return { name: p.name, emoji: p.emoji };
  }
  return { name: '均衡的进化者', emoji: '⚖️' };
}

function calcRadarData(qScores) {
  const clamp = (v) => Math.max(0, Math.min(100, v));

  const infoAwareness  = qScores[0] * 10;
  const toolUsage      = Math.round((qScores[1] * 10 + qScores[2] * 5) / 1.5);
  const contentDiscern = qScores[2] * 10;
  const eraMindset     = qScores[3] * 10;
  const thinkDepth     = qScores[4] * 10;

  return [
    clamp(infoAwareness),
    clamp(toolUsage),
    clamp(contentDiscern),
    clamp(eraMindset),
    clamp(thinkDepth),
  ];
}

// v0.8 AI 锐评（毒舌幽默风格）
const tierCommentaries = {
  '萌新': '你跟 AI 的关系，大概相当于你跟健身卡的关系——知道它存在，但没怎么用过。',
  '调戏师': '你让 AI 给你讲了个笑话，然后 AI 给你打了个分：幽默感 3/10，好奇心 9/10。',
  '工具人': 'AI 说：这个人类挺会用的，就是每次结尾都加"谢谢"，搞得我怪不好意思的。',
  '协作者': '你俩配合得不错——你出想法，AI 出体力，像极了偶像和幕后团队的关系。',
  '驾驭者': '你把 AI 开出了手动挡的感觉——谁说 AI 不能弹射起步？',
  '炼金术士': '你在尝试把 AI 变成金子。有时候烧出来是金子，有时候是焦炭，但你一直在试，这就很酷。',
  '觉醒者': '你已经到了"没有 AI 也能活，但有 AI 活更好"的境界。AI 说：有点怕你。',
  '无界': 'AI 想给你打分，但发现你不按套路来。你们的关系已经超出了我的理解范围，祝你幸福。',
};

// 段位晋升轻科普建议
function getEvolutionTip(tierName, tierIndex) {
  const tips = {
    '萌新': [
      '试试把 AI 想成一位超能力实习生——交代得越清楚，它干得越漂亮',
      '下次给 AI 指令时，加上"谁看的 + 用在哪儿 + 不要什么"三个要素',
    ],
    '调戏师': [
      '你已经会逗 AI 了，下一步试试让它"扮演角色"来提升回答质量',
      'AI 的一句话差距：加上角色设定，输出质量可能提升 30%',
    ],
    '工具人': [
      '能熟练用 AI 干活了，下一步是学会"追问"——追问 2 轮，答案质量可能翻倍',
      '试试让多个 AI 工具分工协作：一个收集、一个生成、一个审查',
    ],
    '协作者': [
      '已经能和 AI 搭档了，接下来修炼"辨别力"——知道 AI 什么时候在糊弄你',
      '养成习惯：AI 给出的重要信息，追问一句"你的依据是什么？"',
    ],
    '驾驭者': [
      '已然是 AI 的"司机"了，你的下一个课题是"跨领域思维"——用 AI 把一个领域的智慧搬到另一个领域',
      '试试把纠结的问题换一个比喻：比如"如果是 NBA 教练遇到这个问题会怎么想？"',
    ],
    '炼金术士': [
      '你在把 AI 变成金子的路上，下一步是系统化——把你常用的 prompt 写成模板库',
      '把每周重复的"思考型任务"写成固定 prompt，每次只需改变量',
    ],
    '觉醒者': [
      '如果你到了这个段位，你已经超越了 95% 的人。下一站是"边界感"——知道 AI 的能和不能',
      '每周花 10 分钟思考：我用 AI 做的事里，哪件最有价值？哪件其实可以不做？',
    ],
    '无界': [
      '你已站在 AI 使用者的顶端。最后一个课题：帮助更多人找到和 AI 相处的最佳方式',
      '你的经验本身就是最好的"知识卡"——分享出去，让更多人进化',
    ],
  };
  return tips[tierName] || tips['萌新'];
}

// 知识卡匹配：对中低分选项（score≤5）匹配稍高于当前段位的知识卡
function matchKnowledgeCards(answers, tierIndex, usedCardIds) {
  const cards = [];
  const used = new Set(usedCardIds || []);

  answers.forEach((ans, i) => {
    if (ans.score > 5) return; // 高分选项不触发知识卡

    // 筛选：目标段位范围包含当前用户段位或稍高的卡片
    const eligible = KNOWLEDGE_CARDS.filter(card => {
      if (used.has(card.id)) return false;
      const [minTier, maxTier] = card.tierRange;
      // 知识卡的目标范围与用户段位有交集，或者用户低于目标范围（向上看）
      return tierIndex <= maxTier && tierIndex >= minTier - 1;
    });

    if (eligible.length > 0) {
      // 优先选最接近当前段位+1的知识卡
      eligible.sort((a, b) => {
        const aDist = Math.abs(a.tierRange[0] - (tierIndex + 1));
        const bDist = Math.abs(b.tierRange[0] - (tierIndex + 1));
        return aDist - bDist;
      });
      const pick = eligible[0];
      used.add(pick.id);
      cards.push({
        questionIndex: i,
        card: {
          id: pick.id,
          skill: pick.skill,
          skillName: pick.skillName,
          title: pick.title,
          emoji: pick.emoji,
          hook: pick.hook,
          body: pick.body,
          actionTip: pick.actionTip,
          funFact: pick.funFact,
        },
      });
    }
  });

  return cards;
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    const { questionSetId, answers } = event;
    if (!answers || !Array.isArray(answers) || (answers.length !== 5 && answers.length !== 10)) {
      return { code: 400, message: '参数错误：answers 必须为5或10个元素的数组', data: null };
    }
    const isDeepMode = answers.length === 10;
    if (!questionSetId) {
      return { code: 400, message: '参数错误：缺少 questionSetId', data: null };
    }

    // 从数据库获取题目（拿scores和commentary）
    const questionIds = answers.map(a => a.questionId);
    const { data: questions } = await db.collection('questions')
      .where({ _id: _.in(questionIds) })
      .get();

    if (questions.length !== answers.length) {
      return { code: 400, message: '题目数据异常', data: null };
    }

    const orderedQuestions = questionIds.map(id =>
      questions.find(q => q._id === id)
    );

    // 独立计算总分（不信任前端传值）
    const qScores = [];
    const commentary = [];
    let totalScore = 0;

    answers.forEach((ans, i) => {
      const q = orderedQuestions[i];
      const idx = ans.selectedIndex;
      const score = q.scores[idx] || 0;
      qScores.push(score);
      totalScore += score;
      commentary.push(q.commentary ? q.commentary[idx] : '');
    });

    // 段位映射（深度模式：100分制 → 映射到50分制，统一存储）
    const tierScore = isDeepMode ? Math.round(totalScore / 2) : totalScore;
    const clampedTierScore = Math.min(50, Math.max(5, tierScore));
    const tier = getTier(clampedTierScore);
    const nextTier = getNextTier(clampedTierScore);
    const pointsToNext = nextTier ? nextTier.min - clampedTierScore : 0;
    const displayScore = isDeepMode ? totalScore : tierScore;

    // 雷达图数据 + AI人格画像
    const radarValues = calcRadarData(qScores);
    const persona = getPersona(radarValues);

    // 知识卡匹配 + 进化建议
    const tierIndex = TIERS.findIndex(t => t.name === tier.name);
    const answersWithScores = answers.map((ans, i) => ({
      score: qScores[i],
      questionId: ans.questionId,
    }));
    const knowledgeCards = matchKnowledgeCards(answersWithScores, tierIndex, []);
    const evolutionTip = getEvolutionTip(tier.name, tierIndex);

    // 查询用户当前数据
    const { data: users } = await db.collection('users')
      .where({ _openid: OPENID })
      .get();

    const user = users[0] || {};
    const previousHighest = user.highestScore || 0;
    const previousTier = user.currentTier || null;
    // 统一用 5-50 分制的 tierScore 比较，避免深度模式(100分制)污染数据
    const isNewHighest = clampedTierScore > previousHighest;
    const newHighestScore = isNewHighest ? clampedTierScore : previousHighest;
    const newTier = isNewHighest ? tier.name : user.currentTier;
    const tierChanged = isNewHighest && previousTier && previousTier !== tier.name;

    // 计算全国百分比（统一用 5-50 分制比较，保证普通/深度模式可比）
    const { total: totalUsers } = await db.collection('users')
      .where({ highestScore: _.gt(0) })
      .count();

    const { total: lowerCount } = await db.collection('users')
      .where({ highestScore: _.lt(clampedTierScore).and(_.gt(0)) })
      .count();

    const percentile = totalUsers > 0
      ? Math.floor((lowerCount / totalUsers) * 100)
      : 0;

    // 服务端每日测试次数校验（防 localStorage 绕过，支持 free/ad/invite/checkin_bonus 分级）
    const testType = event.testType || 'free';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(todayStr + 'T00:00:00+08:00');
    const todayEnd = new Date(todayStr + 'T23:59:59+08:00');

    const { total: todayFreeCount } = await db.collection('test_records')
      .where({
        _openid: OPENID,
        testType: _.or(_.eq('free'), _.exists(false)),
        createdAt: _.gte(todayStart).and(_.lte(todayEnd)),
      })
      .count();

    const { total: todayAdCount } = await db.collection('test_records')
      .where({
        _openid: OPENID,
        testType: 'ad',
        createdAt: _.gte(todayStart).and(_.lte(todayEnd)),
      })
      .count();

    // v0.9: 签到奖励额外测试次数（服务端权威校验，防客户端绕过）
    const bonusRemaining = user.bonusTestsRemaining || 0;
    let usedBonus = false;

    // 免费次数用完且不是广告测试 → 尝试消耗签到奖励
    if (todayFreeCount >= MAX_FREE_TESTS && testType !== 'ad' && bonusRemaining > 0) {
      usedBonus = true;
      console.log(`[submitScore] 消耗签到奖励测试 bonusBefore=${bonusRemaining}`);
    }

    // 免费 + 广告 + 签到奖励全部用完
    if (todayFreeCount >= MAX_FREE_TESTS && todayAdCount >= MAX_AD_TESTS && !usedBonus) {
      console.log(`[submitScore] 今日全部次数已用完 free=${todayFreeCount} ad=${todayAdCount}`);
      return { code: 403, message: '今日测试次数已用完，邀请好友可解锁额外次数', data: null };
    }

    // 免费次数用完且当前不是广告测试且没有签到奖励
    if (todayFreeCount >= MAX_FREE_TESTS && testType !== 'ad' && !usedBonus) {
      console.log(`[submitScore] 免费次数已用完 free=${todayFreeCount} type=${testType}`);
      return { code: 403, message: '免费次数已用完，看广告或邀请好友可解锁', data: null };
    }

    // 广告次数用完且当前是广告测试
    if (testType === 'ad' && todayAdCount >= MAX_AD_TESTS) {
      console.log(`[submitScore] 广告次数已用完 ad=${todayAdCount}`);
      return { code: 403, message: '今日广告解锁次数已用完，邀请好友可解锁', data: null };
    }

    // 消耗签到奖励
    if (usedBonus) {
      await db.collection('users')
        .where({ _openid: OPENID })
        .update({ data: { bonusTestsRemaining: _.inc(-1) } });
    }

    // 幂等保护：防止快速重复提交（同一用户 + 同一题本 60s 内去重）
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const { data: dupRecords } = await db.collection('test_records')
      .where({
        _openid: OPENID,
        questionSetId,
        createdAt: _.gte(sixtySecondsAgo),
      })
      .limit(1)
      .get();
    if (dupRecords.length > 0) {
      console.log(`[submitScore] 重复提交已拦截 openid=${OPENID.slice(0,8)}... questionSetId=${questionSetId}`);
      return { code: 0, message: 'ok (duplicate)', data: null };
    }

    // 写入测试记录（v0.8：增加 feedback 字段）
    const record = {
      _openid: OPENID,
      answers: answers.map((ans, i) => ({
        questionId: ans.questionId,
        selectedIndex: ans.selectedIndex,
        score: qScores[i],
        feedback: ans.feedback || null,
      })),
      totalScore,
      tier: tier.name,
      questionSetId,
      testType,
      prevTier: previousTier || '',
      tierChanged: tierChanged || false,
      createdAt: new Date(),
    };
    await db.collection('test_records').add({ data: record });

    // 更新用户数据（段位保护：只升不降）
    if (user._id) {
      await db.collection('users')
        .where({ _openid: OPENID })
        .update({
          data: {
            highestScore: newHighestScore,
            currentTier: newTier,
            testCount: _.inc(1),
            updatedAt: new Date(),
          },
        });
    } else {
      await db.collection('users').add({
        data: {
          _openid: OPENID,
          nickname: '',
          avatar: '',
          highestScore: totalScore,
          currentTier: tier.name,
          testCount: 1,
          consecutiveDays: 0,
          privacyHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // 更新 weekly_rankings（周排行榜快照）
    const weekStart = getWeekStart();
    const { data: existingWeek } = await db.collection('weekly_rankings')
      .where({ _openid: OPENID, weekStart })
      .get();

    if (existingWeek.length > 0) {
      const prevScore = existingWeek[0].score || 0;
      await db.collection('weekly_rankings')
        .where({ _openid: OPENID, weekStart })
        .update({
          data: {
            tier: tier.name,
            score: clampedTierScore,
            rankChange: clampedTierScore - prevScore,
            createdAt: new Date(),
          },
        });
    } else {
      await db.collection('weekly_rankings').add({
        data: {
          weekStart,
          _openid: OPENID,
          tier: tier.name,
          score: clampedTierScore,
          rankChange: 0,
          createdAt: new Date(),
        },
      });
    }

    // 处理待接受的挑战（当前用户是被挑战者 target）
    const challengeId = event.challengeId || '';
    if (challengeId) {
      try {
        const { data: challenges } = await db.collection('challenges')
          .where({ _id: challengeId, targetOpenid: OPENID, status: 'pending' })
          .get();
        if (challenges.length > 0) {
          const ch = challenges[0];
          let result;
          if (totalScore > ch.challengerScore) result = 'target_win';
          else if (totalScore < ch.challengerScore) result = 'challenger_win';
          else result = 'draw';
          await db.collection('challenges').doc(ch._id).update({
            data: {
              targetScore: totalScore,
              targetTier: tier.name,
              status: 'completed',
              result,
              completedAt: new Date(),
            },
          });
          console.log(`[submitScore] 挑战已结算: ${ch._id} result=${result}`);
        }
      } catch (e) {
        console.log(`[submitScore] 挑战结算失败: ${e.message}`);
      }
    }

    // 记录分享转化（如有 from_uid 参数，即邀请人 openid）
    if (event.fromUid && event.fromUid !== OPENID) {
      try {
        // 更新分享日志
        const { data: shareLogs } = await db.collection('share_logs')
          .where({ _openid: event.fromUid })
          .orderBy('sharedAt', 'desc')
          .limit(1)
          .get();

        if (shareLogs.length > 0) {
          await db.collection('share_logs')
            .doc(shareLogs[0]._id)
            .update({
              data: { clicks: _.inc(1) },
            });
        }

        // 构建双向好友关系（修复3：分享链 → 好友图谱）
        const now = new Date();
        await upsertFriendship(event.fromUid, OPENID, now);
      } catch (e) {
        console.log('[submitScore] share_log/friendship 更新失败:', e.message);
      }
    }

    console.log(`[submitScore] openid=${OPENID.slice(0,8)}... score=${totalScore} tier=${tier.name} isNewHighest=${isNewHighest}`);

    return {
      code: 0,
      message: 'ok',
      data: {
        totalScore: displayScore,
        rawScore: totalScore,  // 深度模式下的原始100分制分数
        isDeepMode,
        tier: tier.name,
        tierEmoji: tier.emoji,
        percentile,
        nextTier: nextTier ? nextTier.name : null,
        pointsToNext,
        isNewHighest,
        prevTier: previousTier,
        tierChanged: tierChanged || false,
        isFirstTime: !user._id,
        radarData: {
          dimensions: ['信息感知', '工具应用', '内容辨别', '时代心态', '思维深度'],
          values: radarValues,
        },
        persona,
        commentary,
        tierCommentary: tierCommentaries[tier.name] || '',
        knowledgeCards,
        evolutionTip,
      },
    };
  } catch (err) {
    console.error('[submitScore] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

// 双向好友关系写入（幂等 upsert：userA ↔ userB）
async function upsertFriendship(openidA, openidB, timestamp) {
  const users = [openidA, openidB].sort(); // 字典序保证唯一性
  const pairId = `${users[0]}_${users[1]}`;
  try {
    await db.collection('friendships').where({ pairId }).get().then(async ({ data }) => {
      if (data.length === 0) {
        await db.collection('friendships').add({
          data: {
            pairId,
            userA: users[0],
            userB: users[1],
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        console.log(`[submitScore] friendship created: ${users[0]} ↔ ${users[1]}`);
      } else {
        await db.collection('friendships').where({ pairId }).update({
          data: { updatedAt: timestamp },
        });
      }
    });
  } catch (e) {
    console.log('[submitScore] upsertFriendship 失败:', e.message);
  }
}
