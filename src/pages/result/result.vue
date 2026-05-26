<template>
  <view class="page-result">
    <!-- 阶段0：评估中 -->
    <view v-if="stage === 'evaluating'" class="page-result__evaluating">
      <view class="page-result__ripple" />
      <text class="page-result__eval-text">AI 正在评估你的段位…</text>
    </view>

    <!-- 阶段0.5：反转惊喜 -->
    <ReversalReveal
      v-if="stage === 'reversal'"
      :fake-tier="fakeTier"
      :real-tier="result.tier"
      :real-emoji="result.tierEmoji"
      :real-color="tierColor"
      @done="onReversalDone"
    />

    <!-- 阶段1-5：内容揭晓 -->
    <scroll-view v-if="stage === 'revealing'" scroll-y class="page-result__scroll" @scroll="onPageScroll">
      <view class="page-result__content">
        <!-- 段位徽章 + 分数（阶段1） -->
        <view
          class="page-result__section"
          :class="{ 'page-result__fade-in': stageAtLeast('1') }"
          @longpress="saveBadgeToAlbum"
        >
          <TierBadge :tier="result.tier" :score="result.totalScore" size="large" :animated="true" />

          <!-- AI 商数（首屏锚点，类比 IQ/EQ 量表） -->
          <view class="page-result__score">
            <text class="page-result__score-num">{{ displayScore }}</text>
            <text class="page-result__score-label">AI 商数</text>
          </view>
          <text class="page-result__score-context">均值 ≈ 105 · 前 {{ result.percentile }}%</text>

          <!-- 段位名 + 人格名（一行精简） -->
          <view class="page-result__identity">
            <text class="page-result__identity-tier">{{ result.tierEmoji }} {{ result.tier }}</text>
            <text class="page-result__identity-persona">{{ personaEmoji }} {{ personaName }}</text>
          </view>

          <!-- 回访用户：段位变化 -->
          <view v-if="!isFirstTimeTest && tierDeltaText" class="page-result__tier-delta page-result__fade-in">
            <text class="page-result__tier-delta-text">{{ tierDeltaText }}</text>
          </view>

          <!-- L1 CTA：主分享按钮（首屏情绪高点） -->
          <button class="page-result__share-btn" open-type="share" @click="trackShareClick('persona')">
            {{ l1CtaText }}
          </button>
          <text class="page-result__share-hint">将生成专属AI人格卡，分享到群比比谁段位高</text>

          <!-- 进化值获得提示 -->
          <view v-if="showXpGain" class="page-result__xp-gain">
            <text class="page-result__xp-gain-text">+{{ xpGained }} XP 进化值已累积</text>
            <view class="page-result__xp-gain-bar">
              <view class="page-result__xp-gain-fill" :style="{ width: expStore.levelProgress + '%' }" />
            </view>
            <text class="page-result__xp-gain-lv">Lv.{{ expStore.level }} {{ expStore.levelName }}</text>
          </view>

          <view v-if="showScreenshotHint" class="page-result__screenshot-hint">
            <text>截图或长按段位徽章保存</text>
          </view>

          <!-- 进化人格卡详情（首屏以下） -->
          <view class="page-result__section page-result__fade-in" style="animation-delay: 0.15s">
            <view class="page-result__evo-persona">
              <text class="page-result__section-title">你的 AI 进化人格</text>
              <view class="page-result__evo-card">
                <text class="page-result__evo-persona-desc">{{ personaDescription }}</text>
                <view class="page-result__evo-traits">
                  <view class="page-result__evo-trait page-result__evo-trait--strength">
                    <view class="page-result__evo-trait-body">
                      <text class="page-result__evo-trait-label">超能力：{{ strongestDimension?.name || '未知' }}</text>
                      <text class="page-result__evo-trait-hint">{{ strongestDimension?.hint || '这是你最自然的优势领域' }}</text>
                    </view>
                  </view>
                  <view class="page-result__evo-trait page-result__evo-trait--growth">
                    <view class="page-result__evo-trait-body">
                      <text class="page-result__evo-trait-label">进化方向：{{ weakestDimension?.name || '未知' }}</text>
                      <text class="page-result__evo-trait-hint">{{ weakestDimension?.hint || '解锁这里，你将到达新境界' }}</text>
                    </view>
                  </view>
                </view>
                <text v-if="personaRarity" class="page-result__evo-rarity">你的 AI 人格稀有度：前 {{ personaRarity }}% 的测试者属于这个类型</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 超越百分比 + 下一段位（阶段2） -->
        <view v-if="stageAtLeast('2a')" class="page-result__section page-result__fade-in">
          <view class="page-result__percentile">
            <text class="page-result__percentile-num">前 {{ result.percentile }}%</text>
            <text class="page-result__percentile-sub">
              每 100 个 AI 进化者中，只有 {{ result.percentile }} 人达到你的段位
            </text>
          </view>
          <view class="page-result__next-tier">
            <template v-if="result.nextTier">
              距离 <text class="page-result__next-name">{{ result.nextTier }}</text> 还差 <text class="page-result__next-pts">{{ result.pointsToNext }} 分</text>
            </template>
            <template v-else>
              🌊 你已达到最高段位！
            </template>
          </view>
          <!-- P1-C: 差 X 分进度条（≤3分时视觉强化） -->
          <view v-if="nearMissProgress" class="page-result__near-miss">
            <view class="page-result__near-miss-header">
              <text class="page-result__near-miss-icon">⚡</text>
              <text class="page-result__near-miss-text">只差 <text class="page-result__near-miss-pts">{{ result.pointsToNext }} 分</text> 晋升 <text class="page-result__near-miss-tier">{{ result.nextTier }}</text></text>
            </view>
            <view class="page-result__near-miss-bar">
              <view class="page-result__near-miss-fill" :style="{ width: nearMissProgress.percent + '%' }">
                <text class="page-result__near-miss-fill-label">{{ result.tier }}</text>
              </view>
              <text class="page-result__near-miss-gap-label">{{ result.nextTier }}</text>
            </view>
            <text class="page-result__near-miss-sub">再测一次，说不定你就是 {{ result.nextTier }} 了！</text>
          </view>
          <!-- 首次测试：开启进化之旅卡片 -->
          <view v-if="isFirstTimeTest && showJourneyCard" class="page-result__journey-card">
            <text class="page-result__journey-card-title">你的AI进化之旅开始了</text>
            <text class="page-result__journey-card-desc">初始段位已记录 · 每天来测 · 追踪你的AI段位进化</text>
            <view class="page-result__journey-card-actions">
              <button class="page-result__journey-card-btn" @click="setupTomorrowReminder">明天继续进化</button>
            </view>
            <text class="page-result__journey-card-hint">每天测一次，追踪你的AI进化轨迹</text>
          </view>
        </view>

        <!-- v0.9: 进化建议（阶段2） -->
        <view v-if="stageAtLeast('2b') && result.evolutionTip && result.evolutionTip.length > 0" class="page-result__section page-result__fade-in">
          <view class="page-result__evo-tip">
            <text class="page-result__evo-tip-title">想从「{{ result.tier }}」再进一步</text>
            <view v-for="(tip, i) in result.evolutionTip" :key="i" class="page-result__evo-tip-item">
              <text class="page-result__evo-tip-dot">▸</text>
              <text class="page-result__evo-tip-text">{{ tip }}</text>
            </view>
          </view>
        </view>

        <!-- 知识星收集（2b：进化资产） -->
        <view v-if="stageAtLeast('2b')" class="page-result__section page-result__fade-in">
          <view v-if="collectedCards.length > 0 || newCardsCollected.length > 0" class="page-result__star-collection">
            <view class="page-result__star-header">
              <view class="page-result__star-title-row">
                <text class="page-result__star-title">已点亮 {{ collectedCards.length }} 颗知识星</text>
                <text v-if="starRankInFriends > 0" class="page-result__star-rank">好友中第 {{ starRankInFriends }} 名</text>
              </view>
              <text class="page-result__star-handbook-link" @click="goToHandbook">进化手册 →</text>
            </view>
            <view class="page-result__star-grid">
              <text
                v-for="i in 30"
                :key="'s'+i"
                class="page-result__star"
                :class="[
                  i <= collectedCards.length ? 'page-result__star--lit' : ['page-result__star--mystery', 'page-result__star--rarity-' + getStarRarity(i)],
                ]"
                :style="{
                  animationDelay: (i <= collectedCards.length ? i * 0.03 : i * 0.08 + Math.random() * 0.3) + 's',
                  animationDuration: i <= collectedCards.length ? (1.5 + (i % 4) * 0.6) + 's' : getStarShimmerDuration(i),
                }"
              >{{ i <= collectedCards.length ? '★' : '☆' }}</text>
            </view>
            <view v-if="starMilestone" class="page-result__star-milestone">
              <text class="page-result__star-milestone-title">{{ starMilestone.title }}</text>
              <text class="page-result__star-milestone-sub">{{ starMilestone.sub }}</text>
            </view>
            <text v-else-if="collectedCards.length >= 25" class="page-result__star-near-full">接近满星！继续测试解锁更多</text>
            <view v-if="newCardsCollected.length > 0" class="page-result__new-cards">
              <view v-for="card in newCardsCollected" :key="card.id" class="page-result__new-card" :class="'page-result__new-card--' + (card.rarity || 'common')">
                <text class="page-result__new-card-rarity" :class="'page-result__new-card-rarity--' + (card.rarity || 'common')">{{ rarityLabel(card.rarity) }}</text>
                <text class="page-result__new-card-emoji">{{ card.emoji || '📚' }}</text>
                <view class="page-result__new-card-body">
                  <text class="page-result__new-card-title">{{ card.title }}</text>
                  <text class="page-result__new-card-hook">{{ card.hook }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-else class="page-result__star-collection page-result__star-collection--empty">
            <text class="page-result__star-empty-icon">🌌</text>
            <text class="page-result__star-empty-text">星空等待点亮</text>
            <text class="page-result__star-empty-hint">每测一次，必得一颗星 · 共 30 颗等你收集</text>
          </view>
        </view>

        <!-- 操作区（2c：行动引导） -->
        <view v-if="stageAtLeast('2c')" class="page-result__section page-result__fade-in">
          <view class="page-result__actions-block page-result__actions-block--early">
            <view class="page-result__actions">
              <button class="page-result__btn-challenge" @click="challengeFriend">挑战好友</button>
              <view class="page-result__save-row">
                <button class="page-result__btn-poster" @click="saveTierCard">保存段位卡</button>
                <button class="page-result__btn-moments" @click="saveSquareShare">保存朋友圈图</button>
              </view>
            </view>

            <text class="page-result__invite-reward-hint">每邀请 1 位好友完成测试 → +1 次测试机会</text>

            <!-- 头像授权：非阻断式，让段位卡带上个人身份 -->
            <view v-if="showProfilePrompt" class="page-result__profile-prompt" @click="authorizeProfile">
              <text class="page-result__profile-prompt-icon">👤</text>
              <text class="page-result__profile-prompt-text">点击使用微信头像，让好友认出你的段位卡</text>
              <text class="page-result__profile-prompt-arrow">→</text>
            </view>

            <!-- v1.0: 订阅消息 -->
            <view v-if="showSubscribePrompt" class="page-result__subscribe-prompt" @click="requestSubscribe">
              <text class="page-result__subscribe-dot" />
              <text class="page-result__subscribe-text">开启段位变化通知，第一时间知道好友挑战结果</text>
            </view>

            <view v-if="showCollectTip" class="page-result__collect-tip" @click="showCollectTip = false">
              <text>点击右上角 ··· 收藏小程序，每天测测段位变了吗</text>
            </view>
          </view>
        </view>

        <!-- AI锐评（阶段3） -->
        <view v-if="stageNum >= 3" class="page-result__section">
          <AiComment
            :tier-name="result.tier"
            :tier-emoji="result.tierEmoji"
            :tier-color="tierColor"
            :commentary="result.tierCommentary"
          />
        </view>

        <!-- 雷达图 + 成长路径（阶段4） -->
        <view v-if="stageNum >= 4" class="page-result__section page-result__fade-in">
          <!-- P1-D: 答题回顾（可折叠） -->
          <view v-if="answerReviewItems.length > 0" class="page-result__answer-review">
            <view class="page-result__answer-review-header" @click="showAnswerReview = !showAnswerReview">
              <text class="page-result__answer-review-title">{{ showAnswerReview ? '▾' : '▸' }} 查看我的答题解析</text>
              <text class="page-result__answer-review-hint">{{ showAnswerReview ? '点击收起' : '为什么得这个分？' }}</text>
            </view>
            <view v-if="showAnswerReview" class="page-result__answer-review-body">
              <view v-for="(item, i) in answerReviewItems" :key="i" class="page-result__answer-review-item">
                <view class="page-result__answer-review-q">
                  <text class="page-result__answer-review-q-num">Q{{ i + 1 }}</text>
                  <text class="page-result__answer-review-q-stem">{{ item.stem }}</text>
                </view>
                <view class="page-result__answer-review-a">
                  <text class="page-result__answer-review-a-label">你的选择：</text>
                  <text class="page-result__answer-review-a-text">{{ item.userChoice }}</text>
                </view>
                <view class="page-result__answer-review-comment">
                  <text class="page-result__answer-review-comment-text">{{ item.commentary }}</text>
                </view>
              </view>
            </view>
          </view>

          <view v-if="result.radarData" class="page-result__radar-card">
            <text class="page-result__section-title">能力雷达</text>
            <view class="page-result__radar-wrap">
              <RadarChart
                :dimensions="result.radarData.dimensions"
                :values="displayRadarValues"
                :width="280"
                :height="280"
              />
            </view>
            <text class="page-result__radar-hint">雷达值经标准化 · 均值 ≈ 70</text>
          </view>

          <GrowthPath :tier-name="result.tier" :tier-index="tierIndex" />

          <view class="page-result__friend-rank">
            <text class="page-result__section-title">好友排行</text>
            <view v-if="friendMatchText" class="page-result__friend-match">
              <text class="page-result__friend-match-emoji">🧬</text>
              <text class="page-result__friend-match-text">{{ friendMatchText }}</text>
            </view>
            <view v-if="friendComparisonText" class="page-result__friend-compare">
              <text class="page-result__friend-compare-text">{{ friendComparisonText }}</text>
              <button
                v-if="showFriendChallengeBtn"
                class="page-result__friend-compare-btn"
                @click="challengeFriend"
              >不服来战</button>
            </view>
            <view v-if="friendLoaded" class="page-result__friend-list">
              <view v-for="(f, i) in topFriends" :key="f.openid || i" class="page-result__friend-item" :class="{ 'page-result__friend-item--me': f.isMe }">
                <text class="page-result__friend-rank">#{{ i + 1 }}</text>
                <image class="page-result__friend-avatar" :src="f.avatar || defaultAvatar" mode="aspectFill" />
                <text class="page-result__friend-name">{{ f.nickname || '匿名用户' }}</text>
                <text class="page-result__friend-tier">{{ f.tier || '?' }}</text>
              </view>
              <view v-if="topFriends.length === 0" class="page-result__friend-empty">
                <text>暂无好友数据</text>
                <button class="page-result__friend-share-btn" open-type="share">分享给好友，看看他们的段位</button>
              </view>
              <view v-if="myRankInFriends && myRankInFriends > 3" class="page-result__friend-my-rank">
                <text class="page-result__friend-my-rank-dot">···</text>
                <view class="page-result__friend-item page-result__friend-item--me">
                  <text class="page-result__friend-rank">#{{ myRankInFriends }}</text>
                  <image class="page-result__friend-avatar" :src="myAvatar || defaultAvatar" mode="aspectFill" />
                  <text class="page-result__friend-name">我</text>
                  <text class="page-result__friend-tier">{{ result.tier }}</text>
                </view>
              </view>
            </view>
            <view v-else class="page-result__friend-loading">
              <text>加载好友排名中…</text>
            </view>
          </view>
        </view>

        <!-- 回顾：进化之路（阶段4） -->
        <view v-if="stageNum >= 4 && reviewData" class="page-result__section page-result__fade-in">
          <text class="page-result__section-title">你的进化之路</text>
          <view class="page-result__review">
            <view v-for="(h, i) in reviewData.history" :key="i" class="page-result__review-row">
              <text class="page-result__review-date">{{ h.date }}</text>
              <text class="page-result__review-arrow">→</text>
              <text class="page-result__review-tier">{{ h.emoji }} {{ h.tier }}</text>
              <text class="page-result__review-score">({{ h.score }}分)</text>
            </view>
            <view class="page-result__review-change" :class="'page-result__review-change--' + reviewData.change">
              {{ reviewData.changeDetail }}
            </view>
          </view>
        </view>

        <!-- 进化预言书（阶段4） -->
        <view v-if="stageNum >= 4" class="page-result__section page-result__fade-in">

          <!-- 模块1：偷看更高段位的世界 -->
          <view class="page-result__evo-next">
            <text class="page-result__section-title">
              {{ result.nextTier ? '偷看「' + nextTierEmoji + ' ' + result.nextTier + '」的世界' : '你已到达进化终点「无界」' }}
            </text>
            <view class="page-result__evo-card">
              <template v-if="result.nextTier">
                <text class="page-result__evo-next-intro">{{ result.nextTier }} 们现在正在做的事：</text>
                <view class="page-result__evo-next-tips">
                  <text v-for="(tip, i) in evolutionTips" :key="i" class="page-result__evo-next-tip">▸ {{ tip }}</text>
                </view>
                <text class="page-result__evo-next-cta">你距离 {{ result.nextTier }} 只差 {{ result.pointsToNext }} 分，上面几条今天就能试试</text>
              </template>
              <template v-else>
                <text class="page-result__evo-next-intro">作为先行者，你的使命变了：</text>
                <view class="page-result__evo-next-tips">
                  <text class="page-result__evo-next-tip">▸ 帮助更多人找到和 AI 相处的最佳方式</text>
                  <text class="page-result__evo-next-tip">▸ 你的经验本身就是最好的「知识卡」— 分享出去</text>
                </view>
              </template>
            </view>
          </view>

          <!-- 模块2：AI 读心术 -->
          <view v-if="mindReadingInsight" class="page-result__mind-read">
            <text class="page-result__section-title">{{ mindReadingInsight.title }}</text>
            <view class="page-result__mind-read-card" :class="'page-result__mind-read-card--' + mindReadingInsight.flair">
              <template v-if="mindReadingInsight.type === 'perfect'">
                <text class="page-result__mind-read-body">{{ mindReadingInsight.body }}</text>
                <view class="page-result__mind-read-highlight">
                  <text>{{ mindReadingInsight.highlight }}</text>
                </view>
              </template>
              <template v-else>
                <view class="page-result__mind-read-question">
                  <text class="page-result__mind-read-q-emoji">{{ mindReadingInsight.stemEmoji }}</text>
                  <text class="page-result__mind-read-q-stem">"{{ mindReadingInsight.stem }}"</text>
                </view>
                <text class="page-result__mind-read-body">{{ mindReadingInsight.insight }}</text>
                <view class="page-result__mind-read-trait">
                  <text class="page-result__mind-read-trait-label">识别到隐藏特质：</text>
                  <text class="page-result__mind-read-trait-name">{{ mindReadingInsight.trait }}</text>
                </view>
                <view class="page-result__mind-read-highlight">
                  <text>{{ mindReadingInsight.highlight }}</text>
                </view>
              </template>
            </view>
          </view>

          <!-- 模块3：进化湾悄悄话 -->
          <view class="page-result__evo-whisper">
            <text class="page-result__evo-whisper-text">"{{ whisperText }}"</text>
            <text v-if="whisperRarity" class="page-result__evo-whisper-rarity">{{ whisperRarity }}</text>
            <text class="page-result__evo-whisper-sig">—— 进化湾 · AI 进化记录者</text>
          </view>

          <!-- 再测一次（唯一入口） -->
          <view class="page-result__correct">
            <button class="page-result__correct-btn" @click="retryQuiz">再测一次，继续进化</button>
          </view>
        </view>

        <!-- 快速反馈（阶段5） -->
        <view v-if="stageNum >= 5" class="page-result__section page-result__fade-in">
          <view class="page-result__feedback">
            <text class="page-result__feedback-label">这个段位准不准？</text>
            <view class="page-result__feedback-btns">
              <button class="page-result__feedback-btn" @click="submitFeedback(true)">准</button>
              <button class="page-result__feedback-btn" @click="submitFeedback(false)">不准</button>
            </view>
          </view>
        </view>

        <view style="height: 60rpx" />
      </view>
    </scroll-view>

    <!-- 粘性操作栏：2c后始终可见 -->
    <view v-if="stage === 'revealing' && stageAtLeast('2c')" class="page-result__sticky-bar">
      <button class="page-result__sticky-btn page-result__sticky-btn--retry" @click="retryQuiz">
        再测一次
      </button>
      <button class="page-result__sticky-btn page-result__sticky-btn--share" open-type="share" @click="trackShareClick('sticky')">
        {{ stickyShareText }}
      </button>
    </view>

    <TierCard
      ref="tierCardRef"
      canvas-id="tier-card-canvas"
      :tier-name="result.tier"
      :total-score="result.totalScore"
      :percentile="result.percentile"
      :tier-commentary="result.tierCommentary"
      :friend-rank="friendRankData"
      :mini-code-url="miniCodeUrl"
      :user-avatar="userProfile.avatar"
      :user-nickname="userProfile.nickname"
      @generated="onCardGenerated"
      @saved="onCardSaved"
      @shared="onCardShared"
    />

    <TierCard
      ref="personaCardRef"
      canvas-id="persona-card-canvas"
      mode="persona"
      :persona-name="personaName"
      :persona-emoji="personaEmoji"
      :persona-desc="personaDescription"
      :strongest-name="strongestDimension?.name || ''"
      :strongest-hint="strongestDimension?.hint || ''"
      :weakest-name="weakestDimension?.name || ''"
      :weakest-hint="weakestDimension?.hint || ''"
      :persona-rarity="personaRarity"
      :mini-code-url="miniCodeUrl"
      :user-avatar="userProfile.avatar"
      :user-nickname="userProfile.nickname"
      @generated="onPersonaCardGenerated"
      @saved="onCardSaved"
      @shared="onCardShared"
    />

    <ChallengeModal
      :visible="showChallengeModal"
      :my-score="result.totalScore"
      :my-tier="result.tier"
      @close="showChallengeModal = false"
      @challenged="onChallengeSent"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import TierBadge from '@/components/TierBadge/TierBadge.vue';
import RadarChart from '@/components/RadarChart/RadarChart.vue';
import ReversalReveal from '@/components/ReversalReveal/ReversalReveal.vue';
import AiComment from '@/components/AiComment/AiComment.vue';
import GrowthPath from '@/components/GrowthPath/GrowthPath.vue';
import TierCard from '@/components/TierCard/TierCard.vue';

import ChallengeModal from '@/components/ChallengeModal/ChallengeModal.vue';
import { REVERSAL_FAKE_TIERS } from '@/utils/constants.js';
import { getTierColor, getTierIndex, TIERS } from '@/utils/tier.js';
import { getShareTitle } from '@/utils/share-helper.js';
import { generateSquareShareImage } from '@/utils/canvas-renderer.js';
import { fetchFriendRank, fetchWeeklyStats, updateProfile, submitFeedback as submitFeedbackApi, getUserOpenidSync, callCloudFunction, requestSubscribeMessage } from '@/utils/api.js';
import { trackResultView, trackShareClick, trackShareSuccess, trackChallenge, trackQuickFeedback, trackReversalStart, trackReversalEnd, trackResultLinger, trackTestRetry, trackInviteSent, getABVariant } from '@/utils/analytics.js';
import { useQuizStore } from '@/store/quiz.js';
import { useExperienceStore } from '@/store/experience.js';
import { hasUsedFreeTestToday } from '@/utils/ad.js';

const tierCardRef = ref(null);
const personaCardRef = ref(null);
const personaCardUrl = ref('');
const result = ref({ tier: '', tierEmoji: '', totalScore: 0, percentile: 0, nextTier: null, pointsToNext: 0, radarData: null, commentary: [], tierCommentary: '', persona: null });
const stage = ref('evaluating');
const stageNum = ref(0);
const displayScore = ref(0);
const fakeTier = ref('');
const topFriends = ref([]);
const friendLoaded = ref(false);
const generatedCardUrl = ref('');
const showChallengeModal = ref(false);
const reviewData = ref(null);
const showCollectTip = ref(false);
const isFirstTimeTest = ref(false);
const showJourneyCard = ref(false);
const showSubscribePrompt = ref(false);
const showAnswerReview = ref(false);
// 用户头像昵称（非阻断式授权，默认匿名）
const userProfile = ref({ nickname: '', avatar: '' });
const showProfilePrompt = ref(false);
// A5 移除：反转分享引导已合并到 L1 CTA 动态文案
const miniCodeUrl = ref('');
const questions = ref([]);
const myAvatar = ref('');
const myRankInFriends = ref(0);

const defaultAvatar = '/static/icons/default-avatar.png';
let lingerTimer = null;
let resultRevealTime = 0;

const quizStore = useQuizStore();
const expStore = useExperienceStore();
const showScreenshotHint = ref(false);
const showXpGain = ref(false);
const xpGained = ref(0);

// 回访用户段位变化
const tierDeltaText = ref('');
const tierDeltaIcon = ref('');
const lastTierName = ref('');
const lastScore = ref(0);

const tierColor = computed(() => {
  try { return getTierColor(result.value.tier); } catch (e) { return '#7c3aed'; }
});

const tierIndex = computed(() => {
  try { return getTierIndex(result.value.totalScore); } catch (e) { return 0; }
});

const friendRankData = computed(() => {
  if (topFriends.value.length === 0) return null;
  const myScore = result.value.totalScore;
  let rank = 1;
  for (const f of topFriends.value) {
    if (f.score > myScore) rank++;
  }
  return { rank, total: topFriends.value.length + 1 };
});

const friendMatchText = computed(() => {
  const fm = result.value.friendMatch;
  if (!fm || !fm.nickname) return '';
  const pct = fm.matchPercent || 0;
  let vibe = '';
  if (pct >= 90) vibe = '灵魂共鸣';
  else if (pct >= 75) vibe = '高度契合';
  else if (pct >= 60) vibe = '志趣相投';
  else if (pct >= 40) vibe = '求同存异';
  else vibe = '截然不同';
  return `你与 @${fm.nickname} 的 AI 人格匹配度：${pct}%（${vibe}）`;
});

const friendComparisonText = computed(() => {
  const data = friendRankData.value;
  if (!data) return '';
  if (data.rank === 1) return '你暂时领先所有好友！快去炫耀一下 →';

  const firstPlace = topFriends.value[0];
  if (!firstPlace) return '';
  const myTierIdx = tierIndex.value;
  const firstPlaceTierIdx = getTierIndex(firstPlace.score);

  if (myTierIdx >= firstPlaceTierIdx - 1 && firstPlace.score - result.value.totalScore <= 5) {
    return `@${firstPlace.nickname || '好友'} 比你高一段 🤏 差一点点，不服来战？`;
  }

  const sameTierAhead = topFriends.value.find(
    f => getTierIndex(f.score) === myTierIdx && f.score > result.value.totalScore
  );
  if (sameTierAhead) {
    return `@${sameTierAhead.nickname || '好友'} 跟你同段位但高 ${sameTierAhead.score - result.value.totalScore} 分 ⚡ 差一点点！`;
  }

  return `你目前排在好友榜第 ${data.rank} 名，再测一次说不定就上去了`;
});

const showFriendChallengeBtn = computed(() => {
  if (topFriends.value.length === 0) return false;
  const first = topFriends.value[0];
  return first && first.score > result.value.totalScore;
});

// 雷达图显示值：地板抬升，避免"接近零点"的负面视觉（同 AIQ 思路）
const displayRadarValues = computed(() => {
  const raw = result.value.radarData?.values;
  if (!raw || raw.length === 0) return [];
  return raw.map(v => Math.min(100, Math.round(42 + v * 0.58)));
});

const strongestDimension = computed(() => {
  const data = result.value.radarData;
  if (!data || !data.values || data.values.length === 0) return null;
  const maxVal = Math.max(...data.values);
  const idx = data.values.indexOf(maxVal);
  const hints = {
    '信息感知': '你对AI世界的风吹草动格外敏感，总能先人一步发现新工具、新趋势',
    '工具应用': '你擅长把AI变成生产力，工具到你手里总能发挥最大效用',
    '内容辨别': '你有一双火眼金睛，能看穿AI输出中的真伪与偏见',
    '时代心态': '你对AI时代的态度积极开放，这份心态让你走得更远',
    '思维深度': '你思考AI的方式超越了表面应用，能看到更深层的逻辑与影响',
  };
  return { name: data.dimensions[idx], value: maxVal, hint: hints[data.dimensions[idx]] || '' };
});

const weakestDimension = computed(() => {
  const data = result.value.radarData;
  if (!data || !data.values || data.values.length === 0) return null;
  const minVal = Math.min(...data.values);
  const idx = data.values.indexOf(minVal);
  const hints = {
    '信息感知': '多关注AI领域的新动态，这里是你最有潜力的增长空间',
    '工具应用': '试着把AI融入日常工作流，一旦打通会带来巨大提升',
    '内容辨别': '练习对AI输出多追问一句"为什么"，辨别力会快速增长',
    '时代心态': '偶尔停下来想想：AI时代，你最想成为什么样的人？',
    '思维深度': '试着不只问AI"怎么做"，也问问"为什么这样做"',
  };
  return { name: data.dimensions[idx], value: minVal, hint: hints[data.dimensions[idx]] || '' };
});

// AI 读心术：分析答题模式，找出最独特的那个选择
const mindReadingInsight = computed(() => {
  const answers = quizStore.lastAnswers;
  const allQuestions = questions.value;
  if (!answers || answers.length === 0 || !allQuestions || allQuestions.length === 0) return null;

  const analyses = answers.map((ans, idx) => {
    const q = allQuestions[idx];
    if (!q || !q._parsedOptions || !q._parsedOptions.length) return null;
    const scores = q._parsedOptions.map(o => o.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const userOpt = q._parsedOptions[ans.selectedIndex];
    if (!userOpt) return null;
    const bestOpt = q._parsedOptions.find(o => o.score === maxScore);
    return {
      questionIdx: idx,
      stem: q.stem || '',
      emoji: q.emoji || '',
      userScore: ans.score,
      maxScore,
      minScore,
      gap: maxScore - ans.score,
      userOptText: userOpt.text || '',
      bestOptText: bestOpt ? bestOpt.text : '',
      isBest: ans.score === maxScore,
      isWorst: ans.score === minScore,
    };
  }).filter(Boolean);

  if (analyses.length === 0) return null;

  // 找最"独特"的题目：gap 最大
  const sorted = [...analyses].sort((a, b) => b.gap - a.gap);
  const pick = sorted[0];

  // 全部最优解 → 标准答案型
  if (analyses.every(a => a.isBest)) {
    return {
      type: 'perfect',
      title: 'AI 读心术',
      emoji: '🔮',
      body: `${allQuestions.length} 道题全部选择了最优解。AI 认为你是"标准答案型"思考者——你对 AI 的理解已经非常主流和成熟，和大多数 AI 资深用户的直觉一致。`,
      highlight: '这种一致性本身就是一种天赋',
      flair: 'rare',
    };
  }

  // 有独特的答案
  const gap = pick.gap;
  let insight, trait;
  if (pick.isWorst) {
    insight = `在这道题上，你选择了最"非主流"的答案。但这不意味着错——说明你有自己独特的思考框架，不盲从标准答案。`;
    trait = '独立思辨者';
  } else if (gap >= 6) {
    insight = `这道题你的选择和最优解差 ${gap} 分。你看到的东西和别人不一样——在 AI 时代，这种"不同频"恰恰是最稀缺的能力。`;
    trait = '另辟蹊径者';
  } else if (gap >= 3) {
    insight = `这道题上你的视角略有不同。AI 分析发现：你在"实用主义"和"前沿探索"之间有自己的平衡点。`;
    trait = '务实探索者';
  } else {
    insight = `这道题你接近最优解但还是有点不一样。这种微妙的偏差说明你在理性分析之上，还有自己的直觉判断。`;
    trait = '理性直觉派';
  }

  return {
    type: 'divergent',
    title: 'AI 读心术',
    emoji: '🔮',
    stem: pick.stem,
    stemEmoji: pick.emoji,
    userChoice: pick.userOptText,
    insight,
    trait,
    highlight: gap >= 6 ? '只有少数人能触发这条隐藏评价' : '这不是每个人都看得到的评价',
    flair: gap >= 6 ? 'legend' : 'rare',
  };
});

// P1-D: 答题回顾数据 — 每题题干 + 用户选择 + 解析
const answerReviewItems = computed(() => {
  const commentary = result.value.commentary;
  if (!commentary || commentary.length === 0) return [];
  const allQuestions = questions.value;
  const answers = quizStore.lastAnswers;
  if (!answers || answers.length === 0 || !allQuestions || allQuestions.length === 0) return [];

  return answers.map((ans, i) => {
    const q = allQuestions[i];
    if (!q) return null;
    const userOpt = q._parsedOptions ? q._parsedOptions[ans.selectedIndex] : null;
    return {
      stem: q.stem || `题目 ${i + 1}`,
      userChoice: userOpt ? (userOpt.emoji ? `${userOpt.emoji} ${userOpt.text}` : userOpt.text) : `选项 ${ans.selectedIndex + 1}`,
      commentary: commentary[i] || '这道题反映了你的AI认知风格',
    };
  }).filter(Boolean);
});

// 进化人格
const personaDescription = computed(() => {
  const p = result.value.persona;
  if (p && p.description) return p.description;
  const fallbacks = {
    'AI 原住民': '你生来就属于 AI 时代。对新技术充满热情，敢于尝试，愿意投入时间探索 AI 的边界。你的开放心态让你在每个 AI 新浪潮中都能站在前沿。',
    '谨慎的探索者': '你对 AI 充满好奇但保持清醒。不盲从，不抗拒，每一步都走得扎实。这份谨慎在 AI 狂飙的时代恰恰是最稀缺的品质。',
    '激进的AI信徒': '你相信 AI 能改变一切，并且已经在用行动证明。你不怕试错，只怕错过。这股冲劲让你在 AI 工具应用上远超同龄人。',
    '冷酷的理性派': '你不轻易被 AI 的 hype 打动，习惯用数据和逻辑评判一切。在人人都在狂热时，你的冷静是最珍贵的制衡力量。',
    '热血的实践者': '你不满足于"知道"，一定要"做到"。每当学会一个新 AI 用法，你的第一反应是立刻用起来。行动力是你最大的天赋。',
    '佛系的实践者': '你对 AI 的态度松弛而务实——好用就用，不好用就换。这份松弛让你避免了 AI 焦虑，反而能更持久地走下去。',
    '时代的旁观者': '你保持着一种难得的距离感，不急着跳进去，而是先观察。这份审慎让你能看清别人忽视的东西。',
    '传统的守望者': '你尊重经过时间检验的智慧，不轻易被新技术动摇。但你也知道什么时候该拥抱变化——这份平衡感极为珍贵。',
    '均衡的进化者': '你在 AI 使用的各个维度上均衡发展，没有明显短板。这份全面性让你能从容应对各种 AI 场景。',
  };
  return fallbacks[p?.name] || fallbacks['均衡的进化者'];
});

const personaName = computed(() => result.value.persona?.name || '均衡的进化者');
const personaEmoji = computed(() => result.value.persona?.emoji || '⚖️');
const personaRarity = computed(() => result.value.persona?.rarity || '');

const wasReversed = ref(false);

// A3: 动态 L1 CTA — 根据用户状态选择最强分享理由
const l1CtaText = computed(() => {
  if (result.value.pointsToNext === 1) return '让人看看我有多可惜';
  if (personaRarity.value && Number(personaRarity.value) < 20) return '分享我的稀有AI人格';
  return '分享我的进化人格';
});

const stickyShareText = computed(() => {
  if (result.value.pointsToNext === 1) return '晒我的可惜分';
  if (personaRarity.value && Number(personaRarity.value) < 20) return '炫耀稀有段位';
  return '分享段位';
});

const nextTierEmoji = computed(() => {
  if (!result.value.nextTier) return '';
  const tier = TIERS.find(t => t.name === result.value.nextTier);
  return tier ? tier.emoji : '';
});

// P1-C: 差 X 分进度条（≤3分时显示）
const nearMissProgress = computed(() => {
  const pts = result.value.pointsToNext;
  if (!pts || pts > 3 || !result.value.nextTier) return null;
  const currentTier = TIERS.find(t => t.name === result.value.tier);
  const nextTier = TIERS.find(t => t.name === result.value.nextTier);
  if (!currentTier || !nextTier) return null;
  const totalRange = nextTier.min - currentTier.min;
  const filled = result.value.totalScore - currentTier.min;
  return { percent: Math.max(5, Math.round((filled / totalRange) * 100)) };
});

const evolutionTips = computed(() => {
  return result.value.evolutionTip || [];
});

// 进化湾悄悄话：时间敏感的鼓励语
function pickWhisper() {
  const h = new Date().getHours();
  let pool;
  if (h >= 6 && h < 9) {
    pool = [
      '每一个大师都是从萌新开始的。你今天迈出的这一步，比99%的人更有勇气。',
      '清晨的大脑最适合进化。测完这一次，你离下一段位又近了一步。',
      '早安，AI进化者。太阳升起的地方，就是你下一段位的方向。',
    ];
  } else if (h >= 9 && h < 18) {
    pool = [
      '摸鱼时刻，偷偷进化。你现在的每一分积累，都在为未来的AI时代做准备。',
      'AI时代不会等你准备好，但你已经在准备了。这比大多数人都强。',
      '日拱一卒，功不唐捐。每一次测试都在重塑你的AI思维。',
    ];
  } else if (h >= 18 && h < 21) {
    pool = [
      '一天结束，但你对自己的了解又深了一层。这就是进化的意义。',
      '下班后的你还在探索AI的边界，这份好奇心会带你去意想不到的地方。',
      '黄昏是最好的思考时刻。今天你和AI的关系，又近了一步。',
    ];
  } else {
    pool = [
      '夜深了，你还在思考AI的未来。明天早上，进化湾继续陪你探索。',
      '凌晨的思考者最清醒。记住你今天的感觉——这是你在AI世界留下的印记。',
      '城市的灯火渐暗，但你的AI进化之路正亮。晚安，进化者。',
    ];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
const whisperText = ref(pickWhisper());

const whisperRarity = computed(() => {
  const h = new Date().getHours();
  if (h >= 1 && h < 5) return '只有 3% 的进化者在凌晨收到这条悄悄话';
  if (h >= 5 && h < 7) return '只有 8% 的进化者在破晓时分收到这条悄悄话';
  if (h >= 21 && h < 24) return '只有 12% 的进化者在深夜收到这条悄悄话';
  if (h >= 6 && h < 8) return '只有 10% 的进化者在清晨收到这条悄悄话';
  if (h >= 18 && h < 21) return '只有 15% 的进化者在黄昏收到这条悄悄话';
  return '';
});

const collectedCards = ref([]);

// 本次测试获得的新知识卡
const newCardsCollected = computed(() => {
  const cards = result.value.knowledgeCards;
  if (!cards || cards.length === 0) return [];
  return cards.map(c => c.card).filter(c => c && c.id);
});

const STAR_MILESTONES = {
  10: { title: '10颗知识星', sub: '你已经是个AI知识小达人了' },
  15: { title: '15颗星，半程达成', sub: '过半的星图已被你点亮' },
  20: { title: '20颗知识星', sub: '知识星图渐显，进化之路越走越宽' },
  25: { title: '25颗星，接近圆满', sub: '只差最后几颗，你就是星图大师' },
  30: { title: '30颗全收集，星图圆满', sub: '你点亮了整个进化湾的星空' },
};

const starMilestone = computed(() => {
  const count = collectedCards.value.length;
  return STAR_MILESTONES[count] || null;
});

// 星阵稀有度映射（30张知识卡的稀有度顺序）
// 1-18: common, 19-25: rare, 26-28: legend, 29-30: limited
function getStarRarity(i) {
  if (i <= 18) return 'common';
  if (i <= 25) return 'rare';
  if (i <= 28) return 'legend';
  return 'limited';
}

function getStarShimmerDuration(i) {
  const rarity = getStarRarity(i);
  if (rarity === 'rare') return (1.8 + (i % 3) * 0.4) + 's';
  if (rarity === 'legend') return (1.2 + (i % 2) * 0.3) + 's';
  if (rarity === 'limited') return (0.8 + (i % 2) * 0.2) + 's';
  return (2.5 + (i % 3) * 0.5) + 's'; // common: slow
}

function rarityLabel(rarity) {
  const map = { common: '普通', rare: '稀有', legend: '传说', limited: '限时' };
  return map[rarity] || '';
}

function goToHandbook() {
  uni.navigateTo({ url: '/pages/handbook/handbook' });
}

// 自动收集本次测试获得的知识卡
async function autoCollectNewCards() {
  const newCards = newCardsCollected.value;
  if (!newCards || newCards.length === 0) return;
  for (const card of newCards) {
    if (collectedCards.value.includes(card.id)) continue;
    collectedCards.value = [...collectedCards.value, card.id];
    try {
      await callCloudFunction('getWeeklyStats', { action: 'collectCard', cardId: card.id }, { retry: false });
    } catch (e) { /* 静默 */ }
  }
}

onMounted(() => {
  if (quizStore.lastResult) {
    // 防止页面重新挂载时重复播放动画
    if (result.value && result.value.totalScore) return;

    result.value = quizStore.lastResult;
    if (quizStore.lastQuestions) {
      questions.value = quizStore.lastQuestions;
    }
    // 保留 store 数据以防页面重新挂载时丢失
    // 数据会在下次开始新测试时由 store.reset() 清空
    startSequence();
  } else {
    uni.redirectTo({ url: '/pages/index/index' });
    return;
  }

  loadFriendRank();
  loadReview();
  loadMiniCode();
  loadProfile();
});

onBeforeUnmount(() => {
  if (lingerTimer) clearTimeout(lingerTimer);
});

async function loadMiniCode() {
  try {
    const res = await callCloudFunction('getWeeklyStats', { action: 'getMiniCode' }, { retry: false });
    if (res.code === 0 && res.data && res.data.miniCodeUrl) {
      miniCodeUrl.value = res.data.miniCodeUrl;
    }
  } catch (e) { /* 静默失败，段位卡仍可生成 */ }
}

async function loadReview() {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      if (res.data.review) reviewData.value = res.data.review;
      if (res.data.collectedCards) collectedCards.value = res.data.collectedCards;
      if (res.data.nickname) userProfile.value.nickname = res.data.nickname;
      if (res.data.avatar) userProfile.value.avatar = res.data.avatar;
    }
    if (!userProfile.value.nickname) showProfilePrompt.value = true;
  } catch (e) { /* ignore */ }
}

async function loadProfile() {
  try {
    const res = await fetchWeeklyStats();
    if (res.code === 0 && res.data) {
      if (res.data.nickname) userProfile.value.nickname = res.data.nickname;
      if (res.data.avatar) userProfile.value.avatar = res.data.avatar;
    }
    if (!userProfile.value.nickname) showProfilePrompt.value = true;
  } catch (e) { /* ignore */ }
}

function authorizeProfile() {
  uni.getUserProfile({
    desc: '用于在段位卡上展示你的头像和昵称',
    success: (res) => {
      const info = res.userInfo;
      userProfile.value = {
        nickname: info.nickName || '',
        avatar: info.avatarUrl || '',
      };
      showProfilePrompt.value = false;
      updateProfile(info.nickName, info.avatarUrl).catch(() => {});
      uni.showToast({ title: '已设置！段位卡将展示你的头像', icon: 'none', duration: 2000 });
    },
    fail: () => {
      uni.showToast({ title: '可在设置中授权头像昵称', icon: 'none' });
    },
  });
}

const starRankInFriends = ref(0);
const starRankTotal = ref(0);

async function loadFriendRank() {
  const res = await fetchFriendRank();
  if (res.code === 0 && res.data) {
    const allFriends = res.data.friendRankings || [];
    const myOpenid = getUserOpenidSync();
    const myEntry = allFriends.find(f => (f.openid === myOpenid) || f.isMe);
    if (myEntry) {
      myRankInFriends.value = allFriends.indexOf(myEntry) + 1;
    } else if (allFriends.length > 0) {
      // 用户不在列表中，排名在最后
      myRankInFriends.value = allFriends.length + 1;
    }
    topFriends.value = allFriends.slice(0, 3);
    // 获取用户头像
    myAvatar.value = res.data.myAvatar || '';
  }
  friendLoaded.value = true;

  // 异步加载知识星收集排名（不阻塞主排行）
  fetchFriendRank('collectRank').then(collectRes => {
    if (collectRes.code === 0 && collectRes.data) {
      starRankInFriends.value = collectRes.data.myRank || 0;
      starRankTotal.value = collectRes.data.total || 0;
    }
  }).catch(() => {});
}

function computeTierDelta() {
  const prevTier = uni.getStorageSync('last_tier_name');
  const prevScore = Number(uni.getStorageSync('last_score') || 0);
  if (!prevTier) return;
  lastTierName.value = prevTier;
  lastScore.value = prevScore;
  const currTierIdx = getTierIndex(result.value.totalScore);
  const prevTierObj = TIERS.find(t => t.name === prevTier);
  const prevTierIdx = prevTierObj ? getTierIndex(prevTierObj.minScore) : -1;
  if (prevTierIdx < 0) return;
  if (currTierIdx > prevTierIdx) {
    tierDeltaText.value = `已从「${prevTier}」晋升至「${result.value.tier}」`;
  } else if (currTierIdx < prevTierIdx) {
    tierDeltaText.value = `段位有波动，继续加油回到「${prevTier}」`;
  } else if (result.value.totalScore > prevScore) {
    tierDeltaText.value = `「${result.value.tier}」段位内分数提升 +${result.value.totalScore - prevScore} 分`;
  } else if (result.value.totalScore === prevScore) {
    tierDeltaText.value = `「${result.value.tier}」段位稳固，再测一次突破`;
  } else {
    tierDeltaText.value = `仍是「${result.value.tier}」，试试换个思路答题`;
  }
  // 保存本次结果供下次对比
  uni.setStorageSync('last_tier_name', result.value.tier);
  uni.setStorageSync('last_score', result.value.totalScore);
}

// 答题模式分析：检查是否存在"反转"特征（高分低分差距大、答对难题却答错简单题等）
function hasReversalAnswerPattern() {
  const answers = quizStore.lastAnswers;
  if (!answers || answers.length < 3) return false;

  const scores = answers.map(a => a.score).filter(s => s !== undefined && s !== null);
  if (scores.length < 3) return false;

  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min;

  // 模式1：分数极差大（>= 7），说明用户在不同题目间表现差异大
  if (range >= 7) return true;

  // 模式2：同时有满分和不及格题目
  const hasPerfect = scores.some(s => s >= 9);
  const hasLow = scores.some(s => s <= 3);
  if (hasPerfect && hasLow) return true;

  // 模式3：中等题得分低但难题得分高（逆直觉模式）
  if (answers.length >= 5) {
    const midQuestions = answers.filter((_, i) => i === 1 || i === 2); // Q2, Q3
    const hardQuestions = answers.filter((_, i) => i === 3 || i === 4); // Q4, Q5
    const midAvg = midQuestions.length > 0
      ? midQuestions.reduce((s, a) => s + (a.score || 0), 0) / midQuestions.length
      : 0;
    const hardAvg = hardQuestions.length > 0
      ? hardQuestions.reduce((s, a) => s + (a.score || 0), 0) / hardQuestions.length
      : 0;
    if (hardAvg > midAvg && hardAvg - midAvg >= 4) return true;
  }

  return false;
}

function startSequence() {
  setTimeout(() => {
    const isFirstTime = !uni.getStorageSync('has_tested');
    isFirstTimeTest.value = isFirstTime;

    // 回访用户：检查是否需要反转
    let shouldReverse = isFirstTime;
    let reversalFakeTier = '';
    if (!isFirstTime) {
      computeTierDelta();
      const prevTier = lastTierName.value;
      const prevScore = lastScore.value;
      const currTierIdx = getTierIndex(result.value.totalScore);
      const prevTierObj = TIERS.find(t => t.name === prevTier);
      const prevTierIdx = prevTierObj ? getTierIndex(prevTierObj.minScore) : -1;
      const scoreImproved = result.value.totalScore - prevScore >= 5;

      if (prevTierIdx >= 0 && currTierIdx > prevTierIdx) {
        // 段位晋升 → 反转
        shouldReverse = true;
        reversalFakeTier = prevTier;
      } else if (scoreImproved) {
        // 分数显著提升（同段位内）→ 反转：用映射表确保假段位 ≠ 真段位
        shouldReverse = true;
        reversalFakeTier = REVERSAL_FAKE_TIERS[result.value.tier] || '系统错误 ⚠️';
      } else if (hasReversalAnswerPattern()) {
        // 答题模式分析：高分题目和低分题目差距大 / 高信心答错 → 反转
        shouldReverse = true;
        reversalFakeTier = REVERSAL_FAKE_TIERS[result.value.tier] || '系统错误 ⚠️';
      }
    }

    if (shouldReverse) {
      wasReversed.value = true;
      stage.value = 'reversal';
      fakeTier.value = isFirstTime
        ? (REVERSAL_FAKE_TIERS[result.value.tier] || '系统错误 ⚠️')
        : reversalFakeTier;
      if (isFirstTime) {
        uni.setStorageSync('has_tested', true);
        showCollectTip.value = true;
      }
      uni.setStorageSync('last_tier_name', result.value.tier);
      uni.setStorageSync('last_score', result.value.totalScore);
      trackReversalStart(fakeTier.value, result.value.tier);
      trackResultView(result.value.tier, tierIndex.value, isFirstTime);
    } else {
      stage.value = 'revealing';
      stageNum.value = 1;
      animateScore();
      showXpAnimation();
      scheduleStages();
      setTimeout(() => { showScreenshotHint.value = true; }, 1000);
      setTimeout(() => { showScreenshotHint.value = false; }, 4500);
      // 自动生成人格卡（2s后，供分享使用）
      setTimeout(() => {
        if (personaCardRef.value && !personaCardUrl.value) {
          personaCardRef.value.generate();
        }
      }, 2000);
      uni.setStorageSync('last_tier_name', result.value.tier);
      uni.setStorageSync('last_score', result.value.totalScore);
      trackResultView(result.value.tier, tierIndex.value, false);
    }
    resultRevealTime = Date.now();
    lingerTimer = setTimeout(() => {
      trackResultLinger(10000, tierIndex.value);
    }, 10000);
  }, 400);
}

function onReversalDone() {
  stage.value = 'revealing';
  stageNum.value = 1;
  animateScore();
  showXpAnimation();
  scheduleStages();
  setTimeout(() => { showScreenshotHint.value = true; }, 1000);
  setTimeout(() => { showScreenshotHint.value = false; }, 4500);
  // 仅首次测试展示进化之旅引导卡片
  if (isFirstTimeTest.value) {
    setTimeout(() => { showJourneyCard.value = true; }, 1500);
  }
  setTimeout(() => { autoCollectNewCards(); }, 1200);
  // 自动生成人格卡（2s后，供分享使用）
  setTimeout(() => {
    if (personaCardRef.value && !personaCardUrl.value) {
      personaCardRef.value.generate();
    }
  }, 2000);
  trackReversalEnd(result.value.tier);
}

function showXpAnimation() {
  xpGained.value = expStore.getLastGain() || expStore.getExpForAction('test');
  // 如果之前的 gain 为 0，确保显示测试的基本经验值
  if (xpGained.value === 0) xpGained.value = 10;
  showXpGain.value = true;
  setTimeout(() => { showXpGain.value = false; }, 3000);
}

const STAGE_ORDER = ['1', '2a', '2b', '2c', '3', '4', '5'];

function stageAtLeast(threshold) {
  const current = String(stageNum.value);
  const currentIdx = STAGE_ORDER.indexOf(current);
  const thresholdIdx = STAGE_ORDER.indexOf(threshold);
  if (currentIdx === -1) return false;
  return currentIdx >= thresholdIdx;
}

function scheduleStages() {
  // 第一呼吸（1.5s）：成就与行动 — 百分位 + 下一段位 + 差一分 + 进化建议 + 知识星 + 操作按钮
  // 直接跳到 '2c' 使 2a/2b/2c 同时出现，一个画面获得完整情境理解
  setTimeout(() => { stageNum.value = '2c'; }, 1500);
  // 第二呼吸（3.5s）：深层分析 — AI锐评 + 雷达图 + 好友排行 + 成长路径 + 读心术 + 悄悄话
  setTimeout(() => { stageNum.value = 4; }, 3500);
  // 第三呼吸（6.0s）：反馈闭合
  setTimeout(() => { stageNum.value = 5; }, 6000);
  // 第一呼吸后 300ms 展示订阅消息入口
  setTimeout(() => { showSubscribePrompt.value = true; }, 1800);
  // 第一呼吸后 200ms 自动收集知识卡
  setTimeout(() => { autoCollectNewCards(); }, 1700);
}

function animateScore() {
  const raw = result.value.totalScore;
  const target = Math.round((raw / 50) * 80 + 70);
  let current = 0;
  const duration = 800;
  const step = Math.max(1, Math.floor(target / 30));
  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    displayScore.value = current;
  }, duration / (target / step));
}

