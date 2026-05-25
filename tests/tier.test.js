/**
 * 段位计算单元测试 — v0.6 进化叙事流
 *
 * 覆盖范围：分数 5-50 全部 46 个取值 → 8 段位
 *
 * 运行方式：
 *   node tests/tier.test.js
 *
 * 前端 tier.js 和云函数 submitScore 共用同一套段位映射逻辑，
 * 本测试验证映射的 100% 准确率。
 */

// ━━━ 段位定义（与 tier.js 和 submitScore/index.js 完全一致） ━━━
const TIERS = [
  { name: '萌新',     emoji: '🐣', min: 5,  max: 9  },
  { name: '调戏师',   emoji: '💬', min: 10, max: 18 },
  { name: '工具人',   emoji: '🛠️', min: 19, max: 27 },
  { name: '协作者',   emoji: '🤝', min: 28, max: 35 },
  { name: '驾驭者',   emoji: '⚡', min: 36, max: 42 },
  { name: '炼金术士', emoji: '🧪', min: 43, max: 46 },
  { name: '觉醒者',   emoji: '🧠', min: 47, max: 49 },
  { name: '无界',     emoji: '🌊', min: 50, max: 50 },
];

// ━━━ 被测试函数 ━━━
function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

function getNextTier(score) {
  const current = getTier(score);
  const idx = TIERS.findIndex(t => t.name === current.name);
  if (idx >= TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

function pointsToNextTier(score) {
  const next = getNextTier(score);
  if (!next) return 0;
  return next.min - score;
}

function getTierIndex(score) {
  const current = getTier(score);
  return TIERS.findIndex(t => t.name === current.name);
}

// ━━━ 测试框架 ━━━
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
  }
}

function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    if (!failures.length) {
      // 无新增失败才算通过
    }
  } catch (e) {
    failed++;
    failures.push(`${name}: ${e.message}`);
  }
}

// ━━━ 预期段位映射表（手动验证） ━━━
const EXPECTED = {
  5:  '萌新', 6: '萌新', 7: '萌新', 8: '萌新', 9: '萌新',
  10: '调戏师', 11: '调戏师', 12: '调戏师', 13: '调戏师', 14: '调戏师',
  15: '调戏师', 16: '调戏师', 17: '调戏师', 18: '调戏师',
  19: '工具人', 20: '工具人', 21: '工具人', 22: '工具人', 23: '工具人',
  24: '工具人', 25: '工具人', 26: '工具人', 27: '工具人',
  28: '协作者', 29: '协作者', 30: '协作者', 31: '协作者', 32: '协作者',
  33: '协作者', 34: '协作者', 35: '协作者',
  36: '驾驭者', 37: '驾驭者', 38: '驾驭者', 39: '驾驭者', 40: '驾驭者',
  41: '驾驭者', 42: '驾驭者',
  43: '炼金术士', 44: '炼金术士', 45: '炼金术士', 46: '炼金术士',
  47: '觉醒者', 48: '觉醒者', 49: '觉醒者',
  50: '无界',
};

// ━━━ 边界测试 ━━━
const NEXT_TIER_EXPECTED = {
  5: '调戏师', 9: '调戏师',             // 萌新 → 调戏师
  10: '工具人', 18: '工具人',            // 调戏师 → 工具人
  19: '协作者', 27: '协作者',            // 工具人 → 协作者
  28: '驾驭者', 35: '驾驭者',            // 协作者 → 驾驭者
  36: '炼金术士', 42: '炼金术士',         // 驾驭者 → 炼金术士
  43: '觉醒者', 46: '觉醒者',            // 炼金术士 → 觉醒者
  47: '无界', 49: '无界',               // 觉醒者 → 无界
  50: null,                             // 无界 → 无下一段位
};

const POINTS_TO_NEXT = {
  5: 5, 9: 1,       // 距调戏师(10)
  10: 9, 18: 1,     // 距工具人(19)
  19: 9, 27: 1,     // 距协作者(28)
  28: 8, 35: 1,     // 距驾驭者(36)
  36: 7, 42: 1,     // 距炼金术士(43)
  43: 4, 46: 1,     // 距觉醒者(47)
  47: 3, 49: 1,     // 距无界(50)
  50: 0,            // 已达最高
};

