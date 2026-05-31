<template>
  <view class="page-handbook">
    <!-- 固定顶栏 -->
    <view class="page-handbook__topbar">
      <view class="page-handbook__back" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="page-handbook__topbar-title">进化手册</text>
      <button class="page-handbook__topbar-share" open-type="share" @click="trackShareClick('handbook')">
        📤
      </button>
    </view>

    <scroll-view scroll-y class="page-handbook__scroll" :style="{ height: scrollHeight + 'px' }">
      <!-- Zone A: 星图进度 -->
      <view class="page-handbook__starzone">
        <view class="page-handbook__starzone-header">
          <text class="page-handbook__starzone-title">🌌 知识星图</text>
          <text class="page-handbook__starzone-sub">每测一次，必得一颗星 · 共 30 颗等你收集</text>
        </view>

        <!-- 进度环 + 数字 -->
        <view class="page-handbook__progress-ring-wrap">
          <view class="page-handbook__progress-ring">
            <view class="page-handbook__progress-ring-inner">
              <text class="page-handbook__progress-ring-num">{{ collectedCards.length }}</text>
              <text class="page-handbook__progress-ring-divider">/</text>
              <text class="page-handbook__progress-ring-total">30</text>
            </view>
            <view
              class="page-handbook__progress-ring-circle"
              :style="{ background: `conic-gradient(#ffd700 0deg ${progressDeg}deg, rgba(255,255,255,0.06) ${progressDeg}deg 360deg)` }"
            />
          </view>
        </view>

        <text class="page-handbook__progress-label">星图完成度 {{ progressPercent }}%</text>
        <text v-if="cardsRemaining > 0" class="page-handbook__progress-remain">
          还差 <text class="page-handbook__progress-remain-num">{{ cardsRemaining }}</text> 颗点亮整个星空
        </text>
        <text v-else class="page-handbook__progress-done">你已点亮整个星空！🌟</text>

        <!-- 社交对比 -->
        <view v-if="starRankText" class="page-handbook__star-rank">
          <text>{{ starRankText }}</text>
        </view>

        <!-- 5×6 星阵图 -->
        <view class="page-handbook__star-grid">
          <text
            v-for="i in 30"
            :key="'sg'+i"
            class="page-handbook__star-grid-item"
            :class="[
              i <= collectedCards.length ? 'page-handbook__star-grid-item--lit' : 'page-handbook__star-grid-item--dim',
              'page-handbook__star-grid-item--rarity-' + getStarRarity(i),
            ]"
            :style="{
              animationDelay: (i <= collectedCards.length ? i * 0.03 : i * 0.06) + 's',
            }"
          >{{ i <= collectedCards.length ? '★' : '☆' }}</text>
        </view>

        <!-- 里程碑预告 -->
        <view v-if="nextMilestone" class="page-handbook__next-milestone">
          <text class="page-handbook__next-milestone-icon">{{ nextMilestone.icon }}</text>
          <text class="page-handbook__next-milestone-text">{{ nextMilestone.text }}</text>
        </view>
      </view>

      <!-- Zone B: 进化之路时间线 -->
      <view class="page-handbook__evo-road">
        <view class="page-handbook__evo-road-header">
          <view class="page-handbook__evo-road-title-row">
            <text class="page-handbook__evo-road-title">🌱 进化之路</text>
            <text v-if="evolutionHistory.length > 0" class="page-handbook__evo-road-count">共 {{ evolutionHistory.length }} 次测试</text>
          </view>
          <!-- 段位路径摘要（始终可见） -->
          <view v-if="tierPathText" class="page-handbook__evo-path">
            <text class="page-handbook__evo-path-text">{{ tierPathText }}</text>
          </view>
        </view>

        <!-- 有进化记录 -->
        <view v-if="evolutionHistory.length >= 2" class="page-handbook__evo-timeline">
          <view v-for="(h, i) in displayedHistory" :key="i" class="page-handbook__evo-node">
            <view class="page-handbook__evo-node-line">
              <view class="page-handbook__evo-node-dot" :class="{ 'page-handbook__evo-node-dot--latest': i === 0 && !showFullTimeline }" />
              <view v-if="i < displayedHistory.length - 1 || (showFullTimeline && i < evolutionHistory.length - 1 && i === displayedHistory.length - 1)" class="page-handbook__evo-node-connector" />
            </view>
            <view class="page-handbook__evo-node-body">
              <view class="page-handbook__evo-node-header">
                <text class="page-handbook__evo-node-tier">{{ h.emoji }} {{ h.tier }}</text>
                <text class="page-handbook__evo-node-score">{{ toAIQ(h.score) }}</text>
              </view>
              <text class="page-handbook__evo-node-date">{{ h.date }}</text>
            </view>
          </view>

          <!-- 展开/收起按钮 -->
          <view
            v-if="evolutionHistory.length > 3"
            class="page-handbook__evo-toggle"
            @click="showFullTimeline = !showFullTimeline"
          >
            <text class="page-handbook__evo-toggle-text">
              {{ showFullTimeline ? '收起 ▴' : '展开全部 ' + evolutionHistory.length + ' 条记录 ▾' }}
            </text>
          </view>
        </view>

        <!-- 空状态：引导首次/第二次测试 -->
        <view v-else class="page-handbook__evo-empty">
          <text class="page-handbook__evo-empty-icon">{{ evolutionHistory.length === 0 ? '🚀' : '🌱' }}</text>
          <text class="page-handbook__evo-empty-text">
            {{ evolutionHistory.length === 0 ? '完成首次测试，开启你的进化之路' : '再测一次，记录第二个进化节点' }}
          </text>
          <button class="page-handbook__evo-empty-btn" @click="goToTest">
            {{ evolutionHistory.length === 0 ? '开始首次测试' : '继续测试 →' }}
          </button>
        </view>
      </view>

      <!-- Zone C: 筛选栏 -->
      <view class="page-handbook__filters">
        <view
          v-for="f in filters"
          :key="f.key"
          class="page-handbook__filter"
          :class="{ 'page-handbook__filter--active': activeFilter === f.key }"
          @click="activeFilter = f.key"
        >
          {{ f.label }}
        </view>
      </view>

      <!-- Zone C: 知识星网格 -->
      <view class="page-handbook__grid">
        <view
          v-for="card in filteredCards"
          :key="card.id"
          class="page-handbook__card"
          :class="[
            isCollected(card.id) ? 'page-handbook__card--collected' : 'page-handbook__card--uncollected',
            !isCollected(card.id) ? 'page-handbook__card--rarity-' + card.rarity : '',
          ]"
          @click="openCard(card)"
        >
          <!-- 已收集 -->
          <template v-if="isCollected(card.id)">
            <view class="page-handbook__card-rarity" :class="'page-handbook__card-rarity--' + card.rarity">
              {{ rarityLabel(card.rarity) }}
            </view>
            <text class="page-handbook__card-emoji">{{ card.emoji }}</text>
            <text class="page-handbook__card-title">{{ card.title }}</text>
          </template>
          <!-- 未收集 -->
          <template v-else>
            <view class="page-handbook__card-lock-glow" :class="'page-handbook__card-lock-glow--' + card.rarity" />
            <text class="page-handbook__card-mystery">✦</text>
            <text class="page-handbook__card-clue">{{ card.clue }}</text>
            <text class="page-handbook__card-unlock-hint">🔒 继续测试解锁</text>
          </template>
        </view>
      </view>

      <!-- 底部留白 -->
      <view style="height: 140rpx" />
    </scroll-view>

    <!-- 固定底部 CTA -->
    <view class="page-handbook__fixed-cta">
      <button class="page-handbook__fixed-cta-btn" @click="goToTest">
        🔄 继续测试，解锁更多知识星
      </button>
    </view>

    <!-- 卡片详情弹窗 -->
    <view v-if="selectedCard" class="page-handbook__overlay" @click="selectedCard = null">
      <view class="page-handbook__detail" @click.stop>
        <text class="page-handbook__detail-rarity" :class="'page-handbook__detail-rarity--' + selectedCard.rarity">
          {{ rarityLabel(selectedCard.rarity) }}
        </text>
        <text class="page-handbook__detail-emoji">{{ selectedCard.emoji }}</text>
        <text class="page-handbook__detail-title">{{ selectedCard.title }}</text>
        <text class="page-handbook__detail-hook">{{ selectedCard.hook }}</text>
        <text class="page-handbook__detail-body">{{ selectedCard.body }}</text>
        <view class="page-handbook__detail-tip">
          <text class="page-handbook__detail-tip-label">💡 试试看</text>
          <text class="page-handbook__detail-tip-text">{{ selectedCard.actionTip }}</text>
        </view>
        <view class="page-handbook__detail-fact">
          <text class="page-handbook__detail-fact-label">🧐 冷知识</text>
          <text class="page-handbook__detail-fact-text">{{ selectedCard.funFact }}</text>
        </view>
        <view class="page-handbook__detail-actions">
          <button class="page-handbook__detail-share" @click="generateCardImage(selectedCard)">
            🎨 生成知识星卡片
          </button>
          <button class="page-handbook__detail-share-text" open-type="share" @click="onCardShare(selectedCard)">
            📤 分享这颗知识星
          </button>
          <button class="page-handbook__detail-close" @click="selectedCard = null">关闭</button>
        </view>
      </view>
    </view>

    <!-- 隐藏 canvas 用于生成知识星卡片 -->
    <canvas id="knowledge-card-canvas" type="2d" style="position:fixed;left:-9999px;width:750px;height:1000px" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { getUserOpenidSync, callCloudFunction, fetchWeeklyStats } from '@/utils/api.js';