function saveTierCard() { if (tierCardRef.value) tierCardRef.value.generate(); }

async function saveSquareShare() {
  uni.showToast({ title: '正在生成朋友圈分享图…', icon: 'loading' });
  try {
    const imagePath = await generateSquareShareImage({
      tierName: result.value.tier,
      tierEmoji: result.value.tierEmoji,
      totalScore: result.value.totalScore,
      percentile: result.value.percentile,
      personaName: personaName.value,
      personaEmoji: personaEmoji.value,
      commentary: result.value.tierCommentary,
      collectCount: collectedCards.value.length,
      collectHighlight: starMilestone.value ? starMilestone.value.title : '',
      miniCodeUrl: miniCodeUrl.value,
      userAvatar: userProfile.value.avatar,
      userNickname: userProfile.value.nickname,
    });
    if (imagePath && typeof wx !== 'undefined' && wx.saveImageToPhotosAlbum) {
      wx.saveImageToPhotosAlbum({
        filePath: imagePath,
        success: () => {
          uni.showToast({ title: '已保存到相册，朋友圈发起来！', icon: 'success' });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            uni.showModal({
              title: '需要相册权限',
              content: '请在设置中允许小程序保存图片到相册',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm && wx.openSetting) wx.openSetting();
              },
            });
          } else {
            uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' });
          }
        },
      });
    }
  } catch (e) {
    console.error('[result] saveSquareShare failed:', e);
    uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' });
  }
}

