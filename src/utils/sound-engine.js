/**
 * 进化湾音效引擎 — v1.0
 * 纯 WebAudioContext 代码合成，零音频文件，零 bundle 体积。
 *
 * 使用：import { createSoundEngine } from '@/utils/sound-engine.js';
 *       const engine = createSoundEngine();
 *       engine.play('tier_reveal');
 *
 * 设计原则：
 * - 温暖合成器音色（sine/triangle 为主，拒绝 harsh digital）
 * - 主音量 0.3-0.5 gain，不炸耳
 * - 签名 motif: C→E→G→C 上行大三和弦
 * - 所有 play() 包裹 try/catch，失败静默
 */

// ── 辅助函数 ──

/** 创建 oscillator + gain 的组合节点 */
function osc(ctx, type, freq, gainVal = 1.0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(gainVal, ctx.currentTime);
  o.connect(g);
  return { osc: o, gain: g };
}

/** 线性 ramp 频率 */
function rampFreq(o, from, to, t0, dur) {
  o.frequency.setValueAtTime(from, t0);
  o.frequency.linearRampToValueAtTime(to, t0 + dur);
}

/** 线性 ramp gain 包络 */
function rampGain(g, peak, attack, sustain, release, t0) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (sustain > 0) {
    g.gain.setValueAtTime(peak, t0 + attack + sustain);
  }
  g.gain.linearRampToValueAtTime(0, t0 + attack + sustain + release);
}

/** 创建 BiquadFilter */
function bqFilter(ctx, type, freq, Q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, ctx.currentTime);
  f.Q.setValueAtTime(Q, ctx.currentTime);
  return f;
}

// ── 18 个音效预设 ──

/** Tier 1-1: 反转假段位 — 下滑失望 */
function reversalFake(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.connect(ctx.destination);

  const { osc: o, gain: g } = osc(ctx, 'sawtooth', 440);
  const filter = bqFilter(ctx, 'lowpass', 2000, 1);
  o.connect(filter);
  filter.connect(g);
  g.connect(master);

  rampFreq(o, 440, 330, now, 0.3);
  filter.frequency.linearRampToValueAtTime(500, now + 0.3);
  rampGain(g, 0.3, 0.02, 0.1, 0.2, now);

  o.start(now);
  return new Promise((resolve) => {
    setTimeout(() => { try { o.stop(); master.disconnect(); } catch (e) { /* */ } resolve(); }, 350);
  });
}

/** Tier 1-2: 反转爆炸 — 粒子爆散 */
function reversalExplosion(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);

  // 10 个随机高频尖峰模拟噪音
  for (let i = 0; i < 10; i++) {
    const freq = 2000 + Math.random() * 2000;
    const t = now + i * 0.015;
    const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
    o.connect(g);
    g.connect(master);
    rampGain(g, 0.15, 0.002, 0.013, 0.01, t);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, (i + 1) * 15 + 50);
  }
  return new Promise((resolve) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } resolve(); }, 280);
  });
}

/** Tier 1-3: 反转真段位 — 高八度胜利揭晓 */
function reversalReal(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);

  // 低音 sweep（比 tier_reveal 高一倍）
  const { osc: bass, gain: bassG } = osc(ctx, 'sine', 130);
  rampFreq(bass, 130, 260, now, 0.2);
  rampGain(bassG, 0.7, 0.01, 0.2, 0.3, now);
  bass.connect(bassG);
  bassG.connect(master);
  bass.start(now);

  // 高音琶音（升八度）
  const notes = [1047, 1319, 1568, 2093]; // C6, E6, G6, C7
  notes.forEach((freq, i) => {
    const t = now + 0.1 + i * 0.1;
    const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
    rampGain(g, 0.6, 0.01, 0, 0.15, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 800);
  });

  // 泛音点缀
  const { osc: chime, gain: chimeG } = osc(ctx, 'sine', 1568);
  rampGain(chimeG, 0.3, 0.01, 0.05, 0.1, now + 0.3);
  chime.connect(chimeG);
  chimeG.connect(master);
  chime.start(now + 0.3);
  setTimeout(() => { try { chime.stop(); } catch (e) { /* */ } }, 900);

  return new Promise((resolve) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } resolve(); }, 800);
  });
}

