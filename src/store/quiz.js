import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchDailyQuestions, submitTestScore } from '@/utils/api.js';
import { getTier } from '@/utils/tier.js';
import { useExperienceStore } from '@/store/experience.js';

export const useQuizStore = defineStore('quiz', () => {
  // ── 状态 ──
  const questions = ref([]);
  const answers = ref([]);
  const currentIndex = ref(0);
  const totalScore = ref(0);
  const questionSetId = ref('');
  const questionStartTime = ref(null);
  const testStartTime = ref(null);
  const runningScore = ref(0);
  const deepMode = ref(false); // v0.9: 深度定段模式(10题)

  // 结果页数据（替代 globalData）
  const lastResult = ref(null);
  const lastQuestions = ref(null);
  const lastAnswers = ref(null);

  // ── 计算属性 ──
  const currentQuestion = computed(() => questions.value[currentIndex.value] || null);
  const totalQuestions = computed(() => questions.value.length);
  const answeredCount = computed(() => answers.value.length);
  const isLastQuestion = computed(() => currentIndex.value >= totalQuestions.value - 1);
  const progress = computed(() => totalQuestions.value > 0 ? (currentIndex.value + 1) / totalQuestions.value : 0);

  // F5: 当前运行段位（按已答题数比例推算总分）
  const runningTier = computed(() => {
    if (answers.value.length === 0) return null;
    const cnt = answers.value.length;
    const totalQ = totalQuestions.value || 5;
    const maxScore = totalQ * 10;
    const minScore = Math.max(5, Math.round(totalQ * 0.1));
    const estimatedTotal = Math.round((runningScore.value / cnt) * totalQ);
    return getTier(Math.min(maxScore, Math.max(minScore, estimatedTotal)));
  });

  // B1: 获取当前题目之前保存的答案（用于回退时恢复选中状态）
  const currentSavedAnswer = computed(() => {
    if (currentIndex.value < answers.value.length) {
      return answers.value[currentIndex.value];
    }
    return null;
  });

  // ── 解析选项文本（去除 A. B. C. D. 前缀） ──
  function parseOptionText(raw) {
    return (raw || '').replace(/^[A-D][.、\s]+/, '');
  }

  function parseOptionLabel(raw) {
    const m = (raw || '').match(/^([A-D])/);
    return m ? m[1] : '';
  }

  // ── 动作 ──
  async function fetchQuestions() {
    const questionCount = deepMode.value ? 10 : 5;
    const res = await fetchDailyQuestions(undefined, 0, questionCount);

    if (res.code === 0 && res.data) {
      questions.value = (res.data.questions || []).map(q => ({
        ...q,
        _parsedOptions: (q.options || []).map((opt, i) => ({
          label: parseOptionLabel(opt) || ['A', 'B', 'C', 'D'][i],
          text: parseOptionText(opt),
          score: q.scores?.[i] ?? 0,
          comment: q.commentary?.[i] ?? '',
        })),
      }));
      questionSetId.value = res.data.questionSetId || '';
      testStartTime.value = Date.now();
    }

    return res;
  }

  function selectAnswer(optionIndex) {
    if (!currentQuestion.value) return null;

    const opt = currentQuestion.value._parsedOptions[optionIndex];
    const timeSpent = questionStartTime.value ? Date.now() - questionStartTime.value : 0;

    const answer = {
      questionId: currentQuestion.value._id,
      selectedIndex: optionIndex,
      score: opt.score,
    };

    // B1: 回退到已答过的题时替换而非追加，并截断后续答案
    if (currentIndex.value < answers.value.length) {
      answers.value[currentIndex.value] = answer;
      answers.value.length = currentIndex.value + 1;
      recalcScores();
    } else {
      answers.value.push(answer);
      totalScore.value += opt.score;
      runningScore.value += opt.score;
    }

    return {
      label: opt.label,
      score: opt.score,
      comment: opt.comment,
      timeSpent,
    };
  }

  function recalcScores() {
    totalScore.value = answers.value.reduce((s, a) => s + a.score, 0);
    runningScore.value = totalScore.value;
  }

  function setAnswerFeedback(index, feedback) {
    if (index >= 0 && index < answers.value.length) {
      answers.value[index].feedback = feedback;
    }
  }

  function startQuestion() {
    questionStartTime.value = Date.now();
  }

  function advanceQuestion() {
    if (currentIndex.value < totalQuestions.value - 1) {
      currentIndex.value++;
      return true;
    }
    return false;
  }

  async function submitTest(challengeId = '') {
    const app = getApp();
    const fromUid = app.globalData.shareFromUid || '';
    const bountyTier = app.globalData.bountyTier || '';
    const targetName = app.globalData.bountyTargetName || '';
    const res = await submitTestScore(questionSetId.value, answers.value, fromUid, challengeId, bountyTier, targetName);
    // 消费后清除，避免下次测试误用
    if (bountyTier) {
      app.globalData.bountyTier = '';
      app.globalData.bountyTargetName = '';
    }
    if (res.code === 0 && res.data) {
      lastResult.value = res.data;
      lastAnswers.value = [...answers.value];
      lastQuestions.value = questions.value.map(q => ({
        _id: q._id,
        stem: q.stem,
        emoji: q.emoji,
        _parsedOptions: q._parsedOptions,
      }));
      // 进化值：非重复提交时发放
      if (!res.data.isDuplicate) {
        const expStore = useExperienceStore();
        expStore.addExp('test');
        if (res.data.isNewHighest) {
          expStore.addExp('record');
        }
      }
    }
    return res;
  }

  function setDeepMode(val) {
    deepMode.value = val;
  }

  function reset() {
    questions.value = [];
    answers.value = [];
    currentIndex.value = 0;
    totalScore.value = 0;
    runningScore.value = 0;
    questionSetId.value = '';
    questionStartTime.value = null;
    testStartTime.value = null;
    lastResult.value = null;
    lastQuestions.value = null;
    lastAnswers.value = null;
    // deepMode 保持不重置（由入口页设置）
  }

  return {
    questions, answers, currentIndex, totalScore, questionSetId,
    questionStartTime, testStartTime, runningScore, deepMode,
    currentQuestion, totalQuestions, answeredCount, isLastQuestion, progress, runningTier,
    currentSavedAnswer,
    lastResult, lastQuestions, lastAnswers,
    fetchQuestions, selectAnswer, startQuestion, advanceQuestion, submitTest, reset, setDeepMode, setAnswerFeedback,
  };
});