import { toAIQuotient } from '@/utils/tier.js';
import { generateKnowledgeCardImage } from '@/utils/canvas-renderer.js';
import { trackShareClick } from '@/utils/analytics.js';

function toAIQ(rawScore) {
  if (!rawScore || rawScore === 0) return '—';
  return 'AI商数' + toAIQuotient(rawScore);
}

const collectedCards = ref([]);
const selectedCard = ref(null);
const activeFilter = ref('all');
const evolutionHistory = ref([]);
const showFullTimeline = ref(false);
const starRankInFriends = ref(0);
const starRankTotal = ref(0);
const generatingImage = ref(false);

// 段位路径摘要：🐣 → 💬 → 🛠️（你在这）
const tierPathText = computed(() => {
  if (evolutionHistory.value.length < 2) return '';
  const seen = [];
  // history is newest-first, reverse for chronological path
  const reversed = [...evolutionHistory.value].reverse();
  for (const h of reversed) {
    const key = h.tier;
    if (!seen.find(s => s.tier === key)) {
      seen.push({ tier: key, emoji: h.emoji });
    }
  }
  if (seen.length < 2) return '';
  return seen.map(s => s.emoji + ' ' + s.tier).join(' → ') + '（你在这）';
});

// 默认显示最新 3 条，展开后显示全部
const displayedHistory = computed(() => {
  if (showFullTimeline.value || evolutionHistory.value.length <= 3) {
    return evolutionHistory.value;
  }
  return evolutionHistory.value.slice(0, 3);
});

const scrollHeight = computed(() => {
  try {
    const info = uni.getWindowInfo();
    return info.windowHeight - 44;
  } catch (e) { return 600; }
});

const filters = computed(() => {
  const collected = collectedCards.value.length;
  const total = 30;
  return [
    { key: 'all', label: `全部 (${total})` },
    { key: 'collected', label: `已收集 (${collected})` },
    { key: 'uncollected', label: `未解锁 (${total - collected})` },
  ];
});

const progressPercent = computed(() => {
  return Math.round((collectedCards.value.length / 30) * 100);
});

const progressDeg = computed(() => {
  return (collectedCards.value.length / 30) * 360;
});

const cardsRemaining = computed(() => 30 - collectedCards.value.length);

const starRankText = computed(() => {
  if (starRankInFriends.value > 0 && starRankTotal.value > 0) {
    const emoji = starRankInFriends.value <= 3 ? '🏆' : '📊';
    return `${emoji} 好友中第 ${starRankInFriends.value} 名 · 共 ${starRankTotal.value} 人在收集`;
  }
  return '';
});

