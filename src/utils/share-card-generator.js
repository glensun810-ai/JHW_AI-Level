/**
 * 分享卡片生成器 — v1.2
 * 在 App 启动时预生成 400×320 分享卡片（含小程序码），
 * 缓存到 globalData.defaultShareImage，所有页面分享统一使用。
 *
 * 微信分享卡片比例 5:4，推荐 400×320。
 */

import { callCloudFunction } from './api.js';

// 静态小程序码 fallback（云函数生成失败时使用）
const FALLBACK_QR = '/static/jhw-xcx.jpg';

// 缓存 key
const CACHE_KEY = '__share_card_image__';

/**
 * 生成默认分享卡片并返回临时文件路径
 * 支持离屏 canvas（微信基础库 ≥ 2.16.1）和降级方案
 */
export async function generateDefaultShareCard() {
  // ① 先检查缓存
  const cached = uni.getStorageSync(CACHE_KEY);
  if (cached) {
    try {
      const fs = uni.getFileSystemManager();
      fs.accessSync(cached);
      return cached;
    } catch (e) {
      // 缓存文件已失效，重新生成
    }
  }

  // ② 获取小程序码（优先云函数生成，fallback 静态图）
  let qrUrl = FALLBACK_QR;
  try {
    const res = await callCloudFunction('getWeeklyStats', { action: 'getMiniCode' }, { retry: false });
    if (res.code === 0 && res.data && res.data.miniCodeUrl) {
      qrUrl = res.data.miniCodeUrl;
    }
  } catch (e) {
    // 静默 fallback 到静态小程序码
  }

  // ③ 尝试离屏 canvas 生成
  try {
    const tempPath = await renderShareCard(qrUrl);
    uni.setStorageSync(CACHE_KEY, tempPath);
    return tempPath;
  } catch (e) {
    console.warn('[share-card] 离屏 canvas 生成失败，使用 fallback:', e.message);
    // 降级：直接返回小程序码图片（至少用户能看到码）
    return qrUrl;
  }
}

/**
 * 使用离屏 canvas 渲染分享卡片
 */
function renderShareCard(qrUrl) {
  return new Promise((resolve, reject) => {
    // 检查离屏 canvas 是否可用
    if (typeof uni === 'undefined' || !uni.createOffscreenCanvas) {
      return reject(new Error('offscreen canvas 不可用'));
    }

    const W = 400;
    const H = 320;
    let canvas;
    try {
      canvas = uni.createOffscreenCanvas({ type: '2d', width: W, height: H });
    } catch (e) {
      return reject(new Error('创建离屏 canvas 失败: ' + e.message));
    }

    const ctx = canvas.getContext('2d');

    // ─── 背景渐变 ───
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0533');
    bg.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ─── 装饰光晕 ───
    const glow = ctx.createRadialGradient(W / 2, 50, 10, W / 2, 50, 180);
    glow.addColorStop(0, 'rgba(124, 58, 237, 0.25)');
    glow.addColorStop(1, 'rgba(124, 58, 237, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ─── 标题 ───
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('进化湾 · AI段位测评', W / 2, 22);

    // ─── 副标题 ───
    ctx.fillStyle = '#f59e0b';
    ctx.font = '15px sans-serif';
    ctx.fillText('你的AI段位是什么？', W / 2, 58);

    // ─── 小程序码（居中偏左，右侧留给文案） ───
    // 先绘制码的图片
    const qrImg = canvas.createImage();
    qrImg.onload = () => {
      const qrSize = 130;
      const qrX = 20;
      const qrY = 100;

      // 白色圆角背景
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      roundRectPath(ctx, qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 12);
      ctx.fill();

      // 小程序码
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // ─── 右侧引导文案 ───
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('长按或扫码', qrX + qrSize + 24, qrY + 20);
      ctx.fillText('免费测AI段位', qrX + qrSize + 24, qrY + 48);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '13px sans-serif';
      ctx.fillText('看看你在好友中排第几', qrX + qrSize + 24, qrY + 76);

      // ─── 底部标识 ───
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('进化湾 · 追踪你的AI进化之路', W / 2, H - 22);

      // ─── 导出 ───
      canvas.toTempFilePath({
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(new Error('导出失败: ' + (err.errMsg || 'unknown'))),
      });
    };

    qrImg.onerror = () => reject(new Error('小程序码图片加载失败'));

    // 设置 src 必须在 onload 之后（部分基础库行为）
    qrImg.src = qrUrl;
  });
}

/**
 * 绘制圆角矩形路径
 */
function roundRectPath(ctx, x, y, w, h, r) {
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

/**
 * 清除缓存的分享卡片（小程序码更新时调用）
 */
export function clearShareCardCache() {
  uni.removeStorageSync(CACHE_KEY);
}
