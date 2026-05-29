/**
 * 段位映射工具（前后端复用）— v0.6 进化叙事流
 * 内部引擎：5-50 原始分 → 8个段位
 * 用户端：AI 商数 78-150（地板抬升变换）
 */

export const TIERS = [
  { name: '萌新',     emoji: '🐣', min: 5,  max: 9,  color: '#2e7d32', icon: 'newbie' },
  { name: '探索者',   emoji: '💬', min: 10, max: 18, color: '#f9a825', icon: 'teaser' },
  { name: '实践者',   emoji: '🛠️', min: 19, max: 27, color: '#37474f', icon: 'toolman' },
  { name: '协作者',   emoji: '🤝', min: 28, max: 35, color: '#1a237e', icon: 'collaborator' },
  { name: '驾驭者',   emoji: '⚡', min: 36, max: 42, color: '#e65100', icon: 'rider' },
  { name: '炼金术士', emoji: '🧪', min: 43, max: 46, color: '#4a148c', icon: 'alchemist' },
  { name: '觉醒者',   emoji: '🧠', min: 47, max: 49, color: '#b71c1c', icon: 'awakened' },
  { name: '无界',     emoji: '🌊', min: 50, max: 50, color: '#ffd700', icon: 'boundless' },
];

/**
 * 根据分数获取段位
 */
export function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

/**
 * 获取下一段位
 */
export function getNextTier(score) {
  const current = getTier(score);
  const idx = TIERS.findIndex(t => t.name === current.name);
  if (idx >= TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

/**
 * 距离下一段位还差多少分
 */
export function pointsToNextTier(score) {
  const next = getNextTier(score);
  if (!next) return 0;
  return next.min - score;
}

/**
 * 获取段位索引（0-7）
 */
export function getTierIndex(score) {
  const current = getTier(score);
  return TIERS.findIndex(t => t.name === current.name);
}

/**
 * 获取段位颜色
 */
export function getTierColor(tierName) {
  const tier = TIERS.find(t => t.name === tierName);
  return tier ? tier.color : '#2e7d32';
}

/**
 * 原始分 → AI 商数（地板抬升：5-50 → 78-150）
 * 这是用户端唯一可见的分数体系
 */
export function toAIQuotient(rawScore) {
  return Math.round((rawScore / 50) * 80 + 70);
}