function onCardGenerated(imagePath) { generatedCardUrl.value = imagePath; }
function onPersonaCardGenerated(imagePath) { personaCardUrl.value = imagePath; }
function onCardSaved(imagePath) { trackShareSuccess(result.value.tier, 'save'); expStore.addExp('share'); }
function onCardShared({ tierName, shareStyle, channel }) { trackShareSuccess(tierName, channel); expStore.addExp('share'); }
function challengeFriend() { showChallengeModal.value = true; }

async function saveBadgeToAlbum() {
  // 确保有一张已生成的段位卡（静默生成，不弹预览）
  if (!generatedCardUrl.value && tierCardRef.value) {
    uni.showToast({ title: '正在生成段位卡…', icon: 'loading' });
    await tierCardRef.value.generate(false);
  }
  const imagePath = generatedCardUrl.value;
  if (!imagePath) {
    uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' });
    return;
  }
  // 保存到相册
  if (typeof wx !== 'undefined' && wx.saveImageToPhotosAlbum) {
    wx.saveImageToPhotosAlbum({
      filePath: imagePath,
      success: () => {
        uni.showToast({ title: '已保存到相册，朋友圈发起来！', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          uni.showModal({
            title: '需要相册权限',
            content: '请在设置中允许小程序保存图片到相册',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm && wx.openSetting) wx.openSetting();
            },
          });
        } else {
          uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' });
        }
      },
    });
  } else {
    uni.showToast({ title: '请截图保存段位卡', icon: 'none' });
  }
}

