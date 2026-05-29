<script>
import { initAnalytics, trackShareCardClick, trackInviteClick } from '@/utils/analytics.js';
import { callCloudFunction, getUserOpenid, getUserOpenidSync, preloadDailyQuestions } from '@/utils/api.js';

export default {
  globalData: {
    appLaunchTime: 0,
    shareFromUid: '',
    shareTicket: '',
    groupId: '',
  },
  onLaunch(options) {
    this.globalData.appLaunchTime = Date.now();

    // 初始化云开发（必须在所有云 API 调用之前）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-7gp7l6qu464a196a',
        traceUser: true,
      });
    } else {
      console.error('请在微信开发者工具中运行');
    }

    // 启用带 shareTicket 的分享（群排行/群挑战需要）
    if (typeof wx !== 'undefined' && wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true });
    }

    // 冷启动优化：后台预加载今日题目（不阻塞渲染）
    preloadDailyQuestions().catch(() => {});
    // 群聊 shareTicket 解析 → 提取群 ID 用于群排行
    if (options && options.shareTicket) {
      this.globalData.shareTicket = options.shareTicket;
      if (typeof wx !== 'undefined' && wx.getShareInfo) {
        wx.getShareInfo({
          shareTicket: options.shareTicket,
          success: (res) => {
            if (res.encryptedData && res.iv) {
              this.globalData.shareTicket = options.shareTicket;
              // 将加密数据发送到云函数解密，获取 openGId
              callCloudFunction('submitScore', {
                action: 'decryptGroupInfo',
                encryptedData: res.encryptedData,
                iv: res.iv,
              }, { retry: false }).then((decRes) => {
                if (decRes.code === 0 && decRes.data && decRes.data.openGId) {
                  this.globalData.groupId = decRes.data.openGId;
                }
              }).catch(() => { /* 静默 */ });
            }
          },
          fail: () => { /* 静默 */ },
        });
      }
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
        // v1.0: 记录邀请关系（排除自己）
        if (q.from_uid) {
          trackInviteClick(q.from_uid, shareChannel);
          // 异步获取 openid 确保冷启动时也能正确记录邀请关系
          getUserOpenid().then(myUid => {
            if (myUid && q.from_uid !== myUid) {
              callCloudFunction('submitScore', {
                action: 'recordInvite',
                inviterUid: q.from_uid,
              }, { retry: false }).catch(() => { /* 静默 */ });
            }
          }).catch(() => { /* 静默 */ });
        }
      }
      // 群聊进入：保存 shareTicket 用于群排行/群挑战
      if (options.shareTicket) {
        this.globalData.shareTicket = options.shareTicket;
        if (!q.from_uid && !q.from_group) {
          trackShareCardClick({
            from_uid: '',
            share_channel: 'group',
          });
        }
        // 提取群 ID
        if (typeof wx !== 'undefined' && wx.getShareInfo) {
          wx.getShareInfo({
            shareTicket: options.shareTicket,
            success: (res) => {
              if (res.encryptedData && res.iv) {
                callCloudFunction('submitScore', {
                  action: 'decryptGroupInfo',
                  encryptedData: res.encryptedData,
                  iv: res.iv,
                }, { retry: false }).then((decRes) => {
                  if (decRes.code === 0 && decRes.data && decRes.data.openGId) {
                    this.globalData.groupId = decRes.data.openGId;
                  }
                }).catch(() => { /* 静默 */ });
              }
            },
            fail: () => { /* 静默 */ },
          });
        }
      }
    }
  },
  onHide() {},
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
