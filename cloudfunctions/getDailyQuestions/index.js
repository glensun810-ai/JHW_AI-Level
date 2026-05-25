const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SALT = 'evolution-bay-v0.8';

// 周几 → 主主题
const DAY_THEME_MAP = {
  0: 'life',           // 周日：生活+综合
  1: 'tech',           // 周一：科技热点
  2: 'workplace',      // 周二：职场（混合）
  3: 'workplace',      // 周三：职场应用
  4: 'fun',            // 周四：趣味（混合）
  5: 'fun',            // 周五：趣味脑洞
  6: 'life',           // 周六：生活+综合
};

// 每日主题配额：{ theme: count }
const DAY_QUOTA_MAP = {
  0: { life: 2, comprehensive: 2, fun: 1 },          // 周日：生活+综合
  1: { tech: 3, fun: 1, comprehensive: 1 },           // 周一：科技为主
  2: { tech: 1, workplace: 1, fun: 1, life: 1, comprehensive: 1 }, // 周二：混合
  3: { workplace: 3, tech: 1, life: 1 },              // 周三：职场为主
  4: { tech: 1, workplace: 1, fun: 1, life: 1, comprehensive: 1 }, // 周四：混合
  5: { fun: 3, tech: 1, life: 1 },                    // 周五：趣味为主
  6: { life: 2, comprehensive: 2, fun: 1 },           // 周六：生活+综合
};

// 缓存（云函数实例级）
let cache = { date: '', setIndex: -1, data: null };

