<template>
  <canvas type="2d" id="particle-canvas" class="particle-canvas" />
</template>

<script setup>
import { getCurrentInstance, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';

const instance = getCurrentInstance();

const PARTICLE_COUNT = 80;
const CONNECTION_DIST = 100;
const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
const MAX_DPR = 2;

// Particle color palette: white / light purple / light gold
const PALETTE = [
  [255, 255, 255],
  [190, 160, 255],
  [255, 220, 175],
];

let canvas = null;
let ctx = null;
let cw = 0;
let ch = 0;
let dpr = 1;
let particles = [];
let rafId = null;
let isVisible = true;
let isAccelerated = false;
let accelTimer = null;

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = Math.random() * cw;
    this.y = initial ? Math.random() * ch : ch + 10 + Math.random() * 30;
    this.size = 2 + Math.random() * 3;
    this.baseSpeed = 0.3 + Math.random() * 0.5;
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.r = c[0];
    this.g = c[1];
    this.b = c[2];
    this.alpha = 0.2 + Math.random() * 0.4;
  }

  update() {
    const speed = isAccelerated ? this.baseSpeed * 3 : this.baseSpeed;
    this.y -= speed;
    if (this.y + this.size < -10) {
      this.y = ch + this.size;
      this.x = Math.random() * cw;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${this.alpha})`;
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }
}

function drawConnections() {
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dSq = dx * dx + dy * dy;
      if (dSq < CONNECTION_DIST_SQ) {
        const alpha = 0.05 + (1 - Math.sqrt(dSq) / CONNECTION_DIST) * 0.1;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(200,180,255,${alpha})`;
        ctx.stroke();
      }
    }
  }
}

function loop() {
  if (!isVisible || !ctx) return;

  // Semi-transparent clear creates subtle motion trails
  ctx.clearRect(0, 0, cw, ch);

  for (const p of particles) {
    p.update();
    p.draw();
  }
  drawConnections();

  rafId = canvas.requestAnimationFrame(loop);
}

function startLoop() {
  if (!canvas || rafId) return;
  rafId = canvas.requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) {
    canvas?.cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// Exposed: parent triggers acceleration on CTA tap
function accelerate() {
  isAccelerated = true;
  clearTimeout(accelTimer);
  accelTimer = setTimeout(() => {
    isAccelerated = false;
  }, 500);
}

onShow(() => {
  isVisible = true;
  startLoop();
});

onHide(() => {
  isVisible = false;
  stopLoop();
});

onMounted(() => {
  const winInfo = wx.getWindowInfo();
  cw = winInfo.windowWidth;
  ch = winInfo.windowHeight;
  dpr = Math.min(winInfo.pixelRatio || 2, MAX_DPR);

  const query = uni.createSelectorQuery().in(instance);
  query.select('#particle-canvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0]?.node) return;
      canvas = res[0].node;
      ctx = canvas.getContext('2d');
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.scale(dpr, dpr);
      initParticles();
      startLoop();
    });
});

onUnmounted(() => {
  stopLoop();
  clearTimeout(accelTimer);
  particles = [];
});

defineExpose({ accelerate });
</script>

<style scoped>
.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}
</style>
