const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 知识卡内容库
const KNOWLEDGE_CARDS = require('./cards-data.js');

// 段位定义 — v0.6 进化叙事流
const TIERS = [
  { name: '萌新',     emoji: '🐣', min: 5,  max: 9  },
  { name: '探索者',   emoji: '💬', min: 10, max: 18 },
  { name: '实践者',   emoji: '🛠️', min: 19, max: 27 },
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
    { name: '佛系的实践者', emoji: '😌', description: '你对 AI 的态度松弛而务实——好用就用，不好用就换。这份松弛让你避免了 AI 焦虑，反而能更持久地走下去。', rarity: 22, rule: (r) => r[3] <= 40 && r[1] >= 50 },
    { name: '时代的旁观者', emoji: '👀', description: '你保持着一种难得的距离感，不急着跳进去，而是先观察。这份审慎让你能看清别人忽视的东西。', rarity: 6, rule: (r) => r[0] <= 40 && r[3] <= 40 },
    { name: '传统的守望者', emoji: '🏛️', description: '你尊重经过时间检验的智慧，不轻易被新技术动摇。但你也知道什么时候该拥抱变化——这份平衡感极为珍贵。', rarity: 4, rule: (r) => r[3] >= 70 && r[4] <= 30 },
    { name: '均衡的进化者', emoji: '⚖️', description: '你在 AI 使用的各个维度上均衡发展，没有明显短板。这份全面性让你能从容应对各种 AI 场景，未来的进化方向由你自己定义。', rarity: 5, rule: () => true },
  ];
  for (const p of PERSONAS) {
    if (p.rule(radarValues)) return { name: p.name, emoji: p.emoji, description: p.description, rarity: p.rarity };
  }
  return { name: '均衡的进化者', emoji: '⚖️', description: PERSONAS[8].description, rarity: 5 };
}

// Phase 5 Q0-1: 维度名→数组索引映射
const DIM_INDEX = {
  'info_awareness': 0,
  'tool_usage': 1,
  'content_discern': 2,
  'era_mindset': 3,
  'think_depth': 4,
};

// 基于题目实际 dimension 字段计算雷达图（修复：不再按数组位置硬编码）
function calcRadarData(qScores, questions) {
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const dimScores = [0, 0, 0, 0, 0];
  const dimCounts = [0, 0, 0, 0, 0];
  let usedDimensionField = false;

  for (let i = 0; i < qScores.length; i++) {
    let dim = -1;
    if (questions && questions[i] && questions[i].dimension) {
      dim = DIM_INDEX[questions[i].dimension] ?? -1;
      if (dim >= 0) usedDimensionField = true;
    }
    // 降级：无 questions 或 questions 无 dimension 时按数组索引映射
    if (dim < 0) {
      dim = i % 5;
    }
    dimScores[dim] += qScores[i] * 10;
    dimCounts[dim]++;
  }

  return [
    clamp(dimCounts[0] > 0 ? dimScores[0] / dimCounts[0] : 0),
    clamp(dimCounts[1] > 0 ? dimScores[1] / dimCounts[1] : 0),
    clamp(dimCounts[2] > 0 ? dimScores[2] / dimCounts[2] : 0),
    clamp(dimCounts[3] > 0 ? dimScores[3] / dimCounts[3] : 0),
    clamp(dimCounts[4] > 0 ? dimScores[4] / dimCounts[4] : 0),
  ];
}

// 从 test_record answers 中按维度聚合分数
// 优先使用题目实际 dimension；无 questions 时降级为按数组索引（兼容历史数据+好友匹配）
function calcDimensionScores(answers, questions) {
  const dimScores = [0, 0, 0, 0, 0];
  const dimCounts = [0, 0, 0, 0, 0];

  for (let i = 0; i < answers.length; i++) {
    let dim = -1;
    if (questions && questions[i] && questions[i].dimension) {
      dim = DIM_INDEX[questions[i].dimension] ?? -1;
    }
    // 降级：无 questions 时按数组索引映射（保持向后兼容）
    if (dim < 0) {
      dim = i % 5;
    }
    dimScores[dim] += (answers[i].score || 0);
    dimCounts[dim]++;
  }

  return [
    dimCounts[0] > 0 ? dimScores[0] / dimCounts[0] : 0,
    dimCounts[1] > 0 ? dimScores[1] / dimCounts[1] : 0,
    dimCounts[2] > 0 ? dimScores[2] / dimCounts[2] : 0,
    dimCounts[3] > 0 ? dimScores[3] / dimCounts[3] : 0,
    dimCounts[4] > 0 ? dimScores[4] / dimCounts[4] : 0,
  ];
}

