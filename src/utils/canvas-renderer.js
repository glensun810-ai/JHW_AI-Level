/**
 * Canvas 段位卡渲染引擎 — v0.6
 * 画布 750×1000px，8 套主题
 */

import { getTier, getTierIndex } from './tier.js';
import { TIER_BADGE_IMAGES } from './constants.js';

// ── 8 套主题配置 ──
const THEMES = {
  '萌新':     { bg: '#e8f5e9', bgEnd: '#ffffff', cardBg: '#ffffff', text: '#2e7d32', radar: '#66bb6a', barTrack: 'rgba(46,125,50,0.15)', barFill: '#2e7d32', subtitle: '#558b2f' },
  '调戏师':   { bg: '#fff8e1', bgEnd: '#ffffff', cardBg: '#ffffff', text: '#f9a825', radar: '#ffcc02', barTrack: 'rgba(249,168,37,0.15)', barFill: '#f9a825', subtitle: '#f57f17' },
  '工具人':   { bg: '#e3f2fd', bgEnd: '#ffffff', cardBg: '#ffffff', text: '#37474f', radar: '#607d8b', barTrack: 'rgba(55,71,79,0.12)', barFill: '#37474f', subtitle: '#455a64' },
  '协作者':   { bg: '#e8eaf6', bgEnd: '#f5f5ff', cardBg: '#ffffff', text: '#1a237e', radar: '#3f51b5', barTrack: 'rgba(26,35,126,0.12)', barFill: '#1a237e', subtitle: '#283593' },
  '驾驭者':   { bg: '#fff3e0', bgEnd: '#fffde7', cardBg: '#ffffff', text: '#e65100', radar: '#ff9800', barTrack: 'rgba(230,81,0,0.12)', barFill: '#e65100', subtitle: '#bf360c' },
  '炼金术士': { bg: '#f3e5f5', bgEnd: '#fce4ec', cardBg: '#1a1a2e', text: '#ce93d8', radar: '#ab47bc', barTrack: 'rgba(206,147,216,0.2)', barFill: '#ce93d8', subtitle: '#8e24aa' },
  '觉醒者':   { bg: '#fce4ec', bgEnd: '#fff3e0', cardBg: '#1a1a2e', text: '#ef5350', radar: '#f44336', barTrack: 'rgba(239,83,80,0.2)', barFill: '#ef5350', subtitle: '#c62828' },
  '无界':     { bg: '#000000', bgEnd: '#1a1a2e', cardBg: '#0d0d0d', text: '#ffd700', radar: '#ffd700', barTrack: 'rgba(255,215,0,0.2)', barFill: '#ffd700', subtitle: '#daa520' },
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

  // DPR（使用新 API 替代废弃的 getSystemInfoSync）
  let pixelRatio = 2;
  try {
    const winInfo = wx.getWindowInfo();
    pixelRatio = Math.min(winInfo.pixelRatio || 2, 2);
  } catch {
    // 降级到 2x
  }
  canvas.width = W * pixelRatio;
  canvas.height = H * pixelRatio;
  ctx.scale(pixelRatio, pixelRatio);

  // ─── ① 背景渐变 ───
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bg);
  bgGrad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 顶部装饰弧线
  ctx.fillStyle = theme.cardBg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(W / 2, 120, W, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(0, 0);
  ctx.fill();

  // ─── ② 品牌标识 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('进化湾 · 你的AI段位', W / 2, 48);

  // ─── ③ 段位徽章 ───
  const badgeSrc = TIER_BADGE_IMAGES[tierName] || TIER_BADGE_IMAGES['萌新'];
  try {
    const badgeImg = canvas.createImage();
    await new Promise((resolve, reject) => {
      badgeImg.onload = resolve;
      badgeImg.onerror = reject;
      badgeImg.src = badgeSrc;
    });
    const badgeSize = 260;
    const badgeX = (W - badgeSize) / 2;
    const badgeY = 80;
    drawRoundRect(ctx, badgeX - 10, badgeY - 10, badgeSize + 20, badgeSize + 20, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.drawImage(badgeImg, badgeX, badgeY, badgeSize, badgeSize);
  } catch {
    // 徽章加载失败，跳过图片
  }

  // ─── ④ 段位名称 ───
  const tier = getTier(totalScore);
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((tier ? tier.emoji : '') + ' ' + tierName, W / 2, 390);

  // ─── ⑤ 分数 ───
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText(String(totalScore), W / 2, 470);

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
  const scoreRatio = (totalScore - minScore) / (maxScore - minScore);

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
    ctx.fillStyle = theme.subtitle;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏆 好友排名第 ${friendRank.rank} / ${friendRank.total} 位`, W / 2, friendY);
  }

  // ─── ⑩ 小程序码 ───
  const qrSize = 130;
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
      drawRoundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch { /* 小程序码加载失败 */ }
  }

  // ─── ⑪ 引导文案 ───
  ctx.fillStyle = theme.subtitle;
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('扫码测测你的AI段位', qrX - 20, qrY + qrSize / 2 + 6);
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
        canvas.toTempFilePath({
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
