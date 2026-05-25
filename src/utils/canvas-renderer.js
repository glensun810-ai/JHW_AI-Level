/**
 * Canvas 段位卡渲染引擎 — v0.6
 * 画布 750×1000px，8 套主题
 */

import { getTier, getTierIndex } from './tier.js';
import { TIER_BADGE_IMAGES } from './constants.js';

// ── 8 套暗黑宇宙主题配置 ──
const THEMES = {
  '萌新':     { bg: '#0a0e27', bgEnd: '#121834', cardBg: '#121834', text: '#66bb6a', accent: '#43a047', glow: 'rgba(76,175,80,0.25)', barTrack: 'rgba(102,187,106,0.15)', barFill: '#66bb6a', subtitle: '#81c784' },
  '调戏师':   { bg: '#0a0e27', bgEnd: '#1a1430', cardBg: '#1a1430', text: '#ffb74d', accent: '#f9a825', glow: 'rgba(255,183,77,0.25)', barTrack: 'rgba(255,183,77,0.15)', barFill: '#ffb74d', subtitle: '#ffcc80' },
  '工具人':   { bg: '#0a0e27', bgEnd: '#121d33', cardBg: '#121d33', text: '#90a4ae', accent: '#607d8b', glow: 'rgba(144,164,174,0.25)', barTrack: 'rgba(144,164,174,0.15)', barFill: '#90a4ae', subtitle: '#b0bec5' },
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
  const tierCommentary = data.tierCommentary || '';
  const friendRank = data.friendRank || null;
  const miniCodeUrl = data.miniCodeUrl || '';

  // DPR 动态获取
  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 3);
  } catch (e) {
    // 降级到 2x
  }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── ① 背景渐变 ───
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, theme.bg);
  bgGrad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 星场背景
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const sr = Math.random() * 1.5 + 0.5;
    ctx.fillStyle = Math.random() > 0.7 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 顶部装饰弧线
  ctx.fillStyle = theme.cardBg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(W / 2, 140, W, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(0, 0);
  ctx.fill();

  // ─── ② 品牌标识 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾 · EVOLUTION BAY', W / 2, 46);

  // ─── ③ 段位徽章 ───
  const badgeSrc = TIER_BADGE_IMAGES[tierName] || TIER_BADGE_IMAGES['萌新'];
  let badgeDrawn = false;
  try {
    const badgeImg = canvas.createImage();
    await new Promise((resolve, reject) => {
      badgeImg.onload = resolve;
      badgeImg.onerror = () => reject(new Error('badge load failed'));
      badgeImg.src = badgeSrc;
    });
    const badgeSize = 260;
    const badgeX = (W - badgeSize) / 2;
    const badgeY = 80;
    // 辉光背景
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 40;
    drawRoundRect(ctx, badgeX - 10, badgeY - 10, badgeSize + 20, badgeSize + 20, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.drawImage(badgeImg, badgeX, badgeY, badgeSize, badgeSize);
    badgeDrawn = true;
  } catch (e) {
    // 徽章加载失败，用大号 emoji 替代
  }

  // ─── ④ 段位名称 ───
  const tier = getTier(totalScore);
  const emoji = tier ? tier.emoji : '🐣';
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';

  if (!badgeDrawn) {
    // 无徽章时，绘制大号 emoji 作为 fallback
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(emoji, W / 2, 260);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(tierName, W / 2, 390);
  } else {
    ctx.fillText(emoji + ' ' + tierName, W / 2, 390);
  }

  // ─── ⑤ 分数 ───
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 80px sans-serif';
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 20;
  ctx.fillText(String(totalScore), W / 2, 470);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.fillStyle = theme.subtitle;
  ctx.font = '24px sans-serif';
  ctx.fillText('分', W / 2 + ctx.measureText(String(totalScore)).width / 2 + 16, 470);

  // ─── ⑥ 超越百分比 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '22px sans-serif';
  ctx.fillText(`超越了全国 ${percentile}% 的用户`, W / 2, 520);

  // ─── ⑦ 评分条 ───
  const barX = 120;
  const barY = 555;
  const barW = W - 240;
  const barH = 16;
  const minScore = 5;
  const maxScore = 50;
  const normScore = totalScore > 50 ? Math.round(totalScore / 2) : totalScore;
  const scoreRatio = Math.max(0, Math.min(1, (normScore - minScore) / (maxScore - minScore)));

  drawRoundRect(ctx, barX, barY, barW, barH, 8);
  ctx.fillStyle = theme.barTrack;
  ctx.fill();

  const fillW = Math.max(barH, barW * scoreRatio);
  drawRoundRect(ctx, barX, barY, fillW, barH, 8);
  ctx.fillStyle = theme.barFill;
  ctx.fill();

  ctx.fillStyle = theme.text;
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${minScore}`, barX - 10, barY + 34);
  ctx.fillText(`${maxScore}`, barX + barW + 10, barY + 34);

  // ─── ⑧ AI锐评 ───
  if (tierCommentary) {
    const commentY = 630;
    const commentMaxW = W - 120;
    ctx.fillStyle = theme.text;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';

    const lines = wrapText(ctx, tierCommentary, commentMaxW, 34, 3);
    lines.forEach((line, i) => {
      ctx.fillText(line, 60, commentY + i * 36);
    });

    ctx.fillStyle = theme.subtitle;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('—— 进化湾 AI裁判团', W - 60, commentY + lines.length * 36 + 24);
  }

  // ─── ⑨ 好友排名 ───
  const friendY = 770;
  if (friendRank) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    drawRoundRect(ctx, W / 2 - 160, friendY - 30, 320, 44, 22);
    ctx.fill();

    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏆 好友排名第 ${friendRank.rank} / ${friendRank.total} 位`, W / 2, friendY);
  }

  // ─── ⑩ 小程序码 ───
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
      // QR 码背景圆角矩形
      drawRoundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      // 白色边距内绘制 QR 码
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) { /* 小程序码加载失败 */ }
  }

  // ─── ⑪ 引导文案 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  const ctaText = miniCodeUrl ? '扫码测测你的AI段位' : '进化湾 · 你的AI段位';
  ctx.fillText(ctaText, qrX - 20, qrY + qrSize / 2 + 6);
}

// ── 渲染入口：优先使用离屏 Canvas，降级到 DOM Canvas ──
// componentInstance: 可选，当 canvas 在组件内时传入组件实例用于 scope 查询
export async function generateTierCardImage(data, componentInstance = null) {
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
    query.select('#tier-card-canvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到，请确认页面中存在 id=tier-card-canvas 的 canvas'));
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
