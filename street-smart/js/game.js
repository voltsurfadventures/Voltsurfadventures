/* =====================================================================
 * Game session — one run of one level (or the title-screen demo).
 * ---------------------------------------------------------------------
 * THE FLOW MECHANIC (the heart of the game):
 *  - Every rider keeps an *estimate* of the player's velocity. How fast
 *    and how accurately that estimate tracks you depends on CONFIDENCE.
 *  - Riders predict where you will be when they reach you and steer to
 *    pass BEHIND your line of travel (like real Hanoi traffic), braking
 *    smoothly if they can't make the gap.
 *  - Walking at a steady pace builds confidence: riders read you early
 *    and the river of scooters parts around you.
 *  - Stopping, reversing, jerking about or sprinting drains confidence:
 *    riders notice you late, mis-predict, panic, swerve, crash into each
 *    other... and into you.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const G = SS.GEOM;
  const C = SS.CONFIG;
  const S = SS.STRINGS;
  const WALK = C.WALK_SPEED;

  let SC_ID = 0;

  class Session {
    constructor(worldId, levelIndex, opts) {
      opts = opts || {};
      this.demo = !!opts.demo;
      this.world = SS.WORLDS[worldId];
      this.levelIndex = levelIndex;
      this.level = this.world.levels[levelIndex];
      this.cargoDef = { id: null, carry: null, temp: null, sensitivity: 0 }; // what you are carrying right now
      const L = SS.LIGHTING[this.level.time];
      this.L = Object.assign({ key: this.level.time }, L);
      this.W = SS.World.build(this.world, this.level, levelIndex);
      this.time = 0;
      this.state = this.demo ? 'demo' : 'intro';
      this.stateT = 0;
      this.cam = { x: this.demo ? 600 : -60, shake: 0, sx: 0, sy: 0 };
      this.scooters = [];
      this.pool = [];
      this.sellers = [];
      this.clouds = [];
      this.particles = [];
      this.pPool = [];
      this.popups = [];
      this.variants = this.makeVariants();
      this.grid = new Map();
      this.score = 0;
      // coins in a shift start at 0; they go into your savings only when the shift ends
      // (restart or quit mid-shift and they are lost)
      this.coins = 0;
      this.coinsStart = 0;
      this.banked = false;
      this.stats = { coins: 0, nearMiss: 0, crossings: 0, banhbao: 0, sellers: 0, hits: 0 };
      this.freezeT = 0; this.slowT = 0; this.slowOn = true; this.slowGlitchT = 0;
      this.glare = 0; this.glareX = 0; this.glareY = 0;
      this.flash = 0;
      this.bbTimer = this.level.banhbaoEvery;
      this.bbSeen = false;
      this.inter = null;
      this.tut = { shown: {}, cur: null, t: 0, queue: [] };
      this.banner = null;
      this.dangerT = 0;
      this.lowConfMsgT = 0;
      this.crossing = null;
      // delivery shift
      this.orders = []; this.order = null; this.customers = [];
      this.delivered = 0; this.failedOrders = 0; this.tips = 0; this.streak = 0; this.bestStreak = 0; this.ratingSum = 0;
      this.charmUsed = false; this.ratingFx = null;
      // events: traffic lights at every intersection, and maybe a downpour
      for (const I of this.W.intersections) {
        I.phase = Math.floor(Math.random() * 4); I.phaseT = U.rand(1, 6);
        this.W.obstacles.push({ kind: 'light', x: I.x - G.CROSS_HALF - 16, y: G.ROAD_BOT + 10, w: 10, d: 6, I, side: 'near' });
        this.W.obstacles.push({ kind: 'light', x: I.x + G.CROSS_HALF + 16, y: G.ROAD_TOP - 3, w: 10, d: 6, I, side: 'far' });
      }
      this.rainX = this.level.rain ? this.W.length * U.rand(0.3, 0.6) : null; this.rainT = 0; this.rainK = 0;
      if (!this.demo) { this.initPlayer(); this.nextOrder(); }
      this.prefillTraffic();
    }

    /* ------------------------------------------------------------------ */
    initPlayer() {
      this.player = {
        x: 120, y: 500, vx: 0, vy: 0, svx: 0, svy: 0, face: 1, phase: 0,
        conf: 60, breath: 100, cargo: 100, lives: C.LIVES,
        invuln: 0, still: 0, gassed: 0, holding: false, sprinting: false,
        tumble: null, latchedBy: null, sellerCD: 0, boostT: 0, sunglasses: 0,
        bumpCD: 0, nudgeCD: 0, spillAcc: 0, onRoad: false, side: 'near', moved: 0,
        breathCough: 0, shakeHist: 0, lastAx: 0,
      };
    }

    makeVariants() {
      const pal = this.world.palette;
      const kinds = [['single', 30], ['couple', 14], ['family', 9], ['crates', 8], ['flowers', 8], ['chickens', 7], ['boxes', 7], ['delivery', 8], ['ridehail', 6], ['car', this.level.cars || 6]];
      const rng = U.rng(77 + this.levelIndex);
      const pickK = () => { let t = 0; for (const k of kinds) t += k[1]; let r = rng() * t; for (const k of kinds) { r -= k[1]; if (r <= 0) return k[0]; } return 'single'; };
      const out = [];
      for (let i = 0; i < 30; i++) out.push(this.makeVariant(i < 29 ? pickK() : 'single', 'v' + this.levelIndex + '_' + i, rng, pal));
      this.bbVariant = this.makeVariant('banhbao', 'bb', rng, pal);
      return out;
    }
    makeVariant(kind, key, rng, pal) {
      const P = (a) => a[Math.floor(rng() * a.length)];
      const rider = (role, x, small) => ({
        role, x, small: !!small, shirt: P(pal.shirts), skin: P(pal.skin),
        helmet: small && rng() < 0.4 ? null : P(pal.helmets), pants: P(['#33363f', '#4a4038', '#2c3e5a', '#5a5a5a']),
        mask: rng() < 0.3 ? P(['#e9e6dc', '#7aa2c8', '#e88aa8', '#2a2a2e']) : null,
        headY: small ? -50 : -60,
      });
      const v = { key, kind, body: P(pal.scooters), riders: [] };
      if (kind === 'couple') v.riders = [rider('driver', -6), rider('hold', -22)];
      else if (kind === 'family') v.riders = [rider('pass', 8, true), rider('driver', -6), rider('pass', -18, true), rider('hold', -28)];
      else if (kind === 'car') { // sedans, taxis (no lettering) and vans
        v.sub = P(['sedan', 'sedan', 'taxi', 'van']);
        v.body = v.sub === 'taxi' ? P(['#f4f1ea', '#2f9a5a', '#f2c230']) : v.sub === 'van' ? P(['#ecebe6', '#cfd3d6', '#8fb3c9']) : P(['#c7ccd1', '#f4f1ea', '#2a2c33', '#b8322a', '#2f5f9a', '#7a7f86']);
      }
      else if (kind === 'ridehail') { // ride-hail bike: green jacket + helmet, passenger in the spare helmet
        const g = this.world.rideHailColor || '#2fa84f';
        const d = rider('driver', -6); d.shirt = g; d.helmet = g; d.stripe = true; d.mask = null;
        const pas = rider('hold', -22); pas.helmet = g;
        v.riders = rng() < 0.75 ? [d, pas] : [d];
      }
      else if (kind === 'delivery') { const r = rider('driver', -6); r.shirt = P(['#2fa84f', '#f2a81d', '#e8432d']); r.bag = U.shade(r.shirt, -0.1); r.helmet = r.shirt; v.riders = [r]; }
      else if (kind === 'banhbao') {
        const r = rider('driver', -4); r.shirt = '#e8e2d0'; r.helmet = null; r.hair = '#1d1611'; r.mask = null; r.skin = '#c48b5f';
        v.riders = [r]; v.body = '#3a3d44';
      } else v.riders = [rider('driver', -6)];
      return v;
    }

    /* ------------------------------------------------------------------ */
    /* Traffic                                                             */
    /* ------------------------------------------------------------------ */
    get viewW() { return SS.View.w; }

    spawnScooter(o) {
      const s = this.pool.pop() || {};
      s.id = ++SC_ID; s.active = true;
      s.x = o.x; s.y = o.y; s.ax = o.ax; s.ay = o.ay;
      s.vertical = s.ay !== 0;
      s.desired = o.speed; s.speed = o.speed * U.rand(0.85, 1);
      s.homeLat = s.vertical ? o.x : o.y;
      s.latV = 0; s.variant = o.variant || U.pick(this.variants);
      if (s.vertical) while (s.variant.kind === 'car') s.variant = U.pick(this.variants); // cars stay on the main road
      s.plan = null; s.replanT = 0;
      const isCar = s.variant.kind === 'car';
      s.len = isCar ? 64 : 34; s.halfW = isCar ? 14 : 7; // footprint (half length along travel, half width)
      if (isCar) { s.desired *= 0.95; s.speed *= 0.95; if (!s.vertical) s.homeLat = U.clamp(s.homeLat, G.ROAD_TOP + 40, G.ROAD_BOT - 30); }
      s.skill = o.skill != null ? o.skill : (U.chance(this.level.wildRiders) && s.variant.kind !== 'car' ? U.rand(0.3, 0.46) : U.rand(0.82, 1.05));
      s.evx = 0; s.evy = 0; s.prevAlong = null; s.nearMissed = false; s.whooshed = false;
      s.panic = 0; s.panicLat = 0; s.crashed = 0; s.honkCD = U.rand(0, 1); s.look = 0; s.lookT = 0;
      s.bubble = null; s.isBB = !!o.isBB; s.grabbed = false; s.wasInLane = false; s.bbPassed = false;
      s.wob = Math.random() * 6; s.wander = U.rand(-1, 1); s.ix = o.ix || null; s.hitT = 0;
      s.highBeam = 0; s.glared = false; s.wobT = 0;
      this.scooters.push(s);
      return s;
    }

    density() {
      let d = this.level.density;
      if (this.inter && this.inter.active) d *= 1.3;
      if (this.demo) d = 1.0;
      if (this.level.endless) d *= 1 + Math.min(1.1, this.delivered * 0.06);
      return d;
    }

    prefillTraffic() {
      const x0 = this.cam.x - 300, x1 = this.cam.x + this.viewW + 300;
      const n = Math.round(this.density() * (x1 - x0) / 52);
      for (let i = 0; i < n; i++) {
        const right = i % 2 === 0;
        const band = right ? G.LOWER_BAND : G.UPPER_BAND;
        const x = U.rand(x0, x1), y = U.rand(band[0], band[1]);
        if (!this.demo && Math.abs(x - 120) < 160) continue; // keep the start area calm
        if (this.spotFree(x, y)) this.spawnScooter({ x, y, ax: right ? 1 : -1, ay: 0, speed: this.baseSpeed() });
      }
    }
    baseSpeed() { return U.rand(165, 235) * this.level.speedMul; }

    spotFree(x, y) {
      for (const s of this.scooters) if (Math.abs(s.x - x) < s.len + 60 && Math.abs(s.y - y) < s.halfW + 14) return false;
      return true;
    }

    manageTraffic(dt) {
      const vw = this.viewW, cx = this.cam.x;
      const x0 = cx - 320, x1 = cx + vw + 320;
      const target = this.density() * (x1 - x0) / 52;
      let nR = 0, nL = 0;
      for (const s of this.scooters) if (!s.vertical && !s.isBB) { if (s.ax > 0) nR++; else nL++; }
      const want = target / 2;
      // spawn a few per frame at the off-screen edges (streams enter from the sides)
      for (let k = 0; k < 2; k++) {
        if (nR < want) { const y = U.rand(G.LOWER_BAND[0], G.LOWER_BAND[1]), x = cx - U.rand(90, 300); if (this.spotFree(x, y)) { this.spawnScooter({ x, y, ax: 1, ay: 0, speed: this.baseSpeed() }); nR++; } }
        if (nL < want) { const y = U.rand(G.UPPER_BAND[0], G.UPPER_BAND[1]), x = cx + vw + U.rand(90, 300); if (this.spotFree(x, y)) { this.spawnScooter({ x, y, ax: -1, ay: 0, speed: this.baseSpeed() }); nL++; } }
      }
      // cross-street traffic at intersections near the view
      for (const I of this.W.intersections) {
        if (I.x < cx - 250 || I.x > cx + vw + 250) continue;
        I.spawnT = (I.spawnT || 0) - dt * this.density() * (I.active ? 1.6 : 0.9);
        if (I.spawnT <= 0) {
          I.spawnT = U.rand(0.55, 1.1);
          const down = Math.random() < 0.5;
          const x = I.x + (down ? -1 : 1) * U.rand(18, G.CROSS_HALF - 18);
          const y = down ? G.FACADE_BOT - 40 : G.VIEW_H + 60;
          let free = true;
          for (const s of this.scooters) if (s.vertical && Math.abs(s.x - x) < 22 && Math.abs(s.y - y) < 70) { free = false; break; }
          if (free) this.spawnScooter({ x, y, ax: 0, ay: down ? 1 : -1, speed: U.rand(120, 170) * this.level.speedMul, ix: I.x });
        }
      }
      // despawn
      for (let i = this.scooters.length - 1; i >= 0; i--) {
        const s = this.scooters[i];
        let gone = false;
        if (s.vertical) gone = s.y < G.FACADE_BOT - 90 || s.y > G.VIEW_H + 90 || s.x < cx - 600 || s.x > cx + vw + 600;
        else if (s.ax > 0) gone = s.x > cx + vw + 380 || s.x < cx - (s.isBB ? 1400 : 700);
        else gone = s.x < cx - 380 || s.x > cx + vw + (s.isBB ? 1400 : 700);
        if (gone) {
          if (s.isBB) { SS.Audio.bbStop(); this.bb = null; }
          s.active = false; this.scooters.splice(i, 1); this.pool.push(s);
        }
      }
    }

    buildGrid() {
      const g = this.grid; g.clear();
      for (const s of this.scooters) {
        const k = Math.floor(s.x / 80);
        let a = g.get(k); if (!a) { a = []; g.set(k, a); } a.push(s);
      }
    }

    onRoadAt(x, y) {
      if (y > G.ROAD_TOP - 2 && y < G.ROAD_BOT + 2) return true;
      for (const I of this.W.intersections) if (Math.abs(x - I.x) < G.CROSS_HALF) return true;
      return false;
    }

    updateScooters(dt) {
      const p = this.player;
      const ts = (this.freezeT > 0 ? 0 : 1) * (this.slowT > 0 && this.slowOn ? 0.42 : 1);
      // riders only react to a pedestrian who is on (or stepping into) the road
      const pActive = p && !p.tumble && this.state === 'play' && (p.onRoad || p.y > G.ROAD_BOT - 4 && p.y < G.ROAD_BOT + 14 || p.y < G.ROAD_TOP + 4 && p.y > G.ROAD_TOP - 14);
      const conf = p ? p.conf / 100 : 1;
      this.buildGrid();
      let tension = 0;
      for (const s of this.scooters) {
        const ax = s.ax, ay = s.ay, px_ = -ay, py_ = ax; // perpendicular
        const dirSign = s.vertical ? px_ : py_;           // perp coord -> absolute lateral axis
        const curLat = s.vertical ? s.x : s.y;
        const lo = s.vertical ? s.ix - G.CROSS_HALF + 14 : G.ROAD_TOP + 10 + s.halfW, hi = s.vertical ? s.ix + G.CROSS_HALF - 14 : G.ROAD_BOT - 4 - s.halfW;
        let target = s.desired;
        let latPush = 0;
        let avoidLat = null;
        s.wob += dt * 3;
        if (s.crashed > 0) {
          s.crashed -= dt; s.speed = U.approach(s.speed, 0, 600 * dt); s.wobT += dt;
          if (s.crashed <= 0) s.speed = 30;
          s.x += ax * s.speed * dt * ts; s.y += ay * s.speed * dt * ts;
          continue;
        }
        // ---- neighbours: overtake slower bikes, weave through cross traffic ----
        const k = Math.floor(s.x / 80);
        for (let kk = k - 2; kk <= k + 2; kk++) {
          const cell = this.grid.get(kk); if (!cell) continue;
          for (const n of cell) {
            if (n === s) continue;
            const rx = n.x - s.x, ry = n.y - s.y;
            const along = rx * ax + ry * ay, lat = rx * px_ + ry * py_;
            const crossing = n.vertical !== s.vertical;
            const gapAlong = (s.len + n.len) * 0.85, gapLat = s.halfW + n.halfW + 3; // Hanoi riders squeeze close
            if (along > 0 && along < gapAlong + 50 && Math.abs(lat) < gapLat) {
              if (crossing) {
                // horizontal traffic has priority; cross traffic slips through the gaps
                if (s.vertical && along < gapAlong + 20) target = Math.min(target, s.desired * 0.35);
                latPush += -(lat >= 0 ? 1 : -1) * 40;
              } else {
                const nAlong = n.speed * (n.ax * ax + n.ay * ay);
                // pick the overtaking side with more room
                let side = lat >= 0 ? -1 : 1;
                const dest = curLat + side * gapLat * dirSign;
                if (dest < lo || dest > hi) side = -side;
                latPush += side * 95 * (1 - along / (gapAlong + 50));
                // only tuck in behind when really close
                if (along < gapAlong + 8) target = Math.min(target, Math.max(nAlong, s.desired * 0.25) + (along - gapAlong) * 2);
                else if (nAlong < s.speed) target = Math.min(target, s.desired * 0.85); // ease off while going round
              }
            }
            if (!crossing && Math.abs(along) < gapAlong * 0.8 && Math.abs(lat) < gapLat) latPush -= (lat >= 0 ? 1 : -1) * (gapLat - Math.abs(lat)) * 1.6;
            // panicking riders can tangle with each other
            if ((s.panic > 0 || n.panic > 0) && Math.abs(along) < s.len * 0.8 && Math.abs(lat) < gapLat * 0.6 && s.speed > 60 && !crossing && pActive) this.scooterCrash(s, n);
          }
        }
        // ---- traffic lights (most riders stop; some run the red) ----
        const ld = this.lightStop(s);
        if (ld !== null) target = Math.min(target, Math.max(0, ld * 2.2));
        // ---- flow: predict the player and commit to a passing line ----
        let sees = false;
        if (pActive) {
          const rx = p.x - s.x, ry = p.y - s.y;
          const along = rx * ax + ry * ay, lat = rx * px_ + ry * py_;
          // the rider's read of you: 10% confidence = unreadable, 70%+ = perfectly readable
          const q = U.clamp(U.clamp((conf - 0.1) / 0.6, 0, 1) * s.skill * (s.isBB ? 0.35 : 1) * (1 - 0.18 * this.rainK), 0, 1);
          const readRate = U.lerp(0.8, 8, q);
          const jitter = conf < 0.4 ? (0.4 - conf) * 260 : 0;
          s.evx += (p.vx + U.rand(-jitter, jitter) - s.evx) * Math.min(1, readRate * dt);
          s.evy += (p.vy + U.rand(-jitter, jitter) - s.evy) * Math.min(1, readRate * dt);
          const notice = U.lerp(80, 320, q);
          const CLR = 28 + s.halfW * 1.6;
          if (along < -s.len) s.plan = null; // passed: forget the plan, drift back home
          if (along > -s.len && along < notice && Math.abs(lat) < CLR + 70) {
            sees = true;
            const closing = s.speed - (s.evx * ax + s.evy * ay);
            const t = Math.max(0.05, (along - s.len) / Math.max(closing, 30)); // when the FRONT reaches your line
            const plv = s.evx * px_ + s.evy * py_;
            const predLat = lat + plv * t;
            s.replanT = (s.replanT || 0) - dt;
            if (Math.abs(predLat) < CLR + 6 && !(s.isBB && s.grabbed) && (!s.plan || s.replanT <= 0)) {
              // choose a line once (riders commit; they don't shadow you): behind your direction of travel first
              const sides = Math.abs(plv) > 12 ? [-Math.sign(plv), Math.sign(plv)] : (predLat >= 0 ? [-1, 1] : [1, -1]);
              let plan = null;
              for (const side of sides) {
                const destAbs = curLat + (predLat + side * CLR) * dirSign;
                if (destAbs >= lo && destAbs <= hi) { plan = { dest: destAbs }; break; }
              }
              // squeeze along the kerb if that still leaves enough room
              if (!plan) for (const side of sides) {
                const destAbs = U.clamp(curLat + (predLat + side * CLR) * dirSign, lo, hi);
                if (Math.abs(predLat - (destAbs - curLat) * dirSign) > s.halfW + 22) { plan = { dest: destAbs }; break; }
              }
              s.plan = plan || { dest: curLat, brake: true };
              s.replanT = U.lerp(0.9, 0.35, q);
            }
            if (s.plan) {
              const need = (s.plan.dest - curLat) * dirSign; // perp-coord displacement still to do
              const latMax = U.lerp(30, 140, q);
              avoidLat = U.clamp(need / Math.max(t * 0.7, 0.15), -latMax, latMax);
              const late = s.plan.brake || Math.abs(need) / latMax > t * 1.15;
              if (late && Math.abs(predLat) < CLR) {
                if (q > 0.35) target = Math.min(target, Math.max(0, (along - s.len - 8) * 2.4)); // smooth yield
                else if (q > 0.15 && along < 120 && Math.random() < dt * 4) { target = 0; s.panic = 0.4; }
                if (s.honkCD <= 0) { s.honkCD = U.rand(1.0, 2.5); SS.Audio.sfx('horn', { pan: this.pan(s.x), vol: 1, car: s.variant.kind === 'car' }); }
              }
              s.look = Math.sign(lat || 1); s.lookT = 0.8;
            }
            // a rider who can read you never ploughs straight into you: emergency stop
            if (q > 0.6 && along > 0 && along < s.len + 70 && Math.abs(lat) < s.halfW + 22) { target = 0; s.panic = 0; s.emergency = true; }
            // low confidence: riders panic and swerve unpredictably
            if (conf < 0.3 && along < 180 && Math.abs(lat) < 70 && s.panic <= 0 && Math.random() < dt * (0.9 - conf * 2)) {
              s.panic = U.rand(0.4, 0.8); s.panicLat = U.rand(-1, 1) * 95;
              if (Math.random() < 0.5) this.shout(s);
              if (s.honkCD <= 0) { s.honkCD = 1; SS.Audio.sfx('horn', { pan: this.pan(s.x), car: s.variant.kind === 'car' }); }
            }
            if (along > 0 && along < 140 && Math.abs(lat) < 40) tension = Math.max(tension, 1 - along / 140);
            // distracted riders lean on the horn when they finally notice you
            if (s.skill < 0.5 && along > 0 && along < 170 && Math.abs(lat) < 45 && s.honkCD <= 0) { s.honkCD = 2.5; SS.Audio.sfx('horn', { pan: this.pan(s.x), type: 2, vol: 1.2 }); this.shout(s); }
          }
        } else s.plan = null;
        if (p && p.tumble === null && this.state === 'play') {
          const rx = p.x - s.x, ry = p.y - s.y;
          this.scooterVsPlayer(s, rx * ax + ry * ay, rx * px_ + ry * py_);
        }
        s.honkCD -= dt;
        if (s.lookT > 0) s.lookT -= dt; else s.look *= 0.9;
        // ---- lateral motion ----
        s.wander += (Math.random() - 0.5) * dt * 0.8;
        s.wander = U.clamp(s.wander, -1, 1);
        let latT;
        if (s.panic > 0) { s.panic -= dt; latT = s.panicLat; target = Math.min(target, s.desired * 0.45); }
        else if (avoidLat !== null) latT = avoidLat + latPush * 0.15;
        else latT = (s.homeLat - curLat) * dirSign * 0.6 + s.wander * 10 + latPush + Math.sin(s.wob) * 4;
        s.latV = U.approach(s.latV, U.clamp(latT, -130, 130), (s.panic > 0 ? 420 : 240) * dt);
        // ---- speed ----
        const acc = target < s.speed ? (s.panic > 0 || s.emergency ? 950 : sees ? 650 : 420) : 300;
        s.emergency = false;
        s.speed = U.approach(s.speed, Math.max(target, 0), acc * dt);
        // ---- integrate ----
        s.x += (ax * s.speed + px_ * s.latV) * dt * ts;
        s.y += (ay * s.speed + py_ * s.latV) * dt * ts;
        if (s.vertical) {
          s.x = U.clamp(s.x, lo, hi);
        } else {
          s.y = U.clamp(s.y, lo, hi);
          // keep (or slowly return) to the matching side of the road
          if (s.ax > 0 && s.homeLat < G.LOWER_BAND[0] - 30) s.homeLat += 10 * dt;
          if (s.ax < 0 && s.homeLat > G.UPPER_BAND[1] + 30) s.homeLat -= 10 * dt;
        }
        if (s.bubble) { s.bubble.t -= dt; if (s.bubble.t <= 0) s.bubble = null; }
        if (s.speed > 120 && Math.random() < dt * 2.2 * this.L.dust * SS.Main.quality) this.particle('dust', s.x - ax * s.len, s.y - 2, -ax * 20, -ay * 20, 0.7);
      }
      if (p) this.tension = tension;
      this.separateTraffic();
    }

    // hard separation: bikes and cars never sit inside each other. Same-direction
    // overlaps are pushed apart sideways when there is room, otherwise the one
    // behind drops back and matches speed.
    separateTraffic() {
      this.buildGrid();
      const seen = new Set();
      for (const s of this.scooters) {
        if (s.crashed > 0) continue;
        const k = Math.floor(s.x / 80);
        for (let kk = k - 1; kk <= k + 1; kk++) {
          const cell = this.grid.get(kk); if (!cell) continue;
          for (const n of cell) {
            if (n === s || n.crashed > 0 || n.vertical !== s.vertical) continue;
            const key = s.id < n.id ? s.id + ':' + n.id : n.id + ':' + s.id;
            if (seen.has(key)) continue; seen.add(key);
            const ax = s.ax, ay = s.ay;
            const rx = n.x - s.x, ry = n.y - s.y;
            const along = rx * ax + ry * ay, lat = rx * -ay + ry * ax;
            const needAlong = (s.len + n.len) * 0.92, needLat = (s.halfW + n.halfW) * 1.5 + 6;
            const oa = needAlong - Math.abs(along), ol = needLat - Math.abs(lat);
            if (oa <= 0 || ol <= 0) continue;
            const sameDir = ax * n.ax + ay * n.ay > 0;
            const lo = s.vertical ? s.ix - G.CROSS_HALF + 14 : G.ROAD_TOP + 10, hi = s.vertical ? s.ix + G.CROSS_HALF - 14 : G.ROAD_BOT - 4;
            if (ol / needLat < oa / needAlong || !sameDir) {
              // sideways: split the push, respecting the kerbs
              const dir = lat >= 0 ? 1 : -1, push = ol * 0.5 + 0.5;
              if (s.vertical) { s.x = U.clamp(s.x + dir * push * ay, lo, hi); n.x = U.clamp(n.x - dir * push * ay, lo, hi); }
              else { s.y = U.clamp(s.y - dir * push * ax, lo + s.halfW, hi - s.halfW); n.y = U.clamp(n.y + dir * push * ax, lo + n.halfW, hi - n.halfW); }
            } else {
              // nose-to-tail: the one behind backs off and matches speed
              const back = along > 0 ? s : n, front = back === s ? n : s;
              back.x -= back.ax * oa; back.y -= back.ay * oa;
              back.speed = Math.min(back.speed, front.speed);
            }
          }
        }
      }
    }

    scooterVsPlayer(s, along, lat) {
      const p = this.player;
      const hitAlong = s.vertical ? 20 : s.len - 2, hitLat = s.vertical ? 13 : s.halfW + 6;
      // bánh bao guy: step in front of him at the right moment
      if (s.isBB) this.banhBaoGrab(s, along, lat);
      if (Math.abs(along) < hitAlong && Math.abs(lat) < hitLat && p.invuln <= 0 && !(s.isBB && s.grabbed) && this.freezeT <= 0) {
        // full hit only from the front half of the bike; walking into the back of one is a nudge
        if (s.speed > 70 && (s.vertical ? along > -6 : along > s.len * 0.35)) { this.playerHit(s); return; }
        // a rider creeping at walking pace just nudges you (no life lost)
        if (p.nudgeCD <= 0 && s.speed > 8) {
          p.nudgeCD = 0.8; s.speed = 0;
          p.vx += (s.vertical ? Math.sign(lat || 1) * -60 : s.ax * 70); p.vy += s.vertical ? s.ay * 70 : -Math.sign(lat || 1) * 60;
          this.spill(2.5, true); p.conf = Math.max(0, p.conf - 8);
          SS.Audio.sfx('horn', { pan: this.pan(s.x), type: 3 }); SS.Audio.sfx('bump');
          this.shout(s);
        }
      }
      // near miss: passed close without hitting you
      if (s.prevAlong !== null && s.prevAlong > 0 && along <= 0 && Math.abs(lat) < s.halfW + 34 && s.speed > 90 && p.invuln <= 0 && p.onRoad) {
        if (s.isBB) {
          if (!s.grabbed && !s.bbPassed) { s.bbPassed = true; this.addScore(100, S.popBanhBaoClose, p.x, p.y - 80, '#ffd75a'); }
        } else if (!s.nearMissed) {
          s.nearMissed = true;
          this.stats.nearMiss++;
          const flow = p.conf > 70;
          this.addScore(flow ? 50 : 25, flow ? S.popFlow : S.popNearMiss, p.x + U.rand(-20, 20), p.y - 78, flow ? '#7ff0d8' : '#ffffff');
          this.coins += 1; this.stats.coins++;
          SS.Audio.sfx('nearmiss', { pan: this.pan(p.x) });
        }
      }
      if (!s.whooshed && Math.abs(along) < s.len + 30 && Math.abs(lat) < 70 && s.speed > 80) {
        s.whooshed = true;
        SS.Audio.sfx('whoosh', { dir: s.vertical ? (lat > 0 ? 1 : -1) : s.ax, vol: U.clamp(1.4 - Math.abs(lat) / 70, 0.3, 1) });
        // glare: sun glinting off a mirror / high-beam headlights
        if (!s.glared && Math.random() < (this.L.glare === 'headlights' ? 0.08 : 0.05)) { s.glared = true; this.triggerGlare(s.x, s.y - 40); }
      }
      s.prevAlong = along;
    }

    scooterCrash(a, b) {
      if (a.crashed > 0 || b.crashed > 0) return;
      a.crashed = b.crashed = U.rand(1.2, 2);
      a.panic = b.panic = 0;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      SS.Audio.sfx('crash', { pan: this.pan(mx), vol: 0.7 });
      this.shout(a); this.shout(b);
      for (let i = 0; i < 10; i++) this.particle('dust', mx + U.rand(-20, 20), my, U.rand(-60, 60), U.rand(-30, 30), 0.8);
      for (const s of [a, b]) {
        if (s.variant.kind === 'chickens') for (let i = 0; i < 8; i++) this.particle('feather', s.x, s.y - 40, U.rand(-80, 80), U.rand(-40, 40), 1.4, U.rand(60, 160));
        if (s.variant.kind === 'flowers') for (let i = 0; i < 8; i++) this.particle('petal', s.x, s.y - 40, U.rand(-80, 80), U.rand(-40, 40), 1.4, U.rand(60, 160));
      }
      this.cam.shake = Math.max(this.cam.shake, 4);
    }

    shout(s) {
      s.bubble = { text: U.pick(S.riderShouts), t: 1.3 };
    }

    pan(x) { return U.clamp((x - (this.cam.x + this.viewW / 2)) / (this.viewW / 2), -1, 1); }

    triggerGlare(x, y) {
      this.glare = 1; this.glareX = x; this.glareY = y;
    }

    // traffic sound: engine voices follow the nearest bikes (with doppler), and riders beep constantly
    audioTick(dt) {
      const A = SS.Audio;
      if (!A.engines) return;
      const p = this.player;
      const lx = p ? p.x : this.cam.x + this.viewW / 2, ly = p ? p.y : 340;
      const near = [];
      for (const s of this.scooters) {
        if (Math.abs(s.x - lx) > 520) continue;
        const d = Math.hypot(s.x - lx, (s.y - ly) * 1.3);
        near.push([d, s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const k = this.demo ? 0.5 : 1;
      for (let i = 0; i < 4; i++) {
        const it = near[i];
        if (!it || this.freezeT > 0) { A.setEngine(i, 60, 0, 0); continue; }
        const [d, s] = it;
        const vx = s.ax * s.speed, vy = s.ay * s.speed;
        const toward = ((lx - s.x) * vx + (ly - s.y) * vy) / Math.max(1, d); // + = approaching
        const car = s.variant.kind === 'car';
        const f = ((car ? 34 : 58) + s.speed * (car ? 0.12 : 0.22)) * (1 + U.clamp(toward / 700, -0.22, 0.22));
        A.setEngine(i, f, (car ? 0.12 : 0.16) * k / (1 + Math.pow(d / 150, 2)), this.pan(s.x));
      }
      // Hanoi soundtrack: someone is always beeping
      this.honkT = (this.honkT || 0.5) - dt;
      if (this.honkT <= 0 && near.length) {
        this.honkT = U.rand(0.25, 1.0) / (0.5 + this.density());
        const [d, s] = near[Math.min(near.length - 1, Math.floor(Math.random() * Math.min(10, near.length)))];
        if (this.freezeT <= 0) SS.Audio.sfx('horn', { pan: this.pan(s.x), vol: U.clamp(1.1 / (1 + Math.pow(d / 320, 2)), 0.2, 1) * k, type: (s.id * 7) % 6, car: s.variant.kind === 'car' });
      }
    }

    /* ------------------------------------------------------------------ */
    /* Bánh bao guy                                                        */
    /* ------------------------------------------------------------------ */
    updateBanhBao(dt) {
      const p = this.player;
      if (!this.bb) {
        const ready = this.demo ? true : (p && p.x > this.level.banhbaoFirst);
        if (ready) this.bbTimer -= dt;
        if (ready && this.bbTimer <= 0 && !(this.inter && this.inter.active && this.level.tutorial)) {
          this.bbTimer = this.level.banhbaoEvery * U.rand(0.85, 1.2);
          const fromLeft = Math.random() < 0.5;
          const band = fromLeft ? G.LOWER_BAND : G.UPPER_BAND;
          const y = U.rand(band[0] + 10, band[1] - 10);
          const x = fromLeft ? this.cam.x - 900 : this.cam.x + this.viewW + 900; // far off-screen: you HEAR him first
          this.bb = this.spawnScooter({ x, y, ax: fromLeft ? 1 : -1, ay: 0, speed: 180 * this.level.speedMul, variant: this.bbVariant, isBB: true, skill: 0.35 });
          SS.Audio.bbStart();
          if (!this.demo) this.tutorial('banhbao');
        }
      }
      if (this.bb) {
        const b = this.bb;
        const lx = p ? p.x : this.cam.x + this.viewW / 2, ly = p ? p.y : 330;
        const d = Math.hypot(b.x - lx, (b.y - ly) * 1.5);
        const vol = 1 / (1 + Math.pow(d / 380, 2));
        SS.Audio.bbUpdate(this.pan(b.x), this.demo ? vol * 0.5 : vol);
        b.mouth = 0.5 + 0.5 * Math.abs(Math.sin(this.time * 7));
        if (Math.random() < dt * 0.8) b.bubble = { text: this.world.banhbaoWord + '!', t: 1.4 };
        if (b.grabT > 0) { b.grabT -= dt; b.desired = 60; if (b.grabT <= 0) b.desired = 180 * this.level.speedMul; }
      }
    }
    banhBaoGrab(s, along, lat) {
      const p = this.player;
      // the big yellow zone in front of his bike (drawn in render.js): stand in it as he arrives
      const inLane = Math.abs(lat) < 36;
      s.window = !s.grabbed && along > 28 && along < 200 && p.onRoad;
      if (inLane && s.window) {
        s.grabbed = true; s.grabT = 0.9; s.speed = Math.min(s.speed, 90);
        this.stats.banhbao++;
        this.addScore(250, S.popGrab, p.x, p.y - 90, '#ffd75a');
        const r = Math.random();
        if (r < 0.34) { this.freezeT = 4.5; SS.Audio.sfx('freeze'); this.popup(S.popFreeze, p.x, p.y - 112, '#9fe6ff', 1.6); }
        else if (r < 0.67 || p.lives >= C.LIVES) { p.cargo = 100; SS.Audio.sfx('powerup'); this.popup(S.popCargoSave, p.x, p.y - 112, '#b6f37a', 1.6); }
        else { p.lives = Math.min(C.LIVES + 1, p.lives + 1); SS.Audio.sfx('powerup'); this.popup(S.popExtraLife, p.x, p.y - 112, '#ff7a8a', 1.6); }
        for (let i = 0; i < 14; i++) this.particle('spark', p.x, p.y - 50, U.rand(-120, 120), U.rand(-140, 20), 0.8);
        this.particle('bun', s.x, s.y - 60, (p.x - s.x) * 2.5, (p.y - 60 - s.y + 60) * 2.5 - 60, 0.4);
        SS.Haptics.vibrate([20, 30, 20]);
        p.invuln = Math.max(p.invuln, 0.6);
      }
      s.wasInLane = inLane;
    }

    /* ------------------------------------------------------------------ */
    /* Player                                                              */
    /* ------------------------------------------------------------------ */
    updatePlayer(dt) {
      const p = this.player, In = SS.Input;
      if (this.scam) { this.scam.t -= dt; if (this.scam.t <= 0) this.scam = null; }
      p.invuln = Math.max(0, p.invuln - dt);
      p.bumpCD = Math.max(0, p.bumpCD - dt);
      p.nudgeCD = Math.max(0, p.nudgeCD - dt);
      p.sellerCD = Math.max(0, p.sellerCD - dt);
      p.boostT = Math.max(0, p.boostT - dt);
      if (p.tumble) { this.updateTumble(dt); return; }

      const canMove = this.state === 'play';
      let ax = canMove ? In.ax : 0, ay = canMove ? In.ay : 0;
      if (p.gassed > 0) { // dizzy: wobbly, sluggish controls
        p.gassed -= dt;
        const w = this.time * 3;
        ax += Math.sin(w) * 0.35; ay += Math.cos(w * 1.3) * 0.35;
        if (p.gassed <= 0) p.breath = Math.max(p.breath, 45);
      }
      p.sprinting = canMove && In.sprint && (Math.abs(ax) + Math.abs(ay) > 0.2) && p.gassed <= 0;
      p.holding = canMove && In.breath && p.breath > 0 && p.gassed <= 0;
      let max = WALK * (1 + 0.07 * SS.Save.up('sandals')) * (p.sprinting ? C.SPRINT_MUL : 1) * (p.boostT > 0 ? 1.3 : 1) * (p.gassed > 0 ? 0.6 : 1);
      // sellers hanging on to you
      const sl = p.latchedBy;
      if (sl) max *= sl.cfg.hold;
      const tvx = ax * max, tvy = ay * max * 0.9;
      const acc = C.PLAYER_ACCEL * (p.gassed > 0 ? 0.35 : 1) * (p.sprinting ? 1.4 : 1);
      // accelerate toward the target velocity (vector approach)
      const dvx = tvx - p.vx, dvy = tvy - p.vy, dl = Math.hypot(dvx, dvy), step = acc * dt;
      if (dl <= step) { p.vx = tvx; p.vy = tvy; } else { p.vx += dvx / dl * step; p.vy += dvy / dl * step; }

      // move with obstacle collision (slide along)
      const ox = p.x, oy = p.y;
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      const camL = this.cam.x + 18, camR = this.cam.x + this.viewW - 18;
      nx = U.clamp(nx, camL, Math.min(camR, this.W.length + 320));
      ny = U.clamp(ny, G.WALK_MIN, G.WALK_MAX);
      let blockedX = false, blockedY = false;
      if (this.collides(p.x, p.y)) {
        // already inside something (pushed by the screen edge, a knock-back or a ride drop):
        // never trap the player; let them walk out and ease them toward the road
        p.stuckT = (p.stuckT || 0) + dt;
        if (p.stuckT > 0.25) ny += (p.y < (G.ROAD_TOP + G.ROAD_BOT) / 2 ? 1 : -1) * 90 * dt;
        ny = U.clamp(ny, G.WALK_MIN, G.WALK_MAX);
      } else {
        p.stuckT = 0;
        if (this.collides(nx, p.y)) { nx = p.x; blockedX = true; }
        if (this.collides(nx, ny)) { ny = p.y; blockedY = true; }
      }
      p.x = nx; p.y = ny;
      if (blockedX) p.vx *= 0.2;
      if (blockedY) p.vy *= 0.2;
      const speed = Math.hypot(p.vx, p.vy);
      if ((blockedX || blockedY) && speed > WALK * 0.9 && p.bumpCD <= 0) {
        p.bumpCD = 0.8;
        SS.Audio.sfx('bump');
        this.spill(3, true);
        this.popup(S.popBump, p.x, p.y - 80, '#ffd0a0', 0.8);
        this.cam.shake = Math.max(this.cam.shake, 3);
        this.sunglassesHit();
      }
      const moved = Math.hypot(p.x - ox, p.y - oy);
      p.moved += moved;
      if (Math.abs(p.vx) > 6) p.face = p.vx > 0 ? 1 : -1;
      p.phase += moved * 0.12;

      // smoothed velocity (what "steady" means)
      const k = Math.min(1, dt / 0.35);
      p.svx += (p.vx - p.svx) * k; p.svy += (p.vy - p.svy) * k;

      const wasRoad = p.onRoad;
      p.onRoad = this.onRoadAt(p.x, p.y);
      p.roadT = p.onRoad ? (p.roadT || 0) + dt : 0;
      const side = p.y >= G.ROAD_BOT ? 'near' : p.y <= G.ROAD_TOP ? 'far' : 'road';
      this.trackCrossing(side, wasRoad);
      if (p.onRoad && !wasRoad) this.tutorial('steady');

      this.updateConfidence(dt, speed);
      this.updateCargo(dt, speed);
      this.updateBreath(dt);

      // coins
      for (const c of this.W.coins) {
        if (c.taken || Math.abs(c.x - p.x) > 26) continue;
        if (Math.abs(c.y - p.y) < 22) {
          c.taken = true; this.coins++; this.stats.coins++;
          this.addScore(10, null);
          SS.Audio.sfx('coin', { pan: this.pan(c.x) });
          for (let i = 0; i < 6; i++) this.particle('spark', c.x, c.y - 14, U.rand(-70, 70), U.rand(-90, 10), 0.5);
          this.popup('+1', c.x, c.y - 30, '#ffd75a', 0.6, 15);
        }
      }
      // steam off hot food, frosty sparkle off iced drinks (fades as the order cools / melts)
      const o = this.order;
      if (o && o.state === 'carrying' && o.heat > 5) {
        const k = o.heat / 100;
        if (o.food.temp !== 'cold' && Math.random() < dt * 7 * k * SS.Main.quality) this.particle('steam', p.x + p.face * 15, p.y - 60, U.rand(-6, 6) + p.vx * 0.3, -U.rand(14, 26), 1.2);
        if (o.food.temp === 'cold' && Math.random() < dt * 5 * k * SS.Main.quality) this.particle('frost', p.x + p.face * 15 + U.rand(-6, 6), p.y - 62, U.rand(-10, 10), -U.rand(4, 14), 0.8);
      }
    }

    collides(x, y) {
      const r = 8;
      for (const o of this.W.obstacles) {
        if (x + r < o.x - o.w / 2 || x - r > o.x + o.w / 2) continue;
        if (y + 2 < o.y - o.d || y - 4 > o.y) continue;
        return true;
      }
      return false;
    }

    updateConfidence(dt, speed) {
      const p = this.player;
      const ref = WALK * (1 + 0.07 * SS.Save.up('sandals')) * (p.boostT > 0 ? 1.3 : 1);
      const sv = Math.hypot(p.svx, p.svy);
      let delta = 0, why = null;
      if (p.onRoad) {
        if (p.sprinting && speed > ref * 1.15) { delta = -40; why = 'sprint'; }
        else if (speed < ref * 0.22) {
          p.still += dt;
          if (p.still > 0.12) { delta = -42; why = 'stop'; }
          if (p.still > 0.12 && p.still - dt <= 0.12) p.conf -= 6; // riders see you freeze
        } else {
          p.still = 0;
          const cos = sv > 5 ? (p.vx * p.svx + p.vy * p.svy) / (speed * sv) : 1;
          const jerk = Math.abs(speed - sv) / ref;
          if (cos < -0.1) { delta = -70; why = 'reverse'; if (p.confWhy !== 'reverse') p.conf -= 10; }
          else if (cos < 0.82) { delta = -26; why = 'turn'; }
          else if (jerk > 0.3) { delta = -20; why = 'jerk'; }
          else {
            const cross = Math.abs(p.vy) / Math.max(1, speed);
            const pace = 1 - Math.min(1, Math.abs(speed - ref * 0.9) / ref); // ideal: a calm walk
            delta = (8 + 10 * cross) * (0.5 + pace) * (1 + 0.25 * SS.Save.up('whisper'));
            // strolling down the middle of the road for ages gets in everyone's way
            if (p.roadT > 6 && cross < 0.5 && !(this.inter && this.inter.active)) { delta = -7; why = 'linger'; }
          }
        }
        if (p.latchedBy) delta = Math.min(delta, -8);
      } else {
        p.still = 0;
        // on the footpath confidence settles towards a calm baseline
        if (p.conf < 55) delta = 9; else if (p.conf > 70) delta = -2;
      }
      p.conf = U.clamp(p.conf + delta * dt, 0, 100);
      p.confWhy = why;
      if (p.onRoad && p.conf < 28 && this.lowConfMsgT <= 0) {
        this.lowConfMsgT = 6;
        this.popup(S.popConfidenceLow, p.x, p.y - 100, '#ff8a6a', 1.4, 17);
        this.tutorial('drain');
      }
      this.lowConfMsgT -= dt;
      if (p.onRoad && why && p.conf < 45) this.tutorial('drain');
    }

    spill(amount, slosh) {
      const p = this.player;
      if (!this.order || this.order.state !== 'carrying') return;
      const a = amount * this.cargoDef.sensitivity;
      p.cargo = Math.max(0, p.cargo - a);
      if (slosh) {
        SS.Audio.sfx('slosh', { kind: this.cargoDef.carry === 'pho' || this.cargoDef.carry === 'cup' ? 'pho' : 'box', vol: U.clamp(a / 5, 0.4, 1.2) });
        const col = this.cargoDef.carry === 'pho' ? '#c9873a' : this.cargoDef.carry === 'cup' ? (this.cargoDef.cup || '#6a3e22') : '#e8c79a';
        for (let i = 0; i < Math.min(8, 2 + a); i++) this.particle('splash', p.x + p.face * 16, p.y - 44, U.rand(-60, 60) + p.vx * 0.4, U.rand(-80, -20), 0.6, 0, col);
      }
      if (p.cargo < 80 && !this.tut.shown.cargo) this.tutorial('cargo');
    }

    updateCargo(dt, speed) {
      const p = this.player;
      if (!this.order || this.order.state !== 'carrying') { p.carryTilt = 0; return; }
      // sudden changes in velocity slosh the cargo
      const dv = Math.hypot(p.vx - p.svx, p.vy - p.svy);
      let rate = Math.max(0, dv - 70) * 0.045;
      if (p.sprinting && speed > WALK) rate += 2.2;
      if (rate > 0) {
        p.spillAcc += rate * dt * this.cargoDef.sensitivity;
        p.cargo = Math.max(0, p.cargo - rate * dt * this.cargoDef.sensitivity);
        if (p.spillAcc > 1.2) { p.spillAcc = 0; this.spill(0, true); }
      }
      p.carryTilt = U.clamp((p.vx - p.svx) * -0.004 * p.face, -0.4, 0.4);
      if (p.cargo <= 0 && this.state === 'play') this.failOrder();
    }

    updateBreath(dt) {
      const p = this.player;
      if (this.hurtPulse > 0) this.hurtPulse = Math.max(0, this.hurtPulse - dt * 1.4);
      if (this.stinkHintCD > 0) this.stinkHintCD -= dt;
      if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
      let inCloud = 0;
      for (const c of this.clouds) {
        const dx = p.x - c.x, dy = (p.y - 30 - c.y) * 1.3;
        if (dx * dx + dy * dy < (c.r * 0.85) * (c.r * 0.85)) inCloud = Math.max(inCloud, c.alpha);
      }
      p.inCloud = inCloud;
      // breathing the stink (not holding your breath): cough, lose confidence, spill, and after a while lose a heart
      if (inCloud > 0.1 && !p.holding && !p.tumble) {
        p.breathCough -= dt;
        if (p.breathCough <= 0) {
          p.breathCough = 0.75;
          SS.Audio.sfx('cough');
          SS.Haptics.vibrate(25);
          this.popup(U.pick(S.coughs), p.x + p.face * 18, p.y - 92, '#c6e65a', 0.8, 16);
          for (let k = 0; k < 3; k++) this.particle('puff', p.x + p.face * 10, p.y - 62, p.face * U.rand(20, 50), U.rand(-25, 5), 0.7, 0, '#9aaa2a');
        }
        p.conf = Math.max(0, p.conf - 9 * inCloud * dt);
        this.spill(1.6 * inCloud * dt, false);
        p.stinkT = (p.stinkT || 0) + dt * inCloud;
        this.hurtPulse = Math.min(1, (this.hurtPulse || 0) + dt * 3);
        if ((this.stinkHintCD || 0) <= 0) { this.stinkHintCD = 6; this.hint = { text: S.stinkHint, t: 2.6 }; }
        if (p.stinkT >= 2.4 && p.invuln <= 0) {
          p.stinkT = 0; p.lives--; this.stats.hits++; p.invuln = 1.6; this.cam.shake = 8; this.flash = 0.3;
          this.popup(S.popStinkHit, p.x, p.y - 112, '#ff6a5a', 1.4, 22);
          SS.Audio.sfx('tumble'); SS.Haptics.vibrate([60, 40, 90]);
          if (p.lives <= 0) this.lose('lives');
        }
      } else p.stinkT = Math.max(0, (p.stinkT || 0) - dt);
      if (p.gassed > 0) { p.breath = Math.min(100, p.breath + 10 * dt); return; }
      const lungs = 1 - 0.25 * SS.Save.up('lungs');
      if (p.holding) p.breath -= 15 * lungs * dt;
      else if (inCloud > 0.1) p.breath -= 42 * inCloud * lungs * dt;
      else p.breath = Math.min(100, p.breath + 24 * dt);
      if (p.breath <= 0) {
        p.breath = 0; p.gassed = 3.8; p.holding = false;
        SS.Audio.sfx('cough');
        this.popup(S.popGassed, p.x, p.y - 96, '#c6e65a', 1.5, 18);
        p.conf = Math.max(0, p.conf - 15);
        this.spill(3, true);
        SS.Haptics.vibrate([30, 60, 30]);
      }
      if (inCloud > 0.1) this.tutorial('durian');
    }

    trackCrossing(side, wasRoad) {
      const p = this.player;
      if (side === 'road' && !this.crossing) this.crossing = { from: p.lastSide || 'near', confSum: 0, t: 0, hits: this.stats.hits };
      if (this.crossing) { this.crossing.confSum += p.conf; this.crossing.t++; }
      if (side !== 'road' && this.crossing) {
        const cr = this.crossing; this.crossing = null;
        if (cr.from !== side && cr.t > 30) {
          const avg = cr.confSum / cr.t;
          if (avg >= 60 && cr.hits === this.stats.hits) {
            this.stats.crossings++;
            const perfect = avg >= 80;
            this.addScore(Math.round(avg * (perfect ? 4 : 2.5)), perfect ? S.popPerfect : S.popSmooth, p.x, p.y - 96, perfect ? '#7ff0d8' : '#b6f37a');
          }
        }
      }
      if (side !== 'road') p.lastSide = side;
    }

    playerHit(s) {
      const p = this.player;
      if (SS.Save.up('charm') && !this.charmUsed) { // the lucky charm takes the first hit of the shift
        this.charmUsed = true; p.invuln = 2; s.speed *= 0.3; this.shout(s);
        this.popup(S.luckyCharm, p.x, p.y - 100, '#ffd75a', 1.6, 22);
        SS.Audio.sfx('powerup'); this.cam.shake = 6;
        for (let i = 0; i < 12; i++) this.particle('spark', p.x, p.y - 50, U.rand(-120, 120), U.rand(-140, 20), 0.8);
        return;
      }
      p.lives--;
      this.stats.hits++;
      p.invuln = 2.6;
      p.conf = 35;
      if (p.latchedBy) this.releaseSeller(p.latchedBy, 'leave');
      const dir = s.vertical ? (p.x > s.x ? 1 : -1) : s.ax;
      p.tumble = { t: 0, vx: s.vertical ? dir * 80 : s.ax * (100 + s.speed * 0.4), vy: s.vertical ? s.ay * 140 : U.rand(-40, 40), z: 0, vz: 260, rot: 0, vr: dir * 9, landed: false };
      this.spill(18, true);
      this.cam.shake = 16;
      this.flash = 0.5;
      SS.Audio.sfx('crash', { pan: this.pan(p.x) });
      SS.Audio.sfx('tumble');
      SS.Audio.sfx('horn', { pan: this.pan(s.x), type: 1 });
      SS.Haptics.vibrate([70, 40, 110]);
      this.shout(s);
      s.speed *= 0.35; s.panic = 0.4; s.panicLat = U.rand(-60, 60);
      this.popup(S.popOuch, p.x, p.y - 100, '#ff6a5a', 1.2, 22);
      for (let i = 0; i < 12; i++) this.particle('dust', p.x, p.y - 4, U.rand(-90, 90), U.rand(-40, 20), 0.8);
      for (let i = 0; i < 8; i++) this.particle('star', p.x, p.y - 60, U.rand(-80, 80), U.rand(-120, -20), 0.9);
      this.sunglassesHit();
    }

    updateTumble(dt) {
      const p = this.player, T = p.tumble;
      T.t += dt;
      if (!T.landed) {
        T.vz -= 900 * dt; T.z += T.vz * dt; T.rot += T.vr * dt;
        if (T.z <= 0) {
          T.z = 0;
          if (T.vz < -150) { T.vz = -T.vz * 0.35; SS.Audio.sfx('thud', { vol: 0.5 }); for (let i = 0; i < 5; i++) this.particle('dust', p.x, p.y, U.rand(-50, 50), U.rand(-20, 10), 0.6); }
          else { T.landed = true; T.landT = T.t; T.rot = Math.PI / 2 * Math.sign(T.vr); }
        }
      }
      const fr = T.landed ? 6 : 0.5;
      T.vx *= Math.exp(-fr * dt); T.vy *= Math.exp(-fr * dt);
      p.x = U.clamp(p.x + T.vx * dt, this.cam.x + 18, this.cam.x + this.viewW - 18);
      p.y = U.clamp(p.y + T.vy * dt, G.WALK_MIN, G.WALK_MAX);
      p.vx = p.vy = p.svx = p.svy = 0;
      if (T.landed && T.t - T.landT > 0.55) {
        p.tumble = null;
        if (p.lives <= 0) this.lose('lives');
      }
    }

    sunglassesHit() {
      const p = this.player;
      if (p.sunglasses > 0) {
        p.sunglasses--;
        if (p.sunglasses === 0) {
          this.popup(S.popSunglassesBroke, p.x, p.y - 120, '#cccccc', 1.3);
          for (let i = 0; i < 6; i++) this.particle('shard', p.x + 6 * p.face, p.y - 62, U.rand(-60, 60), U.rand(-80, 0), 0.8);
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Sellers                                                             */
    /* ------------------------------------------------------------------ */
    updateSellers(dt) {
      const p = this.player;
      const pal = this.world.palette;
      // spawn on triggers
      for (const tr of this.W.sellerTriggers) {
        if (tr.fired || p.x < tr.x - this.viewW * 0.35) continue;
        tr.fired = true;
        if (this.inter && this.inter.active) continue;
        const cfg = SS.SELLERS[tr.type];
        const farSide = p.y < G.ROAD_TOP;
        const lane = farSide ? 206 : U.rand(470, 515);
        let x;
        if (cfg.behaviour === 'chase') x = this.cam.x - 30;
        else if (cfg.behaviour === 'follow') x = this.cam.x + this.viewW + 30;
        else x = p.x + U.rand(300, 380);
        // don't spawn inside an obstacle; shoe cleaner needs a free spot
        let tries = 0;
        while (this.collides(x, lane) && tries < 12) { x += 30; tries++; }
        this.sellers.push({
          type: tr.type, cfg, x, y: lane, side: farSide ? 'far' : 'near', state: cfg.behaviour === 'pop' ? 'lurk' : cfg.behaviour === 'grab' ? 'wait' : 'approach',
          t: 0, active: 0, phase: Math.random() * 6, face: -1, bubble: null, bubbleT: 0, lineI: 0, escape: 0,
          engaged: false, latchedEver: false, jacketOpen: 0, finishT: 0, lastAx: 0,
          look: {
            skin: U.pick(pal.skin),
            shirt: { sunglasses: '#d8402e', fruit: '#8fc6e0', watch: '#f0ead8', shoe: '#5a7a9a', ride: '#2f9e4f' }[tr.type],
            pants: tr.type === 'fruit' ? '#1e1e24' : U.pick(['#3a3f4a', '#5a4a3a', '#2c3e5a']),
          },
        });
      }
      for (let i = this.sellers.length - 1; i >= 0; i--) {
        const s = this.sellers[i];
        s.t += dt; s.phase += dt * 8;
        const cfg = s.cfg;
        const dx = p.x - s.x, dy = p.y - s.y, dist = Math.hypot(dx, dy * 1.5);
        let mvx = 0, mvy = 0, spd = cfg.speed;
        const laneMin = s.side === 'far' ? 192 : 448, laneMax = s.side === 'far' ? 220 : 528;
        const pOnMyPath = s.side === 'far' ? p.y < G.ROAD_TOP : p.y > G.ROAD_BOT;
        if (s.bubbleT > 0) { s.bubbleT -= dt; if (s.bubbleT <= 0) s.bubble = null; }

        if (s.state === 'lurk') { // sunglasses guy waits behind the bikes, then pops out
          if (dist < 230 && dx < 40) { s.state = 'approach'; s.t = 0; this.say(s); this.particle('dust', s.x, s.y, 0, -20, 0.5); }
        } else if (s.state === 'wait') { // shoe cleaner sits and waits for feet
          s.face = dx > 0 ? 1 : -1;
          if (dist < 160 && !s.engaged) { s.engaged = true; this.say(s); this.tutorial('seller'); }
          if (dist < 30 && pOnMyPath && p.sellerCD <= 0 && !p.latchedBy && !p.tumble) this.latch(s);
          if (dx > 220 && s.engaged) this.sellerGiveUp(s, i);
        } else if (s.state === 'approach') {
          s.active += dt;
          // head for where the player is going (intercept) but stay on the footpath
          let tx = p.x + p.vx * (cfg.behaviour === 'pop' ? 0.6 : 0.25), ty = U.clamp(p.y, laneMin, laneMax);
          if (!pOnMyPath) ty = s.side === 'far' ? laneMax : laneMin; // wait at the kerb
          const ddx = tx - s.x, ddy = ty - s.y, dd = Math.hypot(ddx, ddy);
          if (dd > 2) { mvx = ddx / dd; mvy = ddy / dd; }
          if (dist < 180) { if (!s.engaged) { s.engaged = true; this.tutorial('seller'); } }
          if (s.engaged && (s.bubbleT <= 0) && Math.random() < dt * 0.9) this.say(s);
          if (dist < 24 && pOnMyPath && p.sellerCD <= 0 && !p.latchedBy && !p.tumble) this.latch(s);
          // give up after a while (or if left far behind)
          if (s.active > cfg.giveUp || (dx > 520) || (dx < -this.viewW)) this.sellerGiveUp(s, i);
        } else if (s.state === 'latched') {
          s.active += dt;
          // stick to the player's side
          const off = s.type === 'shoe' ? 14 : 20;
          s.x += ((p.x + (s.type === 'shoe' ? off : -off * p.face * -1)) - s.x) * Math.min(1, dt * 10);
          s.y += (U.clamp(p.y + 2, laneMin, laneMax) - s.y) * Math.min(1, dt * 10);
          s.face = p.x > s.x ? 1 : -1;
          if (s.bubbleT <= 0) this.say(s);
          if (s.type === 'watch') s.jacketOpen = Math.min(1, s.jacketOpen + dt * 3);
          // shoe cleaner: shake the joystick to break free, or let him finish
          if (s.type === 'shoe') {
            const ax = SS.Input.ax;
            if (Math.abs(ax) > 0.5 && Math.sign(ax) !== Math.sign(s.lastAx || 0)) { s.lastAx = ax; s.escape += 0.5; }
            s.finishT += dt;
            if (s.finishT >= cfg.finish) { this.shoeFinish(s); }
          }
          if (s.escape >= cfg.escape) this.escapeSeller(s);
          s.escape = Math.max(0, s.escape - dt * 0.7);
        } else if (s.state === 'leave') {
          mvx = s.leaveDir; mvy = 0; spd = 90;
          if (s.t > 4) { this.sellers.splice(i, 1); continue; }
        }
        s.x += mvx * spd * dt; s.y += mvy * spd * dt;
        if (mvx) s.face = mvx > 0 ? 1 : -1;
        s.moving = Math.min(1, Math.hypot(mvx, mvy));
        s.y = U.clamp(s.y, laneMin, laneMax);
        if (s.state !== 'latched' && s.type === 'watch') s.jacketOpen = Math.max(0, s.jacketOpen - dt * 2);
      }
      // NO THANKS / BUY
      const In = SS.Input;
      const target = p.latchedBy || this.nearSeller();
      if (In.noThanks && p.latchedBy) {
        const s = p.latchedBy;
        s.escape += 1;
        SS.Audio.sfx('nothanks');
        s.shake = 0.15;
        SS.Haptics.vibrate(10);
      }
      if (In.buy && target) this.buyFrom(target);
    }

    nearSeller() {
      const p = this.player;
      for (const s of this.sellers) if ((s.state === 'approach' || s.state === 'wait') && s.engaged && Math.hypot(p.x - s.x, (p.y - s.y) * 1.5) < 70) return s;
      return null;
    }

    say(s) {
      const lines = s.cfg.lines;
      s.bubble = lines[s.lineI % lines.length]; s.lineI++;
      s.bubbleT = 1.9;
      SS.Audio.sfx('seller', { pan: this.pan(s.x), pitch: { sunglasses: 200, fruit: 290, watch: 170, shoe: 230, ride: 190 }[s.type], syllables: { ride: [1, 1.2, 1.1, 1, 1.2, 1.1], watch: [1, 1.25, 1, 1.25], fruit: [1.2, 1, 1.1], sunglasses: [1, 1.15, 1.3, 1.3], shoe: [1.1, 1, 1.2] }[s.type] });
    }

    latch(s) {
      const p = this.player;
      s.state = 'latched'; s.latchedEver = true; s.escape = 0; s.active = 0;
      p.latchedBy = s;
      this.say(s);
      this.spill(2.5, true);
      SS.Haptics.vibrate(25);
      if (s.type === 'shoe') { p.vx = p.vy = 0; }
      this.tutorial('seller');
    }
    releaseSeller(s, how) {
      const p = this.player;
      if (p.latchedBy === s) p.latchedBy = null;
      s.state = 'leave'; s.t = 0;
      s.leaveDir = p.x > s.x ? -1 : 1;
      p.sellerCD = 1.5;
    }
    escapeSeller(s) {
      const p = this.player;
      this.releaseSeller(s);
      s.bubble = U.pick(S.sellerBye); s.bubbleT = 1.6;
      this.stats.sellers++;
      this.addScore(40, S.popEscaped, p.x, p.y - 96, '#ffe08a');
    }
    sellerGiveUp(s) {
      const p = this.player;
      if (s.engaged && !s.latchedEver) {
        this.stats.sellers++;
        this.addScore(75, S.popDodged, p.x, p.y - 96, '#ffe08a');
      }
      s.state = 'leave'; s.t = 0; s.leaveDir = s.x < p.x ? -1 : 1;
      s.bubble = U.pick(S.sellerBye); s.bubbleT = 1.4;
    }
    shoeFinish(s) {
      const p = this.player;
      const price = s.cfg.price;
      if (this.coins >= price) this.coins -= price;
      p.boostT = 8;
      s.bubble = S.sellerShoeDone; s.bubbleT = 1.8;
      this.releaseSeller(s);
      SS.Audio.sfx('powerup');
      this.popup(S.popBoost, p.x, p.y - 100, '#9fe6ff', 1.5);
    }
    buyFrom(s) {
      const p = this.player;
      const price = s.cfg.price;
      if (this.coins < price) { this.popup(S.popNoCoins, p.x, p.y - 100, '#ff9a8a', 1.1); SS.Audio.sfx('nothanks'); return; }
      this.coins -= price;
      SS.Audio.sfx('buy');
      SS.Haptics.vibrate([15, 30, 15]);
      if (p.latchedBy === s) p.latchedBy = null;
      this.releaseSeller(s);
      s.bubble = S.sellerThanks; s.bubbleT = 1.6;
      this.popup(S.popBought, s.x, s.y - 100, '#b6f37a', 1);
      if (s.type === 'sunglasses') { p.sunglasses = 3; this.popup(S.popSunglasses, p.x, p.y - 124, '#ffffff', 1.5); }
      else if (s.type === 'fruit') { p.breath = 100; if (p.lives < C.LIVES) p.lives++; this.popup(S.popFruit, p.x, p.y - 124, '#b6f37a', 1.5); }
      else if (s.type === 'watch') { this.slowT = 10; this.slowOn = true; this.slowGlitchT = U.rand(1, 2.5); this.popup(S.popSlowmo, p.x, p.y - 124, '#ffd75a', 1.5); }
      else if (s.type === 'shoe') { p.boostT = 8; this.popup(S.popBoost, p.x, p.y - 124, '#9fe6ff', 1.5); }
      else if (s.type === 'ride') {
        // it's a scam: the fake driver charges you double (the ride still happens)
        // the second charge lands when you arrive (see updateRide)
        this.pendingScam = price;
        this.startRide();
      }
      SS.Audio.sfx('powerup');
    }

    // The fake driver gives you a (wild) lift down the street: fade out, skip ahead, fade in.
    startRide() {
      // the driver takes you to wherever your current order needs you: the shop, or the customer
      const p = this.player, o = this.order;
      let tx = p.x + 700, ty = 480;
      if (o && o.state === 'waiting') { tx = o.vendor.x; ty = o.vendor.y; }
      else if (o && o.state === 'carrying') { tx = o.drop.x; ty = o.drop.y; }
      const dir = tx >= p.x ? 1 : -1;
      const to = Math.abs(tx - p.x) > 2600 ? p.x + dir * 2600 : tx - dir * 70; // drop you just short of it
      this.ride = { t: 0, to, toY: ty, moved: false };
      p.vx = p.vy = 0;
      SS.Audio.sfx('whoosh', { dir: 1, vol: 1 }); SS.Audio.sfx('horn', { type: 2 });
    }
    updateRide(dt) {
      const R = this.ride, p = this.player;
      R.t += dt;
      if (Math.random() < dt * 4) SS.Audio.sfx('horn', { type: U.randi(0, 5), vol: 0.6 });
      if (R.t >= 0.6 && !R.moved) {
        R.moved = true;
        const far = R.toY < G.ROAD_TOP;
        const spot = this.freeSpot(R.to, far ? 'far' : 'near');
        p.x = spot.x; p.y = spot.y; p.svx = p.svy = 0;
        // any intersection you rode through counts as crossed
        for (const I of this.W.intersections) if (!I.done && I.x < p.x) { I.done = true; I.active = false; }
        if (this.inter && this.inter.done) this.inter = null;
        this.cam.x = p.x - this.viewW * 0.38;
        this.prefillTraffic();
        p.invuln = Math.max(p.invuln, 1.5);
        this.spill(6, true); // he drives like a maniac
        this.popup(S.popRide, p.x, p.y - 100, '#7fc96b', 1.6, 20);
      }
      if (R.t >= 1.2) {
        this.ride = null;
        if (this.pendingScam) { // on arrival the fake driver demands the same again
          const price = this.pendingScam, extra = Math.min(this.coins, price);
          this.pendingScam = 0; this.coins -= extra;
          this.scam = { t: 3.6, n: price + extra };
          SS.Audio.sfx('glitch'); SS.Audio.sfx('nothanks');
          SS.Haptics.vibrate([40, 60, 40, 60, 80]);
          this.cam.shake = Math.max(this.cam.shake, 6);
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Durian clouds                                                       */
    /* ------------------------------------------------------------------ */
    updateClouds(dt) {
      const vw = this.viewW, cx = this.cam.x;
      for (const st of this.W.durians) {
        if (st.x < cx - 250 || st.x > cx + vw + 250) continue;
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = U.rand(4.5, 7.5) / (0.6 + this.level.density * 0.5);
          const c = {
            x: st.x + U.rand(-20, 20), y: st.near ? st.y - 50 : st.y - 10, r: 30, rMax: U.rand(125, 165),
            vx: U.rand(-16, 16), vy: st.near ? -U.rand(14, 24) : U.rand(14, 24), life: 0, max: U.rand(13, 16), alpha: 0,
            puffs: [],
          };
          const n = SS.Main.quality > 0.6 ? 14 : 7;
          for (let k = 0; k < n; k++) c.puffs.push({ a: Math.random() * 6.28, d: Math.random() * 0.6, s: U.rand(0.5, 0.9), sp: U.rand(-0.6, 0.6) });
          this.clouds.push(c);
          SS.Audio.sfx('gas', { pan: this.pan(c.x), vol: U.clamp(1 - Math.abs(this.pan(c.x)) * 0.6, 0.3, 1) });
        }
      }
      const ts = this.slowT > 0 && this.slowOn ? 0.5 : 1;
      for (let i = this.clouds.length - 1; i >= 0; i--) {
        const c = this.clouds[i];
        c.life += dt * ts;
        c.r = U.lerp(c.r, c.rMax, Math.min(1, dt * 0.6));
        // the stink creeps toward you
        const pl = this.player;
        if (pl && Math.abs(pl.x - c.x) < 420) c.vx = U.lerp(c.vx, Math.sign(pl.x - c.x) * 22, dt * 0.4);
        c.x += c.vx * dt * ts; c.y += c.vy * dt * ts;
        c.y = U.clamp(c.y, G.FACADE_BOT - 20, G.VIEW_H - 40);
        c.alpha = Math.min(1, c.life / 0.8) * Math.min(1, (c.max - c.life) / 2.5);
        if (c.life >= c.max) this.clouds.splice(i, 1);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Intersections                                                       */
    /* ------------------------------------------------------------------ */
    updateIntersections(dt) {
      const p = this.player;
      const vw = this.viewW;
      if (!this.inter) {
        for (const I of this.W.intersections) {
          if (I.done || p.x < I.x - vw * 0.3) continue;
          I.active = true; this.inter = I;
          I.goal = p.y < G.ROAD_TOP ? 'near' : 'far';
          I.confSum = 0; I.n = 0; I.hits = this.stats.hits;
          I.lockX = Math.min(I.x - vw / 2, I.x - 150 - 20); // keep the player on screen
          I.lockX = I.x - vw / 2;
          this.banner = { text: S.crossNow, sub: S.crossHint, t: 3.2 };
          this.tutorial('intersection');
          SS.Audio.sfx('horn', { type: 2 });
          break;
        }
      }
      const I = this.inter;
      if (I) {
        if (p.onRoad) { I.confSum += p.conf; I.n++; }
        // Two ways through: cross the main road to the other footpath, OR carry straight on
        // across the side street to the footpath beyond it. A timeout makes sure nobody is ever stuck.
        I.t = (I.t || 0) + dt;
        const acrossRoad = I.goal === 'far' ? p.y < G.ROAD_TOP - 2 : p.y > G.ROAD_BOT + 4;
        const pastIt = p.x > I.x + G.CROSS_HALF + 24; // walked on past the side street (footpath OR road)
        const done = acrossRoad || pastIt || I.t > 30;
        if (done && !p.tumble) {
          I.done = true; I.active = false; this.inter = null;
          const avg = I.n ? I.confSum / I.n : 50;
          const clean = I.hits === this.stats.hits;
          const perfect = clean && avg >= 75;
          const pts = Math.round(300 + avg * 4 + (perfect ? 250 : 0));
          this.addScore(pts, perfect ? S.popPerfect : S.popSmooth, p.x, p.y - 110, perfect ? '#7ff0d8' : '#b6f37a', 26);
          if (clean) this.stats.crossings++;
          SS.Audio.sfx('powerup');
          this.banner = null;
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Tutorial (level 1)                                                  */
    /* ------------------------------------------------------------------ */
    tutorial(id) {
      if (!this.level.tutorial || this.demo || this.tut.shown[id]) return;
      this.tut.shown[id] = true;
      let text = S.tut[id];
      if (id === 'move' && !SS.Input.touchMode) text = S.tut.moveDesktop;
      this.tut.queue.push({ id, text });
    }
    updateTutorial(dt) {
      const T = this.tut;
      if (!this.level.tutorial) return;
      const p = this.player;
      if (T.cur) { T.t -= dt; if (T.t <= 0 || (T.cur.id === 'move' && p.moved > 160)) T.cur = null; }
      if (!T.cur && T.queue.length) { T.cur = T.queue.shift(); T.t = T.cur.id === 'move' ? 8 : 6; }
      // position-based triggers
      if (this.state === 'play') { this.tutorial('move'); this.tutorial('pickup'); }
      const firstBlock = this.W.obstacles.find((o) => o.y > 480 && o.x > 300 && o.kind !== 'pole');
      if (firstBlock && p.x > firstBlock.x - firstBlock.w / 2 - 260) this.tutorial('blocked');
      const firstDurian = this.W.durians[0];
      if (firstDurian && p.x > firstDurian.x - this.viewW * 0.6) this.tutorial('durian');
    }

    /* ------------------------------------------------------------------ */
    /* Particles & popups                                                  */
    /* ------------------------------------------------------------------ */
    particle(type, x, y, vx, vy, life, vz, color) {
      const max = SS.Main.quality > 0.6 ? 320 : 110;
      if (this.particles.length >= max) return;
      const p = this.pPool.pop() || {};
      p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.vz = vz || 0; p.z = 0;
      p.life = life; p.max = life; p.color = color || null;
      p.rot = Math.random() * 6; p.vr = U.rand(-6, 6); p.size = U.rand(0.7, 1.3);
      this.particles.push(p);
    }
    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) { this.particles.splice(i, 1); this.pPool.push(p); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.type === 'splash' || p.type === 'star' || p.type === 'shard' || p.type === 'spark') p.vy += 260 * dt;
        if (p.type === 'feather' || p.type === 'petal') { p.vx *= 0.98; p.vy = p.vy * 0.97 + 18 * dt; }
        if (p.type === 'dust' || p.type === 'steam' || p.type === 'puff') { p.vx *= 0.97; p.vy *= 0.97; }
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const q = this.popups[i];
        q.t += dt; q.y -= 26 * dt;
        if (q.t >= q.life) this.popups.splice(i, 1);
      }
    }
    popup(text, x, y, color, life, size) {
      if (this.demo) return;
      this.popups.push({ text, x, y, color: color || '#fff', life: life || 1, t: 0, size: Math.min(size || 15, 20) });
    }
    addScore(n, text, x, y, color, size) {
      if (this.demo) return;
      this.score += n;
      if (text) this.popup(text + '  +' + n, x, y, color, 1.3, size);
    }

    /* ------------------------------------------------------------------ */
    /* Main update                                                         */
    /* ------------------------------------------------------------------ */
    update(dt) {
      this.time += dt;
      this.stateT += dt;
      const In = SS.Input;
      const vw = this.viewW;

      if (this.demo) {
        this.cam.x += 55 * dt;
        if (this.cam.x > this.W.length - vw - 200) this.cam.x = 600;
        this.updateLights(dt);
        this.manageTraffic(dt);
        this.updateScooters(dt);
        this.updateBanhBao(dt);
        this.updateClouds(dt);
        this.updateParticles(dt);
        this.audioTick(dt);
        SS.Audio.setAmbience(this.level.density * 0.7, true);
        return;
      }

      const p = this.player;
      if (this.state === 'intro' && this.stateT > 2.4) { this.state = 'play'; this.stateT = 0; }

      // power-up timers
      if (this.freezeT > 0) this.freezeT -= dt;
      if (this.slowT > 0) {
        this.slowT -= dt;
        this.slowGlitchT -= dt;
        if (this.slowGlitchT <= 0) {
          this.slowOn = !this.slowOn;
          this.slowGlitchT = this.slowOn ? U.rand(0.8, 2.2) : U.rand(0.25, 0.7);
          if (!this.slowOn) SS.Audio.sfx('glitch');
        }
        if (this.slowT <= 0) this.slowOn = true;
      }
      this.glare = Math.max(0, this.glare - dt * 2);
      if (this.ratingFx) { this.ratingFx.t -= dt; if (this.ratingFx.t <= 0) this.ratingFx = null; }
      for (let i = this.customers.length - 1; i >= 0; i--) { const c = this.customers[i]; c.phase += dt * 6; if (c.bubbleT > 0) c.bubbleT -= dt; if (c.leaveT != null) { c.leaveT -= dt; c.x += c.leaveDir * 60 * dt; c.moving = 1; if (c.leaveT <= 0) this.customers.splice(i, 1); } }
      this.flash = Math.max(0, this.flash - dt * 2);
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }

      if (this.ride) this.updateRide(dt);
      else if (this.state === 'play' || this.state === 'intro') {
        this.updatePlayer(dt);
        if (this.state === 'play') {
          this.updateSellers(dt);
          this.updateIntersections(dt);
          this.updateOrders(dt);
          this.updateRain(dt);
        }
      } else if (this.state === 'won') {
        p.vx = p.vy = 0;
      } else if (this.state === 'lost') {
        if (p.tumble) this.updateTumble(dt);
      }
      this.updateCamera(dt);
      this.updateLights(dt);
      this.manageTraffic(dt);
      this.updateScooters(dt);
      this.updateBanhBao(dt);
      this.updateClouds(dt);
      this.updateParticles(dt);
      this.audioTick(dt);
      if (this.state !== 'won' && this.state !== 'lost') this.updateTutorial(dt);

      // audio mix: ambience scales with traffic, music reacts to danger
      SS.Audio.setAmbience(this.density(), true);
      SS.Audio.setIntensity(this.inter && this.inter.active ? 1 : p.onRoad ? 0.4 : 0);
      SS.Audio.setTension(p.onRoad ? U.clamp((45 - p.conf) / 35, 0, 1) * 0.8 + (this.tension || 0) * 0.3 : 0);

      if (this.state === 'won' && this.stateT > 1.8 && !this.finished) { this.finished = true; SS.UI.onLevelEnd(this, true); }
      if (this.state === 'lost' && this.stateT > 1.8 && !this.finished) { this.finished = true; SS.UI.onLevelEnd(this, false); }
      In.consumeEdges();
    }

    updateCamera(dt) {
      const vw = this.viewW, p = this.player;
      // dynamic zoom: close in when you slow down, pull back as you speed up
      const sp = Math.hypot(p.vx, p.vy);
      let zt = U.lerp(1.24, 1.05, U.clamp((sp - 10) / 85, 0, 1));
      if (p.sprinting) zt = 1.0;
      if (this.inter && this.inter.active) zt = Math.min(zt, 1.04);
      if (p.tumble) zt = 1.12;
      if (this.state === 'intro' || this.state === 'won' || this.state === 'lost') zt = 1.0;
      if (SS.Save.data.settings.zoom === false) zt = 1;
      this.zoom = U.approach(this.zoom || 1, zt, dt * (zt < (this.zoom || 1) ? 1.3 : 0.5));
      const maxX = this.W.length + 380 - vw;
      if (this.inter && this.inter.active) {
        this.cam.x += (this.inter.lockX - this.cam.x) * Math.min(1, dt * 3);
      } else {
        // follow both ways, so you can always walk back
        const lead = Math.abs(p.vx) > 10 ? (p.vx > 0 ? 0.38 : 0.62) : (this.camLead || 0.38);
        this.camLead = U.lerp(this.camLead || 0.38, lead, Math.min(1, dt * 1.5));
        const target = U.clamp(p.x - vw * this.camLead, -60, maxX);
        this.cam.x += (target - this.cam.x) * Math.min(1, dt * 4);
      }
      this.cam.shake = Math.max(0, this.cam.shake - dt * 30);
      const sh = this.cam.shake * (SS.Main.quality > 0.6 ? 1 : 0.6);
      this.cam.sx = (Math.random() - 0.5) * sh; this.cam.sy = (Math.random() - 0.5) * sh;
    }

    /* ------------------------------------------------------------------ */
    /* Delivery orders: pick up at a shop (yellow flag), deliver to a       */
    /* customer (green pin) before the food goes cold / the ice melts.      */
    /* ------------------------------------------------------------------ */
    nextOrder() {
      const lvl = this.level, W = this.W, p = this.player;
      if (this.orders.length >= lvl.orders) { this.order = null; return; }
      const idx = this.orders.length, remaining = lvl.orders - idx;
      const fromX = Math.max(p.x, idx === 0 ? 300 : p.x);
      const room = Math.max(1400, W.length - 450 - fromX);
      const leg = lvl.endless ? U.rand(1300, 2400) : U.clamp(room / remaining, 1100, 3400);
      // pick-up shop a little way ahead, converted to sell the food we need
      const prev = this.orders.length ? this.orders[this.orders.length - 1].food.id : null;
      const pool = lvl.foods.filter((f) => f !== prev);
      const food = SS.FOODS[U.pick(pool.length ? pool : lvl.foods)];
      const shop = this.pickShop(fromX + Math.max(380, leg * 0.3), food.shop, null);
      if (shop.word !== food.shop) this.convertShop(shop, food.shop);
      // drop-off further on: usually a customer on the near footpath (so you have to cross), sometimes another shop
      const dropX = shop.x + shop.w / 2 + Math.max(520, leg * 0.62);
      const pal = this.world.palette;
      const look = { skin: U.pick(pal.skin), shirt: U.pick(pal.shirts), pants: U.pick(['#3a3f4a', '#5a4a3a', '#2c3e5a', '#7a6a58']), hair: U.pick(['#231a14', '#3a2a1e', '#111']), hat: Math.random() < 0.25 ? 'cap' : null, hatColor: U.pick(pal.helmets) };
      let drop;
      if (Math.random() < 0.68) {
        const spot = this.freeSpot(dropX, 'near');
        drop = { kind: 'near', x: spot.x, y: spot.y };
      } else {
        const ds = this.pickShop(dropX, null, shop);
        const spot = this.freeSpot(ds.x + ds.w / 2, 'far', ds);
        drop = { kind: 'shop', shop: ds, x: spot.x, y: spot.y };
      }
      const cust = { x: drop.x, y: drop.y, look, phase: Math.random() * 6, bubble: null, bubbleT: 0, mood: 0, moving: 0, face: drop.x > shop.x ? -1 : 1 };
      this.customers.push(cust);
      // the shopkeeper waits outside the shop holding your order
      const vs = this.freeSpot(shop.x + shop.w / 2, 'far', shop);
      const vendor = { vendor: true, food, x: vs.x, y: vs.y, look: { skin: U.pick(pal.skin), shirt: U.pick(['#f4f1ea', '#e8e2d0', '#c84b3a']), pants: '#2f2f35', hair: '#1d1611', hat: Math.random() < 0.4 ? 'cone' : null },
        phase: Math.random() * 6, bubble: null, bubbleT: 0, mood: 1, moving: 0, face: 1 };
      this.customers.push(vendor);
      const o = { id: idx, food, shop, drop, cust, vendor, state: 'waiting', heat: 100, dist: 0 };
      this.orders.push(o); this.order = o;
      if (!lvl.endless && remaining === 1) this.tutorial('deliver');
    }
    pickShop(x, word, exclude) {
      let best = null, bd = 1e9;
      for (const sh of this.W.shops) {
        if (sh === exclude || sh.isDest) continue;
        const c = sh.x + sh.w / 2;
        if (c < x - 250 || c > this.W.length - 250) continue;
        let d = Math.abs(c - x);
        if (word && sh.word === word) d -= 260; // prefer a shop that already sells it
        if (this.orders.some((o) => o.state !== 'done' && o.state !== 'failed' && (o.shop === sh || o.drop.shop === sh))) d += 2000;
        if (d < bd) { bd = d; best = sh; }
      }
      return best || this.W.shops[this.W.shops.length - 2];
    }
    convertShop(shop, word) {
      const typ = this.world.shopTypes.find((t) => t.word === word);
      if (!typ) return;
      shop.word = word; shop.goods = typ.goods; shop.icon = typ.icon; shop._sign = null;
      if (shop.signStyle === 'icon' || shop.signStyle === 'blank') shop.signStyle = 'board'; // the sign must say what it sells
      SS.Art.drop('shop_' + shop.id + '_' + this.L.key); SS.Art.drop('neon_' + shop.id);
    }
    freeSpot(x, side, shop) {
      const ys = side === 'near' ? [482, 500, 466, 516] : [206, 198, 214];
      for (let k = 0; k < 40; k++) {
        const dx = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 28;
        const xx = shop ? U.clamp(x + dx, shop.x + 24, shop.x + shop.w - 24) : x + dx;
        if (this.W.intersections.some((I) => Math.abs(xx - I.x) < G.CROSS_HALF + 60)) continue;
        for (const y of ys) if (!this.collides(xx, y) && !this.collides(xx + 14, y) && !this.collides(xx - 14, y)) return { x: xx, y };
      }
      return { x, y: side === 'near' ? G.ROAD_BOT + 8 : G.ROAD_TOP - 6 };
    }
    atShop(shop) {
      const p = this.player;
      return p.y < G.ROAD_TOP + 10 && p.x > shop.x + 4 && p.x < shop.x + shop.w - 4;
    }
    updateOrders(dt) {
      const o = this.order, p = this.player;
      if (!o || p.tumble) return;
      if (o.state === 'waiting') {
        if (this.atShop(o.shop) || Math.hypot(p.x - o.vendor.x, (p.y - o.vendor.y) * 1.3) < 62) this.pickUp(o);
      } else if (o.state === 'carrying') {
        const rain = this.rainT > 0 ? 1.35 : 1;
        o.heat = Math.max(0, o.heat - o.coolRate * rain * dt);
        if (o.heat <= 0 && !o.coldMsg) { o.coldMsg = true; this.popup(o.food.temp === 'cold' ? S.melted : S.cold, p.x, p.y - 100, '#9fd0ff', 1.4, 18); }
        const d = o.drop;
        const reached = d.kind === 'near' ? Math.hypot(p.x - d.x, (p.y - d.y) * 1.3) < 60 : (this.atShop(d.shop) && Math.abs(p.x - d.x) < d.shop.w / 2);
        if (reached) this.deliver(o);
      }
    }
    pickUp(o) {
      const p = this.player, F = o.food;
      o.state = 'carrying'; o.heat = 100; o.t0 = this.time;
      p.cargo = 100;
      this.cargoDef = { id: F.id, carry: F.carry, temp: F.temp, cup: F.cup, sensitivity: F.sens * (1 - 0.18 * SS.Save.up('box')) };
      // the time a calm, steady walker needs: distance plus a crossing; food keeps for a while beyond that
      o.dist = Math.abs(o.drop.x - p.x) + (o.drop.kind === 'near' ? 260 : 80);
      const allowed = o.dist / 68 + 9;
      o.coolRate = 100 / (allowed * 2.2) * F.cool * (F.temp === 'warm' ? 0.5 : 1) * (1 - 0.2 * SS.Save.up('bag'));
      this.popup(S.orderUp + ' ' + F.name, p.x, p.y - 104, '#ffd75a', 1.6, 20);
      const v = o.vendor; v.handed = true; v.bubble = U.pick(S.vendorLines); v.bubbleT = 2.2; v.leaveT = 3.5; v.leaveDir = Math.random() < 0.5 ? -1 : 1;
      SS.Audio.sfx('pickup');
      SS.Haptics.vibrate(20);
      for (let i = 0; i < 10; i++) this.particle('spark', p.x, p.y - 60, U.rand(-80, 80), U.rand(-110, 0), 0.6);
      this.tutorial('carry');
    }
    deliver(o) {
      const p = this.player, F = o.food;
      o.state = 'done';
      const heat = o.heat, cond = p.cargo;
      const q = heat * 0.55 + cond * 0.45;
      const stars = q >= 80 ? 5 : q >= 64 ? 4 : q >= 46 ? 3 : q >= 26 ? 2 : 1;
      o.stars = stars;
      this.streak = stars >= 4 ? this.streak + 1 : 0;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const tip = Math.max(1, Math.round((6 + o.dist / 110) * (0.25 + 0.75 * q / 100) * (1 + 0.1 * Math.min(5, Math.max(0, this.streak - 1)))));
      o.tip = tip;
      this.tips += tip; this.coins += tip; this.delivered++; this.ratingSum += stars;
      // every 2 jobs done wins a heart back (up to the maximum)
      if (this.delivered % 2 === 0 && p.lives < C.LIVES) {
        p.lives++;
        this.popup(S.popHeartBack, p.x, p.y - 140, '#ff6a7a', 1.8, 22);
        SS.Audio.sfx('powerup'); SS.Haptics.vibrate([20, 40, 20]);
      }
      this.score += tip * 10 + stars * 60;
      const lines = (F.temp === 'cold' ? S.reactionsCold : S.reactions)[stars - 1];
      const c = o.cust; c.bubble = U.pick(lines); c.bubbleT = 2.8; c.mood = stars >= 4 ? 1 : stars <= 2 ? -1 : 0; c.leaveT = 3.2; c.leaveDir = Math.random() < 0.5 ? -1 : 1;
      this.ratingFx = { stars, tip, t: 2.4, streak: this.streak, x: c.x, y: c.y };
      SS.Audio.sfx('buy'); if (stars >= 4) SS.Audio.sfx('star');
      SS.Haptics.vibrate(stars >= 4 ? [20, 30, 40] : 20);
      for (let i = 0; i < 6 + stars * 3; i++) this.particle(stars >= 4 ? 'confetti' : 'spark', c.x, c.y - 70, U.rand(-110, 110), U.rand(-120, 0), 1.2, 0, U.pick(['#ff5c8a', '#ffd23f', '#3ff0ff', '#7fc96b']));
      // food passport stamp
      const st = SS.Save.data.stamps;
      if (stars >= 4 && !st[F.id]) {
        st[F.id] = true; SS.Save.save();
        this.popup(S.stampEarned.replace('{food}', F.name), p.x, p.y - 140, '#ff8fb0', 2.2, 18);
        if (!SS.Save.data.passportDone && SS.FOOD_ORDER.every((k) => st[k])) { SS.Save.data.passportDone = true; SS.Save.save(); this.coins += 300; this.popup(S.passportDone, p.x, p.y - 170, '#ffd75a', 2.6, 20); }
      }
      this.cargoDef = { id: null, carry: null, temp: null, sensitivity: 0 };
      if (this.delivered === 1) this.tutorial('tip');
      this.afterOrder();
    }
    failOrder() {
      const o = this.order, p = this.player;
      if (!o || o.state !== 'carrying') return;
      o.state = 'failed'; this.failedOrders++; this.streak = 0;
      SS.Audio.sfx('shatter');
      for (let i = 0; i < 16; i++) this.particle('splash', p.x + p.face * 14, p.y - 44, U.rand(-120, 120), U.rand(-160, -20), 0.9, 0, this.cargoDef.carry === 'cup' ? this.cargoDef.cup : '#c9873a');
      this.popup(S.dropped, p.x, p.y - 100, '#ff6a5a', 1.6, 24);
      this.banner = { text: S.dropped, sub: S.orderFailed, t: 2.4 };
      const c = o.cust; c.bubble = 'Oh no…'; c.bubbleT = 2; c.mood = -1; c.leaveT = 2.5; c.leaveDir = 1;
      this.cargoDef = { id: null, carry: null, temp: null, sensitivity: 0 };
      p.cargo = 100;
      this.afterOrder();
    }
    afterOrder() {
      if (!this.level.endless && this.orders.length >= this.level.orders) { this.order = null; this.finishShift(); return; }
      this.nextOrder();
    }
    finishShift() {
      const p = this.player;
      if (this.delivered === 0) { this.lose('orders'); return; }
      this.state = 'won'; this.stateT = 0;
      if (p.latchedBy) this.releaseSeller(p.latchedBy);
      SS.Audio.playJingle('complete');
      SS.Audio.duckMusic(0.25);
      SS.Haptics.vibrate([20, 40, 20, 40, 60]);
      for (let i = 0; i < 40; i++) this.particle('confetti', p.x + U.rand(-60, 60), p.y - 120, U.rand(-120, 120), U.rand(-60, 60), 2, 0, U.pick(['#ff5c8a', '#ffd23f', '#3ff0ff', '#7fc96b', '#ffffff']));
      this.popup(S.shiftComplete, p.x, p.y - 130, '#ffd75a', 1.8, 30);
    }

    /* ------------------------------------------------------------------ */
    /* Street events: traffic lights and sudden downpours                  */
    /* ------------------------------------------------------------------ */
    // phases: 0 main road green, 1 main amber, 2 cross street green (main red), 3 cross amber
    updateLights(dt) {
      const DUR = [9, 1.6, 7.5, 1.6];
      for (const I of this.W.intersections) {
        I.phaseT -= dt;
        if (I.phaseT <= 0) {
          I.phase = (I.phase + 1) % 4; I.phaseT = DUR[I.phase];
          const p = this.player;
          if (p && I.phase === 2 && Math.abs(p.x - I.x) < this.viewW * 0.6 && this.state === 'play') {
            this.popup(S.redLight, p.x, p.y - 110, '#ff6a5a', 1.6, 18);
            this.tutorial('light');
          }
        }
      }
    }
    lightStop(s) {
      // returns the distance to a stop line this vehicle must obey, or null
      if (s.runsRed === undefined) s.runsRed = s.skill < 0.5 || s.isBB || Math.random() < 0.08; // it is Hanoi…
      if (s.runsRed) return null;
      for (const I of this.W.intersections) {
        if (s.vertical) {
          if (s.ix !== I.x || !(I.phase === 0 || I.phase === 3)) continue;
          const stopY = s.ay > 0 ? G.ROAD_TOP - 34 : G.ROAD_BOT + 40;
          const d = (stopY - s.y) * s.ay - 18;
          if (d > -6 && d < 220) return d;
        } else {
          if (!(I.phase === 1 || I.phase === 2)) continue;
          const stopX = s.ax > 0 ? I.x - G.CROSS_HALF - 100 : I.x + G.CROSS_HALF + 70; // stop before the zebra crossing
          const d = (stopX - s.x) * s.ax - s.len;
          if (d > (I.phase === 1 ? 30 : -6) && d < 300) return d;
        }
      }
      return null;
    }
    updateRain(dt) {
      const p = this.player;
      if (this.rainX != null && p.x > this.rainX && this.rainT <= 0 && !this.rainDone) {
        this.rainT = 26; this.rainDone = true;
        this.banner = { text: S.rainStart, sub: S.rainSub, t: 3.2 };
      }
      if (this.rainT > 0) this.rainT -= dt;
      this.rainK = U.approach(this.rainK, this.rainT > 0 ? 1 : 0, dt * 0.5);
      SS.Audio.setRain(this.rainK);
      if (this.rainK > 0.05 && Math.random() < dt * 30 * this.rainK * SS.Main.quality) this.particle('drop', this.cam.x + Math.random() * this.viewW, U.rand(G.FACADE_BOT, G.VIEW_H), 0, 0, 0.35);
    }

    lose(reason) {
      if (this.state === 'lost' || this.state === 'won') return;
      this.state = 'lost'; this.stateT = 0; this.loseReason = reason;
      SS.Audio.duckMusic(0.2);
      SS.Audio.playJingle('gameover');
      SS.Audio.setRain(0);
    }

    // final results (also commits coins)
    results() {
      const p = this.player;
      const won = this.state === 'won';
      const n = this.orders.filter((o) => o.state === 'done' || o.state === 'failed').length;
      const avg = this.delivered ? this.ratingSum / Math.max(1, this.delivered + this.failedOrders) : 0;
      const bonusLives = won ? Math.max(0, p.lives) * 200 : 0;
      const total = this.score + bonusLives;
      let stars = 0;
      if (won) { stars = 1; if (avg >= 3.5) stars = 2; if (avg >= 4.4 && this.failedOrders === 0) stars = 3; }
      return { won, endless: !!this.level.endless, total, base: this.score, bonusLives, stars, lives: Math.max(0, p.lives), time: this.time, reason: this.loseReason,
        stats: this.stats, delivered: this.delivered, failed: this.failedOrders, orders: this.level.endless ? n : this.level.orders, avg, tips: this.tips, bestStreak: this.bestStreak,
        coinsEarned: this.coins - this.coinsStart };
    }

    commitCoins() {
      if (this.banked) return;
      this.banked = true;
      SS.Save.data.coins = Math.max(0, SS.Save.data.coins + Math.max(0, this.coins));
      SS.Save.save();
    }

    destroy() {
      SS.Audio.bbStop();
    }
  }

  SS.Session = Session;
})();
