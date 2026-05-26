/**
 * Canvas 段位卡渲染引擎 — v0.6
 * 画布 750×1000px，8 套主题
 */

import { getTier, getTierIndex, getNextTier, pointsToNextTier } from './tier.js';
import { TIER_BADGE_IMAGES } from './constants.js';

// ── 8 套暗黑宇宙主题配置 ──
const THEMES = {
  '萌新':     { bg: '#0a0e27', bgEnd: '#121834', cardBg: '#121834', text: '#66bb6a', accent: '#43a047', glow: 'rgba(76,175,80,0.25)', barTrack: 'rgba(102,187,106,0.15)', barFill: '#66bb6a', subtitle: '#81c784' },
  '探索者':   { bg: '#0a0e27', bgEnd: '#1a1430', cardBg: '#1a1430', text: '#ffb74d', accent: '#f9a825', glow: 'rgba(255,183,77,0.25)', barTrack: 'rgba(255,183,77,0.15)', barFill: '#ffb74d', subtitle: '#ffcc80' },
  '实践者':   { bg: '#0a0e27', bgEnd: '#121d33', cardBg: '#121d33', text: '#90a4ae', accent: '#607d8b', glow: 'rgba(144,164,174,0.25)', barTrack: 'rgba(144,164,174,0.15)', barFill: '#90a4ae', subtitle: '#b0bec5' },
  '协作者':   { bg: '#0a0e27', bgEnd: '#151230', cardBg: '#151230', text: '#7986cb', accent: '#3f51b5', glow: 'rgba(121,134,203,0.25)', barTrack: 'rgba(121,134,203,0.15)', barFill: '#7986cb', subtitle: '#9fa8da' },
  '驾驭者':   { bg: '#0a0e27', bgEnd: '#1a1020', cardBg: '#1a1020', text: '#ff8a65', accent: '#e65100', glow: 'rgba(255,138,101,0.30)', barTrack: 'rgba(255,138,101,0.15)', barFill: '#ff8a65', subtitle: '#ffab91' },
  '炼金术士': { bg: '#0a0e27', bgEnd: '#1a1030', cardBg: '#1a1030', text: '#ce93d8', accent: '#7b1fa2', glow: 'rgba(206,147,216,0.35)', barTrack: 'rgba(206,147,216,0.18)', barFill: '#ce93d8', subtitle: '#e1bee7' },
  '觉醒者':   { bg: '#0a0e27', bgEnd: '#1a1015', cardBg: '#1a1015', text: '#ef5350', accent: '#c62828', glow: 'rgba(239,83,80,0.35)', barTrack: 'rgba(239,83,80,0.18)', barFill: '#ef5350', subtitle: '#ef9a9a' },
  '无界':     { bg: '#050510', bgEnd: '#0a0a1a', cardBg: '#050510', text: '#ffd700', accent: '#ffab00', glow: 'rgba(255,215,0,0.40)', barTrack: 'rgba(255,215,0,0.22)', barFill: '#ffd700', subtitle: '#ffe082' },
};