const nextMilestone = computed(() => {
  const count = collectedCards.value.length;
  const milestones = [
    { at: 10, icon: '🌟', text: '还差 ' + (10 - count) + ' 颗达成「星图初现」里程碑' },
    { at: 15, icon: '💫', text: '还差 ' + (15 - count) + ' 颗达成「半程星图」里程碑' },
    { at: 20, icon: '✨', text: '还差 ' + (20 - count) + ' 颗达成「星光璀璨」里程碑' },
    { at: 25, icon: '⭐', text: '还差 ' + (25 - count) + ' 颗达成「接近圆满」里程碑' },
    { at: 30, icon: '👑', text: '还差 ' + (30 - count) + ' 颗达成「星图圆满」里程碑' },
  ];
  for (const m of milestones) {
    if (count < m.at) return { icon: m.icon, text: m.text };
  }
  return null;
});

// 卡片元数据
const ALL_CARDS = [
  { id: 'kc_prompt_001', rarity: 'common', title: '给 AI 一个"好问题"', emoji: '🎯', hook: '高段位玩家和AI对话的方式，跟你想象的有点不一样。', body: '把 AI 想象成一个超级能干但完全不了解你处境的实习生。你给它的信息越多、约束越具体，它产出的东西就越合用。', actionTip: '下次给 AI 指令时，试试加上三个要素：① 用在什么地方 ② 给谁看的 ③ 不要什么。', funFact: '有人做过对比测试：带具体约束的版本，AI 输出质量比模糊版本高出约 40%。', clue: '这张卡和"如何给AI下指令"有关' },
  { id: 'kc_prompt_002', rarity: 'common', title: '让 AI "演"一个角色', emoji: '🎭', hook: '有一个简单技巧，能让 AI 的回答质量瞬间提升一档。', body: 'AI 的一个隐藏特性：你让它"扮演"某个角色时，它调用的知识模式和语言风格会发生明显变化。', actionTip: '试试这个模板："你是[角色]，正在帮[我]做[任务]。你的风格应该是[3个形容词]。"', funFact: '有研究发现，让 AI 扮演"专家角色"后，它在专业领域的回答准确率提升了约 30%。', clue: '这张卡和"让AI扮演角色"有关' },
  { id: 'kc_prompt_003', rarity: 'common', title: '别让 AI 一步到位', emoji: '🔗', hook: '你每次都让 AI 直接给最终答案，但最厉害的使用者会"拆着问"。', body: '这叫"思维链"——让 AI 先分析、再推演、最后输出。你以为这是多此一举，实际上它能让 AI 避免很多低级错误。', actionTip: '复杂任务拆成三步指令：①"先帮我分析这个问题的关键点"→ ②"基于分析给三个可能方案"→ ③"选最优方案并详细展开"。', funFact: 'Google DeepMind 的研究表明，让 AI"一步步思考"能让复杂推理任务的准确率从 30% 提升到 80% 以上。', clue: '这张卡和"拆分复杂任务"有关' },
  { id: 'kc_discern_001', rarity: 'common', title: 'AI 也会"编造"事实——但你可以防住它', emoji: '🔍', hook: '你以为 AI 的回答都是对的？其实它有时候只是在"一本正经地胡说八道"。', body: 'AI 有个毛病叫"幻觉"——当它不知道答案时，有时会编造一个听起来很合理但完全错误的内容。', actionTip: 'AI 给你重要信息时，多问一句"你能提供来源吗？"或者"这个数据的依据是什么？"', funFact: '2023 年，一位美国律师用 ChatGPT 准备法律文件，被法官发现引用了 6 个完全不存在的案例。', clue: '这张卡和"识别AI的幻觉"有关' },
  { id: 'kc_discern_002', rarity: 'common', title: '追问"为什么"的力量', emoji: '🧐', hook: '你接受了 AI 的第一版答案，但高阶用户会追问到底。', body: 'AI 的输出质量有 80% 取决于你的输入——但剩下 20% 取决于你是否愿意追问。', actionTip: '养成一个习惯：AI 给你答案后，至少追问一次。', funFact: '同一组问题，追问 3 轮以上的答案比第一轮答案的满意度高出 60%。', clue: '这张卡和"追问AI"有关' },
  { id: 'kc_discern_003', rarity: 'common', title: 'AI 不是中立的——它带着你看不见的"偏见"', emoji: '🧿', hook: '你以为 AI 是客观公正的？其实它从训练数据里继承了大量隐形偏见。', body: 'AI 模型是用互联网上的海量数据训练的，而互联网本身就充满了各种偏见。', actionTip: '当 AI 给出涉及"人"的建议时，追问："这个建议对于不同背景的人是否同样适用？"', funFact: '研究发现 AI 在给职业建议时会无意中将"护士"与女性联系、"CEO"与男性联系。', clue: '这张卡和"AI的隐性偏见"有关' },
  { id: 'kc_integrate_001', rarity: 'common', title: '什么时候你该"抢回控制权"', emoji: '🤝', hook: '你让 AI 干了所有的事，但高手知道什么时候该自己出手。', body: 'AI 擅长"生成"，但不擅长"判断"。关键不是 AI 能做多少，而是你知道什么时候该自己接手。', actionTip: '收到 AI 输出后，问自己三个问题：里面有事实信息吗？适合我的场景吗？直接用会不会出问题？', funFact: '麦肯锡研究发现，AI + 人工的"接力模式"比纯人工快 40%。', clue: '这张卡和"人机协作的边界"有关' },
  { id: 'kc_integrate_002', rarity: 'common', title: '一个 AI 不够？试试让它"组团干活"', emoji: '⛓️', hook: '你只用一个 AI 工具，但进阶级玩家已经开始让 AI 们互相配合了。', body: '不同 AI 工具有不同强项——有的擅长写作，有的擅长搜索实时信息，有的擅长数据分析。', actionTip: '试试这个流程：搜索型 AI 搜集资料 → 写作型 AI 出初稿 → 另一个 AI 做批判性审查。', funFact: '开发者社区有一个方法叫"AI 辩论"——让两个不同 AI 模型针对同一问题给出对立观点。', clue: '这张卡和"多个AI协同工作"有关' },
  { id: 'kc_integrate_003', rarity: 'common', title: '让 AI 在你需要的时候自动出现', emoji: '⚡', hook: '你还是每次打开 AI 工具去提问，但觉醒者已经在生活里设好了 AI 自动触发点。', body: '最高效的 AI 使用不是"我需要的时候去找它"，而是"它在我需要之前就准备好了"。', actionTip: '找出你每周重复做的 3 件"思考型"任务，给每个写一个 prompt 模板。', funFact: '有创业者分享说，他把所有"重复性决策"都写成了 prompt 模板，每天节省约 2 小时。', clue: '这张卡和"AI工作流自动化"有关' },
  { id: 'kc_create_001', rarity: 'common', title: '让 AI 来问你问题——反着用更聪明', emoji: '🔄', hook: '你以为 AI 的角色是"回答你"，但有一个反直觉的玩法：让它来问你。', body: '在你不确定自己到底想要什么的时候，让 AI 反过来问你问题往往能帮你理清思路。', actionTip: '下次遇到模糊问题，先对 AI 说："不要直接给建议。先问我 5 个问题帮我理清需求。"', funFact: 'OpenAI 的 CEO Sam Altman 曾说他最喜欢的 ChatGPT 用法是"让它问你问题"。', clue: '这张卡和"让AI提问"有关' },
  { id: 'kc_create_002', rarity: 'common', title: '用一个领域的思维解决另一个领域的问题', emoji: '🌐', hook: 'AI 最被低估的能力之一，是让它做"思维翻译官"——不是翻译语言，而是翻译思维框架。', body: '把你正在纠结的问题，用另一个领域的框架来描述。思维框架的转换，往往带来意想不到的突破。', actionTip: '选一个你正在纠结的问题，告诉 AI："用[一个你完全不熟悉的领域]的框架来分析和解决这个问题。"', funFact: '有一个著名的创新方法论叫"TRIZ"，核心就是跨领域提取解决方案模式。', clue: '这张卡和"跨领域思维"有关' },
  { id: 'kc_create_003', rarity: 'common', title: '"100 个烂点子"——AI 创意爆发法', emoji: '🌀', hook: '你不是想不出好点子，你是不敢想烂点子。AI 帮你跳过这个心理障碍。', body: '创新的第一障碍是"自我审查"——一个想法刚冒出来你就在心里说"这不行"。AI 不存在这个问题。', actionTip: '需要创意时分四步：让 AI 生成 20 个方案 → 你挑 3 个 → AI 延伸变体 → 挑最终方案。', funFact: '广告公司 BBH 的创意流程用类似逻辑——先大量产出"看起来不行但有点意思"的点子。', clue: '这张卡和"AI创意方法"有关' },
  { id: 'kc_boundary_001', rarity: 'common', title: '有些东西，别发给 AI', emoji: '🔒', hook: '你对 AI 敞开心扉，但有些事情最好守住底线。', body: '你把公司内部数据、合同条款、个人身份证号发给 AI 时，这些信息可能被用于训练下一个版本的模型。', actionTip: '工作中需要 AI 帮忙时，做个简单脱敏：真实人名换成"员工A"，具体金额换成"X万元级别"。', funFact: '2023 年三星公司发现员工将内部代码粘贴到 ChatGPT 后，直接禁止了外部 AI 使用。', clue: '这张卡和"数据安全意识"有关' },
  { id: 'kc_boundary_002', rarity: 'common', title: '最高级的 AI 使用者，知道什么时候不用它', emoji: '🛑', hook: '你几乎什么都问 AI，但有些情况不用 AI 反而是更聪明的选择。', body: '不用 AI 反而更好的场景：需要原创战略思考、需要为结果承担法律或道德责任、涉及极度私密的情感问题。', actionTip: '准备问 AI 之前停 3 秒，问自己："这个决定的后果，我来承担还是 AI 来承担？"', funFact: '在道德困境中，AI 的建议比人类更"功利主义"。这就是 AI 建议 + 人类判断 = 最佳组合的原因。', clue: '这张卡和"AI的使用边界"有关' },
  { id: 'kc_boundary_003', rarity: 'common', title: '你知道 AI 在哪些领域被"故意限制"了吗', emoji: '⚖️', hook: '你可能遇到过 AI 拒绝回答的情况——这背后有一整套你没看到的"安全护栏"。', body: '大公司的 AI 产品都内置了多层"对齐"机制——从训练阶段过滤有害内容，到推理阶段实时检测不安全请求。', actionTip: '当 AI 拒绝回答一个你认为合理的问题时，试试换个问法：用更中立、更具体、更职业的措辞。', funFact: 'AI 安全领域有一场持续三年的"猫鼠游戏"——每次新模型发布，总有用户找到绕过安全限制的方法。', clue: '这张卡和"AI安全机制"有关' },
  { id: 'kc_general_001', rarity: 'common', title: 'AI 不是搜索引擎——怎么跟它对话最有效', emoji: '💬', hook: '你把 AI 当搜索框用，但它其实更像一个"对话伙伴"。', body: '搜索引擎是"输入关键词 → 返回链接"；AI 是"描述你的处境 → 它帮你思考"。描述越具体，AI 越能帮到你。', actionTip: '下次别问"AI 怎么用？"，试试说"我想用 AI 帮我提高工作效率，我主要是做销售的…"', funFact: '大多数人使用 AI 的方式还停留在"搜索式提问"。而"对话式描述"的满意度高出 2 倍以上。', clue: '这张卡和"如何与AI对话"有关' },
  { id: 'kc_general_002', rarity: 'common', title: '你在"用"AI，还是在"被 AI 用"？', emoji: '🧭', hook: '段位越高，你越会发现一个问题：效率提升了，但"我在干什么"的困惑也可能更大。', body: 'AI 能帮你做几乎所有事，但只有你能回答"我为什么要做这件事"。把 AI 用在最值得的地方。', actionTip: '每周花 10 分钟思考：本周用 AI 做的事情中，哪件最值得？哪件其实可以不做的？', funFact: '有 AI 重度用户分享：用了 AI 半年后，他反而减少了与 AI 的交互次数——但每次交互的质量显著提高。', clue: '这张卡和"AI使用哲学"有关' },
  { id: 'kc_general_003', rarity: 'common', title: 'AI 时代最值钱的技能：学会提问', emoji: '❓', hook: '你可能听过"AI 时代提问比回答重要"——但真正理解这句话的人不多。', body: '一个好的提问包含三样东西：清晰的问题描述、相关的背景约束、期望的输出格式。这三样齐了，AI 的输出质量会呈指数级提升。', actionTip: '把"帮我写个方案"改成"帮我写一个给老板看的Q3营销方案，核心是提升复购率，控制在500字以内"。', funFact: '"结构化提问"的 AI 输出满意度是"模糊提问"的 3 倍。而大部分人的提问属于模糊型。', clue: '这张卡和"提问的艺术"有关' },
  { id: 'kc_rare_001', rarity: 'rare', title: '指令力 × 辨别力：给 AI 装上"防忽悠雷达"', emoji: '🛡️', hook: '你学会了让 AI 干好活，但你学会了不给它被忽悠的机会吗？', body: '高手的秘密：在写 prompt 的时候就植入验证机制。叫"防御性指令"——从源头减少 AI 幻觉。', actionTip: '在你的日常 prompt 模板里加一句："如果你对某个部分不够确定，请明确标注，并建议我如何独立验证。"', funFact: '在 prompt 中加入"请逐步检查你的推理"可以降低约 30% 的事实错误率。', clue: '这张稀有卡和"防御性指令"有关' },
  { id: 'kc_rare_002', rarity: 'rare', title: '整合力 × 创新力：打造你的 AI 副驾驶系统', emoji: '🚁', hook: '你已经在用 AI 做单个任务了，但真正的高手有一套"AI 协同系统"。', body: '想象你在开飞机——你不是在每个环节手动操作，而是设定航向、监控仪表、在关键时刻接管。这就是"AI 副驾驶"模式。', actionTip: '选一个你每天做的核心任务，设计一个 AI 副驾驶流程：① 设定目标 → ② AI 自动执行 → ③ AI 输出+自检报告 → ④ 你审核关键节点。', funFact: '顶级 AI 用户的共同特征不是"会用很多工具"，而是"有一套固定的 AI 工作流系统"。', clue: '这张稀有卡和"AI协同系统"有关' },
  { id: 'kc_rare_003', rarity: 'rare', title: '边界感 × 通用力：AI 时代的"数字断舍离"', emoji: '🧘', hook: '你不是 AI 用得不够多，你可能是用得太多但用得太浅。', body: '数字断舍离不是不用 AI，而是"只把 AI 用在真正重要的事上"。少了那些"假忙碌"，你的 AI 使用效率反而提升了。', actionTip: '这周末花 15 分钟，回顾本周所有 AI 交互，找出 3 件"做了但没必要"的事。下周把它们从你的 AI 清单里删掉。', funFact: '"少用但用对"的 AI 用户比"什么都用 AI"的用户，在核心工作产出上高出 50%。', clue: '这张稀有卡和"数字断舍离"有关' },
  { id: 'kc_rare_004', rarity: 'rare', title: '案例：用 AI 搞定一次艰难对话', emoji: '💬', hook: '有个真实案例：一位团队 leader 用 AI 准备了一次绩效面谈，结果出乎所有人的意料。', body: '他让 AI 扮演"即将被面谈的员工"，自己练习了三轮对话。正式面谈时，几乎每个局面都有预案。', actionTip: '下次遇到重要对话——无论是谈薪、反馈还是道歉——先让 AI 扮演对方角色模拟三轮。', funFact: '哈佛谈判项目的研究表明，预先模拟对手可能的反应和情绪，能将谈判成功率提升 30% 以上。', clue: '这张稀有卡和"用AI准备对话"有关' },
  { id: 'kc_rare_005', rarity: 'rare', title: '案例：一个 prompt 模板省了 200 小时', emoji: '⏱️', hook: '某创业公司的运营总监分享：她用一个 AI prompt 模板，把每周重复工作从 5 小时压到 30 分钟。', body: '她的诀窍很简单：把每周要做的 5 件"思考型重复工作"各写了一个固定 prompt。每次只需替换本周的具体数据。', actionTip: '找出你每周至少重复 3 次的"思考型"任务。给每个写一个包含"背景+输入格式+输出要求"的 prompt。', funFact: '知识工作者每周平均花 12 小时在"重复性思考任务"上——其中 70% 可以用 AI 模板化处理。', clue: '这张稀有卡和"AI模板化"有关' },
  { id: 'kc_rare_006', rarity: 'rare', title: '案例：一个程序员用 AI "克隆"了自己的代码风格', emoji: '💻', hook: '一个资深程序员做了个实验：他把自己过去一年的代码喂给 AI，然后让 AI 按照他的风格写新功能。', body: '他先让 AI 分析了自己代码的"风格指纹"——命名习惯、注释密度、错误处理模式、架构偏好。然后 AI 生成的代码竟然和他的风格高度一致。', actionTip: '不只是程序员——任何重复性工作都可以"风格化"。把你自己做的 3-5 个作品喂给 AI，让它总结你的风格特征。', funFact: 'AI 的"风格迁移"能力在 2023 年后有了质的飞跃。现在它可以模仿从写作到编码的几乎任何特征。', clue: '这张稀有卡和"AI风格迁移"有关' },
  { id: 'kc_rare_007', rarity: 'rare', title: '案例：用 AI 给自己的生活做了一次"审计"', emoji: '📊', hook: '一位产品经理用 AI 分析了自己一个月的聊天记录、日历和消费账单，得到了一个"人生仪表盘"。', body: '他让 AI 从时间分配、情绪曲线、消费模式三个维度分析数据。结果让他看到了一个"数据视角下的自己"。', actionTip: '试试"轻量版"：把一周的日历导出，让 AI 分析你的时间分配模式，看看有多少时间花在了真正重要的事上。', funFact: '量化自我（Quantified Self）运动已存在十多年，但 AI 让数据分析从"专业人士专属"变成了"人人可做"。', clue: '这张稀有卡和"量化自我"有关' },
  { id: 'kc_legend_001', rarity: 'legend', title: '当 AI 开始理解你的情绪', emoji: '💭', hook: '这可能是 AI 发展中最被低估的革命：它开始"读懂"你了。但不是以你以为的方式。', body: 'AI 不能感受情绪，但它能识别情绪的语言模式。当你沮丧时句子变短，兴奋时标点增多。高级 AI 能捕捉这些信号并调整回应方式。', actionTip: '下次情绪强烈时，试试先对 AI 说："我现在的情绪状态是[描述]，请根据这个调整你的回答风格。"', funFact: '2025 年 AI 在识别文本中的情绪信号方面的准确率已达到 85%，接近人类水平。', clue: '这张传说卡在晋升段位时有机会掉落' },
  { id: 'kc_legend_002', rarity: 'legend', title: '3 年后，AI 会如何改变你的工作？', emoji: '🔮', hook: '不是科幻猜想，而是基于当前技术曲线的合理推演。', body: '三个趋势同时发生：AI Agent 从"对话"走向"执行"；多模态 AI 让"看图说话"变成"看懂世界"；个性化 AI 从"通用助手"变成"你的专属副驾驶"。', actionTip: '把这句话记下来：3 年后回看，你现在每一次测试，都是在给未来的自己存"AI 认知复利"。', funFact: '经济学家预测：AI 在工作中的渗透率将在 2027-2028 年达到临界点，你现在的位置就像 1995 年学用互联网的那批人。', clue: '这张传说卡在满分测试时有机会掉落' },
  { id: 'kc_legend_003', rarity: 'legend', title: '无界者的十条信条', emoji: '📜', hook: '这是进化湾从数千次测试数据中总结出的"顶级 AI 使用者的共同特质"。', body: '他们永远把 AI 当工具，不当拐杖。追问次数是平均用户的 5 倍。不只用 AI 做事，还用 AI 思考"该做什么事"。有自己的 prompt 模板库。每周做一次"AI 审计"。', actionTip: '这十条信条中，选一条你觉得最容易做到的，本周专门练习。然后再选下一条。一次一条，慢慢你就变成了无界者。', funFact: '这十条信条的提炼过程本身就是由 AI 辅助完成的——AI + 人类协作的完美范例。', clue: '这张传说卡在到达无界时有机会掉落' },
  { id: 'kc_limited_001', rarity: 'limited', title: '周末特辑：AI 陪你度过一个高效周末', emoji: '🌤️', hook: '周末是自我进化的黄金时间——但大多数人浪费了它。这张卡只在周末出现。', body: '用 AI 来规划你的周末：让 AI 推荐一个 2 小时能完成的学习项目；用 AI 整理本周的工作笔记；让 AI 设计"下周的 AI 使用改进计划"。', actionTip: '这个周末，挑一件你一直想做但"没时间"的事，让 AI 帮你把它拆成 3 个 30 分钟的小步骤。', funFact: '周末进行 2 小时以上"刻意学习"的人的长期技能增长曲线，比只在工作日学习的人陡峭 40%。', clue: '这张限时卡仅在周末出现' },
  { id: 'kc_limited_002', rarity: 'limited', title: '节日限定：给自己一份"AI 进化年终总结"', emoji: '🎊', hook: '特殊的日子里，这张卡会出现在你面前。它提醒你：停下来，看看自己走了多远。', body: '每隔一段时间，坐下来让 AI 帮你回顾这段日子的成长。你变得更擅长什么了？你克服了什么障碍？下一段进化方向是什么？', actionTip: '花 10 分钟写下你最近和 AI 相处的 3 个变化——无论好坏。保存下来，下次节日时再对比。', funFact: '"定期自我审计"是最被低估的个人成长工具之一。AI 让这个习惯变得前所未有的容易。', clue: '这张限时卡仅在节日出现' },
];