function onChallengeSent({ targetOpenid, challengeId }) { trackChallenge(targetOpenid); uni.showToast({ title: '挑战已发送！', icon: 'success' }); }
function retryQuiz() {
  const timeSinceLast = resultRevealTime ? Date.now() - resultRevealTime : 0;
  trackTestRetry(result.value.tier, timeSinceLast, 'free');
  uni.removeStorageSync('quiz_breakpoint');

  const quizStoreHook = useQuizStore();
  quizStoreHook.reset();

  // 有免费测试机会 → 直接进答题页，跳过首页广告门控
  if (!hasUsedFreeTestToday()) {
    uni.redirectTo({ url: '/pages/quiz/quiz' });
    return;
  }

  // 需要广告 → 回首页走完整门控
  uni.redirectTo({ url: '/pages/index/index' });
}

// P1-E: 首次用户"明天继续进化" — 建立 habit loop
function setupTomorrowReminder() {
  showJourneyCard.value = false;
  // 记录签到意图
  uni.setStorageSync('tomorrow_reminder', Date.now());
  // 引导收藏
  showCollectTip.value = true;
  uni.showToast({ title: '已记录！明天来测，追踪进化轨迹 🌱', icon: 'none', duration: 2500 });
}

let exitIntentFired = false;

function onPageScroll(e) {
  if (exitIntentFired || showCollectTip.value) return;
  const { scrollTop, scrollHeight } = e.detail;
  if (!scrollHeight) return;
  if (scrollTop / scrollHeight > 0.7) {
    exitIntentFired = true;
    showCollectTip.value = true;
  }
}

