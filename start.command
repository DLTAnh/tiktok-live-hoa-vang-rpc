#!/bin/bash
cd "$(dirname "$0")"

# 1. Ưu tiên sử dụng Node 22 LTS dành riêng cho Apple Silicon (đi kèm dự án)
PROJECT_DIR="$(pwd)"
if [ -x "${PROJECT_DIR}/.node/bin/node" ]; then
  export PATH="${PROJECT_DIR}/.node/bin:$PATH"
fi
export PATH="${PROJECT_DIR}/.tools/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Không tìm thấy Node.js trên hệ thống!"
  exit 1
fi

echo "===================================================================="
echo "🔥 ĐÀN TRÀNG HOÁ VÀNG ONLINE — TIKTOK LIVE RPC"
echo "ℹ️  Môi trường: Node.js $(node -v) (Apple Silicon arm64)"
echo "ℹ️  Trạng thái: Đã kích hoạt thư viện tiktok-live-connector chính thức"
echo "===================================================================="

# 2. Tự động khởi tạo đường hầm HTTPS an toàn cho TikTok Live Studio / OBS
TUNNEL_LOG="/tmp/tiktok_tunnel.log"
rm -f "$TUNNEL_LOG"

if [ -x "${PROJECT_DIR}/.tools/bin/cloudflared" ]; then
  echo "🌐 Đang khởi tạo đường hầm bảo mật HTTPS (Cloudflare Tunnel)..."
  "${PROJECT_DIR}/.tools/bin/cloudflared" tunnel --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  trap 'kill $TUNNEL_PID 2>/dev/null' EXIT INT TERM

  for i in {1..16}; do
    HTTPS_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    if [ -n "$HTTPS_URL" ]; then
      echo "--------------------------------------------------------------------"
      echo "✨ ĐÃ TẠO THÀNH CÔNG LINK HTTPS CHO TIKTOK LIVE STUDIO / OBS:"
      echo "🎥 Màn hình Live 9:16 sạch  : ${HTTPS_URL}/?obs=1"
      echo "🎛️ Bảng điều khiển Quản trị : ${HTTPS_URL}/admin"
      echo "--------------------------------------------------------------------"
      break
    fi
    sleep 0.5
  done
fi

node server.js
