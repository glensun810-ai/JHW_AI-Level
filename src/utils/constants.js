/**
 * 全局常量 — v0.6 进化叙事流 8 段位
 * 注意：MAX_FREE_TESTS / MAX_AD_TESTS / INVITE_UNLOCK_TESTS 统一定义在 numeric-constants.js
 */

// 缓存时间
export const CACHE_TTL_TIER_DISTRIBUTION = 60 * 60 * 1000;   // 段位分布 1小时
export const CACHE_TTL_QUESTIONS = 60 * 60 * 1000;            // 题目 1小时

// 段位徽章图片路径（v0.6 进化叙事流）
export const TIER_BADGE_IMAGES = {
  '萌新': '/static/images/tier-badges/newbie.png',
  '调戏师': '/static/images/tier-badges/teaser.png',
  '工具人': '/static/images/tier-badges/toolman.png',
  '协作者': '/static/images/tier-badges/collaborator.png',
  '驾驭者': '/static/images/tier-badges/rider.png',
  '炼金术士': '/static/images/tier-badges/alchemist.png',
  '觉醒者': '/static/images/tier-badges/awakened.png',
  '无界': '/static/images/tier-badges/boundless.png',
};

// 反转动画"错误段位"映射
export const REVERSAL_FAKE_TIERS = {
  '萌新': 'AI本I 🤖',
  '调戏师': '山顶洞人 🦴',
  '工具人': 'AI领主 👑',
  '协作者': 'AI的宠物 🐱',
  '驾驭者': '键盘侠 ⌨️',
  '炼金术士': '江湖骗子 🃏',
  '觉醒者': '普通人类 👤',
  '无界': '系统错误 ⚠️',
};

// 段位对应的口头禅
export const TIER_CATCHPHRASES = {
  '萌新': '萌新求带 🐣',
  '调戏师': '我只是在调戏AI 💬',
  '工具人': 'AI的工具人，打工的魂 🛠️',
  '协作者': '我和AI是搭档 🤝',
  '驾驭者': '我在开AI，不是被AI开 ⚡',
  '炼金术士': 'AI炼金中，勿扰 🧪',
  '觉醒者': '我已经觉醒了 🧠',
  '无界': '无界 🌊',
};

// 段位海报配色（v0.6 8套完整视觉规范）
export const TIER_POSTER_COLORS = {
  '萌新': { bg: '#e8f5e9', accent: '#2e7d32', grad1: 'rgba(46,125,50,0.15)', grad2: 'rgba(232,245,233,0)' },
  '调戏师': { bg: '#fff8e1', accent: '#f9a825', grad1: 'rgba(249,168,37,0.15)', grad2: 'rgba(255,248,225,0)' },
  '工具人': { bg: '#e3f2fd', accent: '#37474f', grad1: 'rgba(55,71,79,0.12)', grad2: 'rgba(227,242,253,0)' },
  '协作者': { bg: '#e8eaf6', accent: '#1a237e', grad1: 'rgba(26,35,126,0.15)', grad2: 'rgba(232,234,246,0)' },
  '驾驭者': { bg: '#fff3e0', accent: '#e65100', grad1: 'rgba(230,81,0,0.15)', grad2: 'rgba(255,243,224,0)' },
  '炼金术士': { bg: '#f3e5f5', accent: '#4a148c', grad1: 'rgba(74,20,140,0.18)', grad2: 'rgba(243,229,245,0)' },
  '觉醒者': { bg: '#fce4ec', accent: '#b71c1c', grad1: 'rgba(183,28,28,0.18)', grad2: 'rgba(252,228,236,0)' },
  '无界': { bg: '#000000', accent: '#ffd700', grad1: 'rgba(255,215,0,0.25)', grad2: 'rgba(0,0,0,0)' },
};

// 异常提示文案
export const ERROR_MESSAGES = {
  NETWORK: '网络连接失败，请检查网络后重试',
  TIMEOUT: '服务响应超时，请稍后重试',
  POSTER_FAIL: '海报生成失败，请重试',
  UNKNOWN: '出了点小问题，请重试',
};