// A6 移除：反馈后分享引导已移除

function submitFeedback(isAccurate) {
  trackQuickFeedback(isAccurate, result.value.tier);
  submitFeedbackApi(null, isAccurate);
  uni.showToast({ title: isAccurate ? '感谢认可！' : '感谢反馈，我们持续优化', icon: 'none' });
}

async function requestSubscribe() {
  await requestSubscribeMessage(['challengeNotify', 'tierChange']);
  uni.showToast({ title: '设置成功！', icon: 'success' });
  showSubscribePrompt.value = false;
}

onShareAppMessage(() => {
  const tierName = result.value.tier || '神秘段位';
  const variant = getABVariant();
  const style = variant === 'A' ? 'showoff' : 'selfmock';
  trackShareClick(tierName, style);

  let title;
  // "差一分"戏剧化分享 — 优先级最高
  if (result.value.pointsToNext === 1 && result.value.nextTier) {
    const diffOneCopies = [
      `就差1分！我离${result.value.nextTier}只差1分，卡得我难受…你测测看？`,
      `1分！只差1分我就是${result.value.nextTier}了！你也来试试运气？`,
      `${result.value.tier}→${result.value.nextTier}只差1分！你敢来测吗？`,
    ];
    title = diffOneCopies[Math.floor(Math.random() * diffOneCopies.length)];
  } else if (wasReversed.value) {
    const reversedCopies = [
      `差点以为我是AI小白…结果测出来是「${result.value.tier}」！你也来测？`,
      `被AI忽悠了2秒，我的真实段位是「${result.value.tier}」，来测测你的？`,
      `反转了！我不是AI小白，我是「${result.value.tier}」。敢来测吗？`,
    ];
    title = reversedCopies[Math.floor(Math.random() * reversedCopies.length)];
  } else if (mindReadingInsight.value && mindReadingInsight.value.trait) {
    const trait = mindReadingInsight.value.trait;
    const mindReadCopies = [
      `我的AI隐藏特质是「${trait}」— 测测你的是什么？`,
      `AI说我是「${trait}」，你的隐藏特质是什么？来测！`,
      `「${trait}」是我测出来的AI隐藏特质，你也来测一个？`,
    ];
    title = mindReadCopies[Math.floor(Math.random() * mindReadCopies.length)];
  } else {
    title = getShareTitle(tierIndex.value, style, {
      score: result.value.totalScore,
      persona: result.value.persona ? result.value.persona.name : '',
    });
  }

  // 有昵称时带上身份标识，无昵称时保持匿名文案
  const nickPrefix = userProfile.value.nickname
    ? (title.includes(userProfile.value.nickname) ? '' : `${userProfile.value.nickname} `)
    : '';
  const cardCount = collectedCards.value.length;
  const finalTitle = cardCount > 0 ? `${nickPrefix}${title} | 我已收集${cardCount}颗知识星` : `${nickPrefix}${title}`;

  expStore.addExp('share');
  const shareGain = expStore.getLastGain();
  setTimeout(() => {
    if (shareGain > 0) {
      const tier = result.value.tier || '神秘';
      const pts = result.value.pointsToNext;
      const toastTitle = pts === 1
        ? `已分享！让好友看看你有多可惜 😏`
        : `已分享！等好友来挑战你的「${tier}」段位 ⚡`;
      uni.showToast({ title: toastTitle, icon: 'none', duration: 2000 });
    }
  }, 1200);

  const uid = getUserOpenidSync();
  let path = uid ? `/pages/index/index?from_uid=${uid}` : '/pages/index/index';
  // C2: 反转用户分享路径追加 reversal 参数
  if (wasReversed.value) {
    path += '&reversal=1';
  }
  // 分享图优先用人格卡（最高社交货币），其次段位卡
  const shareImage = personaCardUrl.value || generatedCardUrl.value || '/static/images/default-share.png';
  return {
    title: finalTitle,
    path,
    imageUrl: shareImage,
  };
});