// ── 工具函数 ──
function wrapText(ctx, text, maxWidth, lineHeight, maxLines) {
  const lines = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const test = current + text[i];
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = text[i];
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── 主渲染函数 ──
async function renderTierCard(canvas, ctx, data) {
  const W = 750;
  const H = 1000;

  const tierName = data.tierName || '萌新';
  const theme = THEMES[tierName] || THEMES['萌新'];
  const totalScore = data.totalScore || 0;
  const percentile = data.percentile || 0;
  const friendRank = data.friendRank || null;
  const miniCodeUrl = data.miniCodeUrl || '';
  const userAvatar = data.userAvatar || '';
  const userNickname = data.userNickname || '';

  // AI 商数：地板抬升变换（同 result.vue animateScore）
  const aiQuotient = Math.round((totalScore / 50) * 80 + 70);
  const tier = getTier(totalScore);
  const emoji = tier ? tier.emoji : '🐣';
  const nextTierObj = getNextTier(totalScore);
  const pointsToNext = pointsToNextTier(totalScore);

  // DPR 动态获取
  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 3);
  } catch (e) { /* 降级到 2x */ }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── ① 背景渐变 ───
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bg);
  bgGrad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 星场背景
  for (let i = 0; i < 70; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    ctx.fillStyle = Math.random() > 0.7 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── ② 品牌标识（仅"进化湾"） ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾', W / 2, 36);

  // ─── ③ 用户头像 + 昵称 ───
  let avatarDrawn = false;
  const avatarCY = 90;
  if (userAvatar) {
    try {
      const avatarImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = () => reject(new Error('avatar load failed'));
        avatarImg.src = userAvatar;
      });
      const avatarSize = 56;
      const avatarX = W / 2 - avatarSize / 2;
      const avatarY = avatarCY - avatarSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 2;
      ctx.stroke();
      avatarDrawn = true;
    } catch (e) { /* 头像加载失败，继续无头像渲染 */ }
  }
  if (avatarDrawn && userNickname) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userNickname + ' 的AI段位', W / 2, 150);
  }

  const topShift = avatarDrawn ? 90 : 0;

  // ─── ④ 段位徽章 ───
  const badgeSrc = TIER_BADGE_IMAGES[tierName] || TIER_BADGE_IMAGES['萌新'];
  const badgeSize = 220;
  const badgeX = (W - badgeSize) / 2;
  const badgeY = 85 + topShift;
  let badgeDrawn = false;
  try {
    const badgeImg = canvas.createImage();
    await new Promise((resolve, reject) => {
      badgeImg.onload = resolve;
      badgeImg.onerror = () => reject(new Error('badge load failed'));
      badgeImg.src = badgeSrc;
    });
    // 辉光底板
    const glowSize = 240;
    const glowX = (W - glowSize) / 2;
    const glowY = badgeY - 10;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 40;
    drawRoundRect(ctx, glowX, glowY, glowSize, glowSize, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.drawImage(badgeImg, badgeX, badgeY, badgeSize, badgeSize);
    badgeDrawn = true;
  } catch (e) { /* 徽章加载失败，用 emoji 替代 */ }

  // ─── ⑤ 段位名称 ───
  if (!badgeDrawn) {
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(emoji, W / 2, 260 + topShift);
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(tierName, W / 2, 370 + topShift);
  } else {
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji + ' ' + tierName, W / 2, 345 + topShift);
  }

  // ─── ⑥ AI 商数 ───
  const scoreY = 415 + topShift;
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 88px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 20;
  ctx.fillText(String(aiQuotient), W / 2, scoreY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // "AI商数" 标签（紧随分数右侧）
  const scoreTextWidth = ctx.measureText(String(aiQuotient)).width;
  ctx.fillStyle = theme.subtitle;
  ctx.font = '24px sans-serif';
  ctx.fillText('AI商数', W / 2 + scoreTextWidth / 2 + 16, scoreY - 8);

  // 参照系锚定
  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.fillText('均值约105 · 超越全国 ' + percentile + '% 的用户', W / 2, 478 + topShift);

  // ─── ⑦ 段位进度面板 ───
  const progPanelY = 520 + topShift;
  const progPanelW = 600;
  const progPanelH = 100;
  const progPanelX = (W - progPanelW) / 2;
  drawRoundRect(ctx, progPanelX, progPanelY, progPanelW, progPanelH, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (nextTierObj) {
    // 文案
    ctx.fillStyle = theme.text;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    const ptsText = pointsToNext === 1 ? '只差 1 分' : `还差 ${pointsToNext} 分`;
    ctx.fillText(`距「${nextTierObj.name}」${ptsText}`, W / 2, progPanelY + 38);

    // 进度条
    const barX = progPanelX + 60;
    const barW = progPanelW - 120;
    const barY = progPanelY + 62;
    const barH = 12;
    const currentTier = getTier(totalScore);
    const scoreInTier = totalScore - currentTier.min;
    const tierSpan = currentTier.max - currentTier.min;
    const ratio = tierSpan > 0 ? Math.max(0.05, scoreInTier / tierSpan) : 1.0;
    const fillW = Math.max(barH, barW * ratio);

    drawRoundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fillStyle = theme.barTrack;
    ctx.fill();

    drawRoundRect(ctx, barX, barY, fillW, barH, 6);
    ctx.fillStyle = theme.barFill;
    ctx.fill();

    // 两端 emoji
    ctx.fillStyle = theme.text;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, barX - 28, barY + 10);
    ctx.fillText(nextTierObj.emoji, barX + barW + 28, barY + 10);
  } else {
    // 已达最高段位
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('已达成最高段位「无界」', W / 2, progPanelY + 38);
    ctx.fillStyle = theme.subtitle;
    ctx.font = '20px sans-serif';
    ctx.fillText('作为先行者，引领AI进化浪潮', W / 2, progPanelY + 70);
  }

  // ─── ⑧ 好友排名 ───
  let friendRankBottom = progPanelY + progPanelH;
  if (friendRank) {
    const friendY = progPanelY + progPanelH + 28;
    const pillW = 320;
    const pillH = 44;
    const pillX = (W - pillW) / 2;
    drawRoundRect(ctx, pillX, friendY, pillW, pillH, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`\u{1F3C6} 好友排名第 ${friendRank.rank} / ${friendRank.total} 位`, W / 2, friendY + 30);
    friendRankBottom = friendY + pillH;
  }

  // ─── ⑨ 小程序码面板 ───
  const qrPanelY = friendRankBottom + 24;
  const qrPanelW = 670;
  const qrPanelH = 185;
  const qrPanelX = (W - qrPanelW) / 2;
  drawRoundRect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // CTA 标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('扫码测测你的 AI 段位', W / 2, qrPanelY + 34);

  // QR code on white background
  const qrSize = 130;
  const qrX = (W - qrSize) / 2;
  const qrY = qrPanelY + 52;
  if (miniCodeUrl) {
    try {
      const qrImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = miniCodeUrl;
      });
      // 白底
      const qrPad = 8;
      drawRoundRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* 小程序码加载失败 */ }
  } else {
    // 无码时显示占位
    drawRoundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.fillStyle = theme.subtitle;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('小程序码', W / 2, qrY + qrSize / 2 + 6);
  }

  // ─── ⑩ 页脚 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.5;
  ctx.fillText('进化湾 · 记录你的AI进化', W / 2, H - 22);
  ctx.globalAlpha = 1.0;
}

