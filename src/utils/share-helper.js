/**
 * 分享文案生成 — v0.8 第二批优化
 * 8 段位 × 4 风格 + 时间敏感 + 好友预测
 */

const COPIES = {
  0: {
    showoff: '🐣 AI萌新！迈出了AI世界的第一步，测测你是什么段位？',
    selfmock: '我测了3次还是萌新 🐣 谁来教教我？你也来测 →',
    challenge: '虽然我是萌新，但我不怂！不服来测！',
  },
  1: {
    showoff: '💬 AI调戏师！{score}分，我和AI的关系比较乱，你们呢？',
    selfmock: '调戏AI反被AI调戏 💬 我认了，你也来试试？',
    challenge: '你确定你敢来调戏AI？来测，比我高算你赢！',
  },
  2: {
    showoff: '🛠️ AI工具人！{score}分，{persona}，AI时代的中坚力量！',
    selfmock: 'AI说我是工具人 🛠️ 我不服！你来测测看你是什么？',
    challenge: '工具人也有尊严！来测，看看谁才是真正的打工人',
  },
  3: {
    showoff: '🤝 AI协作者！{score}分，我和AI会开周会了，你呢？',
    selfmock: '协作者…我和AI是搭档，但好像主要是它在帮我 🤝',
    challenge: 'AI协作？不服来测，看看你有多能协！',
  },
  4: {
    showoff: '⚡ AI驾驭者！{score}分，{persona}，我在开AI，不是被AI开！测测你的段位？',
    selfmock: '驾驭者…这匹马跑得太快，缰绳有点烫手 ⚡',
    challenge: '我是驾驭者，不服来测！比我高请你喝奶茶！',
  },
  5: {
    showoff: '🧪 AI炼金术士！{score}分，{persona}，AI炼丹中，勿扰。你也来炼一颗？',
    selfmock: '炼金术士…炉子热着呢，但炼出什么还不确定 🧪',
    challenge: '炼金术士在此！来测，能比我高分算你厉害！',
  },
  6: {
    showoff: '🧠 AI觉醒者！{score}分，{persona}，Neo本Neo，测测你的AI段位？',
    selfmock: '觉醒者…别飘，Agent还在学习我的习惯 🧠',
    challenge: '觉醒者在此！不服来测，赢了请你吃红色药丸 💊',
  },
  7: {
    showoff: '🌊 无界！{score}分，已超越人类定义，测测你离无界有多远？',
    selfmock: '无界…系统说我超越了人类 🌊 你们也来测测看',
    challenge: '无界在此！还有谁？来测，看看有没有第二个无界！',
  },
};

// A2: 时间上下文
function getTimeContext() {
  const h = new Date().getHours();
  if (h >= 6 && h < 9) return { emoji: '☀️', intro: '早起测段位' };
  if (h >= 9 && h < 12) return { emoji: '💼', intro: '摸鱼时刻' };
  if (h >= 12 && h < 14) return { emoji: '🍜', intro: '午休来一测' };
  if (h >= 14 && h < 18) return { emoji: '☕', intro: '下午提提神' };
  if (h >= 18 && h < 21) return { emoji: '🌆', intro: '下班放松测' };
  if (h >= 21 && h < 24) return { emoji: '🌙', intro: '睡前测一测' };
  return { emoji: '🦉', intro: '深夜还在卷AI' };
}

function formatTemplate(template, opts = {}) {
  const scoreStr = opts.score ? `${opts.score}分` : '';
  const rankStr = opts.rank && opts.total ? `好友第${opts.rank}/${opts.total}` : '';
  const personaStr = opts.persona || '';

  let t = template;
  t = t.replace('{score}', scoreStr).replace('{score} ', scoreStr ? scoreStr + ' ' : '');
  t = t.replace('{rank}', rankStr).replace('{total}', String(opts.total || ''));
  t = t.replace('{persona}', personaStr).replace('{persona}，', personaStr ? personaStr + '，' : '');
  t = t.replace('，{persona}', personaStr ? '，' + personaStr : '');

  if (rankStr && !t.includes(rankStr)) {
    t = t.replace(/测测|你也来|来测|→$/, (m) => `${rankStr} · ${m}`);
  }

  return t.replace(/\s+/g, ' ').replace(/，+/g, '，').replace(/·\s*·/g, '·').trim();
}

export function getShareCopy(tierIndex, style = 'showoff', opts = {}) {
  const copies = COPIES[tierIndex] || COPIES[0];
  const template = copies[style] || copies.showoff;
  const ctx = getTimeContext();
  const body = formatTemplate(template, opts);
  return `${ctx.emoji} ${ctx.intro}！${body}`;
}

export function getGroupChallengeCopy(tierName, tierEmoji, score = 0) {
  const scorePart = score ? `，${score}分` : '';
  return `本群AI段位摸底！@所有人 我先来——${tierName} ${tierEmoji}${scorePart} 🏆 你们也来测测？`;
}

// C1: @好友预测文案
export function getPredictionCopy(myTier, myEmoji, myScore, friendName) {
  const ctx = getTimeContext();
  return `${ctx.emoji} 我测出了${myTier} ${myEmoji}（${myScore}分）！@${friendName} 我赌你是个工具人 🛠️ 不服来测 →`;
}

export function getShareTitle(tierIndex, style = 'showoff', opts = {}) {
  return getShareCopy(tierIndex, style, opts);
}
