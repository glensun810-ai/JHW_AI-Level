const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 缓存
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 所有段位名称（按顺序）
const ALL_TIERS = [
  '萌新',
  '调戏师',
  '工具人',
  '协作者',
  '驾驭者',
  '炼金术士',
  '觉醒者',
  '无界',
];

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    const now = Date.now();

    // 缓存命中
    if (cachedData && (now - cacheTime) < CACHE_TTL) {
      // 更新当前用户的段位和百分位（这部分不能缓存）
      const userData = await getUserStats(OPENID);

      return {
        code: 0,
        message: 'ok (cached)',
        data: {
          ...cachedData,
          userTier: userData.userTier,
          userPercentile: userData.userPercentile,
        },
      };
    }

    // 缓存未命中：重新聚合
    // 统计有测试记录的用户总数
    const { total: totalUsers } = await db.collection('users')
      .where({ testCount: db.command.gt(0) })
      .count();

    // 按段位分组统计（8 个查询并行）
    const counts = await Promise.all(
      ALL_TIERS.map(tierName =>
        db.collection('users')
          .where({ currentTier: tierName })
          .count()
          .then(res => ({ tier: tierName, count: res.total }))
      )
    );

    const distribution = counts.map(({ tier, count }) => ({
      tier,
      count,
      percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 1000) / 10 : 0,
    }));

    cachedData = { totalUsers, distribution };
    cacheTime = now;

    // 获取当前用户数据
    const userData = await getUserStats(OPENID);

    console.log(`[getTierDistribution] totalUsers=${totalUsers} cached=true`);

    return {
      code: 0,
      message: 'ok',
      data: {
        totalUsers,
        distribution,
        userTier: userData.userTier,
        userPercentile: userData.userPercentile,
      },
    };
  } catch (err) {
    console.error('[getTierDistribution] 异常:', err.message);
    return { code: 500, message: '服务器内部错误', data: null };
  }
};

/**
 * 获取单个用户的段位和百分位数据
 */
async function getUserStats(openid) {
  try {
    const { data: users } = await db.collection('users')
      .where({ _openid: openid })
      .get();

    if (users.length === 0) {
      return { userTier: '尚未测试', userPercentile: 0 };
    }

    const user = users[0];
    const userScore = user.highestScore || 0;

    // 计算百分位
    const { total: lowerCount } = await db.collection('users')
      .where({ highestScore: db.command.lt(userScore).and(db.command.gt(0)) })
      .count();

    const { total: totalUsers } = await db.collection('users')
      .where({ testCount: db.command.gt(0) })
      .count();

    const percentile = totalUsers > 0
      ? Math.floor((lowerCount / totalUsers) * 100)
      : 0;

    return {
      userTier: user.currentTier || '尚未测试',
      userPercentile: percentile,
    };
  } catch (err) {
    return { userTier: '未知', userPercentile: 0 };
  }
}
