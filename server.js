const express = require('express');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
let TikTokLiveConnection, WebcastEvent, ControlEvent;
try {
  ({ TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector'));
} catch (e) {
  WebcastEvent = {
    ROOM_USER: 'roomUser',
    MEMBER: 'member',
    CHAT: 'chat',
    LIKE: 'like',
    FOLLOW: 'follow',
    SHARE: 'share',
    SOCIAL: 'social',
    GIFT: 'gift'
  };
  ControlEvent = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
  };
  TikTokLiveConnection = class {
    constructor(username, options) {
      this.username = username;
      this.options = options;
      this.roomId = null;
    }
    on(event, handler) {}
    async connect() {
      throw new Error(`Kết nối TikTok Live yêu cầu Node.js >= 20 (phiên bản hiện tại: ${process.version}). Màn hình đang chạy ở chế độ Giả lập / RPC.`);
    }
    async disconnect() {}
  };
}

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. KHO LỄ VẬT VÀNG MÃ & BỘ QUẺ LINH XĂM TÀI LỘC
// ============================================================================
const VOTIVE_CATALOG = {
  incense: {
    key: 'incense',
    name: 'Nén Hương Trầm Linh Ứng',
    emoji: '🪔',
    baseMerit: 10,
    coins: 0
  },
  flower: {
    key: 'flower',
    name: 'Đoá Sen Lễ Thanh Tịnh',
    emoji: '🪷',
    baseMerit: 12,
    coins: 0
  },
  prayer_scroll: {
    key: 'prayer_scroll',
    name: 'Sớ Điệp Cầu Bình An & Tài Lộc',
    emoji: '📜',
    baseMerit: 20,
    coins: 0
  },
  gold_ingot: {
    key: 'gold_ingot',
    name: 'Thoi Vàng Kim Nguyên Bảo',
    emoji: '🪙',
    baseMerit: 15,
    coins: 1
  },
  hell_money: {
    key: 'hell_money',
    name: 'Xấp Tiền Vàng Phú Quý',
    emoji: '💵',
    baseMerit: 20,
    coins: 2
  },
  royal_robe: {
    key: 'royal_robe',
    name: 'Bộ Mũ Áo Hia Quan Thần Lộc',
    emoji: '👘',
    baseMerit: 35,
    coins: 5
  },
  sacred_horse: {
    key: 'sacred_horse',
    name: 'Ngựa Đỏ Xích Thố Thần Hành',
    emoji: '🐎',
    baseMerit: 60,
    coins: 10
  },
  five_elements_tray: {
    key: 'five_elements_tray',
    name: 'Mâm Lễ Vàng Mã Ngũ Phương',
    emoji: '👑',
    baseMerit: 120,
    coins: 20
  },
  golden_tech: {
    key: 'golden_tech',
    name: 'Trọn Bộ Táo Vàng Thượng Phẩm',
    emoji: '📱',
    baseMerit: 180,
    coins: 30
  },
  luxury_villa_car: {
    key: 'luxury_villa_car',
    name: 'Biệt Thự Phố & Siêu Xe Vàng',
    emoji: '🏯',
    baseMerit: 300,
    coins: 50
  },
  dragon_treasury: {
    key: 'dragon_treasury',
    name: 'Đại Lễ Hoá Vàng Kim Long Khai Khố',
    emoji: '🐉',
    baseMerit: 1000,
    coins: 100
  }
};

const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Kim Khố Khai Mở — Tài Lộc Đầy Nhà',
    poem: 'Lò thiêng rực lửa ánh hoàng kim\nPhúc lộc gia tiên độ khắp miền\nBuôn may bán đắt tiền vô kể\nGia đạo bình an vạn sự nên.',
    meaning: 'Lòng thành hoá vàng thấu đến Cửu Huyền Thất Tổ và Thần Tài. Mọi sự cầu tài, kinh doanh, buôn bán đều đại cát đại lợi.',
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Kim Khố Khai Mở. Lòng thành thấu triệt, buôn may bán đắt, tài lộc đầy nhà.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Bát Phương Tụ Tài — Lộc Tới Bốn Phương',
    poem: 'Khói hương quyện tỏa trước đàn tràng\nThoi vàng dâng lễ rạng hào quang\nQuý nhân phù trợ đường danh lợi\nBốn mùa hưng vượng phúc giàu sang.',
    meaning: 'Tâm thành dâng lễ ắt đắc lộc. Công việc làm ăn có quý nhân chỉ lối, tiền bạc hanh thông.',
    ttsSummary: 'Quẻ số 8, Thượng Cát, Bát Phương Tụ Tài. Quý nhân phù trợ, công việc làm ăn phát đạt, bốn mùa hưng vượng.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nTín chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Mã Đáo Thành Công — Thuận Buồm Xuôi Gió',
    poem: 'Ngựa thần tung vó vượt ngàn khơi\nTài lộc đưa về sáng khắp nơi\nĐơn hàng tấp nập kho đầy ắp\nGia đình hạnh phúc rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán đắt hàng, khách khứa nườm nượp, người thân mạnh khỏe.',
    ttsSummary: 'Quẻ số 18, Thượng Cát, Mã Đáo Thành Công. Buôn bán đắt hàng, tài lộc dồi dào, gia đình hạnh phúc.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Thần Tài Gõ Cửa — Phúc Tinh Cao Chiếu',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nGia tiên phù hộ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Thần Tài Gõ Cửa. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Phát Song Hành — Phú Quý Vinh Hoa',
    poem: 'Lộc Phát song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành dâng lễ thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Phát Song Hành. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Cửu Cửu Đại Cát — Vạn Sự Viên Thành',
    poem: 'Chín tầng mây đỏ ánh kim quang\nÂm dương thuận lý độ nhân gian\nTín chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Cửu Cửu Đại Cát. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

// ============================================================================
// 2. HYBRID VIETNAMESE TTS MANAGER (ZEROTTS + CLOUD VI TTS CACHE + BROWSER)
// ============================================================================
class HybridTTSManager {
  constructor() {
    this.proc = null;
    this.ready = true;
    this.useZeroTts = false;
    this.status = 'ready';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'Cloud-Vi-TTS / ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.reqCounter = 0;
    this.buffer = '';
    this.tryStartZeroTtsWorker();
  }

  tryStartZeroTtsWorker() {
    const venvPy = path.join(__dirname, '.venv', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'tts_worker.py');
    if (!fs.existsSync(venvPy) || !fs.existsSync(scriptPath)) {
      console.log('[TTS] Sử dụng chế độ Giọng Đọc AI Tiếng Việt (Cloud TTS Cache + Web Speech) — sẵn sàng 100%!');
      return;
    }

    console.log(`[ZeroTTS] Phát hiện .venv, đang khởi chạy worker với ${venvPy}...`);
    this.proc = spawn(venvPy, [scriptPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    this.proc.on('exit', () => {
      this.useZeroTts = false;
      this.ready = true;
      this.status = 'ready';
    });
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'ready') {
        this.useZeroTts = true;
        this.ready = true;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.model = msg.model || 'zeroweight-ai/ZeroTTS';
        console.log(`[ZeroTTS] Sẵn sàng! Giọng: ${this.voice}`);
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'result' && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
      }
    } catch (_) {}
  }

  getStatus() {
    return {
      ready: true,
      status: this.status,
      engine: this.useZeroTts ? 'ZeroTTS (Mai Chi)' : 'AI Voice Tiếng Việt (Cache MP3)',
      voice: state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model
    };
  }

  // Giọng đọc tự nhiên Apple Neural Linh trên macOS (tự nhiên, ngữ điệu chuẩn, không bị giọng chị Google)
  synthesizeWithMacVoice(text) {
    return new Promise((resolve) => {
      const clean = String(text || '').trim().slice(0, 250);
      if (!clean) return resolve({ ok: false, error: 'Empty text' });

      const hash = crypto.createHash('sha1').update(`mac_linh_v2::${clean}`).digest('hex').slice(0, 20);
      const fileName = `linh_${hash}.wav`;
      const filePath = path.join(TTS_CACHE_DIR, fileName);

      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
        return resolve({
          ok: true,
          cached: true,
          voice: 'linh',
          file: fileName,
          url: `/tts-cache/${fileName}`
        });
      }

      const tempAiff = path.join('/tmp', `say_${hash}.aiff`);
      const say = spawn('/usr/bin/say', ['-v', 'Linh', '-o', tempAiff, clean]);

      say.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempAiff)) {
          const conv = spawn('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', tempAiff, filePath]);
          conv.on('close', (cCode) => {
            try { fs.unlinkSync(tempAiff); } catch (_) {}
            if (cCode === 0 && fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
              return resolve({
                ok: true,
                cached: false,
                voice: 'linh',
                file: fileName,
                url: `/tts-cache/${fileName}`
              });
            }
            resolve({ ok: false });
          });
          conv.on('error', () => {
            try { fs.unlinkSync(tempAiff); } catch (_) {}
            resolve({ ok: false });
          });
        } else {
          try { if (fs.existsSync(tempAiff)) fs.unlinkSync(tempAiff); } catch (_) {}
          resolve({ ok: false });
        }
      });
      say.on('error', () => resolve({ ok: false }));
    });
  }

  fetchGoogleTtsMp3(text) {
    return new Promise((resolve) => {
      const clean = String(text || '').trim().slice(0, 190);
      if (!clean) return resolve({ ok: false, error: 'Empty text' });

      const hash = crypto.createHash('sha1').update(`vi_v2::${clean}`).digest('hex').slice(0, 20);
      const fileName = `vi_${hash}.mp3`;
      const filePath = path.join(TTS_CACHE_DIR, fileName);

      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 250) {
        return resolve({
          ok: true,
          cached: true,
          voice: 'maichi',
          file: fileName,
          url: `/tts-cache/${fileName}`
        });
      }

      const encoded = encodeURIComponent(clean);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encoded}`;

      const req = https.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          timeout: 6000
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return resolve({
              ok: true,
              fallbackBrowserTts: true,
              voice: 'maichi',
              text: clean
            });
          }
          const chunks = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (buf.length > 250) {
              fs.writeFileSync(filePath, buf);
              resolve({
                ok: true,
                cached: false,
                voice: 'maichi',
                file: fileName,
                url: `/tts-cache/${fileName}`
              });
            } else {
              resolve({
                ok: true,
                fallbackBrowserTts: true,
                voice: 'maichi',
                text: clean
              });
            }
          });
        }
      );

      req.on('error', () => {
        resolve({
          ok: true,
          fallbackBrowserTts: true,
          voice: 'maichi',
          text: clean
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: true,
          fallbackBrowserTts: true,
          voice: 'maichi',
          text: clean
        });
      });
    });
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || state.settings.ttsVoice || 'maichi').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;

    if (this.inflight.has(dedupKey)) {
      return this.inflight.get(dedupKey);
    }

    const promise = (async () => {
      if (this.useZeroTts && this.proc) {
        const zeroRes = await new Promise((resolve) => {
          const id = ++this.reqCounter;
          const timer = setTimeout(() => {
            this.pending.delete(id);
            resolve({ ok: false });
          }, 12000);
          this.pending.set(id, { resolve, timer });
          this.proc.stdin.write(JSON.stringify({ id, text: cleanText, voice }) + '\n');
        });
        if (zeroRes && zeroRes.ok) return zeroRes;
      }
      if (process.platform === 'darwin') {
        const macRes = await this.synthesizeWithMacVoice(cleanText);
        if (macRes && macRes.ok) return macRes;
      }
      return await this.fetchGoogleTtsMp3(cleanText);
    })().finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

// ============================================================================
// 3. TRẠNG THÁI ĐÀN TRÀNG HOÁ VÀNG & BẢNG VÀNG CÔNG ĐỨC LỘC TÀI
// ============================================================================
const DEFAULT_STATE = {
  totalIncense: 268,
  totalVotiveBurned: 688,
  totalMerit: 368880,
  dailyMeritTarget: 1000000,
  dailyMeritCurrent: 368880,
  woodenFishHits: 520,
  bellRings: 68,
  lanternCount: 36,
  fortuneCount: 18,
  activeIncenseSticks: 9,
  fireIntensity: 0.75,
  haloIntensity: 0.65,
  offerings: {
    gold_ingot: 128,
    hell_money: 96,
    royal_robe: 24,
    sacred_horse: 18,
    five_elements_tray: 12,
    golden_tech: 9,
    luxury_villa_car: 6,
    dragon_treasury: 3
  },
  devotees: {
    'minhtam.88': {
      name: 'Gia Chủ Minh Tâm',
      uniqueId: 'minhtam.88',
      avatar: '',
      merit: 1680,
      incense: 18,
      votiveCount: 25,
      gifts: 5,
      lastWish: 'Thành tâm hoá vàng kính biếu Gia Tiên, cầu buôn may bán đắt'
    },
    'hoangnam.bds': {
      name: 'Hoàng Nam BĐS',
      uniqueId: 'hoangnam.bds',
      avatar: '',
      merit: 1250,
      incense: 12,
      votiveCount: 16,
      gifts: 3,
      lastWish: 'Hoá Biệt Thự & Siêu Xe cầu tháng này chốt 5 lô đất lớn'
    },
    'ngocanh.shop': {
      name: 'Ngọc Anh Chuyên Sỉ',
      uniqueId: 'ngocanh.shop',
      avatar: '',
      merit: 890,
      incense: 9,
      votiveCount: 12,
      gifts: 2,
      lastWish: 'Cầu Thần Tài độ trì đơn đi tấp nập, tiền về đầy kho'
    },
    'thanhha.99': {
      name: 'Thanh Hà Lộc Phát',
      uniqueId: 'thanhha.99',
      avatar: '',
      merit: 680,
      incense: 9,
      votiveCount: 8,
      gifts: 1,
      lastWish: 'Cầu gia đạo bình an, cha mẹ trường thọ bách niên'
    },
    'quynh_finn': {
      name: 'Quỳnh_Finn',
      uniqueId: 'quynh_finn',
      avatar: '',
      merit: 520,
      incense: 6,
      votiveCount: 6,
      gifts: 1,
      lastWish: 'Thành tâm dâng lễ vàng mã cầu vạn sự hanh thông'
    },
    'tuan_anh_vip': {
      name: 'Tuấn Anh 8888',
      uniqueId: 'tuan_anh_vip',
      avatar: '',
      merit: 450,
      incense: 6,
      votiveCount: 5,
      gifts: 1,
      lastWish: 'Cầu tài lộc hanh thông, quý nhân phù trợ'
    }
  },
  recentEvents: [],
  communityMilestones: [
    { id: 'm1', threshold: 10000, name: 'Lò Sáng Khai Lộc', effect: 'furnace_glow', unlocked: true, enabled: true, description: 'Lò hoá vàng rực sáng hào quang kim bảo' },
    { id: 'm2', threshold: 50000, name: 'Khói Vàng Chiêu Tài', effect: 'golden_smoke', unlocked: false, enabled: true, description: 'Xuất hiện hiệu ứng khói vàng linh ứng' },
    { id: 'm3', threshold: 100000, name: 'Đại Lễ Hoá Vàng', effect: 'grand_ceremony', unlocked: false, enabled: true, description: 'Kích hoạt đại lễ hoá vàng mã toàn đàn' },
    { id: 'm4', threshold: 500000, name: 'Kim Long Triệu Phúc', effect: 'dragon_blessing', unlocked: false, enabled: true, description: 'Mở khoá sự kiện hoá vàng Kim Long đặc biệt' },
    { id: 'm5', threshold: 1000000, name: 'Đại Viên Mãn', effect: 'ultimate_merit', unlocked: false, enabled: true, description: 'Hoàn thành 1 triệu điểm công đức ngày' }
  ],
  votiveKeywordRules: [
    { id: 'kw_huong', keywords: ['hương', 'huong', 'thắp hương', 'dâng hương', 'thap huong'], itemKey: 'incense', name: 'Nén Hương Trầm', emoji: '🪔', count: 3, sound: 'chime', effect: 'incense', enabled: true, cooldownMs: 3000, replyText: 'thành tâm dâng nén hương trầm' },
    { id: 'kw_hoa', keywords: ['hoa', 'dâng hoa', 'bông hoa', 'hoa lễ', 'dang hoa'], itemKey: 'flower', name: 'Đoá Hoa Lễ', emoji: '🪷', count: 1, sound: 'chime', effect: 'flower', enabled: true, cooldownMs: 3000, replyText: 'thành tâm dâng đóa hoa tươi' },
    { id: 'kw_vang', keywords: ['vàng', 'vang', 'thỏi vàng', 'kim bảo', 'thoi vang'], itemKey: 'gold_ingot', name: 'Thỏi Vàng Kim Bảo', emoji: '🪙', count: 3, sound: 'crackle', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'hoá 3 thỏi vàng kim nguyên bảo' },
    { id: 'kw_tien', keywords: ['tiền', 'tien', 'tiền vàng', 'đô la', 'dola', 'tiền âm phủ'], itemKey: 'hell_money', name: 'Xấp Tiền Vàng Phú Quý', emoji: '💵', count: 5, sound: 'crackle', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'hoá xấp tiền vàng phú quý' },
    { id: 'kw_nha', keywords: ['nhà', 'nha', 'biệt thự', 'biet thu', 'nhà lầu', 'siêu xe', 'ô tô', 'oto'], itemKey: 'luxury_villa_car', name: 'Biệt Thự & Siêu Xe', emoji: '🏯', count: 1, sound: 'crackle', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'hoá biệt thự phố và siêu xe' },
    { id: 'kw_ngua', keywords: ['ngựa', 'ngua', 'xích thố', 'ngựa giấy'], itemKey: 'sacred_horse', name: 'Ngựa Giấy Xích Thố', emoji: '🐎', count: 1, sound: 'crackle', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'hoá ngựa thần xích thố' },
    { id: 'kw_ao', keywords: ['áo', 'ao', 'quần áo', 'áo quan', 'mũ áo', 'hia quan'], itemKey: 'royal_robe', name: 'Bộ Mũ Áo Quan Thần', emoji: '👘', count: 1, sound: 'crackle', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'hoá bộ mũ áo hia quan thần' },
    { id: 'kw_hoa_act', keywords: ['hóa', 'hoá', 'đốt', 'đốt vàng', 'dot vang', 'hoá vàng', 'hoa vang'], itemKey: 'gold_ingot', name: 'Lễ Hoá Vàng', emoji: '🔥', count: 3, sound: 'fire_burst', effect: 'furnace_boost', enabled: true, cooldownMs: 2500, replyText: 'tiếp lửa lò hoá vàng bùng sáng' },
    { id: 'kw_le', keywords: ['lễ', 'le', 'mâm lễ', 'dâng lễ', 'bàn lễ', 'ngũ phương'], itemKey: 'five_elements_tray', name: 'Mâm Lễ Ngũ Phương', emoji: '👑', count: 1, sound: 'chime', effect: 'votive', enabled: true, cooldownMs: 3000, replyText: 'dâng mâm lễ vàng mã ngũ phương' },
    { id: 'kw_binh_an', keywords: ['bình an', 'binh an', 'an lành', 'sức khỏe', 'suc khoe', 'mạnh khỏe'], itemKey: 'prayer_scroll', name: 'Sớ Cầu Bình An', emoji: '📜', count: 1, sound: 'chime', effect: 'blessing', enabled: true, cooldownMs: 3000, replyText: 'dâng sớ cầu nguyện gia quyến bình an' },
    { id: 'kw_tai_loc', keywords: ['tài lộc', 'tai loc', 'buôn may bán đắt', 'đắt hàng', 'dat hang', 'kinh doanh', 'chốt đơn'], itemKey: 'prayer_scroll', name: 'Sớ Cầu Tài Lộc', emoji: '📜', count: 1, sound: 'chime', effect: 'blessing', enabled: true, cooldownMs: 3000, replyText: 'dâng sớ cầu kinh doanh buôn may bán đắt' },
    { id: 'kw_to_tien', keywords: ['tổ tiên', 'to tien', 'gia tiên', 'tưởng nhớ', 'cửu huyền', 'ông bà', 'cha mẹ'], itemKey: 'prayer_scroll', name: 'Sớ Tưởng Nhớ Gia Tiên', emoji: '📜', count: 1, sound: 'chime', effect: 'blessing', enabled: true, cooldownMs: 3000, replyText: 'thành kính tưởng nhớ Cửu Huyền Thất Tổ' }
  ],
  furnaceStatus: {
    state: 'idle',
    label: 'Lò đang hoạt động',
    temperature: 368,
    itemsBurnedThisSession: 688,
    lastAction: 'Hoạt động bình thường'
  },
  ceremonySchedule: [
    { id: 'cer_1', time: '19:00', name: 'Khai Lễ & Nghinh Phúc', durationMin: 15, autoTrigger: true, status: 'completed', script: 'Đại Hồng Chung ngân vang khai mở đàn tràng hoá vàng' },
    { id: 'cer_2', time: '19:15', name: 'Hoá Vàng Đợt 1 — Chiêu Tài', durationMin: 15, autoTrigger: true, status: 'active', script: 'Hoá vàng mã kim bảo nghinh đón tài lộc cho gia quyến' },
    { id: 'cer_3', time: '19:30', name: 'Đại Lễ Hoá Vàng Kim Long', durationMin: 15, autoTrigger: true, status: 'pending', script: 'Khai mở kim khố thiên đình, trăm điều đại cát' },
    { id: 'cer_4', time: '19:45', name: 'Hồi Hướng Công Đức & Tri Ân', durationMin: 15, autoTrigger: true, status: 'pending', script: 'Tạ ơn Gia Tiên và Thần Tài, hồi hướng công đức bình an' }
  ],
  activePoll: {
    id: null,
    active: false,
    question: 'Bình chọn vật phẩm hoá vàng đợt tiếp theo (Bình luận 1, 2, 3, 4):',
    options: [
      { id: 1, text: 'Vàng Bạc Kim Bảo', itemKey: 'gold_ingot', emoji: '🪙', votes: 12 },
      { id: 2, text: 'Biệt Thự & Siêu Xe', itemKey: 'luxury_villa_car', emoji: '🏯', votes: 8 },
      { id: 3, text: 'Mũ Áo Quan Thần', itemKey: 'royal_robe', emoji: '👘', votes: 5 },
      { id: 4, text: 'Ngựa Xe Thần Tốc', itemKey: 'sacred_horse', emoji: '🐎', votes: 9 }
    ],
    voters: {},
    totalVotes: 34,
    expiresAt: 0,
    durationSeconds: 60,
    winner: null
  },
  communityGate: {
    name: 'Cổng Trời Kim Long Khai Khố',
    targetHearts: 50000,
    currentHearts: 18650,
    status: 'half_open',
    levels: [
      { threshold: 5000, name: 'Cổng Bắt Đầu Phát Sáng', code: 'charging' },
      { threshold: 20000, name: 'Cổng Mở Một Phần', code: 'half_open' },
      { threshold: 50000, name: 'Cổng Mở Hoàn Toàn', code: 'fully_open' },
      { threshold: 100000, name: 'Kích Hoạt Đại Lễ Kim Long', code: 'grand_ceremony' }
    ]
  },
  giftMappings: [
    { id: 'tier_small', name: 'Quà Nhỏ (1-9 Xu: Hoa, Tim)', minCoins: 1, maxCoins: 9, itemKey: 'gold_ingot', count: 3, effectTier: 'tier1', sound: 'crackle', announcement: 'Hoá 3 Thoi Vàng Kim Bảo' },
    { id: 'tier_medium', name: 'Quà Vừa (10-49 Xu: Nước hoa, Kẹo)', minCoins: 10, maxCoins: 49, itemKey: 'sacred_horse', count: 1, effectTier: 'tier2', sound: 'bell', announcement: 'Hoá Ngựa Thần Xích Thố' },
    { id: 'tier_large', name: 'Quà Lớn (50-99 Xu: Bắn tim, Corgi)', minCoins: 50, maxCoins: 99, itemKey: 'luxury_villa_car', count: 1, effectTier: 'tier3', sound: 'chime', announcement: 'Hoá Biệt Thự & Siêu Xe Vàng' },
    { id: 'tier_grand', name: 'Đại Quà (100+ Xu: Trống, Kim Long, Mũ)', minCoins: 100, maxCoins: 999999, itemKey: 'dragon_treasury', count: 1, effectTier: 'tier4', sound: 'grand_fanfare', announcement: 'Đại Lễ Kim Long Khai Khố' }
  ],
  blessingResponses: {
    'bình an': 'Nguyện cầu chư vị Tôn Thần và Gia Tiên gia hộ cho gia quyến bốn mùa thân tâm an lạc, tai qua nạn khỏi, vạn sự hanh thông.',
    'tài lộc': 'Tâm thành dâng lễ, kính chúc gia chủ buôn may bán đắt, khách khứa nườm nượp, tiền tài sung túc đầy kho.',
    'tổ tiên': 'Uống nước nhớ nguồn, lòng thành kính biếu Cửu Huyền Thất Tổ, nguyện gia tiên phù hộ độ trì con cháu hiếu thuận thành tài.',
    'sức khỏe': 'Cầu cho song thân phụ mẫu và gia đình sức khỏe dồi dào, an khang trường thọ, bình an vô sự.'
  },
  welcomeSettings: {
    enabled: true,
    cooldownMs: 6000,
    lastWelcomeTime: 0,
    welcomeTemplate: 'Hoan hỷ thiện tín đáo Đàn Tràng Hoá Vàng Online!',
    suggestedKeywords: ['HƯƠNG', 'HOA', 'VÀNG', 'BÌNH AN', 'TỔ TIÊN'],
    showActiveEvent: true
  },
  communityQuests: [
    {
      id: 'quest_incense_100',
      title: 'Dâng 100 Nén Hương Trầm',
      description: 'Cộng đồng cùng dâng 100 nén hương cầu phúc',
      targetType: 'incense',
      targetAmount: 100,
      currentAmount: 42,
      active: true,
      completed: false,
      rewardText: 'Kích hoạt Khói Trầm Kim Quang toàn Đàn Tràng!'
    },
    {
      id: 'quest_flower_300',
      title: 'Dâng 300 Đóa Hoa Sen',
      description: 'Cộng đồng cùng thả 300 hoa sen thanh tịnh',
      targetType: 'flower',
      targetAmount: 300,
      currentAmount: 125,
      active: false,
      completed: false,
      rewardText: 'Mưa Cánh Sen Hoàng Kim chúc phúc vạn sự hanh thông!'
    },
    {
      id: 'quest_hearts_10k',
      title: 'Tích Lũy 10.000 Tim Công Đức',
      description: 'Cùng chung tay thả tim đạt 10.000 điểm Lộc',
      targetType: 'hearts',
      targetAmount: 10000,
      currentAmount: 4680,
      active: false,
      completed: false,
      rewardText: 'Lò Hoá Vàng Bùng Cháy Hào Quang Cát Tường!'
    },
    {
      id: 'quest_votive_50',
      title: 'Hoá 50 Thỏi Vàng Kim Bảo',
      description: 'Cộng đồng cùng hoá 50 thỏi vàng cúng dường',
      targetType: 'votive',
      targetAmount: 50,
      currentAmount: 18,
      active: false,
      completed: false,
      rewardText: 'Khai mở Kim Ngân Tài Lộc nghinh đón Thần Tài!'
    }
  ],
  companionSettings: {
    enabled: true,
    tiers: [
      { id: 'companion_3d', name: 'Hữu Duyên 3 Ngày', badge: '🪙 Hữu Duyên', minDays: 3, minSessions: 3, color: '#f4c150' },
      { id: 'companion_7d', name: 'Thiện Tín 7 Ngày', badge: '✨ Thiện Tín', minDays: 7, minSessions: 7, color: '#ffb347' },
      { id: 'companion_30d', name: 'Đại Đạo Tràng 30 Ngày', badge: '🐉 Đại Đạo Tràng', minDays: 30, minSessions: 30, color: '#ff5252' },
      { id: 'companion_vip', name: 'Bảo Trợ Đàn Tràng', badge: '👑 Hộ Trì', minMerit: 5000, color: '#e0a96d' }
    ]
  },
  silkScrollSettings: {
    enabled: true,
    displayDurationMs: 6500,
    categories: [
      { key: 'ancestor', name: 'Tri Ân & Tưởng Nhớ Gia Tiên', title: 'SỚ KÍNH BIẾU CỬU HUYỀN THẤT TỔ', stamp: 'GIA TIÊN PHÙ HỘ' },
      { key: 'peace', name: 'Cầu Bình An & Sức Khỏe', title: 'SỚ CẦU BÌNH AN BỐN MÙA', stamp: 'THÂN TÂM AN LẠC' },
      { key: 'prosperity', name: 'Cầu Tài Lộc & Kinh Doanh', title: 'SỚ CHIÊU TÀI TẤN BẢO', stamp: 'ĐẮT HÀNG ĐẦY KHO' },
      { key: 'blessing', name: 'Cầu Công Danh & Đỗ Đạt', title: 'SỚ CẦU VẠN SỰ VIÊN THÀNH', stamp: 'CÔNG THÀNH DANH TOẠI' }
    ]
  },
  miniEventEngine: {
    enabled: true,
    intervalMinutes: 10,
    activeEvent: null,
    availableEvents: [
      {
        id: 'incense_rush',
        name: 'Thắp Hương Đạo Tràng x2 Lộc Đức',
        type: 'incense',
        durationSeconds: 60,
        multiplier: 2,
        bannerText: '🔥 ĐANG DIỄN RA: 60s THẮP HƯƠNG x2 ĐIỂM CÔNG ĐỨC!',
        description: 'Mọi nén hương dâng lên đều nhân đôi điểm công đức và lộc may'
      },
      {
        id: 'golden_heart_storm',
        name: 'Bão Tim Kim Quang — Mở Cổng Trời',
        type: 'hearts',
        durationSeconds: 45,
        multiplier: 2,
        bannerText: '✨ BÃO TIM KIM QUANG: Thả tim mở Cổng Trời gấp đôi!',
        description: 'Tất cả lượt thả tim nhân đôi tiến độ mở Cổng Trời'
      },
      {
        id: 'lotus_offering',
        name: 'Đại Lễ Dâng Sen Thanh Tịnh',
        type: 'flower',
        durationSeconds: 60,
        multiplier: 2,
        bannerText: '🪷 60s ĐẠI LỄ DÂNG SEN: Hoa nở khắp đàn tràng!',
        description: 'Comment HOA để dâng hoa sen x2 công đức'
      },
      {
        id: 'rapid_burn',
        name: 'Hoá Vàng Thần Tốc — Bùng Sáng Kim Khố',
        type: 'votive',
        durationSeconds: 45,
        multiplier: 2,
        bannerText: '🪙 45s HOÁ VÀNG THẦN TỐC: Lửa bùng sáng rực rỡ!',
        description: 'Mọi thỏi vàng hoá đều sinh thêm hào quang kim bảo'
      }
    ]
  },
  stageScene: {
    current: 'hoavang',
    autoSwitchEnabled: true,
    availableScenes: [
      { id: 'hoavang', name: 'Sân Hoá Vàng Cổ Kính', icon: '🔥', desc: 'Sân gạch cổ, lò hoá vàng rực sáng hào quang' },
      { id: 'altar', name: 'Điện Thờ Gia Tiên Trang Nghiêm', icon: '🏛️', desc: 'Bàn thờ sơn son thếp vàng, bát hương trầm, nến sáng' },
      { id: 'amitabha', name: 'Bảo Điện Quang Minh', icon: '✨', desc: 'Không gian sen vàng, hào quang Phật quang phổ chiếu' },
      { id: 'temple', name: 'Cổng Tam Quan Chùa Cổ', icon: '⛩️', desc: 'Cổng chùa cổ kính dưới ánh hoàng hôn thiêng liêng' }
    ]
  },
  smartPromptSettings: {
    enabled: true,
    intervalSeconds: 25,
    activePrompt: 'Thành tâm dâng nén hương trầm — gõ HƯƠNG hoặc thả tim để tích lũy công đức!',
    rules: [
      {
        condition: 'poll_active',
        prompt: '🗳️ Bình chọn đang diễn ra! Hãy bình luận 1, 2, 3 hoặc 4 để chọn vật phẩm hoá tiếp theo!'
      },
      {
        condition: 'mini_event',
        prompt: '🔥 Đang diễn ra sự kiện nhân đôi công đức! Hãy thả tim và comment ngay!'
      },
      {
        condition: 'quest_active',
        prompt: '🎯 Đạo tràng đang chung tay hoàn thành nhiệm vụ! Gõ từ khóa để cùng đóng góp!'
      },
      {
        condition: 'gate_near',
        prompt: '✨ Cổng Trời Kim Long sắp mở khóa! Toàn thể tín chủ cùng thả tim bứt phá nào!'
      },
      {
        condition: 'idle',
        prompts: [
          '🪔 Bình luận "HƯƠNG" để dâng nén trầm thơm lên Đàn Tràng',
          '🪷 Bình luận "HOA" để dâng đóa sen thanh tịnh cầu bình an',
          '🪙 Bình luận "VÀNG" để dâng thỏi vàng kim bảo chiêu tài tấn bảo',
          '📜 Bình luận "BÌNH AN" hoặc "TỔ TIÊN" để dâng sớ cầu gia đạo bình an',
          '🎋 Bình luận "XIN QUẺ" để thỉnh Quẻ Linh Xăm Tài Lộc đầu ngày',
          '🔥 Thả tim liên tục để tiếp lửa lò hoá vàng và tích luỹ điểm Lộc Đức'
        ]
      }
    ]
  },
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.30,
    ttsVolume: 0.95,
    smokeDensity: 1.0,
    stageBg: 'hoavang',
    autoSim: true,
    autoSimIntervalMs: 3800
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: 'quangvangma1',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        dailyMeritTarget: saved.dailyMeritTarget || DEFAULT_STATE.dailyMeritTarget,
        dailyMeritCurrent: saved.dailyMeritCurrent || saved.totalMerit || DEFAULT_STATE.dailyMeritCurrent,
        devotees: saved.devotees && Object.keys(saved.devotees).length > 0 ? saved.devotees : DEFAULT_STATE.devotees,
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: {
          ...DEFAULT_STATE.settings,
          ...(saved.settings || {}),
          autoSim: saved.settings?.autoSim !== false
        },
        tiktok: { ...DEFAULT_STATE.tiktok },
        communityMilestones: saved.communityMilestones && saved.communityMilestones.length > 0 ? saved.communityMilestones : DEFAULT_STATE.communityMilestones,
        votiveKeywordRules: saved.votiveKeywordRules && saved.votiveKeywordRules.length > 0 ? saved.votiveKeywordRules : DEFAULT_STATE.votiveKeywordRules,
        furnaceStatus: { ...DEFAULT_STATE.furnaceStatus, ...(saved.furnaceStatus || {}) },
        ceremonySchedule: saved.ceremonySchedule && saved.ceremonySchedule.length > 0 ? saved.ceremonySchedule : DEFAULT_STATE.ceremonySchedule,
        activePoll: { ...DEFAULT_STATE.activePoll, ...(saved.activePoll || {}) },
        communityGate: { ...DEFAULT_STATE.communityGate, ...(saved.communityGate || {}) },
        giftMappings: saved.giftMappings && saved.giftMappings.length > 0 ? saved.giftMappings : DEFAULT_STATE.giftMappings,
        blessingResponses: { ...DEFAULT_STATE.blessingResponses, ...(saved.blessingResponses || {}) },
        welcomeSettings: { ...DEFAULT_STATE.welcomeSettings, ...(saved.welcomeSettings || {}) },
        communityQuests: saved.communityQuests && saved.communityQuests.length > 0 ? saved.communityQuests : DEFAULT_STATE.communityQuests,
        companionSettings: { ...DEFAULT_STATE.companionSettings, ...(saved.companionSettings || {}) },
        silkScrollSettings: { ...DEFAULT_STATE.silkScrollSettings, ...(saved.silkScrollSettings || {}) },
        miniEventEngine: { ...DEFAULT_STATE.miniEventEngine, ...(saved.miniEventEngine || {}) },
        stageScene: { ...DEFAULT_STATE.stageScene, ...(saved.stageScene || {}) },
        smartPromptSettings: { ...DEFAULT_STATE.smartPromptSettings, ...(saved.smartPromptSettings || {}) }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

function pruneDevoteesIfNeeded() {
  if (!state.devotees) return;
  const keys = Object.keys(state.devotees);
  if (keys.length <= 2000) return;

  // Giữ lại top 1500 tín chủ có công đức cao nhất hoặc tương tác gần nhất
  const sorted = keys.map((k) => ({ k, dev: state.devotees[k] }));
  sorted.sort((a, b) => {
    const meritDiff = (b.dev?.merit || 0) - (a.dev?.merit || 0);
    if (meritDiff !== 0) return meritDiff;
    return (b.dev?.lastSeen || 0) - (a.dev?.lastSeen || 0);
  });

  const keepKeys = new Set(sorted.slice(0, 1500).map((x) => x.k));
  for (const k of keys) {
    if (!keepKeys.has(k)) {
      delete state.devotees[k];
    }
  }
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    pruneDevoteesIfNeeded();
    const toSave = {
      totalIncense: state.totalIncense,
      totalVotiveBurned: state.totalVotiveBurned,
      totalMerit: state.totalMerit,
      dailyMeritTarget: state.dailyMeritTarget,
      dailyMeritCurrent: state.dailyMeritCurrent,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings,
      communityMilestones: state.communityMilestones,
      votiveKeywordRules: state.votiveKeywordRules,
      furnaceStatus: state.furnaceStatus,
      ceremonySchedule: state.ceremonySchedule,
      activePoll: state.activePoll,
      communityGate: state.communityGate,
      giftMappings: state.giftMappings,
      welcomeSettings: state.welcomeSettings,
      communityQuests: state.communityQuests,
      companionSettings: state.companionSettings,
      silkScrollSettings: state.silkScrollSettings,
      miniEventEngine: state.miniEventEngine,
      stageScene: state.stageScene,
      smartPromptSettings: state.smartPromptSettings
    };
    const tempPath = `${STATE_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(toSave, null, 2), 'utf8');
      await fs.promises.rename(tempPath, STATE_FILE);
    } catch (e) {
      console.error('[State] Lỗi lưu file nguyên tử (atomic write):', e.message);
      try {
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
      } catch (_) {}
    }
  }, 1000);
}

