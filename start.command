#!/bin/bash
cd "$(dirname "$0")"

# Nạp môi trường Node từ nvm / homebrew nếu có
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh" 2>/dev/null
fi
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Lỗi: Không tìm thấy Node.js trên hệ thống. Vui lòng cài đặt Node.js (khuyến nghị >= 20)!"
  exit 1
fi

echo "🔥 Đang khởi chạy Đàn Tràng Hoá Vàng Online — TikTok Live RPC..."
echo "ℹ️  Phiên bản Node: $(node -v)"
node server.js
