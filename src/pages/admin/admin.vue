<template>
  <view class="page-admin" v-if="isAdmin">
    <!-- 密码验证 -->
    <view class="page-admin__auth" v-if="!authenticated">
      <text class="page-admin__auth-title">进化湾 · 指挥中心</text>
      <text class="page-admin__auth-desc">请输入管理密码</text>
      <input
        class="page-admin__auth-input"
        type="password"
        v-model="adminPassword"
        placeholder="输入密码"
        @confirm="doAuth"
      />
      <view class="page-admin__auth-btn" @tap="doAuth">验证</view>
      <text class="page-admin__auth-error" v-if="authError">{{ authError }}</text>
    </view>

    <!-- 仪表盘内容 -->
    <view v-else>
    <view class="page-admin__header">
      <text class="page-admin__title">进化湾 · 指挥中心</text>
      <text class="page-admin__updated" v-if="updatedAt">更新于 {{ formatTime(updatedAt) }}</text>
    </view>

    <!-- K-factor 卡片 -->
    <view class="page-admin__kf-card">
      <view class="page-admin__kf-main">
        <text class="page-admin__kf-label">病毒系数 K</text>
        <text class="page-admin__kf-value" :style="{ color: kfColor }">{{ kFactor.current.toFixed(2) }}</text>
      </view>
      <view class="page-admin__kf-trends">
        <view class="page-admin__trend-item">
          <text class="page-admin__trend-label">24h</text>
          <text class="page-admin__trend-value" :class="'page-admin__trend--' + kFactor.trend24h.direction">
            {{ trendArrow(kFactor.trend24h.direction) }} {{ formatDelta(kFactor.trend24h.delta) }}
          </text>
        </view>
        <view class="page-admin__trend-item">
          <text class="page-admin__trend-label">7d</text>
          <text class="page-admin__trend-value" :class="'page-admin__trend--' + kFactor.trend7d.direction">
            {{ trendArrow(kFactor.trend7d.direction) }} {{ formatDelta(kFactor.trend7d.delta) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 告警状态 -->
    <view class="page-admin__alert" :class="'page-admin__alert--' + alerts.overall">
      <text class="page-admin__alert-icon">{{ alertIcon }}</text>
      <text class="page-admin__alert-text">{{ alertText }}</text>
    </view>

    <!-- 漏斗 -->
    <view class="page-admin__section" v-if="funnel">
      <text class="page-admin__section-title">转化漏斗</text>
      <view class="page-admin__funnel">
        <view class="page-admin__funnel-step">
          <text class="page-admin__funnel-name">卡片点击率</text>
          <text class="page-admin__funnel-val">{{ funnel.cardCtr }}%</text>
          <view class="page-admin__funnel-bar"><view class="page-admin__funnel-fill" :style="{ width: funnel.cardCtr + '%', background: barColor(funnel.cardCtr, 80, 60) }" /></view>
        </view>
        <view class="page-admin__funnel-step">
          <text class="page-admin__funnel-name">首页→测试</text>
          <text class="page-admin__funnel-val">{{ funnel.homeToStart }}%</text>
          <view class="page-admin__funnel-bar"><view class="page-admin__funnel-fill" :style="{ width: funnel.homeToStart + '%', background: barColor(funnel.homeToStart, 90, 70) }" /></view>
        </view>
        <view class="page-admin__funnel-step">
          <text class="page-admin__funnel-name">答题完成率</text>
          <text class="page-admin__funnel-val">{{ funnel.completionRate }}%</text>
          <view class="page-admin__funnel-bar"><view class="page-admin__funnel-fill" :style="{ width: funnel.completionRate + '%', background: barColor(funnel.completionRate, 85, 60) }" /></view>
        </view>
        <view class="page-admin__funnel-step">
          <text class="page-admin__funnel-name">分享率</text>
          <text class="page-admin__funnel-val">{{ funnel.shareRate }}%</text>
          <view class="page-admin__funnel-bar"><view class="page-admin__funnel-fill" :style="{ width: funnel.shareRate + '%', background: barColor(funnel.shareRate, 60, 35) }" /></view>
        </view>
        <view class="page-admin__funnel-step">
          <text class="page-admin__funnel-name">K-factor</text>
          <text class="page-admin__funnel-val">{{ funnel.viralCoef.toFixed(2) }}</text>
          <view class="page-admin__funnel-bar"><view class="page-admin__funnel-fill" :style="{ width: Math.min(funnel.viralCoef * 50, 100) + '%', background: funnel.viralCoef >= 1 ? '#4caf50' : funnel.viralCoef >= 0.8 ? '#f59e0b' : '#f44336' }" /></view>
        </view>
      </view>
    </view>

    <!-- 日活 -->
    <view class="page-admin__section" v-if="dau">
      <text class="page-admin__section-title">今日概况</text>
      <view class="page-admin__dau-row">
        <view class="page-admin__dau-card">
          <text class="page-admin__dau-num">{{ dau.dau }}</text>
          <text class="page-admin__dau-label">今日 DAU</text>
        </view>
        <view class="page-admin__dau-card">
          <text class="page-admin__dau-num">{{ dau.newUsers }}</text>
          <text class="page-admin__dau-label">新增用户</text>
        </view>
        <view class="page-admin__dau-card">
          <text class="page-admin__dau-num">{{ dau.returningUsers }}</text>
          <text class="page-admin__dau-label">回访用户</text>
        </view>
      </view>
    </view>

    <!-- A/B 对比 -->
    <view class="page-admin__section" v-if="abVariants.length > 0">
      <text class="page-admin__section-title">A/B 变体对比（近7天）</text>
      <view class="page-admin__ab-table">
        <view class="page-admin__ab-row page-admin__ab-row--head">
          <text class="page-admin__ab-cell">变体</text>
          <text class="page-admin__ab-cell">访问</text>
          <text class="page-admin__ab-cell">完成率</text>
          <text class="page-admin__ab-cell">分享率</text>
        </view>
        <view v-for="v in abVariants" :key="v.name" class="page-admin__ab-row">
          <text class="page-admin__ab-cell">{{ v.name }}</text>
          <text class="page-admin__ab-cell">{{ v.homeViews }}</text>
          <text class="page-admin__ab-cell">{{ v.completionRate }}%</text>
          <text class="page-admin__ab-cell">{{ v.shareRate }}%</text>
        </view>
      </view>
    </view>

    <!-- 快照统计 -->
    <view class="page-admin__section">
      <text class="page-admin__section-title">快照覆盖</text>
      <view class="page-admin__snap-row">
        <text>24h: {{ snapshotCount24h }} 条</text>
        <text>7d: {{ snapshotCount7d }} 条</text>
        <text>30d: {{ snapshotCount30d }} 条</text>
      </view>
    </view>

    <!-- 红区告警详情 -->
    <view class="page-admin__section" v-if="alerts.reds && alerts.reds.length > 0">
      <text class="page-admin__section-title page-admin__section-title--red">🔴 红色告警</text>
      <view v-for="r in alerts.reds" :key="r.key" class="page-admin__red-item">
        <text class="page-admin__red-name">{{ r.name }}</text>
        <text class="page-admin__red-val">{{ r.value }}{{ r.detail ? ' (' + r.detail + ')' : '' }}</text>
      </view>
    </view>
    </view>
  </view>

  <!-- 非管理员 -->
  <view v-else class="page-admin__denied">
    <text>无权访问</text>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { fetchDashboard } from '@/utils/api.js';

const isAdmin = ref(false);
const authenticated = ref(false);
const adminPassword = ref('');
const authError = ref('');
const kFactor = ref({ current: 0, trend24h: { delta: 0, direction: 'flat' }, trend7d: { delta: 0, direction: 'flat' } });
const funnel = ref(null);
const alerts = ref({ overall: 'unknown', reds: [], yellows: [] });
const dau = ref(null);
const abComparison = ref({});
const updatedAt = ref(null);
const snapshotCount24h = ref(0);
const snapshotCount7d = ref(0);
const snapshotCount30d = ref(0);

const abVariants = computed(() => {
  return Object.entries(abComparison.value).map(([name, data]) => ({ name, ...data }));
});

const kfColor = computed(() => {
  if (kFactor.value.current >= 1.1) return '#4caf50';
  if (kFactor.value.current >= 0.8) return '#f59e0b';
  return '#f44336';
});

const alertIcon = computed(() => {
  if (alerts.value.overall === 'red') return '🔴';
  if (alerts.value.overall === 'yellow') return '🟡';
  return '🟢';
});

const alertText = computed(() => {
  if (alerts.value.overall === 'red') return `红色警报：${alerts.value.reds.length} 项指标异常`;
  if (alerts.value.overall === 'yellow') return `黄色预警：${alerts.value.yellows.length} 项指标需关注`;
  if (alerts.value.overall === 'green') return '所有指标正常';
  return '无数据';
});

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const options = page.$page ? page.$page.options : page.options || {};
  isAdmin.value = options.admin === '1';
});