function calculateDevoteeBadge(dev) {
  if (!dev) return '🪙 Hữu Duyên';
  const merit = Number(dev.merit) || 0;
  const sessions = Number(dev.sessionsCount) || 1;
  const streak = Number(dev.streakDays) || 1;
  if (merit >= 5000) return '👑 Bảo Trợ Đàn Tràng';
  if (sessions >= 30 || streak >= 30) return '🐉 Đại Đạo Tràng 30 Ngày';
  if (sessions >= 7 || streak >= 7) return '✨ Thiện Tín 7 Ngày';
  if (sessions >= 3 || streak >= 3) return '🪙 Hữu Duyên 3 Ngày';
  return '🌿 Tín Chủ Thành Tâm';
}

function getLeaderboard(limit = 24) {
  return Object.values(state.devotees)
    .sort((a, b) => b.merit - a.merit)
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      merit: d.merit,
      incense: d.incense || 0,
      votiveCount: d.votiveCount || 0,
      lastWish: d.lastWish || '',
      badge: d.badge || calculateDevoteeBadge(d),
      sessionsCount: d.sessionsCount || 1,
      streakDays: d.streakDays || 1
    }));
}

// Bộ lọc chặn ký tự lạ & từ ngữ phản cảm
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const BAD_WORDS_RE = /(đá dái|địt|lồn|cặc|đm|vcl|vl|yamate|i cư|lừa đảo|lừa à|te-le gram|telegram|bố là trùm)/i;

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw);
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (BAD_WORDS_RE.test(s)) return true;
  return false;
}