// ── 人格卡渲染函数 ──
async function renderPersonaCard(canvas, ctx, data) {
  const W = 750;
  const H = 1000;

  const personaName = data.personaName || '均衡的进化者';
  const personaEmoji = data.personaEmoji || '⚖️';
  const personaDesc = data.personaDesc || '';
  const strongestName = data.strongestName || '';
  const strongestHint = data.strongestHint || '';
  const weakestName = data.weakestName || '';
  const weakestHint = data.weakestHint || '';
  const rarity = data.personaRarity || '';
  const miniCodeUrl = data.miniCodeUrl || '';
  const userAvatar = data.userAvatar || '';
  const userNickname = data.userNickname || '';

  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 3);
  } catch (e) { /* fallback */ }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── 背景：深紫渐变 + 星场 ───
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0e27');
  bgGrad.addColorStop(0.5, '#120d2e');
  bgGrad.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 80; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const sr = Math.random() * 1.5 + 0.5;
    ctx.fillStyle = Math.random() > 0.6 ? 'rgba(255,255,255,0.5)' : 'rgba(168,135,255,0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── 顶部光晕 ───
  const glowGrad = ctx.createRadialGradient(W / 2, 140, 20, W / 2, 140, 300);
  glowGrad.addColorStop(0, 'rgba(124,58,237,0.25)');
  glowGrad.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, 350);

  // ─── 标题 ───
  ctx.fillStyle = '#a78bfa';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾', W / 2, 50);

  // ─── 用户头像 + 昵称 ───
  let avatarDrawn = false;
  const avatarCY = 115;
  if (userAvatar) {
    try {
      const avatarImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = () => reject(new Error('avatar load failed'));
        avatarImg.src = userAvatar;
      });
      const avatarSize = 56;
      const avatarX = W / 2 - avatarSize / 2;
      const avatarY = avatarCY - avatarSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
      avatarDrawn = true;
    } catch (e) { /* avatar load failed, skip */ }
  }
  if (avatarDrawn && userNickname) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userNickname + ' 的AI人格', W / 2, avatarCY + 42);
  }

  const topShift = avatarDrawn ? 54 : 0;

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('🧬 我的 AI 进化人格', W / 2, 100 + topShift);

  // ─── Emoji + 人格名 ───
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 100px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(personaEmoji, W / 2, 240 + topShift);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.shadowColor = 'rgba(124,58,237,0.4)';
  ctx.shadowBlur = 16;
  ctx.fillText(personaName, W / 2, 320 + topShift);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ─── 描述文字 ───
  ctx.fillStyle = '#b0bec5';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  const descLines = wrapText(ctx, personaDesc, W - 120, 38, 4);
  descLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 380 + topShift + i * 40);
  });

  const descBottom = 380 + topShift + descLines.length * 40;

  // ─── 特质卡片 ───
  const cardY = descBottom + 40;
  const cardW = 280;
  const cardH = 160;
  const cardGap = 30;
  const cardStartX = (W - cardW * 2 - cardGap) / 2;

  // 超能力卡片
  drawRoundRect(ctx, cardStartX, cardY, cardW, cardH, 16);
  ctx.fillStyle = 'rgba(0,200,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,200,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#00c8ff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔮 超能力', cardStartX + cardW / 2, cardY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(strongestName || '—', cardStartX + cardW / 2, cardY + 70);

  ctx.fillStyle = '#8899aa';
  ctx.font = '20px sans-serif';
  const strongHintLines = wrapText(ctx, strongestHint, cardW - 24, 28, 2);
  strongHintLines.forEach((line, i) => {
    ctx.fillText(line, cardStartX + cardW / 2, cardY + 100 + i * 30);
  });

  // 进化方向卡片
  const rightCardX = cardStartX + cardW + cardGap;
  drawRoundRect(ctx, rightCardX, cardY, cardW, cardH, 16);
  ctx.fillStyle = 'rgba(245,158,11,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,158,11,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🚀 进化方向', rightCardX + cardW / 2, cardY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(weakestName || '—', rightCardX + cardW / 2, cardY + 70);

  ctx.fillStyle = '#8899aa';
  ctx.font = '20px sans-serif';
  const weakHintLines = wrapText(ctx, weakestHint, cardW - 24, 28, 2);
  weakHintLines.forEach((line, i) => {
    ctx.fillText(line, rightCardX + cardW / 2, cardY + 100 + i * 30);
  });

  // ─── 稀有度标签 ───
  const rareY = cardY + cardH + 50;
  if (rarity) {
    drawRoundRect(ctx, W / 2 - 160, rareY, 320, 44, 22);
    ctx.fillStyle = 'rgba(124,58,237,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(167,139,250,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`前 ${rarity}% 的稀有类型`, W / 2, rareY + 30);
  }

  // ─── 底部小程序码 + CTA ───
  const qrSize = 140;
  const qrX = W - qrSize - 40;
  const qrY = H - qrSize - 60;

  if (miniCodeUrl) {
    try {
      const qrImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = miniCodeUrl;
      });
      drawRoundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* ignore */ }
  }

  ctx.fillStyle = '#a78bfa';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  const ctaText = miniCodeUrl ? '扫码测测你的AI人格' : '进化湾 · 你的AI人格';
  ctx.fillText(ctaText, qrX - 20, qrY + qrSize / 2 + 6);
}

