#!/bin/bash
# ============================================================
# 进化湾 — 一键发布脚本
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 优先使用 Node v20（miniprogram-ci 兼容性要求）
NODE_BIN="/opt/homebrew/opt/node@20/bin"
if [ -d "$NODE_BIN" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  进化湾 · 一键发布${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ── Step 1: 编译 ──
echo -e "${YELLOW}[1/3] 编译小程序...${NC}"
npm run build:mp-weixin
echo -e "${GREEN}  编译完成${NC}"

# 清理：云函数通过 tcb 独立部署，不应打包进小程序
rm -rf "$SCRIPT_DIR/dist/build/mp-weixin/cloudfunctions"
# 确保 packOptions ignore 包含 cloudfunctions
node -e "
const fs = require('fs');
const path = '$SCRIPT_DIR/dist/build/mp-weixin/project.config.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.packOptions = cfg.packOptions || {};
cfg.packOptions.ignore = [{ value: 'cloudfunctions', type: 'folder' }];
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
"
echo ""

# ── Step 2: 部署云函数 ──
echo -e "${YELLOW}[2/3] 部署云函数...${NC}"

FUNCTIONS=(
  analyticsLog
  dbInit
  errorMonitor
  getDailyQuestions
  getDashboardData
  getFriendRank
  getTierDistribution
  getWeeklyStats
  importQuestions
  knowledgeBank
  monitorMetrics
  processFeedback
  sendChallenge
  sendReminder
  submitScore
  weeklyReport
)

for fn in "${FUNCTIONS[@]}"; do
  printf "  %-24s " "${fn}..."
  result=$(echo "1" | tcb fn deploy "$fn" --force 2>&1 | tail -1)
  if echo "$result" | grep -q "部署成功"; then
    echo -e "${GREEN}✓${NC}"
  elif echo "$result" | grep -q "未变更"; then
    echo -e "${GREEN}✓ (未变更)${NC}"
  else
    echo -e "${YELLOW}⚠${NC} $result"
  fi
done
echo -e "${GREEN}  云函数部署完成${NC}"
echo ""

# ── Step 3: 上传小程序代码 ──
echo -e "${YELLOW}[3/3] 上传小程序代码...${NC}"

PROJECT_PATH="$SCRIPT_DIR/dist/build/mp-weixin"
VERSION="${1:-0.9.0}"
DESC="${2:-$(date '+%Y-%m-%d %H:%M') 发布}"

if [ ! -f "$SCRIPT_DIR/private.key" ]; then
  echo -e "${RED}  错误: 未找到 private.key${NC}"
  echo ""
  echo "  请前往微信公众平台下载代码上传密钥："
  echo "  https://mp.weixin.qq.com/ → 开发管理 → 开发设置 → 小程序代码上传密钥"
  echo "  下载后重命名为 private.key 放到项目根目录"
  exit 1
fi

echo "  使用 miniprogram-ci 上传..."
npx --yes miniprogram-ci@2 upload \
  --pp "$PROJECT_PATH" \
  --pkp "$SCRIPT_DIR/private.key" \
  --appid wxfd3b695920a78e1b \
  --uv "$VERSION" \
  --ud "$DESC" \
  --enable-es6 true \
  --enable-postcss true \
  --enable-minify true

echo ""
echo -e "${GREEN}  小程序上传成功！${NC}"
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  发布完成！下一步：${NC}"
echo -e "${CYAN}  1. 打开 https://mp.weixin.qq.com/${NC}"
echo -e "${CYAN}  2. 版本管理 → 找到 ${VERSION} → 提交审核${NC}"
echo -e "${CYAN}============================================${NC}"