const filteredCards = computed(() => {
  switch (activeFilter.value) {
    case 'collected':
      return ALL_CARDS.filter(c => isCollected(c.id));
    case 'uncollected':
      return ALL_CARDS.filter(c => !isCollected(c.id));
    default:
      return ALL_CARDS;
  }
});

function isCollected(cardId) {
  return collectedCards.value.includes(cardId);
}

function rarityLabel(rarity) {
  const map = { common: '⭐ 普通', rare: '✨ 稀有', legend: '🔮 传说', limited: '⏳ 限时' };
  return map[rarity] || '';
}

function getStarRarity(i) {
  if (i <= 18) return 'common';
  if (i <= 25) return 'rare';
  if (i <= 28) return 'legend';
  return 'limited';
}

function openCard(card) {
  if (isCollected(card.id)) {
    selectedCard.value = card;
  } else {
    const rarityHint = {
      common: '继续测试即可解锁',
      rare: '继续测试，稀有星等你收集',
      legend: '高分测试有机会掉落传说星',
      limited: '限时活动中解锁这颗星',
    };
    uni.showToast({ title: rarityHint[card.rarity] || '继续测试，解锁这颗星', icon: 'none', duration: 2000 });
  }
}

async function generateCardImage(card) {
  if (generatingImage.value) return;
  generatingImage.value = true;
  uni.showLoading({ title: '生成中…' });
  try {
    const imagePath = await generateKnowledgeCardImage(card, null, 'knowledge-card-canvas');
    uni.hideLoading();
    uni.showShareImageMenu({
      path: imagePath,
      success: () => {
        uni.showToast({ title: '长按保存或分享给好友', icon: 'none' });
      },
      fail: (err) => {
        console.warn('[handbook] 分享图片菜单失败:', err);
        uni.previewImage({ urls: [imagePath] });
      },
    });
  } catch (e) {
    uni.hideLoading();
    console.error('[handbook] 知识星卡片生成失败:', e);
    uni.showToast({ title: '生成失败，请重试', icon: 'none' });
  }
  generatingImage.value = false;
}