/** Tier 1-4: 段位揭晓 — 签名 C→E→G→C 上行 */
function tierReveal(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);

  // 低音 sweep
  const { osc: bass, gain: bassG } = osc(ctx, 'sine', 65);
  rampFreq(bass, 65, 130, now, 0.2);
  rampGain(bassG, 0.7, 0.01, 0.2, 0.3, now);
  bass.connect(bassG);
  bassG.connect(master);
  bass.start(now);

  // 高音琶音 C→E→G→C
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const t = now + 0.1 + i * 0.1;
    const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
    rampGain(g, 0.6, 0.01, 0, 0.12, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 700);
  });

  return new Promise((resolve) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } resolve(); }, 650);
  });
}

/** Tier 1-5: AIQ 分数滚动 — 30 次微点击 + 最终解决音 */
function scoreCounter(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(ctx.destination);

  // 30 次微点击
  for (let i = 0; i < 30; i++) {
    const t = now + i * (800 / 30) / 1000;
    const freq = 300 + (i / 29) * 300; // 300→600Hz
    const { osc: o, gain: g } = osc(ctx, 'sine', freq);
    rampGain(g, 0.12, 0.002, 0, 0.015, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 900);
  }

  // 最终解决音
  const tFinal = now + 0.82;
  const { osc: finalO, gain: finalG } = osc(ctx, 'sine', 880);
  rampGain(finalG, 0.35, 0.01, 0.04, 0.1, tFinal);
  finalO.connect(finalG);
  finalG.connect(master);
  finalO.start(tFinal);
  setTimeout(() => { try { finalO.stop(); } catch (e) { /* */ } }, 1000);

  return new Promise((resolve) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } resolve(); }, 950);
  });
}

/** Tier 1-6: 答题 Q3 趋势预测 — 悬念到揭晓 */
function quizSurprise(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.connect(ctx.destination);

  // 低频 drone
  const { osc: drone, gain: droneG } = osc(ctx, 'sine', 80);
  rampGain(droneG, 0.25, 0.2, 0.3, 0.2, now);
  drone.connect(droneG);
  droneG.connect(master);
  drone.start(now);

  // 琶音
  const notes = [262, 330, 392, 523]; // C4→E4→G4→C5
  notes.forEach((freq, i) => {
    const t = now + 0.25 + i * 0.1;
    const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
    rampGain(g, 0.25, 0.01, 0, 0.07, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 900);
  });

  return new Promise((resolve) => {
    setTimeout(() => { try { drone.stop(); master.disconnect(); } catch (e) { /* */ } resolve(); }, 850);
  });
}

/** Tier 1-7: 签到打卡 — 护照盖章感 */
function checkinStamp(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);

  // 第一声
  const { osc: o1, gain: g1 } = osc(ctx, 'sine', 800);
  rampGain(g1, 0.4, 0.002, 0, 0.05, now);
  o1.connect(g1);
  g1.connect(master);
  o1.start(now);

  // 第二声
  const t2 = now + 0.05;
  const { osc: o2, gain: g2 } = osc(ctx, 'sine', 1200);
  rampGain(g2, 0.35, 0.002, 0, 0.05, t2);
  o2.connect(g2);
  g2.connect(master);
  o2.start(t2);

  return new Promise((resolve) => {
    setTimeout(() => {
      try { o1.stop(); o2.stop(); master.disconnect(); } catch (e) { /* */ }
      resolve();
    }, 180);
  });
}