function sanitizeUserName(rawName) {
  const normalized = String(rawName || '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || BAD_WORDS_RE.test(normalized)) {
    return 'Tín Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return 'Tín Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const cleaned = String(rawWish)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 120);

  if (!cleaned || BAD_WORDS_RE.test(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function pushPriorityNotification(text, priority = 2, icon = '✨', durationMs = 4500) {
  broadcastNotification('notification.priority', { text, priority, icon, durationMs });
}

function broadcastReturningDevotee(dev) {
  if (!state.companionSettings?.enabled) return;
  const msg = `Tri ân ${dev.name} — ${dev.badge} đã quay lại đồng hành cùng Đàn Tràng!`;
  pushPriorityNotification(msg, 2, '✨', 5500);
  broadcastNotification('temple.returningDevotee', {
    user: dev.name,
    uniqueId: dev.uniqueId,
    avatar: dev.avatar,
    badge: dev.badge,
    sessionsCount: dev.sessionsCount || 1,
    streakDays: dev.streakDays || 1,
    merit: dev.merit
  });
}

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, votiveDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const key = (uniqueId || displayName).slice(0, 40);
  const now = Date.now();
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      votiveCount: 0,
      gifts: 0,
      lastWish: '',
      firstSeen: now,
      lastSeen: now,
      sessionsCount: 1,
      streakDays: 1,
      badge: '🪙 Hữu Duyên 3 Ngày',
      greetedThisSession: true
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;

  // Cập nhật thống kê gắn bó & chuyên cần
  if (!dev.firstSeen) dev.firstSeen = now;
  const lastSeen = dev.lastSeen || 0;
  if (now - lastSeen > 30 * 60 * 1000) {
    dev.sessionsCount = (dev.sessionsCount || 1) + 1;
    const lastDate = new Date(lastSeen).toDateString();
    const todayDate = new Date(now).toDateString();
    if (lastDate !== todayDate) {
      const yesterday = new Date(now - 86400000).toDateString();
      if (lastDate === yesterday) {
        dev.streakDays = (dev.streakDays || 1) + 1;
      } else {
        dev.streakDays = 1;
      }
    }
  }
  dev.lastSeen = now;

  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.votiveCount = (dev.votiveCount || 0) + votiveDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;
  dev.badge = calculateDevoteeBadge(dev);

  // Nếu là thiện tín quay lại (đã tham gia từ 2 phiên hoặc 2 ngày) và chưa được tri ân trong phiên này
  if ((dev.sessionsCount >= 2 || dev.streakDays >= 2) && !dev.greetedThisSession) {
    dev.greetedThisSession = true;
    broadcastReturningDevotee(dev);
  }

  const prevMerit = state.dailyMeritCurrent || state.totalMerit || 0;
  state.totalMerit += meritDelta;
  state.dailyMeritCurrent = (state.dailyMeritCurrent || 0) + meritDelta;
  state.totalVotiveBurned = (state.totalVotiveBurned || 0) + votiveDelta;
  state.haloIntensity = Math.min(1.0, 0.45 + (state.totalMerit % 1000) / 1400);

  checkMilestoneProgress(prevMerit, state.dailyMeritCurrent);
  return dev;
}

function checkMilestoneProgress(previousMerit, newMerit) {
  if (!state.communityMilestones || !Array.isArray(state.communityMilestones)) return;
  for (const m of state.communityMilestones) {
    if (m.enabled && !m.unlocked && newMerit >= m.threshold) {
      m.unlocked = true;
      const tts = `Đại công đức viên mãn! Đàn tràng vừa mở khóa mốc ${m.name}, đạt ${Number(m.threshold).toLocaleString('vi-VN')} điểm Lộc Đức! Xin tán thán công đức toàn thể đạo tràng!`;
      const event = pushEventLog({
        type: 'milestoneUnlocked',
        milestone: m,
        user: 'Toàn Đạo Tràng',
        ttsText: tts,
        merit: 0,
        wish: m.description
      });
      if (m.effect === 'golden_smoke') {
        setFurnaceState('burning', 'Mở khoá Khói Vàng Chiêu Tài');
      } else if (m.effect === 'grand_ceremony' || m.effect === 'dragon_blessing' || m.effect === 'ultimate_merit') {
        setFurnaceState('grand_ceremony', `Mở khoá ${m.name}`);
      }
      broadcastNotification('temple.milestoneUnlocked', { milestone: m, state: getPublicState() });
      broadcastNotification('temple.event', { event, state: getPublicState() });
    }
  }
}

let furnaceResetTimer = null;
function setFurnaceState(newState, reason = '') {
  if (!state.furnaceStatus) {
    state.furnaceStatus = {
      state: 'idle',
      label: 'Lò đang hoạt động',
      temperature: 368,
      itemsBurnedThisSession: 688,
      lastAction: ''
    };
  }
  state.furnaceStatus.state = newState;
  state.furnaceStatus.lastAction = reason || newState;
  const labels = {
    idle: 'Lò đang hoạt động',
    heating: 'Lò đang nóng lên',
    preparing: 'Chuẩn bị hoá vàng',
    burning: 'Lò đang hoá vàng',
    completed: 'Hoàn thành đợt hoá',
    grand_ceremony: 'Đại Lễ Hoá Vàng Kim Long'
  };
  state.furnaceStatus.label = labels[newState] || newState;

  if (newState === 'burning') {
    state.furnaceStatus.temperature = Math.min(999, (state.furnaceStatus.temperature || 368) + 40);
    clearTimeout(furnaceResetTimer);
    furnaceResetTimer = setTimeout(() => {
      setFurnaceState('heating', 'Lò giữ nhiệt sau khi hoá');
      furnaceResetTimer = setTimeout(() => {
        setFurnaceState('idle', 'Lò hoạt động bình thường');
      }, 5000);
    }, 4500);
  } else if (newState === 'grand_ceremony') {
    state.furnaceStatus.temperature = 999;
    clearTimeout(furnaceResetTimer);
    furnaceResetTimer = setTimeout(() => {
      setFurnaceState('heating', 'Hoàn tất đại lễ');
      furnaceResetTimer = setTimeout(() => {
        setFurnaceState('idle', 'Lò hoạt động bình thường');
      }, 7000);
    }, 12000);
  }

  broadcastNotification('furnace.update', { furnace: state.furnaceStatus });
  saveState();
}

let pollExpireTimer = null;
function startLivePoll(question, options, durationSeconds = 60) {
  clearTimeout(pollExpireTimer);
  const now = Date.now();
  const durSec = Math.max(15, Math.min(300, Number(durationSeconds) || 60));
  state.activePoll = {
    id: `poll_${now}`,
    active: true,
    question: question || 'Bình chọn vật phẩm hoá vàng đợt tiếp theo (Bình luận 1, 2, 3, 4):',
    options: (options && options.length === 4 ? options : [
      { id: 1, text: 'Vàng Bạc Kim Bảo', itemKey: 'gold_ingot', emoji: '🪙', votes: 0 },
      { id: 2, text: 'Biệt Thự & Siêu Xe', itemKey: 'luxury_villa_car', emoji: '🏯', votes: 0 },
      { id: 3, text: 'Mũ Áo Quan Thần', itemKey: 'royal_robe', emoji: '👘', votes: 0 },
      { id: 4, text: 'Ngựa Xe Thần Tốc', itemKey: 'sacred_horse', emoji: '🐎', votes: 0 }
    ]),
    voters: {},
    totalVotes: 0,
    expiresAt: now + durSec * 1000,
    durationSeconds: durSec,
    winner: null
  };
  saveState();
  broadcastNotification('poll.update', { poll: getSanitizedPoll() });
  broadcastNotification('tts.play', {
    text: `Đàn tràng mở cuộc bình chọn: ${state.activePoll.question}. Thiện tín hãy bình luận phím 1, 2, 3 hoặc 4 để bình chọn!`,
    voice: state.settings?.ttsVoice || 'maichi'
  });

  pollExpireTimer = setTimeout(() => {
    endLivePoll();
  }, durSec * 1000);

  return state.activePoll;
}

function endLivePoll(manualWinnerId = null) {
  clearTimeout(pollExpireTimer);
  if (!state.activePoll || !state.activePoll.active) return state.activePoll;

  state.activePoll.active = false;
  let winner = null;
  if (manualWinnerId) {
    winner = state.activePoll.options.find((o) => o.id === Number(manualWinnerId));
  }
  if (!winner) {
    winner = [...state.activePoll.options].sort((a, b) => b.votes - a.votes)[0];
  }
  state.activePoll.winner = winner;

  // Tự động hoá vật phẩm chiến thắng vào lò!
  if (winner) {
    const ttsText = `Kết quả bình chọn: Vật phẩm ${winner.text} đã chiến thắng với số phiếu áp đảo! Xin kính mời toàn thể đạo tràng chứng kiến nghi thức hoá vàng!`;
    Rituals.burnVotive({
      user: 'Cộng Đồng Bình Chọn',
      uniqueId: 'poll_community',
      avatar: '',
      itemKey: winner.itemKey || 'gold_ingot',
      count: 5,
      wish: `Hoá 5 ${winner.text} do cộng đồng livestream đồng tâm bình chọn`,
      readTts: false
    });
    broadcastNotification('tts.play', {
      text: ttsText,
      voice: state.settings?.ttsVoice || 'maichi'
    });
  }

  saveState();
  broadcastNotification('poll.ended', { poll: getSanitizedPoll(), winner });
  return state.activePoll;
}

function castVote(uniqueId, voteChoice, voterName = 'Tín chủ') {
  if (!state.activePoll || !state.activePoll.active) return false;
  if (Date.now() > state.activePoll.expiresAt) {
    endLivePoll();
    return false;
  }
  const userKey = uniqueId || voterName;
  let chosenOption = null;
  const num = parseInt(voteChoice, 10);
  if (num >= 1 && num <= 4) {
    chosenOption = state.activePoll.options.find((o) => o.id === num);
  } else {
    const lower = String(voteChoice).toLowerCase();
    chosenOption = state.activePoll.options.find(
      (o) => lower.includes(o.text.toLowerCase()) || lower.includes(o.itemKey.toLowerCase())
    );
  }
  if (!chosenOption) return false;

  const previousVote = state.activePoll.voters[userKey];
  if (previousVote === chosenOption.id) {
    return false; // Đã vote rồi
  }
  if (previousVote) {
    const prevOpt = state.activePoll.options.find((o) => o.id === previousVote);
    if (prevOpt && prevOpt.votes > 0) prevOpt.votes -= 1;
  } else {
    state.activePoll.totalVotes += 1;
  }

  chosenOption.votes += 1;
  state.activePoll.voters[userKey] = chosenOption.id;

  broadcastNotification('poll.update', { poll: getSanitizedPoll() });
  return true;
}

function getSanitizedPoll() {
  if (!state.activePoll) return null;
  const { voters, ...rest } = state.activePoll;
  return {
    ...rest,
    votersCount: Object.keys(voters || {}).length,
    remainingSeconds: Math.max(0, Math.ceil((state.activePoll.expiresAt - Date.now()) / 1000))
  };
}

function triggerCeremony(ceremonyId) {
  const cer = state.ceremonySchedule?.find((c) => c.id === ceremonyId);
  if (!cer) return null;
  cer.status = 'active';

  // Tự động chuyển cảnh phù hợp với từng đại lễ
  if (state.stageScene?.autoSwitchEnabled) {
    if (cer.id === 'cer_1' || cer.name.includes('Khai Lễ')) {
      setStageScene('altar', `Nghi thức: ${cer.name}`);
    } else if (cer.id === 'cer_2' || cer.name.includes('Hoá Vàng')) {
      setStageScene('hoavang', `Nghi thức: ${cer.name}`);
    } else if (cer.id === 'cer_3' || cer.name.includes('Kim Long')) {
      setStageScene('amitabha', `Nghi thức: ${cer.name}`);
    } else if (cer.id === 'cer_4' || cer.name.includes('Hồi Hướng')) {
      setStageScene('temple', `Nghi thức: ${cer.name}`);
    }
  }

  const ttsText = `Chuông đồng ngân vang! Bắt đầu nghi thức: ${cer.name}! ${cer.script}. Kính mời thiện tín cùng thành tâm phát nguyện!`;
  setFurnaceState('grand_ceremony', `Nghi lễ: ${cer.name}`);

  const event = pushEventLog({
    type: 'ceremony',
    ceremony: cer,
    user: 'Đàn Tràng Hoá Vàng',
    ttsText,
    merit: 50,
    wish: cer.script
  });

  broadcastNotification('ceremony.start', { ceremony: cer, state: getPublicState() });
  broadcastNotification('temple.event', { event, state: getPublicState() });
  saveState();

  setTimeout(() => {
    cer.status = 'completed';
    saveState();
    broadcastNotification('ceremony.update', { ceremony: cer });
  }, (cer.durationMin || 15) * 60 * 1000);

  return cer;
}

// ============================================================================
// 3.5. HỆ THỐNG GIỮ CHÂN NGƯỜI XEM & TƯƠNG TÁC CỘNG ĐỒNG (FEATURES 12-18)
// ============================================================================

// Feature 12: Chào Đón Người Xem Mới (Welcome New Viewers)
let lastMemberWelcomeTime = 0;
function handleMemberJoin(user, uniqueId, avatar) {
  const dev = recordDevotee(user, uniqueId, avatar, 2, 0, 0, 0, 'Đã vào Đàn Tràng Hoá Vàng');
  const now = Date.now();
  const cooldown = state.welcomeSettings?.cooldownMs || 6000;
  
  if (state.welcomeSettings?.enabled && (now - lastMemberWelcomeTime >= cooldown)) {
    lastMemberWelcomeTime = now;
    
    let activeHint = '';
    if (state.miniEventEngine?.activeEvent) {
      activeHint = state.miniEventEngine.activeEvent.bannerText;
    } else {
      const activeQuest = state.communityQuests?.find((q) => q.active && !q.completed);
      if (activeQuest) {
        activeHint = `Cộng đồng đang chung tay: ${activeQuest.title}`;
      } else {
        activeHint = 'Hãy gõ HƯƠNG hoặc HOA để cùng dâng lễ đầu ngày';
      }
    }

    broadcastNotification('temple.welcomeMember', {
      user: dev.name,
      uniqueId: dev.uniqueId,
      avatar: dev.avatar,
      badge: dev.badge,
      template: state.welcomeSettings.welcomeTemplate,
      suggestedKeywords: state.welcomeSettings.suggestedKeywords || ['HƯƠNG', 'HOA', 'VÀNG', 'BÌNH AN'],
      activeHint
    });
  }
}

// Feature 13: Nhiệm Vụ Tương Tác Cộng Đồng (Community Co-op Quests)
function updateQuestProgress(targetType, amount = 1) {
  if (!state.communityQuests || !Array.isArray(state.communityQuests)) return;
  const activeQuest = state.communityQuests.find((q) => q.active && !q.completed && q.targetType === targetType);
  if (!activeQuest) return;

  activeQuest.currentAmount = (activeQuest.currentAmount || 0) + amount;
  if (activeQuest.currentAmount >= activeQuest.targetAmount && !activeQuest.completed) {
    activeQuest.completed = true;
    activeQuest.currentAmount = activeQuest.targetAmount;
    
    pushPriorityNotification(`🎉 HOÀN THÀNH NHIỆM VỤ: ${activeQuest.title}! ${activeQuest.rewardText}`, 1, '🏆', 7000);
    broadcastNotification('quest.completed', { quest: activeQuest });
    
    if (state.settings.ttsEnabled) {
      ttsManager.synthesize(`Chúc mừng toàn thể Đạo Tràng đã hoàn thành nhiệm vụ: ${activeQuest.title}! ${activeQuest.rewardText}`, 'maichi').then((res) => {
        if (res.ok) {
          broadcastNotification('tts.play', { text: res.text, voice: 'maichi', url: res.url, fallbackBrowserTts: res.fallbackBrowserTts });
        }
      });
    }

    // Tự động chuyển nhiệm vụ tiếp theo sau 12 giây
    setTimeout(() => {
      const pendingQuests = state.communityQuests.filter((q) => !q.completed);
      if (pendingQuests.length > 0) {
        state.communityQuests.forEach((q) => { q.active = false; });
        pendingQuests[0].active = true;
      } else {
        state.communityQuests.forEach((q) => { q.completed = false; q.currentAmount = 0; q.active = false; });
        state.communityQuests[0].active = true;
      }
      saveState();
      broadcastNotification('quest.update', { quests: state.communityQuests });
      broadcastNotification('temple.state', getPublicState());
    }, 12000);
  } else {
    broadcastNotification('quest.update', { quests: state.communityQuests });
  }
  saveState();
}

// Feature 15: Thẻ Sớ Lời Nguyện & Tri Ân (Silk Scroll Prayer Cards)
function triggerSilkScroll(devotee, categoryKey = 'peace', wishText = '') {
  if (!state.silkScrollSettings || !state.silkScrollSettings.enabled) return null;
  const cat = state.silkScrollSettings.categories?.find((c) => c.key === categoryKey) || state.silkScrollSettings.categories?.[0] || {
    key: 'peace',
    name: 'Cầu Bình An',
    title: 'SỚ CẦU BÌNH AN BỐN MÙA',
    stamp: 'THÂN TÂM AN LẠC'
  };
  const scrollData = {
    id: `scroll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    devotee: {
      name: devotee?.name || 'Tín Chủ Thành Tâm',
      avatar: devotee?.avatar || '',
      badge: devotee?.badge || '🪙 Hữu Duyên'
    },
    category: cat.key,
    title: cat.title,
    stamp: cat.stamp,
    wish: wishText || devotee?.lastWish || 'Thành tâm kính bái, nguyện cầu vạn sự hanh thông, phúc lộc dồi dào',
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    dateString: 'Giờ Hoàng Đạo • Ngày Cát Khánh'
  };

  broadcastNotification('temple.silkScroll', scrollData);
  
  if (state.settings.ttsEnabled) {
    const ttsText = `Tín chủ ${scrollData.devotee.name} thành tâm dâng sớ ${cat.name}: ${scrollData.wish}`;
    ttsManager.synthesize(ttsText, 'maichi').then((res) => {
      if (res.ok) broadcastNotification('tts.play', { text: res.text, voice: 'maichi', url: res.url, fallbackBrowserTts: res.fallbackBrowserTts });
    });
  }

  return scrollData;
}

// Feature 16: Mini-Event Tự Động (Automated Mini-Events)
let miniEventTimer = null;
function startMiniEvent(eventId) {
  if (!state.miniEventEngine || !state.miniEventEngine.enabled) return null;
  if (state.miniEventEngine.activeEvent) {
    return state.miniEventEngine.activeEvent;
  }
  if (state.activePoll?.active) {
    console.log('[MiniEvent] Hoãn mini-event do đang có bình chọn trực tiếp');
    return null;
  }

  const evtConfig = state.miniEventEngine.availableEvents.find((e) => e.id === eventId) || state.miniEventEngine.availableEvents[0];
  const endsAt = Date.now() + (evtConfig.durationSeconds || 60) * 1000;
  
  const activeEvt = {
    ...evtConfig,
    endsAt,
    startedAt: Date.now()
  };
  state.miniEventEngine.activeEvent = activeEvt;

  pushPriorityNotification(`⚡ BẮT ĐẦU SỰ KIỆN: ${activeEvt.bannerText}`, 1, '⚡', 6000);
  broadcastNotification('miniEvent.start', { event: activeEvt });

  if (state.settings.ttsEnabled) {
    ttsManager.synthesize(`Bắt đầu sự kiện: ${activeEvt.name}! ${activeEvt.description}!`, 'maichi').then((res) => {
      if (res.ok) broadcastNotification('tts.play', { text: res.text, voice: 'maichi', url: res.url, fallbackBrowserTts: res.fallbackBrowserTts });
    });
  }

  clearTimeout(miniEventTimer);
  miniEventTimer = setTimeout(() => {
    endMiniEvent();
  }, (evtConfig.durationSeconds || 60) * 1000);

  saveState();
  broadcastNotification('temple.state', getPublicState());
  return activeEvt;
}

function endMiniEvent() {
  clearTimeout(miniEventTimer);
  const endedEvt = state.miniEventEngine?.activeEvent;
  if (!endedEvt) return;

  state.miniEventEngine.activeEvent = null;
  pushPriorityNotification(`✨ Sự kiện ${endedEvt.name} đã kết thúc viên mãn! Tán thán công đức toàn thể đạo tràng!`, 2, '✨', 5000);
  broadcastNotification('miniEvent.ended', { eventId: endedEvt.id });
  saveState();
  broadcastNotification('temple.state', getPublicState());
}

// Feature 17: Chuyển Cảnh Tự Động (Atmospheric Scene Switcher)
function setStageScene(sceneId, reason = 'Chuyển cảnh đàn tràng') {
  if (!state.stageScene) state.stageScene = { current: 'hoavang', autoSwitchEnabled: true, availableScenes: [] };
  state.stageScene.current = sceneId;
  state.settings.stageBg = sceneId;
  broadcastNotification('temple.switchScene', { sceneId, reason });
  pushPriorityNotification(`🏛️ Đàn tràng chuyển cảnh: ${sceneId} (${reason})`, 3, '🏛️', 3500);
  saveState();
  broadcastNotification('temple.state', getPublicState());
  return { ok: true, sceneId, reason };
}

// Feature 18: Gợi Ý Tương Tác Theo Trạng Thái Live (Context-Aware Live Prompter)
let smartPromptIndex = 0;
function evaluateSmartPrompt() {
  if (!state.smartPromptSettings || !state.smartPromptSettings.enabled) return;
  
  let newPrompt = '';
  let condition = 'idle';

  if (state.miniEventEngine?.activeEvent) {
    condition = 'mini_event';
    newPrompt = state.miniEventEngine.activeEvent.bannerText;
  } else if (state.activePoll?.active) {
    condition = 'poll_active';
    newPrompt = '🗳️ Bình chọn đang mở! Hãy bình luận 1, 2, 3 hoặc 4 để chọn vật phẩm hoá tiếp theo!';
  } else if (state.communityGate && (state.communityGate.currentHearts / state.communityGate.targetHearts) >= 0.75 && state.communityGate.status !== 'grand_ceremony') {
    condition = 'gate_near';
    const remaining = Math.max(0, state.communityGate.targetHearts - state.communityGate.currentHearts);
    newPrompt = `✨ Cổng Trời Kim Long sắp mở khóa! Còn ${remaining.toLocaleString('vi-VN')} tim nữa, cùng thả tim bứt phá nào!`;
  } else {
    const activeQuest = state.communityQuests?.find((q) => q.active && !q.completed);
    if (activeQuest) {
      condition = 'quest_active';
      const remaining = Math.max(0, activeQuest.targetAmount - activeQuest.currentAmount);
      newPrompt = `🎯 Nhiệm vụ cộng đồng: ${activeQuest.title} (Còn ${remaining.toLocaleString('vi-VN')})! Gõ từ khóa để cùng hoàn thành!`;
    } else {
      condition = 'idle';
      const idlePrompts = [
        '🪔 Bình luận "HƯƠNG" để dâng nén trầm thơm lên Đàn Tràng',
        '🪷 Bình luận "HOA" để dâng đóa sen thanh tịnh cầu bình an',
        '🪙 Bình luận "VÀNG" để dâng thỏi vàng kim bảo chiêu tài tấn bảo',
        '📜 Bình luận "BÌNH AN" hoặc "TỔ TIÊN" để dâng sớ cầu gia đạo bình an',
        '🎋 Bình luận "XIN QUẺ" để thỉnh Quẻ Linh Xăm Tài Lộc đầu ngày',
        '🔥 Thả tim liên tục để tiếp lửa lò hoá vàng và tích luỹ điểm Lộc Đức'
      ];
      newPrompt = idlePrompts[smartPromptIndex % idlePrompts.length];
      smartPromptIndex++;
    }
  }

  state.smartPromptSettings.activePrompt = newPrompt;
  broadcastNotification('smartPrompt.update', { prompt: newPrompt, condition });
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalVotiveBurned: state.totalVotiveBurned || 0,
    totalMerit: state.totalMerit,
    dailyMeritTarget: state.dailyMeritTarget || 1000000,
    dailyMeritCurrent: state.dailyMeritCurrent || state.totalMerit || 368880,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    fireIntensity: state.fireIntensity || 0.75,
    haloIntensity: state.haloIntensity,
    offerings: state.offerings,
    votiveCatalog: VOTIVE_CATALOG,
    leaderboard: getLeaderboard(24),
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    communityMilestones: state.communityMilestones,
    votiveKeywordRules: state.votiveKeywordRules,
    furnaceStatus: state.furnaceStatus,
    ceremonySchedule: state.ceremonySchedule,
    activePoll: getSanitizedPoll(),
    communityGate: state.communityGate,
    giftMappings: state.giftMappings,
    welcomeSettings: state.welcomeSettings,
    communityQuests: state.communityQuests,
    companionSettings: state.companionSettings,
    silkScrollSettings: state.silkScrollSettings,
    miniEventEngine: state.miniEventEngine,
    stageScene: state.stageScene,
    smartPromptSettings: state.smartPromptSettings,
    tts: ttsManager ? ttsManager.getStatus() : { ready: true, status: 'ready', voice: 'maichi' }
  };
}

// ============================================================================
// 4. NGHI THỨC HOÁ VÀNG & TƯƠNG TÁC TÂM LINH (RITUAL HANDLERS)
// ============================================================================
const Rituals = {
  // 4.1. Hoá vàng mã & Thắp hương (Hỗ trợ cả temple.burnIncense & hoavang.burnVotive)
  burnVotive(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const itemKey = VOTIVE_CATALOG[params.itemKey] ? params.itemKey : 'gold_ingot';
    const itemInfo = VOTIVE_CATALOG[itemKey];
    const count = Math.max(1, Math.min(99, Number(params.count) || 3));
    const wish =
      sanitizeWishText(params.wish) ||
      `Thành tâm hoá ${count} ${itemInfo.name}, cầu gia đạo bình an, tài lộc vượng phát`;

    // Áp dụng hệ số nhân từ Mini-Event đang diễn ra
    let multiplier = 1;
    if (state.miniEventEngine?.activeEvent) {
      const aType = state.miniEventEngine.activeEvent.type;
      if ((aType === 'incense' && itemKey === 'incense') ||
          (aType === 'flower' && itemKey === 'flower') ||
          (aType === 'votive' && (itemKey === 'gold_ingot' || itemKey === 'hell_money' || itemKey === 'royal_robe' || itemKey === 'sacred_horse' || itemKey === 'luxury_villa_car' || itemKey === 'dragon_treasury'))) {
        multiplier = state.miniEventEngine.activeEvent.multiplier || 2;
      }
    }
    const merit = count * itemInfo.baseMerit * multiplier;

    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 1);
    state.offerings[itemKey] = (state.offerings[itemKey] || 0) + count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, count, 0, wish);

    // Cập nhật tiến độ nhiệm vụ cộng đồng tương ứng
    if (itemKey === 'incense') {
      updateQuestProgress('incense', count);
    } else if (itemKey === 'flower') {
      updateQuestProgress('flower', count);
    } else {
      updateQuestProgress('votive', count);
    }

    setFurnaceState('burning', `Hoá ${count} ${itemInfo.name}`);

    const ttsText =
      params.readTts === false
        ? ''
        : `Chứng tâm công đức! Tín chủ ${devotee.name} thành tâm hoá ${count} ${itemInfo.name} vào lò thiêng. ${wish}.`;

    const event = pushEventLog({
      type: 'burnVotive',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      itemKey,
      itemName: itemInfo.name,
      itemEmoji: itemInfo.emoji,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  burnIncense(params = {}) {
    return this.burnVotive({
      ...params,
      itemKey: params.itemKey || 'gold_ingot',
      count: params.count || 3
    });
  },

  // 4.2. Quạt lửa lò hoá vàng / Gõ mõ (Thả tim Like phân cấp 4 mức)
  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(1000, Number(params.count) || 1));

    // Áp dụng hệ số nhân bão tim nếu có mini-event
    let multiplier = 1;
    if (state.miniEventEngine?.activeEvent?.type === 'hearts') {
      multiplier = state.miniEventEngine.activeEvent.multiplier || 2;
    }
    const merit = count * 2 * multiplier;
    const tier = count >= 500 ? 4 : count >= 200 ? 3 : count >= 50 ? 2 : 1;

    state.woodenFishHits += count;
    updateQuestProgress('hearts', count * multiplier);

    if (state.communityGate) {
      state.communityGate.currentHearts = (state.communityGate.currentHearts || 0) + count * multiplier;
      for (const lvl of state.communityGate.levels || []) {
        if (state.communityGate.currentHearts >= lvl.threshold && state.communityGate.status !== lvl.code) {
          state.communityGate.status = lvl.code;
          broadcastNotification('gate.unlocked', { level: lvl, gate: state.communityGate });
          if (lvl.code === 'grand_ceremony') {
            setFurnaceState('grand_ceremony', 'Cổng Trời Khai Mở Đại Lễ');
          }
        }
      }
    }
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 1, 0, `Thả ${count} tim tích +${merit} công đức (Cấp ${tier})`);

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      tier,
      ttsText: params.ttsText || ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // 4.3. Thỉnh Đại Hồng Chung Khai Lộc
  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish =
      sanitizeWishText(params.wish) ||
      'Thỉnh chuông đồng khai thông vận khí, âm dương thuận hòa, tài lộc hanh thông';
    const merit = count * 15;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, 0, wish);

    const ttsText = params.readTts
      ? `Tín chủ ${devotee.name} thỉnh Đại Hồng Chung khai lộc cầu nguyện: ${wish}.`
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // 4.4. Hoá Sớ Cầu Tài Lộc / Đèn Hoa Đăng / Thẻ Sớ Lụa Hoàng Kim
  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish =
      sanitizeWishText(params.wish) ||
      'Cầu cho gia đình bình an mạnh khỏe, buôn may bán đắt, lộc tài đầy kho';
    const merit = 20;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 1, 0, wish);

    // Xác định phân loại sớ lụa để kích hoạt hiệu ứng Thẻ Sớ Hoàng Kim
    let catKey = 'peace';
    const lowerWish = wish.toLowerCase();
    if (lowerWish.includes('tổ tiên') || lowerWish.includes('gia tiên') || lowerWish.includes('tưởng nhớ') || lowerWish.includes('tri ân') || lowerWish.includes('cửu huyền')) {
      catKey = 'ancestor';
    } else if (lowerWish.includes('tài lộc') || lowerWish.includes('buôn may') || lowerWish.includes('bán đắt') || lowerWish.includes('kinh doanh') || lowerWish.includes('đơn hàng') || lowerWish.includes('chốt đơn')) {
      catKey = 'prosperity';
    } else if (lowerWish.includes('đỗ đạt') || lowerWish.includes('học tập') || lowerWish.includes('thi cử') || lowerWish.includes('công danh') || lowerWish.includes('thăng tiến')) {
      catKey = 'blessing';
    }
    triggerSilkScroll(devotee, catKey, wish);

    const ttsText =
      params.readTts === false
        ? ''
        : `Dâng sớ cầu an của tín chủ ${devotee.name}: ${wish}. Nguyện sở cầu tất ứng, sở nguyện tòng tâm.`;

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // 4.5. Tặng Quà Donate Hoá Đại Lễ Vật Vàng Mã
  offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);

    // Map giftType hoặc số xu sang Lễ vật Vàng mã tương ứng
    let itemKey = params.itemKey || params.giftType || '';
    const legacyMap = {
      lotus: 'hell_money',
      lamp: 'sacred_horse',
      fruit: 'five_elements_tray',
      dragon: 'dragon_treasury',
      horse: 'sacred_horse',
      villa: 'luxury_villa_car',
      tech: 'golden_tech',
      tray: 'five_elements_tray'
    };
    if (legacyMap[itemKey]) itemKey = legacyMap[itemKey];

    if (!VOTIVE_CATALOG[itemKey]) {
      const matchedTier = (state.giftMappings || []).find((t) => coins >= t.minCoins && coins <= t.maxCoins);
      if (matchedTier && matchedTier.itemKey && VOTIVE_CATALOG[matchedTier.itemKey]) {
        itemKey = matchedTier.itemKey;
      } else if (coins >= 100) itemKey = 'dragon_treasury';
      else if (coins >= 50) itemKey = 'luxury_villa_car';
      else if (coins >= 30) itemKey = 'golden_tech';
      else if (coins >= 20) itemKey = 'five_elements_tray';
      else if (coins >= 10) itemKey = 'sacred_horse';
      else if (coins >= 5) itemKey = 'royal_robe';
      else if (coins >= 2) itemKey = 'hell_money';
      else itemKey = 'gold_ingot';
    }

    const itemInfo = VOTIVE_CATALOG[itemKey] || VOTIVE_CATALOG.gold_ingot;
    const giftName = params.giftName || itemInfo.name;
    const multiplier = coins >= 100 ? 50 : coins >= 20 ? 35 : 25;
    const merit = Math.max(itemInfo.baseMerit, coins * multiplier);

    state.offerings[itemKey] = (state.offerings[itemKey] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Thành tâm hoá ${giftName} kính dâng Gia Tiên & Thần Tài`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 5, 1, wish);

    const isGrand = itemKey === 'dragon_treasury' || coins >= 100;
    if (isGrand) {
      setFurnaceState('grand_ceremony', `Đại Lễ Donate: ${giftName}`);
    } else {
      setFurnaceState('burning', `Hoá Lễ Donate: ${giftName}`);
    }
    const ttsText =
      params.readTts === false
        ? ''
        : isGrand
          ? `Đại công đức vô lượng! Cảm tạ Đại Tín Chủ ${devotee.name} đã phát tâm khai mở ${giftName}, tích thêm ${merit} điểm Lộc Đức. Nguyện cầu Thần Tài và Gia Tiên gia hộ cho tín chủ đại phú đại quý, tiền vào như nước!`
          : `Lộc đức viên mãn! Cảm tạ tín chủ ${devotee.name} đã thành tâm hoá ${giftName}, tích thêm ${merit} điểm Lộc Đức. Chúc tín chủ vạn sự hanh thông, tài lộc dồi dào!`;

    const event = pushEventLog({
      type: isGrand ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType: itemKey,
      itemKey,
      itemEmoji: itemInfo.emoji,
      giftName,
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  // 4.6. Xin Xăm / Gieo Quẻ Tài Lộc
  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Kinh doanh, Tài lộc và Gia đạo';
    const fortune = FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];
    const merit = 15;

    state.fortuneCount += 1;
    const devotee = recordDevotee(
      user,
      uniqueId,
      avatar,
      merit,
      0,
      0,
      0,
      `Xin quẻ Tài Lộc: Quẻ số ${fortune.number} (${fortune.rank})`
    );

    const ttsText =
      params.readTts === false
        ? ''
        : `Tín chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      itemKey: 'dragon_treasury',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hoá Vàng Kim Long Khai Khố'
    });
  },

  updateSettings(params = {}) {
    state.settings = {
      ...state.settings,
      ...params
    };
    if (typeof params.autoSim === 'boolean') {
      configureAutoSim(params.autoSim);
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalVotiveBurned = 0;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = {
      gold_ingot: 1,
      hell_money: 1,
      royal_robe: 0,
      sacred_horse: 0,
      five_elements_tray: 0,
      golden_tech: 0,
      luxury_villa_car: 0,
      dragon_treasury: 0
    };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER CHO HOÁ VÀNG ONLINE
// ============================================================================
let tiktokConn = null;
const commentCooldownMap = new Map();

function parseViewerComment(commentText, user, uniqueId, avatar, bypassCooldown = false) {
  const raw = String(commentText || '').trim();
  if (!raw || isBlockedSpamOrToxic(raw)) {
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 2) {
    return null;
  }

  // Cooldown 3 giây/người để tránh spam nghẽn hàng đợi TTS
  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey && !bypassCooldown) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3000) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeUserName(user);
  const lower = cleanWish.toLowerCase();

  // Phát sự kiện hiển thị Bong bóng Bình luận trực tiếp lên màn hình 9:16
  broadcastNotification('temple.chat', {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user: cleanUser,
    avatar: avatar || '',
    comment: cleanWish
  });

  // 0. Bình chọn Realtime (Live Poll): Nếu đang có bình chọn, kiểm tra phím 1, 2, 3, 4 hoặc tên lựa chọn
  if (state.activePoll && state.activePoll.active) {
    const trimmed = cleanWish.trim();
    if (trimmed === '1' || trimmed === '2' || trimmed === '3' || trimmed === '4' ||
        trimmed.startsWith('1') || trimmed.startsWith('2') || trimmed.startsWith('3') || trimmed.startsWith('4')) {
      const voteChoice = trimmed.charAt(0);
      const voted = castVote(userKey, voteChoice, cleanUser);
      if (voted) {
        return {
          type: 'pollVote',
          user: cleanUser,
          choice: voteChoice,
          state: getPublicState()
        };
      }
    }
  }

  // 1. Kiểm tra danh sách Từ khóa cấu hình động (Configurable Keyword Rules)
  if (state.votiveKeywordRules && Array.isArray(state.votiveKeywordRules)) {
    for (const rule of state.votiveKeywordRules) {
      if (!rule.enabled) continue;
      const matched = (rule.keywords || []).some((kw) => lower.includes(String(kw).toLowerCase()));
      if (matched) {
        // Nếu là sớ / lời chúc tâm linh
        if (rule.effect === 'blessing') {
          let blessingReply = '';
          for (const [bKey, bVal] of Object.entries(state.blessingResponses || {})) {
            if (lower.includes(bKey)) {
              blessingReply = bVal;
              break;
            }
          }
          if (!blessingReply) {
            blessingReply = 'Tâm thành sở cầu tất ứng, sở nguyện tòng tâm, gia đạo tứ thời bình an vượng phát.';
          }
          return Rituals.sendPrayer({
            user: cleanUser,
            uniqueId,
            avatar,
            wish: `${cleanWish}. (${blessingReply})`,
            itemKey: rule.itemKey || 'prayer_scroll'
          });
        }

        // Nếu là lệnh kích hoạt bùng lò hoá vàng
        if (rule.effect === 'furnace_boost') {
          setFurnaceState('burning', 'Tiếp lửa lò hoá vàng bùng sáng');
          return Rituals.burnVotive({
            user: cleanUser,
            uniqueId,
            avatar,
            itemKey: 'gold_ingot',
            count: rule.count || 3,
            wish: cleanWish
          });
        }

        // Mặc định dâng vật phẩm tương ứng theo rule
        const targetItemKey = rule.itemKey || 'gold_ingot';
        return Rituals.burnVotive({
          user: cleanUser,
          uniqueId,
          avatar,
          itemKey: targetItemKey,
          count: rule.count || 1,
          wish: cleanWish
        });
      }
    }
  }

  // 1. Xin xăm / Gieo quẻ Tài Lộc
  if (
    lower.includes('xin xăm') ||
    lower.includes('xin xam') ||
    lower.includes('gieo quẻ') ||
    lower.includes('gieo que') ||
    lower.includes('rút quẻ') ||
    lower.includes('rut que') ||
    lower.includes('xin quẻ') ||
    lower.includes('quẻ')
  ) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 2. Hoá Biệt thự / Nhà lầu / Siêu xe
  if (
    lower.includes('biệt thự') ||
    lower.includes('biet thu') ||
    lower.includes('nhà lầu') ||
    lower.includes('nha lau') ||
    lower.includes('siêu xe') ||
    lower.includes('sieu xe') ||
    lower.includes('ô tô') ||
    lower.includes('oto')
  ) {
    return Rituals.burnVotive({
      user: cleanUser,
      uniqueId,
      avatar,
      itemKey: 'luxury_villa_car',
      count: 1,
      wish: cleanWish
    });
  }

  // 3. Hoá Ngựa thần / Quan thần
  if (
    lower.includes('ngựa') ||
    lower.includes('ngua') ||
    lower.includes('xích thố') ||
    lower.includes('ông công') ||
    lower.includes('ông táo')
  ) {
    return Rituals.burnVotive({
      user: cleanUser,
      uniqueId,
      avatar,
      itemKey: 'sacred_horse',
      count: 1,
      wish: cleanWish
    });
  }

  // 4. Hoá iPhone / Táo vàng / Công nghệ
  if (
    lower.includes('iphone') ||
    lower.includes('táo') ||
    lower.includes('điện thoại') ||
    lower.includes('ipad') ||
    lower.includes('macbook')
  ) {
    return Rituals.burnVotive({
      user: cleanUser,
      uniqueId,
      avatar,
      itemKey: 'golden_tech',
      count: 1,
      wish: cleanWish
    });
  }

  // 5. Hoá Tiền vàng / Đô la
  if (
    lower.includes('tiền vàng') ||
    lower.includes('tien vang') ||
    lower.includes('đô la') ||
    lower.includes('dola') ||
    lower.includes('tiền âm phủ')
  ) {
    return Rituals.burnVotive({
      user: cleanUser,
      uniqueId,
      avatar,
      itemKey: 'hell_money',
      count: 5,
      wish: cleanWish
    });
  }

  // 6. Thỉnh chuông
  if (lower.includes('chuông') || lower.includes('chuong') || lower.includes('thỉnh chuông')) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 7. Quạt lửa / Gõ mõ
  if (lower.includes('gõ mõ') || lower.includes('go mo') || lower.includes('quạt lửa') || lower.includes('thêm củi')) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 5 });
  }

  // 8. Dâng Sớ Cầu Tài Lộc / Cầu Nguyện
  if (
    lower.includes('sớ') ||
    lower.includes('dâng sớ') ||
    lower.includes('cầu') ||
    lower.includes('nguyện') ||
    lower.includes('bình an') ||
    lower.includes('tài lộc') ||
    lower.includes('chúc') ||
    lower.includes('phù hộ')
  ) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  // Mặc định mọi bình luận thành tâm đều được Hoá 3 Thoi Vàng Kim Nguyên Bảo & đọc lời khấn!
  return Rituals.burnVotive({
    user: cleanUser,
    uniqueId,
    avatar,
    itemKey: 'gold_ingot',
    count: 3,
    wish: cleanWish
  });
}

const giftComboTracker = new Map();

async function resolveTikTokUsername(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    // Chỉ resolve URL nếu domain là tiktok.com hợp lệ để ngăn SSRF
    try {
      const parsed = new URL(urlToFetch);
      if (parsed.hostname.endsWith('tiktok.com')) {
        const resolved = await new Promise((resolve) => {
          const clientLib = parsed.protocol === 'http:' ? http : https;
          const req = clientLib.get(urlToFetch, { timeout: 5000 }, (res) => {
            const loc = res.headers.location || '';
            const match = loc.match(/tiktok\.com\/@([^/?#]+)/i);
            if (match && match[1]) {
              return resolve(match[1]);
            }
            resolve(null);
          });
          req.on('error', () => resolve(null));
          req.on('timeout', () => { req.destroy(); resolve(null); });
        });
        if (resolved) return resolved;
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Tín Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  tiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  tiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.DISCONNECTED, () => {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.ERROR, (err) => {
    state.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount > 0) {
      state.tiktok.viewerCount = viewerCount;
      broadcastNotification('temple.viewerCount', { viewerCount });
    }
  });

  tiktokConn.on(WebcastEvent.MEMBER, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    handleMemberJoin(user, uniqueId, avatar);
    broadcastNotification('temple.state', getPublicState());
    broadcastNotification('temple.welcome', { user, uniqueId, avatar });
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    parseViewerComment(commentText, user, uniqueId, avatar);
  });

  let likeBatchBuffer = { count: 0, users: new Set(), lastUser: '', lastAvatar: '', lastUniqueId: '', timer: null };

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(25, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));

    likeBatchBuffer.count += likeCount;
    likeBatchBuffer.lastUser = user;
    likeBatchBuffer.lastUniqueId = uniqueId;
    likeBatchBuffer.lastAvatar = avatar;
    likeBatchBuffer.users.add(user);

    if (!likeBatchBuffer.timer) {
      likeBatchBuffer.timer = setTimeout(() => {
        const total = likeBatchBuffer.count;
        const mainUser = likeBatchBuffer.users.size > 1 ? `${likeBatchBuffer.lastUser} & ${likeBatchBuffer.users.size - 1} thiện tín` : likeBatchBuffer.lastUser;
        const uId = likeBatchBuffer.lastUniqueId;
        const av = likeBatchBuffer.lastAvatar;
        likeBatchBuffer = { count: 0, users: new Set(), lastUser: '', lastAvatar: '', lastUniqueId: '', timer: null };

        Rituals.strikeWoodenFish({ user: mainUser, uniqueId: uId, avatar: av, count: total });
      }, 650);
    }
  });

  const handleSocialEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên hội ngộ tại Đàn Tràng Hoá Vàng, cầu tài lộc bình an',
      readTts: false
    });
  };
  tiktokConn.on(WebcastEvent.FOLLOW, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SHARE, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleSocialEvent(data);
    }
  });

  tiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    const prevCount = giftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount) {
      if (data?.repeatEnd) {
        giftComboTracker.delete(groupId);
      }
      return;
    }
    const deltaCount = repeatCount - prevCount;
    giftComboTracker.set(groupId, repeatCount);
    if (data?.repeatEnd) {
      giftComboTracker.delete(groupId);
    }
    if (giftComboTracker.size > 500) {
      const firstKey = giftComboTracker.keys().next().value;
      giftComboTracker.delete(firstKey);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Lễ Vật Tâm Thành';
    const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`[TikTok Gift] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

    Rituals.offerGift({
      user,
      uniqueId,
      avatar,
      coins: totalCoins,
      giftName: displayGiftName,
      wish: `Thành tâm dâng ${displayGiftName} hoá vàng kính lễ Gia Tiên & Thần Tài`
    });
  });

  try {
    const roomState = await tiktokConn.connect();
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.lastError =
      err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    broadcastNotification('temple.state', getPublicState());
    throw new Error(state.tiktok.lastError);
  }
}

function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM HOÁ VÀNG)
// ============================================================================
let autoSimTimer = null;
const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Chuyên Sỉ', uniqueId: 'ngocanh.shop', badge: '👑 Bảo Trợ Đàn Tràng', sessionsCount: 12, streakDays: 8 },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', badge: '✨ Thiện Tín 7 Ngày', sessionsCount: 7, streakDays: 7 },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', badge: '🪙 Hữu Duyên 3 Ngày', sessionsCount: 4, streakDays: 3 },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', badge: '🪙 Hữu Duyên 3 Ngày', sessionsCount: 3, streakDays: 2 },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.99', badge: '✨ Thiện Tín 7 Ngày', sessionsCount: 9, streakDays: 6 },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', badge: '🪙 Hữu Duyên 3 Ngày', sessionsCount: 5, streakDays: 4 },
  { user: 'Nguyễn Bích Ngọc', uniqueId: 'bichngoc.live', badge: '🐉 Đại Đạo Tràng 30 Ngày', sessionsCount: 35, streakDays: 31 },
  { user: 'Khánh Linh Phong Thuỷ', uniqueId: 'khanhlinh.pt', badge: '👑 Bảo Trợ Đàn Tràng', sessionsCount: 22, streakDays: 14 },
  { user: 'Hoàng Bách Tài Lộc', uniqueId: 'hoangbach.888', badge: '✨ Thiện Tín 7 Ngày', sessionsCount: 8, streakDays: 8 }
];