function onCardShare(card) {
  shareCardTitle.value = card?.title || '';
}

function goBack() {
  uni.navigateBack({ delta: 1 });
}

function goToTest() {
  uni.navigateTo({ url: '/pages/quiz/quiz' });
}

const shareCardTitle = ref('');

onShareAppMessage(() => {
  const uid = getUserOpenidSync();
  const cardTitle = shareCardTitle.value;
  return {
    title: cardTitle
      ? `我收集到了知识星「${cardTitle}」🌟 测测你能收集多少颗？`
      : `我已点亮 ${collectedCards.value.length}/30 颗知识星 🌌 来看看你的AI段位吧`,
    path: uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index',
    imageUrl: getApp().globalData.defaultShareImage || '/static/images/default-share.png',
  };
});

onShareTimeline(() => {
  const uid = getUserOpenidSync();
  return {
    title: `进化湾 · 我已收集 ${collectedCards.value.length}/30 颗AI知识星，你能点亮多少？🌌`,
    query: uid ? `from_uid=${uid}` : '',
  };
});

onMounted(async () => {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      if (res.data.collectedCards) {
        collectedCards.value = res.data.collectedCards;
      }
      if (res.data.starRankInFriends) {
        starRankInFriends.value = res.data.starRankInFriends || 0;
        starRankTotal.value = res.data.starRankTotal || 0;
      }
    }
  } catch (e) { /* 静默降级 */ }

  try {
    const historyRes = await callCloudFunction('getWeeklyStats', { action: 'getTestHistory' });
    if (historyRes.code === 0 && historyRes.data && historyRes.data.history) {
      evolutionHistory.value = historyRes.data.history;
    }
  } catch (e) { /* 静默失败 */ }
});
</script>

