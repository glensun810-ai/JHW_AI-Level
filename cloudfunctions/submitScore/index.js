const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 知识卡内容库
const KNOWLEDGE_CARDS = require('./cards-data.js');

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
  const PERSONAS = [
    { name: 'AI 原住民',    emoji: '🧬', description: '你生来就属于 AI 时代。对新技术充满热情，敢于尝试，愿意投入时间探索 AI 的边界。你的开放心态让你在每个 AI 新浪潮中都能站在前沿。', rarity: 12, rule: (r) => r[0] >= 70 && r[1] >= 70 && r[2] >= 70 },
    { name: '谨慎的探索者', emoji: '🔍', description: '你对 AI 充满好奇但保持清醒。不盲从，不抗拒，每一步都走得扎实。这份谨慎在 AI 狂飙的时代恰恰是最稀缺的品质。', rarity: 15, rule: (r) => r[1] >= 60 && r[4] >= 70 },
    { name: '激进的AI信徒', emoji: '🤖', description: '你相信 AI 能改变一切，并且已经在用行动证明。你不怕试错，只怕错过。这股冲劲让你在 AI 工具应用上远超同龄人。', rarity: 8, rule: (r) => r[0] >= 80 && r[2] >= 60 },
    { name: '冷酷的理性派', emoji: '🧊', description: '你不轻易被 AI 的 hype 打动，习惯用数据和逻辑评判一切。在人人都在狂热时，你的冷静是最珍贵的制衡力量。', rarity: 10, rule: (r) => r[4] >= 80 && r[3] >= 70 },
    { name: '热血的实践者', emoji: '🔥', description: '你不满足于"知道"，一定要"做到"。每当学会一个新 AI 用法，你的第一反应是立刻用起来。行动力是你最大的天赋。', rarity: 18, rule: (r) => r[1] >= 70 && r[2] <= 40 },
    { name: '佛系的工具人', emoji: '😌', description: '你对 AI 的态度松弛而务实——好用就用，不好用就换。这份松弛让你避免了 AI 焦虑，反而能更持久地走下去。', rarity: 22, rule: (r) => r[3] <= 40 && r[1] >= 50 },
    { name: '时代的旁观者', emoji: '👀', description: '你保持着一种难得的距离感，不急着跳进去，而是先观察。这份审慎让你能看清别人忽视的东西。', rarity: 6, rule: (r) => r[0] <= 40 && r[3] <= 40 },
    { name: '传统的守望者', emoji: '🏛️', description: '你尊重经过时间检验的智慧，不轻易被新技术动摇。但你也知道什么时候该拥抱变化——这份平衡感极为珍贵。', rarity: 4, rule: (r) => r[3] >= 70 && r[4] <= 30 },
    { name: '均衡的进化者', emoji: '⚖️', description: '你在 AI 使用的各个维度上均衡发展，没有明显短板。这份全面性让你能从容应对各种 AI 场景，未来的进化方向由你自己定义。', rarity: 5, rule: () => true },
  ];
  for (const p of PERSONAS) {
    if (p.rule(radarValues)) return { name: p.name, emoji: p.emoji, description: p.description, rarity: p.rarity };
  }
  return { name: '均衡的进化者', emoji: '⚖️', description: PERSONAS[8].description, rarity: 5 };
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
// 段位点评（每个段位 2-3 个变体，随机抽取）
const tierCommentaries = {
  '萌新': [
    '你跟 AI 的关系，大概相当于你跟健身卡的关系——知道它存在，但没怎么用过。',
    '欢迎来到 AI 世界！每个大佬都曾是萌新，你今天迈出的这一步已经超过了 90% 的人。',
    'AI 时代的第一张入场券已到手。别急，慢慢来——进化是一步步的事。',
  ],
  '调戏师': [
    '你让 AI 给你讲了个笑话，然后 AI 给你打了个分：幽默感 3/10，好奇心 9/10。',
    '你已经发现了 AI 最好玩的一面——好奇心是进化最好的燃料。',
    '调戏 AI 是门手艺。你已经在练习了，只是 AI 的幽默感还不太稳定。',
  ],
  '工具人': [
    'AI 说：这个人类挺会用的，就是每次结尾都加"谢谢"，搞得我怪不好意思的。',
    '实用主义者！你不在乎 AI 浪不浪漫，只在乎它好不好用。这种务实态度在 AI 时代很稀缺。',
    '你已经把 AI 变成了生产力工具，下一步就是让它从"好用"变成"离不开"。',
  ],
  '协作者': [
    '你俩配合得不错——你出想法，AI 出体力，像极了偶像和幕后团队的关系。',
    '你找到了和 AI 相处的最佳距离：不远不近，不卑不亢。这就是"协作"的真谛。',
    'AI 已经开始理解你的风格了——这说明你们已经磨合出了默契。',
  ],
  '驾驭者': [
    '你把 AI 开出了手动挡的感觉——谁说 AI 不能弹射起步？',
    '你已经不是在使用 AI，而是在驾驭 AI。方向盘在你手里，AI 只是你的引擎。',
    'AI 在你的手里服服帖帖——这种掌控感来自于你对它能力的深度理解。',
  ],
  '炼金术士': [
    '你在尝试把 AI 变成金子。有时候烧出来是金子，有时候是焦炭，但你一直在试，这就很酷。',
    '你在做一件很酷的事：把提示词炼成金。每一条好 prompt 都是你的独家配方。',
    '炼金的过程就是进化的过程。每一次尝试，无论成败，都在积累你的"炼金术"。',
  ],
  '觉醒者': [
    '你已经到了"没有 AI 也能活，但有 AI 活更好"的境界。AI 说：有点怕你。',
    '觉醒意味着你知道 AI 的能与不能。这种清醒在 AI 狂热的时代里格外珍贵。',
    '你是 AI 的使用者，不是 AI 的奴隶。这份"觉知"就是你和别人最大的区别。',
  ],
  '无界': [
    'AI 想给你打分，但发现你不按套路来。你们的关系已经超出了我的理解范围，祝你幸福。',
    '无界不是终点，是新的起点。你已经不需要段位来衡量自己了——你的每次使用都是创造。',
    '你超越了所有分类。AI 对你来说就像呼吸一样自然——这就是"无界"的意义。',
  ],
};