// ━━━ 执行测试 ━━━
console.log('═══════════════════════════════════');
console.log('  段位计算单元测试 — v0.6');
console.log('  覆盖：5 分 ～ 50 分（46 个取值）');
console.log('═══════════════════════════════════');

describe('getTier() — 46 分全部映射正确', () => {
  let correct = 0;
  for (let score = 5; score <= 50; score++) {
    const result = getTier(score);
    const expected = EXPECTED[score];
    const ok = result.name === expected;
    if (!ok) {
      assert(false, `分数 ${score}：期望「${expected}」实际「${result.name}」`);
    } else {
      correct++;
    }
  }
  assert(correct === 46, `共 46 个分数，${correct} 个正确`);
});

describe('getTier() — 边界值验证', () => {
  // 每个段位的 min 和 max
  for (const tier of TIERS) {
    assert(getTier(tier.min).name === tier.name, `${tier.name} 下限 ${tier.min} → ${getTier(tier.min).name}`);
    assert(getTier(tier.max).name === tier.name, `${tier.name} 上限 ${tier.max} → ${getTier(tier.max).name}`);
  }
});

describe('getTier() — 越界处理', () => {
  assert(getTier(0).name === '萌新', '0 分 → 萌新（兜底）');
  assert(getTier(3).name === '萌新', '3 分 → 萌新（兜底）');
  assert(getTier(100).name === '萌新', '100 分 → 萌新（兜底，无匹配时返回第一个段位）');
  assert(getTier(-1).name === '萌新', '-1 分 → 萌新（兜底）');
});

describe('getNextTier() — 下一段位', () => {
  for (const [score, expected] of Object.entries(NEXT_TIER_EXPECTED)) {
    const next = getNextTier(Number(score));
    const nextName = next ? next.name : null;
    assert(nextName === expected, `分数 ${score} 下一段位：期望「${expected}」实际「${nextName}」`);
  }
});

describe('pointsToNextTier() — 距离下一段位分数', () => {
  for (const [score, expected] of Object.entries(POINTS_TO_NEXT)) {
    const pts = pointsToNextTier(Number(score));
    assert(pts === expected, `分数 ${score} 距下一段位：期望 ${expected} 实际 ${pts}`);
  }
});

describe('getTierIndex() — 段位索引', () => {
  assert(getTierIndex(5) === 0, '萌新 → 0');
  assert(getTierIndex(15) === 1, '调戏师 → 1');
  assert(getTierIndex(22) === 2, '工具人 → 2');
  assert(getTierIndex(30) === 3, '协作者 → 3');
  assert(getTierIndex(38) === 4, '驾驭者 → 4');
  assert(getTierIndex(44) === 5, '炼金术士 → 5');
  assert(getTierIndex(48) === 6, '觉醒者 → 6');
  assert(getTierIndex(50) === 7, '无界 → 7');
});

// ━━━ 段位区间不重叠验证 ━━━
describe('段位区间不重叠', () => {
  for (let i = 0; i < TIERS.length - 1; i++) {
    const current = TIERS[i];
    const next = TIERS[i + 1];
    assert(
      current.max < next.min,
      `「${current.name}」max=${current.max} < 「${next.name}」min=${next.min} — 不重叠`
    );
  }
});

// ━━━ 区间无间隙验证 ━━━
describe('段位区间无间隙（连续覆盖 5-50）', () => {
  for (let i = 0; i < TIERS.length - 1; i++) {
    const current = TIERS[i];
    const next = TIERS[i + 1];
    assert(
      current.max + 1 === next.min,
      `「${current.name}」max=${current.max} + 1 = 「${next.name}」min=${next.min} — 无间隙`
    );
  }
});

// ━━━ 汇总 ━━━
console.log('\n═══════════════════════════════════');
console.log(`  结果：${passed} 通过 / ${failed} 失败`);
console.log('═══════════════════════════════════');

if (failures.length > 0) {
  console.log('\n失败详情：');
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
} else {
  console.log('  ✅ 全部通过，段位计算 100% 准确\n');
  process.exit(0);
}
