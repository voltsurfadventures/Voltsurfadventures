/* =====================================================================
 * STREET SMART — configuration & data
 * ---------------------------------------------------------------------
 * Everything that defines the game's content lives here as plain data:
 * global settings, UI strings, cargo types, seller types, lighting
 * presets and worlds/levels. To add a new country (India, China,
 * Australia...) add an entry to SS.WORLDS and SS.WORLD_ORDER.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});

  /* ---------------- Global game config ---------------- */
  SS.CONFIG = {
    TITLE: 'STREET SMART',               // change the game's name here
    TAGLINE: 'Frogger taught you to dodge. This teaches you to flow.',
    VERSION: '1.0.0',

    // ---- Monetisation hook -------------------------------------------
    // false (default) = sold as a paid app, every level unlocked.
    // true            = levels flagged `requiresFullGame` are locked until
    //                   SS.Purchases.unlockFullGame() succeeds (save.js).
    IAP_ENABLED: false,

    VIEW_H: 540,          // logical units of screen height; width follows aspect
    MAX_DPR: 2,           // devicePixelRatio cap (performance)
    LOW_DPR: 1.25,        // DPR cap in low-quality mode
    STEP: 1 / 60,         // fixed simulation timestep
    LIVES: 3,
    SAVE_KEY: 'streetsmart.save.v1',

    // Fonts (files go in assets/fonts/, see README). Fallbacks support Vietnamese.
    FONT_UI: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif",
    FONT_DISPLAY: "'Baloo 2', 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif",

    // Core feel tuning
    WALK_SPEED: 100,      // units / second
    SPRINT_MUL: 1.85,
    PLAYER_ACCEL: 620,
  };

  /* ---------------- Street geometry (logical units) ---------------- */
  SS.GEOM = {
    FACADE_BOT: 176,   // bottom of shop fronts
    ROAD_TOP: 224,     // far kerb
    ROAD_BOT: 440,     // near kerb
    VIEW_H: 540,
    WALK_MIN: 190,     // player feet limits (far footpath)
    WALK_MAX: 530,     // (near footpath)
    UPPER_BAND: [236, 330], // traffic flowing left (far half)
    LOWER_BAND: [344, 432], // traffic flowing right (near half)
    CROSS_HALF: 105,   // half-width of a cross street
  };

  /* ---------------- UI strings (English; translate here) ---------------- */
  SS.STRINGS = {
    loading: 'Loading…',
    tapToStart: 'Tap to start',
    play: 'PLAY',
    settings: 'SETTINGS',
    credits: 'CREDITS',
    back: 'BACK',
    resume: 'RESUME',
    restart: 'RESTART',
    quit: 'QUIT TO MENU',
    paused: 'PAUSED',
    next: 'NEXT LEVEL',
    retry: 'RETRY',
    menu: 'MENU',
    levelSelect: 'CHOOSE A DELIVERY',
    level: 'LEVEL',
    best: 'Best',
    locked: 'Locked',
    lockedHint: 'Complete the previous level',
    fullGameLocked: 'Full game',
    unlockFullGame: 'UNLOCK FULL GAME',
    musicVolume: 'Music volume',
    sfxVolume: 'Sound effects volume',
    vibration: 'Vibration',
    graphics: 'Graphics quality',
    gfxAuto: 'Auto', gfxHigh: 'High', gfxLow: 'Low',
    on: 'On', off: 'Off',
    resetProgress: 'RESET PROGRESS',
    resetConfirmTitle: 'Reset all progress?',
    resetConfirmBody: 'Stars, best scores and coins will be deleted.',
    yesReset: 'YES, RESET',
    cancel: 'CANCEL',
    progressReset: 'Progress reset',
    rotate: 'Please rotate your device',
    rotateSub: 'Street Smart is played in landscape',

    hudConfidence: 'CONFIDENCE',
    hudBreath: 'BREATH',
    hudCargo: 'CARGO',

    btnSprint: 'SPRINT',
    btnBreath: 'HOLD BREATH',
    btnNoThanks: 'NO THANKS',
    btnBuy: 'BUY',

    deliverTo: 'Deliver to',
    deliverHere: 'DELIVER HERE',
    crossNow: 'CROSS THE INTERSECTION',
    crossHint: 'Walk steadily. Let the traffic flow around you.',
    delivered: 'DELIVERED!',
    gameOver: 'GAME OVER',
    cargoRuined: 'CARGO RUINED',
    outOfLives: 'You ran out of lives.',
    cargoBroken: 'Your delivery did not survive the trip.',
    score: 'Score',
    newBest: 'NEW BEST!',
    statCoins: 'Coins collected',
    statNearMiss: 'Near misses',
    statCrossings: 'Smooth crossings',
    statBanhBao: 'Bánh bao grabs',
    statSellers: 'Sellers dodged',
    statCargo: 'Cargo condition',
    statLives: 'Lives left',
    statTime: 'Time',

    // floating popups
    popNearMiss: 'Near miss!',
    popFlow: 'Flow!',
    popSmooth: 'Smooth crossing!',
    popPerfect: 'Perfect crossing!',
    popDodged: 'Dodged!',
    popEscaped: 'Escaped!',
    popBanhBaoClose: 'Close call!',
    popGrab: 'Bánh bao!',
    popFreeze: 'Traffic freeze!',
    popCargoSave: 'Cargo saved!',
    popExtraLife: 'Extra life!',
    popBought: 'Bought!',
    popNoCoins: 'Not enough coins',
    popSunglassesBroke: 'Sunglasses broke!',
    popBoost: 'Fresh shoes! Speed up!',
    popSlowmo: 'Slow motion!',
    popFruit: 'Fresh fruit! Breath refilled',
    popSunglasses: 'Sunglasses on!',
    popOuch: 'Ouch!',
    popGassed: 'Durian overload!',
    popBump: 'Bump!',
    popConfidenceLow: 'Riders can\'t read you!',

    now: 'NOW!',
    purchaseUnavailable: 'Purchases are not available yet',
    controlsTouch: 'Joystick: walk   ·   SPRINT   ·   HOLD BREATH   ·   NO THANKS   ·   BUY',
    controlsKeys: 'WASD / Arrows: walk   ·   Shift: sprint   ·   Space: hold breath   ·   E: no thanks (hold E: buy)   ·   Esc: pause',
    flowing: 'FLOWING',
    holding: 'HOLDING',
    stink: 'STINK!',
    why: { sprint: 'SPRINTING', stop: 'STOPPED', reverse: 'REVERSING', turn: 'ZIG-ZAG', jerk: 'JERKY', linger: 'IN THE WAY' },
    chipSunglasses: 'SUNGLASSES',
    chipSlowmo: 'SLOW-MO',
    chipFreeze: 'FREEZE',
    chipBoost: 'SPEED',
    deliverLine: 'Deliver {cargo} to the {shop} shop',
    sellerBye: ['Next time, my friend!', 'Okay, okay!', 'Bye bye!', 'Maybe tomorrow!'],
    sellerThanks: 'Thank you!',
    sellerShoeDone: 'All done! Very shiny!',

    // rider shouts (English)
    riderShouts: ['Hey!', 'Watch out!', 'Whoa!', 'Look out!'],

    // tutorial (level 1)
    tut: {
      move: 'Move with the joystick (or WASD / arrow keys).',
      moveDesktop: 'Move with WASD or the arrow keys.',
      blocked: 'The footpath is blocked. Step out into the road.',
      steady: 'Walk slowly and STEADILY. Riders read your path and flow around you.',
      drain: 'Stopping, reversing or sprinting drains CONFIDENCE. Low confidence = chaos.',
      cargo: 'Careful with the phở! Sudden moves and bumps spill your CARGO.',
      durian: 'Durian cloud! Hold BREATH (Space) to walk through the stink.',
      seller: 'A street seller! Tap NO THANKS (E) quickly to escape, or BUY (hold E).',
      banhbao: 'Hear that? The bánh bao bike! Step in front of him at the right moment to grab one.',
      intersection: 'Intersection! Cross to the other footpath. Keep it steady.',
      deliver: 'Nearly there! Deliver to the shop on the far side.',
    },

    sellerNames: {
      sunglasses: 'Sunglasses seller',
      fruit: 'Fruit seller',
      watch: 'Watch seller',
      shoe: 'Shoe cleaner',
    },

    creditsLines: [
      ['Game design, code, art & audio', 'Generated procedurally in code'],
      ['Bánh bao street call', 'Street recording (see README for licensing)'],
      ['Fonts', 'Be Vietnam Pro & Baloo 2 (SIL Open Font License)'],
      ['Made with', 'HTML5 Canvas and the Web Audio API'],
      ['Thank you', 'To every rider in Hanoi who ever flowed around a nervous tourist'],
    ],
    privacy: 'No ads. No tracking. No accounts. Plays fully offline.',
  };

  /* ---------------- Cargo types ---------------- */
  SS.CARGO = {
    pho:  { id: 'pho',  name: 'a bowl of phở',     short: 'Phở',          sensitivity: 1.0,  icon: 'bowl' },
    cake: { id: 'cake', name: 'a wedding cake',    short: 'Wedding cake', sensitivity: 1.5,  icon: 'cake' },
    eggs: { id: 'eggs', name: 'a crate of eggs',   short: 'Eggs',         sensitivity: 1.25, icon: 'eggs' },
  };

  /* ---------------- Street sellers ---------------- */
  // behaviour: 'pop' blocks your path, 'follow' slow & persistent,
  // 'chase' fast but short-lived, 'grab' waits and grabs your foot.
  SS.SELLERS = {
    sunglasses: { behaviour: 'pop',    speed: 150, price: 25, hold: 0.0,  escape: 5, giveUp: 9,
                  lines: ['Sunglasses? Cheap cheap!', 'Cheap cheap!', 'Very cool!'] },
    fruit:      { behaviour: 'follow', speed: 78,  price: 30, hold: 0.35, escape: 4, giveUp: 22,
                  lines: ['Fruit? Very fresh!', 'Mango? Very sweet!', 'Very fresh!'] },
    watch:      { behaviour: 'chase',  speed: 128, price: 40, hold: 0.3,  escape: 6, giveUp: 7,
                  lines: ['Buy watch! Buy watch!', 'Good price!', 'Buy watch!'] },
    shoe:       { behaviour: 'grab',   speed: 0,   price: 15, hold: 0.0,  escape: 6, giveUp: 0, finish: 3.6,
                  lines: ['Shoe clean, mister?', 'Very shiny!', 'Almost done!'] },
  };

  /* ---------------- Lighting presets (time of day) ---------------- */
  SS.LIGHTING = {
    morning: {
      sky: ['#9fc6d6', '#f3dcb4'], far: '#8a8f8c', farLit: '#c9b79a',
      haze: 'rgba(238,224,198,0.34)', hazeTop: 'rgba(250,236,210,0.25)',
      ambient: 'rgba(255,238,205,0.06)', ambientMode: 'source-over',
      road: '#5c5a57', roadLine: 'rgba(240,230,200,0.35)', path: '#a8988177', pathBase: '#9d8f7c', pathLine: '#8a7d6a',
      shadow: 'rgba(40,30,20,0.30)', shadowSkew: -0.9, shadowLen: 0.55,
      neon: 0.35, lantern: 0.25, windowGlow: 0.15, headlights: 0, puddles: false,
      sunGlow: 'rgba(255,240,200,0.20)', vignette: 0.22, rim: 'rgba(255,255,235,0.95)',
      glare: 'sun', dust: 0.6,
    },
    golden: {
      sky: ['#e9915a', '#f6c77c'], far: '#7d6a5a', farLit: '#d29a63',
      haze: 'rgba(255,186,110,0.30)', hazeTop: 'rgba(255,170,90,0.28)',
      ambient: 'rgba(255,140,50,0.10)', ambientMode: 'source-over',
      road: '#5a4c44', roadLine: 'rgba(255,220,170,0.30)', pathBase: '#a07e62', pathLine: '#86684f',
      shadow: 'rgba(60,25,10,0.36)', shadowSkew: 1.6, shadowLen: 0.75,
      neon: 0.7, lantern: 0.75, windowGlow: 0.45, headlights: 0.25, puddles: false,
      sunGlow: 'rgba(255,170,80,0.26)', vignette: 0.32, rim: 'rgba(255,230,170,0.95)',
      glare: 'sun', dust: 1.0,
    },
    night: {
      sky: ['#090b22', '#2b1b3c'], far: '#1c1a2c', farLit: '#3b2f4c',
      haze: 'rgba(40,30,80,0.38)', hazeTop: 'rgba(30,20,60,0.35)',
      ambient: 'rgba(18,16,60,0.30)', ambientMode: 'source-over',
      road: '#2b2a33', roadLine: 'rgba(200,200,255,0.18)', pathBase: '#4a4250', pathLine: '#3a3340',
      shadow: 'rgba(0,0,10,0.42)', shadowSkew: 0.0, shadowLen: 0.35,
      neon: 1.0, lantern: 1.0, windowGlow: 0.8, headlights: 1.0, puddles: true,
      sunGlow: null, vignette: 0.45, rim: 'rgba(160,230,255,0.95)',
      glare: 'headlights', dust: 0.4,
    },
  };

  /* ---------------- Worlds & levels ---------------- */
  // Sign words: ONLY these exact strings may ever appear on Vietnam shop signs.
  const VN_SIGN_WORDS = ['PHỞ BÒ', 'CÀ PHÊ', 'BÁNH MÌ', 'BÚN CHẢ', 'BÁNH BAO', 'CƠM TẤM',
    'TRÀ ĐÁ', 'NƯỚC MÍA', 'SẦU RIÊNG', 'TẠP HÓA', 'HỚT TÓC', 'BIA HƠI'];

  SS.WORLDS = {
    vietnam: {
      id: 'vietnam',
      name: 'VIETNAM',
      city: 'Hanoi',
      signWords: VN_SIGN_WORDS,
      // shop types: sign word + what is displayed in front (goods)
      shopTypes: [
        { word: 'PHỞ BÒ',   goods: 'pho',     icon: 'bowl',   weight: 3 },
        { word: 'CÀ PHÊ',   goods: 'cafe',    icon: 'cup',    weight: 3 },
        { word: 'BÁNH MÌ',  goods: 'banhmi',  icon: 'bread',  weight: 2 },
        { word: 'BÚN CHẢ',  goods: 'grill',   icon: 'bowl',   weight: 2 },
        { word: 'BÁNH BAO', goods: 'steamer', icon: 'bun',    weight: 1 },
        { word: 'CƠM TẤM',  goods: 'rice',    icon: 'bowl',   weight: 1 },
        { word: 'TRÀ ĐÁ',   goods: 'tea',     icon: 'cup',    weight: 2 },
        { word: 'NƯỚC MÍA', goods: 'cane',    icon: 'cup',    weight: 1 },
        { word: 'TẠP HÓA',  goods: 'grocery', icon: 'basket', weight: 2 },
        { word: 'HỚT TÓC',  goods: 'barber',  icon: 'scissors', weight: 1 },
        { word: 'BIA HƠI',  goods: 'beer',    icon: 'glass',  weight: 2 },
      ],
      durianWord: 'SẦU RIÊNG',
      banhbaoWord: 'BÁNH BAO',
      sellers: ['sunglasses', 'fruit', 'watch', 'shoe'],
      palette: {
        facades: ['#d9a35b', '#c9824e', '#b8b07a', '#7fa88f', '#d7c49a', '#c76e5a', '#6f9aa6', '#e0b878', '#a6896a', '#93a77a'],
        awnings: ['#2f7f74', '#3a8f7c', '#b84a3a', '#d38a2e', '#2c6a8a', '#7a3d5c', '#3f7f4f'],
        shirts: ['#e8e2d0', '#3b6ea5', '#c84b3a', '#e3b341', '#4d8a5b', '#8c5aa8', '#f0f0f0', '#2f3b4a', '#d97a2b', '#5fa3b8', '#b5385b'],
        helmets: ['#e14b3b', '#f2c230', '#3d7fd0', '#f4f4f0', '#2a2a2e', '#4fbf7a', '#e978a8', '#8a5cc0', '#f08a2a'],
        scooters: ['#c8372d', '#2c78c2', '#e9e6dc', '#2f2f35', '#c49a2c', '#4f9a63', '#8a2f45', '#d86a2a', '#6aa9c2', '#9aa0a8'],
        skin: ['#e8b98f', '#d9a272', '#c48b5f', '#b07a50', '#f0c9a0'],
      },
      levels: [
        {
          id: 'vn-1', name: 'Old Quarter Morning', time: 'morning', music: 'morning',
          cargo: 'pho', destination: 'TẠP HÓA',
          length: 11200, density: 0.62, speedMul: 0.9, wildRiders: 0.03,
          intersections: [3400, 8000],
          durianEvery: 3000, durianFirst: 4300,
          sellerTypes: ['sunglasses', 'fruit'], sellerFirst: 5200, sellerEvery: 1900,
          banhbaoFirst: 6000, banhbaoEvery: 30,
          coinGroups: 26, obstacleDensity: 0.65,
          stars: [2600, 4200], tutorial: true, requiresFullGame: false,
        },
        {
          id: 'vn-2', name: 'Golden-Hour Market', time: 'golden', music: 'market',
          cargo: 'cake', destination: 'BIA HƠI',
          length: 13200, density: 0.95, speedMul: 1.0, wildRiders: 0.06,
          intersections: [3000, 7000, 10600],
          durianEvery: 1500, durianFirst: 1500,
          sellerTypes: ['sunglasses', 'fruit', 'watch', 'shoe'], sellerFirst: 1200, sellerEvery: 1150,
          banhbaoFirst: 3000, banhbaoEvery: 22,
          coinGroups: 34, obstacleDensity: 0.8,
          stars: [3600, 6000], tutorial: false, requiresFullGame: true,
        },
        {
          id: 'vn-3', name: 'Neon Rush Hour', time: 'night', music: 'night',
          cargo: 'eggs', destination: 'BÁNH MÌ',
          length: 14400, density: 1.25, speedMul: 1.14, wildRiders: 0.09,
          intersections: [2800, 7000, 11400],
          durianEvery: 2100, durianFirst: 2000,
          sellerTypes: ['sunglasses', 'fruit', 'watch', 'shoe'], sellerFirst: 1000, sellerEvery: 1000,
          banhbaoFirst: 2600, banhbaoEvery: 17,
          coinGroups: 40, obstacleDensity: 0.9,
          stars: [4200, 7200], tutorial: false, requiresFullGame: true,
        },
      ],
    },
    // Future worlds go here, e.g.:
    // india:     { id: 'india', name: 'INDIA', city: 'Mumbai', signWords: [...], shopTypes: [...], levels: [...] },
    // china:     { ... },
    // australia: { ... },
  };
  SS.WORLD_ORDER = ['vietnam'];

  /* ---------------- Small shared utilities ---------------- */
  const U = (SS.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    inv: (a, b, v) => (v - a) / (b - a),
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    approach: (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target)),
    // deterministic RNG (mulberry32) for level layout
    rng(seed) {
      let a = seed >>> 0;
      const f = () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      f.range = (lo, hi) => lo + f() * (hi - lo);
      f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
      f.pick = (arr) => arr[Math.floor(f() * arr.length)];
      f.weighted = (arr) => {
        let tot = 0; for (const o of arr) tot += o.weight || 1;
        let r = f() * tot;
        for (const o of arr) { r -= o.weight || 1; if (r <= 0) return o; }
        return arr[arr.length - 1];
      };
      return f;
    },
    hash(n) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },
    // colour helpers
    hexToRgb(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    shade(hex, amt) { // amt -1..1 (darken..lighten)
      const [r, g, b] = U.hexToRgb(hex);
      const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
      return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
    },
    rgba(hex, a) { const [r, g, b] = U.hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; },
    mix(h1, h2, t) {
      const a = U.hexToRgb(h1), b = U.hexToRgb(h2);
      return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
    },
    fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  });

  SS.font = (size, weight, display) =>
    (weight || 700) + ' ' + Math.round(size * 100) / 100 + 'px ' + (display ? SS.CONFIG.FONT_DISPLAY : SS.CONFIG.FONT_UI);
})();