<style scoped lang="scss">
.page-handbook {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0e27 0%, #0d1b2a 100%);
  position: relative;
}

// ── 固定顶栏 ──
.page-handbook__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  height: 88rpx;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.page-handbook__back {
  font-size: 28rpx;
  color: #b0bec5;
  padding: 8rpx 0;
}

.page-handbook__topbar-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffd700;
}

.page-handbook__topbar-share {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  border: none;
  padding: 0;
  font-size: 28rpx;
  line-height: 1;

  &::after { border: none; }
}

// ── Zone A: 星图进度 ──
.page-handbook__starzone {
  padding: 32rpx 32rpx 24rpx;
  text-align: center;
}

.page-handbook__starzone-header {
  margin-bottom: 20rpx;
}

.page-handbook__starzone-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 8rpx;
}

.page-handbook__starzone-sub {
  display: block;
  font-size: 22rpx;
  color: #8899aa;
}

// 进度环
.page-handbook__progress-ring-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12rpx;
}

.page-handbook__progress-ring {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-handbook__progress-ring-circle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  mask: radial-gradient(transparent 58rpx, #000 60rpx);
  -webkit-mask: radial-gradient(transparent 58rpx, #000 60rpx);
}

.page-handbook__progress-ring-inner {
  display: flex;
  align-items: baseline;
  justify-content: center;
  z-index: 1;
}

.page-handbook__progress-ring-num {
  font-size: 52rpx;
  font-weight: bold;
  color: #ffd700;
  line-height: 1;
}

.page-handbook__progress-ring-divider {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 4rpx;
}

.page-handbook__progress-ring-total {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1;
}

.page-handbook__progress-label {
  display: block;
  font-size: 24rpx;
  color: #b0bec5;
  margin-bottom: 4rpx;
}

.page-handbook__progress-remain {
  display: block;
  font-size: 24rpx;
  color: #8899aa;
  margin-bottom: 8rpx;
}

.page-handbook__progress-remain-num {
  color: #ffcc80;
  font-weight: bold;
  font-size: 28rpx;
}

.page-handbook__progress-done {
  display: block;
  font-size: 26rpx;
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 8rpx;
}

// 社交对比
.page-handbook__star-rank {
  display: inline-block;
  padding: 8rpx 24rpx;
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #ffcc80;
  margin-bottom: 20rpx;
}

// 星阵图
.page-handbook__star-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx;
  max-width: 500rpx;
  margin: 0 auto;
}

.page-handbook__star-grid-item {
  font-size: 40rpx;
  line-height: 1;
  animation: star-fade-in 0.5s ease-out both;

  &--lit {
    color: #ffd700;
    text-shadow: 0 0 10rpx rgba(255, 215, 0, 0.4);
  }

  &--dim {
    opacity: 0.4;
    color: rgba(255, 255, 255, 0.35);
  }

  &--rarity-rare {
    color: rgba(66, 165, 245, 0.5);
  }

  &--rarity-legend {
    color: rgba(206, 147, 216, 0.5);
  }

  &--rarity-limited {
    color: rgba(255, 215, 0, 0.6);
  }
}

// 里程碑预告
.page-handbook__next-milestone {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  padding: 10rpx 20rpx;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.12);
  border-radius: 20rpx;

  &-icon { font-size: 24rpx; }
  &-text { font-size: 22rpx; color: #ffcc80; }
}

// ── Zone B: 进化之路 ──
.page-handbook__evo-road {
  padding: 24rpx 32rpx 8rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.page-handbook__evo-road-header {
  margin-bottom: 12rpx;
}

.page-handbook__evo-road-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4rpx;
}

.page-handbook__evo-road-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #ffd700;
}