// ── Mulberry32 PRNG ──
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function seededShuffle(array, seed) {
  const random = mulberry32(hashCode(seed));
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function seededPick(array, seed, count) {
  return seededShuffle(array, seed).slice(0, count);
}

// ── 特殊题目识别（用于保护规则）──
function isPrivacyQuestion(q) {
  const stems = ['客户信息', '数据安全', '隐私'];
  return stems.some(s => (q.stem || '').includes(s));
}

function isHallucinationQuestion(q) {
  const stems = ['幻觉', '融资事件', '事实核查', 'AI 输出'];
  return stems.some(s => (q.stem || '').includes(s)) && q.dimension === 'content_discern';
}

function isHighFunQuestion(q) {
  const stems = ['做一顿饭', '假装成一个产品经理', '妈妈的生日'];
  return stems.some(s => (q.stem || '').includes(s));
}

// ── 难度分层 ──
function getDifficultyTier(difficulty) {
  if (difficulty <= 2) return 'easy';
  if (difficulty <= 4) return 'medium';
  return 'hard'; // difficulty 5
}

// ── 选项随机化 ──
const LABELS = ['A', 'B', 'C', 'D'];

const TAG_POOL_LOW = ['保守派 🐢', '随大流 🐑', '摸鱼大师 🐟', '观望者 👀', '佛系青年 😌'];
const TAG_POOL_MID = ['实用主义 🛠️', '平衡高手 ⚖️', '老实人 😇', '稳健派 🧘', '中间路线 🛤️'];
const TAG_POOL_HIGH = ['AI信徒 🤖', '卷王 👑', '先行者 🚀', '开拓者 ⛏️', '冒险家 🧗'];

function pickRandomTag(pool, seed) {
  const rng = mulberry32(hashCode(seed));
  return pool[Math.floor(rng() * pool.length)];
}

function getTagForScore(score, seed) {
  if (score <= 3) return pickRandomTag(TAG_POOL_LOW, seed);
  if (score <= 6) return pickRandomTag(TAG_POOL_MID, seed);
  return pickRandomTag(TAG_POOL_HIGH, seed);
}

function shuffleQuestionOptions(q, seed) {
  if (!q.options || q.options.length < 2) return q;
  const tuples = q.options.map((opt, i) => ({
    text: opt,
    score: q.scores?.[i] ?? 0,
    commentary: q.commentary?.[i] ?? '',
    originalIndex: i,
  }));
  const shuffled = seededShuffle(tuples, seed + '-opts');

  const optionTags = shuffled.map((t, i) => getTagForScore(t.score, `${seed}-tag-${i}`));

  let optionDistribution = null;
  if (q._distribution) {
    optionDistribution = shuffled.map(t => q._distribution[t.originalIndex] ?? 0);
    const sum = optionDistribution.reduce((a, b) => a + b, 0);
    if (sum > 0) optionDistribution = optionDistribution.map(v => Math.round(v / sum * 100));
  }

  return {
    ...q,
    options: shuffled.map((t, i) => `${LABELS[i]}. ${t.text.replace(/^[A-D][.、\s]+/, '')}`),
    scores: shuffled.map(t => t.score),
    commentary: shuffled.map(t => t.commentary),
    optionTags,
    optionDistribution,
  };
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 按难度分层选取题目 ──
// 动态目标：easy: ~20%, medium: ~60%, hard: ~20%
function selectWithDifficultyBalance(pool, count, seed) {
  if (pool.length <= count) return pool;

  const easy = pool.filter(q => getDifficultyTier(q.difficulty) === 'easy');
  const medium = pool.filter(q => getDifficultyTier(q.difficulty) === 'medium');
  const hard = pool.filter(q => getDifficultyTier(q.difficulty) === 'hard');

  const targetEasy = Math.max(1, Math.round(count * 0.2));
  const targetHard = Math.max(1, Math.round(count * 0.2));
  const targetMedium = count - targetEasy - targetHard;

  const selected = [];

  // 选 easy
  if (easy.length > 0) {
    selected.push(...seededPick(easy, `${seed}-easy`, Math.min(targetEasy, easy.length)));
  }

  // 选 hard
  if (hard.length > 0) {
    selected.push(...seededPick(hard, `${seed}-hard`, Math.min(targetHard, hard.length)));
  }

  // 剩余的从 medium 中选（不够则从全部剩余中补）
  const remaining = count - selected.length;
  if (medium.length > 0) {
    selected.push(...seededPick(medium, `${seed}-medium`, Math.min(remaining, medium.length)));
  }

  // 仍不够，从所有未选中题目中补
  if (selected.length < count) {
    const selectedIds = new Set(selected.map(q => q._id));
    const rest = pool.filter(q => !selectedIds.has(q._id));
    const stillNeed = count - selected.length;
    selected.push(...seededPick(rest, `${seed}-fill`, stillNeed));
  }

  return seededShuffle(selected.slice(0, count), `${seed}-final`);
}

// ── 主函数 ──
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;
    const date = event.date || getToday();
    const setIndex = event.setIndex || 0;
    const questionCount = event.count || 5; // v0.9: 支持深度定段(10题)

    // 检查实例缓存
    const cacheKey = `${date}-${setIndex}-${questionCount}`;
    if (cache.date === date && cache.setIndex === setIndex && cache.data) {
      console.log(`[getDailyQuestions] 缓存命中 ${cacheKey}`);
      return cache.data;
    }

    const dayOfWeek = new Date(date).getDay();
    const primaryTheme = DAY_THEME_MAP[dayOfWeek] || 'comprehensive';
    const baseQuota = DAY_QUOTA_MAP[dayOfWeek] || { tech: 1, workplace: 1, fun: 1, life: 1, comprehensive: 1 };
    // v0.9: 深度模式按比例放大配额
    const scale = questionCount / 5;
    const quota = {};
    for (const [k, v] of Object.entries(baseQuota)) {
      quota[k] = Math.round(v * scale);
    }

    console.log(`[getDailyQuestions] date=${date} day=${dayOfWeek} primary=${primaryTheme} count=${questionCount} openid=${OPENID.slice(0, 8)}...`);

    // Step 1: 查询用户近 20 天已做过的题目（去重）
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000);
    let seenQuestionIds = new Set();
    try {
      const { data: recentRecords } = await db.collection('test_records')
        .where({
          _openid: OPENID,
          createdAt: _.gte(twentyDaysAgo),
        })
        .field({ answers: true })
        .limit(200)
        .get();

      for (const rec of (recentRecords || [])) {
        for (const ans of (rec.answers || [])) {
          if (ans.questionId) seenQuestionIds.add(ans.questionId);
        }
      }
      console.log(`[getDailyQuestions] 用户近20天答题 ${recentRecords.length} 次，去重题数 ${seenQuestionIds.size}`);
    } catch (e) {
      console.warn('[getDailyQuestions] 去重查询失败，跳过:', e.message);
    }

    // Step 2: 查询所有启用题目
    const { data: allQuestions } = await db.collection('questions')
      .where({ status: 'active' })
      .field({ _id: true, stem: true, emoji: true, options: true, scores: true, commentary: true, dimension: true, theme: true, difficulty: true })
      .get();

    if (allQuestions.length < questionCount) {
      return { code: 400, message: `题库不足（至少需要 ${questionCount} 题），请联系运营补充`, data: null };
    }

    // Step 3: 过滤已做题（保留至少 10 题的缓冲，防止某天无题可选）
    let availableQuestions = allQuestions.filter(q => !seenQuestionIds.has(q._id));
    if (availableQuestions.length < 10) {
      // 放宽：只排除近 7 天的
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const recentIds = new Set();
      try {
        const { data: recentRecs } = await db.collection('test_records')
          .where({ _openid: OPENID, createdAt: _.gte(sevenDaysAgo) })
          .field({ answers: true })
          .limit(200)
          .get();
        for (const rec of (recentRecs || [])) {
          for (const ans of (rec.answers || [])) {
            if (ans.questionId) recentIds.add(ans.questionId);
          }
        }
      } catch (e) { /* ignore */ }
      availableQuestions = allQuestions.filter(q => !recentIds.has(q._id));
      console.log(`[getDailyQuestions] 放宽去重：20天→7天，可用 ${availableQuestions.length} 题`);
    }

    if (availableQuestions.length < questionCount) {
      // 最终降级：从所有题中选
      availableQuestions = allQuestions;
      console.log('[getDailyQuestions] 最终降级：使用全部题库');
    }

    // Step 4: 按主题分组
    const themePools = {};
    for (const theme of ['tech', 'workplace', 'fun', 'life', 'comprehensive']) {
      themePools[theme] = availableQuestions.filter(q => q.theme === theme);
    }

    const seed = `${date}-${SALT}-${setIndex}`;
    const selectedQuestions = [];

    // Step 5: 按配额从各主题池中选题（带难度均衡）
    for (const [theme, count] of Object.entries(quota)) {
      const pool = themePools[theme] || [];
      if (pool.length === 0) {
        console.warn(`[getDailyQuestions] 主题「${theme}」无可用题目`);
        continue;
      }
      const picked = selectWithDifficultyBalance(pool, count, `${seed}-${theme}`);
      selectedQuestions.push(...picked);
    }

    // 如果配额选题不足，从其他池补
    if (selectedQuestions.length < questionCount) {
      const selectedIds = new Set(selectedQuestions.map(q => q._id));
      const remaining = availableQuestions.filter(q => !selectedIds.has(q._id));
      const need = questionCount - selectedQuestions.length;
      const fill = seededPick(remaining, `${seed}-fill`, need);
      selectedQuestions.push(...fill);
      console.log(`[getDailyQuestions] 配额不足，补充 ${fill.length} 题`);
    }

    // Step 6: 特殊保护规则

    // 6a. 隐私安全题每周至少出现一次（周一确保包含）
    if (dayOfWeek === 1) {
      const hasPrivacy = selectedQuestions.some(q => isPrivacyQuestion(q));
      if (!hasPrivacy) {
        const privacyQuestions = availableQuestions.filter(q => isPrivacyQuestion(q) && !selectedQuestions.find(s => s._id === q._id));
        if (privacyQuestions.length > 0) {
          // 替换最后一题
          const replacement = seededPick(privacyQuestions, `${seed}-privacy`, 1)[0];
          selectedQuestions[selectedQuestions.length - 1] = replacement;
          console.log(`[getDailyQuestions] 隐私安全保护：强制加入 "${replacement.stem.slice(0, 30)}..."`);
        }
      }
    }

    // 6b. AI幻觉识别题每周至少出现一次（周三确保包含）
    if (dayOfWeek === 3) {
      const hasHallucination = selectedQuestions.some(q => isHallucinationQuestion(q));
      if (!hasHallucination) {
        const hallucinationQuestions = availableQuestions.filter(q => isHallucinationQuestion(q) && !selectedQuestions.find(s => s._id === q._id));
        if (hallucinationQuestions.length > 0) {
          const replacement = seededPick(hallucinationQuestions, `${seed}-hallucination`, 1)[0];
          selectedQuestions[selectedQuestions.length - 2] = replacement;
          console.log(`[getDailyQuestions] 幻觉识别保护：强制加入 "${replacement.stem.slice(0, 30)}..."`);
        }
      }
    }

    // 6c. 高趣味题周五必包含 1 题
    if (dayOfWeek === 5) {
      const hasHighFun = selectedQuestions.some(q => isHighFunQuestion(q));
      if (!hasHighFun) {
        const funQuestions = availableQuestions.filter(q => isHighFunQuestion(q) && !selectedQuestions.find(s => s._id === q._id));
        if (funQuestions.length > 0) {
          // 替换一道 fun 主题题（或最后一道）
          const funIdx = selectedQuestions.findIndex(q => q.theme === 'fun');
          const replaceIdx = funIdx >= 0 ? funIdx : selectedQuestions.length - 1;
          const replacement = seededPick(funQuestions, `${seed}-highfun`, 1)[0];
          selectedQuestions[replaceIdx] = replacement;
          console.log(`[getDailyQuestions] 周五高趣味保护：强制加入 "${replacement.stem.slice(0, 30)}..."`);
        }
      }
    }

    // Step 7: 最终打乱顺序（保证多样性）
    const finalQuestions = seededShuffle(selectedQuestions.slice(0, questionCount), `${seed}-final`);

    // 记录难度分布日志
    const diffDist = finalQuestions.map(q => q.difficulty);
    const themeDist = finalQuestions.map(q => q.theme);
    console.log(`[getDailyQuestions] 选题完成 themes=[${themeDist}] difficulties=[${diffDist}]`);

    // Step 8: 查询选项分布数据（近 7 天 test_records）
    const allQuestionIds = finalQuestions.map(q => q._id);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    let distributionMap = {};
    try {
      const { data: records } = await db.collection('test_records')
        .where({
          'answers.questionId': _.in(allQuestionIds),
          createdAt: _.gte(sevenDaysAgo),
        })
        .field({ answers: true })
        .limit(500)
        .get();

      const counts = {};
      for (const rec of records) {
        for (const ans of (rec.answers || [])) {
          if (!ans.questionId) continue;
          const key = ans.questionId;
          if (!counts[key]) counts[key] = [0, 0, 0, 0];
          const idx = ans.selectedIndex;
          if (idx >= 0 && idx < 4) counts[key][idx] = (counts[key][idx] || 0) + 1;
        }
      }
      for (const [qId, cnts] of Object.entries(counts)) {
        const total = cnts.reduce((a, b) => a + b, 0);
        distributionMap[qId] = total > 0
          ? cnts.map(c => Math.round(c / total * 100))
          : [25, 25, 25, 25];
      }
    } catch (e) {
      console.log('[getDailyQuestions] 选项分布查询失败，降级:', e.message);
    }

    // Step 9: 附加分布数据 + 选项随机排列
    const questionsWithShuffledOptions = finalQuestions.map((q, i) => {
      const qWithDist = { ...q, _distribution: distributionMap[q._id] || null };
      return shuffleQuestionOptions(qWithDist, `${seed}-q${i}`);
    });

    const questionSetId = `${date}-${primaryTheme}-${setIndex}`;

    const result = {
      code: 0,
      message: 'ok',
      data: {
        questionSetId,
        date,
        theme: primaryTheme,
        questions: questionsWithShuffledOptions,
      },
    };

    cache = { date, setIndex, data: result };

    return result;
  } catch (err) {
    console.error('[getDailyQuestions] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};
