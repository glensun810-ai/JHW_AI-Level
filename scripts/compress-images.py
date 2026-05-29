#!/usr/bin/env python3
"""
图片压缩优化脚本 — 微信小程序资源优化
压缩策略：
  - PNG: 量化到 8-bit 调色板，适合图标/徽章
  - 默认分享图: JPEG 85%，无透明度需求
  - 保持视觉效果，文件大小削减 60-80%
"""
import os
import sys
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'src', 'static')

def size_kb(path):
    return os.path.getsize(path) / 1024

def compress_png_palette(path, colors=256):
    """PNG 量化到调色板模式，适合段位徽章"""
    img = Image.open(path)
    if img.mode == 'RGBA':
        # 保留 alpha 通道，量化到调色板
        img_q = img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT)
        # 复制回调色板以保留透明度
        img_q = img_q.convert('RGBA')
    else:
        img_q = img.quantize(colors=min(colors, 128), method=Image.Quantize.MEDIANCUT)
    # 保存时使用 optimize
    img_q.save(path, 'PNG', optimize=True)
    return size_kb(path)

def compress_png_rgb(path):
    """RGB PNG 压缩 — 适合无透明度的图"""
    img = Image.open(path)
    if img.mode == 'RGBA':
        # 铺白底
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(path, 'PNG', optimize=True)
    return size_kb(path)

def main():
    results = []

    # ── 1. default-share.png (大图，199KB) ──
    share_path = os.path.join(SRC, 'images', 'default-share.png')
    if os.path.exists(share_path):
        before = size_kb(share_path)
        img = Image.open(share_path)
        # 缩小到 400×320 (保持 5:4 比例)，作为分享默认图足够
        img = img.resize((400, 320), Image.LANCZOS)
        # 量化到 128 色调色板（分享图多为暗色渐变）
        if img.mode == 'RGBA':
            bg = Image.new('RGB', img.size, (10, 14, 39))
            bg.paste(img, mask=img.split()[3])
            img = bg
        img = img.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
        img.save(share_path, 'PNG', optimize=True)
        after = size_kb(share_path)
        results.append(('default-share.png', before, after))

    # ── 2. 段位徽章 (8 个 PNG，120KB 合计) ──
    badges_dir = os.path.join(SRC, 'images', 'tier-badges')
    if os.path.exists(badges_dir):
        for fname in sorted(os.listdir(badges_dir)):
            if not fname.endswith('.png'):
                continue
            fpath = os.path.join(badges_dir, fname)
            before = size_kb(fpath)
            img = Image.open(fpath)
            # 调整为实际渲染大小 220×220（当前 200×200 已合理）
            # 量化到 128 色
            if img.mode == 'RGBA':
                img_q = img.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
            else:
                img_q = img.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
            img_q.save(fpath, 'PNG', optimize=True)
            after = size_kb(fpath)
            results.append((f'tier-badges/{fname}', before, after))

    # ── 3. 其他小图 ──
    for sub in ['icons']:
        d = os.path.join(SRC, sub)
        if not os.path.exists(d):
            continue
        for fname in sorted(os.listdir(d)):
            if not fname.endswith('.png'):
                continue
            fpath = os.path.join(d, fname)
            before = size_kb(fpath)
            img = Image.open(fpath)
            img.save(fpath, 'PNG', optimize=True)
            after = size_kb(fpath)
            if after < before:
                results.append((f'{sub}/{fname}', before, after))

    # ── 打印结果 ──
    total_before = sum(r[1] for r in results)
    total_after = sum(r[2] for r in results)
    print(f"{'File':<35} {'Before':>8} {'After':>8} {'Saved':>8}")
    print('-' * 62)
    for name, b, a in results:
        saved = b - a
        pct = (saved / b * 100) if b > 0 else 0
        print(f'{name:<35} {b:>7.1f}K {a:>7.1f}K {saved:>7.1f}K ({pct:>5.1f}%)')
    print('-' * 62)
    saved_total = total_before - total_after
    pct_total = (saved_total / total_before * 100) if total_before > 0 else 0
    print(f'{"TOTAL":<35} {total_before:>7.1f}K {total_after:>7.1f}K {saved_total:>7.1f}K ({pct_total:>5.1f}%)')

if __name__ == '__main__':
    main()
