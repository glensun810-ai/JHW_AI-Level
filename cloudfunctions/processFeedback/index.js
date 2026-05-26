const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * processFeedback — 定时反馈聚合 + 题目质量评分
 *
 * 部署方式：
 *   微信云开发控制台 → 云函数 → processFeedback → 触发器
 *   添加定时触发器，Cron: 0 3 * * * （每日凌晨 3:00 执行一次）
 *
 * 逻辑：
 *   1. 查询近 7 天 test_records，按 questionId 聚合 👍/👎 数
 *   2. 计算质量分：thumbsUp / (thumbsUp + thumbsDown)，最低样本量 20
 *   3. 写入 questions.qualityScore 和 questions.status
 *   4. 低于阈值（<0.4）的问题标记为 review
 */

const MIN_SAMPLES = 20;
const REVIEW_THRESHOLD = 0.4;

exports.main = async (event, context) => {
  try {
    console.log('[processFeedback] 开始执行…');
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    // Step 1: 查询近 7 天有反馈的 test_records
    const { data: records } = await db.collection('test_records')
      .where({
        createdAt: _.gte(sevenDaysAgo),
        'answers.feedback': _.exists(true),
      })
      .field({ answers: true })
      .limit(2000)
      .get();

    console.log(`[processFeedback] 近7天记录数: ${records.length}`);

    // Step 2: 按 questionId 聚合 👍/👎
    const agg = {};
    for (const rec of records) {
      for (const ans of (rec.answers || [])) {
        if (!ans.questionId || !ans.feedback) continue;
        if (!agg[ans.questionId]) {
          agg[ans.questionId] = { thumbsUp: 0, thumbsDown: 0 };
        }
        if (ans.feedback === 'up' || ans.feedback === 'like' || ans.feedback === true) {
          agg[ans.questionId].thumbsUp++;
        } else if (ans.feedback === 'down' || ans.feedback === 'dislike' || ans.feedback === false) {
          agg[ans.questionId].thumbsDown++;
        }
      }
    }

    const questionIds = Object.keys(agg);
    console.log(`[processFeedback] 涉及题目数: ${questionIds.length}`);

    // Step 3: 计算质量分并更新
    let updatedCount = 0;
    let reviewedCount = 0;

    for (const [qid, counts] of Object.entries(agg)) {
      const total = counts.thumbsUp + counts.thumbsDown;
      if (total < MIN_SAMPLES) {
        console.log(`[processFeedback] ${qid}: 样本量不足 (${total}/${MIN_SAMPLES})，跳过`);
        continue;
      }

      const qualityScore = +(counts.thumbsUp / total).toFixed(3);
      let newStatus = 'active';
      if (qualityScore < REVIEW_THRESHOLD) {
        newStatus = 'review';
        reviewedCount++;
      }

      try {
        await db.collection('questions').doc(qid).update({
          data: {
            qualityScore,
            status: newStatus,
            feedbackSampleSize: total,
            feedbackUpdatedAt: new Date(),
          },
        });
        updatedCount++;
      } catch (e) {
        console.warn(`[processFeedback] 更新题目 ${qid} 失败:`, e.message);
      }
    }

    console.log(`[processFeedback] 完成 — 更新 ${updatedCount} 题，标记 review ${reviewedCount} 题`);

    return {
      code: 0,
      message: 'ok',
      data: {
        totalRecords: records.length,
        questionsWithFeedback: questionIds.length,
        updated: updatedCount,
        reviewed: reviewedCount,
      },
    };
  } catch (err) {
    console.error('[processFeedback] 异常:', err.message);
    return { code: 500, message: err.message, data: null };
  }
};