// ── 反转卡渲染函数 ──
async function renderReversalCard(canvas, ctx, data) {
  const W = 750;
  const H = 1000;

  const fakeTier = data.fakeTier || '';
  const realTier = data.realTier || '';
  const realEmoji = data.realEmoji || '';
  const miniCodeUrl = data.miniCodeUrl || '';
  const userAvatar = data.userAvatar || '';
  const userNickname = data.userNickname || '';

  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 3);
  } catch (e) { /* fallback */ }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── 背景：暗黑红紫渐变 ───
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0e27');
  bgGrad.addColorStop(0.5, '#150d1e');
  bgGrad.addColorStop(1, '#0d1b2a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    ctx.fillStyle = Math.random() > 0.6 ? 'rgba(255,255,255,0.4)' : 'rgba(255,100,100,0.15)';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── 标题 ───
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾', W / 2, 50);

  // ─── 用户头像 + 昵称 ───
  let avatarDrawn = false;
  const avatarCY = 92;
  if (userAvatar) {
    try {
      const avatarImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = () => reject(new Error('avatar load failed'));
        avatarImg.src = userAvatar;
      });
      const avatarSize = 56;
      const avatarX = W / 2 - avatarSize / 2;
      const avatarY = avatarCY - avatarSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
      avatarDrawn = true;
    } catch (e) { /* avatar load failed, skip */ }
  }
  if (avatarDrawn && userNickname) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userNickname + ' 的反转时刻', W / 2, avatarCY + 42);
  }

  const topShift = avatarDrawn ? 54 : 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('🎭 AI 反转时刻', W / 2, 110 + topShift);

  // ─── 假段位：灰色删除线 ───
  ctx.fillStyle = '#607d8b';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('系统初步判定', W / 2, 220 + topShift);

  ctx.fillStyle = '#8899aa';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(fakeTier || '???', W / 2, 310 + topShift);

  // 删除线
  const fakeW = ctx.measureText(fakeTier || '???').width;
  ctx.strokeStyle = '#ff5252';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - fakeW / 2 - 20, 288 + topShift);
  ctx.lineTo(W / 2 + fakeW / 2 + 20, 288 + topShift);
  ctx.stroke();

  // ─── 转折 ───
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('但真实段位是…', W / 2, 420 + topShift);

  // ─── 真段位：金色发光 ───
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 100px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(realEmoji, W / 2, 540 + topShift);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(255,215,0,0.5)';
  ctx.shadowBlur = 24;
  ctx.fillText(realTier, W / 2, 630 + topShift);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ─── CTA ───
  ctx.fillStyle = '#b0bec5';
  ctx.font = '26px sans-serif';
  ctx.fillText('你也来测测', W / 2, 710 + topShift);
  ctx.fillText('看看AI能不能骗到你', W / 2, 750 + topShift);

  // ─── 小程序码 ───
  const qrSize = 140;
  const qrX = W - qrSize - 40;
  const qrY = H - qrSize - 60;

  if (miniCodeUrl) {
    try {
      const qrImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = miniCodeUrl;
      });
      drawRoundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* ignore */ }
  }

  ctx.fillStyle = '#a78bfa';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('扫码测测你的AI段位', qrX - 20, qrY + qrSize / 2 + 6);
}