const SIM_COMMENTS = [
  'hương',
  'hoa',
  'thỏi vàng',
  'vàng',
  'bình an',
  'tổ tiên',
  'xin quẻ',
  'Con xin dâng nén hương trầm cầu gia quyến an khang mạnh khỏe',
  'Dâng đóa hoa sen thanh tịnh cúng dường Tam Bảo',
  'Thành tâm hoá 9 thỏi vàng kim nguyên bảo chiêu tài tấn bảo',
  'Kính biếu Cửu Huyền Thất Tổ phù hộ độ trì toàn gia hưng vượng',
  'Dâng sớ cầu tài lộc buôn may bán đắt, đơn đi nườm nượp',
  'Con xin gieo một quẻ linh xăm đầu ngày cầu may mắn'
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();

  // 1. Nếu đang có bình chọn realtime: cho người xem giả lập vote 1, 2, 3, 4
  if (state.activePoll?.active) {
    const choice = String(Math.floor(Math.random() * 4) + 1);
    parseViewerComment(choice, pick.user, pick.uniqueId, '', true);
    return;
  }

  // 2. Bình luận từ khóa dâng lễ (Comment dâng hương / hoa / vàng / sớ / quẻ) -> Tỉ lệ 38%
  if (roll < 0.38) {
    const cmt = SIM_COMMENTS[Math.floor(Math.random() * SIM_COMMENTS.length)];
    parseViewerComment(cmt, pick.user, pick.uniqueId, '', true);
  }
  // 3. Thả tim dồn dập (Nhấp gõ mõ +25 hoặc +50 tim) -> 22%
  else if (roll < 0.60) {
    const heartCount = Math.random() < 0.6 ? 25 : 50;
    Rituals.strikeWoodenFish({ user: pick.user, uniqueId: pick.uniqueId, count: heartCount });
  }
  // 4. Người xem mới vừa vào phòng live (Hiển thị dải lụa hoàng kim + gợi ý từ khóa) -> 12%
  else if (roll < 0.72) {
    const newViewerNames = ['Phan Anh Đức', 'Cẩm Tú 88', 'Gia Huy Lộc', 'Thanh Mai Store', 'Quốc Tuấn BĐS', 'Hải Đăng 68', 'Phương Thảo'];
    const newName = newViewerNames[Math.floor(Math.random() * newViewerNames.length)];
    handleMemberJoin(newName, `sim_join_${Date.now()}`, '');
  }
  // 5. Thẻ Sớ Lụa Hoàng Kim (Hiển thị cuộn sớ lụa cổ truyền đóng triện son) -> 10%
  else if (roll < 0.82) {
    const categories = ['ancestor', 'peace', 'prosperity', 'blessing'];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const wishes = {
      ancestor: 'Kính biếu Cửu Huyền Thất Tổ phù hộ độ trì toàn gia hưng vượng, con cháu hiếu thuận',
      peace: 'Cầu cho gia đình bốn mùa thân tâm an lạc, tai qua nạn khỏi, vạn sự cát tường',
      prosperity: 'Thành tâm kính dâng sớ chiêu tài, cầu buôn may bán đắt, tiền tài sung túc đầy kho',
      blessing: 'Cầu công danh sự nghiệp hanh thông, học hành thi cử đỗ đạt hiển vinh'
    };
    const dev = { name: pick.user, avatar: '', badge: pick.badge, lastWish: wishes[cat] };
    triggerSilkScroll(dev, cat, wishes[cat]);
  }
  // 6. Tặng quà donate lễ vật lớn (Biệt Thự & Siêu Xe, Ngựa Thần) -> 10%
  else if (roll < 0.92) {
    if (Math.random() < 0.5) {
      Rituals.offerGift({
        user: pick.user,
        uniqueId: pick.uniqueId,
        itemKey: 'luxury_villa_car',
        coins: 50,
        giftName: 'Biệt Thự Phố & Siêu Xe Vàng',
        wish: 'Cúng dường Biệt Thự và Siêu Xe vàng mã kính biếu Gia Tiên'
      });
    } else {
      Rituals.offerGift({
        user: pick.user,
        uniqueId: pick.uniqueId,
        itemKey: 'sacred_horse',
        coins: 15,
        giftName: 'Ngựa Đỏ Xích Thố Thần Hành',
        wish: 'Cúng dường Ngựa Thần Xích Thố cầu công danh sự nghiệp'
      });
    }
  }
  // 7. Thiện tín lâu năm quay lại đàn tràng -> 8%
  else {
    broadcastReturningDevotee({
      name: pick.user,
      uniqueId: pick.uniqueId,
      avatar: '',
      badge: pick.badge,
      sessionsCount: pick.sessionsCount,
      streakDays: pick.streakDays,
      merit: 2850
    });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    autoSimTimer = setInterval(runSingleSimulationStep, state.settings.autoSimIntervalMs || 3800);
  }
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER (HỖ TRỢ CẢ temple.* VÀ hoavang.*)
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    case 'temple.getState':
    case 'hoavang.getState':
      return getPublicState();

    case 'temple.burnIncense':
    case 'hoavang.burnVotive':
      return Rituals.burnVotive(params);

    case 'temple.strikeWoodenFish':
    case 'hoavang.stokeFire':
      return Rituals.strikeWoodenFish(params);

    case 'temple.ringBell':
    case 'hoavang.ringBell':
      return Rituals.ringBell(params);

    case 'temple.sendPrayer':
    case 'hoavang.burnScroll':
      return Rituals.sendPrayer(params);

    case 'temple.offerGift':
    case 'hoavang.offerGift':
      return Rituals.offerGift(params);

    case 'temple.drawFortune':
    case 'hoavang.drawFortune':
      return Rituals.drawFortune(params);

    case 'temple.grandCeremony':
    case 'hoavang.grandCeremony':
      return Rituals.grandCeremony(params);

    case 'temple.updateSettings':
    case 'hoavang.updateSettings':
      return Rituals.updateSettings(params);

    case 'temple.resetMerit':
    case 'hoavang.resetMerit':
      return Rituals.resetMerit();

    case 'temple.comment':
    case 'hoavang.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar, true);

    case 'temple.speak':
    case 'hoavang.speak': {
      const res = await ttsManager.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice || 'maichi',
          url: res.url || null,
          fallbackBrowserTts: Boolean(res.fallbackBrowserTts)
        });
      }
      return res;
    }

    case 'temple.ttsStatus':
      return ttsManager.getStatus();

    case 'live.connect':
      return await connectTikTokLive(params.username);

    case 'live.disconnect':
      return disconnectTikTokLive();

    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();

    case 'admin.getDetailedConfig':
      return {
        milestones: state.communityMilestones,
        keywords: state.votiveKeywordRules,
        schedule: state.ceremonySchedule,
        poll: getSanitizedPoll(),
        gate: state.communityGate,
        giftMappings: state.giftMappings,
        furnace: state.furnaceStatus,
        settings: state.settings,
        welcome: state.welcomeSettings,
        quests: state.communityQuests,
        miniEvents: state.miniEventEngine,
        companions: state.companionSettings,
        silkScroll: state.silkScrollSettings,
        scenes: state.stageScene,
        smartPrompts: state.smartPromptSettings,
        devotees: getLeaderboard(50)
      };

    case 'admin.saveKeywords':
      if (Array.isArray(params.keywords)) {
        state.votiveKeywordRules = params.keywords;
        saveState();
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, count: state.votiveKeywordRules.length };

    case 'admin.saveMilestones':
      if (Array.isArray(params.milestones)) {
        state.communityMilestones = params.milestones;
        saveState();
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, count: state.communityMilestones.length };

    case 'admin.saveSchedule':
      if (Array.isArray(params.schedule)) {
        state.ceremonySchedule = params.schedule;
        saveState();
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, count: state.ceremonySchedule.length };

    case 'admin.triggerCeremony':
      return triggerCeremony(params.id);

    case 'admin.startPoll':
      return startLivePoll(params.question, params.options, params.durationSeconds);

    case 'admin.endPoll':
      return endLivePoll(params.winnerId);

    case 'admin.votePoll': {
      const ok = castVote(params.uniqueId || `admin_${Date.now()}`, params.optionId, params.user || 'Admin');
      return { ok, poll: getSanitizedPoll() };
    }

    case 'admin.setFurnaceState':
      setFurnaceState(params.state, params.reason || 'Admin điều khiển');
      return state.furnaceStatus;

    case 'admin.saveGiftMappings':
      if (Array.isArray(params.giftMappings)) {
        state.giftMappings = params.giftMappings;
        saveState();
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true };

    case 'admin.resetCommunityGoals':
      if (state.communityMilestones) {
        state.communityMilestones.forEach((m) => { m.unlocked = false; });
      }
      if (state.communityGate) {
        state.communityGate.currentHearts = 0;
        state.communityGate.status = 'locked';
      }
      state.dailyMeritCurrent = 0;
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return { ok: true };

    case 'admin.saveWelcomeSettings':
      if (params.settings) {
        state.welcomeSettings = { ...state.welcomeSettings, ...params.settings };
        saveState();
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, welcome: state.welcomeSettings };

    case 'admin.saveQuests':
      if (Array.isArray(params.quests)) {
        state.communityQuests = params.quests;
        saveState();
        broadcastNotification('quest.update', { quests: state.communityQuests });
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, count: state.communityQuests.length };

    case 'admin.triggerQuest':
      if (params.id) {
        const q = state.communityQuests?.find((x) => x.id === params.id);
        if (q) {
          q.currentAmount = q.targetAmount;
          updateQuestProgress(q.targetType, 0);
        }
      }
      return { ok: true, quests: state.communityQuests };

    case 'admin.resetQuests':
      if (state.communityQuests) {
        state.communityQuests.forEach((q, idx) => {
          q.completed = false;
          q.currentAmount = 0;
          q.active = (idx === 0);
        });
        saveState();
        broadcastNotification('quest.update', { quests: state.communityQuests });
        broadcastNotification('temple.state', getPublicState());
      }
      return { ok: true, quests: state.communityQuests };

    case 'admin.startMiniEvent':
      return { ok: true, event: startMiniEvent(params.eventId || 'incense_rush') };

    case 'admin.endMiniEvent':
      endMiniEvent();
      return { ok: true };

    case 'admin.switchScene':
      return setStageScene(params.sceneId || 'hoavang', params.reason || 'Admin điều khiển');

    case 'admin.saveSilkScrollSettings':
      if (params.settings) {
        state.silkScrollSettings = { ...state.silkScrollSettings, ...params.settings };
        saveState();
      }
      return { ok: true, silkScroll: state.silkScrollSettings };

    case 'admin.sendSilkScroll': {
      const dev = {
        name: params.user || 'Tín Chủ Minh Tâm',
        avatar: params.avatar || '',
        badge: params.badge || '👑 Bảo Trợ Đàn Tràng',
        lastWish: params.wish || 'Cầu cho gia đạo bình an, buôn may bán đắt'
      };
      const scroll = triggerSilkScroll(dev, params.category || 'peace', params.wish);
      return { ok: true, scroll };
    }

    case 'admin.saveSmartPrompts':
      if (params.settings) {
        state.smartPromptSettings = { ...state.smartPromptSettings, ...params.settings };
        saveState();
        evaluateSmartPrompt();
      }
      return { ok: true, smartPrompts: state.smartPromptSettings };

    case 'admin.saveCompanionSettings':
      if (params.settings) {
        state.companionSettings = { ...state.companionSettings, ...params.settings };
        saveState();
      }
      return { ok: true, companions: state.companionSettings };

    case 'admin.simulate': {
      const simType = params.type || 'comment';
      if (simType === 'like') {
        const c = Number(params.count) || 50;
        return Rituals.strikeWoodenFish({ user: params.user || 'Tín Chủ Thả Tim', count: c });
      } else if (simType === 'comment') {
        return parseViewerComment(params.comment || 'Con xin hoá thỏi vàng cầu bình an', params.user || 'Tín Chủ Thành Tâm', params.uniqueId || 'sim_user', '', true);
      } else if (simType === 'gift') {
        const coins = Number(params.coins) || 20;
        return Rituals.offerGift({ user: params.user || 'Đại Tín Chủ', coins, giftName: params.giftName || 'Lễ Vật Đại Cát' });
      } else if (simType === 'pollVote') {
        const choice = String(params.choice || '1');
        castVote(`voter_${Date.now()}`, choice, params.user || 'Người Xem Live');
        return getSanitizedPoll();
      } else if (simType === 'milestone') {
        const m = state.communityMilestones?.find((x) => x.id === params.id) || state.communityMilestones?.[1];
        if (m) {
          m.unlocked = false;
          checkMilestoneProgress(0, m.threshold + 100);
        }
        return { ok: true, milestone: m };
      } else if (simType === 'welcome') {
        const testUser = params.user || 'Thiện Tín Mới Đến';
        handleMemberJoin(testUser, params.uniqueId || `mem_${Date.now()}`, params.avatar || '');
        return { ok: true, user: testUser };
      } else if (simType === 'questProgress') {
        const targetType = params.targetType || 'incense';
        const amount = Number(params.amount) || 10;
        updateQuestProgress(targetType, amount);
        return { ok: true, targetType, amount, quests: state.communityQuests };
      } else if (simType === 'miniEvent') {
        const evtId = params.eventId || 'incense_rush';
        const activeEvt = startMiniEvent(evtId);
        return { ok: true, event: activeEvt };
      } else if (simType === 'returningDevotee') {
        const testDev = {
          name: params.user || 'Phật Tử Diệu Tâm',
          uniqueId: params.uniqueId || 'dieutam.77',
          avatar: params.avatar || '',
          badge: params.badge || '✨ Thiện Tín 7 Ngày',
          sessionsCount: 7,
          streakDays: 7,
          merit: 2850
        };
        broadcastReturningDevotee(testDev);
        return { ok: true, devotee: testDev };
      } else if (simType === 'silkScroll') {
        const catKey = params.category || 'peace';
        const wish = params.wish || 'Cầu cho gia đạo tứ thời hưng thịnh, tai qua nạn khỏi, tài lộc đầy nhà';
        const dev = {
          name: params.user || 'Gia Chủ Minh Tâm',
          avatar: params.avatar || '',
          badge: '👑 Bảo Trợ Đàn Tràng',
          lastWish: wish
        };
        const scroll = triggerSilkScroll(dev, catKey, wish);
        return { ok: true, scroll };
      } else if (simType === 'switchScene') {
        const sceneId = params.sceneId || 'altar';
        return setStageScene(sceneId, params.reason || 'Admin giả lập chuyển cảnh');
      }
      return { ok: true };
    }

    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