/** Tier 1-8: 签到里程碑 — 按天数分级 */
function checkinMilestone(ctx, options = {}) {
  const days = options.days || 3;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const baseNotes = [523, 659, 784, 1047]; // C5, E5, G5, C6

  if (days >= 30) {
    // 全号角
    master.gain.setValueAtTime(0.5, now);
    const { osc: bass, gain: bassG } = osc(ctx, 'sine', 40);
    rampFreq(bass, 40, 160, now, 0.8);
    rampGain(bassG, 0.5, 0.05, 0.5, 0.3, now);
    bass.connect(bassG);
    bassG.connect(master);
    bass.start(now);

    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
      const t = now + 0.2 + i * 0.12;
      const { osc: o, gain: g } = osc(ctx, 'sine', freq);
      rampGain(g, 0.35, 0.01, 0, 0.15, t);
      o.connect(g);
      g.connect(master);
      o.start(t);
      setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 1300);
    });
    setTimeout(() => { try { bass.stop(); master.disconnect(); } catch (e) { /* */ } }, 1300);
    return new Promise((r) => setTimeout(r, 1200));
  }

  if (days >= 14) {
    // 带延迟效果
    master.gain.setValueAtTime(0.45, now);
    baseNotes.forEach((freq, i) => {
      const t = now + i * 0.12;
      const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
      rampGain(g, 0.4, 0.01, 0, 0.12, t);
      o.connect(g);
      g.connect(master);
      o.start(t);

      // 延迟回响
      const tDel = t + 0.15;
      const { osc: od, gain: gd } = osc(ctx, 'triangle', freq * 0.99);
      rampGain(gd, 0.15, 0.005, 0, 0.08, tDel);
      od.connect(gd);
      gd.connect(master);
      od.start(tDel);
      setTimeout(() => { try { od.stop(); } catch (e) { /* */ } }, 800);
      setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 800);
    });
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } }, 750);
    return new Promise((r) => setTimeout(r, 700));
  }

  if (days >= 7) {
    master.gain.setValueAtTime(0.45, now);
    baseNotes.forEach((freq, i) => {
      const t = now + i * 0.12;
      const { osc: o, gain: g } = osc(ctx, 'triangle', freq);
      rampGain(g, 0.4, 0.01, 0, 0.1, t);
      o.connect(g);
      g.connect(master);
      o.start(t);
      setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 600);
    });
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } }, 550);
    return new Promise((r) => setTimeout(r, 500));
  }

  // Day 3: 简单 3 音
  master.gain.setValueAtTime(0.4, now);
  baseNotes.slice(0, 3).forEach((freq, i) => {
    const t = now + i * 0.1;
    const { osc: o, gain: g } = osc(ctx, 'sine', freq);
    rampGain(g, 0.35, 0.01, 0, 0.08, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 380);
  });
  setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } }, 340);
  return new Promise((r) => setTimeout(r, 300));
}

// ── Tier 2 预设 ──

function quizSelectHigh(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.connect(ctx.destination);
  const { osc: o, gain: g } = osc(ctx, 'sine', 660);
  rampFreq(o, 660, 880, now, 0.1);
  rampGain(g, 0.4, 0.005, 0, 0.08, now);
  o.connect(g);
  g.connect(master);
  o.start(now);
  return new Promise((r) => {
    setTimeout(() => { try { o.stop(); master.disconnect(); } catch (e) { /* */ } r(); }, 180);
  });
}

function quizSelectLow(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(ctx.destination);
  const { osc: o, gain: g } = osc(ctx, 'sine', 440);
  rampGain(g, 0.25, 0.003, 0, 0.05, now);
  o.connect(g);
  g.connect(master);
  o.start(now);
  return new Promise((r) => {
    setTimeout(() => { try { o.stop(); master.disconnect(); } catch (e) { /* */ } r(); }, 100);
  });
}