function getRandomCommentary(tierName) {
  const variants = tierCommentaries[tierName];
  if (!variants || variants.length === 0) return '';
  return variants[Math.floor(Math.random() * variants.length)];
}

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

// 知识卡匹配：每测必奖，高分进阶、低分补偿
function matchKnowledgeCards(answers, tierIndex, usedCardIds) {
  const cards = [];
  const used = new Set(usedCardIds || []);

  const avgScore = answers.length > 0
    ? answers.reduce((s, a) => s + a.score, 0) / answers.length
    : 5;

  // 筛选未收集的卡片
  const available = KNOWLEDGE_CARDS.filter(card => {
    if (used.has(card.id)) return false;
    const [minTier, maxTier] = card.tierRange;
    return tierIndex <= maxTier && tierIndex >= minTier - 1;
  });

  if (available.length === 0) return cards;

  // 按稀有度 + 匹配度排序
  const rarityWeight = { common: 0, rare: 1, legend: 2, limited: 3 };

  if (avgScore >= 8) {
    // 高分：优先稀有/传说卡，鼓励进阶
    available.sort((a, b) => {
      const rDiff = (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0);
      if (rDiff !== 0) return rDiff;
      return Math.abs(a.tierRange[0] - (tierIndex + 2)) - Math.abs(b.tierRange[0] - (tierIndex + 2));
    });
    addCard(available[0], cards, used, answers.length > 0 ? 0 : 0);
  } else if (avgScore <= 3) {
    // 低分：补偿 2 张基础卡
    available.sort((a, b) => (a.tierRange[0] || 0) - (b.tierRange[0] || 0));
    addCard(available[0], cards, used, 0);
    if (available.length > 1) {
      const remaining = available.filter(c => !used.has(c.id));
      if (remaining.length > 0) addCard(remaining[0], cards, used, 1);
    }
  } else {
    // 中分：匹配当前段位 ±1
    available.sort((a, b) =>
      Math.abs(a.tierRange[0] - tierIndex) - Math.abs(b.tierRange[0] - tierIndex)
    );
    addCard(available[0], cards, used, 0);
  }

  return cards;
}