// ── 朋友圈方形分享图 ──
async function renderSquareShare(canvas, ctx, data) {
  const W = 800;
  const H = 800;

  const tierName = data.tierName || '萌新';
  const tierEmoji = (data.tierEmoji || '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
  const theme = THEMES[tierName] || THEMES['萌新'];
  const totalScore = data.totalScore || 0;
  const percentile = data.percentile || 0;
  const personaName = data.personaName || '均衡的进化者';
  const personaEmoji = data.personaEmoji || '⚖️';
  const commentary = data.commentary || '';
  const collectCount = data.collectCount || 0;
  const collectHighlight = data.collectHighlight || '';
  const miniCodeUrl = data.miniCodeUrl || '';
  const userAvatar = data.userAvatar || '';
  const userNickname = data.userNickname || '';

  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 3);
  } catch (e) { /* fallback */ }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── 背景 ───
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bg);
  bgGrad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 星场
  for (let i = 0; i < 50; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    ctx.fillStyle = Math.random() > 0.7 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── 上 1/3: 段位徽章 + 人格标签 ───
  const topSectionH = Math.round(H * 0.34);

  // 品牌标识
  ctx.fillStyle = theme.subtitle;
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾', W / 2, 36);

  // ─── 用户头像 + 昵称 ───
  let avatarDrawn = false;
  const avatarCY = 88;
  if (userAvatar) {
    try {
      const avatarImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = () => reject(new Error('avatar load failed'));
        avatarImg.src = userAvatar;
      });
      const avatarSize = 52;
      const avatarX = W / 2 - avatarSize / 2;
      const avatarY = avatarCY - avatarSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(W / 2, avatarCY, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 2;
      ctx.stroke();
      avatarDrawn = true;
    } catch (e) { /* avatar load failed, skip */ }
  }
  if (avatarDrawn && userNickname) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userNickname + ' 的AI段位', W / 2, avatarCY + 38);
  }

  const topShift = avatarDrawn ? 48 : 0;

  // 段位名 + emoji
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 72px sans-serif';
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 20;
  ctx.fillText(tierEmoji + ' ' + tierName, W / 2, 140 + topShift);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 分数
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(totalScore + ' 分', W / 2, 200 + topShift);

  // 超越百分比
  ctx.fillStyle = theme.subtitle;
  ctx.font = '22px sans-serif';
  ctx.fillText('超越了全国 ' + percentile + '% 的用户', W / 2, 235 + topShift);

  // 人格标签
  drawRoundRect(ctx, W / 2 - 140, 255 + topShift, 280, 42, 21);
  ctx.fillStyle = 'rgba(124,58,237,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(personaEmoji + ' ' + personaName, W / 2, 283 + topShift);

  // ─── 中 1/3: 知识星收集 + 一句话亮点 ───
  const midY = topSectionH + 10 + topShift;
  drawRoundRect(ctx, 60, midY, W - 120, 200, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();

  // 知识星数
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⭐ ' + collectCount + ' 颗知识星', W / 2, midY + 60);

  ctx.fillStyle = '#b0bec5';
  ctx.font = '24px sans-serif';
  if (collectHighlight) {
    const hlLines = wrapText(ctx, collectHighlight, W - 160, 32, 3);
    hlLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, midY + 100 + i * 34);
    });
  } else if (commentary) {
    const shortCommentary = commentary.length > 60 ? commentary.slice(0, 60) + '...' : commentary;
    ctx.fillText('"' + shortCommentary + '"', W / 2, midY + 100);
    ctx.font = '18px sans-serif';
    ctx.fillText('—— AI 锐评', W / 2, midY + 130);
  }

  // ─── 下 1/3: 小程序码 + 引导文案 ───
  const bottomY = midY + 230;
  ctx.fillStyle = theme.subtitle;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('扫码测测你的AI段位', W / 2, bottomY + 30);

  const qrSize = 150;
  const qrX = (W - qrSize) / 2;
  const qrY = bottomY + 50;

  if (miniCodeUrl) {
    try {
      const qrImg = canvas.createImage();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = miniCodeUrl;
      });
      drawRoundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* ignore */ }
  }

  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.fillText('长按识别 · 看看你的AI段位排第几', W / 2, qrY + qrSize + 30);
}