// Bắt đầu chu kỳ quét lịch sự kiện tự động
setInterval(() => {
  try {
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (state.ceremonySchedule && Array.isArray(state.ceremonySchedule)) {
      for (const c of state.ceremonySchedule) {
        if (c.autoTrigger && c.time === currentHHMM && c.status === 'pending') {
          triggerCeremony(c.id);
        }
      }
    }
  } catch (err) {
    console.warn('[Ceremony Scheduler Error]', err.message);
  }
}, 10000);

// Chu kỳ cập nhật gợi ý thông minh prompter theo ngữ cảnh phòng Live (mỗi 25 giây)
setInterval(() => {
  try {
    evaluateSmartPrompt();
  } catch (err) {
    console.warn('[SmartPrompt Scheduler Error]', err.message);
  }
}, 25000);

// Chu kỳ kích hoạt Mini-Event ngẫu nhiên (mỗi 10 phút nếu phòng đang rảnh)
setInterval(() => {
  try {
    if (state.miniEventEngine?.enabled && !state.miniEventEngine.activeEvent && !state.activePoll?.active) {
      const events = state.miniEventEngine.availableEvents || [];
      if (events.length > 0) {
        const randomEvt = events[Math.floor(Math.random() * events.length)];
        startMiniEvent(randomEvt.id);
      }
    }
  } catch (err) {
    console.warn('[MiniEvent Auto Loop Error]', err.message);
  }
}, 10 * 60 * 1000);

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[HTTP ${req.method}] ${res.statusCode} ${req.url} (${Date.now() - start}ms)`);
  });
  next();
});
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));

// Route chuyên dụng cho TikTok Live Studio & OBS Browser Source (chỉ hiển thị 100% màn hình đài hoá vàng 9:16 sạch)
app.get(['/obs', '/live', '/stream'], (_req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('<body>', '<body class="obs-mode">');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading live template');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

app.all('/api/tts', async (req, res) => {
  const text = (req.body?.text || req.query?.text || '').trim();
  const voice = (req.body?.voice || req.query?.voice || state.settings.ttsVoice || 'maichi').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
  }
  const result = await ttsManager.synthesize(text, voice);
  res.json(result);
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastNotification(method, params) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload, (err) => {
          if (err) {
            // Write failed on disconnected socket, ignore safely
          }
        });
      } catch (_) {}
    }
  }
}

wss.on('error', (err) => {
  console.warn('[WebSocketServer Error]', err?.message || err);
});

wss.on('connection', (ws) => {
  ws.on('error', (err) => {
    console.warn('[WebSocket Client Error]', err?.message || err);
  });

  try {
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'temple.state',
        params: getPublicState()
      }),
      () => {}
    );
  } catch (_) {}

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          }),
          () => {}
        );
      }
    } catch (err) {
      if (msg.id !== undefined && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          }),
          () => {}
        );
      }
    }
  });
});

const ttsManager = new HybridTTSManager();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================================`);
  console.log(`🔥 ĐÀN TRÀNG HOÁ VÀNG ONLINE — TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG`);
  console.log(`📺 Màn hình Live + Điều khiển (9:16): http://localhost:${PORT}`);
  console.log(`🎥 Màn hình OBS Browser Source Sạch : http://localhost:${PORT}/?obs=1`);
  console.log(`🎛️ Bảng điều khiển RPC Admin        : http://localhost:${PORT}/admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint            : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  console.log(`====================================================================`);

  // Khởi động simulation engine ngay khi server chạy để màn hình luôn sôi động
  configureAutoSim(state.settings.autoSim !== false);

  // Kích hoạt Mini-Event đầu tiên sau 6 giây nếu chưa có event nào chạy
  setTimeout(() => {
    if (state.miniEventEngine?.enabled && !state.miniEventEngine.activeEvent) {
      startMiniEvent('incense_rush');
    }
  }, 6000);

  // Khởi động chu kỳ bình chọn tự động mỗi 6 phút để người xem tham gia bầu chọn vật phẩm
  setInterval(() => {
    if (!state.activePoll?.active && (!state.miniEventEngine?.activeEvent || Date.now() > state.miniEventEngine.activeEvent.endsAt)) {
      startLivePoll('Bình chọn vật phẩm hoá vàng đợt tiếp theo (Gõ 1, 2, 3, 4):', null, 45);
    }
  }, 6 * 60 * 1000);

  // Tự động quét và kết nối khi kênh @quangvangma1 phát LIVE (chu kỳ 15s để tránh bị TikTok rate limit)
  let isAutoScanning = false;
  setInterval(async () => {
    if (state.tiktok.connected || state.tiktok.connecting || isAutoScanning) return;
    const targetUser = state.tiktok.username || 'quangvangma1';
    if (!targetUser) return;
    try {
      isAutoScanning = true;
      await connectTikTokLive(targetUser);
    } catch (_) {
      // Khi kênh chưa phát live: bỏ qua và đợi chu kỳ quét kế tiếp
    } finally {
      isAutoScanning = false;
    }
  }, 15000);
});
