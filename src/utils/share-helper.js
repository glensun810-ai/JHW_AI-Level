/**
 * 分享文案生成 — v1.0 多变体 + 时间敏感 + 好友预测
 * 8 段位 × 3 风格 × 2-3 变体，随机选取以提升 CTR
 */

const COPIES = {
  0: {
    showoff: [
      '🐣 AI萌新！迈出了AI世界的第一步，测测你是什么段位？',
      '刚刚开始我的AI探索之旅 🐣 你的AI段位是？来测！',
      '萌新报道！从零开始的AI进化之路 🐣 一起来？',
    ],
    selfmock: [
      '我测了3次还是萌新 🐣 谁来教教我？你也来测 →',
      'AI说我只是个萌新…我不服 🐣 你肯定比我强，来测！',
      '萌新求带！🐣 我的AI段位低到离谱，你们呢？',
    ],
    challenge: [
      '虽然我是萌新，但我不怂！不服来测！',
      '萌新怎么了？来测，说不定你也是 🐣',
    ],
  },
  1: {
    showoff: [
      '💬 AI探索者！{score}分，我和AI的探索之旅，你也来？',
      '我竟然是探索者 💬 {score}分！每天发现AI新玩法，你呢？',
      'AI探索者在此 💬 {score}分，专治各种AI不服，来测！',
    ],
    selfmock: [
      '探索AI的路上踩过坑 💬 但越探索越好玩，你也来试试？',
      '哈哈哈我在AI世界里迷路了 💬 来测测你的AI探索指数？',
    ],
    challenge: [
      '你敢来探索AI的边界吗？来测，比我高算你赢！',
      'AI探索大赛开始 💬 来测，看看谁更懂AI！',
    ],
  },
  2: {
    showoff: [
      '🛠️ AI实践者！{score}分，{persona}，AI时代的行动派！',
      '实践出真知 🛠️ {score}分！AI用起来才是王道，来测？',
      'AI实践者认证 🛠️ {score}分，行动力拉满，你呢？',
    ],
    selfmock: [
      'AI说我是实践者 🛠️ 低调务实型选手，你来测测看？',
      '实践者实锤了 🛠️ 但我是高级实践者，来测测你的段位？',
    ],
    challenge: [
      '实践者也有段位高低！来测，看看谁才是真正的行动派',
      '同为实践者，谁敢来战？🛠️ 测测你的AI段位！',
    ],
  },
  3: {
    showoff: [
      '🤝 AI协作者！{score}分，我和AI会开周会了，你呢？',
      'AI协作大师 🤝 {score}分，人机协同新境界！来测你的水平？',
      '协作者达成 🤝 {score}分！我和AI配合得比同事还默契…',
    ],
    selfmock: [
      '协作者…我和AI是搭档，但好像主要是它在帮我 🤝',
      '名为协作者，实为被AI带飞 🤝 来测测你是不是也这样？',
    ],
    challenge: [
      'AI协作？不服来测，看看你有多能协！',
      '人机协作大赛开始 🤝 来测，看看谁的AI搭档更强！',
    ],
  },
  4: {
    showoff: [
      '⚡ AI驾驭者！{score}分，{persona}，我在开AI，不是被AI开！测测你的段位？',
      '驾驭者认证 ⚡ {score}分！AI是我的工具，不是我的老板！',
      'AI驾驭者在此 ⚡ {score}分，指挥AI就像开车一样顺手，来测？',
    ],
    selfmock: [
      '驾驭者…这匹马跑得太快，缰绳有点烫手 ⚡',
      '驾驭者听起来很酷，但有时还是会被AI带偏 ⚡ 你试试？',
    ],
    challenge: [
      '我是驾驭者，不服来测！比我高请你喝奶茶！',
      '驾驭AI挑战赛 ⚡ 你能比我更会玩AI吗？来测！',
    ],
  },
  5: {
    showoff: [
      '🧪 AI炼金术士！{score}分，{persona}，AI炼丹中，勿扰。你也来炼一颗？',
      '炼金术士在此 🧪 {score}分！AI炼丹，出金率极高！来测？',
      'AI炼金中 🧪 {score}分，每个prompt都是一次炼金实验…',
    ],
    selfmock: [
      '炼金术士…炉子热着呢，但炼出什么还不确定 🧪',
      '炼丹有风险，入炉需谨慎 🧪 来测测你的AI炼丹水平？',
    ],
    challenge: [
      '炼金术士在此！来测，能比我高分算你厉害！',
      'AI炼丹大会 🧪 你的段位够不够格跟我比？来测！',
    ],
  },
  6: {
    showoff: [
      '🧠 AI觉醒者！{score}分，{persona}，Neo本Neo，测测你的AI段位？',
      '觉醒者降临 🧠 {score}分！看清了AI的本质，你呢？',
      '我已觉醒 🧠 {score}分，AI时代的清醒者，来测你的觉醒度？',
    ],
    selfmock: [
      '觉醒者…别飘，Agent还在学习我的习惯 🧠',
      '觉醒了，但没完全醒 🧠 来测测你的AI清醒指数？',
    ],
    challenge: [
      '觉醒者在此！不服来测，赢了请你吃红色药丸 💊',
      'AI觉醒挑战 💊 选择红色药丸还是蓝色药丸？来测！',
    ],
  },
  7: {
    showoff: [
      '🌊 无界！{score}分，已超越人类定义，测测你离无界有多远？',
      '到达无界 🌊 {score}分！AI与人类的边界已被我打破…',
      '无界之境 🌊 {score}分，这就是AI进化的终极形态吗？',
    ],
    selfmock: [
      '无界…系统说我超越了人类 🌊 你们也来测测看',
      '我是无界，但我的wifi密码还是12345678 🌊',
    ],
    challenge: [
      '无界在此！还有谁？来测，看看有没有第二个无界！',
      '终极挑战 🌊 有人能达到无界吗？来测！',
    ],
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

/**
 * 随机选取数组中的一个元素
 */
function pickRandom(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr[Math.floor(Math.random() * arr.length)];
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
  const variants = copies[style] || copies.showoff;
  const template = pickRandom(variants);
  const ctx = getTimeContext();
  const body = formatTemplate(template, opts);
  return `${ctx.emoji} ${ctx.intro}！${body}`;
}

export function getGroupChallengeCopy(tierName, tierEmoji, score = 0) {
  const scorePart = score ? `，${score}分` : '';
  const variants = [
    `本群AI段位摸底！@所有人 我先来——${tierName} ${tierEmoji}${scorePart} 🏆 你们也来测测？`,
    `${tierName} ${tierEmoji}${scorePart} — 我在这个群的AI地位如何？@所有人 来测！`,
    `群聊AI段位大比拼！我是${tierName} ${tierEmoji}${scorePart}，谁是本群最强？来测→`,
  ];
  return pickRandom(variants);
}

export function getShareTitle(tierIndex, style = 'showoff', opts = {}) {
  return getShareCopy(tierIndex, style, opts);
}
