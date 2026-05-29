# 进化湾增长方案 v1.0

## 目标

打造现象级爆款小程序，核心公式：

```
K = share_rate × avg_invitees × click_rate × conversion_rate
```

## 增长审计

### share_rate（良好，有优化空间）
- ✅ 动态 L1 CTA（near-miss/稀有人格/默认）
- ✅ AI 读心术首屏可见 + 分享按钮
- ✅ 段位卡 AI 商数体系
- ✅ 分享标题 4 种动态变体
- ❌ 缺少 Battle Result 分享卡（两人对战结果）
- ❌ 挑战完成后无"分享战绩"引导

### avg_invitees（偏弱）
- ✅ 分享到单聊/群聊，图片卡 + 小程序码
- ❌ 无"群内 PK"分享（一图展示群内所有人排名）
- ❌ 无裂变机制

### click_rate（良好）
- ✅ 段位卡 AI 商数替代原始分
- ✅ 朋友圈方形图同步 AI 商数
- ✅ 分享标题含戏剧性

### conversion_rate（最大瓶颈）
- ✅ 首页有 friend banner
- ❌ 新用户看到的是"通用首页"，而非"应战页"
- ❌ 挑战流程断裂：challengeId 在分享链路中丢失
- ❌ 无"接受挑战"专属入口

### retention（中等）
- ✅ 连续签到 streak + 里程碑
- ✅ 断签风险提示
- ⚠️ 订阅消息框架就绪（模板 ID 待配置）
- ❌ 无周排行榜
- ❌ 无"你被超越"通知

---

## Phase 1 — 转化率突破：挑战链路闭环（最高 ROI）

### 1.1 挑战承接页：首页 challenge 模式

当用户通过挑战链接进入时（`challengeId` / `friend_name` 参数），首页进入"应战模式"：

- 挑战信息卡片：挑战者头像、段位、AI商数
- "接受挑战"大按钮，直通答题（跳过广告门控）
- 新用户首次测试零摩擦

**修改文件**：
- `src/pages/index/index.vue` — 新增 challenge mode 视图 + challengeId 解析
- `cloudfunctions/sendChallenge/index.js` — 分享路径带上 challengeId

### 1.2 挑战结果页：Battle Result

挑战双方都完成测试后，结果页展示对决结果：

- 双栏对比：头像、段位、AI商数、胜负
- "分享对决结果"按钮 → 新分享卡类型

**修改文件**：
- `cloudfunctions/submitScore/index.js` — 挑战结算后返回对手信息
- `src/pages/result/result.vue` — 新增 battle result 区块
- `src/utils/canvas-renderer.js` — 新增 `renderBattleCard`

### 1.3 分享路径修复

分享路径带完整挑战上下文：

```
/pages/index/index?from_uid=xxx&friend_name=张三&friend_tier=探索者&challengeId=yyy
```

**修改文件**：
- `src/pages/result/result.vue` — onShareAppMessage 检测挑战上下文
- `src/components/ChallengeModal/ChallengeModal.vue` — 分享路径加上 challengeId

---

## Phase 2 — 裂变加速：群 PK + 邀请解锁闭环

### 2.1 群段位 PK 一图流

多群友测过后生成群内段位分布图

**修改文件**：
- `cloudfunctions/getFriendRank/index.js` — 新增 groupDistribution action
- `src/utils/canvas-renderer.js` — 新增 renderGroupRankCard

### 2.2 邀请解锁闭环增强

邀请进度可视化和即时反馈

**修改文件**：
- `src/pages/index/index.vue` — 邀请进度
- `cloudfunctions/submitScore/index.js` — 受邀者完成测试时通知邀请者

---

## Phase 3 — 留存深化：周竞争 + 被超越通知

### 3.1 周排行榜

"本周 AI 进化榜"：进化最快 / 最高段位 / 最勤奋

**修改文件**：
- `cloudfunctions/getWeeklyStats/index.js` — 新增 weeklyLeaderboard
- `src/pages/index/index.vue` — 周榜入口

### 3.2 被超越推送

好友段位超过自己时通过订阅消息通知

**修改文件**：
- `cloudfunctions/submitScore/index.js` — 检查超越关系
- 新增云函数 pushNotifications

---

## Phase 4 — 体验打磨：IMPROVEMENT_PLAN 剩余项

| 项目 | 工作量 |
|------|--------|
| P1-2(2) 进化回顾默认折叠 | 10min |
| P1-2(3) 雷达图 280→240 | 5min |
| P2-3 动画性能优化 | 30min |

---

## 优先级总览

| Phase | 核心指标 | 预计提升 | 工作量 | 优先级 |
|-------|---------|---------|--------|--------|
| 1 | conversion_rate | +40-60% | 3-4h | 🔴 最高 |
| 2 | avg_invitees | +25-40% | 2-3h | 🟠 高 |
| 3 | retention + share_rate | +15-25% | 3-4h | 🟡 中 |
| 4 | 体验一致性 | +5% | 1h | 🟢 低 |