.page-handbook__evo-road-count {
  font-size: 22rpx;
  color: #8899aa;
  padding: 4rpx 14rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
}

// 段位路径摘要
.page-handbook__evo-path {
  padding: 10rpx 16rpx;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.12);
  border-radius: 12rpx;
}

.page-handbook__evo-path-text {
  font-size: 22rpx;
  color: #c4b5fd;
  line-height: 1.5;
  word-break: break-all;
}

// 展开/收起按钮
.page-handbook__evo-toggle {
  display: flex;
  justify-content: center;
  padding: 12rpx 0 8rpx;
}

.page-handbook__evo-toggle-text {
  font-size: 24rpx;
  color: #a78bfa;
  padding: 8rpx 28rpx;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: 20rpx;
}

.page-handbook__evo-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-handbook__evo-node {
  display: flex;
  gap: 12rpx;
}

.page-handbook__evo-node-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 32rpx;
}

.page-handbook__evo-node-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.4);
  flex-shrink: 0;
  margin-top: 8rpx;

  &--latest {
    width: 20rpx;
    height: 20rpx;
    background: #ffd700;
    box-shadow: 0 0 10rpx rgba(255, 215, 0, 0.5);
  }
}

.page-handbook__evo-node-connector {
  width: 2rpx;
  flex: 1;
  min-height: 24rpx;
  background: rgba(255, 255, 255, 0.1);
}

.page-handbook__evo-node-body {
  flex: 1;
  padding: 4rpx 0 20rpx;
}

.page-handbook__evo-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4rpx;
}

.page-handbook__evo-node-tier {
  font-size: 26rpx;
  color: #e0e0e0;
  font-weight: 500;
}