onShareTimeline(() => {
  const tierName = result.value.tier || '神秘段位';
  const uid = getUserOpenidSync();
  const shareImage = personaCardUrl.value || generatedCardUrl.value || '';
  const nick = userProfile.value.nickname;
  const title = nick
    ? `${nick} 是AI「${tierName}」！你也来测测你的AI段位？`
    : `我是AI「${tierName}」！你也来测测你的AI段位？`;
  return {
    title,
    query: uid ? `from_uid=${uid}` : '',
    imageUrl: shareImage || undefined,
  };
});
</script>

<style scoped lang="scss">
.page-result {
  min-height: 100vh;
  background: $color-bg-primary;

  &__evaluating {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  &__ripple {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(124, 58, 237, 0.3);
    animation: ripple-pulse 1.5s ease-out infinite;
  }

  &__eval-text {
    margin-top: 40rpx;
    font-size: 28rpx;
    color: $color-text-secondary;
    animation: text-blink 1.5s ease-in-out infinite;
  }

  &__scroll {
    height: 100vh;
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32rpx 32rpx 0;
  }

  &__section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__section-title {
    font-size: 26rpx;
    color: $color-text-secondary;
    margin-bottom: 16rpx;
    text-align: center;
    align-self: center;
  }

  &__score {
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin-top: 12rpx;

    &-num {
      font-size: 96rpx;
      font-weight: bold;
      color: $color-gold;
      line-height: 1;
    }

    &-label {
      font-size: 28rpx;
      color: $color-gold;
      margin-left: 8rpx;
      opacity: 0.85;
    }
  }

  &__score-context {
    display: block;
    margin-top: 8rpx;
    font-size: 22rpx;
    color: $color-text-secondary;
    text-align: center;
  }

  // 段位名 + 人格名（一行精简）
  &__identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
    margin-top: 10rpx;

    &-tier {
      font-size: 32rpx;
      font-weight: bold;
      color: #fff;
    }

    &-persona {
      font-size: 26rpx;
      color: $color-text-secondary;
    }
  }

  // L1 主分享按钮
  &__share-btn {
    width: 480rpx;
    height: 96rpx;
    line-height: 96rpx;
    margin: 28rpx auto 0;
    border-radius: 48rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #fff;
    text-align: center;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border: none;
    box-shadow: 0 6rpx 28rpx rgba(124, 58, 237, 0.45);
    animation: share-pulse 2s ease-in-out infinite;

    &:active { transform: scale(0.97); }
  }

  &__share-hint {
    display: block;
    margin-top: 16rpx;
    font-size: 22rpx;
    color: $color-text-muted;
    text-align: center;
    opacity: 0.7;
  }

  &__percentile {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 24rpx;

    &-num {
      font-size: 48rpx;
      font-weight: bold;
      color: $color-accent;
    }

    &-sub {
      font-size: 24rpx;
      color: $color-text-secondary;
      margin-top: 4rpx;
    }
  }

  &__next-tier {
    margin-top: 16rpx;
    padding: 12rpx 32rpx;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 24rpx;
    font-size: 24rpx;
    color: $color-text-secondary;
    text-align: center;
  }

  &__next-name,
  &__next-pts {
    color: $color-gold;
    font-weight: bold;
  }

  // P1-C: 差 X 分进度条（≤3分时视觉强化）
  &__near-miss {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20rpx;
    padding: 16rpx 28rpx;
    background: rgba(245, 158, 11, 0.08);
    border: 1rpx solid rgba(245, 158, 11, 0.25);
    border-radius: 16rpx;
    width: 100%;
    max-width: 500rpx;

    &-header {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-bottom: 12rpx;
    }

    &-icon {
      font-size: 32rpx;
    }

    &-text {
      font-size: 26rpx;
      color: $color-gold;
      text-align: center;
    }

    &-pts {
      font-size: 32rpx;
      font-weight: bold;
      color: #ff9800;
    }

    &-tier {
      font-weight: bold;
      color: $color-gold;
    }

    &-bar {
      width: 100%;
      height: 32rpx;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16rpx;
      overflow: hidden;
      display: flex;
      align-items: center;
      position: relative;
    }

    &-fill {
      height: 100%;
      background: linear-gradient(90deg, #f9a825, #ff9800, #ffb74d);
      border-radius: 16rpx;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding-left: 12rpx;
      min-width: 0;
      transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
      animation: near-miss-glow 2s ease-in-out infinite;
    }

    &-fill-label {
      font-size: 20rpx;
      color: #fff;
      font-weight: bold;
      white-space: nowrap;
    }

    &-gap-label {
      position: absolute;
      right: 10rpx;
      font-size: 20rpx;
      color: $color-text-secondary;
    }

    &-sub {
      font-size: 22rpx;
      color: $color-text-secondary;
      margin-top: 10rpx;
    }
  }

  // P1-D: 答题回顾（可折叠）
  &__answer-review {
    width: 100%;
    margin-bottom: 24rpx;
    background: rgba(255, 255, 255, 0.03);
    border: 1rpx solid rgba(255, 255, 255, 0.06);
    border-radius: 20rpx;
    overflow: hidden;

    &-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20rpx 24rpx;
      cursor: pointer;
    }

    &-title {
      font-size: 26rpx;
      color: $color-text-primary;
      font-weight: 500;
    }

    &-hint {
      font-size: 22rpx;
      color: $color-text-secondary;
    }

    &-body {
      padding: 0 24rpx 20rpx;
    }

    &-item {
      padding: 16rpx 0;
      border-top: 1rpx solid rgba(255, 255, 255, 0.06);

      &:first-child {
        border-top: none;
      }
    }

    &-q {
      display: flex;
      align-items: flex-start;
      gap: 8rpx;
      margin-bottom: 8rpx;

      &-num {
        font-size: 22rpx;
        color: $color-text-secondary;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 2rpx;
      }

      &-stem {
        font-size: 24rpx;
        color: $color-text-primary;
        line-height: 1.5;
      }
    }

    &-a {
      display: flex;
      align-items: center;
      gap: 6rpx;
      margin-bottom: 8rpx;
      padding-left: 28rpx;

      &-label {
        font-size: 22rpx;
        color: $color-text-secondary;
        flex-shrink: 0;
      }

      &-text {
        font-size: 24rpx;
        color: $color-gold;
      }
    }

    &-comment {
      padding-left: 28rpx;

      &-text {
        font-size: 22rpx;
        color: $color-text-secondary;
        line-height: 1.5;
        font-style: italic;
      }
    }
  }

  &__radar-card {
    width: 100%;
    padding: 24rpx 20rpx;
    margin-top: 24rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 20rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  &__radar-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 12rpx;
    overflow: hidden;
  }

  &__radar-hint {
    display: block;
    margin-top: 12rpx;
    font-size: 20rpx;
    color: $color-text-muted;
    text-align: center;
    opacity: 0.7;
  }

  &__friend-rank {
    width: 100%;
    margin-top: 32rpx;
  }

  &__friend-match {
    width: 100%;
    margin-bottom: 12rpx;
    padding: 14rpx 20rpx;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 12rpx;
    border: 1rpx solid rgba(124, 58, 237, 0.15);
    display: flex;
    align-items: center;
    gap: 10rpx;
    animation: fade-in 0.4s ease-out both;

    &-emoji {
      font-size: 32rpx;
      flex-shrink: 0;
    }

    &-text {
      flex: 1;
      font-size: 24rpx;
      color: #c4b5fd;
      line-height: 1.5;
    }
  }

  &__friend-compare {
    width: 100%;
    margin-bottom: 16rpx;
    padding: 14rpx 20rpx;
    background: rgba(245, 158, 11, 0.08);
    border-radius: 12rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.15);
    display: flex;
    align-items: center;
    gap: 16rpx;
    animation: fade-in 0.4s ease-out both;

    &-text {
      flex: 1;
      font-size: 24rpx;
      color: $color-gold;
      line-height: 1.5;
    }

    &-btn {
      flex-shrink: 0;
      padding: 10rpx 24rpx;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      border-radius: 20rpx;
      font-size: 22rpx;
      font-weight: 600;
      color: #fff;
      border: none;
      min-height: 88rpx;
      display: flex;
      align-items: center;
    }
  }

  &__friend-list {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__friend-item {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding: 14rpx 18rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12rpx;

    &--me {
      background: rgba(124, 58, 237, 0.1);
      border: 1rpx solid rgba(124, 58, 237, 0.2);
    }
  }

  &__friend-rank {
    font-size: 26rpx;
    font-weight: bold;
    color: $color-gold;
    width: 50rpx;
  }

  &__friend-avatar {
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }

  &__friend-name {
    flex: 1;
    font-size: 26rpx;
    color: $color-text-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__friend-tier {
    font-size: 24rpx;
    color: $color-accent;
    font-weight: 500;
  }

  &__friend-empty,
  &__friend-loading {
    padding: 28rpx;
    text-align: center;
    font-size: 24rpx;
    color: $color-text-muted;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16rpx;
  }

  &__friend-share-btn {
    padding: 24rpx 40rpx;
    background: linear-gradient(135deg, #00c8ff, #7c3aed);
    border-radius: 44rpx;
    font-size: 28rpx;
    color: #fff;
    border: none;
    font-weight: 500;
    min-height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__friend-my-rank {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__friend-my-rank-dot {
    font-size: 24rpx;
    color: $color-text-muted;
    padding: 6rpx 0;
    letter-spacing: 4rpx;
  }

  &__review {
    width: 100%;
    padding: 20rpx 24rpx;
    background: rgba(124, 58, 237, 0.06);
    border-radius: 14rpx;
    border: 1rpx solid rgba(124, 58, 237, 0.1);
  }

  &__review-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding: 8rpx 0;
  }

  &__review-date {
    font-size: 24rpx;
    color: $color-text-muted;
    width: 100rpx;
  }

  &__review-arrow {
    font-size: 22rpx;
    color: $color-accent;
    flex-shrink: 0;
  }

  &__review-tier {
    font-size: 24rpx;
    color: $color-text-primary;
    font-weight: 500;
  }

  &__review-score {
    font-size: 24rpx;
    color: $color-gold;
  }

  &__review-change {
    margin-top: 12rpx;
    padding: 10rpx 18rpx;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8rpx;
    font-size: 26rpx;
    text-align: center;
    font-weight: 500;

    &--up { color: #4caf50; }
    &--down { color: #ff6b6b; }
    &--same { color: $color-text-secondary; }
  }

  &__correct {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    margin-top: 24rpx;
    padding: 20rpx;
    background: rgba(124, 58, 237, 0.04);
    border-radius: 14rpx;
    border: 1rpx dashed rgba(124, 58, 237, 0.15);
  }

  &__correct-btn {
    padding: 24rpx 36rpx;
    border-radius: 44rpx;
    font-size: 28rpx;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: none;
    min-height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__feedback {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    margin-top: 8rpx;

    &-label {
      font-size: 24rpx;
      color: $color-text-secondary;
    }

    &-btns {
      display: flex;
      gap: 12rpx;
    }

    &-btn {
      padding: 8rpx 24rpx;
      border-radius: 16rpx;
      font-size: 22rpx;
      color: $color-text-secondary;
      background: rgba(255, 255, 255, 0.06);
      border: 1rpx solid rgba(255, 255, 255, 0.1);

      &:active {
        background: rgba(124, 58, 237, 0.15);
      }
    }

    &-share {
      display: flex;
      align-items: center;
      gap: 16rpx;
      margin-top: 16rpx;
      padding: 16rpx 20rpx;
      background: rgba(124, 58, 237, 0.08);
      border: 1rpx solid rgba(124, 58, 237, 0.2);
      border-radius: 14rpx;
      animation: fade-in 0.4s ease-out both;

      &-text {
        flex: 1;
        font-size: 22rpx;
        color: $color-text-secondary;
        line-height: 1.4;
      }

      &-btn {
        flex-shrink: 0;
        padding: 12rpx 24rpx;
        background: linear-gradient(135deg, #7c3aed, #f59e0b);
        border-radius: 24rpx;
        font-size: 24rpx;
        font-weight: 600;
        color: #fff;
        border: none;
        min-height: 88rpx;
        display: flex;
        align-items: center;
      }
    }
  }

  &__actions-block {
    width: 100%;
    margin-top: 40rpx;
    padding: 32rpx 24rpx 24rpx;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 24rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 18rpx;

    &--early {
      margin-top: 24rpx;
      background: rgba(124, 58, 237, 0.06);
      border-color: rgba(124, 58, 237, 0.15);
    }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__save-row {
    display: flex;
    gap: 16rpx;
  }

  &__btn-challenge {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border-radius: 44rpx;
    font-size: 28rpx;
    font-weight: bold;
    color: #fff;
    border: none;
    text-align: center;

    &:active { transform: scale(0.97); }
  }

  &__btn-poster {
    flex: 1;
    height: 72rpx;
    line-height: 72rpx;
    background: rgba(124, 58, 237, 0.12);
    border: 1rpx solid rgba(124, 58, 237, 0.25);
    border-radius: 36rpx;
    font-size: 24rpx;
    color: #a78bfa;
    text-align: center;

    &:active { background: rgba(124, 58, 237, 0.2); }
  }

  &__btn-moments {
    flex: 1;
    height: 72rpx;
    line-height: 72rpx;
    background: rgba(245, 158, 11, 0.1);
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 36rpx;
    font-size: 24rpx;
    color: #ffb74d;
    text-align: center;

    &:active { background: rgba(245, 158, 11, 0.2); }
  }

  &__invite-reward-hint {
    font-size: 22rpx;
    color: $color-gold;
    text-align: center;
    margin-top: 4rpx;
    opacity: 0.8;
  }

  // 回访用户段位变化
  &__tier-delta {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: 12rpx;
    padding: 10rpx 24rpx;
    background: rgba(124, 58, 237, 0.1);
    border: 1rpx solid rgba(124, 58, 237, 0.2);
    border-radius: 20rpx;
    animation: fade-in 0.4s ease-out both;

    &-icon { font-size: 28rpx; }
    &-text { font-size: 24rpx; color: #c4b5fd; font-weight: 500; }
  }

  &__screenshot-hint {
    margin-top: 16rpx;
    padding: 12rpx 28rpx;
    background: rgba(0, 0, 0, 0.7);
    border: 1rpx solid $color-gold;
    border-radius: 24rpx;
    font-size: 24rpx;
    color: $color-gold;
    animation: screenshot-hint-in 0.5s ease-out, screenshot-hint-out 0.5s ease-in 4s forwards;
  }

  // v0.9: 进化值获得提示
  &__xp-gain {
    margin-top: 20rpx;
    padding: 16rpx 28rpx;
    background: rgba(0, 200, 255, 0.06);
    border: 1rpx solid rgba(0, 200, 255, 0.15);
    border-radius: 16rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    animation: kc-fade-in 0.4s ease-out;
  }

  &__xp-gain-text {
    font-size: 26rpx;
    color: $color-accent;
    font-weight: 600;
  }

  &__xp-gain-bar {
    width: 200rpx;
    height: 8rpx;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4rpx;
    overflow: hidden;
  }

  &__xp-gain-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-accent, #7c3aed);
    border-radius: 4rpx;
    transition: width 0.6s ease-out;
  }

  &__xp-gain-lv {
    font-size: 22rpx;
    color: $color-text-muted;
  }

  // v0.9: 进化建议
  &__evo-tip {
    width: 100%;
    padding: 24rpx 28rpx;
    background: rgba(124, 58, 237, 0.06);
    border: 1rpx solid rgba(124, 58, 237, 0.12);
    border-radius: 16rpx;
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__evo-tip-title {
    font-size: 26rpx;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 4rpx;
  }

  &__evo-tip-item {
    display: flex;
    gap: 10rpx;
    align-items: flex-start;
  }

  &__evo-tip-dot {
    color: #7c3aed;
    font-size: 24rpx;
    flex-shrink: 0;
  }

  &__evo-tip-text {
    font-size: 24rpx;
    color: $color-text-secondary;
    line-height: 1.6;
  }

  &__persona {
    margin-top: 12rpx;
    padding: 10rpx 28rpx;
    background: rgba(245, 158, 11, 0.08);
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 20rpx;
    font-size: 26rpx;
    color: $color-gold;
    font-weight: 500;
  }

  &__dim-highlight {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    flex-wrap: wrap;
    margin-top: 16rpx;
    padding: 14rpx 20rpx;
    background: rgba(0, 200, 255, 0.06);
    border-radius: 12rpx;
    border: 1rpx solid rgba(0, 200, 255, 0.1);
    font-size: 24rpx;
    color: $color-text-secondary;
  }

  &__dim-icon { font-size: 24rpx; }
  &__dim-label { color: $color-text-muted; }
  &__dim-name { color: #00c8ff; font-weight: bold; }
  &__dim-arrow { font-size: 20rpx; color: $color-text-muted; margin-left: 8rpx; }

  // 首次测试进化之旅引导卡片
  &__journey-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    margin-top: 16rpx;
    padding: 28rpx 24rpx;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(0, 200, 255, 0.06));
    border: 1rpx solid rgba(124, 58, 237, 0.2);
    border-radius: 20rpx;
    animation: fade-in 0.5s ease-out both;

    &-icon { font-size: 48rpx; }

    &-title {
      font-size: 30rpx;
      font-weight: bold;
      color: #fff;
    }

    &-desc {
      font-size: 24rpx;
      color: $color-text-secondary;
      text-align: center;
      line-height: 1.5;
    }

    &-actions {
      display: flex;
      gap: 16rpx;
      margin-top: 4rpx;
    }

    &-btn {
      padding: 14rpx 48rpx;
      background: linear-gradient(135deg, #7c3aed, #f59e0b);
      border-radius: 32rpx;
      font-size: 28rpx;
      font-weight: bold;
      color: #fff;
      border: none;
    }

    &-hint {
      font-size: 20rpx;
      color: $color-text-muted;
    }
  }

  // 知识卡收集进度
  &__collect-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 24rpx;
    padding: 20rpx 28rpx;
    background: rgba(0, 200, 255, 0.05);
    border: 1rpx solid rgba(0, 200, 255, 0.1);
    border-radius: 16rpx;

    &-icon { font-size: 32rpx; }

    &-text {
      font-size: 24rpx;
      color: $color-text-secondary;
    }

    &-bar {
      width: 240rpx;
      height: 6rpx;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3rpx;
      overflow: hidden;
    }

    &-fill {
      height: 100%;
      background: linear-gradient(90deg, #00c8ff, #7c3aed);
      border-radius: 3rpx;
      transition: width 0.6s ease;
    }

    &-done {
      font-size: 22rpx;
      color: $color-gold;
      font-weight: 500;
    }
  }

  &__collect-tip {
    margin-top: 8rpx;
    padding: 14rpx 20rpx;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 12rpx;
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    text-align: center;
    font-size: 22rpx;
    color: $color-gold;
    line-height: 1.4;
    animation: fade-in 0.5s ease-out both;
  }

  // v1.0: 订阅消息入口
  &__subscribe-prompt {
    margin-top: 16rpx;
    padding: 18rpx 24rpx;
    background: rgba(0, 200, 255, 0.08);
    border: 1rpx solid rgba(0, 200, 255, 0.2);
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    gap: 12rpx;
    animation: fade-in 0.5s ease-out both;
    &:active { background: rgba(0, 200, 255, 0.15); }
  }
  &__subscribe-icon { font-size: 32rpx; }
  &__subscribe-text {
    font-size: 24rpx;
    color: $color-accent;
    line-height: 1.4;
    flex: 1;
  }

  &__profile-prompt {
    margin-top: 12rpx;
    padding: 16rpx 24rpx;
    background: rgba(245, 158, 11, 0.08);
    border: 1rpx solid rgba(245, 158, 11, 0.2);
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    gap: 10rpx;
    animation: fade-in 0.5s ease-out both;
    &:active { background: rgba(245, 158, 11, 0.15); }
  }
  &__profile-prompt-icon { font-size: 32rpx; flex-shrink: 0; }
  &__profile-prompt-text {
    font-size: 24rpx;
    color: $color-gold;
    line-height: 1.4;
    flex: 1;
  }
  &__profile-prompt-arrow {
    font-size: 28rpx;
    color: $color-gold;
    flex-shrink: 0;
  }
}

.page-result__fade-in {
  animation: fade-in 0.5s ease-out both;
}

@keyframes ripple-pulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 0.2; }
  100% { transform: scale(0.8); opacity: 0.6; }
}

@keyframes text-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes screenshot-hint-in {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes screenshot-hint-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes near-miss-glow {
  0%, 100% { box-shadow: inset 0 0 8rpx rgba(255, 152, 0, 0.2); }
  50% { box-shadow: inset 0 0 16rpx rgba(255, 152, 0, 0.5); }
}

@keyframes share-pulse {
  0%, 100% { box-shadow: 0 6rpx 24rpx rgba(0, 200, 255, 0.4); }
  50% { box-shadow: 0 6rpx 36rpx rgba(0, 200, 255, 0.7), 0 0 60rpx rgba(124, 58, 237, 0.3); }
}

@keyframes star-glow {
  0%, 100% { text-shadow: 0 0 4rpx rgba(245, 158, 11, 0.4); }
  50% { text-shadow: 0 0 12rpx rgba(245, 158, 11, 0.8); }
}

@keyframes rarity-pulse-rare {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

@keyframes rarity-pulse-legend {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.03); }
}

@keyframes rarity-pulse-limited {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  25% { opacity: 1; transform: scale(1.04); }
  50% { opacity: 0.85; transform: scale(1); }
  75% { opacity: 1; transform: scale(1.04); }
}

// 星阵稀有度闪烁
@keyframes star-shimmer-slow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.45; }
}

@keyframes star-shimmer-rare {
  0%, 100% { opacity: 0.4; color: rgba(100, 180, 255, 0.25); }
  50% { opacity: 0.65; color: rgba(130, 200, 255, 0.45); }
}

@keyframes star-shimmer-legend {
  0%, 100% { opacity: 0.45; color: rgba(160, 120, 255, 0.30); }
  50% { opacity: 0.75; color: rgba(180, 140, 255, 0.55); }
}

@keyframes star-shimmer-limited {
  0%, 100% { opacity: 0.5; color: rgba(245, 158, 11, 0.32); transform: scale(1); }
  50% { opacity: 0.85; color: rgba(255, 200, 50, 0.55); transform: scale(1.08); }
}

// ── 知识星收集 ──
.page-result__star-collection {
  width: 100%;
  margin-top: 24rpx;
  padding: 24rpx 20rpx;
  background: rgba(245, 158, 11, 0.04);
  border: 1rpx solid rgba(245, 158, 11, 0.1);
  border-radius: 16rpx;

  &--empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    padding: 32rpx 20rpx;
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.06);
  }
}

.page-result__star-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.page-result__star-title-row {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.page-result__star-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $color-gold;
}

.page-result__star-rank {
  font-size: 20rpx;
  color: rgba(245, 158, 11, 0.6);
}

.page-result__star-handbook-link {
  font-size: 24rpx;
  color: $color-accent;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(0, 200, 255, 0.08);
  min-height: 88rpx;
  display: flex;
  align-items: center;
}

.page-result__star-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6rpx;
  padding: 8rpx 0;
}

.page-result__star {
  font-size: 32rpx;
  line-height: 1;

  &--lit {
    color: $color-gold;
    animation: star-glow 2s ease-in-out infinite;
  }

  &--mystery {
    color: rgba(255, 255, 255, 0.10);
  }
}

.page-result__star-near-full {
  font-size: 22rpx;
  color: $color-gold;
  text-align: center;
  margin-top: 8rpx;
}

.page-result__star-milestone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(124, 58, 237, 0.1));
  border: 1rpx solid rgba(245, 158, 11, 0.25);
  border-radius: 16rpx;
  animation: milestone-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;

  &-icon {
    font-size: 48rpx;
  }

  &-title {
    font-size: 28rpx;
    font-weight: 700;
    color: $color-gold;
  }

  &-sub {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
  }
}

