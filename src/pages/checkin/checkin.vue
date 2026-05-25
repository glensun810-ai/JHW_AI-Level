<template>
  <view class="page-checkin">
    <!-- 连续签到天数 -->
    <view class="page-checkin__hero">
      <view class="page-checkin__streak-ring">
        <text class="page-checkin__streak-num">{{ consecutiveDays }}</text>
        <text class="page-checkin__streak-unit">天</text>
      </view>
      <text class="page-checkin__streak-label">已连续签到</text>
    </view>

    <!-- 签到按钮 -->
    <view class="page-checkin__action">
      <button
        class="page-checkin__btn"
        :class="{ 'page-checkin__btn--done animate-pop': justChecked }"
        :disabled="checkedToday && !justChecked"
        @click="handleCheckIn"
      >
        <template v-if="checkedToday">✅ 今日已签到</template>
        <template v-else>📅 签到打卡</template>
      </button>
    </view>

    <!-- 奖励提示 -->
    <view v-if="showReward" class="page-checkin__reward-pop">
      <text class="page-checkin__reward-pop-icon">{{ rewardIcon }}</text>
      <text class="page-checkin__reward-pop-text">{{ rewardText }}</text>
    </view>

    <!-- 日历 -->
    <view class="page-checkin__calendar-wrap">
      <CheckInCalendar
        :year="calYear"
        :month="calMonth"
        :checked-dates="checkedDates"
        @prev="calMonth--; if(calMonth<1){calMonth=12;calYear--}"
        @next="calMonth++; if(calMonth>12){calMonth=1;calYear++}"
      />
    </view>

    <!-- 奖励列表 -->
    <view class="page-checkin__rewards">
      <text class="page-checkin__section-title">🎁 签到奖励</text>
      <view class="page-checkin__reward-list">
        <view
          v-for="r in rewards"
          :key="r.day"
          class="page-checkin__reward-item"
          :class="{
            'page-checkin__reward-item--done': r.day <= consecutiveDays,
            'page-checkin__reward-item--unlocked': r.day === consecutiveDays && justChecked,
          }"
        >
          <view class="page-checkin__reward-left">
            <text class="page-checkin__reward-day">第{{ r.day }}天</text>
            <text class="page-checkin__reward-desc">{{ r.desc }}</text>
          </view>
          <text v-if="r.day <= consecutiveDays" class="page-checkin__reward-badge">
            {{ r.day === consecutiveDays && justChecked ? '🎉' : '✅' }}
          </text>
          <text v-else class="page-checkin__reward-lock">🔒</text>
        </view>
      </view>
    </view>

    <!-- 本周晋升最快 -->
    <view v-if="weeklyRising.length > 0" class="page-checkin__rising">
      <text class="page-checkin__section-title">🚀 本周晋升最快</text>
      <view v-for="(user, i) in weeklyRising" :key="i" class="page-checkin__rising-item">
        <text class="page-checkin__rising-rank">{{ i + 1 }}</text>
        <text class="page-checkin__rising-name">{{ user.nickname }}</text>
        <text class="page-checkin__rising-change">{{ user.prevTier }} → {{ user.currentTier }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="page-checkin__empty">
      <text>本周暂无晋升记录，加油打卡提升段位！</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import CheckInCalendar from '@/components/CheckInCalendar/CheckInCalendar.vue';
import { doCheckIn as checkIn, fetchWeeklyStats } from '@/utils/api.js';
import { trackCheckIn, trackPageView } from '@/utils/analytics.js';
import { useExperienceStore } from '@/store/experience.js';

const consecutiveDays = ref(0);
const checkedToday = ref(false);
const weeklyRising = ref([]);
const checkedDates = ref([]);
const justChecked = ref(false);
const showReward = ref(false);
const rewardIcon = ref('');
const rewardText = ref('');

const now = new Date();
const calYear = ref(now.getFullYear());
const calMonth = ref(now.getMonth() + 1);

const rewards = [
  { day: 1, desc: '「坚持打卡」徽章' },
  { day: 3, desc: '额外 1 次免费测试次数' },
  { day: 5, desc: '解锁 1 道签到专属趣味题' },
  { day: 7, desc: '解锁称号「AI践行者」+ 额外 2 次测试' },
  { day: 14, desc: '解锁称号「AI探索家」' },
  { day: 30, desc: '解锁称号「AI进化者」+ 专属段位卡边框' },
];

const REWARD_SPECIAL = {
  1:  { icon: '🏅', text: '获得「坚持打卡」徽章！' },
  3:  { icon: '🎫', text: '获得额外 1 次免费测试！' },
  5:  { icon: '🎮', text: '解锁 1 道签到专属趣味题！' },
  7:  { icon: '👑', text: '解锁称号「AI践行者」！+ 额外 2 次测试' },
  14: { icon: '🔭', text: '解锁称号「AI探索家」！' },
  30: { icon: '🌟', text: '解锁称号「AI进化者」！+ 专属段位卡边框' },
};

onMounted(async () => {
  trackPageView('checkin');
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = uni.getStorageSync('checkin_date');
  checkedToday.value = storedDate === today;

  // 从服务端同步签到数据
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      checkedToday.value = res.data.checkedToday || checkedToday.value;
      consecutiveDays.value = res.data.consecutiveDays || uni.getStorageSync('checkin_streak') || 0;
      checkedDates.value = res.data.checkedDates || loadLocalCheckedDates();
      weeklyRising.value = res.data.weeklyRising || [];
    }
  } catch {
    consecutiveDays.value = uni.getStorageSync('checkin_streak') || 0;
    checkedDates.value = loadLocalCheckedDates();
  }

  uni.setStorageSync('checkin_streak', consecutiveDays.value);
});