.page-handbook__evo-node-score {
  font-size: 22rpx;
  color: #8899aa;
}

.page-handbook__evo-node-date {
  font-size: 20rpx;
  color: #8899aa;
  opacity: 0.7;
}

// 进化空状态
.page-handbook__evo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 0;
  text-align: center;
}

.page-handbook__evo-empty-icon {
  font-size: 56rpx;
  margin-bottom: 12rpx;
}

.page-handbook__evo-empty-text {
  font-size: 26rpx;
  color: #b0bec5;
  margin-bottom: 16rpx;
  line-height: 1.5;
}

.page-handbook__evo-empty-btn {
  padding: 12rpx 40rpx;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 200, 255, 0.15));
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #c4b5fd;
  line-height: 1.4;

  &::after { border: none; }
}

// ── 筛选栏 ──
.page-handbook__filters {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.page-handbook__filter {
  font-size: 24rpx;
  color: #8899aa;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.06);
  transition: background 0.15s, color 0.15s;

  &--active {
    color: #ffd700;
    background: rgba(255, 215, 0, 0.15);
  }
}

// ── Zone C: 卡片网格 ──
.page-handbook__grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
  padding: 0 24rpx;
}

.page-handbook__card {
  width: calc((100% - 40rpx) / 3);
  min-height: 180rpx;
  border-radius: 16rpx;
  padding: 16rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;

  &--collected {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.2);
  }

  &--uncollected {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  // 稀有度边框光效（未收集卡）
  &--rarity-rare {
    border-color: rgba(66, 165, 245, 0.2);
    box-shadow: 0 0 16rpx rgba(66, 165, 245, 0.06);
  }

  &--rarity-legend {
    border-color: rgba(206, 147, 216, 0.25);
    box-shadow: 0 0 20rpx rgba(206, 147, 216, 0.08);
  }

  &--rarity-limited {
    border-color: rgba(255, 215, 0, 0.25);
    box-shadow: 0 0 20rpx rgba(255, 215, 0, 0.08);
  }
}

.page-handbook__card-lock-glow {
  position: absolute;
  inset: 0;
  opacity: 0.08;
  border-radius: 16rpx;

  &--rare { background: radial-gradient(circle at 50% 30%, #42a5f5, transparent 70%); }
  &--legend { background: radial-gradient(circle at 50% 30%, #ce93d8, transparent 70%); }
  &--limited { background: radial-gradient(circle at 50% 30%, #ffd700, transparent 70%); }
}

.page-handbook__card-rarity {
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  margin-bottom: 8rpx;

  &--common { color: #b0bec5; background: rgba(176, 190, 197, 0.15); }
  &--rare { color: #42a5f5; background: rgba(66, 165, 245, 0.15); }
  &--legend { color: #ce93d8; background: rgba(206, 147, 216, 0.2); }
  &--limited { color: #ffd700; background: rgba(255, 215, 0, 0.15); }
}

.page-handbook__card-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.page-handbook__card-title {
  font-size: 22rpx;
  color: #e0e0e0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.page-handbook__card-mystery {
  font-size: 36rpx;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 6rpx;
  position: relative;
  z-index: 1;
}

.page-handbook__card-clue {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;
  margin-bottom: 8rpx;
  position: relative;
  z-index: 1;
}

.page-handbook__card-unlock-hint {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.25);
  position: relative;
  z-index: 1;
}

// ── 固定底部 CTA ──
.page-handbook__fixed-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx 32rpx 32rpx;
  background: linear-gradient(0deg, rgba(10, 14, 39, 0.98) 60%, rgba(10, 14, 39, 0) 100%);
  z-index: 10;
}

.page-handbook__fixed-cta-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.7), rgba(0, 200, 255, 0.5));
  border: 1px solid rgba(124, 58, 237, 0.5);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(124, 58, 237, 0.25);

  &::after { border: none; }
}

// ── 详情弹窗 ──
.page-handbook__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.page-handbook__detail {
  width: 100%;
  max-height: 75vh;
  background: linear-gradient(180deg, #121834 0%, #0d1b2a 100%);
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx 60rpx;
  overflow-y: auto;
}

.page-handbook__detail-rarity {
  display: inline-block;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;

  &--common { color: #b0bec5; background: rgba(176, 190, 197, 0.15); }
  &--rare { color: #42a5f5; background: rgba(66, 165, 245, 0.15); }
  &--legend { color: #ce93d8; background: rgba(206, 147, 216, 0.2); }
  &--limited { color: #ffd700; background: rgba(255, 215, 0, 0.15); }
}

.page-handbook__detail-emoji {
  display: block;
  font-size: 64rpx;
  margin-bottom: 12rpx;
}

.page-handbook__detail-title {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 16rpx;
}

.page-handbook__detail-hook {
  display: block;
  font-size: 26rpx;
  color: #ffcc80;
  margin-bottom: 16rpx;
  line-height: 1.5;
  word-break: break-all;
  overflow-wrap: break-word;
}

.page-handbook__detail-body {
  display: block;
  font-size: 26rpx;
  color: #b0bec5;
  margin-bottom: 24rpx;
  line-height: 1.7;
  word-break: break-all;
  overflow-wrap: break-word;
}

.page-handbook__detail-tip,
.page-handbook__detail-fact {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.page-handbook__detail-tip-label,
.page-handbook__detail-fact-label {
  display: block;
  font-size: 22rpx;
  color: #8899aa;
  margin-bottom: 8rpx;
}

.page-handbook__detail-tip-text,
.page-handbook__detail-fact-text {
  font-size: 24rpx;
  color: #cfd8dc;
  line-height: 1.6;
  word-break: break-all;
  overflow-wrap: break-word;
}

.page-handbook__detail-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 16rpx;
}

.page-handbook__detail-share {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(0, 200, 255, 0.2));
  border: 1px solid rgba(124, 58, 237, 0.4);
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;

  &::after { border: none; }
}

.page-handbook__detail-share-text {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  color: #b0bec5;
  border-radius: 16rpx;
  font-size: 26rpx;
  border: none;

  &::after { border: none; }
}

.page-handbook__detail-close {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.5);
  border-radius: 16rpx;
  font-size: 26rpx;
  border: none;

  &::after { border: none; }
}

@keyframes star-fade-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
</style>
