<template>
  <view class="calendar">
    <!-- 月份标题 -->
    <view class="calendar__header">
      <text class="calendar__nav" @click="prevMonth">‹</text>
      <text class="calendar__month">{{ year }}年{{ month }}月</text>
      <text class="calendar__nav" :class="{ 'calendar__nav--disabled': !canNext }" @click="nextMonth">›</text>
    </view>

    <!-- 星期标题 -->
    <view class="calendar__weekdays">
      <text v-for="d in weekDays" :key="d" class="calendar__weekday">{{ d }}</text>
    </view>

    <!-- 日期网格 -->
    <view class="calendar__grid">
      <view
        v-for="(cell, i) in cells"
        :key="i"
        class="calendar__cell"
        :class="{
          'calendar__cell--empty': !cell.day,
          'calendar__cell--today': cell.isToday,
          'calendar__cell--checked': cell.checked,
          'calendar__cell--future': cell.isFuture,
        }"
      >
        <text v-if="cell.day" class="calendar__day">{{ cell.day }}</text>
        <view v-if="cell.day && cell.checked" class="calendar__dot" />
        <view v-if="cell.day && cell.isToday && !cell.checked" class="calendar__today-ring" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  checkedDates: { type: Array, default: () => [] }, // ['2026-05-24', ...]
  year: { type: Number, required: true },
  month: { type: Number, required: true },
});

const emit = defineEmits(['prev', 'next']);

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const canNext = computed(() => {
  const now = new Date();
  return props.year < now.getFullYear() || (props.year === now.getFullYear() && props.month < now.getMonth() + 1);
});

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const checkedSet = computed(() => new Set(props.checkedDates));

const cells = computed(() => {
  const firstDay = new Date(props.year, props.month - 1, 1).getDay();
  const daysInMonth = new Date(props.year, props.month, 0).getDate();
  const today = todayStr.value;
  const now = new Date();

  const result = [];
  for (let i = 0; i < firstDay; i++) {
    result.push({ day: 0 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${props.year}-${String(props.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cellDate = new Date(props.year, props.month - 1, d);
    result.push({
      day: d,
      dateStr,
      isToday: dateStr === today,
      checked: checkedSet.value.has(dateStr),
      isFuture: cellDate > now,
    });
  }
  return result;
});

function prevMonth() {
  emit('prev');
}

function nextMonth() {
  if (canNext.value) emit('next');
}
</script>

<style scoped lang="scss">
.calendar {
  padding: 8rpx 0;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16rpx 20rpx;
  }

  &__nav {
    font-size: 40rpx;
    color: $color-accent;
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    &:active { background: rgba(124, 58, 237, 0.1); }

    &--disabled {
      color: $color-text-muted;
      pointer-events: none;
    }
  }

  &__month {
    font-size: 30rpx;
    font-weight: bold;
    color: $color-text-primary;
  }

  &__weekdays {
    display: flex;
    margin-bottom: 8rpx;
  }

  &__weekday {
    flex: 1;
    text-align: center;
    font-size: 22rpx;
    color: $color-text-muted;
    padding: 8rpx 0;
    font-weight: 500;
  }

  &__grid {
    display: flex;
    flex-wrap: wrap;
  }

  &__cell {
    width: calc(100% / 7);
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;

    &--empty {
      pointer-events: none;
    }

    &--today {
      .calendar__day {
        color: $color-accent;
        font-weight: bold;
      }
    }

    &--checked {
      background: rgba(46, 125, 50, 0.1);
      border-radius: 12rpx;

      .calendar__day {
        color: $color-success;
        font-weight: bold;
      }
    }

    &--future {
      opacity: 0.35;
      pointer-events: none;
    }
  }

  &__day {
    font-size: 26rpx;
    color: $color-text-secondary;
    position: relative;
    z-index: 1;
  }

  &__dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: $color-success;
    margin-top: 4rpx;
  }

  &__today-ring {
    position: absolute;
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
    border: 2rpx solid $color-accent;
  }
}
</style>