// 余弦相似度
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// v0.8 AI 锐评（毒舌幽默风格）
// 段位点评（每个段位 2-3 个变体，随机抽取）
const tierCommentaries = {
  '萌新': [
    '你对新事物保持开放——这在新人里很珍贵。不过嘛，你跟 AI 的关系大概相当于你跟健身卡的关系：知道它存在，但没怎么用过 😏',
    '愿意来测 AI 段位，已经超过了大多数观望者。欢迎来到 AI 世界！就是目前你还在新手村门口溜达，该去打第一个小怪了 🐣',
    'AI 时代的第一张入场券已到手，这份行动力值得点赞。别急，进化是一步步的事——第一步可以从"打开 ChatGPT 随便问点什么"开始 😄',
  ],
  '探索者': [
    '你的好奇心已经被 AI 点燃了——这是进化最重要的燃料。虽然目前你更多是在"玩" AI，但玩耍本身就是最好的学习方式 🔍',
    '你已经发现了 AI 最有趣的一面，这种探索精神很难得。不过你的 AI 使用记录里，"让 AI 讲个笑话"占了半壁江山 😄',
    '敢于尝试新工具是稀有的品质，你已经在路上了。下一步：试试让 AI 帮你干一件正经事，效果可能会让你惊喜 ✨',
  ],
  '实践者': [
    '实用主义在 AI 时代是稀缺品——你不关心 AI 浪不浪漫，只在乎好不好用。不过 AI 偷偷说：这个人类每次结尾都加"谢谢"，搞得我怪不好意思的 😄',
    '在别人还在讨论 AI 会不会取代人类时，你已经用 AI 搞定了三件事。务实派就是 AI 时代的中坚力量 💪',
    '你已经把 AI 变成了生产力工具，这份务实态度很珍贵。下一步就是让 AI 从"好用"变成"离不开"——你已经很接近了',
  ],
  '协作者': [
    '你找到了和 AI 相处的最佳姿态：不远不近，不卑不亢。你们配合得很默契——你出想法，AI 出体力，像极了最佳拍档 🎭',
    'AI 已经开始理解你的工作风格了，这种默契不是一天练成的。能和人合作不难，能和 AI 合作得这么好，说明你沟通能力强',
    '协作能力是 AI 时代最被低估的技能，而你正在掌握它。你俩现在差不多一个眼神就懂了——继续保持这种默契',
  ],
  '驾驭者': [
    '你把 AI 用出了人车合一的感觉——精准、高效、掌控力十足。谁说 AI 不能弹射起步？你已经证明了 ⚡',
    '方向盘在你手里，AI 是你的引擎。这种掌控感来自于你对 AI 能力的深度理解——你已经不再是使用者，而是驾驭者',
    'AI 在你的手里服服帖帖，你让它往东它不敢往西。说实话，AI 在你面前的表现，让 AI 本人都觉得"这人比我还会用我" 😄',
  ],
  '炼金术士': [
    '你在做一件很酷的事：把提示词炼成金。每一条好 prompt 都是你的独家配方——虽然偶尔会炸实验室，但炼金术士不就是这样炼成的吗 🧪',
    '你的 prompt 技巧已经出神入化。你不是在使用 AI，你是在施展 AI 魔法——只是偶尔咒语念错，变出来的不是金子是青蛙 😏',
    '炼金的过程就是进化的过程。每一次尝试都在积累你的独家秘方——你已经不是普通用户，而是 AI 世界的魔法师 ✨',
  ],
  '觉醒者': [
    '觉醒意味着你知道 AI 的能与不能。这份清醒在 AI 狂热的时代里格外珍贵——AI 说：这个人不好忽悠，我有点紧张 🧠',
    '你不是 AI 的奴隶，而是它的主人。这份"觉知"让你和 99% 的用户不在同一个层次——你就是 AI 时代的"人间清醒"',
    '你已经到了"没有 AI 也能活，但有 AI 活更好"的境界。AI 在你面前就像一个被看穿底牌的魔术师——尊敬中带着一丝心虚 ✨',
  ],
  '无界': [
    '你超越了所有分类。AI 对你来说就像呼吸一样自然——AI 想给你打分，但发现你完全不按套路来，只能说：祝你幸福 🌊',
    '无界不是终点，是新的起点。你已经不需要段位来衡量自己了——说实话，我们这个小程序的评分系统已经不太够你用 😄',
    '你已经是造物主级别。每次使用 AI 都是创造而非消费——要不你来帮我们设计题目吧？我们需要你这样的人才 ✨',
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
    '探索者': [
      '你已经会逗 AI 了，下一步试试让它"扮演角色"来提升回答质量',
      'AI 的一句话差距：加上角色设定，输出质量可能提升 30%',
    ],
    '实践者': [
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

    // Phase 8: rewardShare — 分享即奖励，不等待好友完成测试
    if (event.action === 'rewardShare') {
      return await handleRewardShare(OPENID);
    }

    // ── updateSubscribe：回写订阅消息状态 ──
    if (event.action === 'updateSubscribe') {
      return await handleUpdateSubscribe(OPENID, event.subscriptions);
    }

    // ── decryptGroupInfo：解密群聊分享数据获取 openGId ──
    if (event.action === 'decryptGroupInfo') {
      return await handleDecryptGroupInfo(OPENID, event.encryptedData, event.iv, event.code);
    }

    // Phase 4: getLastResult — 获取最近一次测试结果（回顾模式 / 回访首页）
    if (event.action === 'getLastResult') {
      return await handleGetLastResult(OPENID);
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

    // Phase 5 Q1-3: 查询用户每题历史遇到次数（多版本 commentary 选择依据）
    let questionEncounterCounts = {};
    try {
      const { data: pastRecords } = await db.collection('test_records')
        .where({ _openid: OPENID })
        .field({ answers: true })
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get();
      for (const rec of (pastRecords || [])) {
        for (const ans of (rec.answers || [])) {
          if (ans.questionId) {
            questionEncounterCounts[ans.questionId] = (questionEncounterCounts[ans.questionId] || 0) + 1;
          }
        }
      }
    } catch (e) { /* 降级：全部用首版 commentary */ }

    // 独立计算总分（不再按固定索引重算—选项已随机排列）
    // 优先使用客户端发送的 score（客户端基于 shuffled scores 数组正确计算）
    // 服务端仅做防篡改校验：score 不在题目得分范围内则取最近的有效值
    answers.forEach((ans, i) => {
      const q = orderedQuestions[i];
      const clientScore = ans.score;
      const validScores = q.scores || [];
      const maxScore = Math.max(...validScores, 10);
      const minScore = Math.min(...validScores, 0);

      // 校验客户端分数是否在题目有效范围内
      let score;
      if (typeof clientScore === 'number' && clientScore >= minScore && clientScore <= maxScore) {
        score = clientScore;
      } else {
        // 防篡改：客户端分数异常时降级为原始索引查找
        const idx = ans.selectedIndex;
        score = validScores[idx] || 0;
      }

      qScores.push(score);
      totalScore += score;

      // Phase 5 Q1-3: 多版本 commentary 选择
      const rawComment = q.commentary ? q.commentary[idx] : '';
      if (Array.isArray(rawComment)) {
        // 多版本格式: ["首次", "二次", "三次"]
        const encounterCount = questionEncounterCounts[q._id] || 0;
        const versionIdx = Math.min(encounterCount, rawComment.length - 1);
        commentary.push(rawComment[versionIdx] || rawComment[0] || '');
      } else {
        commentary.push(rawComment || '');
      }
    });

    // 段位映射（深度模式：100分制 → 映射到50分制，统一存储）
    const tierScore = isDeepMode ? Math.round(totalScore / 2) : totalScore;
    const clampedTierScore = Math.min(50, Math.max(5, tierScore));
    const tier = getTier(clampedTierScore);
    const nextTier = getNextTier(clampedTierScore);
    const pointsToNext = nextTier ? nextTier.min - clampedTierScore : 0;
    const displayScore = tierScore; // 始终归一化到 0-50，AIQ 公式方可正确映射

    // 雷达图数据 + AI人格画像
    const radarValues = calcRadarData(qScores, orderedQuestions);
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

    // ── 连续签到计算 ──
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const lastTestDate = user.lastTestDate || '';
    const prevConsecutive = user.consecutiveDays || 0;
    const prevBest = user.streakBest || 0;

    let newConsecutiveDays;
    if (lastTestDate === today) {
      // 今天已测过（幂等保护的重复提交），保持 streak 不变
      newConsecutiveDays = prevConsecutive;
    } else if (lastTestDate === yesterday) {
      // 昨天测过 → 连续+1
      newConsecutiveDays = prevConsecutive + 1;
    } else {
      // 中断 → 重置为 1
      newConsecutiveDays = 1;
    }
    const newStreakBest = Math.max(newConsecutiveDays, prevBest);

    // 连续签到里程碑奖励
    const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
    const streakMilestoneHit = STREAK_MILESTONES.includes(newConsecutiveDays);
    const streakBroken = prevConsecutive >= 3 && newConsecutiveDays === 1;

    // 计算全国百分比（统一用 5-50 分制比较，保证普通/深度模式可比）
    const { total: totalUsers } = await db.collection('users')
      .where({ highestScore: _.gt(0) })
      .count();

    const { total: lowerCount } = await db.collection('users')
      .where({ highestScore: _.lt(clampedTierScore).and(_.gt(0)) })
      .count();

    // 前X% = 超越了多少比例的人 → 越高越好（top 20% = 只有20%的人在你前面）
    const percentile = totalUsers > 0
      ? Math.max(1, 100 - Math.floor((lowerCount / totalUsers) * 100))
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
          friendMatch: null,
          streak: {
            consecutiveDays: newConsecutiveDays,
            streakBest: newStreakBest,
            milestoneHit: false,
            streakBroken: false,
          },
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
            consecutiveDays: newConsecutiveDays,
            lastTestDate: today,
            streakBest: newStreakBest,
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
          consecutiveDays: 1,
          lastTestDate: today,
          streakBest: 1,
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

    // Phase 3: 检测超越关系（仅在新高分时触发）
    if (isNewHighest) {
      await detectOvertakes(OPENID, clampedTierScore, tier.name);
    }

    // 处理待接受的挑战（当前用户是被挑战者 target）
    const challengeId = event.challengeId || '';
    let challengeResult = null;
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
          challengeResult = {
            challengeId: ch._id,
            result,
            challengerName: ch.challengerName || '好友',
            challengerTier: ch.challengerTier || '',
            challengerScore: ch.challengerScore || 0,
            challengerOpenid: ch.challengerOpenid || '',
            myScore: clampedTierScore,
            myTier: tier.name,
          };
          console.log(`[submitScore] 挑战已结算: ${ch._id} result=${result}`);
          // P0-3: 通知挑战发起者结果
          await notifyChallengeResult(ch.challengerOpenid, ch.challengerName, clampedTierScore, tier.name, result);
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

        // Phase 7: 被邀请者也获得 +1 免费测试机会（仅首次测试，防刷）
        if (!user._id) {
          try {
            await db.collection('users').where({ _openid: OPENID }).update({
              data: { inviteUnlocks: _.inc(1), updatedAt: new Date() },
            });
            console.log(`[submitScore] 被邀请者首次奖励: ${OPENID.slice(0,8)}... +1 inviteUnlock`);
          } catch (e) {
            console.log('[submitScore] 被邀请者奖励写入失败:', e.message);
          }
        }
      } catch (e) {
        console.log('[submitScore] share_log/friendship/invite 更新失败:', e.message);
      }
    }

    // 好友匹配度：比较双方 AI 人格雷达图的余弦相似度
    let friendMatch = null;
    if (event.fromUid && event.fromUid !== OPENID) {
      try {
        const { data: inviterRecords } = await db.collection('test_records')
          .where({ _openid: event.fromUid })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (inviterRecords.length > 0) {
          const inviterScores = calcDimensionScores(inviterRecords[0].answers || []);
          const inviterRadar = calcRadarData(inviterScores);
          const similarity = cosineSimilarity(radarValues, inviterRadar);
          const { data: inviterUsers } = await db.collection('users')
            .where({ _openid: event.fromUid })
            .field({ nickname: true })
            .limit(1)
            .get();
          friendMatch = {
            nickname: (inviterUsers[0] && inviterUsers[0].nickname) || '好友',
            matchPercent: Math.round(similarity * 100),
          };
        }
      } catch (e) {
        console.log('[submitScore] 好友匹配度计算失败:', e.message);
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
        friendMatch,
        streak: {
          consecutiveDays: newConsecutiveDays,
          streakBest: newStreakBest,
          milestoneHit: streakMilestoneHit,
          streakBroken: streakBroken,
        },
        challengeResult,
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

// Phase 8: 分享即奖励 — 每天最多 3 次，无需等待好友完成测试
async function handleRewardShare(openid) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: users } = await db.collection('users').where({ _openid: openid }).get();
    if (users.length === 0) {
      // 新用户先创建记录
      await db.collection('users').add({
        data: {
          _openid: openid,
          inviteUnlocks: 1,
          shareRewardDate: today,
          shareRewardCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { code: 0, data: { available: true, inviteUnlocks: 1 } };
    }

    const user = users[0];
    const lastDate = user.shareRewardDate || '';
    const todayCount = lastDate === today ? (user.shareRewardCount || 0) : 0;

    // 每天最多 3 次分享奖励
    if (todayCount >= 3) {
      return { code: 0, data: { available: false, inviteUnlocks: user.inviteUnlocks || 0, message: '今日分享奖励已达上限' } };
    }

    await db.collection('users').where({ _openid: openid }).update({
      data: {
        inviteUnlocks: _.inc(1),
        shareRewardDate: today,
        shareRewardCount: todayCount + 1,
        updatedAt: new Date(),
      },
    });

    return { code: 0, data: { available: true, inviteUnlocks: (user.inviteUnlocks || 0) + 1 } };
  } catch (e) {
    console.log('[submitScore] handleRewardShare 失败:', e.message);
    return { code: 500, data: { available: false } };
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
    const BOUNTY_TEMPLATE_ID = process.env.BOUNTY_TEMPLATE_ID || '';
    if (!BOUNTY_TEMPLATE_ID) return;

    const bountySub = subs.find(s => s.templateId === BOUNTY_TEMPLATE_ID && s.status === 'accept');
    if (!bountySub) return;

    const resultEmoji = isCorrect ? '🎯' : '😅';
    const resultText = isCorrect ? '猜对了！' : '猜错了…';

    await cloud.openapi.subscribeMessage.send({
      touser: predictorOpenid,
      templateId: BOUNTY_TEMPLATE_ID,
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

// Phase 3: 发送"被超越"通知（模板：活动排名下降通知）
// 关键词：thing1(活动名称) number2(当前排名) number3(之前排名) thing4(备注)
async function sendOvertakeNotification(friend, surpasserOpenid, surpasserScore, surpasserTier, currentRank, previousRank) {
  try {
    const subs = friend.subscribeTemplates || [];
    const TIER_CHANGE_TEMPLATE_ID = process.env.TIER_CHANGE_TEMPLATE_ID || '';
    if (!TIER_CHANGE_TEMPLATE_ID) return;

    const tierChangeSub = subs.find(
      s => s.templateId === TIER_CHANGE_TEMPLATE_ID && s.status === 'accept'
    );
    if (!tierChangeSub) return;

    const { data: surpasserUsers } = await db.collection('users')
      .where({ _openid: surpasserOpenid })
      .field({ nickname: true })
      .get();
    const surpasserName = surpasserUsers.length > 0
      ? (surpasserUsers[0].nickname || '好友')
      : '好友';

    await cloud.openapi.subscribeMessage.send({
      touser: friend._openid,
      templateId: TIER_CHANGE_TEMPLATE_ID,
      page: '/pages/rank/rank',
      data: {
        thing1: { value: '进化湾AI段位排名' },
        number2: { value: String(currentRank) },
        number3: { value: String(previousRank) },
        thing4: { value: `${surpasserName}的AI段位（${surpasserTier}）超越了你，快来测测追回去` },
      },
    });
    console.log(`[submitScore] 超越通知已发送: surpasser=${surpasserOpenid.slice(0, 8)}... -> friend=${friend._openid.slice(0, 8)}... rank ${previousRank}→${currentRank}`);
  } catch (e) {
    console.log('[submitScore] sendOvertakeNotification 失败:', e.message);
  }
}

// Phase 3: 计算用户在好友中的段位排名
async function computeFriendRank(openid, score) {
  try {
    const { data: friendships } = await db.collection('friendships')
      .where(_.or([{ userA: openid }, { userB: openid }]))
      .get();
    if (friendships.length === 0) return 1;

    const friendIds = friendships.map(f => f.userA === openid ? f.userB : f.userA);
    const { data: friends } = await db.collection('users')
      .where({ _openid: _.in(friendIds) })
      .field({ highestScore: true })
      .get();

    const higherCount = friends.filter(f => (f.highestScore || 0) > score).length;
    return higherCount + 1;
  } catch (e) {
    return 1;
  }
}

// P0-3: 通知挑战发起者结果
async function notifyChallengeResult(challengerOpenid, challengerName, targetScore, targetTier, result) {
  try {
    const { data: users } = await db.collection('users').where({ _openid: challengerOpenid }).get();
    if (users.length === 0) return;
    const subs = users[0].subscribeTemplates || [];
    const CHALLENGE_NOTIFY_ID = process.env.CHALLENGE_NOTIFY_TEMPLATE_ID || '';
    if (!CHALLENGE_NOTIFY_ID) return;
    const sub = subs.find(s => s.templateId === CHALLENGE_NOTIFY_ID && s.status === 'accept');
    if (!sub) return;

    const resultText = result === 'target_win'
      ? `你被${challengerName}击败了！TA的AI商数超越了你`
      : result === 'challenger_win'
      ? `你击败了${challengerName}！但TA可能卷土重来`
      : `平局！你和${challengerName}旗鼓相当`;

    await cloud.openapi.subscribeMessage.send({
      touser: challengerOpenid,
      templateId: CHALLENGE_NOTIFY_ID,
      page: '/pages/rank/rank',
      data: {
        thing1: { value: 'AI段位挑战结果' },
        thing2: { value: `${challengerName}（${targetTier}）` },
        thing3: { value: resultText },
        time4: { value: new Date().toLocaleString('zh-CN', { hour12: false }) },
      },
    });
    console.log(`[submitScore] 挑战结果通知已发送: challenger=${challengerOpenid.slice(0, 8)}... result=${result}`);
  } catch (e) {
    console.log('[submitScore] notifyChallengeResult 失败:', e.message);
  }
}

// Phase 3: 检测超越关系
async function detectOvertakes(openid, newScore, newTier) {
  try {
    const { data: friendships } = await db.collection('friendships')
      .where(_.or([{ userA: openid }, { userB: openid }]))
      .get();
    if (friendships.length === 0) return;

    const friendIds = friendships.map(f => f.userA === openid ? f.userB : f.userA);

    const { data: friends } = await db.collection('users')
      .where({ _openid: _.in(friendIds) })
      .field({
        _openid: true, nickname: true,
        highestScore: true, currentTier: true,
        subscribeTemplates: true,
      })
      .get();
    if (friends.length === 0) return;

    // 获取用户上一次分数（第二条最新的 test_record）
    const { data: prevTests } = await db.collection('test_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get();
    const prevScore = prevTests.length >= 2
      ? Math.min(50, Math.max(5, (prevTests[1].totalScore || 0)))
      : 0;

    for (const friend of friends) {
      const friendScore = friend.highestScore || 0;
      if (friendScore > prevScore && newScore > friendScore) {
        console.log(`[submitScore] 检测到超越: ${openid.slice(0, 8)}... (${newScore}) 超越 ${friend._openid.slice(0, 8)}... (${friendScore})`);
        const currentRank = await computeFriendRank(friend._openid, friendScore);
        const previousRank = Math.max(1, currentRank - 1);
        await sendOvertakeNotification(friend, openid, newScore, newTier, currentRank, previousRank);
      }
    }
  } catch (e) {
    console.log('[submitScore] detectOvertakes 失败:', e.message);
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

// Phase 4: 获取最近一次测试完整结果（回访首页 + 结果页回顾模式）
async function handleGetLastResult(openid) {
  try {
    const { data: records } = await db.collection('test_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (records.length === 0) {
      return { code: 404, message: '暂无测试记录', data: null };
    }

    const record = records[0];

    // 关联查题目数据，重建 commentary
    const questionIds = record.answers.map(a => a.questionId);
    const { data: questions } = await db.collection('questions')
      .where({ _id: _.in(questionIds) })
      .get();

    const orderedQuestions = questionIds.map(id => questions.find(q => q._id === id));
    const qScores = [];
    const commentary = [];
    record.answers.forEach((ans, i) => {
      const q = orderedQuestions[i];
      if (q) {
        qScores.push(ans.score);
        const rawComment = q.commentary ? q.commentary[ans.selectedIndex] : '';
        commentary.push(Array.isArray(rawComment) ? (rawComment[0] || '') : (rawComment || ''));
      }
    });

    // 复用已有函数重建结果（深度模式归一化到 0-50）
    const isDeepMode = record.answers.length === 10;
    const tierScore = isDeepMode
      ? Math.min(50, Math.max(5, Math.round(record.totalScore / 2)))
      : Math.min(50, Math.max(5, record.totalScore));
    const tier = getTier(tierScore);
    const nextTier = getNextTier(tierScore);
    const radarValues = calcRadarData(qScores, orderedQuestions);
    const persona = getPersona(radarValues);

    // 近似 percentile
    const { total: totalUsers } = await db.collection('users')
      .where({ highestScore: _.gt(0) }).count();
    const { total: lowerCount } = await db.collection('users')
      .where({ highestScore: _.lt(tierScore).and(_.gt(0)) }).count();
    const percentile = totalUsers > 0
      ? Math.max(1, 100 - Math.floor((lowerCount / totalUsers) * 100))
      : 0;

    // 维度信息
    const dimNames = ['信息感知', '工具应用', '内容辨别', '时代心态', '思维深度'];
    const maxVal = Math.max(...radarValues);
    const minVal = Math.min(...radarValues);
    const strongestDimension = { name: dimNames[radarValues.indexOf(maxVal)], value: maxVal };
    const weakestDimension = { name: dimNames[radarValues.indexOf(minVal)], value: minVal };

    // streak 信息
    const { data: users } = await db.collection('users')
      .where({ _openid: openid })
      .field({ consecutiveDays: true, streakBest: true })
      .get();
    const user = users[0] || {};

    return {
      code: 0,
      data: {
        totalScore: record.totalScore,
        rawScore: record.totalScore,
        isDeepMode: record.answers.length === 10,
        tier: tier.name,
        tierEmoji: tier.emoji,
        percentile,
        nextTier: nextTier ? nextTier.name : null,
        pointsToNext: nextTier ? nextTier.min - tierScore : 0,
        isNewHighest: false,
        prevTier: record.prevTier || null,
        tierChanged: false,
        isFirstTime: false,
        isDuplicate: false,
        isReview: true,
        radarData: {
          dimensions: dimNames,
          values: radarValues,
        },
        persona,
        commentary,
        tierCommentary: getRandomCommentary(tier.name),
        evolutionTip: getEvolutionTip(tier.name, TIERS.findIndex(t => t.name === tier.name)),
        strongestDimension,
        weakestDimension,
        streak: {
          consecutiveDays: user.consecutiveDays || 0,
          streakBest: user.streakBest || 0,
          milestoneHit: false,
          streakBroken: false,
        },
      },
    };
  } catch (e) {
    console.error('[submitScore] handleGetLastResult 异常:', e.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
}
