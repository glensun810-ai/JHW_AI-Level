# 结果页优化方案 v1.2

## 设计目标

打造现象级爆款小程序的结果页，核心驱动公式：

```
K = share_rate × avg_invitees × click_rate × conversion_rate
```

结果页的每个元素必须服务于以下三个目标之一：
- **峰值体验 (Peak)** — 让用户感到"这个结果懂我"
- **分享驱动 (Share)** — 让用户产生"必须让人看到"的冲动
- **回访锚点 (Return)** — 让用户想"明天再来测一次"

---

## 一、信息架构重构：三层设计

当前页面 4-5 屏线性排列，最强社交货币（AI 读心术）沉底。重构后，内容按"传播价值"重新分层：

### 第一屏：身份锚点 + 社交货币（首屏可见，不滚动）

```
┌─────────────────────────────────┐
│         进化湾 (brand)          │
│                                 │
│      [TierBadge 徽章动画]       │
│                                 │
│        138  AI商数              │
│      AI 先知 · 前 5%           │  ← AI商数区间标签
│                                 │
│   🐣 萌新    ⚖️ 均衡的进化者   │  ← 段位 + 人格一行
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔮 AI 读心术              │  │  ← ★ 从底部提升至此
│  │ "你在这道题上的选择..."    │  │
│  │ 识别到隐藏特质：独立思辨者 │  │
│  │ ✨ 只有少数人能触发这条   │  │
│  └───────────────────────────┘  │
│                                 │
│  [分享我的进化人格] (L1 CTA)   │
│  长按徽章保存段位卡 · 分享到群 │
│                                 │
│  ┌─ near-miss 进度条 ─────────┐ │  ← ≤3分时视觉强化
│  │ 只差 2 分晋升「探索者」    │ │
│  │ [████████░░] 🐣→💬        │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**关键变更：**
- **AI 读心术提升至首屏**（原在第四屏底部）— 这是最强社交货币，必须第一眼可见
- AI 商数增加区间标签（130+ AI先知 / 105-129 AI中产 / 90-104 AI学徒 / <90 AI新人）
- L1 CTA 文案与 hint 对齐，统一引导"分享"

### 第二屏：社交证明 + 进化资产（滚动一次可见）

```
┌─────────────────────────────────┐
│  ── 进化资产 ──                │
│  ⭐ 已点亮 12 颗知识星          │
│  [★ ★ ★ ★ ★ ☆ ☆ ☆ ...] (30颗)│  ← 稀有度 CSS 修复
│                                 │
│  🆕 新卡掉落                   │
│  [稀有] 📚 提示工程入门        │
│  [传说] 🧬 AI思维链揭秘        │
│                                 │
│  ── 你的 AI 进化人格 ──        │
│  超能力：信息感知               │
│  进化方向：思维深度             │
│  前 15% 的稀有类型              │
│                                 │
│  ── 好友排行 ──                │
│  🏆 已有 12,860 人完成测试     │  ← 全局社交证明（好友空时兜底）
│  #1 张三  探索者               │
│  #2 李四  萌新                 │
│  #3 我    萌新                 │
│                                 │
│  [挑战好友]  [保存段位卡]      │
│  [保存朋友圈图]               │
└─────────────────────────────────┘
```

### 第三屏：深度分析（可折叠，滚动到底可见）

```
┌─────────────────────────────────┐
│  ── AI 锐评 ──                 │
│  "你的AI认知风格..."            │
│                                 │
│  ── 能力雷达 ──                │
│  [RadarChart]                   │
│                                 │
│  ▸ 查看我的答题解析 (可折叠)   │
│                                 │
│  ── 偷看更高段位的世界 ──      │
│  ▸ 探索者们正在...              │
│                                 │
│  ── 进化湾悄悄话 ──            │
│  "日拱一卒，功不唐捐..."        │
│                                 │
│  段位准不准？ [准] [不准]      │
│                                 │
│  [再测一次，继续进化]          │
└─────────────────────────────────┘
```

### 粘性底栏（常驻）

```
┌─────────────────────────────────┐
│  [再测一次]  [分享段位]  [首页]│
└─────────────────────────────────┘
```

---

## 二、分优先级改进方案

### P0 — 核心体验缺陷（阻塞传播）

#### P0-1: AI 读心术提升至首屏

**现状：** 位于 `v-if="stageNum >= 4"` 区域内，在页面物理底部，大多数用户看不到。

**方案：**
- 将 `mindReadingInsight` 渲染从 stage 4 区域移动到 stage 1 首屏区域
- 放在 AI 商数和 L1 CTA 之间，作为"身份证明"与社会证明之间的桥梁
- 保留其在 stage 4 的详细版本（如果有），首屏展示精简卡片
- 新增 `mindReadingInsight` 分享卡类型（在后续版本中，让用户直接分享读心术结果）

**涉及文件：** `src/pages/result/result.vue` — 模板结构调整

**设计原则：** Zeigarnik 效应 — "AI 看穿了你什么" 制造好奇心缺口，驱动朋友点击

---

#### P0-2: 知识星稀有度 CSS 实现

**现状：** 模板已输出 `page-result__star--rarity-common/rare/legend/limited` 类名，但 CSS 中无对应样式，所有未收集星星视觉一致。

**方案：**
```scss
// 未收集星星按稀有度分级
&--mystery {
  // 基础：极淡，保持神秘感
  color: rgba(255, 255, 255, 0.10);
}