.page-result__star-empty-icon { font-size: 48rpx; }
.page-result__star-empty-text { font-size: 24rpx; color: $color-text-secondary; }
.page-result__star-empty-hint { font-size: 22rpx; color: $color-text-muted; }

// ── 新卡掉落 ──
.page-result__new-cards {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 14rpx;
}

.page-result__new-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 18rpx;
  background: rgba(0, 200, 255, 0.06);
  border: 1rpx solid rgba(0, 200, 255, 0.12);
  border-radius: 12rpx;

  &-rarity {
    font-size: 18rpx;
    padding: 2rpx 10rpx;
    border-radius: 8rpx;
    font-weight: 600;
    flex-shrink: 0;

    &--common { background: rgba(255,255,255,0.1); color: $color-text-secondary; }
    &--rare { background: rgba(0,200,255,0.15); color: #00c8ff; animation: rarity-pulse-rare 2s ease-in-out infinite; }
    &--legend { background: rgba(124,58,237,0.2); color: #a78bfa; animation: rarity-pulse-legend 1.5s ease-in-out infinite; }
    &--limited { background: rgba(245,158,11,0.2); color: $color-gold; animation: rarity-pulse-limited 1.2s ease-in-out infinite; }
  }

  &--rare {
    border-color: rgba(0, 200, 255, 0.25);
    box-shadow: 0 0 16rpx rgba(0, 200, 255, 0.08);
  }

  &--legend {
    border-color: rgba(124, 58, 237, 0.3);
    box-shadow: 0 0 20rpx rgba(124, 58, 237, 0.1);
  }

  &--limited {
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 0 20rpx rgba(245, 158, 11, 0.1);
  }

  &-emoji { font-size: 36rpx; flex-shrink: 0; }

  &-body { flex: 1; min-width: 0; }

  &-title {
    font-size: 24rpx;
    font-weight: 600;
    color: $color-text-primary;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &-hook {
    font-size: 20rpx;
    color: $color-text-muted;
    display: block;
    margin-top: 2rpx;
  }
}

// ── 进化人格卡 ──
.page-result__evo-persona {
  width: 100%;
  margin-top: 24rpx;
}

.page-result__evo-card {
  width: 100%;
  padding: 28rpx 24rpx;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(0, 200, 255, 0.06));
  border: 1rpx solid rgba(124, 58, 237, 0.25);
  border-radius: 20rpx;
}

.page-result__evo-persona-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  text-align: center;
}