// ── 渲染入口：优先使用离屏 Canvas，降级到 DOM Canvas ──
// componentInstance: 可选，当 canvas 在组件内时传入组件实例用于 scope 查询
export async function generateTierCardImage(data, componentInstance = null, canvasId = 'tier-card-canvas') {
  const W = 750;
  const H = 1000;

  // 方法 1：离屏 Canvas（WeChat 8.0+，最稳定）
  if (typeof wx.createOffscreenCanvas === 'function') {
    try {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: W, height: H });
      const ctx = canvas.getContext('2d');
      await renderTierCard(canvas, ctx, data);
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0, y: 0, width: W, height: H,
          destWidth: W, destHeight: H,
          success: (tempRes) => resolve(tempRes.tempFilePath),
          fail: (err) => reject(err),
        });
      });
    } catch (e) {
      console.warn('[canvas-renderer] 离屏 Canvas 失败，降级到 DOM Canvas:', e.message);
    }
  }

  // 方法 2：DOM Canvas（兼容旧版微信）
  return new Promise((resolve, reject) => {
    let query = uni.createSelectorQuery();
    // 组件内使用需要 .in(componentInstance) 限定作用域
    if (componentInstance) {
      query = query.in(componentInstance);
    }
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到，请确认页面中存在 id=' + canvasId + ' 的 canvas'));
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        try {
          await renderTierCard(canvas, ctx, data);
          canvas.toTempFilePath({
            x: 0, y: 0, width: W, height: H,
            destWidth: W, destHeight: H,
            success: (tempRes) => resolve(tempRes.tempFilePath),
            fail: (err) => reject(err),
          });
        } catch (e) {
          reject(e);
        }
      });
  });
}

