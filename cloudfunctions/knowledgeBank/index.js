const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * knowledgeBank — 知识卡数据库
 * 暂未启用，预留供后续知识卡查询使用
 */
exports.main = async (event) => {
  const cards = require('./cards-data.js');
  const { action, cardId } = event;

  if (action === 'list') {
    return { code: 0, data: { cards } };
  }
  if (action === 'get' && cardId) {
    const card = cards.find(c => c.id === cardId);
    return card
      ? { code: 0, data: { card } }
      : { code: 404, message: '未找到该知识卡', data: null };
  }

  return { code: 0, message: 'knowledgeBank ready', data: { totalCards: cards.length } };
};