.page-result__evo-persona-desc {
  font-size: 24rpx;
  color: $color-text-secondary;
  line-height: 1.6;
  display: block;
  margin-top: 14rpx;
  text-align: center;
}

.page-result__evo-traits {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.page-result__evo-trait {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  padding: 14rpx 18rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12rpx;

  &-icon { font-size: 28rpx; flex-shrink: 0; }

  &-body {
    flex: 1;
    text-align: center;
  }

  &-label {
    font-size: 24rpx;
    font-weight: 600;
    color: $color-text-primary;
    display: block;
  }

  &-hint {
    font-size: 22rpx;
    color: $color-text-muted;
    display: block;
    margin-top: 4rpx;
    line-height: 1.4;
  }
}

.page-result__evo-rarity {
  font-size: 22rpx;
  color: #a78bfa;
  text-align: center;
  display: block;
  margin-top: 14rpx;
}

.page-result__evo-share-btn {
  display: block;
  width: 360rpx;
  height: 88rpx;
  line-height: 88rpx;
  margin: 20rpx auto 0;
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
  text-align: center;
  transition: all 0.2s;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 200, 255, 0.12));
  border: 1rpx solid rgba(124, 58, 237, 0.3);

  &--primary {
    width: 420rpx;
    height: 88rpx;
    line-height: 88rpx;
    font-size: 30rpx;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    border: none;
    box-shadow: 0 6rpx 28rpx rgba(124, 58, 237, 0.45);
    animation: share-pulse 2s ease-in-out infinite;
  }

  &:active {
    background: rgba(124, 58, 237, 0.25);
    transform: scale(0.97);
  }
}

// ── 偷看高段位 ──
.page-result__evo-next {
  width: 100%;
  margin-top: 28rpx;
}

.page-result__evo-next-intro {
  font-size: 24rpx;
  color: $color-text-secondary;
  display: block;
  margin-bottom: 12rpx;
}

.page-result__evo-next-tips {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.page-result__evo-next-tip {
  font-size: 24rpx;
  color: $color-text-primary;
  line-height: 1.5;
}

.page-result__evo-next-cta {
  font-size: 24rpx;
  color: $color-gold;
  font-weight: 500;
  display: block;
  margin-top: 14rpx;
  text-align: center;
}

// ── 悄悄话 ──
.page-result__evo-whisper {
  width: 100%;
  margin-top: 28rpx;
  padding: 28rpx 24rpx;
  background: linear-gradient(135deg, rgba(0, 200, 255, 0.04), rgba(124, 58, 237, 0.06));
  border-radius: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;

  &-icon { font-size: 32rpx; }

  &-text {
    font-size: 28rpx;
    color: $color-text-primary;
    line-height: 1.7;
    text-align: center;
    font-style: italic;
  }

  &-rarity {
    font-size: 20rpx;
    color: #a78bfa;
    padding: 4rpx 14rpx;
    background: rgba(124, 58, 237, 0.1);
    border-radius: 10rpx;
  }

  &-sig {
    font-size: 20rpx;
    color: $color-text-muted;
  }
}

// ── AI 读心术 ──
.page-result__mind-read {
  width: 100%;
  margin-top: 28rpx;
}

.page-result__mind-read-card {
  width: 100%;
  padding: 28rpx 24rpx;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;

  &--rare {
    background: linear-gradient(135deg, rgba(0, 200, 255, 0.06), rgba(124, 58, 237, 0.06));
    border: 1rpx solid rgba(0, 200, 255, 0.2);
  }

  &--legend {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(245, 158, 11, 0.06));
    border: 1rpx solid rgba(124, 58, 237, 0.3);
    animation: legend-border-glow 3s ease-in-out infinite;
  }
}

.page-result__mind-read-question {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  padding: 14rpx 18rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12rpx;
  border-left: 4rpx solid rgba(0, 200, 255, 0.4);
}

.page-result__mind-read-q-emoji {
  font-size: 32rpx;
  flex-shrink: 0;
}

.page-result__mind-read-q-stem {
  font-size: 24rpx;
  color: $color-text-primary;
  line-height: 1.5;
  flex: 1;
}

.page-result__mind-read-body {
  font-size: 26rpx;
  color: $color-text-primary;
  line-height: 1.7;
}

.page-result__mind-read-trait {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 18rpx;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 12rpx;
  border: 1rpx solid rgba(245, 158, 11, 0.15);
}

.page-result__mind-read-trait-label {
  font-size: 22rpx;
  color: $color-text-muted;
}

.page-result__mind-read-trait-name {
  font-size: 26rpx;
  font-weight: bold;
  color: $color-gold;
}

.page-result__mind-read-highlight {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  font-size: 22rpx;
  color: $color-text-muted;
}

.page-result__mind-read-highlight-icon {
  font-size: 22rpx;
}

@keyframes legend-border-glow {
  0%, 100% { border-color: rgba(124, 58, 237, 0.3); }
  50% { border-color: rgba(245, 158, 11, 0.5); }
}

// ── 粘性分享栏 ──
.page-result__sticky-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(10, 10, 20, 0.95);
  backdrop-filter: blur(20rpx);
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  animation: sticky-bar-in 0.3s ease-out;
}

@keyframes sticky-bar-in {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes milestone-pop {
  0% { transform: scale(0.8); opacity: 0; }
  60% { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}

.page-result__sticky-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #fff;
  border: none;
  text-align: center;

  &:active { transform: scale(0.97); }

  &--retry {
    flex: 1.5;
    background: linear-gradient(135deg, #00c8ff, #7c3aed);
    box-shadow: 0 4rpx 20rpx rgba(0, 200, 255, 0.3);
  }

  &--share {
    flex: 1;
    background: linear-gradient(135deg, #7c3aed, #f59e0b);
    box-shadow: 0 4rpx 20rpx rgba(124, 58, 237, 0.35);
    font-size: 26rpx;
    border: none;
  }
}
</style>
