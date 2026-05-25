import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { callCloudFunction } from '@/utils/api.js';

// 经验值规则 — v0.9 进化值双轨制
const EXP_RULES = {
  test: 10,        // 完成测试
  record: 20,      // 超越历史最高分
  checkin: 5,      // 每日签到
  share: 15,       // 分享被点击
  invite: 50,      // 邀请好友进入
  challenge_win: 30, // 挑战获胜
  knowledge: 5,    // 阅读知识卡 >5s 或点"有帮助"
};

// 每日获取上限（防刷）
const DAILY_LIMITS = {
  test: 1,        // 每天仅首次测试给 XP
  record: 1,      // 每天仅首次破纪录给 XP
  checkin: 1,     // 每天仅签到一次
  share: 3,       // 每天最多 3 次分享 XP
  knowledge: 5,   // 每天最多 5 张知识卡 XP
  invite: 5,      // 每天最多 5 次邀请 XP
  challenge_win: 10, // 每天最多 10 次挑战获胜 XP
};

// 进化等级阈值 — v0.9 50 级体系
const LEVEL_THRESHOLDS = [
  0,    // Lv.1  初探者
  20,   // Lv.2
  40,   // Lv.3
  60,   // Lv.4
  100,  // Lv.5  AI 学徒
  150,  // Lv.6
  200,  // Lv.7
  260,  // Lv.8  实践者
  350,  // Lv.9
  450,  // Lv.10
  550,  // Lv.11
  650,  // Lv.12 AI 探索家
  800,  // Lv.13
  950,  // Lv.14
  1100, // Lv.15
  1300, // Lv.16
  1500, // Lv.17
  1700, // Lv.18 AI 进化者
  2000, // Lv.19
  2300, // Lv.20
  2600, // Lv.21
  2900, // Lv.22
  3200, // Lv.23
  3500, // Lv.24
  3800, // Lv.25 AI 先行者
  4500, // Lv.26-30
  5200, // Lv.31-35 AI 塑造者
  6000, // Lv.36-40
  7000, // Lv.41-45
  8000, // Lv.46-50 AI 造物主
];

const MILESTONE_NAMES = {
  1: '初探者',
  5: 'AI 学徒',
  8: '实践者',
  12: 'AI 探索家',
  18: 'AI 进化者',
  25: 'AI 先行者',
  35: 'AI 塑造者',
  50: 'AI 造物主',
};

// 根据等级返回称号
function getTitle(lv) {
  const milestones = Object.keys(MILESTONE_NAMES).map(Number).sort((a, b) => b - a);
  for (const m of milestones) {
    if (lv >= m) return MILESTONE_NAMES[m];
  }
  return '初探者';
}

export const useExperienceStore = defineStore('experience', () => {
  const exp = ref(Number(uni.getStorageSync('evolution_exp') || 0));

  const level = computed(() => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (exp.value >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
  });

  const levelName = computed(() => getTitle(level.value));

  const currentLevelExp = computed(() => LEVEL_THRESHOLDS[Math.min(level.value - 1, LEVEL_THRESHOLDS.length - 1)] || 0);
  const nextLevelExp = computed(() => {
    const nextIdx = level.value;
    if (nextIdx >= LEVEL_THRESHOLDS.length) {
      return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
    }
    return LEVEL_THRESHOLDS[nextIdx] || 100;
  });

  const levelProgress = computed(() => {
    const range = nextLevelExp.value - currentLevelExp.value;
    if (range <= 0) return 100;
    const pct = Math.floor(((exp.value - currentLevelExp.value) / range) * 100);
    return Math.min(100, Math.max(0, pct));
  });

  // v0.9: 等级解锁内容
  const unlocks = computed(() => ({
    extraDailyTest: level.value >= 5,    // Lv.5 AI学徒: 每日免费测试+1
    canCollect: level.value >= 8,         // Lv.8 实践者: 知识卡收藏
    silverBorder: level.value >= 12,      // Lv.12 AI探索家: 银色段位卡边框
    deepMode: level.value >= 5,           // Lv.5 AI学徒: 深度定段模式(10题)
    goldBorder: level.value >= 25,        // Lv.25 AI先行者: 金色段位卡边框
    customSignature: level.value >= 35,   // Lv.35 AI塑造者: 自定义段位卡签名
    customTitle: level.value >= 50,       // Lv.50 AI造物主: 自定义段位称号
  }));

  let lastGain = 0;
  // 每日获取追踪：{ 'test': '2026-05-25', 'share_0': '2026-05-25', 'share_1': '2026-05-25', ... }
  const dailyGains = ref({});

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function addExp(action) {
    const gain = EXP_RULES[action] || 0;
    if (gain === 0) return;

    // 始终记录本次 gain 值（供结果页动画展示），即使达到每日上限也不跳过
    lastGain = gain;

    const today = getToday();
    const limit = DAILY_LIMITS[action];

    // 检查每日上限
    if (limit !== undefined) {
      let todayCount = 0;
      for (const key of Object.keys(dailyGains.value)) {
        if (key.startsWith(action) && dailyGains.value[key] === today) {
          todayCount++;
        }
      }
      if (todayCount >= limit) return; // 已达上限，静默跳过（但 lastGain 已记录）

      // 记录本次获取
      dailyGains.value[`${action}_${todayCount}`] = today;
    }
    exp.value += gain;
    uni.setStorageSync('evolution_exp', exp.value);
    syncExpToServer(); // 静默同步到服务端

    // 升级提示
    const newLevel = level.value;
    const prevExp = exp.value - gain;
    let prevLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (prevExp >= LEVEL_THRESHOLDS[i]) { prevLevel = i + 1; break; }
    }
    if (newLevel > prevLevel) {
      const newTitle = getTitle(newLevel);
      uni.showToast({
        title: `🎉 晋升 ${newTitle}！`,
        icon: 'none',
        duration: 2000,
      });
    }
  }

  function getExpForAction(action) {
    return EXP_RULES[action] || 0;
  }

  // 上一次获得的经验值（供动画展示）
  function getLastGain() {
    return lastGain;
  }

  // ── 服务端 XP 同步 ──
  let syncTimer = null;

  async function syncExpToServer() {
    // 防抖：3 秒内的多次 addExp 合并为一次同步
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        await callCloudFunction('getWeeklyStats', {
          action: 'syncExp',
          exp: exp.value,
          level: level.value,
        }, { retry: false });
      } catch (e) { /* 静默失败，本地 XP 不丢失 */ }
    }, 3000);
  }

  async function loadExpFromServer() {
    try {
      const res = await callCloudFunction('getWeeklyStats', {
        action: 'syncExp',
        mode: 'get',
      }, { retry: false });
      if (res.code === 0 && res.data) {
        // 取本地和远程的最大值
        const remoteExp = res.data.exp || 0;
        const remoteLevel = res.data.level || 1;
        if (remoteExp > exp.value) {
          exp.value = remoteExp;
          uni.setStorageSync('evolution_exp', remoteExp);
        }
        // level 跟随 exp 自动计算，无需单独存储
      }
    } catch (e) { /* 静默失败 */ }
  }

  // 初始化时从服务端加载 XP
  loadExpFromServer();

  return {
    exp, level, levelName, levelProgress, currentLevelExp, nextLevelExp, unlocks,
    addExp, getExpForAction, getLastGain,
    syncExpToServer, loadExpFromServer,
    EXP_RULES,
  };
});
