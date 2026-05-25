<script>
import { initAnalytics, trackShareCardClick } from '@/utils/analytics.js';

export default {
  globalData: {
    appLaunchTime: 0,
    shareFromUid: '',
  },
  onLaunch() {
    console.log('进化湾 App Launch');
    this.globalData.appLaunchTime = Date.now();

    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-7gp7l6qu464a196a', // TODO: 替换为你的云开发环境ID
        traceUser: true,
      });
      console.log('云开发初始化完成');
    } else {
      console.error('请在微信开发者工具中运行');
    }

    // 全局未捕获错误处理（避免白屏）
    if (typeof wx !== 'undefined' && wx.onError) {
      wx.onError((err) => {
        console.error('[global] wx.onError:', err);
        // 非致命错误不弹窗，仅记录
      });
    }
    if (typeof wx !== 'undefined' && wx.onUnhandledRejection) {
      wx.onUnhandledRejection((res) => {
        console.error('[global] UnhandledRejection:', res.reason);
        // Promise 未捕获异常不阻塞用户
      });
    }

    // 初始化埋点（加载重试队列 + 注册 onHide 刷新）
    initAnalytics();
  },
  onShow(options) {
    console.log('进化湾 App Show');

    // 检测是否从分享卡片进入
    if (options && options.query) {
      const q = options.query;
      if (q.from_uid || q.from_group) {
        const shareChannel = q.from_group ? 'group' : 'private';
        this.globalData.shareFromUid = q.from_uid || '';
        trackShareCardClick({
          from_uid: q.from_uid || '',
          share_channel: shareChannel,
        });
      }
    }
  },
  onHide() {
    console.log('进化湾 App Hide');
  },
};
</script>

<style>
/* 全局样式 — v0.6 深空蓝紫主题 */
page {
  background-color: #0d1b2a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* 全局button样式重置 */
button {
  padding: 0;
  margin: 0;
  background: none;
}

button::after {
  border: none;
}

/* 全局滚动条隐藏 */
::-webkit-scrollbar {
  display: none;
}
</style>