function quizNext(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(ctx.destination);
  const sweeps = [[200, 400], [300, 600], [500, 1000]];
  sweeps.forEach(([from, to], i) => {
    const t = now + i * 0.03;
    const { osc: o, gain: g } = osc(ctx, 'sine', from);
    rampFreq(o, from, to, t, 0.04);
    rampGain(g, 0.2, 0.003, 0, 0.04, t);
    o.connect(g);
    g.connect(master);
    o.start(t);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 200);
  });
  return new Promise((r) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } r(); }, 210);
  });
}

function streakMilestone(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);
  [523, 659, 784].forEach((freq) => {
    const { osc: o, gain: g } = osc(ctx, 'sine', freq);
    rampGain(g, 0.35, 0.05, 0, 0.25, now);
    o.connect(g);
    g.connect(master);
    o.start(now);
    setTimeout(() => { try { o.stop(); } catch (e) { /* */ } }, 350);
  });
  return new Promise((r) => {
    setTimeout(() => { try { master.disconnect(); } catch (e) { /* */ } r(); }, 340);
  });
}

function resultPercentile(ctx, options = {}) {
  const pct = options.percentile || 50;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(ctx.destination);
  const endFreq = 200 + (pct / 100) * 600;
  const { osc: o, gain: g } = osc(ctx, 'sine', 200);
  rampFreq(o, 200, endFreq, now, 0.3);
  rampGain(g, 0.3, 0.02, 0.2, 0.08, now);
  o.connect(g);
  g.connect(master);
  o.start(now);
  return new Promise((r) => {
    setTimeout(() => { try { o.stop(); master.disconnect(); } catch (e) { /* */ } r(); }, 380);
  });
}

function nearMiss(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.3, now);
  master.connect(ctx.destination);

  const { osc: o1, gain: g1 } = osc(ctx, 'sine', 440);
  rampGain(g1, 0.25, 0.01, 0.15, 0.04, now);
  o1.connect(g1);
  g1.connect(master);
  o1.start(now);

  const t2 = now + 0.25;
  const { osc: o2, gain: g2 } = osc(ctx, 'sine', 494);
  o2.detune.setValueAtTime(2, t2); // 微 detune 制造张力
  rampGain(g2, 0.25, 0.01, 0.15, 0.04, t2);
  o2.connect(g2);
  g2.connect(master);
  o2.start(t2);

  return new Promise((r) => {
    setTimeout(() => {
      try { o1.stop(); o2.stop(); master.disconnect(); } catch (e) { /* */ }
      r();
    }, 550);
  });
}

function knowledgeCard(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.connect(ctx.destination);

  const { osc: sweep, gain: sweepG } = osc(ctx, 'sine', 500);
  rampFreq(sweep, 500, 1000, now, 0.08);
  rampGain(sweepG, 0.35, 0.005, 0, 0.06, now);
  sweep.connect(sweepG);
  sweepG.connect(master);
  sweep.start(now);

  const { osc: sparkle, gain: sparkleG } = osc(ctx, 'sine', 2000);
  rampGain(sparkleG, 0.2, 0.003, 0, 0.04, now + 0.06);
  sparkle.connect(sparkleG);
  sparkleG.connect(master);
  sparkle.start(now + 0.06);

  return new Promise((r) => {
    setTimeout(() => {
      try { sweep.stop(); sparkle.stop(); master.disconnect(); } catch (e) { /* */ }
      r();
    }, 180);
  });
}

// ── Tier 3 预设 ──

function ctaPress(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.4, now);
  master.connect(ctx.destination);

  const { osc: bass, gain: bassG } = osc(ctx, 'sine', 60);
  rampGain(bassG, 0.7, 0.005, 0, 0.07, now);
  bass.connect(bassG);
  bassG.connect(master);
  bass.start(now);

  const { osc: sparkle, gain: sparkleG } = osc(ctx, 'sine', 3000);
  rampGain(sparkleG, 0.3, 0.003, 0, 0.04, now + 0.02);
  sparkle.connect(sparkleG);
  sparkleG.connect(master);
  sparkle.start(now + 0.02);

  return new Promise((r) => {
    setTimeout(() => {
      try { bass.stop(); sparkle.stop(); master.disconnect(); } catch (e) { /* */ }
      r();
    }, 150);
  });
}