&--rarity-common {
  // 普通：浅灰白，极慢闪烁
  color: rgba(255, 255, 255, 0.12);
  animation: star-shimmer-slow 3s ease-in-out infinite;
}

&--rarity-rare {
  // 稀有：淡蓝光晕
  color: rgba(0, 200, 255, 0.20);
  animation: star-shimmer-rare 1.8s ease-in-out infinite;
}

&--rarity-legend {
  // 传说：淡紫光晕
  color: rgba(160, 120, 255, 0.22);
  animation: star-shimmer-legend 1.5s ease-in-out infinite;
}

&--rarity-limited {
  // 限时：淡金光晕
  color: rgba(245, 158, 11, 0.25);
  animation: star-shimmer-limited 1.2s ease-in-out infinite;
}
```

现有的 `@keyframes star-shimmer-*` 动画已定义，只需添加 CSS 规则即可激活。

**涉及文件：** `src/pages/result/result.vue` — CSS 部分

**设计原则：** 地板抬升 — 未收集的星星也有吸引力，让用户想要"点亮那些金色的"

---

### P1 — 体验一致性 + 布局问题

#### P1-1: 朋友圈方形图使用 AI 商数

**现状：** `renderSquareShare` 显示 `totalScore + ' 分'`（原始 5-50），与段位卡的 AI 商数体系冲突。用户可能从朋友圈看到"25 分"但自己测出来是"130 AI商数"。

**方案：**
- 在 `renderSquareShare` 中增加 AI 商数计算：`Math.round((totalScore / 50) * 80 + 70)`
- 替换分数行：`totalScore + ' 分'` → `aiQuotient + ' AI商数'`
- 同时显示原始 5-50 分作为辅助参考（小字）：`原始分：25/50`
- 保持与 `renderTierCard` 一致的 AI 商数样式

**涉及文件：** `src/utils/canvas-renderer.js` — `renderSquareShare` 函数

---

#### P1-2: 页面信息架构精简

**现状：** 4-5 屏线性内容，用户到不了底部。AI 读心术、悄悄话等高价值内容不可见。

**方案：**
1. **AI 读心术上移**（P0-1 已覆盖）
2. **进化回顾折叠**：`reviewData` 默认折叠，仅显示当前段位 + 变化箭头
3. **雷达图保留但缩小**：从 280×280 缩小到 240×240，减少垂直空间
4. **成长路径精简**：GrowthPath 组件改为横向滑动或单行 pill 列表
5. **合并"偷看高段位"与"进化建议"**：当前在 stage 2b 和 stage 4 各有一份，内容高度重叠，合并为一处
6. **"再测一次"仅保留底部和粘性栏**，移除中间重复

**涉及文件：** `src/pages/result/result.vue` — 模板和阶段调度

---

#### P1-3: stageNum 类型标准化

**现状：** `stageNum` 在代码中同时以 number（`1`）和 string（`'2c'`）赋值，模板中混用 `>= 3` 和 `stageAtLeast('2a')`。

**方案：**
- 废弃字母后缀，改用纯数字阶段：`1 → 2 → 3 → 4 → 5 → 6`
- 当前映射：`1=身份, 2=资产+行动, 3=AI锐评, 4=深度分析, 5=预言书, 6=反馈`
- 统一所有模板比较为 `stageNum >= N`
- 移除 `stageAtLeast()` 函数，简化为直接数字比较
- `scheduleStages()` 中所有 `setTimeout` 使用纯数字

**涉及文件：** `src/pages/result/result.vue` — script 和 template

---

### P2 — 增长引擎优化

#### P2-1: AI 商数区间释义

**现状：** 用户看到"138 AI商数"但不知道是好是坏，只有"均值约105"一个锚点。

**方案：**
```javascript
function getAIQLevel(score) {
  if (score >= 140) return { label: 'AI 先知', icon: '🔮', color: '#ffd700' };
  if (score >= 125) return { label: 'AI 先锋', icon: '🚀', color: '#a78bfa' };
  if (score >= 110) return { label: 'AI 中产', icon: '⚡', color: '#00c8ff' };
  if (score >= 95)  return { label: 'AI 学徒', icon: '📖', color: '#66bb6a' };
  return { label: 'AI 新人', icon: '🌱', color: '#90a4ae' };
}
```
- 区间标签显示在 AI 商数数字下方，与"前 X%"同一行
- 段位卡 canvas 也同步增加区间标签

**涉及文件：**
- `src/pages/result/result.vue` — computed + template
- `src/utils/canvas-renderer.js` — `renderTierCard`

---

#### P2-2: 全局社交证明兜底

**现状：** 好友排行无数据时显示"暂无好友数据"，给用户"这个产品没人用"的印象。

**方案：**
- 新增云函数统计累计测试用户数（或从 `getTierDistribution` 获取）
- 页面 onMounted 时异步加载 `globalTestCount`
- 好友为空时显示："🏆 已有 {N} 人完成 AI 段位测试 · 分享给好友看看他们排第几"
- 此数据同时用于分享标题（如"已有 12,860 人测过，你是前 5%"）

**涉及文件：**
- `src/pages/result/result.vue` — 模板 + script
- `cloudfunctions/getWeeklyStats/index.js` — 新增 `getGlobalStats` action

---

#### P2-3: 动画性能优化

**现状：** 10+ 种 CSS 动画同时运行，低端 Android 设备可能掉帧。

**方案：**
1. **合并关键帧**：`star-shimmer-slow/rare/legend/limited` 四个动画仅 duration 不同，改用 CSS 变量控制
2. **条件动画**：已收集星星的 `star-glow` 仅在首屏可见时播放，滚动出视口后暂停（`animation-play-state` 或 IntersectionObserver）
3. **减少粒子数**：Canvas 星场从 70 个星点减少到 40 个（在 750×1000 画布上视觉差异不可感知）
4. **will-change 最小化**：仅对 `transform` 和 `opacity` 使用
5. **低端设备降级**：通过 `wx.getSystemInfo().benchmarkLevel` 判断，≤20 分设备减少动画

**涉及文件：**
- `src/pages/result/result.vue` — CSS 动画合并
- `src/utils/canvas-renderer.js` — 星场粒子数

---

### P3 — 体验打磨

#### P3-1: L1 CTA 文案对齐

**现状：** 按钮文案动态变化，但 hint 文字固定为"将生成专属AI人格卡，分享到群比比谁段位高"。

**方案：**
- hint 文案也随 `l1CtaText` 联动变化：
  - 差 1 分时：`分享你的"只差1分"，让好友感受这种刺激`
  - 稀有人格时：`前{rarity}%的稀有类型，炫耀一下`
  - 默认：`生成专属AI人格卡，分享到群比比谁段位高`

**涉及文件：** `src/pages/result/result.vue` — computed + template

---

#### P3-2: 粘性底栏增加首页入口

**现状：** 底栏只有"再测一次"+"分享"，用户看完没有其他去处。

**方案：**
- 底栏增加第三个按钮：首页图标（🏠），`@click="uni.redirectTo({ url: '/pages/index/index' })"`
- 宽度分配：再测 2 : 分享 2 : 首页 1（首页按钮较小，仅图标）

**涉及文件：** `src/pages/result/result.vue` — 模板 + CSS

---

#### P3-3: 头像授权与订阅消息错开显示

**现状：** stage 2c 同时出现 profile-prompt 和 subscribe-prompt，两个"要权限"的提示叠加，体验侵入。

**方案：**
- `showProfilePrompt` 在 stage 1 时即显示（1.5s），因为头像直接影响段位卡品质
- `showSubscribePrompt` 延迟到 stage 4（6s），在用户看完大部分内容、对产品有好感后再请求
- 两者之间至少间隔 3 秒

**涉及文件：** `src/pages/result/result.vue` — `scheduleStages()` 调整

---

## 三、实施计划

### Phase 1：核心修复（2-3h，最高 ROI）

| 任务 | 文件 | 预计时间 |
|------|------|---------|
| AI 读心术移至首屏 | result.vue | 45min |
| 知识星稀有度 CSS | result.vue | 20min |
| stageNum 类型标准化 | result.vue | 30min |
| AI 商数区间释义 | result.vue + canvas-renderer.js | 30min |
| 构建验证 | — | 15min |

**Phase 1 完成即可发布 v1.2-beta，验证首屏分享转化提升。**

### Phase 2：布局重构（3-4h）

| 任务 | 文件 | 预计时间 |
|------|------|---------|
| 页面信息架构精简（合并/折叠冗余内容） | result.vue | 60min |
| 朋友圈方形图 AI 商数化 | canvas-renderer.js | 30min |
| 全局社交证明兜底 | result.vue + getWeeklyStats | 45min |
| 粘性底栏 + 首页入口 | result.vue | 30min |
| 构建验证 + 微信开发者工具测试 | — | 30min |

### Phase 3：体验打磨（1-2h）

| 任务 | 文件 | 预计时间 |
|------|------|---------|
| L1 CTA/hint 文案联动 | result.vue | 20min |
| 头像/订阅提示错开 | result.vue | 15min |
| 动画性能优化 | result.vue + canvas-renderer.js | 45min |
| 最终构建验证 | — | 15min |

---

## 四、预期效果

| 指标 | 当前 | 目标 | 驱动因素 |
|------|------|------|---------|
| 分享率 (share_rate) | — | +30% | AI 读心术首屏可见 + AI 商数区间标签 |
| 分享卡点击率 (click_rate) | — | +20% | AI 商数替代原始分 + 方形图与段位卡一致 |
| 首屏停留 | — | +15s | 读心术创造好奇心停留 |
| 次日回访 | — | +10% | 知识星稀有度驱动收集欲 + 段位变化通知 |

---

## 五、不变更项

以下模块保持现状，不在本次优化范围内：

- TierBadge 组件 — 动画和交互已成熟
- ReversalReveal 组件 — 反转动效已验证有效
- RadarChart 组件 — 功能完整
- ChallengeModal — 独立功能模块
- TierCard 组件 — 数据传递逻辑不变
- 云函数核心逻辑 — 仅新增 getGlobalStats action

---

## 六、风险与回滚

- **最大风险**：AI 读心术上移可能改变首屏高度，需在 iPhone SE、iPhone 14 Pro Max、小米 12 三档机型实测
- **回滚方案**：每个 Phase 独立提交，出问题可单独 revert
- **灰度策略**：Phase 1 改动可通过 A/B 变量（`getABVariant`）控制新旧布局，先 10% 流量验证
