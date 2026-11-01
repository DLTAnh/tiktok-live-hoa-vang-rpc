/**
 * Live 9:16 Client Controller — Đàn Tràng Hoá Vàng Online & TikTok Live RPC
 * - Hiển thị Lò Hoá Vàng Đỉnh Đồng Rồng Chầu cháy rực lửa thiêng
 * - Hiệu ứng Vật phẩm Vàng Mã (Thoi Vàng, Tiền Đô, Ngựa Thần, Biệt Thự, Siêu Xe, Táo Vàng) bay vào lò
 * - 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Lộc Đức) + 40 Tín Chủ quỳ lễ hai bên thảm đỏ
 * - 8 khung hình Tín Chủ bước dọc thảm đỏ lên trước Lò Hoá Vàng quỳ đảnh lễ Tam Bái
 * - Giọng đọc AI Tiếng Việt + Âm thanh Lửa cháy lách tách & Pháp khí Web Audio
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const isObsParam = params.get('obs') === '1' || params.get('live') === '1';
  const isObsPath = ['/obs', '/live', '/stream'].some(p => window.location.pathname.startsWith(p));
  
  if (isObsParam || isObsPath || document.body.classList.contains('obs-mode')) {
    document.body.classList.add('obs-mode');
    const dock = document.getElementById('quickDock');
    if (dock) dock.remove(); // Xoá triệt để bảng điều khiển máy tính trên luồng live
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const isObs = document.body.classList.contains('obs-mode');
    let w = (isObs ? window.innerWidth : stageWrapper.clientWidth) || window.innerWidth || 1080;
    let h = (isObs ? window.innerHeight : stageWrapper.clientHeight) || window.innerHeight || 1920;

    // Tránh bug CEF/WebKit trả về 0px khi mới khởi động nguồn trình duyệt
    if (w < 100) w = 1080;
    if (h < 100) h = 1920;

    let scale = isObs ? Math.min(w / 1080, h / 1920) : (w / 1080);
    if (!isFinite(scale) || scale <= 0.05) {
      scale = 1;
    }

    if (isObs) {
      const offsetX = Math.max(0, (w - 1080 * scale) / 2);
      const offsetY = Math.max(0, (h - 1920 * scale) / 2);
      stage9x16.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    } else {
      stage9x16.style.transform = `scale(${scale})`;
    }
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);
  window.addEventListener('load', fitStage);
  document.addEventListener('DOMContentLoaded', fitStage);
  requestAnimationFrame(fitStage);
  setTimeout(fitStage, 150);
  setTimeout(fitStage, 600);
  setTimeout(fitStage, 1800);
  fitStage();

  // 2. Khởi tạo Particle Engine & Audio Engine
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();

  // 2.1. Đồng bộ trạng thái tức thì từ API (Đảm bảo nạp dữ liệu 100% ngay khi mở trang)
  function syncStateFromApi() {
    fetch('/api/state')
      .then((r) => r.json())
      .then((st) => {
        if (st) updateUIState(st);
      })
      .catch((e) => console.warn('[SyncState Error]', e.message));
  }
  syncStateFromApi();
  setInterval(syncStateFromApi, 3000);

  let hasUnlockedGesture = false;
  function unlockAudioOnce() {
    if (hasUnlockedGesture) return;
    hasUnlockedGesture = true;
    audio.ensureContext();
    audio.playIncenseChime();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '✅ Âm Thanh Lò Lửa & Giọng Đọc Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('touchend', unlockAudioOnce, { passive: true });
  window.addEventListener('click', unlockAudioOnce, { passive: true });
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });

  // 3. Chuyển đổi Hình nền Đài Hoá Vàng / Đàn Tràng / Chánh Điện
  const BG_MAP = {
    hoavang: '/assets/hoa_vang_stage.jpg',
    altar: '/assets/altar_stage.jpg',
    amitabha: '/assets/amitabha_stage.png',
    temple: '/assets/temple_stage_bg.png'
  };

  function applyStageBg(bgKey) {
    const img = document.getElementById('sanctuaryBgImg');
    const sel = document.getElementById('selectStageBg');
    const key = BG_MAP[bgKey] ? bgKey : 'hoavang';
    const url = BG_MAP[key];
    if (img && img.getAttribute('src') !== url) {
      img.setAttribute('src', url);
    }
    if (sel && sel.value !== key) {
      sel.value = key;
    }
    document.body.classList.toggle('indoor-sanctuary', key !== 'hoavang');
  }

  document.getElementById('selectStageBg')?.addEventListener('change', (e) => {
    const val = e.target.value;
    applyStageBg(val);
    callRpc('temple.updateSettings', { stageBg: val });
  });

  // 4. Vẽ các nén nhang & đầu khói tại Đỉnh Đồng bên trái Lò Hoá Vàng (x=185, y=955)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  let renderedStickCount = 0;

  function renderIncenseSticks(count) {
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 55 + spread * 24 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 11 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 66 + (i % 3) * 5;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember';
      ember.style.animationDelay = `${(i * 0.15) % 1.1}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 185 + (leftPx - 55) + Math.sin(rad) * heightPx;
      const tipY = 955 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  // 5. Dựng Hàng 6 Đệm Quỳ VIP (Top 6 Tín Chủ Lộc Đức hai bên sân gạch y=1320..1360)
  const VIP_CUSHION_COORDS = [
    { x: 108, y: 1335, rank: 3 },
    { x: 215, y: 1365, rank: 1 },
    { x: 308, y: 1335, rank: 5 },
    { x: 768, y: 1335, rank: 6 },
    { x: 862, y: 1365, rank: 2 },
    { x: 968, y: 1335, rank: 4 }
  ];

  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = VIP_CUSHION_COORDS.map((slot, idx) => {
      const dev = leaderboard[slot.rank - 1];
      if (!dev) return '';
      const badgeShort = dev.badge ? dev.badge.split(' ')[0] : '🪙';
      return `
        <div class="vip-devotee-slot" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${12 + idx};">
          <img src="/assets/devotee.png" alt="VIP Devotee" class="devotee-sprite" />
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 11))}</span>
            <span class="companion-badge ${dev.badge?.includes('30') ? 'tier-30d' : dev.badge?.includes('7') ? 'tier-7d' : dev.badge?.includes('Bảo') ? 'tier-vip' : 'tier-3d'}">${badgeShort}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 6. Dựng Đạo Tràng 40 Tín Chủ Quỳ Lễ Hai Bên Thảm Đỏ (5 Hàng x 4 Cột mỗi bên)
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  (function buildHallGrid() {
    const rows = 5;
    const colsPerSide = 4;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1);
      const y = Math.round(1320 + progress * 335);
      const scale = +(0.76 + progress * 0.28).toFixed(2);

      // Cánh trái thảm đỏ
      const leftInnerX = Math.round(315 - progress * 56);
      const leftOuterX = 46;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x, y, scale });
      }

      // Cánh phải thảm đỏ
      const rightInnerX = Math.round(765 + progress * 56);
      const rightOuterX = 1034;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x, y, scale });
      }
    }
  })();

  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.name}:${d.merit}`));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    const labeledSeatIndices = [
      3, 4, 11, 12, 19, 20, 27, 28, 35, 36, 2, 5, 10, 13, 18, 21, 26, 29
    ];
    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < labeledSeatIndices.length) {
        seatViewerMap.set(labeledSeatIndices[idx], viewer);
      }
    });

    congregationHall.innerHTML = HALL_SEAT_COORDS.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      const badgeHtml = viewer
        ? `
          <div class="seat-badge">
            <span class="seat-avatar">${
              viewer.avatar
                ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                : escapeHtml(String(viewer.name || 'T').charAt(0).toUpperCase())
            }</span>
            <span class="seat-username">${escapeHtml(shortenName(viewer.name, 11))}</span>
          </div>
        `
        : '';

      return `
        <div
          class="hall-seat"
          data-seat-idx="${idx}"
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${20 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale});"
        >
          <img
            src="/assets/devotee.png"
            alt="Tín chủ"
            class="devotee-sprite"
            style="animation-delay: ${((idx * 0.27) % 3.5).toFixed(2)}s;"
          />
          ${badgeHtml}
        </div>
      `;
    }).join('');
  }

  // Preload toàn bộ frame nhân vật Tín Chủ & Chủ Lễ Đọc Sớ vào bộ nhớ
  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    standPray: '/assets/devotee_stand_pray.png',
    standBow: '/assets/devotee_stand_bow.png',
    standBowDeep: '/assets/devotee_stand_bow_deep.png',
    masterStand: '/assets/master_stand.png',
    masterChant: '/assets/master_chant.png',
    masterBow: '/assets/master_bow.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  // Điều khiển Chủ Lễ (Cô Đồng / Thủ Từ) đứng trực bên lò đọc sớ khấn hộ
  let masterTimers = [];
  function clearMasterTimers() {
    while (masterTimers.length > 0) {
      clearTimeout(masterTimers.pop());
    }
  }

  function setMasterPose(poseKey) {
    const stack = document.getElementById('masterSpriteStack');
    if (!stack) return;
    stack.querySelectorAll('.master-frame').forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function triggerMasterChant(user, actionLabel, wish) {
    const masterEl = document.getElementById('ritualMaster');
    const bubbleEl = document.getElementById('masterChantBubble');
    const statusEl = document.getElementById('masterStatusText');
    if (!masterEl) return;

    clearMasterTimers();
    const cleanUser = user || 'Tín Chủ';
    const cleanWish = wish || 'Cầu gia đạo bình an, tài lộc vượng phát';

    if (bubbleEl) {
      bubbleEl.textContent = `📜 “Khấn hộ ${cleanUser}: ${cleanWish}”`;
    }
    if (statusEl) {
      statusEl.textContent = `🔊 Đang đọc sớ hộ ${shortenName(cleanUser, 11)}`;
    }

    masterEl.classList.add('chanting');
    setMasterPose('chant');

    // Nhịp vái & nâng sớ đọc khấn của Chủ Lễ
    const chantOffsets = [400, 1650, 2900, 4150];
    chantOffsets.forEach((t0) => {
      masterTimers.push(setTimeout(() => setMasterPose('bow'), t0));
      masterTimers.push(setTimeout(() => setMasterPose('chant'), t0 + 480));
    });

    masterTimers.push(
      setTimeout(() => {
        setMasterPose('stand');
        masterEl.classList.remove('chanting');
        if (statusEl) {
          statusEl.textContent = '🔥 Trực đàn khấn lễ';
        }
      }, 5600)
    );
  }

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 4 !== 0) return;
      const img = el.querySelector('.devotee-sprite');
      if (!img) return;
      const delay = (i % 4) * 80;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, delay);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 140);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrateDeep; }, delay + 300);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 620);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, delay + 780);
    });
  }

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  // Nghi thức Đứng Chắp Tay Vái 3 Vái Trước Cửa Lò (Chuẩn phong tục Đài Hoá Vàng)
  function playThreeBowsSequence(startDelayMs = 0) {
    const isIndoor = document.body.classList.contains('indoor-sanctuary');
    if (isIndoor) {
      schedulePose(startDelayMs, 'kneelDown');
      schedulePose(startDelayMs + 160, 'kneel');
      const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
      bowOffsets.forEach((t0) => {
        schedulePose(t0, 'forehead');
        schedulePose(t0 + 170, 'bowMid');
        schedulePose(t0 + 330, 'prostrate');
        schedulePose(t0 + 490, 'prostrateDeep');
        schedulePose(t0 + 860, 'prostrate');
        schedulePose(t0 + 1020, 'bowMid');
        schedulePose(t0 + 1180, 'kneel');
      });
      schedulePose(startDelayMs + 4800, 'forehead');
      schedulePose(startDelayMs + 5350, 'kneel');
      return;
    }

    // Ngoài sân Đài Hoá Vàng: Đứng trang nghiêm chắp tay vái 3 vái trước cửa lò
    schedulePose(startDelayMs, 'standPray');
    const standBowOffsets = [startDelayMs + 220, startDelayMs + 1350, startDelayMs + 2480];
    standBowOffsets.forEach((t0) => {
      schedulePose(t0, 'standBow');
      schedulePose(t0 + 220, 'standBowDeep');
      schedulePose(t0 + 620, 'standBow');
      schedulePose(t0 + 880, 'standPray');
    });
    schedulePose(startDelayMs + 3650, 'standPray');
  }

  // MÔ HÌNH VẬT PHẨM VÀNG MÃ CỤ THỂ TRÊN TAY NGƯỜI HOÁ & KHI ĐƯA VÀO LÒ
  const VOTIVE_PROP_SVGS = {
    gold_ingot: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Mâm sơn son thếp vàng -->
        <ellipse cx="65" cy="76" rx="54" ry="11" fill="#8c140b" stroke="#ffd54f" stroke-width="2.5"/>
        <!-- Hàng thoi vàng Kim Nguyên Bảo xếp tầng -->
        <g stroke="#9e6200" stroke-width="1.5">
          <path d="M22,64 Q36,76 50,64 L45,52 Q36,58 27,52 Z" fill="#ffca28"/>
          <ellipse cx="36" cy="51" rx="8" ry="4.5" fill="#fff59d"/>
          <path d="M51,66 Q65,78 79,66 L74,54 Q65,60 56,54 Z" fill="#ffd54f"/>
          <ellipse cx="65" cy="53" rx="8.5" ry="4.5" fill="#fff59d"/>
          <path d="M80,64 Q94,76 108,64 L103,52 Q94,58 85,52 Z" fill="#ffca28"/>
          <ellipse cx="94" cy="51" rx="8" ry="4.5" fill="#fff59d"/>
          <!-- Tầng trên -->
          <path d="M36,50 Q50,62 64,50 L59,38 Q50,44 41,38 Z" fill="#ffd54f"/>
          <ellipse cx="50" cy="37" rx="8" ry="4.5" fill="#fff9c4"/>
          <path d="M66,50 Q80,62 94,50 L89,38 Q80,44 71,38 Z" fill="#ffd54f"/>
          <ellipse cx="80" cy="37" rx="8" ry="4.5" fill="#fff9c4"/>
          <!-- Thoi vàng đỉnh -->
          <path d="M49,35 Q65,48 81,35 L75,21 Q65,28 55,21 Z" fill="#ffe082"/>
          <ellipse cx="65" cy="20" rx="9.5" ry="5" fill="#ffffff"/>
        </g>
      </svg>
    `,
    hell_money: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Xấp giấy tiền vàng bên trái -->
        <rect x="16" y="34" width="44" height="44" rx="3" fill="#fbc02d" stroke="#b26a00" stroke-width="2"/>
        <rect x="20" y="29" width="44" height="44" rx="3" fill="#fdd835" stroke="#b26a00" stroke-width="1.8"/>
        <rect x="33" y="29" width="16" height="44" fill="#d32f2f"/>
        <circle cx="41" cy="51" r="6" fill="#ffd54f"/>
        <!-- Xấp tiền đỏ & Đô âm phủ bên phải -->
        <rect x="64" y="32" width="48" height="46" rx="3" fill="#c62828" stroke="#ffd54f" stroke-width="2"/>
        <rect x="68" y="26" width="48" height="46" rx="3" fill="#e53935" stroke="#ffd54f" stroke-width="1.8"/>
        <rect x="74" y="33" width="36" height="32" fill="none" stroke="#ffe082" stroke-width="1.5"/>
        <text x="92" y="54" font-size="14" font-weight="900" fill="#ffe082" text-anchor="middle">福祿</text>
      </svg>
    `,
    royal_robe: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Mũ Cánh Chuồn Quan Thần -->
        <path d="M36,24 L52,22 L52,28 L36,28 Z" fill="#212121" stroke="#ffd54f" stroke-width="1.5"/>
        <path d="M78,22 L94,24 L94,28 L78,28 Z" fill="#212121" stroke="#ffd54f" stroke-width="1.5"/>
        <path d="M52,28 L55,12 Q65,8 75,12 L78,28 Z" fill="#b71c1c" stroke="#ffd54f" stroke-width="2"/>
        <circle cx="65" cy="20" r="4" fill="#ffee58"/>
        <!-- Áo Quan Phục Thêu Rồng -->
        <path d="M26,42 L48,32 L82,32 L104,42 L96,56 L82,50 L82,82 L48,82 L48,50 L34,56 Z" fill="#c62828" stroke="#ffd54f" stroke-width="2.2"/>
        <path d="M56,32 L65,45 L74,32" fill="none" stroke="#ffd54f" stroke-width="2.5"/>
        <circle cx="65" cy="58" r="9" fill="#ffd54f" stroke="#8c140b" stroke-width="1.5"/>
        <rect x="48" y="69" width="34" height="5" fill="#ffd54f"/>
      </svg>
    `,
    sacred_horse: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Đế đứng Ông Ngựa Đỏ Xích Thố -->
        <rect x="24" y="76" width="82" height="7" rx="3" fill="#ffd54f" stroke="#8c140b" stroke-width="1.5"/>
        <!-- Thân Ngựa Đỏ Xích Thố -->
        <path d="M34,76 L38,52 L30,46 L35,38 L50,42 L78,42 L90,22 L104,26 L98,36 L90,34 L86,52 L92,76 L84,76 L80,56 L48,56 L42,76 Z" fill="#d32f2f" stroke="#ffe082" stroke-width="2"/>
        <!-- Bờm vàng & Yên cương vàng -->
        <path d="M78,40 L88,20 L93,22 L83,42 Z" fill="#ffd54f"/>
        <rect x="54" y="40" width="22" height="13" rx="4" fill="#ffd54f" stroke="#8c140b" stroke-width="1.5"/>
        <circle cx="95" cy="27" r="2" fill="#fff"/>
      </svg>
    `,
    five_elements_tray: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="65" cy="74" rx="54" ry="12" fill="#7f0000" stroke="#ffd54f" stroke-width="2.5"/>
        <!-- 5 phần lễ Ngũ hành: Xanh, Đỏ, Trắng, Vàng, Tím -->
        <rect x="20" y="36" width="18" height="36" rx="3" fill="#2e7d32" stroke="#ffe082" stroke-width="1.6"/>
        <rect x="38" y="30" width="18" height="42" rx="3" fill="#c62828" stroke="#ffe082" stroke-width="1.6"/>
        <rect x="56" y="24" width="18" height="48" rx="3" fill="#fbc02d" stroke="#fff" stroke-width="1.8"/>
        <rect x="74" y="30" width="18" height="42" rx="3" fill="#f5f5f5" stroke="#ffd54f" stroke-width="1.6"/>
        <rect x="92" y="36" width="18" height="36" rx="3" fill="#4527a0" stroke="#ffe082" stroke-width="1.6"/>
      </svg>
    `,
    golden_tech: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Khay hộp gấm đỏ -->
        <rect x="16" y="64" width="98" height="16" rx="4" fill="#b71c1c" stroke="#ffd54f" stroke-width="2"/>
        <!-- MacBook Vàng Mã -->
        <rect x="24" y="26" width="52" height="36" rx="4" fill="#ffd54f" stroke="#8c4b00" stroke-width="2"/>
        <rect x="29" y="31" width="42" height="26" fill="#212121"/>
        <circle cx="50" cy="44" r="5" fill="#ffd54f"/>
        <!-- iPhone Pro Max Vàng Mã -->
        <rect x="82" y="22" width="24" height="42" rx="4" fill="#ffe082" stroke="#8c4b00" stroke-width="2"/>
        <circle cx="88" cy="28" r="2.2" fill="#212121"/>
        <circle cx="88" cy="34" r="2.2" fill="#212121"/>
        <circle cx="93" cy="31" r="2.2" fill="#212121"/>
      </svg>
    `,
    luxury_villa_car: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Biệt thự Lầu Vàng Mã 3 tầng (Bên trái) -->
        <polygon points="10,36 44,14 78,36" fill="#b71c1c" stroke="#ffd54f" stroke-width="2"/>
        <rect x="18" y="36" width="52" height="44" fill="#fff3e0" stroke="#c62828" stroke-width="2"/>
        <line x1="16" y1="54" x2="72" y2="54" stroke="#b71c1c" stroke-width="3"/>
        <rect x="37" y="62" width="14" height="18" fill="#b71c1c" stroke="#ffd54f" stroke-width="1.5"/>
        <rect x="24" y="40" width="10" height="10" fill="#ffd54f" stroke="#8c140b" stroke-width="1.2"/>
        <rect x="54" y="40" width="10" height="10" fill="#ffd54f" stroke="#8c140b" stroke-width="1.2"/>
        <!-- Siêu Xe Đỏ Vàng Mã (Bên phải) -->
        <path d="M68,72 L74,58 L92,54 L108,54 L116,64 L122,66 L122,76 L68,76 Z" fill="#d50000" stroke="#ffd54f" stroke-width="2"/>
        <polygon points="78,60 92,56 105,56 111,63 78,63" fill="#ffe082"/>
        <circle cx="82" cy="76" r="6" fill="#212121" stroke="#ffd54f" stroke-width="2"/>
        <circle cx="110" cy="76" r="6" fill="#212121" stroke="#ffd54f" stroke-width="2"/>
      </svg>
    `,
    scroll: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Trục cuốn sớ vàng hai đầu -->
        <rect x="22" y="16" width="86" height="8" rx="4" fill="#ffd54f" stroke="#8c140b" stroke-width="1.8"/>
        <rect x="28" y="24" width="74" height="50" fill="#c62828" stroke="#ffd54f" stroke-width="2.2"/>
        <rect x="35" y="30" width="60" height="38" fill="none" stroke="#ffe082" stroke-width="1.4" stroke-dasharray="4 2"/>
        <text x="65" y="55" font-size="18" font-weight="900" fill="#ffe082" text-anchor="middle">疏文</text>
        <rect x="22" y="74" width="86" height="8" rx="4" fill="#ffd54f" stroke="#8c140b" stroke-width="1.8"/>
      </svg>
    `,
    dragon_treasury: `
      <svg viewBox="0 0 130 92" xmlns="http://www.w3.org/2000/svg">
        <!-- Đại Bảo Rương Rồng Vàng Khai Khố -->
        <rect x="20" y="38" width="90" height="44" rx="5" fill="#8c140b" stroke="#ffd54f" stroke-width="3"/>
        <path d="M18,38 Q65,14 112,38 Z" fill="#b71c1c" stroke="#ffd54f" stroke-width="2.5"/>
        <!-- Núi vàng tràn khỏi rương -->
        <circle cx="42" cy="36" r="9" fill="#ffd54f"/>
        <circle cx="56" cy="32" r="11" fill="#ffee58"/>
        <circle cx="72" cy="32" r="11" fill="#ffd54f"/>
        <circle cx="88" cy="36" r="9" fill="#ffee58"/>
        <!-- Khóa Rồng Vàng -->
        <rect x="57" y="48" width="16" height="18" rx="3" fill="#ffd54f" stroke="#4e0704" stroke-width="1.8"/>
        <line x1="20" y1="56" x2="110" y2="56" stroke="#ffd54f" stroke-width="3"/>
      </svg>
    `
  };

  function inferVotiveItemKey(ev = {}) {
    if (ev.itemKey && VOTIVE_PROP_SVGS[ev.itemKey]) return ev.itemKey;
    const text = `${ev.itemName || ''} ${ev.giftName || ''} ${ev.itemEmoji || ''}`.toLowerCase();
    if (text.includes('biệt thự') || text.includes('nhà') || text.includes('xe') || text.includes('🏯')) {
      return 'luxury_villa_car';
    }
    if (text.includes('ngựa') || text.includes('xích thố') || text.includes('🐎')) {
      return 'sacred_horse';
    }
    if (text.includes('táo') || text.includes('iphone') || text.includes('📱')) {
      return 'golden_tech';
    }
    if (text.includes('áo') || text.includes('mũ') || text.includes('quan phục') || text.includes('👘')) {
      return 'royal_robe';
    }
    if (text.includes('ngũ phương') || text.includes('mâm') || text.includes('🍱')) {
      return 'five_elements_tray';
    }
    if (text.includes('tiền') || text.includes('đô') || text.includes('💵')) {
      return 'hell_money';
    }
    if (text.includes('sớ') || text.includes('📜') || ev.type === 'sendPrayer') {
      return 'scroll';
    }
    if (text.includes('rồng') || text.includes('kho vàng') || text.includes('đại lễ') || text.includes('🐉') || ev.type === 'grandCeremony') {
      return 'dragon_treasury';
    }
    return 'gold_ingot';
  }

  function buildVotivePropCard(itemKey, badgeText) {
    const svg = VOTIVE_PROP_SVGS[itemKey] || VOTIVE_PROP_SVGS.gold_ingot;
    return `
      <div class="votive-prop-card">
        <div class="votive-prop-art">${svg}</div>
        <div class="votive-prop-badge">${escapeHtml(badgeText || 'Lễ Vật Vàng Mã')}</div>
      </div>
    `;
  }

  let furnaceBurnTimer = null;
  function spawnFurnaceBurningItem(itemKey, badgeText) {
    const slot = document.getElementById('furnaceBurningSlot');
    if (!slot) return;
    clearTimeout(furnaceBurnTimer);
    slot.innerHTML = `
      <div class="burning-votive-item">
        ${buildVotivePropCard(itemKey, `🔥 Đang hoá: ${badgeText}`)}
      </div>
    `;
    furnaceBurnTimer = setTimeout(() => {
      slot.innerHTML = '';
    }, 2150);
  }

  function animateWalkerOnCarpet(user, avatar, actionLabel, wish, propSpec = null) {
    const centralEl = document.getElementById('centralWorshipper');
    const heldPropEl = document.getElementById('heldVotiveProp');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);
    triggerMasterChant(user, actionLabel, wish);

    const itemKey = propSpec?.itemKey || 'gold_ingot';
    const badgeText = propSpec?.badgeText || '9 Thoi Vàng';

    // 1. Đặt đúng vật phẩm cụ thể lên tay người đi hoá khi bước dọc sân gạch
    if (heldPropEl) {
      heldPropEl.className = 'held-votive-prop carrying';
      heldPropEl.innerHTML = buildVotivePropCard(itemKey, badgeText);
    }

    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 9; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    // 2. Khi bước tới bậc tam cấp trước cửa lò (t = 1750ms): Đứng nghiêng mình đưa vật phẩm thẳng vào trong lò
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose('standBowDeep');
        if (heldPropEl) {
          heldPropEl.className = 'held-votive-prop throwing-into-furnace';
        }
      }, 1750)
    );

    // 3. Vật phẩm rơi vào giữa buồng lửa (t = 2280ms): Bốc cháy rực rỡ trong lò & Tín chủ ĐỨNG CHẮP TAY VÁI 3 VÁI
    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
        if (heldPropEl) {
          heldPropEl.className = 'held-votive-prop';
          heldPropEl.innerHTML = '';
        }
        spawnFurnaceBurningItem(itemKey, badgeText);
        particles.spawnIncenseBurst(520, 1015, 36);
        audio.playFireCrackle(1.8, 1.15);
      }, 2280)
    );

    playThreeBowsSequence(2320);
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    if (nameEl) nameEl.textContent = user || 'Tín Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || '🔥 Hoá vàng cầu tài lộc';
    if (wishEl) wishEl.textContent = `“${wish || 'Thành tâm hoá vàng cầu gia đạo bình an, tài lộc vượng phát'}”`;

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(user || '🪙').trim().charAt(0).toUpperCase();
      }
    }

    if (doThreeBows) {
      clearProstrationTimers();
      const centralEl = document.getElementById('centralWorshipper');
      if (centralEl) centralEl.classList.remove('walking-up');
      triggerMasterChant(user, actionLabel, wish);
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    particles.spawnBellWave(540, 490, 2);

    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Tín Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Hoá vàng cầu lộc';
  }

  // 7. Cập nhật toàn bộ giao diện theo State từ Server
  let hasInitializedRealLeader = false;

  function updateUIState(st) {
    if (!st) return;

    const totalVotive = st.totalVotiveBurned ?? st.totalIncense ?? 0;
    document.getElementById('statIncense').textContent = Number(totalVotive).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    // Cập nhật Dòng Timeline Tiến Trình 1.000.000 Điểm Công Đức Mỗi Ngày
    const target = Number(st.dailyMeritTarget) || 1000000;
    const current = Number(st.dailyMeritCurrent || st.totalMerit || 0);
    const pct = Math.min(100, Math.max(0, (current / target) * 100));

    const curEl = document.getElementById('timelineMeritCurrent');
    const tgtEl = document.getElementById('timelineMeritTarget');
    const pctEl = document.getElementById('timelineMeritPercent');
    const barEl = document.getElementById('timelineBarFill');

    if (curEl) curEl.textContent = current.toLocaleString('vi-VN');
    if (tgtEl) tgtEl.textContent = target.toLocaleString('vi-VN');
    if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;
    if (barEl) barEl.style.width = `${pct}%`;

    // Cập nhật Mốc Công Đức & Cổng Trời
    const nextM = (st.communityMilestones || []).find((m) => !m.unlocked);
    const nextPill = document.getElementById('nextMilestonePill');
    if (nextPill) {
      if (nextM) {
        nextPill.textContent = `Mốc tiếp: ${Number(nextM.threshold).toLocaleString('vi-VN')} tim (${nextM.name})`;
      } else {
        nextPill.textContent = `🏆 Đạt tất cả các mốc đại lễ!`;
      }
    }

    const mTrack = document.getElementById('timelineMilestones');
    if (mTrack && Array.isArray(st.communityMilestones)) {
      mTrack.innerHTML = st.communityMilestones.map((m) => {
        const leftPct = Math.min(100, Math.max(5, (m.threshold / target) * 100));
        const isUnlocked = m.unlocked || current >= m.threshold;
        return `
          <div class="milestone-pip" style="left: ${leftPct}%;" title="${escapeHtml(m.name)} (${Number(m.threshold).toLocaleString('vi-VN')})">
            <span class="milestone-dot ${isUnlocked ? 'active' : ''}"></span>
            <span class="milestone-tag ${isUnlocked ? 'gold' : ''}">${m.threshold >= 1000000 ? '1 TRIỆU' : (m.threshold / 1000) + 'K'}</span>
          </div>
        `;
      }).join('');
    }

    const gateHint = document.getElementById('gateStatusHint');
    if (gateHint && st.communityGate) {
      const statusLabels = {
        locked: 'Đang tích luỹ',
        charging: 'Cổng phát sáng',
        half_open: 'Mở một phần',
        fully_open: 'Mở hoàn toàn',
        grand_ceremony: 'Đại Lễ Khai Mở'
      };
      const lbl = statusLabels[st.communityGate.status] || st.communityGate.status;
      gateHint.innerHTML = `✨ Cổng Trời Kim Long: <strong>${lbl} (${Number(st.communityGate.currentHearts || 0).toLocaleString('vi-VN')} tim)</strong>`;
    }

    updateFurnaceUI(st.furnaceStatus);
    window.__latestCeremonySchedule = st.ceremonySchedule;
    updateCeremonyBar(st.ceremonySchedule);
    renderPollUI(st.activePoll);

    renderIncenseSticks(st.activeIncenseSticks || 9);

    if (st.settings?.stageBg) {
      applyStageBg(st.settings.stageBg);
    }

    renderQuestsUI(st.communityQuests);
    renderMiniEventBanner(st.miniEventEngine?.activeEvent);
    if (st.smartPromptSettings?.activePrompt) {
      updateSmartPromptUI(st.smartPromptSettings.activePrompt);
    }

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    renderVipCushions(lb);
    renderCongregationHall(lb);

    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `🔥 Lộc đức: ${Number(topDev.merit).toLocaleString('vi-VN')} LĐ`,
        topDev.lastWish || 'Thành tâm hoá vàng kính biếu Gia Tiên, cầu buôn may bán đắt',
        false
      );
    }

    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('');
    }

    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    const connHint = document.getElementById('tiktokConnHint');
    if (st.tiktok?.connected) {
      liveDot.classList.add('connected');
      liveText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} mắt`;
      if (connHint) {
        connHint.style.color = '#58e698';
        connHint.innerHTML = `🟢 Đã kết nối <strong>@${escapeHtml(st.tiktok.username)}</strong> (${st.tiktok.viewerCount || 0} người xem)`;
      }
    } else if (st.tiktok?.connecting) {
      liveDot.classList.remove('connected');
      liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
      if (connHint) {
        connHint.style.color = '#ffe89e';
        connHint.textContent = `⏳ Đang kết nối tới phòng Live @${st.tiktok.username}...`;
      }
    } else {
      liveDot.classList.remove('connected');
      liveText.textContent = st.settings?.autoSim
        ? 'HOÁ VÀNG ONLINE • ĐANG GIẢ LẬP ĐÔNG KHÁCH'
        : 'ĐÀN TRÀNG HOÁ VÀNG • TÀI LỘC ÂM DƯƠNG';
      if (connHint && st.tiktok?.lastError) {
        connHint.style.color = '#ff8a80';
        connHint.textContent = `⚠️ @${st.tiktok.username}: Chưa bật phát Live hoặc không tìm thấy phòng (${st.tiktok.lastError})`;
      }
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? '🤖 Tự động Giả lập Khách Hoá Vàng: ĐANG BẬT'
        : '🤖 Tự động Giả lập Khách Hoá Vàng: TẮT';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }

    if (st.settings) {
      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol');
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol');
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
    }

    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      feed.innerHTML = st.recentEvents
        .slice(0, 8)
        .map((ev) => `<div class="event-feed-item">${formatEventSummary(ev)}</div>`)
        .join('');
    }
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'milestoneUnlocked':
        return `🏆 <strong>Mở khoá mốc:</strong> ${escapeHtml(ev.milestone?.name || 'Công đức')}!`;
      case 'ceremony':
        return `🐉 <strong>Nghi lễ:</strong> ${escapeHtml(ev.ceremony?.name || 'Đại Lễ')}!`;
      case 'burnVotive':
      case 'burnIncense':
        return `${ev.itemEmoji || '🪙'} <strong>${escapeHtml(ev.user)}</strong> hoá ${ev.count || 3} ${escapeHtml(ev.itemName || 'Thoi Vàng')} (+${ev.merit} LĐ)`;
      case 'strikeWoodenFish':
        return `❤️ <strong>${escapeHtml(ev.user)}</strong> thả ${ev.count} tim tích +${ev.merit} Công Đức`;
      case 'ringBell':
        return `🔔 <strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung (+${ev.merit} LĐ)`;
      case 'sendPrayer':
        return `📜 <strong>${escapeHtml(ev.user)}</strong> hoá sớ cầu lộc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `${ev.itemEmoji || '🐉'} <strong>${escapeHtml(ev.user)}</strong> hoá <em>${escapeHtml(ev.giftName)}</em> (+${ev.merit} LĐ)`;
      case 'drawFortune':
        return `🎋 <strong>${escapeHtml(ev.user)}</strong> gieo được Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `✨ <strong>${escapeHtml(ev.user || 'Tín chủ')}</strong> tương tác`;
    }
  }

  // 7B. Hàng đợi thông báo ưu tiên & các module tương tác realtime
  const priorityQueue = [];
  let isDisplayingToast = false;

  function pushPriorityNotification(text, priority = 2, icon = '✨', durationMs = 4500) {
    priorityQueue.push({ text, priority, icon, durationMs });
    priorityQueue.sort((a, b) => a.priority - b.priority);
    processPriorityQueue();
  }

  function processPriorityQueue() {
    if (isDisplayingToast || priorityQueue.length === 0) return;
    isDisplayingToast = true;
    const item = priorityQueue.shift();
    const stack = document.getElementById('priorityNotificationStack');
    if (!stack) {
      isDisplayingToast = false;
      return;
    }

    const toast = document.createElement('div');
    toast.className = `priority-toast priority-${item.priority}`;
    toast.innerHTML = `
      <span>${escapeHtml(item.icon)} ${escapeHtml(item.text)}</span>
      <span style="font-size: 11px; opacity: 0.85; padding-left: 8px;">🔥 Đàn Tràng</span>
    `;
    stack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-14px) scale(0.9)';
      setTimeout(() => {
        toast.remove();
        isDisplayingToast = false;
        processPriorityQueue();
      }, 400);
    }, item.durationMs);
  }

  let milestoneBannerTimer = null;
  function showMilestoneUnlockedBanner(milestone) {
    const banner = document.getElementById('milestoneUnlockedBanner');
    const title = document.getElementById('milestoneBannerTitle');
    const sub = document.getElementById('milestoneBannerSub');
    if (!banner || !milestone) return;

    if (title) title.textContent = `✨ ${milestone.name.toUpperCase()} (${Number(milestone.threshold).toLocaleString('vi-VN')} TIM) ✨`;
    if (sub) sub.textContent = milestone.description || 'Toàn thể đạo tràng đồng tâm tích đức khai thông linh khí!';

    banner.classList.add('visible');
    audio.playMilestoneChime();
    particles.triggerMilestoneVisual(milestone.effect);

    clearTimeout(milestoneBannerTimer);
    milestoneBannerTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6500);

    pushPriorityNotification(`Mở khoá mốc: ${milestone.name}!`, 1, '🏆', 5500);
  }

  let blessingTimer = null;
  function showSpiritualBlessingToast(devotee, message) {
    const toast = document.getElementById('spiritualBlessingToast');
    const nameEl = document.getElementById('blessingDevoteeLine');
    const msgEl = document.getElementById('blessingMessageLine');
    if (!toast) return;

    if (nameEl) nameEl.textContent = `Tín chủ: ${devotee || 'Thành Tâm'}`;
    if (msgEl) msgEl.textContent = message || 'Cầu cho gia quyến bốn mùa thân tâm an lạc, tai qua nạn khỏi, vạn sự hanh thông.';

    toast.classList.add('visible');
    audio.playIncenseChime();

    clearTimeout(blessingTimer);
    blessingTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 6000);
  }

  function updateFurnaceUI(furnace) {
    if (!furnace) return;
    const pill = document.getElementById('furnaceStatusPill');
    const txt = document.getElementById('furnaceStatusText');
    const dot = document.getElementById('furnacePulseDot');
    if (!pill || !txt) return;

    const temp = furnace.temperature || 368;
    const label = furnace.label || 'Lò đang hoạt động';
    txt.textContent = `🔥 ${label.toUpperCase()} • ${temp}°C`;

    if (furnace.state === 'burning' || furnace.state === 'grand_ceremony') {
      pill.style.borderColor = '#ffd700';
      pill.style.boxShadow = '0 0 16px rgba(255, 215, 0, 0.7)';
      if (dot) dot.style.background = '#ffeb3b';
      particles.furnaceBoost = Math.max(particles.furnaceBoost, furnace.state === 'grand_ceremony' ? 1.8 : 1.3);
    } else {
      pill.style.borderColor = 'rgba(244, 193, 80, 0.65)';
      pill.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.8)';
      if (dot) dot.style.background = '#ff4500';
    }
  }

  function renderPollUI(poll) {
    const card = document.getElementById('livePollCard');
    const list = document.getElementById('pollOptionsList');
    const timer = document.getElementById('pollTimerBadge');
    const qText = document.getElementById('pollQuestionText');
    if (!card || !poll) return;

    if (!poll.active) {
      if (!poll.winner) card.style.display = 'none';
      return;
    }

    card.style.display = 'flex';
    if (qText) qText.textContent = poll.question || 'Bình chọn vật phẩm:';
    if (timer) timer.textContent = `⏳ ${poll.remainingSeconds || 0}s`;

    if (list && Array.isArray(poll.options)) {
      const total = Math.max(1, poll.totalVotes || 0);
      let maxVotes = -1;
      poll.options.forEach((o) => {
        if (o.votes > maxVotes) maxVotes = o.votes;
      });

      list.innerHTML = poll.options.map((opt) => {
        const pct = Math.round((opt.votes / total) * 100);
        const isLeading = maxVotes > 0 && opt.votes === maxVotes;
        return `
          <div class="poll-option-row ${isLeading ? 'leading' : ''}">
            <div class="poll-option-bar" style="width: ${pct}%;"></div>
            <div class="poll-option-info">
              <span><span class="poll-option-num">${opt.id}</span> ${opt.emoji || '🪙'} ${escapeHtml(opt.text)}</span>
              <span><strong>${opt.votes}</strong> (${pct}%)</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function handlePollEnded(poll, winner) {
    const card = document.getElementById('livePollCard');
    const timer = document.getElementById('pollTimerBadge');
    if (timer) timer.textContent = '🏆 HOÀN TẤT';
    audio.playFanfare();

    if (winner) {
      pushPriorityNotification(`Vật phẩm chiến thắng bình chọn: ${winner.text}!`, 1, '🏆', 7000);
      particles.spawnVotiveBurning(winner.emoji || '🪙', 5);
    }

    setTimeout(() => {
      if (card) card.style.display = 'none';
    }, 7000);
  }

  function updateCeremonyBar(schedule = []) {
    const bar = document.getElementById('ceremonyCountdownBar');
    const nameEl = document.getElementById('ceremonyName');
    const timerEl = document.getElementById('ceremonyTimer');
    const tagEl = document.getElementById('ceremonyTag');
    if (!bar || !schedule || schedule.length === 0) return;

    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    let upcoming = null;
    let minDiff = Infinity;

    for (const c of schedule) {
      const [h, m] = c.time.split(':').map(Number);
      const cerMinutes = h * 60 + m;
      let diff = cerMinutes - curMinutes;
      if (diff < 0) diff += 24 * 60;
      if (diff < minDiff) {
        minDiff = diff;
        upcoming = c;
      }
    }

    if (upcoming && nameEl && timerEl) {
      nameEl.textContent = `${upcoming.name} (${upcoming.time})`;
      const remainingSec = minDiff * 60 - now.getSeconds();
      const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
      const ss = String(remainingSec % 60).padStart(2, '0');
      timerEl.textContent = `Còn ${mm}:${ss}`;
      if (minDiff <= 5) {
        if (tagEl) tagEl.textContent = '🔥 SẮP BẮT ĐẦU';
        bar.style.borderColor = '#ff4500';
      } else {
        if (tagEl) tagEl.textContent = '⏳ SỰ KIỆN TIẾP THEO';
        bar.style.borderColor = 'rgba(244, 193, 80, 0.65)';
      }
    }
  }

  function handleCeremonyStart(ceremony) {
    if (!ceremony) return;
    audio.playFanfare();
    particles.triggerMilestoneVisual('grand_ceremony');
    pushPriorityNotification(`Bắt đầu nghi thức: ${ceremony.name}!`, 1, '🐉', 7500);
  }

  setInterval(() => {
    if (window.__latestCeremonySchedule) {
      updateCeremonyBar(window.__latestCeremonySchedule);
    }
  }, 1000);

  // 8. Xử lý hiệu ứng khi có Nghi Thức Hoá Vàng mới
  let fortuneTimer = null;
  let grandTimer = null;

  function triggerRitualVisuals(ev) {
    if (!ev) return;

    if (ev.ttsText && ev.type !== 'drawFortune') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi' });
    }

    switch (ev.type) {
      case 'milestoneUnlocked': {
        showMilestoneUnlockedBanner(ev.milestone);
        break;
      }

      case 'ceremony': {
        handleCeremonyStart(ev.ceremony);
        break;
      }

      case 'burnVotive':
      case 'burnIncense': {
        const emoji = ev.itemEmoji || '🪙';
        const itemName = ev.itemName || 'Thoi Vàng Kim Nguyên Bảo';
        const itemKey = inferVotiveItemKey(ev);
        const count = ev.count || 3;
        audio.playIncenseChime();
        audio.playFireCrackle(1.4, 0.9);
        particles.spawnFloatingMerit(`+${ev.merit} Lộc Đức`, 520, 880, '#ffe082');
        particles.spawnVotiveBurning(emoji, Math.min(count, 5));
        animateWalkerOnCarpet(
          ev.user,
          ev.avatar,
          `${emoji} Hoá ${count} ${itemName} (+${ev.merit} LĐ)`,
          ev.wish,
          { itemKey, badgeText: `${emoji} ${count} ${shortenName(itemName, 16)}` }
        );
        pushPriorityNotification(`${ev.user} hoá ${count} ${itemName}`, 3, emoji, 3800);
        break;
      }

      case 'strikeWoodenFish': {
        const count = ev.count || 1;
        const merit = ev.merit || (count * 2);
        const tier = ev.tier || (count >= 500 ? 4 : count >= 200 ? 3 : count >= 50 ? 2 : 1);

        audio.playWoodenFish(tier >= 2 ? 1.05 : 0.95);
        audio.playFireCrackle(0.8 + tier * 0.35, 0.65 + tier * 0.2);
        particles.spawnTieredHearts(tier, count);
        particles.spawnIncenseBurst(520, 1015, 12 + tier * 8);

        if (tier === 1) {
          particles.spawnFloatingMerit(`❤️ +${merit} Công Đức`, 860, 935, '#ff4757');
        } else if (tier === 2) {
          audio.playIncenseChime();
          const halo = document.getElementById('lotusHandHalo');
          if (halo) {
            halo.classList.add('flare');
            setTimeout(() => halo.classList.remove('flare'), 2200);
          }
          pulseHallBowing();
          showHeartTierBanner('CẤP 2 • TIẾP LỬA', '❤️ CƠN MƯA TIM ĐẮC LỘC ❤️', `${ev.user} tiếp lửa đài hoá vàng • Tích +${merit} Công Đức`);
          particles.spawnFloatingMerit(`🔥 +${merit} CÔNG ĐỨC`, 520, 850, '#ff9f43');
        } else if (tier === 3) {
          audio.playTempleBell(1.0);
          const beam = document.getElementById('sacredLightBeam');
          if (beam) {
            beam.classList.add('intense');
            setTimeout(() => beam.classList.remove('intense'), 3800);
          }
          setMasterPose('bow');
          setTimeout(() => setMasterPose('stand'), 3200);
          pulseHallBowing();
          showHeartTierBanner('CẤP 3 • BÃO TIM HOÀNG KIM', '✨ BÃO TIM KIM QUANG TIẾP LỬA ✨', `${ev.user} cùng thiện tín khởi bão tim • Tích +${merit} Công Đức`);
          particles.spawnFloatingMerit(`✨ +${merit} CÔNG ĐỨC ✨`, 520, 800, '#ffd32a');
        } else if (tier >= 4) {
          audio.playTempleBell(1.2);
          audio.playIncenseChime();
          const halo = document.getElementById('lotusHandHalo');
          const beam = document.getElementById('sacredLightBeam');
          if (halo) halo.classList.add('flare');
          if (beam) beam.classList.add('intense');
          setTimeout(() => {
            if (halo) halo.classList.remove('flare');
            if (beam) beam.classList.remove('intense');
          }, 5500);

          setMasterPose('chant');
          setTimeout(() => setMasterPose('stand'), 5500);
          pulseHallBowing();
          showHeartTierBanner('CẤP 4 • VẠN TIM KHAI KHỐ', '🐉 ĐẠI LỄ VẠN TIM KHAI KHỐ 🐉', `Đạo tràng đồng lòng dâng vạn tim • Tích +${merit} Đại Phúc Lộc!`);
          particles.spawnFloatingMerit(`🐉 +${merit} ĐẠI CÔNG ĐỨC 🐉`, 520, 750, '#ffeaa7');
        }

        const hudName = document.getElementById('devoteeNameLine');
        const hudAct = document.getElementById('devoteeActionTag');
        if (hudName) hudName.textContent = ev.user || 'Tín Chủ';
        if (hudAct) hudAct.textContent = `❤️ Thả ${count} tim • Tích +${merit} Công Đức (Cấp ${tier})`;
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        pulseHallBowing();
        particles.spawnBellWave(520, 500, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Lộc Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Khai Chuông Hoàng Kim (+${ev.merit} LĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        audio.playFireCrackle(1.4, 0.85);
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Lộc Đức`, 520, 900, '#ffb74d');
        if (ev.wish && ev.wish.includes('(')) {
          const parts = ev.wish.split('(');
          const wishText = parts[0].trim();
          const blessing = parts[1].replace(')', '').trim();
          showSpiritualBlessingToast(ev.user, `${wishText}. ${blessing}`);
        }
        animateWalkerOnCarpet(
          ev.user,
          ev.avatar,
          `📜 Hoá Sớ Cầu Tài Lộc (+${ev.merit} LĐ)`,
          ev.wish,
          { itemKey: 'scroll', badgeText: '📜 Sớ Điệp Cầu Lộc' }
        );
        pushPriorityNotification(`${ev.user} dâng sớ cầu an lộc`, 3, '📜', 4000);
        break;
      }

      case 'offerGift': {
        const emoji = ev.itemEmoji || '🏯';
        const giftName = ev.giftName || 'Biệt Thự & Siêu Xe';
        const itemKey = inferVotiveItemKey(ev);
        audio.playIncenseChime();
        audio.playTempleBell(0.9);
        audio.playFireCrackle(1.8, 1.0);
        particles.spawnFloatingMerit(`+${ev.merit} Lộc Đức`, 520, 860, '#fff3b0');
        particles.spawnVotiveBurning(emoji, 3);
        animateWalkerOnCarpet(
          ev.user,
          ev.avatar,
          `${emoji} Hoá ${giftName} (+${ev.merit} LĐ)`,
          ev.wish,
          { itemKey, badgeText: `${emoji} ${shortenName(giftName, 18)}` }
        );
        pushPriorityNotification(`${ev.user} hoá ${giftName} (+${ev.merit} LĐ)`, 2, emoji, 5000);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        audio.playFireCrackle(2.5, 1.3);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(
          ev.user,
          ev.avatar,
          `🐉 ${ev.giftName} (+${ev.merit} LĐ)`,
          ev.wish,
          { itemKey: 'dragon_treasury', badgeText: '🐉 Đại Bảo Rương Rồng Vàng' }
        );
        pushPriorityNotification(`ĐẠI LỄ: ${ev.user} khai mở ${ev.giftName}!`, 1, '🐉', 7500);
        break;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        updateCentralWorshipper(
          ev.user,
          ev.avatar,
          `🎋 Đang xin quẻ Tài Lộc...`,
          `Tín chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          onStart: () => {
            audio.playIncenseChime();
            showFortuneModal(ev.user, ev.fortune);
            updateCentralWorshipper(
              ev.user,
              ev.avatar,
              `🎋 Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`,
              ev.fortune?.meaning || '',
              true
            );
          },
          onEnd: () => {
            clearTimeout(fortuneTimer);
            fortuneTimer = setTimeout(() => {
              document.getElementById('fortuneModal')?.classList.remove('visible');
            }, 1800);
          }
        });
        break;
      }
    }
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 90 + Math.floor(Math.random() * 620);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">🙏 ${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  // Hiển thị Bong bóng Bình luận TikTok Live trực tiếp trên màn hình 9:16
  function pushLiveCommentBubble(user, avatar, commentText) {
    const stream = document.getElementById('liveCommentStream');
    if (!stream || !commentText) return;

    while (stream.children.length >= 3) {
      stream.firstElementChild.remove();
    }

    const bubble = document.createElement('div');
    bubble.className = 'live-comment-bubble';
    const avatarHtml = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="" />`
      : escapeHtml(String(user || 'T').trim().charAt(0).toUpperCase());

    bubble.innerHTML = `
      <div class="live-comment-avatar">${avatarHtml}</div>
      <div class="live-comment-body">
        <div class="live-comment-user">💬 ${escapeHtml(user || 'Tín Chủ')}</div>
        <div class="live-comment-text">${escapeHtml(commentText)}</div>
      </div>
    `;
    stream.appendChild(bubble);

    setTimeout(() => {
      bubble.remove();
    }, 8500);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
    document.getElementById('fortuneRankBadge').textContent = fortune.rank.toUpperCase();
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Tín chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn: ${fortune.meaning}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal').classList.remove('visible');
  });

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = `🐉 ${giftName.toUpperCase()} 🐉`;
    document.getElementById('grandSub').textContent = `Đại Tín Chủ ${user} • Lộc Đức Vô Lượng (+${merit} LĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // Hiển thị Banner các mốc Thả Tim (Cấp 2: Mưa Tim, Cấp 3: Bão Tim, Cấp 4: Vạn Tim)
  let heartTierTimer = null;
  function showHeartTierBanner(badgeText, titleText, subText) {
    const banner = document.getElementById('heartTierBanner');
    const badgeEl = document.getElementById('heartTierBadge');
    const titleEl = document.getElementById('heartTierTitle');
    const subEl = document.getElementById('heartTierSub');
    if (!banner) return;

    if (badgeEl) badgeEl.textContent = badgeText;
    if (titleEl) titleEl.textContent = titleText;
    if (subEl) subEl.textContent = subText;

    banner.classList.add('visible');
    clearTimeout(heartTierTimer);
    heartTierTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 4500);
  }

  // 12. Cập nhật Giao diện Nhiệm Vụ Cộng Đồng (Co-op Quests)
  function renderQuestsUI(quests = []) {
    const box = document.getElementById('communityQuestBox');
    if (!box || !Array.isArray(quests) || quests.length === 0) return;

    const activeQuest = quests.find((q) => q.active && !q.completed) || quests[0];
    if (!activeQuest) return;

    const nameEl = document.getElementById('questName');
    const progTextEl = document.getElementById('questProgressText');
    const pctBadgeEl = document.getElementById('questPercentBadge');
    const fillEl = document.getElementById('questBarFill');
    const rewardEl = document.getElementById('questRewardHint');

    const cur = Number(activeQuest.currentAmount) || 0;
    const tgt = Number(activeQuest.targetAmount) || 100;
    const pct = Math.min(100, Math.max(0, (cur / tgt) * 100));

    const emojiMap = { incense: '🪔', flower: '🪷', hearts: '❤️', votive: '🪙' };
    const emoji = emojiMap[activeQuest.targetType] || '🎯';

    if (nameEl) nameEl.textContent = activeQuest.title;
    if (progTextEl) progTextEl.textContent = `${cur.toLocaleString('vi-VN')} / ${tgt.toLocaleString('vi-VN')} ${emoji}`;
    if (pctBadgeEl) pctBadgeEl.textContent = `${pct.toFixed(0)}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (rewardEl) rewardEl.innerHTML = `🎁 Hoàn thành: <span>${escapeHtml(activeQuest.rewardText || 'Nhận phúc lộc vô lượng!')}</span>`;
  }

  // 13. Cập nhật Banner Mini-Event Tự Động & Đồng Hồ Đếm Ngược
  let miniEventCountdownInterval = null;
  function renderMiniEventBanner(activeEvt) {
    const banner = document.getElementById('miniEventBanner');
    if (!banner) return;

    if (!activeEvt || !activeEvt.endsAt || Date.now() >= activeEvt.endsAt) {
      banner.style.display = 'none';
      if (miniEventCountdownInterval) {
        clearInterval(miniEventCountdownInterval);
        miniEventCountdownInterval = null;
      }
      return;
    }

    const titleEl = document.getElementById('miniEventTitle');
    const descEl = document.getElementById('miniEventDesc');
    const cdEl = document.getElementById('miniEventCountdown');

    if (titleEl) titleEl.textContent = activeEvt.bannerText || activeEvt.name;
    if (descEl) descEl.textContent = activeEvt.description || 'Nhanh tay tương tác để nhận x2 công đức!';
    banner.style.display = 'flex';

    if (miniEventCountdownInterval) clearInterval(miniEventCountdownInterval);
    const updateCountdown = () => {
      const remSec = Math.max(0, Math.ceil((activeEvt.endsAt - Date.now()) / 1000));
      if (cdEl) {
        const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
        const ss = String(remSec % 60).padStart(2, '0');
        cdEl.textContent = `⏳ ${mm}:${ss}`;
      }
      if (remSec <= 0) {
        banner.style.display = 'none';
        clearInterval(miniEventCountdownInterval);
        miniEventCountdownInterval = null;
      }
    };
    updateCountdown();
    miniEventCountdownInterval = setInterval(updateCountdown, 1000);
  }

  // 14. Hiển thị Thẻ Sớ Lụa Hoàng Kim (Silk Scroll Card Modal)
  let silkScrollTimer = null;
  function showSilkScrollCard(data = {}) {
    const modal = document.getElementById('silkScrollModal');
    if (!modal) return;

    const titleEl = document.getElementById('scrollTitle');
    const devNameEl = document.getElementById('scrollDevoteeName');
    const devBadgeEl = document.getElementById('scrollDevoteeBadge');
    const dateEl = document.getElementById('scrollDate');
    const wishEl = document.getElementById('scrollWishText');
    const stampTopEl = document.getElementById('scrollStampTop');
    const sealEl = document.getElementById('scrollSeal');

    if (titleEl) titleEl.textContent = data.title || 'SỚ CẦU BÌNH AN BỐN MÙA';
    if (stampTopEl) stampTopEl.textContent = data.stamp || 'ĐÀN TRÀNG CHỨNG MINH';
    if (devNameEl) devNameEl.textContent = `Tín chủ: ${data.devotee?.name || 'Tín Chủ Thành Tâm'}`;
    if (devBadgeEl) devBadgeEl.textContent = data.devotee?.badge || '🪙 Hữu Duyên';
    if (dateEl) dateEl.textContent = data.dateString || 'Giờ Hoàng Đạo • Ngày Cát Khánh';
    if (wishEl) wishEl.textContent = `“${data.wish || 'Thành tâm kính bái, nguyện cầu vạn sự hanh thông'}”`;
    if (sealEl) {
      sealEl.innerHTML = `<span>${escapeHtml(data.stamp?.slice(0, 4) || 'GIA')}</span><span>${escapeHtml(data.stamp?.slice(4) || 'TIÊN')}</span>`;
    }

    modal.style.display = 'flex';
    audio.playTempleBell(0.9);
    particles.spawnIncenseBurst(540, 960, 40);

    clearTimeout(silkScrollTimer);
    silkScrollTimer = setTimeout(() => {
      modal.style.display = 'none';
    }, 6500);

    modal.onclick = () => {
      modal.style.display = 'none';
      clearTimeout(silkScrollTimer);
    };
  }

  // 15. Cập nhật Dòng Gợi Ý Tương Tác Thông Minh (Smart Prompt Pill)
  function updateSmartPromptUI(text) {
    const el = document.getElementById('smartPromptText');
    if (el && text) {
      el.textContent = text;
    }
  }

  window.simulateKeywordClick = (kw) => {
    callRpc('temple.comment', {
      user: 'Tín Chủ Trực Tuyến',
      comment: kw,
      uniqueId: `click_${Date.now()}`
    });
  };

  // Hiển thị dải lụa hoàng kim chào mừng tín chủ mới vào phòng Live
  let welcomeToastTimer = null;
  function showWelcomeDevoteeToast(user, avatar, badge, template, suggestedKeywords, activeHint) {
    const toast = document.getElementById('devoteeWelcomeToast');
    const nameEl = document.getElementById('welcomeDevoteeName');
    const avatarEl = document.getElementById('welcomeAvatar');
    const badgeEl = document.getElementById('welcomeDevoteeBadge');
    const hintEl = document.getElementById('welcomeActiveHint');
    if (!toast || !nameEl || !user) return;

    if (welcomeToastTimer) clearTimeout(welcomeToastTimer);

    nameEl.textContent = `@${user}`;
    if (badgeEl) badgeEl.textContent = badge || '🪙 Hữu Duyên';
    if (hintEl && activeHint) hintEl.textContent = activeHint;

    if (avatarEl) {
      if (avatar && avatar.startsWith('http')) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(user).trim().charAt(0).toUpperCase() || '🪙';
      }
    }

    toast.classList.add('active');
    audio.playIncenseChime();

    welcomeToastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 5500);
  }

  // Tự động nhắc nhở phòng Live khi không có bình luận mới (45s) để người mới vào luôn hiểu live làm gì
  let lastRoomActivityTime = Date.now();
  function registerRoomActivity() {
    lastRoomActivityTime = Date.now();
  }

  setInterval(() => {
    const now = Date.now();
    if (now - lastRoomActivityTime >= 45000 && !audio.ttsPlaying) {
      lastRoomActivityTime = now;
      const bubbleEl = document.getElementById('masterChantBubble');
      const statusEl = document.getElementById('masterStatusText');
      if (bubbleEl) {
        bubbleEl.textContent = '📜 “Kính mời thiện tín bình luận [Tên + Lời khấn] để Thầy dâng sớ hoá vàng!”';
      }
      if (statusEl) {
        statusEl.textContent = '📢 Lời nhắc hướng dẫn cầu an';
      }
      setMasterPose('chant');
      audio.playTempleBell(0.8);

      const guideSpoken = 'Kính chào thiện nam tín nữ. Hãy bình luận họ tên và ước nguyện tài lộc để Thầy Chủ Lễ kính dâng sớ điệp hoá vàng vào lò lửa linh thiêng.';
      audio.enqueueTts(guideSpoken, { voice: 'maichi' });

      setTimeout(() => {
        setMasterPose('stand');
        if (statusEl) statusEl.textContent = '🔥 Trực đàn khấn lễ';
      }, 7000);
    }
  }, 10000);

  // 9. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    if (window.location.protocol === 'file:') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    } catch (_) {
      return;
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'temple.event') {
          registerRoomActivity();
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) triggerRitualVisuals(msg.params.event);
        } else if (msg.method === 'temple.milestoneUnlocked') {
          registerRoomActivity();
          if (msg.params?.milestone) showMilestoneUnlockedBanner(msg.params.milestone);
          if (msg.params?.state) updateUIState(msg.params.state);
        } else if (msg.method === 'furnace.update') {
          if (msg.params?.furnace) updateFurnaceUI(msg.params.furnace);
        } else if (msg.method === 'poll.update') {
          if (msg.params?.poll) renderPollUI(msg.params.poll);
        } else if (msg.method === 'poll.ended') {
          handlePollEnded(msg.params?.poll, msg.params?.winner);
        } else if (msg.method === 'ceremony.start') {
          handleCeremonyStart(msg.params?.ceremony);
        } else if (msg.method === 'gate.unlocked') {
          pushPriorityNotification(`Cổng Trời Kim Long: ${msg.params?.level?.name || 'Khai Mở'}!`, 1, '✨', 6000);
          audio.playMilestoneChime();
        } else if (msg.method === 'temple.welcome') {
          showWelcomeDevoteeToast(msg.params?.user, msg.params?.avatar);
        } else if (msg.method === 'temple.welcomeMember') {
          showWelcomeDevoteeToast(
            msg.params?.user,
            msg.params?.avatar,
            msg.params?.badge,
            msg.params?.template,
            msg.params?.suggestedKeywords,
            msg.params?.activeHint
          );
        } else if (msg.method === 'temple.returningDevotee') {
          const u = msg.params?.user || 'Thiện Tín';
          const b = msg.params?.badge || '✨ Thiện Tín 7 Ngày';
          pushPriorityNotification(`Tri ân ${u} — ${b} đã quay lại Đàn Tràng!`, 2, '✨', 5500);
          audio.playIncenseChime();
        } else if (msg.method === 'quest.update') {
          if (msg.params?.quests) renderQuestsUI(msg.params.quests);
        } else if (msg.method === 'quest.completed') {
          if (msg.params?.quest) {
            pushPriorityNotification(`🏆 HOÀN THÀNH: ${msg.params.quest.title}! ${msg.params.quest.rewardText}`, 1, '🏆', 7000);
            particles.spawnIncenseBurst(520, 1015, 60);
            audio.playMilestoneChime();
          }
        } else if (msg.method === 'miniEvent.start') {
          if (msg.params?.event) {
            renderMiniEventBanner(msg.params.event);
            pushPriorityNotification(`⚡ BẮT ĐẦU: ${msg.params.event.bannerText}`, 1, '⚡', 6000);
            audio.playMilestoneChime();
          }
        } else if (msg.method === 'miniEvent.ended') {
          renderMiniEventBanner(null);
        } else if (msg.method === 'notification.priority') {
          pushPriorityNotification(msg.params?.text, msg.params?.priority, msg.params?.icon, msg.params?.durationMs);
        } else if (msg.method === 'temple.switchScene') {
          if (msg.params?.sceneId) applyStageBg(msg.params.sceneId);
        } else if (msg.method === 'temple.silkScroll') {
          showSilkScrollCard(msg.params);
        } else if (msg.method === 'smartPrompt.update') {
          if (msg.params?.prompt) updateSmartPromptUI(msg.params.prompt);
        } else if (msg.method === 'temple.chat') {
          registerRoomActivity();
          if (msg.params?.comment) {
            pushLiveCommentBubble(msg.params.user, msg.params.avatar, msg.params.comment);
          }
        } else if (msg.method === 'tts.play') {
          registerRoomActivity();
          audio.enqueueTts(msg.params.text || 'Chứng tâm công đức', {
            voice: msg.params.voice || 'maichi',
            url: msg.params.url || null,
            fallbackBrowserTts: Boolean(msg.params.fallbackBrowserTts)
          });
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    try {
      const res = await fetch('/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.result?.state) updateUIState(data.result.state);
      if (data?.result?.event) triggerRitualVisuals(data.result.event);
      return data;
    } catch (_) {
      // Fallback trực tiếp nếu mở file tĩnh không qua server
      triggerRitualVisuals({
        type: method.includes('grand') ? 'grandCeremony' : 'burnVotive',
        user: params.user || 'Gia Chủ Minh Tâm',
        wish: params.wish || 'Cầu gia đạo bình an, tài lộc vượng phát',
        itemEmoji: params.itemEmoji || '🪙',
        itemName: params.giftName || 'Thoi Vàng Kim Nguyên Bảo',
        giftName: params.giftName || 'Đại Lễ Hoá Vàng',
        count: params.count || 3,
        merit: 135,
        ttsText: `Tín chủ ${params.user || 'Minh Tâm'} thành tâm hoá vàng cầu tài lộc.`
      });
    }
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Gia Chủ Minh Tâm';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Thành tâm hoá vàng kính biếu Gia Tiên, cầu buôn may bán đắt, tài lộc đầy nhà';
    return { user, wish };
  }

  // Sự kiện tương tác trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnVotive', { user, itemKey: 'gold_ingot', count: 9, wish });
  });

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnVotive', { user, itemKey: 'gold_ingot', count: 9, wish });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'sacred_horse',
      coins: 15,
      giftName: 'Ngựa Đỏ Xích Thố Thần Hành',
      wish
    });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'luxury_villa_car',
      coins: 50,
      giftName: 'Biệt Thự Phố & Siêu Xe Vàng',
      wish
    });
  });

  document.getElementById('cardGrand')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.grandCeremony', {
      user,
      coins: 199,
      giftName: 'Đại Lễ Hoá Vàng Kim Long Khai Khố',
      wish
    });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('hoavang.stokeFire', { user, count: 10 });
  });

  // Sự kiện Thả Tim & Bình Luận TikTok trên Quick Dock
  function submitLiveComment(rawComment) {
    const { user } = getFormInput();
    const comment = String(rawComment ?? document.getElementById('inputLiveComment')?.value ?? '').trim();
    if (!comment) return;
    callRpc('hoavang.comment', { user, comment });
  }

  document.getElementById('btnSendLiveComment')?.addEventListener('click', () => {
    submitLiveComment();
  });

  document.getElementById('inputLiveComment')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitLiveComment();
    }
  });

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-comment') || '';
      const inputEl = document.getElementById('inputLiveComment');
      if (inputEl) inputEl.value = text;
      submitLiveComment(text);
    });
  });

  document.getElementById('btnLikeHeart')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('hoavang.stokeFire', { user, count: 10 });
  });

  document.getElementById('btnBurstHeart')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('hoavang.stokeFire', { user, count: 50 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.drawFortune', { user, topic: wish });
  });

  document.getElementById('ritualMaster')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnScroll', { user, wish });
  });

  document.getElementById('leftVotiveTable')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'luxury_villa_car',
      coins: 50,
      giftName: 'Biệt Thự Phố & Siêu Xe Vàng',
      wish
    });
  });

  document.getElementById('rightVotiveTable')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnVotive', { user, itemKey: 'gold_ingot', count: 9, wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnVotive', { user, itemKey: 'gold_ingot', count: 9, wish });
  });

  document.getElementById('btnRpcMoney')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnVotive', { user, itemKey: 'hell_money', count: 10, wish });
  });

  document.getElementById('btnRpcRobe')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'royal_robe',
      coins: 10,
      giftName: 'Bộ Mũ Áo Quan Phục Hoàng Kim',
      wish
    });
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.burnScroll', { user, wish });
  });

  document.getElementById('btnRpcHorse')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'sacred_horse',
      coins: 15,
      giftName: 'Ngựa Đỏ Xích Thố Thần Hành',
      wish
    });
  });

  document.getElementById('btnRpcVilla')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'luxury_villa_car',
      coins: 50,
      giftName: 'Biệt Thự Phố & Siêu Xe Vàng',
      wish
    });
  });

  document.getElementById('btnRpcTech')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.offerGift', {
      user,
      itemKey: 'golden_tech',
      coins: 30,
      giftName: 'Trọn Bộ Táo Vàng Thượng Phẩm',
      wish
    });
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('hoavang.stokeFire', { user, count: 5 });
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.drawFortune', { user, topic: wish });
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('hoavang.grandCeremony', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Hoá Vàng Kim Long Khai Khố',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) return;
    callRpc('live.connect', { username });
  });

  let autoSimState = false;
  document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
    autoSimState = !autoSimState;
    callRpc('live.setAutoSim', { enabled: autoSimState });
  });

  let isStageMuted = false;
  document.getElementById('btnStageMuteToggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    isStageMuted = !isStageMuted;
    const btn = e.currentTarget;
    btn.textContent = isStageMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isStageMuted);
    audio.bgMusicEnabled = !isStageMuted;
    audio.ttsEnabled = !isStageMuted;
    audio.sfxEnabled = !isStageMuted;
    if (isStageMuted) {
      audio.stopZenAmbience();
      if (audio.activeTtsAudio) {
        try { audio.activeTtsAudio.pause(); } catch (_) {}
      }
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
    } else {
      audio.ensureContext();
      audio.startZenAmbience();
    }
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.startZenAmbience();
    } else {
      audio.stopZenAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
  });

  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  window.toggleGuideOverlay = function () {
    const list = document.getElementById('guideScrollList');
    const icon = document.getElementById('guideToggleIcon');
    if (!list) return;
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'flex' : 'none';
    if (icon) icon.textContent = isHidden ? '▾' : '▸';
  };

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
