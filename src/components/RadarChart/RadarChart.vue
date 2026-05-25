<template>
  <view class="radar-chart" :style="{ width: width + 'px', height: height + 'px' }">
    <canvas
      type="2d"
      :id="canvasId"
      :style="{ width: width + 'px', height: height + 'px' }"
    ></canvas>
  </view>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, getCurrentInstance } from 'vue';

const props = defineProps({
  dimensions: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  width: { type: Number, default: 300 },
  height: { type: Number, default: 300 },
});

const instance = getCurrentInstance();
const canvasId = 'radar-' + Math.random().toString(36).slice(2, 8);

function drawRadar() {
  const query = uni.createSelectorQuery().in(instance);
  query.select('#' + canvasId)
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(wx.getWindowInfo().pixelRatio || 2, 2);

      canvas.width = props.width * dpr;
      canvas.height = props.height * dpr;
      ctx.scale(dpr, dpr);

      const cx = props.width / 2;
      const cy = props.height / 2;
      const radius = Math.min(cx, cy) * 0.7;
      const count = props.dimensions.length;
      const angleStep = (Math.PI * 2) / count;

      // 清除画布
      ctx.clearRect(0, 0, props.width, props.height);

      // 绘制背景网格（5层同心多边形）
      for (let level = 1; level <= 5; level++) {
        const r = (radius / 5) * level;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + level * 0.02})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
          const x = cx + r * Math.cos(angleStep * i - Math.PI / 2);
          const y = cy + r * Math.sin(angleStep * i - Math.PI / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 绘制轴线
      for (let i = 0; i < count; i++) {
        const x = cx + radius * Math.cos(angleStep * i - Math.PI / 2);
        const y = cy + radius * Math.sin(angleStep * i - Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 绘制数据多边形
      if (props.values.length === count) {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const val = props.values[i] / 100;
          const r = radius * val;
          const x = cx + r * Math.cos(angleStep * i - Math.PI / 2);
          const y = cy + r * Math.sin(angleStep * i - Math.PI / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#00c8ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制数据点
        for (let i = 0; i < count; i++) {
          const val = props.values[i] / 100;
          const r = radius * val;
          const x = cx + r * Math.cos(angleStep * i - Math.PI / 2);
          const y = cy + r * Math.sin(angleStep * i - Math.PI / 2);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#00c8ff';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 绘制维度标签
      ctx.fillStyle = '#8899aa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < count; i++) {
        const labelR = radius + 14;
        const x = cx + labelR * Math.cos(angleStep * i - Math.PI / 2);
        const y = cy + labelR * Math.sin(angleStep * i - Math.PI / 2);
        ctx.fillText(props.dimensions[i], x, y);
      }
    });
}

onMounted(() => {
  nextTick(() => {
    setTimeout(drawRadar, 100);
  });
});

watch(() => props.values, () => {
  nextTick(() => {
    setTimeout(drawRadar, 50);
  });
}, { deep: true });
</script>

<style scoped lang="scss">
.radar-chart {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
