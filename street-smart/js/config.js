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
  // marker colours chosen to stand out against the warm street palette
  SS.COL_PICK = '#1fd1ff'; // pick up: electric cyan
  SS.COL_DROP = '#ff2e88'; // deliver: hot pink
  SS.COL_PLAYER = '#b6ff1a'; // you: hi-vis lime (no one else wears it)

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
    zoomSetting: 'Camera zoom',
    synthMusic: 'Built-in music',
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
    crossHint: 'Cross the road, or walk on across the side street. Keep it steady.',
    crossHintShort: 'Cross the road ↑↓ or the side street →',
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
    popRide: 'Bumpy ride!',
    popRideCargo: 'Hold on to the cargo!',
    popSlowmo: 'Slow motion!',
    popFruit: 'Fresh fruit! Breath refilled',
    popSunglasses: 'Sunglasses on!',
    popOuch: 'Ouch!',
    popGassed: 'Durian overload!',
    popBump: 'Bump!',
    popConfidenceLow: 'Riders can\'t read you!',

    now: 'NOW!',
    // orders, tips & ratings
    orderPickup: 'Pick up {food} at {shop}',
    orderDeliver: 'Deliver {food} to the customer',
    orderDeliverShop: 'Deliver {food} to {shop}',
    orderOf: 'Order {i} of {n}',
    orderUp: 'Order up!',
    pickUpTag: 'PICK UP',
    deliverTag: 'DELIVER',
    vendorLines: ['Hot! Go go go!', 'Quick, quick!', 'Careful, it is hot!', 'Do not spill it!'],
    ordersCount: '{n} orders',
    heat: 'HEAT', ice: 'ICE', freshness: 'FRESH', condition: 'CONDITION',
    cold: 'Gone cold!', melted: 'All melted!',
    dropped: 'Dropped it!',
    orderFailed: 'Order ruined. Next one!',
    tipLine: '+{tip} tip',
    streak: 'Streak ×{n}',
    reactions: [
      ['Is this a joke?', 'I asked for food, not soup on a lid.'],
      ['Cold and messy…', 'Took your time, huh?'],
      ['It will do.', 'Okay, thanks.'],
      ['Nice, still warm!', 'Good job!'],
      ['Still steaming! Perfect!', 'Wow, so fast!', 'Best delivery ever!'],
    ],
    reactionsCold: [
      ['Is this a joke?', 'This is just wet.'],
      ['All the ice melted…', 'Warm coffee? Really?'],
      ['It will do.', 'Okay, thanks.'],
      ['Nice and cold!', 'Good job!'],
      ['Ice cold! Perfect!', 'So refreshing!', 'Best delivery ever!'],
    ],
    shiftComplete: 'SHIFT COMPLETE!',
    shiftOver: 'SHIFT OVER',
    statOrders: 'Orders delivered',
    statRating: 'Average rating',
    statTips: 'Tips earned',
    statStreak: 'Best streak',
    statBest: 'Best score',
    upgrades: 'UPGRADES',
    upgradeTitle: 'UPGRADE SHOP',
    upgradeSub: 'Spend your tips. Upgrades last for every shift.',
    maxed: 'MAX',
    bought: 'Upgraded!',
    passport: 'FOOD PASSPORT',
    passportSub: 'Deliver each dish with 4 stars or more to earn its stamp.',
    passportDone: 'Passport complete! +300 coins',
    stampEarned: 'New stamp: {food}!',
    luckyCharm: 'Lucky charm!',
    endlessName: 'Endless Rush Hour',
    endlessHint: 'Unlock by finishing level 1',
    rainStart: 'Sudden downpour!',
    rainSub: 'Riders can see less and food cools faster.',
    redLight: 'Red light: cross now!',
    objective: '{cargo} → {shop}  ·  {m} m',
    objectiveHere: '{cargo} → {shop}  ·  cross the road!',
    endHint: 'Cross the road to your pink DELIVER marker!',
    banhbaoIndicator: 'BÁNH BAO',
    howToPlay: 'HOW TO PLAY',
    letsGo: "LET'S GO",
    controlsSetting: 'Touch controls',
    ctrlDpad: 'Arrows',
    ctrlJoystick: 'Joystick',
    howto: [
      ['THE JOB', 'Collect hot food and iced drinks at the blue PICK UP marker. Deliver each order to the customer under the pink DELIVER marker before it goes cold.'],
      ['FLOW, DON\'T DASH', 'On the road, walk slowly and steadily. Riders read your path and steer around you. Stopping, reversing or sprinting confuses them, and that is when they hit you.'],
      ['WATCH OUT', 'Sellers grab you: tap NO THANKS or BUY. Durian stink clouds: hold your breath. Bumps and sudden moves spill your cargo.'],
      ['TIPS & UPGRADES', 'Fast, clean deliveries earn big tips and 5 stars. Spend tips on upgrades. Step in front of the bánh bao bike at the right moment for a power-up.'],
    ],
    howtoFooter: 'You wear the lime-green shirt. 3 lives per shift. Spill an order completely and it is ruined, so move on to the next one.',
    purchaseUnavailable: 'Purchases are not available yet',
    controlsTouch: 'Drag on the left: walk   ·   SPRINT   ·   HOLD BREATH   ·   NO THANKS   ·   BUY',
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
      move: 'Touch and drag anywhere on the LEFT side of the screen to walk.',
      moveDesktop: 'Move with WASD or the arrow keys.',
      blocked: 'The footpath is blocked. Step out into the road.',
      steady: 'Walk slowly and STEADILY. Riders read your path and flow around you.',
      drain: 'Stopping, reversing or sprinting drains CONFIDENCE. Low confidence = chaos.',
      cargo: 'Careful! Sudden moves and bumps spill the food. Watch the CONDITION bar.',
      pickup: 'Your first order! Go to the blue PICK UP marker and step into its ring to collect it.',
      carry: 'It is hot! The HEAT bar drops every second. Take it to the customer under the pink DELIVER marker.',
      tip: 'Delivered! Faster and cleaner deliveries earn bigger tips. Spend tips on upgrades between shifts.',
      light: 'Traffic lights! When the main road is red, the bikes stop. That is your moment to cross.',
      durian: 'Durian cloud! Hold BREATH (Space) to walk through the stink.',
      seller: 'A street seller! Tap NO THANKS (E) quickly to escape, or BUY (hold E).',
      banhbao: 'Hear that? The bánh bao bike! Step in front of him at the right moment to grab one.',
      intersection: 'Intersection! Cross to the other footpath. Keep it steady.',
      deliver: 'Last order! Finish it to end your shift.',
    },

    sellerNames: {
      sunglasses: 'Sunglasses seller',
      fruit: 'Fruit seller',
      watch: 'Watch seller',
      shoe: 'Shoe cleaner',
      ride: 'Fake ride-hail driver',
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
  /* ---------------- Foods you deliver ----------------
   * shop: the sign word of the shop you pick it up from (must be in the sign list)
   * temp: 'hot' cools down, 'cold' melts; 'warm' changes slowly
   * sens: how easily it spills; cool: how fast it loses heat / ice */
  SS.FOODS = {
    pho:     { id: 'pho',     name: 'phở',             shop: 'PHỞ BÒ',   carry: 'pho',   temp: 'hot',  sens: 1.0,  cool: 1.0 },
    buncha:  { id: 'buncha',  name: 'bún chả',         shop: 'BÚN CHẢ',  carry: 'box',   temp: 'hot',  sens: 0.8,  cool: 1.0 },
    comtam:  { id: 'comtam',  name: 'cơm tấm',         shop: 'CƠM TẤM',  carry: 'box',   temp: 'hot',  sens: 0.6,  cool: 0.9 },
    banhbao: { id: 'banhbao', name: 'bánh bao',        shop: 'BÁNH BAO', carry: 'bun',   temp: 'hot',  sens: 0.4,  cool: 1.1 },
    banhmi:  { id: 'banhmi',  name: 'bánh mì',         shop: 'BÁNH MÌ',  carry: 'bread', temp: 'warm', sens: 0.35, cool: 0.6 },
    caphe:   { id: 'caphe',   name: 'iced coffee',     shop: 'CÀ PHÊ',   carry: 'cup',   temp: 'cold', sens: 0.9,  cool: 1.1, cup: '#6a3e22' },
    trada:   { id: 'trada',   name: 'iced tea',        shop: 'TRÀ ĐÁ',   carry: 'cup',   temp: 'cold', sens: 0.8,  cool: 1.0, cup: '#d9a640' },
    nuocmia: { id: 'nuocmia', name: 'sugarcane juice', shop: 'NƯỚC MÍA', carry: 'cup',   temp: 'cold', sens: 0.8,  cool: 1.0, cup: '#cfe07a' },
  };
  SS.FOOD_ORDER = ['pho', 'buncha', 'comtam', 'banhbao', 'banhmi', 'caphe', 'trada', 'nuocmia'];

  /* ---------------- Upgrade shop (bought with tips) ---------------- */
  SS.UPGRADES = [
    { id: 'sandals', name: 'Comfy sandals',   desc: 'Walk 7% faster per level.',                      prices: [40, 100, 180] },
    { id: 'box',     name: 'Padded box',      desc: 'Food spills 18% less per level.',                prices: [50, 110, 200] },
    { id: 'bag',     name: 'Insulated bag',   desc: 'Food stays hot (or iced) 20% longer per level.', prices: [50, 110, 200] },
    { id: 'lungs',   name: 'Big lungs',       desc: 'Durian stink and holding breath cost 25% less.', prices: [60, 140] },
    { id: 'whisper', name: 'Traffic whisperer', desc: 'Confidence builds 25% faster per level.',      prices: [80, 180] },
    { id: 'charm',   name: 'Lucky charm',     desc: 'Shrug off the first hit of every shift.',        prices: [250] },
  ];

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
    // Fake ride-hail driver: waves a phone at you. Buying = a wild bike ride further down the street.
    // NOTE: "Grab" is a trademark of Grab Holdings. Change these lines before release if you want to avoid it.
    ride:       { behaviour: 'follow', speed: 118, price: 120, hold: 0.3, escape: 5, giveUp: 12,
                  lines: ['You want to grab? You want to grab?', 'Moto? Cheap cheap!', 'Very fast! Very safe!'] },
    shoe:       { behaviour: 'grab',   speed: 0,   price: 15, hold: 0.0,  escape: 6, giveUp: 0, finish: 3.6,
                  lines: ['Shoe clean, mister?', 'Very shiny!', 'Almost done!'] },
  };

  /* ---------------- Lighting presets (time of day) ---------------- */
  SS.LIGHTING = {
    morning: {
      sky: ['#f2b98c', '#f9e0b4'], far: '#9a7f68', farLit: '#e0b07a',
      haze: 'rgba(255,214,165,0.16)', hazeTop: 'rgba(255,205,150,0.18)',
      ambient: 'rgba(255,190,120,0.07)', ambientMode: 'source-over',
      road: '#4f4a46', roadLine: 'rgba(250,230,190,0.35)', pathBase: '#b08f6c', pathLine: '#8f7052',
      shadow: 'rgba(40,30,20,0.30)', shadowSkew: -0.9, shadowLen: 0.55,
      neon: 0.6, lantern: 0.55, windowGlow: 0.45, headlights: 0, puddles: false,
      sunGlow: 'rgba(255,240,200,0.20)', vignette: 0.22, rim: 'rgba(255,255,235,0.95)',
      glare: 'sun', dust: 0.6,
    },
    golden: {
      sky: ['#e9915a', '#f6c77c'], far: '#7d6a5a', farLit: '#d29a63',
      haze: 'rgba(255,186,110,0.18)', hazeTop: 'rgba(255,170,90,0.22)',
      ambient: 'rgba(255,140,50,0.10)', ambientMode: 'source-over',
      road: '#5a4c44', roadLine: 'rgba(255,220,170,0.30)', pathBase: '#a07e62', pathLine: '#86684f',
      shadow: 'rgba(60,25,10,0.36)', shadowSkew: 1.6, shadowLen: 0.75,
      neon: 0.85, lantern: 0.85, windowGlow: 0.65, headlights: 0.25, puddles: false,
      sunGlow: 'rgba(255,170,80,0.26)', vignette: 0.32, rim: 'rgba(255,230,170,0.95)',
      glare: 'sun', dust: 1.0,
    },
    night: {
      sky: ['#090b22', '#2b1b3c'], far: '#1c1a2c', farLit: '#3b2f4c',
      haze: 'rgba(40,30,80,0.22)', hazeTop: 'rgba(30,20,60,0.3)',
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
      // ride-hail riders in traffic: green jackets & helmets, no logos
      rideHailColor: '#2fa84f',
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
          cargo: 'pho', destination: 'TẠP HÓA', orders: 3, foods: ['pho', 'banhmi', 'caphe', 'banhbao'],
          brief: 'Bà Lan: “Your first shift! Collect each order at the blue PICK UP marker, then get it to the customer while it is still hot.”',
          length: 11200, density: 0.62, speedMul: 0.9, wildRiders: 0.03,
          intersections: [3400, 8000],
          durianEvery: 2200, durianFirst: 1500, cars: 13,
          sellerTypes: ['sunglasses', 'ride', 'fruit'], sellerFirst: 1100, sellerEvery: 1300,
          banhbaoFirst: 900, banhbaoEvery: 20,
          coinGroups: 26, obstacleDensity: 0.65,
          stars: [2600, 4200], tutorial: true, requiresFullGame: false,
        },
        {
          id: 'vn-2', name: 'Golden-Hour Market', time: 'golden', music: 'market',
          cargo: 'cake', destination: 'BIA HƠI', orders: 4, foods: ['buncha', 'comtam', 'nuocmia', 'trada', 'pho'], rain: true,
          brief: 'Bà Lan: “Market rush! Hot food cools and iced drinks melt. Keep moving, but keep it steady.”',
          length: 13200, density: 0.95, speedMul: 1.0, wildRiders: 0.06,
          intersections: [3000, 7000, 10600],
          durianEvery: 1500, durianFirst: 1200, cars: 14,
          sellerTypes: ['sunglasses', 'ride', 'fruit', 'watch', 'shoe'], sellerFirst: 900, sellerEvery: 1050,
          banhbaoFirst: 700, banhbaoEvery: 17,
          coinGroups: 34, obstacleDensity: 0.8,
          stars: [3600, 6000], tutorial: false, requiresFullGame: true,
        },
        {
          id: 'vn-3', name: 'Neon Rush Hour', time: 'night', music: 'night',
          cargo: 'eggs', destination: 'BÁNH MÌ', orders: 5, foods: ['pho', 'banhbao', 'buncha', 'caphe', 'comtam', 'banhmi'], rain: true,
          brief: 'Bà Lan: “Night shift in rush hour. Five orders. Do not spill my bún chả.”',
          length: 14400, density: 1.12, speedMul: 1.14, wildRiders: 0.09,
          intersections: [2800, 7000, 11400],
          durianEvery: 1800, durianFirst: 1300, cars: 15,
          sellerTypes: ['ride', 'sunglasses', 'fruit', 'watch', 'ride', 'shoe'], sellerFirst: 800, sellerEvery: 950,
          banhbaoFirst: 600, banhbaoEvery: 15,
          coinGroups: 40, obstacleDensity: 0.9,
          stars: [4200, 7200], tutorial: false, requiresFullGame: true,
        },
        {
          // Endless: orders keep coming and the traffic keeps getting busier
          id: 'vn-endless', name: 'Endless Rush Hour', time: 'golden', music: 'market', endless: true,
          cargo: 'pho', destination: 'TẠP HÓA', orders: 9999, foods: ['pho', 'buncha', 'comtam', 'banhbao', 'banhmi', 'caphe', 'trada', 'nuocmia'], rain: true,
          brief: 'Bà Lan: “Endless orders, endless traffic. How long can you last?”',
          length: 90000, density: 0.75, speedMul: 1.0, wildRiders: 0.06,
          intersections: Array.from({ length: 21 }, (_, i) => 3200 + i * 4000),
          durianEvery: 1900, durianFirst: 1500, cars: 13,
          sellerTypes: ['sunglasses', 'ride', 'fruit', 'watch', 'shoe'], sellerFirst: 900, sellerEvery: 1100,
          banhbaoFirst: 700, banhbaoEvery: 18,
          coinGroups: 220, obstacleDensity: 0.8,
          stars: [0, 0], tutorial: false, requiresFullGame: true, unlockAfter: 'vn-1',
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