function addCard(pick, cards, used, questionIndex) {
  if (!pick) return;
  used.add(pick.id);
  cards.push({
    questionIndex,
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
      rarity: pick.rarity || 'common',
    },
  });
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    // ── recordInvite：记录邀请关系（App.vue onShow 触发）──
    if (event.action === 'recordInvite' && event.inviterUid && event.inviterUid !== OPENID) {
      return await handleRecordInvite(OPENID, event.inviterUid);
    }

    // ── claimInviteUnlock：核销邀请解锁次数（index handleStart 触发）──
    if (event.action === 'claimInviteUnlock') {
      return await handleClaimInviteUnlock(OPENID);
    }

    // ── updateSubscribe：回写订阅消息状态 ──
    if (event.action === 'updateSubscribe') {
      return await handleUpdateSubscribe(OPENID, event.subscriptions);
    }

    // ── decryptGroupInfo：解密群聊分享数据获取 openGId ──
    if (event.action === 'decryptGroupInfo') {
      return await handleDecryptGroupInfo(OPENID, event.encryptedData, event.iv, event.code);
    }

    const { questionSetId, answers } = event;
    if (!answers || !Array.isArray(answers) || (answers.length !== 5 && answers.length !== 10)) {
      return { code: 400, message: '参数错误：answers 必须为5或10个元素的数组', data: null };
    }
    const isDeepMode = answers.length === 10;
    if (!questionSetId) {
      return { code: 400, message: '参数错误：缺少 questionSetId', data: null };
    }

    // UGC 内容安全检测：用户反馈文本 + 悬赏目标名
    const ugcTexts = (answers || [])
      .map(a => a.feedback)
      .filter(Boolean);
    if (event.targetName) ugcTexts.push(event.targetName);
    for (const txt of ugcTexts) {
      try {
        const secRes = await cloud.openapi.security.msgSecCheck({ content: txt });
        if (secRes.result.suggest === 'risky') {
          console.warn('[submitScore] msgSecCheck blocked risky content');
          return { code: 403, message: '内容违规', data: null };
        }
      } catch (secErr) {
        console.warn('[submitScore] msgSecCheck failed, degrade pass:', secErr.message);
      }
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

    // 查询用户当前数据（提前查询，供知识卡去重用）
    const { data: users } = await db.collection('users')
      .where({ _openid: OPENID })
      .get();

    const user = users[0] || {};

    // 知识卡匹配 + 进化建议（传入已收集卡ID去重）
    const tierIndex = TIERS.findIndex(t => t.name === tier.name);
    const answersWithScores = answers.map((ans, i) => ({
      score: qScores[i],
      questionId: ans.questionId,
    }));
    const userCollectedCards = user.collectedCards || [];
    const knowledgeCards = matchKnowledgeCards(answersWithScores, tierIndex, userCollectedCards);
    const evolutionTip = getEvolutionTip(tier.name, tierIndex);

    // 最强/最弱维度（从雷达图提取）
    const dimNames = ['信息感知', '工具应用', '内容辨别', '时代心态', '思维深度'];
    const maxVal = Math.max(...radarValues);
    const minVal = Math.min(...radarValues);
    const strongestDimIdx = radarValues.indexOf(maxVal);
    const weakestDimIdx = radarValues.indexOf(minVal);
    const strongestDimension = { name: dimNames[strongestDimIdx], value: maxVal };
    const weakestDimension = { name: dimNames[weakestDimIdx], value: minVal };

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
	      // 重复提交仍返回完整结果数据，确保用户始终看到结果页
	      return {
	        code: 0,
	        message: 'ok (duplicate)',
	        data: {
	          totalScore: displayScore,
	          rawScore: totalScore,
	          isDeepMode,
	          tier: tier.name,
	          tierEmoji: tier.emoji,
	          percentile,
	          nextTier: nextTier ? nextTier.name : null,
	          pointsToNext,
	          isNewHighest: false,
	          prevTier: previousTier || null,
	          tierChanged: false,
	          isFirstTime: !user._id,
	          isDuplicate: true,
	          radarData: {
	            dimensions: ['信息感知', '工具应用', '内容辨别', '时代心态', '思维深度'],
	            values: radarValues,
	          },
	          persona,
	          commentary,
	          tierCommentary: getRandomCommentary(tier.name),
	          knowledgeCards,
	          evolutionTip,
          strongestDimension,
          weakestDimension,
	        },
	      };
	    }

    // 写入测试记录（v0.8：增加 feedback 字段）

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
      testType: 'free',
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
          highestScore: clampedTierScore,
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
          // 归一化双方分数到 50 分制（deep mode 原始分最高 100）
          const normChScore = ch.challengerScore > 50 ? Math.round(ch.challengerScore / 2) : ch.challengerScore;
          const normTargetScore = clampedTierScore;
          let result;
          if (normTargetScore > normChScore) result = 'target_win';
          else if (normTargetScore < normChScore) result = 'challenger_win';
          else result = 'draw';
          await db.collection('challenges').doc(ch._id).update({
            data: {
              targetScore: clampedTierScore,
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

    // 段位悬赏：好友通过悬赏链接进入并完成测试，对比猜测段位 vs 实际段位
    const { bountyTier, targetName } = event;
    if (bountyTier && targetName && event.fromUid && event.fromUid !== OPENID) {
      try {
        const guessedIndex = TIERS.findIndex(t => t.name === bountyTier);
        const actualIndex = TIERS.findIndex(t => t.name === tier.name);
        const isCorrect = guessedIndex === actualIndex;
        await db.collection('bounty_results').add({
          data: {
            predictorOpenid: event.fromUid,
            targetOpenid: OPENID,
            targetName,
            guessedTier: bountyTier,
            actualTier: tier.name,
            actualScore: clampedTierScore,
            isCorrect,
            viewed: false,
            createdAt: new Date(),
          },
        });
        console.log(`[submitScore] 悬赏已记录: predictor=${event.fromUid.slice(0,8)}... guessed=${bountyTier} actual=${tier.name} correct=${isCorrect}`);

        // 推送通知给悬赏发起人（如果他们订阅了段位变化模板）
        try {
          await sendBountyNotification(event.fromUid, targetName, bountyTier, tier.name, isCorrect);
        } catch (notifyErr) {
          console.log('[submitScore] 悬赏通知发送失败:', notifyErr.message);
        }
      } catch (e) {
        console.log('[submitScore] 悬赏记录失败:', e.message);
      }
    }

    // 记录分享转化 + 构建好友关系 + 邀请解锁双向奖励
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

        // 构建双向好友关系
        const now = new Date();
        await upsertFriendship(event.fromUid, OPENID, now);

        // 邀请解锁：被邀请人完成测试 → 邀请人获得奖励
        await completeInviteReward(event.fromUid, OPENID, tier.name, isDeepMode);
      } catch (e) {
        console.log('[submitScore] share_log/friendship/invite 更新失败:', e.message);
      }
    }

    console.log(`[submitScore] openid=${OPENID.slice(0,8)}... score=${totalScore} tier=${tier.name} overLimit=removed`);

    return {
      code: 0,
      message: 'ok',
      data: {
        totalScore: displayScore,
        rawScore: totalScore,
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
        tierCommentary: getRandomCommentary(tier.name),
        knowledgeCards,
        evolutionTip,
        strongestDimension,
        weakestDimension,
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

// ── 邀请解锁：记录邀请关系 ──
async function handleRecordInvite(inviteeOpenid, inviterOpenid) {
  try {
    if (inviteeOpenid === inviterOpenid) {
      return { code: 400, message: '不能邀请自己', data: null };
    }
    const { data: existing } = await db.collection('invites')
      .where({ inviterOpenid, inviteeOpenid })
      .limit(1)
      .get();
    if (existing.length > 0) {
      return { code: 0, message: 'ok (duplicate)', data: null };
    }
    await db.collection('invites').add({
      data: {
        inviterOpenid,
        inviteeOpenid,
        completed: false,
        createdAt: new Date(),
      },
    });
    console.log(`[submitScore] invite recorded: ${inviterOpenid.slice(0, 8)}... -> ${inviteeOpenid.slice(0, 8)}...`);
    return { code: 0, message: 'ok', data: null };
  } catch (e) {
    console.log('[submitScore] handleRecordInvite 失败:', e.message);
    return { code: 500, message: '记录邀请失败', data: null };
  }
}

// ── 核销邀请解锁次数 ──
async function handleClaimInviteUnlock(openid) {
  try {
    const { data: users } = await db.collection('users').where({ _openid: openid }).get();
    if (users.length === 0) return { code: 0, message: 'no unlocks', data: { available: false } };
    const unlocks = users[0].inviteUnlocks || 0;
    if (unlocks <= 0) return { code: 0, message: 'no unlocks', data: { available: false } };
    await db.collection('users').where({ _openid: openid }).update({
      data: { inviteUnlocks: _.inc(-1), updatedAt: new Date() },
    });
    return { code: 0, message: 'unlock claimed', data: { available: true } };
  } catch (e) {
    console.log('[submitScore] handleClaimInviteUnlock 失败:', e.message);
    return { code: 500, message: '核销失败', data: { available: false } };
  }
}

// ── 更新订阅消息状态 ──
async function handleUpdateSubscribe(openid, subscriptions) {
  try {
    if (!subscriptions || Object.keys(subscriptions).length === 0) {
      return { code: 0, message: 'ok', data: null };
    }
    const { data: users } = await db.collection('users').where({ _openid: openid }).get();
    const subscribeList = Object.entries(subscriptions).map(([templateId, status]) => ({
      templateId,
      status,
      subscribedAt: new Date(),
    }));
    if (users.length > 0) {
      await db.collection('users').where({ _openid: openid }).update({
        data: { subscribeTemplates: subscribeList, updatedAt: new Date() },
      });
    }
    return { code: 0, message: 'ok', data: null };
  } catch (e) {
    console.log('[submitScore] handleUpdateSubscribe 失败:', e.message);
    return { code: 500, message: '更新订阅状态失败', data: null };
  }
}

// ── 解密群聊分享数据，获取 openGId 用于群排行 ──
async function handleDecryptGroupInfo(openid, encryptedData, iv, code) {
  try {
    if (!encryptedData || !iv) {
      return { code: 400, message: '缺少加密数据', data: null };
    }

    const crypto = require('crypto');

    // 尝试通过 code 获取 session_key 并解密
    if (code) {
      try {
        const https = require('https');
        const appId = cloud.getWXContext().APPID;
        // cloudbase 环境变量中配置的 AppSecret
        const appSecret = process.env.APP_SECRET || '';

        if (appSecret && appId) {
          const sessionRes = await new Promise((resolve, reject) => {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
            https.get(url, (res) => {
              let body = '';
              res.on('data', (chunk) => { body += chunk; });
              res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
              });
            }).on('error', reject);
          });

          if (sessionRes.session_key) {
            const sessionKey = Buffer.from(sessionRes.session_key, 'base64');
            const ivBuffer = Buffer.from(iv, 'base64');
            const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, ivBuffer);
            decipher.setAutoPadding(true);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            const data = JSON.parse(decrypted);

            if (data && data.openGId) {
              // 记录群会话
              await recordGroupSession(openid, data.openGId);
              return { code: 0, message: 'ok', data: { openGId: data.openGId } };
            }
          }
        }
      } catch (decryptErr) {
        console.log('[submitScore] 解密群数据失败，使用 shareTicket 降级:', decryptErr.message);
      }
    }

    // 降级方案：使用 encryptedData hash 作为群标识（同一群聊分享的 encryptedData 相同）
    const groupHash = crypto.createHash('md5').update(encryptedData).digest('hex').substring(0, 16);
    await recordGroupSession(openid, groupHash);
    return { code: 0, message: 'fallback', data: { openGId: groupHash } };
  } catch (e) {
    console.log('[submitScore] handleDecryptGroupInfo 失败:', e.message);
    return { code: 500, message: '解密失败', data: null };
  }
}