async function doAuth() {
  authError.value = '';
  try {
    const res = await fetchDashboard(adminPassword.value);
    if (res.code === 403) {
      authError.value = '密码错误，请重试';
      return;
    }
    if (res.code === 0 && res.data) {
      authenticated.value = true;
      applyDashboardData(res.data);
    } else {
      authError.value = '加载失败，请重试';
    }
  } catch (e) {
    authError.value = '网络错误，请重试';
    console.error('[admin] auth failed:', e);
  }
}

function applyDashboardData(d) {
  kFactor.value = d.kFactor || kFactor.value;
  funnel.value = d.funnel;
  alerts.value = d.alerts || alerts.value;
  dau.value = d.dau;
  abComparison.value = d.abComparison || {};
  updatedAt.value = d.updatedAt;
  snapshotCount24h.value = d.snapshotCount24h || 0;
  snapshotCount7d.value = d.snapshotCount7d || 0;
  snapshotCount30d.value = d.snapshotCount30d || 0;
}

function trendArrow(dir) {
  if (dir === 'up') return '↑';
  if (dir === 'down') return '↓';
  return '→';
}

function formatDelta(delta) {
  return delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
}

function barColor(val, green, yellow) {
  if (val >= green) return '#4caf50';
  if (val >= yellow) return '#f59e0b';
  return '#f44336';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped lang="scss">
.page-admin {
  min-height: 100vh;
  background: $color-bg-primary;
  padding: 24rpx 28rpx 60rpx;

  // Auth
  &__auth {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 160rpx;
  }

  &__auth-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #fff;
    margin-bottom: 16rpx;
  }

  &__auth-desc {
    font-size: 26rpx;
    color: $color-text-muted;
    margin-bottom: 48rpx;
  }

  &__auth-input {
    width: 480rpx;
    height: 80rpx;
    background: rgba(255,255,255,0.08);
    border: 1rpx solid rgba(255,255,255,0.12);
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #fff;
    text-align: center;
    margin-bottom: 28rpx;
  }

  &__auth-btn {
    width: 480rpx;
    height: 80rpx;
    line-height: 80rpx;
    text-align: center;
    background: $color-gold;
    color: #1a1a2e;
    font-size: 28rpx;
    font-weight: bold;
    border-radius: 12rpx;
  }

  &__auth-error {
    font-size: 24rpx;
    color: #f44336;
    margin-top: 20rpx;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 28rpx;
  }

  &__title {
    font-size: 34rpx;
    font-weight: bold;
    color: #fff;
  }

  &__updated {
    font-size: 22rpx;
    color: $color-text-muted;
  }

  // K-factor
  &__kf-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 32rpx;
    background: rgba(124, 58, 237, 0.08);
    border: 1rpx solid rgba(124, 58, 237, 0.2);
    border-radius: 16rpx;
    margin-bottom: 20rpx;
  }

  &__kf-main {
    display: flex;
    flex-direction: column;
  }

  &__kf-label {
    font-size: 24rpx;
    color: $color-text-muted;
  }

  &__kf-value {
    font-size: 64rpx;
    font-weight: bold;
    line-height: 1.1;
  }

  &__kf-trends {
    display: flex;
    gap: 24rpx;
  }

  &__trend-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__trend-label {
    font-size: 20rpx;
    color: $color-text-muted;
  }

  &__trend-value {
    font-size: 26rpx;
    font-weight: 600;
  }

  &__trend--up { color: #4caf50; }
  &__trend--down { color: #f44336; }
  &__trend--flat { color: $color-text-secondary; }

  // Alert
  &__alert {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding: 16rpx 24rpx;
    border-radius: 12rpx;
    margin-bottom: 28rpx;

    &--red { background: rgba(244, 67, 54, 0.1); border: 1rpx solid rgba(244, 67, 54, 0.2); }
    &--yellow { background: rgba(245, 158, 11, 0.1); border: 1rpx solid rgba(245, 158, 11, 0.2); }
    &--green { background: rgba(76, 175, 80, 0.08); border: 1rpx solid rgba(76, 175, 80, 0.15); }
  }

  &__alert-icon { font-size: 24rpx; }
  &__alert-text { font-size: 24rpx; color: $color-text-primary; }

  // Sections
  &__section {
    margin-bottom: 32rpx;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: bold;
    color: $color-text-primary;
    margin-bottom: 16rpx;
    display: block;

    &--red { color: #f44336; }
  }

  // Funnel
  &__funnel {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__funnel-step {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  &__funnel-name {
    width: 160rpx;
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__funnel-val {
    width: 72rpx;
    font-size: 26rpx;
    font-weight: bold;
    color: $color-text-primary;
    text-align: right;
  }

  &__funnel-bar {
    flex: 1;
    height: 16rpx;
    background: rgba(255,255,255,0.05);
    border-radius: 8rpx;
    overflow: hidden;
  }

  &__funnel-fill {
    height: 100%;
    border-radius: 8rpx;
    min-width: 4rpx;
    transition: width 0.5s ease-out;
  }

  // DAU
  &__dau-row {
    display: flex;
    gap: 16rpx;
  }

  &__dau-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24rpx 16rpx;
    background: rgba(255,255,255,0.03);
    border-radius: 12rpx;
  }

  &__dau-num {
    font-size: 40rpx;
    font-weight: bold;
    color: $color-gold;
  }

  &__dau-label {
    font-size: 22rpx;
    color: $color-text-muted;
    margin-top: 4rpx;
  }

  // A/B table
  &__ab-table {
    background: rgba(255,255,255,0.03);
    border-radius: 12rpx;
    overflow: hidden;
  }

  &__ab-row {
    display: flex;
    padding: 14rpx 20rpx;

    &--head {
      background: rgba(255,255,255,0.04);
      border-bottom: 1rpx solid rgba(255,255,255,0.06);
    }
  }

  &__ab-cell {
    flex: 1;
    font-size: 24rpx;
    color: $color-text-secondary;
    text-align: center;
  }

  // Snapshots
  &__snap-row {
    display: flex;
    gap: 24rpx;
    font-size: 24rpx;
    color: $color-text-muted;
  }

  // Red alerts
  &__red-item {
    display: flex;
    justify-content: space-between;
    padding: 12rpx 20rpx;
    background: rgba(244, 67, 54, 0.06);
    border-radius: 10rpx;
    margin-bottom: 8rpx;
  }

  &__red-name {
    font-size: 24rpx;
    color: #f44336;
  }

  &__red-val {
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  // Denied
  &__denied {
    display: flex;
    min-height: 100vh;
    background: $color-bg-primary;
    align-items: center;
    justify-content: center;
    color: $color-text-muted;
    font-size: 28rpx;
  }
}
</style>
