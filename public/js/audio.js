/**
 * TempleAudioEngine — Hệ thống Âm Thanh Trầm Ấm (Zero-Harshness) & Giọng Đọc AI Tiếng Việt
 * - Nhạc nền: Sử dụng âm trầm ấm 108Hz–216Hz (/assets/bg_chant.wav) lọc sạch tần số cao gây chói tai,
 *   tự động hạ nhỏ âm lượng (auto-ducking) khi có giọng AI đọc lời khấn.
 * - Tiếng Lửa Cháy & Pháp Khí: Đều đi qua bộ lọc Low-pass (< 420Hz) tạo chất âm gỗ/đồng trầm ấm, êm tai khi nghe lâu.
 * - Giọng đọc AI Tiếng Việt: Hỗ trợ Cloud TTS MP3 Cache + ZeroTTS + Browser SpeechSynthesis fallback.
 */
class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';

    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    // Mặc định âm lượng nhạc nền ở mức 30% dịu nhẹ, không gây chói tai khi yên tĩnh
    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.30;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.95;

    this.useSynthMusicFallback = false;
    this.synthBgTimer = null;
    this.fireLoopSource = null;
    this.fireGain = null;
    this.bgAudio = new Audio('/assets/bg_chant.wav');
    this.bgAudio.loop = true;
    this.bgAudio.preload = 'auto';
    this.bgAudio.volume = this.getEffectiveBgVolume(false);
    this.bgAudio.onerror = () => {
      this.useSynthMusicFallback = true;
    };

    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.currentBufferSource = null;
    this.ttsAudio = new Audio();
    this.ttsAudio.playsInline = true;
    this.ttsAudio.preload = 'auto';
    this.onTtsStateChange = null;
  }

  // Giới hạn trần âm lượng nhạc nền thực tế tối đa 0.42 để luôn êm dịu
  getEffectiveBgVolume(ducked = false) {
    const scaled = this.bgBaseVolume * 0.42;
    if (ducked) {
      return Math.max(0.03, +(scaled * 0.3).toFixed(3));
    }
    return +scaled.toFixed(3);
  }

  ensureContext() {
    // Bắt buộc iOS 16.4+/17/18 Safari chuyển sang chế độ Media Playback (phát tiếng kể cả khi gạt nút Rung & truyền vào TikTok ReplayKit)
    try {
      if ('audioSession' in navigator && navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch (_) {}

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.unlocked) {
      this.unlocked = true;
      // Mở khoá HTMLAudioElement dùng chung và Web Speech trên iOS Safari ngay trong cử chỉ chạm đầu tiên
      try {
        const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuffer;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch (_) {}
      try {
        if ('speechSynthesis' in window) {
          const warm = new SpeechSynthesisUtterance('');
          warm.volume = 0;
          window.speechSynthesis.speak(warm);
        }
      } catch (_) {}
    }
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    return this.ctx;
  }

  setMusicVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = v;
    try {
      localStorage.setItem('temple_music_vol', String(v));
    } catch (_) {}
    if (this.bgAudio && !this.useSynthMusicFallback) {
      this.bgAudio.volume = this.getEffectiveBgVolume(this.ttsPlaying);
    }
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('temple_tts_vol', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.ttsVolume;
    }
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled) return;
    this.startSacredZenSoundscape();
    try {
      this.bgAudio.volume = this.getEffectiveBgVolume(this.ttsPlaying);
      if (this.bgAudio.paused) {
        const p = this.bgAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            this.useSynthMusicFallback = true;
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
    }
  }

  // Hệ thống Âm Thanh Thiền Tâm Linh Đa Tầng (Harmonic Tibetan Singing Bowls & Bronze Chimes Ngũ Cung 432Hz)
  startSacredZenSoundscape() {
    if (!this.bgMusicEnabled || this.synthBgTimer) return;
    this.startContinuousFireAmbience();

    const TIBETAN_PENTATONIC = [
      { base: 216.0, ratios: [1.0, 2.76, 5.4], amps: [0.18, 0.08, 0.03], dur: 6.5 },
      { base: 256.0, ratios: [1.0, 2.76, 5.4], amps: [0.16, 0.07, 0.025], dur: 6.0 },
      { base: 288.0, ratios: [1.0, 2.76, 5.4], amps: [0.15, 0.06, 0.02], dur: 5.8 },
      { base: 324.0, ratios: [1.0, 2.76, 5.4], amps: [0.17, 0.07, 0.025], dur: 6.2 },
      { base: 384.0, ratios: [1.0, 2.76, 5.4], amps: [0.14, 0.05, 0.02], dur: 5.5 },
      { base: 432.0, ratios: [1.0, 2.76, 5.4], amps: [0.18, 0.08, 0.03], dur: 7.0 }
    ];

    let melodyStep = 0;
    const playTibetanHarmonicTone = () => {
      if (!this.bgMusicEnabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const tone = TIBETAN_PENTATONIC[melodyStep % TIBETAN_PENTATONIC.length];
        melodyStep++;
        const masterVol = this.getEffectiveBgVolume(this.ttsPlaying);
        if (masterVol <= 0.001) return;

        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(masterVol, now);
        masterGain.connect(this.ctx.destination);

        tone.ratios.forEach((ratio, idx) => {
          const osc = this.ctx.createOscillator();
          const lp = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(tone.base * ratio, now);

          if (idx > 0) {
            osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
          }

          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(850, now);

          const amp = tone.amps[idx] || 0.05;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(amp, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.dur);

          osc.connect(lp);
          lp.connect(gain);
          gain.connect(masterGain);

          osc.onended = () => {
            osc.disconnect();
            lp.disconnect();
            gain.disconnect();
            if (idx === 0) masterGain.disconnect();
          };
          osc.start(now);
          osc.stop(now + tone.dur + 0.1);
        });

        // Nhịp gõ mõ thiền nhẹ nhàng cách quãng
        if (melodyStep % 2 === 0) {
          setTimeout(() => {
            this.playWoodenFish(0.92);
          }, 2600);
        }
      } catch (_) {}
    };

    playTibetanHarmonicTone();
    this.synthBgTimer = setInterval(playTibetanHarmonicTone, 5600);
  }

  // Tiếng than hồng lò lửa bập bùng âm trầm chân thực (Continuous Fire Hearth Ambience)
  startContinuousFireAmbience() {
    if (this.fireLoopSource || !this.ctx || !this.bgMusicEnabled) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const bufferLength = sampleRate * 4;
      const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
      const data = buffer.getChannelData(0);

      let brown = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        const crackle = Math.random() < 0.0018 ? (Math.random() * 2 - 1) * 0.45 : 0;
        data[i] = (brown * 0.38 + crackle);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, this.ctx.currentTime);

      this.fireGain = this.ctx.createGain();
      this.fireGain.gain.setValueAtTime(this.getEffectiveBgVolume(this.ttsPlaying) * 0.35, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(this.fireGain);
      this.fireGain.connect(this.ctx.destination);

      noise.start(0);
      this.fireLoopSource = noise;
    } catch (_) {}
  }

  stopZenAmbience() {
    try {
      this.bgAudio.pause();
    } catch (_) {}
    if (this.synthBgTimer) {
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
    if (this.fireLoopSource) {
      try {
        this.fireLoopSource.stop();
        this.fireLoopSource.disconnect();
      } catch (_) {}
      this.fireLoopSource = null;
    }
  }

  setBgDucking(ducked) {
    if (!this.bgMusicEnabled) return;
    try {
      if (!this.useSynthMusicFallback && this.bgAudio) {
        this.bgAudio.volume = this.getEffectiveBgVolume(ducked);
      }
      if (this.fireGain && this.ctx) {
        const target = this.getEffectiveBgVolume(ducked) * 0.35;
        this.fireGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.4);
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 1. TIẾNG LỬA CHÁY TRẦM ẤM TRONG LÒ HOÁ VÀNG (WARM LOW-PASSED FIRE CRACKLE)
  // --------------------------------------------------------------------------
  playFireCrackle(durationSec = 1.4, intensity = 0.85) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * durationSec);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      let brown = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.025 * white) / 1.025;
        const cracklePop = Math.random() < 0.0022 ? (Math.random() * 2 - 1) * 0.55 : 0;
        const env = Math.sin((i / length) * Math.PI);
        data[i] = (brown * 0.45 + cracklePop) * env;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Lọc Low-pass ở 340Hz để tiếng lửa trầm ấm như bếp củi, không bị xè/chói
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22 * Math.min(1.2, intensity), now);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      noise.start(now);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ & THẢ TIM TRẦM ẤM (WARM WOODEN FISH)
  // --------------------------------------------------------------------------
  playWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      // Hạ tần số mõ xuống quãng trầm ấm (340Hz thay vì 620Hz)
      const baseFreq = 340 * pitchMultiplier * (0.98 + Math.random() * 0.04);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq * 1.25, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG TRẦM HÙNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const base = 136.1; // Chuông đồng tần số Om (136.1Hz) cực kỳ trầm ấm
      const partials = [
        { ratio: 0.5, amp: 0.25, decay: 4.2 },
        { ratio: 1.0, amp: 0.32, decay: 3.6 },
        { ratio: 1.5, amp: 0.12, decay: 2.2 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.22 * Math.min(1.0, intensity), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playWoodenFish(1.12 + (i % 2) * 0.1);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG ĐỒNG NHẸ KHI HOÁ VÀNG (WARM BOWL CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      // Dùng tần số trầm ấm 264Hz - 330Hz thay vì 528Hz - 660Hz
      const notes = [264, 330];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.25);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. AI TTS VOICE QUEUE & PREFETCHER
  // --------------------------------------------------------------------------
  enqueueTts(text, options = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    if (!this.ttsEnabled) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }

    if (this.ttsQueue.length >= 6) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || null,
      fallbackBrowserTts: Boolean(options.fallbackBrowserTts),
      onStart,
      onEnd,
      fetchPromise: null
    };

    if (!item.url && !item.fallbackBrowserTts) {
      item.fetchPromise = this.fetchTtsAudio(item.text, item.voice);
    }

    this.ttsQueue.push(item);
    this.processTtsQueue();
  }

  async fetchTtsAudio(text, voice = 'maichi') {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      const data = await res.json();
      if (data && data.ok) {
        return data;
      }
      return { ok: true, fallbackBrowserTts: true, text };
    } catch (_) {
      return { ok: true, fallbackBrowserTts: true, text };
    }
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();

    try {
      let audioUrl = item.url;
      let useBrowserSpeech = item.fallbackBrowserTts;

      if (!audioUrl && item.fetchPromise) {
        const res = await item.fetchPromise;
        if (res && res.url) {
          audioUrl = res.url;
        } else if (res && res.fallbackBrowserTts) {
          useBrowserSpeech = true;
        }
      }

      if (audioUrl) {
        this.setBgDucking(true);
        if (item.onStart) item.onStart();
        await this.playAudioUrl(audioUrl, item.text);
        if (item.onEnd) item.onEnd();
      } else if (useBrowserSpeech) {
        this.setBgDucking(true);
        if (item.onStart) item.onStart();
        await this.playBrowserSpeech(item.text);
        if (item.onEnd) item.onEnd();
      } else {
        if (item.onStart) item.onStart();
        if (item.onEnd) setTimeout(item.onEnd, 5500);
      }
    } catch (_) {
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      this.ttsPlaying = false;
      if (this.ttsQueue.length === 0) {
        this.setBgDucking(false);
      } else {
        setTimeout(() => this.processTtsQueue(), 220);
      }
    }
  }

  async playAudioUrl(url, fallbackText = '') {
    // Ưu tiên giải mã MP3 qua Web Audio API (AudioContext) để iOS Safari phát mượt 100% khi nhận sự kiện từ WebSocket
    if (this.ctx) {
      try {
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
          return await new Promise((resolve) => {
            const source = this.ctx.createBufferSource();
            const gainNode = this.ctx.createGain();
            source.buffer = audioBuf;
            gainNode.gain.value = this.ttsVolume;
            source.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            this.currentBufferSource = source;
            source.onended = () => {
              this.currentBufferSource = null;
              try {
                source.disconnect();
                gainNode.disconnect();
              } catch (_) {}
              resolve();
            };
            source.start(0);
          });
        }
      } catch (_) {}
    }

    return new Promise((resolve) => {
      try {
        const audio = this.ttsAudio || new Audio();
        audio.src = url;
        this.currentAudio = audio;
        audio.volume = this.ttsVolume;
        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          if (fallbackText) {
            this.playBrowserSpeech(fallbackText).then(resolve);
          } else {
            resolve();
          }
        };
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this.currentAudio = null;
            if (fallbackText) {
              this.playBrowserSpeech(fallbackText).then(resolve);
            } else {
              resolve();
            }
          });
        }
      } catch (_) {
        resolve();
      }
    });
  }

  playBrowserSpeech(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        setTimeout(resolve, 4000);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'vi-VN';
        utter.rate = 1.02;
        utter.volume = this.ttsVolume;
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang && v.lang.toLowerCase().includes('vi'));
        if (viVoice) utter.voice = viVoice;
        const timer = setTimeout(resolve, 9000);
        utter.onend = () => {
          clearTimeout(timer);
          resolve();
        };
        utter.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
        window.speechSynthesis.speak(utter);
      } catch (_) {
        setTimeout(resolve, 3500);
      }
    });
  }
}

window.TempleAudioEngine = TempleAudioEngine;
