const express = require('express');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. KHO LỄ VẬT VÀNG MÃ & BỘ QUẺ LINH XĂM TÀI LỘC
// ============================================================================
const VOTIVE_CATALOG = {
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
  totalMerit: 6880,
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
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.30,
    ttsVolume: 0.95,
    smokeDensity: 1.0,
    stageBg: 'hoavang',
    autoSim: false,
    autoSimIntervalMs: 8000
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
        devotees: saved.devotees && Object.keys(saved.devotees).length > 0 ? saved.devotees : DEFAULT_STATE.devotees,
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = {
      totalIncense: state.totalIncense,
      totalVotiveBurned: state.totalVotiveBurned,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings
    };
    fs.promises.writeFile(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1000);
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
      lastWish: d.lastWish || ''
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

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, votiveDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const key = (uniqueId || displayName).slice(0, 40);
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      votiveCount: 0,
      gifts: 0,
      lastWish: ''
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.votiveCount = (dev.votiveCount || 0) + votiveDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;

  state.totalMerit += meritDelta;
  state.totalVotiveBurned = (state.totalVotiveBurned || 0) + votiveDelta;
  state.haloIntensity = Math.min(1.0, 0.45 + (state.totalMerit % 1000) / 1400);
  return dev;
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
    const merit = count * itemInfo.baseMerit;

    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 1);
    state.offerings[itemKey] = (state.offerings[itemKey] || 0) + count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, count, 0, wish);

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

  // 4.2. Quạt lửa lò hoá vàng / Gõ mõ (Thả tim Like)
  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count * 2;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 1);

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
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

  // 4.4. Hoá Sớ Cầu Tài Lộc / Đèn Hoa Đăng
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
      if (coins >= 100) itemKey = 'dragon_treasury';
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
    try {
      const resp = await fetch(urlToFetch, { redirect: 'follow' });
      const finalUrl = resp.url || '';
      const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
      if (resolvedMatch && resolvedMatch[1]) {
        return resolvedMatch[1];
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
    recordDevotee(user, uniqueId, avatar, 2, 0, 0, 0, 'Đã vào Đàn Tràng Hoá Vàng');
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    parseViewerComment(commentText, user, uniqueId, avatar);
  });

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
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
    if (repeatCount <= prevCount && data?.repeatEnd) {
      giftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = Math.max(1, repeatCount - prevCount);
    giftComboTracker.set(groupId, repeatCount);
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
  {
    user: 'Ngọc Anh Chuyên Sỉ',
    uniqueId: 'ngocanh.shop',
    wish: 'Thành tâm hoá 9 thoi vàng cầu tháng mới đơn hàng nổ liên tục'
  },
  {
    user: 'Trần Minh Quân',
    uniqueId: 'minhquan_bds',
    wish: 'Hoá Biệt Thự & Siêu Xe kính biếu Gia Tiên, cầu chốt đất đại thắng'
  },
  {
    user: 'Diệu Thảo Tâm An',
    uniqueId: 'tam_an_99',
    wish: 'Con thành tâm hoá vàng cầu cho bố mẹ luôn mạnh khỏe, gia đạo bình an'
  },
  {
    user: 'Lê Hoàng Nam',
    uniqueId: 'hoangnam.dev',
    wish: 'Hoá Ngựa Đỏ Xích Thố cầu công danh sự nghiệp mã đáo thành công'
  },
  {
    user: 'Phạm Thanh Hà',
    uniqueId: 'thanhha.99',
    wish: 'Dâng sớ cầu Thần Tài Thổ Địa phù hộ buôn may bán đắt tiền vào như nước'
  },
  {
    user: 'Vũ Đức Thịnh',
    uniqueId: 'ducthinh88',
    wish: 'Con xin gieo một quẻ cầu tài lộc buôn bán tháng này'
  }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();
  if (roll < 0.32) {
    Rituals.burnVotive({
      user: pick.user,
      uniqueId: pick.uniqueId,
      itemKey: 'gold_ingot',
      count: 9,
      wish: pick.wish
    });
  } else if (roll < 0.52) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.68) {
    Rituals.offerGift({
      user: pick.user,
      uniqueId: pick.uniqueId,
      itemKey: 'luxury_villa_car',
      coins: 50,
      giftName: 'Biệt Thự Phố & Siêu Xe Vàng',
      wish: pick.wish
    });
  } else if (roll < 0.84) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else {
    Rituals.offerGift({
      user: pick.user,
      uniqueId: pick.uniqueId,
      itemKey: 'sacred_horse',
      coins: 15,
      giftName: 'Ngựa Đỏ Xích Thố Thần Hành',
      wish: pick.wish
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
    autoSimTimer = setInterval(runSingleSimulationStep, state.settings.autoSimIntervalMs || 8000);
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

    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

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
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'temple.state',
      params: getPublicState()
    })
  );

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
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
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

  // Tự động quét và kết nối tức thì khi kênh @quangvangma1 vừa bấm phát LIVE (chu kỳ 5s)
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
  }, 5000);
});
