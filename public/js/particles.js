/**
 * Ultra-Low-CPU 2.5D Sacred Furnace & Temple Canvas Particle Engine
 * Tối ưu hóa cho OBS / TikTok Live Studio treo máy 24/7 (1080x1920 @ 30 FPS):
 * - Cố định 30 FPS, tự động tạm dừng khi ẩn tab
 * - Pre-render toàn bộ Ngọn lửa Lò Hoá Vàng, Khói hương, Tia lửa vàng, Cánh hoa sen ra Offscreen Canvas
 * - Hiệu ứng Vật phẩm Vàng mã bay theo quỹ đạo Parabol vào Lò Đỉnh Đồng -> Bùng lửa vàng -> Hoá tàn tro kim quang bay về trời
 */
class TempleParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    this.width = 1080;
    this.height = 1920;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.furnaceFlames = [];
    this.smokeParticles = [];
    this.lotusPetals = [];
    this.goldSparks = [];
    this.soundWaves = [];
    this.floatingTexts = [];
    this.burstParticles = [];
    this.flyingVotives = [];
    this.floatingHearts = [];

    // Tọa độ lòng Lò Hoá Vàng Lưỡng Long Chầu Âm Dương trung tâm
    this.furnaceCenter = { x: 520, y: 1035 };
    this.furnaceBoost = 0; // Tăng bùng lửa khi đang hoá vàng
    this.incenseTips = [
      { x: 185, y: 955 },
      { x: 195, y: 950 },
      { x: 515, y: 215 }
    ];
    this.smokeDensity = 1.0;
    this.time = 0;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 30; // 30 FPS siêu nhẹ CPU

    this.buildOffscreenSprites();
    this.initAmbientParticles();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildOffscreenSprites() {
    // 1. Pre-render Smoke Puff Sprite (64x64)
    this.smokeSprite = document.createElement('canvas');
    this.smokeSprite.width = 64;
    this.smokeSprite.height = 64;
    const sctx = this.smokeSprite.getContext('2d');
    const sgrad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    sgrad.addColorStop(0, 'rgba(255, 244, 214, 0.78)');
    sgrad.addColorStop(0.5, 'rgba(235, 215, 175, 0.36)');
    sgrad.addColorStop(1, 'rgba(210, 190, 150, 0)');
    sctx.fillStyle = sgrad;
    sctx.beginPath();
    sctx.arc(32, 32, 30, 0, Math.PI * 2);
    sctx.fill();

    // 2. Pre-render Furnace Flame Sprite (72x96)
    this.flameSprite = document.createElement('canvas');
    this.flameSprite.width = 72;
    this.flameSprite.height = 96;
    const fctx = this.flameSprite.getContext('2d');
    const fgrad = fctx.createRadialGradient(36, 56, 4, 36, 48, 36);
    fgrad.addColorStop(0, 'rgba(255, 255, 220, 0.96)');
    fgrad.addColorStop(0.35, 'rgba(255, 200, 55, 0.82)');
    fgrad.addColorStop(0.7, 'rgba(255, 95, 15, 0.42)');
    fgrad.addColorStop(1, 'rgba(200, 20, 0, 0)');
    fctx.fillStyle = fgrad;
    fctx.beginPath();
    fctx.moveTo(36, 6);
    fctx.bezierCurveTo(64, 34, 68, 72, 36, 90);
    fctx.bezierCurveTo(4, 72, 8, 34, 36, 6);
    fctx.fill();

    // 3. Pre-render Gold Spark / Ash Ember Sprite (18x18)
    this.sparkSprite = document.createElement('canvas');
    this.sparkSprite.width = 18;
    this.sparkSprite.height = 18;
    const gctx = this.sparkSprite.getContext('2d');
    const ggrad = gctx.createRadialGradient(9, 9, 1, 9, 9, 8);
    ggrad.addColorStop(0, 'rgba(255, 250, 205, 1)');
    ggrad.addColorStop(0.5, 'rgba(255, 195, 65, 0.72)');
    ggrad.addColorStop(1, 'rgba(255, 120, 20, 0)');
    gctx.fillStyle = ggrad;
    gctx.beginPath();
    gctx.arc(9, 9, 8, 0, Math.PI * 2);
    gctx.fill();

    // 4. Pre-render Pink & Gold Lotus Petal Sprites (28x28)
    this.pinkPetalSprite = this.createPetalSprite('rgba(248, 165, 194, 0.82)');
    this.goldPetalSprite = this.createPetalSprite('rgba(255, 218, 100, 0.88)');
  }

  createPetalSprite(fillStyle) {
    const c = document.createElement('canvas');
    c.width = 28;
    c.height = 28;
    const pctx = c.getContext('2d');
    const sz = 11;
    pctx.translate(14, 14);
    pctx.beginPath();
    pctx.moveTo(0, -sz);
    pctx.bezierCurveTo(sz * 0.85, -sz * 0.4, sz * 0.75, sz * 0.75, 0, sz);
    pctx.bezierCurveTo(-sz * 0.75, sz * 0.75, -sz * 0.85, -sz * 0.4, 0, -sz);
    pctx.fillStyle = fillStyle;
    pctx.fill();
    return c;
  }

  initAmbientParticles() {
    for (let i = 0; i < 24; i++) {
      this.goldSparks.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: 8 + Math.random() * 9,
        vy: -(0.7 + Math.random() * 1.3),
        vx: (Math.random() - 0.5) * 0.55,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.4 + Math.random() * 0.55
      });
    }

    for (let i = 0; i < 9; i++) {
      this.lotusPetals.push(this.createLotusPetal(true));
    }
  }

  createLotusPetal(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -30 - Math.random() * 100,
      scale: 0.7 + Math.random() * 0.55,
      vy: 1.2 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.9,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.035,
      swayPhase: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.45
    };
  }

  setIncenseTips(tips) {
    this.incenseTips = Array.isArray(tips) ? tips : [];
  }

  // Sinh ngọn lửa cháy liên tục trong Lò Hoá Vàng Lưỡng Long
  spawnFurnaceFlames() {
    const maxFlames = this.furnaceBoost > 0.1 ? 32 : 16;
    if (this.furnaceFlames.length >= maxFlames) return;

    const count = this.furnaceBoost > 0.2 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const spreadX = (Math.random() - 0.5) * (150 + this.furnaceBoost * 50);
      this.furnaceFlames.push({
        x: this.furnaceCenter.x + spreadX,
        y: this.furnaceCenter.y + (Math.random() - 0.5) * 18,
        vx: -spreadX * 0.012 + (Math.random() - 0.5) * 0.6,
        vy: -(2.5 + Math.random() * 2.6 + this.furnaceBoost * 2.8),
        w: 44 + Math.random() * 36 + this.furnaceBoost * 24,
        h: 64 + Math.random() * 46 + this.furnaceBoost * 32,
        age: 0,
        maxAge: 22 + Math.random() * 16,
        alpha: 0.65 + Math.random() * 0.3,
        seed: Math.random() * 20
      });
    }
  }

  spawnSmokeFromTips() {
    if (this.smokeParticles.length >= 24) return;
    if (Math.random() > 0.52 * this.smokeDensity) return;

    const tip =
      this.incenseTips.length > 0
        ? this.incenseTips[Math.floor(Math.random() * this.incenseTips.length)]
        : { x: this.furnaceCenter.x, y: this.furnaceCenter.y - 45 };

    this.smokeParticles.push({
      x: tip.x + (Math.random() - 0.5) * 14,
      y: tip.y - 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(2.3 + Math.random() * 1.1),
      radius: 10 + Math.random() * 6,
      maxRadius: 34 + Math.random() * 18,
      alpha: 0.24 + Math.random() * 0.12,
      age: 0,
      maxAge: 68 + Math.random() * 25,
      seed: Math.random() * 50
    });
  }

  // Hiệu ứng Lễ vật Vàng mã bay vào Lò Hoá Vàng -> Bùng lửa thiêng
  spawnVotiveBurning(emoji = '🪙', count = 3, onIgnite) {
    const safeCount = Math.min(8, Math.max(1, Number(count) || 3));
    this.furnaceBoost = Math.min(1.6, this.furnaceBoost + 0.85);

    for (let i = 0; i < safeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const startX = 540 + side * (160 + (i % 3) * 55);
      const startY = 1230 + (i % 2) * 45;
      const ctrlX = 540 + side * 90;
      const ctrlY = 760 - (i % 3) * 35;

      this.flyingVotives.push({
        emoji,
        startX,
        startY,
        ctrlX,
        ctrlY,
        targetX: this.furnaceCenter.x + (Math.random() - 0.5) * 28,
        targetY: this.furnaceCenter.y - 12,
        t: -i * 0.12, // Độ trễ nối đuôi nhau bay vào lò
        speed: 0.042,
        rot: (Math.random() - 0.5) * 0.5,
        vrot: side * 0.06,
        onIgnite: i === 0 ? onIgnite : null
      });
    }
  }

  spawnIncenseBurst(x = 540, y = 940, count = 24) {
    this.furnaceBoost = Math.min(1.5, this.furnaceBoost + 0.65);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.35;
      const speed = 3.0 + Math.random() * 6.5;
      this.burstParticles.push({
        x: x + (Math.random() - 0.5) * 28,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2.5 + Math.random() * 3.5,
        alpha: 1,
        decay: 0.028 + Math.random() * 0.018,
        color: i % 3 === 0 ? '#fff3b0' : i % 3 === 1 ? '#ffb703' : '#ff5400'
      });
    }
  }

  spawnBellWave(x = 540, y = 510, count = 2) {
    for (let i = 0; i < Math.min(count, 3); i++) {
      this.soundWaves.push({
        x,
        y,
        radius: 34 + i * 24,
        maxRadius: 440 + i * 50,
        alpha: 0.76 - i * 0.16,
        lineWidth: 3.2 - i * 0.6
      });
    }
  }

  spawnFloatingMerit(text = '+15 Lộc Đức', x = 540, y = 910, color = '#ffe082') {
    if (this.floatingTexts.length > 8) this.floatingTexts.shift();
    this.floatingTexts.push({
      text,
      x: x + (Math.random() - 0.5) * 36,
      y,
      vy: -3.2,
      alpha: 1.0,
      color
    });
  }

  // Hiệu ứng Mưa Tim TikTok Live bay lên (Thả tim quạt lửa phân cấp)
  spawnHearts(count = 8) {
    this.spawnTieredHearts(1, count);
  }

  spawnTieredHearts(tier = 1, count = 10) {
    const emojis = ['❤️', '💖', '🔥', '💛', '🧡', '✨'];
    let safeCount = 8;
    let boost = 0.45;

    if (tier === 1) {
      safeCount = Math.min(18, Math.max(4, count));
      boost = 0.45;
    } else if (tier === 2) {
      safeCount = Math.min(40, Math.max(22, count));
      boost = 0.95;
    } else if (tier === 3) {
      safeCount = Math.min(70, Math.max(45, count));
      boost = 1.45;
    } else if (tier >= 4) {
      safeCount = Math.min(110, Math.max(65, count));
      boost = 2.0;
      this.spawnGrandCeremonyRain();
    }

    this.furnaceBoost = Math.min(2.0, this.furnaceBoost + boost);

    for (let i = 0; i < safeCount; i++) {
      if (this.floatingHearts.length > 90) this.floatingHearts.shift();
      const isGold = tier >= 3 && Math.random() < 0.45;
      this.floatingHearts.push({
        emoji: isGold ? '✨' : emojis[i % emojis.length],
        x: (tier >= 2 ? 520 : 880) + (Math.random() - 0.5) * (tier >= 3 ? 420 : 220),
        y: (tier >= 2 ? 1150 : 1580) + Math.random() * 120,
        vx: (Math.random() - 0.5) * (tier >= 2 ? 3.4 : 1.6),
        vy: -(3.8 + Math.random() * (tier >= 2 ? 4.8 : 2.6)),
        size: (tier >= 3 ? 36 : 28) + Math.random() * 18,
        sway: Math.random() * Math.PI * 2,
        alpha: 1.0,
        decay: (tier >= 3 ? 0.007 : 0.012) + Math.random() * 0.006
      });
    }
  }

  spawnGrandCeremonyRain() {
    this.furnaceBoost = 1.8;
    for (let i = 0; i < 18; i++) {
      this.lotusPetals.push(this.createLotusPetal(false));
    }
    this.spawnVotiveBurning('🪙', 6);
    for (let i = 0; i < 42; i++) {
      const angle = (Math.PI * 2 * i) / 42;
      const speed = 3.8 + Math.random() * 8.0;
      this.burstParticles.push({
        x: 540,
        y: 520,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4.0,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.014,
        color: i % 3 === 0 ? '#fff3b0' : i % 3 === 1 ? '#ffb703' : '#ff6d00'
      });
    }
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    if (document.hidden) return;
    if (timestamp - this.lastFrameTime < this.frameInterval) return;
    this.lastFrameTime = timestamp;

    this.time += 0.035;
    if (this.furnaceBoost > 0) {
      this.furnaceBoost = Math.max(0, this.furnaceBoost - 0.018);
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Hạt tàn tro kim quang bay lên trời
    for (let i = 0; i < this.goldSparks.length; i++) {
      const sp = this.goldSparks[i];
      sp.y += sp.vy - this.furnaceBoost * 0.6;
      sp.x += sp.vx + Math.sin(this.time + sp.phase) * 0.45;
      if (sp.y < -20) {
        sp.y = this.height + 15;
        sp.x = Math.random() * this.width;
      }
      ctx.globalAlpha = sp.alpha * (0.55 + 0.45 * Math.sin(this.time * 2.0 + sp.phase));
      ctx.drawImage(this.sparkSprite, sp.x - sp.size * 0.5, sp.y - sp.size * 0.5, sp.size, sp.size);
    }

    // 2. Khói trầm & Khói lò hoá vàng
    this.spawnSmokeFromTips();
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.age += 1;
      if (p.age >= p.maxAge || p.y < 380) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      const progress = p.age / p.maxAge;
      const curl = Math.sin(this.time * 1.5 + p.seed + p.y * 0.014) * 0.6;
      p.x += p.vx + curl * (0.3 + progress * 0.5);
      p.y += p.vy;

      const r = p.radius + (p.maxRadius - p.radius) * progress;
      const fade = Math.sin(progress * Math.PI) * p.alpha * (1 - progress * 0.6);
      ctx.globalAlpha = Math.max(0, fade);
      ctx.drawImage(this.smokeSprite, p.x - r, p.y - r, r * 2, r * 2);
    }

    // 3. Ngọn lửa thiêng bập bùng trong Lò Hoá Vàng Đỉnh Đồng
    this.spawnFurnaceFlames();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.furnaceFlames.length - 1; i >= 0; i--) {
      const fl = this.furnaceFlames[i];
      fl.age += 1;
      if (fl.age >= fl.maxAge) {
        this.furnaceFlames.splice(i, 1);
        continue;
      }
      const prog = fl.age / fl.maxAge;
      fl.x += fl.vx + Math.sin(this.time * 4 + fl.seed) * 0.9;
      fl.y += fl.vy;
      const scale = 1 - prog * 0.45;
      const w = fl.w * scale;
      const h = fl.h * scale;
      ctx.globalAlpha = Math.sin(prog * Math.PI) * fl.alpha;
      ctx.drawImage(this.flameSprite, fl.x - w * 0.5, fl.y - h * 0.7, w, h);
    }
    ctx.restore();

    // 4. Vật phẩm Vàng Mã đang bay theo đường cong Parabol vào Lò Hoá Vàng
    if (this.flyingVotives.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = this.flyingVotives.length - 1; i >= 0; i--) {
        const v = this.flyingVotives[i];
        v.t += v.speed;
        if (v.t < 0) continue;

        if (v.t >= 1) {
          this.spawnIncenseBurst(v.targetX, v.targetY, 16);
          if (typeof v.onIgnite === 'function') v.onIgnite();
          this.flyingVotives.splice(i, 1);
          continue;
        }

        const inv = 1 - v.t;
        const x = inv * inv * v.startX + 2 * inv * v.t * v.ctrlX + v.t * v.t * v.targetX;
        const y = inv * inv * v.startY + 2 * inv * v.t * v.ctrlY + v.t * v.t * v.targetY;
        const scale = 1.15 - v.t * 0.35;
        v.rot += v.vrot;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(v.rot);
        ctx.font = `${Math.round(52 * scale)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.globalAlpha = 1;
        ctx.fillText(v.emoji, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // 5. Cánh hoa sen & Lộc vàng rơi
    ctx.globalAlpha = 1;
    for (let i = this.lotusPetals.length - 1; i >= 0; i--) {
      const petal = this.lotusPetals[i];
      petal.y += petal.vy;
      petal.x += petal.vx + Math.sin(this.time + petal.swayPhase) * 0.7;
      petal.rot += petal.vrot;

      if (petal.y > this.height + 35) {
        if (this.lotusPetals.length > 9) {
          this.lotusPetals.splice(i, 1);
          continue;
        } else {
          Object.assign(petal, this.createLotusPetal(false));
        }
      }

      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.rot);
      const sz = 28 * petal.scale;
      ctx.drawImage(
        petal.gold ? this.goldPetalSprite : this.pinkPetalSprite,
        -sz * 0.5,
        -sz * 0.5,
        sz,
        sz
      );
      ctx.restore();
    }

    // 6. Sóng âm Đại Hồng Chung
    for (let i = this.soundWaves.length - 1; i >= 0; i--) {
      const w = this.soundWaves[i];
      w.radius += 10.5;
      w.alpha *= 0.94;
      if (w.radius >= w.maxRadius || w.alpha < 0.03) {
        this.soundWaves.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = w.alpha;
      ctx.strokeStyle = '#ffd666';
      ctx.lineWidth = w.lineWidth;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Tia lửa vàng bắn ra từ Lò Hoá Vàng
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const b = this.burstParticles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.06;
      b.alpha -= b.decay;
      if (b.alpha <= 0) {
        this.burstParticles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, b.alpha);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Chữ +Lộc Đức bay lên
    if (this.floatingTexts.length > 0) {
      ctx.font = '800 28px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = 'rgba(15, 4, 2, 0.92)';
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.03;
        if (ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
    }

    // 9. Trái tim TikTok Live bay lên
    if (this.floatingHearts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = this.floatingHearts.length - 1; i >= 0; i--) {
        const h = this.floatingHearts[i];
        h.y += h.vy;
        h.x += h.vx + Math.sin(this.time * 2.2 + h.sway) * 1.3;
        h.alpha -= h.decay;
        if (h.alpha <= 0 || h.y < 220) {
          this.floatingHearts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, h.alpha);
        ctx.font = `${Math.round(h.size)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText(h.emoji, h.x, h.y);
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}

window.TempleParticleEngine = TempleParticleEngine;
