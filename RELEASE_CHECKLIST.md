# 进化湾小程序 · 发布前操作清单

本文档列出必须由你手动完成的操作（微信公众平台、云开发控制台等），按优先级排列。

---

## 1. 申请订阅消息模板（阻塞 🔴）

当前所有模板 ID 为空字符串，用户无法收到消息推送。

### 操作步骤

1. 登录 [微信公众平台](https://mp.weixin.qq.com) → 功能 → 订阅消息
2. 申请以下 5 个模板，记录各自的**模板 ID**（格式如 `m6jo3ZtPLelyLD4uCtZlx7ThnAulwP9XNESX5bw-PkI`）：

| 模板用途 | 关键词 | 在代码中的位置 |
|---------|--------|-------------|
| 测试提醒（3天未测） | 用户昵称、上次测试日期、提示语 | `api.js` → `testReminder` |
| 挑战通知（好友发起挑战） | 挑战者昵称、挑战时间、挑战类型 | `api.js` → `challengeNotify` |
| 签到提醒（当日未签到） | 用户昵称、当前时间、提示语 | `api.js` → `checkinReminder` |
| 段位变化（晋升/被超越） | 用户昵称、变化类型、新段位名称 | `api.js` → `tierChange` |
| 悬赏结果（预言结算） | 目标用户、预测结果、实际结果 | `submitScore` 云函数 → `BOUNTY_TEMPLATE_ID` |

3. 填入代码：

   **前端模板 ID** → 编辑 `src/utils/api.js` 第 203-208 行：
   ```js
   const SUBSCRIBE_TEMPLATE_IDS = {
     testReminder:  '',   // ← 替换为实际 ID
     challengeNotify: '', // ← 替换为实际 ID
     checkinReminder: '', // ← 替换为实际 ID
     tierChange: '',      // ← 替换为实际 ID
   };
   ```

   **悬赏通知模板 ID** → 在微信云开发控制台 → 云函数 → submitScore → 环境变量，添加：
   ```
   BOUNTY_TEMPLATE_ID = <你的模板ID>
   ```

   **挑战通知模板 ID**（sendChallenge）→ 在微信云开发控制台 → 云函数 → sendChallenge → 环境变量，确认：
   ```
   SUBSCRIBE_TEMPLATE_ID = m6jo3ZtPLelyLD4uCtZlx7ThnAulwP9XNESX5bw-PkI
   ```
   如需要替换为新模板 ID，更新此环境变量。

---

## 2. 配置企微告警 Webhook（阻塞 🔴）

### 操作步骤

1. 在企业微信中创建一个群机器人：
   - 打开目标企业微信群 → 群设置 → 群机器人 → 添加机器人
   - 复制 Webhook URL（格式：`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx`）

2. 在微信云开发控制台 → 云函数 → 逐个设置环境变量 `WECOM_WEBHOOK_URL`：

   **需要设置 Webhook 的函数**（这些函数的代码中实际使用 Webhook）：
   - `monitorMetrics` — 每小时指标异常告警
   - `errorMonitor` — 每 30 分钟错误率告警

   **可选设置**（这些 config.json 中预留了变量，但当前代码未使用）：
   - `analyticsLog`、`getDailyQuestions`、`getFriendRank`、`getTierDistribution`
   - `getWeeklyStats`、`importQuestions`、`sendChallenge`、`submitScore`

3. 测试：在控制台中手动触发一次 `monitorMetrics`，确认企微群收到测试消息。

---

## 3. 激活云函数定时触发器（阻塞 🔴）

`config.json` 中的触发器声明需要在上传后在**微信云开发控制台**中手动激活。

### 操作步骤

1. 登录 [微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 进入「云函数」→ 逐个检查以下函数的触发器：

| 云函数 | 触发器名 | 频率 | Cron 表达式 |
|--------|---------|------|------------|
| `monitorMetrics` | monitorMetrics | 每小时 | `0 7 * * * * *` |
| `processFeedback` | processFeedback | 每天凌晨 3:00 | `0 0 3 * * * *` |
| `errorMonitor` | errorMonitor | 每 30 分钟 | `0 0,30 * * * * *` |
| `sendReminder` | checkinReminder | 每天 20:00 | `0 0 20 * * * *` |
| `sendReminder` | testReminder | 每天 10:00 | `0 0 10 * * * *` |
| `weeklyReport` | weeklyReport | 每周一 10:00 | `0 0 10 * * 1 *` |

3. 如果触发器不存在，点击「新建触发器」，填入上述信息
4. 确保所有触发器状态为「启用」

---

## 4. 初始化种子数据（高优 🟡）

部署后 `monitor_results` 为空，管理面板和历史数据对比无数据。

### 操作步骤

1. 在微信云开发控制台 → 云函数 → `monitorMetrics` → 「测试」，使用空参数 `{}` 触发一次
2. 在微信云开发控制台 → 云函数 → `processFeedback` → 「测试」，使用空参数 `{}` 触发一次
3. 在云开发控制台 → 数据库 → 检查：
   - `monitor_results` 中是否出现第一条记录
   - `questions` 集合中是否出现 `qualityScore` 字段

---

## 5. 配置管理员密码

### 操作步骤

在微信云开发控制台 → 云函数 → `getDashboardData` → 环境变量，设置：
```
ADMIN_PASSWORD = <你的管理员密码>
```

设置后：
- 访问管理面板 `?admin=1` 需要输入密码
- 如果不设置，保持完全开放（仅开发阶段推荐）
- rank 页的 K-factor 角标不受影响（使用 lite 模式）

---

## 6. 端到端测试清单

部署后按以下顺序走通完整流程：

- [ ] 清除小程序缓存，首次打开 → 看到新手引导卡片
- [ ] 点击「开始定段」→ 引导消失 → 进入答题页
- [ ] 完成 5 道题 → 每道题可点 👍/👎 反馈
- [ ] 结果页展示段位徽章 + 人格标签 + 知识星阵
- [ ] 点击分享 → 4 种分享图均可正常生成
- [ ] 好友点击分享卡片 → 正确跳转到首页（带邀请参数）
- [ ] 好友完成测试 → 双方在排行页能看到对方
- [ ] 订阅消息弹窗正常弹出（模板 ID 配置后）
- [ ] 访问管理面板 `?admin=1` → 输入密码 → 看到仪表盘
- [ ] rank 页底部看到 K-factor 角标（仅 admin 可见）
- [ ] 深度定段模式（10 题）可正常触发

---

## 7. 其他上线前建议

- **微信审核**：小程序涉及「社交-排行榜」「虚拟段位体系」，建议在类目设置中确认已覆盖
- **隐私协议**：确保小程序设置中已配置用户隐私保护指引（收集 openid、订阅消息等）
- **服务器域名**：在微信公众平台 → 开发 → 服务器域名中配置云开发域名
- **代码上传**：使用微信开发者工具 → 上传 → 填写版本号和备注 → 提交审核