export { renderTierCard };

// ── 人格卡渲染入口 ──
export async function generatePersonaCardImage(data, componentInstance = null, canvasId = 'tier-card-canvas') {
  const W = 750;
  const H = 1000;

  if (typeof wx.createOffscreenCanvas === 'function') {
    try {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: W, height: H });
      const ctx = canvas.getContext('2d');
      await renderPersonaCard(canvas, ctx, data);
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: W, height: H,
          destWidth: W, destHeight: H,
          success: (tempRes) => resolve(tempRes.tempFilePath),
          fail: (err) => reject(err),
        });
      });
    } catch (e) {
      console.warn('[canvas-renderer] 离屏 Canvas persona 失败，降级:', e.message);
    }
  }

  return new Promise((resolve, reject) => {
    let query = uni.createSelectorQuery();
    if (componentInstance) query = query.in(componentInstance);
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到'));
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        try {
          await renderPersonaCard(canvas, ctx, data);
          canvas.toTempFilePath({
            x: 0, y: 0, width: W, height: H,
            destWidth: W, destHeight: H,
            success: (tempRes) => resolve(tempRes.tempFilePath),
            fail: (err) => reject(err),
          });
        } catch (e) { reject(e); }
      });
  });
}

// ── 反转卡渲染入口 ──
export async function generateReversalCardImage(data, componentInstance = null, canvasId = 'tier-card-canvas') {
  const W = 750;
  const H = 1000;

  if (typeof wx.createOffscreenCanvas === 'function') {
    try {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: W, height: H });
      const ctx = canvas.getContext('2d');
      await renderReversalCard(canvas, ctx, data);
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: W, height: H,
          destWidth: W, destHeight: H,
          success: (tempRes) => resolve(tempRes.tempFilePath),
          fail: (err) => reject(err),
        });
      });
    } catch (e) {
      console.warn('[canvas-renderer] 离屏 Canvas reversal 失败，降级:', e.message);
    }
  }

  return new Promise((resolve, reject) => {
    let query = uni.createSelectorQuery();
    if (componentInstance) query = query.in(componentInstance);
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到'));
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        try {
          await renderReversalCard(canvas, ctx, data);
          canvas.toTempFilePath({
            x: 0, y: 0, width: W, height: H,
            destWidth: W, destHeight: H,
            success: (tempRes) => resolve(tempRes.tempFilePath),
            fail: (err) => reject(err),
          });
        } catch (e) { reject(e); }
      });
  });
}

// ── 朋友圈方形分享图入口 ──
export async function generateSquareShareImage(data, componentInstance = null, canvasId = 'tier-card-canvas') {
  const W = 800;
  const H = 800;

  if (typeof wx.createOffscreenCanvas === 'function') {
    try {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: W, height: H });
      const ctx = canvas.getContext('2d');
      await renderSquareShare(canvas, ctx, data);
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: W, height: H,
          destWidth: W, destHeight: H,
          success: (tempRes) => resolve(tempRes.tempFilePath),
          fail: (err) => reject(err),
        });
      });
    } catch (e) {
      console.warn('[canvas-renderer] 离屏 Canvas square 失败，降级:', e.message);
    }
  }

  return new Promise((resolve, reject) => {
    let query = uni.createSelectorQuery();
    if (componentInstance) query = query.in(componentInstance);
    query.select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到'));
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        try {
          await renderSquareShare(canvas, ctx, data);
          canvas.toTempFilePath({
            x: 0, y: 0, width: W, height: H,
            destWidth: W, destHeight: H,
            success: (tempRes) => resolve(tempRes.tempFilePath),
            fail: (err) => reject(err),
          });
        } catch (e) { reject(e); }
      });
  });
}