// ── 发送段位悬赏结果通知 ──
async function sendBountyNotification(predictorOpenid, targetName, guessedTier, actualTier, isCorrect) {
  try {
    const { data: users } = await db.collection('users').where({ _openid: predictorOpenid }).get();
    if (users.length === 0) return;

    const user = users[0];
    const subs = user.subscribeTemplates || [];
    const bountySub = subs.find(s => s.templateId === 'tierChangeReminder' && s.status === 'active');
    if (!bountySub) return;

    const resultEmoji = isCorrect ? '🎯' : '😅';
    const resultText = isCorrect ? '猜对了！' : '猜错了…';

    await cloud.openapi.subscribeMessage.send({
      touser: predictorOpenid,
      templateId: 'tierChangeReminder',
      page: '/pages/rank/rank',
      data: {
        thing1: { value: `${targetName} 的测试结果` },
        thing2: { value: `${resultEmoji} 你猜「${guessedTier}」→ 实际「${actualTier}」` },
        thing3: { value: resultText },
        time4: { value: new Date().toLocaleString('zh-CN', { hour12: false }) },
      },
    });
    console.log(`[submitScore] 悬赏通知已发送: predictor=${predictorOpenid.slice(0, 8)}...`);
  } catch (e) {
    // 订阅消息发送失败不阻塞主流程
    console.log('[submitScore] sendBountyNotification 失败:', e.message);
  }
}

// ── 记录群会话 ──
async function recordGroupSession(openid, openGId) {
  try {
    const db = cloud.database();
    await db.collection('group_sessions').add({
      data: { openGId, openid, enterTime: new Date() },
    });
  } catch (e) {
    console.log('[submitScore] recordGroupSession 失败:', e.message);
  }
}

// ── 邀请完成双向奖励 ──
async function completeInviteReward(inviterOpenid, inviteeOpenid, inviteeTier, isDeepMode) {
  try {
    const { data: invites } = await db.collection('invites')
      .where({ inviterOpenid, inviteeOpenid, completed: false })
      .limit(1)
      .get();

    if (invites.length === 0) return;

    await db.collection('invites').doc(invites[0]._id).update({
      data: { completed: true, completedAt: new Date(), inviteeTier },
    });

    await db.collection('users').where({ _openid: inviterOpenid }).update({
      data: { inviteUnlocks: _.inc(1), updatedAt: new Date() },
    });

    console.log(`[submitScore] invite completed: ${inviterOpenid.slice(0, 8)}... rewarded +1 unlock`);
  } catch (e) {
    console.log('[submitScore] completeInviteReward 失败:', e.message);
  }
}