function loadLocalCheckedDates() {
  const dates = [];
  const today = new Date();
  const streak = consecutiveDays.value;
  for (let i = 0; i < streak; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (i === 0 && !checkedToday.value) continue;
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function handleCheckIn() {
  if (checkedToday.value) return;

  const today = new Date().toISOString().slice(0, 10);
  const storedDate = uni.getStorageSync('checkin_date');

  // 检查连续
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = consecutiveDays.value;

  let newStreak;
  if (storedDate === yesterday) {
    newStreak = streak + 1;
  } else {
    newStreak = 1;
  }

  // 保存快照，用于服务端失败时回滚
  const snapshot = {
    checkedToday: checkedToday.value,
    checkedDates: [...checkedDates.value],
    consecutiveDays: consecutiveDays.value,
  };

  // 乐观更新
  consecutiveDays.value = newStreak;
  checkedToday.value = true;
  justChecked.value = true;
  checkedDates.value = [...checkedDates.value, today];
  uni.setStorageSync('checkin_date', today);
  uni.setStorageSync('checkin_streak', newStreak);

  // 奖励动画
  const special = REWARD_SPECIAL[newStreak];
  if (special) {
    rewardIcon.value = special.icon;
    rewardText.value = special.text;
    showReward.value = true;
    setTimeout(() => { showReward.value = false; }, 2500);
  } else {
    uni.showToast({ title: `签到成功！已连续 ${newStreak} 天`, icon: 'success' });
  }

  // 同步到服务端 + F14 经验值
  // v0.9: 签到奖励（额外测试次数）改由服务端 getWeeklyStats 发放 bonusTestsRemaining
  // 客户端不再直接修改本地 test_count，由 submitScore 服务端统一校验
  trackCheckIn(newStreak);
  const res = await checkIn();
  // 云函数确认成功后再加经验值
  if (res.code === 0) {
    useExperienceStore().addExp('checkin');
  } else {
    // 服务端失败 → 回滚到快照状态
    checkedToday.value = snapshot.checkedToday;
    checkedDates.value = snapshot.checkedDates;
    consecutiveDays.value = snapshot.consecutiveDays;
    justChecked.value = false;
    showReward.value = false;
    uni.setStorageSync('checkin_date', storedDate || '');
    uni.setStorageSync('checkin_streak', snapshot.consecutiveDays);
    uni.showToast({ title: '签到失败，请重试', icon: 'none' });
  }

  setTimeout(() => { justChecked.value = false; }, 1500);
}

onShareAppMessage(() => ({
  title: '连续签到打卡！测测你的AI段位变化了吗？🧬',
  path: '/pages/index/index',
}));

onShareTimeline(() => ({
  title: '每日打卡追踪AI段位变化，看看你的进化之路 🚀',
  query: '',
}));
</script>

<style scoped lang="scss">
.page-checkin {
  min-height: 100vh;
  background: $color-bg-primary;
  padding: 32rpx;

  // ====== 连续天数 ======
  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28rpx 0 16rpx;
  }

  &__streak-ring {
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    background: rgba(124, 58, 237, 0.1);
    border: 3rpx solid rgba(124, 58, 237, 0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__streak-num {
    font-size: 56rpx;
    font-weight: bold;
    color: $color-gold;
    line-height: 1;
  }

  &__streak-unit {
    font-size: 22rpx;
    color: $color-text-secondary;
  }

  &__streak-label {
    margin-top: 16rpx;
    font-size: 28rpx;
    color: $color-text-secondary;
  }

  // ====== 签到按钮 ======
  &__action {
    display: flex;
    justify-content: center;
    padding: 20rpx 0 32rpx;
  }

  &__btn {
    width: 360rpx;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border-radius: 44rpx;
    font-size: 30rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    text-align: center;

    &--done {
      background: rgba(255, 255, 255, 0.06);
      color: $color-text-secondary;
      font-weight: normal;
    }
  }

  // ====== 奖励弹出 ======
  &__reward-pop {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    padding: 20rpx 32rpx;
    margin-bottom: 24rpx;
    background: rgba(245, 158, 11, 0.1);
    border: 1rpx solid rgba(245, 158, 11, 0.25);
    border-radius: 16rpx;
    animation: reward-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);

    &-icon {
      font-size: 40rpx;
    }

    &-text {
      font-size: 26rpx;
      color: $color-gold;
      font-weight: 500;
    }
  }

  // ====== 日历 ======
  &__calendar-wrap {
    padding: 16rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 20rpx;
    margin-bottom: 40rpx;
  }

  // ====== 奖励列表 ======
  &__section-title {
    font-size: 28rpx;
    font-weight: bold;
    color: $color-text-primary;
    margin-bottom: 16rpx;
    display: block;
  }

  &__reward-list {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
  }

  &__reward-item {
    display: flex;
    align-items: center;
    padding: 14rpx 20rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;
    transition: all 0.3s;

    &--done {
      background: rgba(46, 125, 50, 0.06);
    }

    &--unlocked {
      background: rgba(245, 158, 11, 0.08);
      border: 1rpx solid rgba(245, 158, 11, 0.2);
      animation: highlight-pulse 0.6s ease-out;
    }
  }

  &__reward-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  &__reward-day {
    font-size: 24rpx;
    color: $color-accent;
    font-weight: bold;
    width: 72rpx;
  }

  &__reward-desc {
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__reward-badge,
  &__reward-lock {
    font-size: 26rpx;
    flex-shrink: 0;
  }

  // ====== 本周晋升 ======
  &__rising {
    margin-top: 40rpx;
  }

  &__rising-item {
    display: flex;
    align-items: center;
    padding: 14rpx 20rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;
    margin-bottom: 8rpx;
  }

  &__rising-rank {
    width: 40rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: $color-gold;
  }

  &__rising-name {
    flex: 1;
    font-size: 26rpx;
    color: $color-text-primary;
  }

  &__rising-change {
    font-size: 22rpx;
    color: #4caf50;
  }

  &__empty {
    display: flex;
    justify-content: center;
    padding-top: 60rpx;
    color: $color-text-muted;
    font-size: 26rpx;
  }
}

.animate-pop {
  animation: btn-pop 0.3s ease-out;
}

@keyframes btn-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

@keyframes reward-pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes highlight-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); background: rgba(245, 158, 11, 0.12); }
  100% { transform: scale(1); }
}
</style>
