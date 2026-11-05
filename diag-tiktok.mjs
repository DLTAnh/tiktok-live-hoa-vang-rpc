// Chẩn đoán kết nối TikTok Live: node diag-tiktok.mjs <username>
import { TikTokLiveConnection, ControlEvent, WebcastEvent } from 'tiktok-live-connector';

const user = (process.argv[2] || 'quangvangma1').replace(/^@/, '');
console.log(`[diag] Node ${process.version} — thử kết nối @${user} ...`);

const conn = new TikTokLiveConnection(user, {
  processInitialData: false,
  fetchRoomInfoOnConnect: true,
  enableExtendedGiftInfo: false
});

conn.on(ControlEvent.ERROR, (e) => {
  console.log('[diag] ERROR event:', e?.info || '', e?.exception?.message || e?.message || e);
});
conn.on(WebcastEvent.CHAT, (d) => console.log('[diag] CHAT:', d?.user?.uniqueId, d?.comment));

const timer = setTimeout(() => {
  console.log('[diag] Hết thời gian chờ 25s');
  process.exit(2);
}, 25000);

try {
  const st = await conn.connect();
  console.log('[diag] ✅ KẾT NỐI THÀNH CÔNG — roomId:', st?.roomId);
  setTimeout(() => { clearTimeout(timer); conn.disconnect(); process.exit(0); }, 4000);
} catch (e) {
  clearTimeout(timer);
  console.log('[diag] ❌ THẤT BẠI:', e?.constructor?.name, '-', e?.message);
  if (e?.exception) console.log('[diag]    exception:', e.exception?.message || e.exception);
  if (e?.cause) console.log('[diag]    cause:', e.cause?.message || e.cause);
  if (e?.errors) console.log('[diag]    errors:', e.errors.map((x) => x?.message || x));
  process.exit(1);
}