function homeArrive(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.connect(ctx.destination);

  const { osc: o, gain: g } = osc(ctx, 'sawtooth', 110);
  const filter = bqFilter(ctx, 'lowpass', 400, 0.7);
  o.connect(filter);
  filter.connect(g);
  g.connect(master);
  rampGain(g, 0.4, 0.2, 0.1, 0.2, now);
  o.start(now);

  return new Promise((r) => {
    setTimeout(() => { try { o.stop(); master.disconnect(); } catch (e) { /* */ } r(); }, 550);
  });
}

function resultWhisper(ctx) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.15, now);
  master.connect(ctx.destination);

  const { osc: bell, gain: bellG } = osc(ctx, 'sine', 1047);
  rampGain(bellG, 0.15, 0.1, 0, 2.0, now);
  bell.connect(bellG);
  bellG.connect(master);
  bell.start(now);

  return new Promise((r) => {
    setTimeout(() => { try { bell.stop(); master.disconnect(); } catch (e) { /* */ } r(); }, 2300);
  });
}

// ── 预设注册表 ──

const PRESETS = new Map([
  ['reversal_fake', reversalFake],
  ['reversal_explosion', reversalExplosion],
  ['reversal_real', reversalReal],
  ['tier_reveal', tierReveal],
  ['score_counter', scoreCounter],
  ['quiz_surprise', quizSurprise],
  ['checkin_stamp', checkinStamp],
  ['checkin_milestone', checkinMilestone],
  ['quiz_select_high', quizSelectHigh],
  ['quiz_select_low', quizSelectLow],
  ['quiz_next', quizNext],
  ['streak_milestone', streakMilestone],
  ['result_percentile', resultPercentile],
  ['near_miss', nearMiss],
  ['knowledge_card', knowledgeCard],
  ['cta_press', ctaPress],
  ['home_arrive', homeArrive],
  ['result_whisper', resultWhisper],
]);

// ── 引擎工厂 ──

let _instance = null;

export function createSoundEngine() {
  if (_instance) return _instance;

  let _audioCtx = null;
  let _muted = false;
  let _initialized = false;

  // 恢复静音状态
  try { _muted = !!uni.getStorageSync('sound_muted'); } catch (e) { /* */ }

  const engine = {
    init() {
      if (_initialized) return;
      try {
        if (typeof wx === 'undefined' || !wx.createWebAudioContext) {
          console.log('[sound-engine] WebAudioContext 不可用，音效已静音');
          _muted = true;
          _initialized = true;
          return;
        }
        _audioCtx = wx.createWebAudioContext();
        // iOS: context 可能 suspended，尝试 resume
        if (_audioCtx && typeof _audioCtx.resume === 'function') {
          _audioCtx.resume();
        }
        _initialized = true;
      } catch (e) {
        console.warn('[sound-engine] 初始化失败:', e.message);
        _muted = true;
        _initialized = true;
      }
    },

    play(name, options = {}) {
      if (_muted) return;
      if (!_initialized) this.init();
      if (!_audioCtx || _muted) return;

      const preset = PRESETS.get(name);
      if (!preset) {
        console.warn('[sound-engine] 未知音效:', name);
        return;
      }

      try {
        preset(_audioCtx, options);
      } catch (e) {
        // 静默失败，不阻塞任何 UI
      }
    },

    setMuted(muted) {
      _muted = muted;
      try {
        if (muted) {
          uni.setStorageSync('sound_muted', true);
        } else {
          uni.removeStorageSync('sound_muted');
        }
      } catch (e) { /* */ }
    },

    isMuted() {
      return _muted;
    },

    destroy() {
      if (_audioCtx) {
        try { _audioCtx.close(); } catch (e) { /* */ }
        _audioCtx = null;
      }
      _initialized = false;
    },
  };

  _instance = engine;
  return engine;
}
