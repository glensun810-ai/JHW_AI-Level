/**
 * 题库导入云函数 — v0.8
 *
 * 从 questions-data.js 读取 50 道情景应用题目，批量写入 questions 表。
 *
 * 部署方式：
 * 1. 将本文件 + questions-seed.json 部署为 cloudfunctions/importQuestions/
 * 2. config.json 添加 { "timeout": 60 }
 * 3. 在云开发控制台手动触发一次（或通过 HTTP 触发器）
 *
 * 特点：
 *   - 幂等导入（检查已存在题目数，避免重复）
 *   - 100 题分 5 批写入（云开发单次写入限制 20 条）
 *   - 每批间隔 500ms 避免触发频率限制
 */

const cloud = require('wx-server-sdk');
const questions = require('./questions-data.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const action = event.action || 'import';

  if (action === 'count') {
    const { total } = await db.collection('questions')
      .where({ status: 'active' })
      .count();
    return { code: 0, message: 'ok', data: { total } };
  }

  if (action === 'clear') {
    // 仅清除之前脚本导入的题目（通过标记识别）
    const { data: existing } = await db.collection('questions')
      .where({ _importBatch: 'v0.8-seed' })
      .get();

    for (const q of existing) {
      await db.collection('questions').doc(q._id).remove();
    }

    console.log(`[importQuestions] 清除 ${existing.length} 道旧题`);
    return { code: 0, message: `已清除 ${existing.length} 道题目`, data: { removed: existing.length } };
  }

  if (action === 'import') {
    // 检查是否已导入
    const { total: existingCount } = await db.collection('questions')
      .where({ _importBatch: 'v0.8-seed' })
      .count();

    if (existingCount >= questions.length) {
      return { code: 0, message: '题目已全部导入，跳过', data: { existingCount } };
    }

    if (existingCount > 0) {
      console.log(`[importQuestions] 已有 ${existingCount} 道，将补充导入剩余题目`);
    }

    // 过滤掉已存在的题目（按题干匹配）
    const { data: existingQuestions } = await db.collection('questions')
      .where({ _importBatch: 'v0.8-seed' })
      .field({ stem: true })
      .get();

    const existingStems = new Set(existingQuestions.map(q => q.stem));
    const toImport = questions.filter(q => !existingStems.has(q.stem));

    if (toImport.length === 0) {
      return { code: 0, message: '无新题需要导入', data: { imported: 0 } };
    }

    console.log(`[importQuestions] 准备导入 ${toImport.length} 道题目`);

    // 分批次写入（每批 20 道，微信云开发单次 add 限制）
    const BATCH_SIZE = 20;
    const results = [];
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);

      for (const q of batch) {
        try {
          await db.collection('questions').add({
            data: {
              stem: q.stem,
              emoji: q.emoji || '',
              options: q.options.map(o => `${o.label}. ${o.text}`),
              scores: q.options.map(o => o.score),
              commentary: q.options.map(o => o.comment || ''),
              dimension: q.dimension || 'comprehensive',
              theme: q.theme || 'comprehensive',
              difficulty: q.difficulty || 5,
              status: 'active',
              _importBatch: 'v0.8-seed',
              createdAt: new Date(),
            },
          });
          imported++;
        } catch (err) {
          errors++;
          console.error(`[importQuestions] 导入失败: ${q.stem.slice(0, 30)}...`, err.message);
          results.push({ stem: q.stem.slice(0, 30), error: err.message });
        }
      }

      // 批次间短暂延迟
      if (i + BATCH_SIZE < toImport.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[importQuestions] 进度: ${Math.min(i + BATCH_SIZE, toImport.length)}/${toImport.length}`);
    }

    console.log(`[importQuestions] 导入完成: ${imported} 成功, ${errors} 失败`);
    return {
      code: 0,
      message: `导入完成：${imported} 成功，${errors} 失败`,
      data: { imported, errors, total: imported + existingCount, results },
    };
  }

  return { code: 400, message: '未知操作，可选：count | import | clear', data: null };
};
