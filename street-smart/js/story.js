/* =====================================================================
 * Story — the opening cutscene, shot like a short animated film.
 * ---------------------------------------------------------------------
 * Built from the game's painted key art (assets/ui/cover.jpg and
 * assets/story/street.jpg): each shot is a slow camera move across part
 * of a painting, with letterbox bars, film grain, a vignette, subtitles,
 * speech balloons, sound-effect lettering in the cover's style, speed
 * lines, rain, flashes and camera shake drawn live on top.
 *
 * SS.Story.start(onDone)  plays it; tap = next shot, SKIP = end.
 * Words live in SS.STRINGS.story. Crops avoid the parts of the street
 * painting that contain lettering, so the only signs on screen stay real.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const TAU = Math.PI * 2;
  const ease = (k) => { k = U.clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const out3 = (k) => 1 - Math.pow(1 - U.clamp(k, 0, 1), 3);

  const IMAGES = { cover: 'assets/ui/cover.jpg', street: 'assets/story/street.jpg' };
  // safe areas of each painting (source pixels) the camera may show
  const SAFE = { cover: [330, 250, 1060, 700], street: [120, 245, 1285, 768] };

  /* ---------------- drawing helpers ---------------- */
  // camera: show the part of a painting centred on (cx, cy), `h` source pixels tall, filling the screen
  function cam(ctx, img, key, cx, cy, h, vw, vh, alpha) {
    const S = SAFE[key], asp = vw / vh;
    let w = h * asp;
    if (w > S[2] - S[0]) { w = S[2] - S[0]; h = w / asp; }
    if (h > S[3] - S[1]) { h = S[3] - S[1]; w = h * asp; }
    const sx = U.clamp(cx - w / 2, S[0], S[2] - w), sy = U.clamp(cy - h / 2, S[1], S[3] - h);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(img, sx, sy, w, h, 0, 0, vw, vh);
    ctx.globalAlpha = 1;
    return { sx, sy, k: vw / w }; // to place things over the painting
  }
  const lerpShot = (a, b, k) => ({ cx: U.lerp(a[0], b[0], k), cy: U.lerp(a[1], b[1], k), h: U.lerp(a[2], b[2], k) });

  function grade(ctx, vw, vh, tint, a) { ctx.fillStyle = tint; ctx.globalAlpha = a; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; }

  // white motion streaks
  function speedLines(ctx, vw, vh, t, dir, n, alpha) {
    const r = U.rng(4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y = r() * vh, len = 80 + r() * 260, sp = 1400 + r() * 1400;
      const x = ((r() * vw * 2 - t * sp * dir) % (vw + len * 2) + (vw + len * 2)) % (vw + len * 2) - len;
      ctx.globalAlpha = alpha * (0.25 + r() * 0.5); ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * dir, y); ctx.stroke();
    }
    ctx.restore();
  }
  // radial burst lines (manga focus) in white, for impact moments
  function burstLines(ctx, cx, cy, vw, vh, t, alpha) {
    const r = U.rng(9 + Math.floor(t * 14)), far = Math.hypot(vw, vh);
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, wd = 0.004 + r() * 0.01, r0 = 140 + r() * 120;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far);
      ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far); ctx.fill();
    }
    ctx.restore();
  }
  function rain(ctx, vw, vh, t, a) {
    const r = U.rng(3);
    ctx.save(); ctx.strokeStyle = 'rgba(200,220,255,' + (0.55 * a).toFixed(3) + ')'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 160; i++) {
      const sx = r() * (vw + 120), sy = r() * vh, sp = 900 + r() * 500;
      const y = (sy + t * sp) % (vh + 40) - 20, x = sx - ((t * sp * 0.22) % 120);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); ctx.stroke();
    }
    ctx.restore();
  }
  // sound-effect lettering in the cover's style: chunky orange with a dark edge
  function sfx(ctx, text, x, y, size, rot, k, shake, cool) {
    if (k <= 0) return;
    const s = (k < 1 ? 1 + Math.sin(U.clamp(k, 0, 1) * Math.PI) * 0.4 * (1 - k) : 1) * Math.min(1, k * 5);
    ctx.save();
    ctx.translate(x + (shake ? (Math.random() - 0.5) * shake : 0), y + (shake ? (Math.random() - 0.5) * shake : 0));
    ctx.rotate(rot); ctx.scale(s, s);
    ctx.font = SS.font(size, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(text, size * 0.06, size * 0.1);
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#2a1006'; ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    if (cool) { g.addColorStop(0, '#d8ffd0'); g.addColorStop(1, '#2fa84f'); }
    else { g.addColorStop(0, '#ffd47a'); g.addColorStop(0.5, '#f39a3b'); g.addColorStop(1, '#c4521f'); }
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    // distressed scratches
    ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
    const r = U.rng(text.length * 7);
    const tw = ctx.measureText(text).width;
    for (let i = 0; i < 14; i++) { const sx = (r() - 0.5) * tw, sy = (r() - 0.5) * size * 0.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 8 + r() * 14, sy + (r() - 0.5) * 4); ctx.stroke(); }
    ctx.restore();
  }
  // subtitles at the bottom, typed out
  function subtitle(ctx, text, vw, vh, k, bar) {
    if (k <= 0) return;
    const shown = text.slice(0, Math.ceil(text.length * U.clamp(k, 0, 1)));
    ctx.font = SS.font(Math.min(24, vw / 42), 700, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = vh - bar / 2;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(shown, vw / 2, y);
    ctx.fillStyle = '#fff7e6'; ctx.fillText(shown, vw / 2, y);
  }
  // speech balloon with a tail pointing at (tx, ty)
  function balloon(ctx, text, x, y, maxW, size, tx, ty, k, shout) {
    if (k <= 0) return;
    const s = out3(k * 3);
    ctx.font = SS.font(size, 800, true);
    const lines = SS.UI.wrap(ctx, text, maxW);
    const lh = size * 1.18, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.6, h = lines.length * lh + size * 1.1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 3.5;
    const ax = (tx - x) / s, ay = (ty - y) / s;
    ctx.beginPath(); ctx.moveTo(-size * 0.6, h * 0.2); ctx.lineTo(ax, ay); ctx.lineTo(size * 0.6, h * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (shout) {
      const r = U.rng(9); ctx.beginPath();
      for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU, kk = i % 2 ? 0.86 : 1.08 + r() * 0.1; const px = Math.cos(a) * w * 0.6 * kk, py = Math.sin(a) * h * 0.7 * kk; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.58, h * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.56, h * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }
  // the scooter key with its green CRAB tag (drawn over the painting)
  function key(ctx, x, y, s, rot, glint) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 2.5; ctx.fillStyle = '#d9dde2';
    ctx.beginPath(); ctx.arc(0, -18, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(0, -18, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9dde2'; ctx.beginPath(); ctx.rect(-3, -9, 6, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, -30, 6, 0, TAU); ctx.stroke();
    ctx.fillStyle = SS.COL_PLAYER; ctx.beginPath(); ctx.rect(9, -42, 22, 13); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (glint > 0) {
      ctx.save(); ctx.translate(x - 14 * s, y - 22 * s); ctx.rotate(glint * 3); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,230,' + glint.toFixed(3) + ')';
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 4 * s : 22 * s * glint; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------- the player ---------------- */
  const Story = (SS.Story = {
    active: false, shot: 0, lt: 0, t: 0, shake: 0, flash: 0, imgs: null, prev: null,

    start(onDone) {
      this.onDone = onDone; this.shot = 0; this.lt = 0; this.t = 0; this.active = true; this.fired = {}; this.shake = 0; this.flash = 0;
      this.loading = true;
      this.load().then((ok) => { this.loading = false; if (!ok) this.finish(); else { this.lt = 0; SS.Audio.duckMusic(0.5); } });
    },
    load() {
      if (this.imgs) return Promise.resolve(true);
      const one = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
      return Promise.all(Object.entries(IMAGES).map(([k, src]) => one(src).then((i) => [k, i]))).then((list) => {
        const imgs = {}; for (const [k, i] of list) { if (!i) return false; imgs[k] = i; }
        this.imgs = imgs; this.makeGrain(); return true;
      });
    },
    makeGrain() {
      const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); this.grain = c;
    },
    finish() {
      if (!this.active) return;
      this.active = false;
      SS.Save.data.storySeen = true; SS.Save.save();
      SS.Audio.duckMusic(0.8);
      const f = this.onDone; this.onDone = null;
      if (f) f();
    },
    next() {
      if (this.loading) return;
      SS.Audio.sfx('whoosh');
      if (this.shot >= this.shots.length - 1) { this.finish(); return; }
      this.prev = { shot: this.shot, lt: this.lt }; this.shot++; this.lt = 0; this.fired = {};
    },
    once(id, at, fn) { if (this.lt >= at && !this.fired[id]) { this.fired[id] = true; fn(); } },

    update(dt) {
      if (!this.active || this.loading) return;
      this.t += dt; this.lt += dt;
      if (this.prev) this.prev.lt += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 3);
      const sh = this.shots[this.shot];
      if (sh.sfx) sh.sfx.call(this);
      if (this.lt >= sh.dur && !sh.hold) this.next();
    },

    draw(ctx, vw, vh, u) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh);
      if (!this.active || this.loading || !this.imgs) return;
      const bar = Math.round(vh * 0.1);
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      // cross-dissolve from the previous shot
      const fade = U.clamp(this.lt / 0.45, 0, 1);
      if (this.prev && fade < 1) this.shots[this.prev.shot].draw.call(this, ctx, this.prev.lt, vw, vh, 1);
      this.shots[this.shot].draw.call(this, ctx, this.lt, vw, vh, this.prev ? fade : 1);
      ctx.restore();
      // film look: vignette + grain
      const vg = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.35, vw / 2, vh / 2, vw * 0.65);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
      if (this.grain) {
        ctx.save(); ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
        const ox = Math.floor(Math.random() * 160), oy = Math.floor(Math.random() * 160);
        for (let x = -ox; x < vw; x += 160) for (let y = -oy; y < vh; y += 160) ctx.drawImage(this.grain, x, y);
        ctx.restore();
      }
      if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + this.flash.toFixed(3) + ')'; ctx.fillRect(0, 0, vw, vh); }
      // letterbox + subtitles
      const sh = this.shots[this.shot];
      if (!sh.noBars) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, bar); ctx.fillRect(0, vh - bar, vw, bar);
        if (sh.sub) for (const [txt, at, until] of sh.sub(SS.STRINGS.story)) if (this.lt >= at && (until == null || this.lt < until)) subtitle(ctx, txt, vw, vh, (this.lt - at) * 1.6, bar);
      }
      // progress dots
      const n = this.shots.length;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i === this.shot ? '#f39a3b' : 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(vw / 2 + (i - (n - 1) / 2) * 14, 14, i === this.shot ? 4 : 3, 0, TAU); ctx.fill();
      }
    },

    shots: [
      { // 1. the Old Quarter at rush hour
        dur: 5.5,
        sfx() { this.once('h', 0.8, () => SS.Audio.sfx('horn', { vol: 0.6 })); this.once('h2', 2.4, () => SS.Audio.sfx('horn', { type: 2, vol: 0.5 })); },
        sub: (S) => [[S.s0, 0.6]],
        draw(ctx, lt, vw, vh, a) {
          const c = lerpShot([420, 520, 470], [860, 500, 420], ease(lt / 5.5));
          cam(ctx, this.imgs.street, 'street', c.cx, c.cy, c.h, vw, vh, a);
        },
      },
      { // 2. Minh, the fastest CRAB rider
        dur: 5.2,
        sub: (S) => [[S.s1, 0.4]],
        draw(ctx, lt, vw, vh, a) {
          // Minh and his CRAB box (framed so the tourist stays out of shot)
          const c = lerpShot([600, 420, 260], [625, 390, 215], ease(lt / 5.2));
          cam(ctx, this.imgs.cover, 'cover', c.cx, c.cy, c.h, vw, vh, a);
          if (a < 1) return;
          speedLines(ctx, vw, vh, lt, -1, 22, 0.35);
        },
      },
      { // 3. ran in with an order... and left the key in
        dur: 5.6,
        sfx() { this.once('t', 2.6, () => SS.Audio.sfx('star')); },
        sub: (S) => [[S.s2a, 0.3, 2.6], [S.s2b, 2.6]],
        draw(ctx, lt, vw, vh, a) {
          const c = lerpShot([330, 640, 300], [300, 660, 200], ease(lt / 5.6));
          const v = cam(ctx, this.imgs.street, 'street', c.cx, c.cy, c.h, vw, vh, a);
          grade(ctx, vw, vh, '#1a0c06', 0.25 * a);
          if (a < 1) return;
          // the key, still in the ignition of a parked scooter
          const kx = (300 - v.sx) * v.k, ky = (650 - v.sy) * v.k;
          key(ctx, kx, ky, 1.4 + v.k * 0.15, -0.4 + Math.sin(lt * 3) * 0.05, U.clamp((lt - 2.5) * 3, 0, 1) * (1 - U.clamp((lt - 3.6) * 2, 0, 1)));
          sfx(ctx, SS.STRINGS.story.ting, kx - 120, ky - 90, 44, -0.1, (lt - 2.5) * 2);
        },
      },
      { // 4. SNATCH!
        dur: 4.4,
        sfx() { this.once('s', 0.7, () => { SS.Audio.sfx('shatter'); SS.Audio.sfx('whoosh'); this.shake = 16; this.flash = 0.8; SS.Haptics.vibrate(30); }); },
        sub: (S) => [],
        draw(ctx, lt, vw, vh, a) {
          const z = lt < 0.7 ? U.lerp(300, 270, lt / 0.7) : U.lerp(190, 170, out3((lt - 0.7) / 3));
          const c = { cx: lt < 0.7 ? 880 : 915, cy: lt < 0.7 ? 420 : 400 };
          cam(ctx, this.imgs.cover, 'cover', c.cx, c.cy, z, vw, vh, a);
          if (a < 1) return;
          if (lt > 0.7) burstLines(ctx, vw * 0.62, vh * 0.42, vw, vh, lt, 0.55 * (1 - U.clamp((lt - 1.5) / 1.5, 0, 0.6)));
          if (lt > 0.7) key(ctx, vw * 0.36 + Math.sin(lt * 8) * 4, vh * 0.38, 2.2, 0.5 + Math.sin(lt * 9) * 0.2, 0);
          sfx(ctx, SS.STRINGS.story.snatch, vw * 0.25, vh * 0.24, 72, -0.14, (lt - 0.7) * 3, lt < 1.4 ? 8 : 0);
          balloon(ctx, SS.STRINGS.story.tourist1, vw * 0.3, vh * 0.7, 300, 20, vw * 0.55, vh * 0.55, lt - 1.6);
        },
      },
      { // 5. TRỜI ƠI!!
        dur: 3.8,
        sfx() { this.once('g', 0.2, () => { SS.Audio.sfx('gasp'); this.shake = 10; }); },
        draw(ctx, lt, vw, vh, a) {
          const c = lerpShot([737, 345, 200], [737, 335, 150], out3(lt / 1.2));
          cam(ctx, this.imgs.cover, 'cover', c.cx + (lt < 1.2 ? (Math.random() - 0.5) * 4 : 0), c.cy, c.h, vw, vh, a);
          if (a < 1) return;
          burstLines(ctx, vw / 2, vh * 0.48, vw, vh, lt, 0.35);
          sfx(ctx, SS.STRINGS.story.troiOi, vw / 2, vh * 0.22, 78, -0.05, (lt - 0.25) * 2.5, 6, true);
        },
      },
      { // 6. he rides off on Minh's scooter
        dur: 6.0,
        sfx() { this.once('h', 0.3, () => SS.Audio.sfx('horn', { type: 2, vol: 0.9 })); },
        sub: (S) => [[S.s5, 2.6]],
        draw(ctx, lt, vw, vh, a) {
          const c = lerpShot([700, 470, 430], [820, 470, 380], ease(lt / 6));
          cam(ctx, this.imgs.cover, 'cover', c.cx, c.cy, c.h, vw, vh, a);
          if (a < 1) return;
          speedLines(ctx, vw, vh, lt, 1, 30, 0.45);
          balloon(ctx, SS.STRINGS.story.tourist2, vw * 0.8, vh * 0.2, 220, 22, vw * 0.78, vh * 0.36, lt - 0.6);
          balloon(ctx, SS.STRINGS.story.minhWait, vw * 0.3, vh * 0.2, 220, 20, vw * 0.4, vh * 0.34, lt - 1.4, true);
        },
      },
      { // 7. rain... and Bà Lan's idea
        dur: 7.6,
        sfx() { this.once('r', 0.1, () => SS.Audio.sfx('slosh')); },
        sub: (S) => [[S.s6, 0.4, 3.2], [S.minh2, 5.6]],
        draw(ctx, lt, vw, vh, a) {
          const k = ease((lt - 2.6) / 1.6);
          const c = lerpShot([720, 520, 420], [1066, 380, 210], k);
          cam(ctx, this.imgs.street, 'street', c.cx, c.cy, c.h, vw, vh, a);
          grade(ctx, vw, vh, '#0b1a3a', (0.5 - 0.25 * k) * a);
          rain(ctx, vw, vh, lt, a * (1 - k * 0.5));
          if (a < 1) return;
          balloon(ctx, SS.STRINGS.story.baLan, vw * 0.32, vh * 0.28, 360, 20, vw * 0.48, vh * 0.42, lt - 3.6, true);
        },
      },
      { // 8. the goal
        dur: 8, hold: true, noBars: false,
        sfx() { this.once('p', 0.3, () => SS.Audio.sfx('powerup')); this.once('c', 1.3, () => SS.Audio.sfx('coin')); },
        sub: (S) => [[S.tapToPlay, 2.6]],
        draw(ctx, lt, vw, vh, a) {
          const c = lerpShot([690, 470, 460], [690, 450, 430], ease(lt / 8));
          cam(ctx, this.imgs.cover, 'cover', c.cx, c.cy, c.h, vw, vh, a);
          grade(ctx, vw, vh, '#000', 0.45 * a);
          if (a < 1) return;
          const S = SS.STRINGS.story;
          sfx(ctx, S.goalTitle, vw / 2, vh * 0.3, 54, -0.03, (lt - 0.2) * 2);
          sfx(ctx, S.goal.replace('{n}', SS.CONFIG.SCOOTER_PRICE.toLocaleString('en-US')), vw / 2, vh * 0.48, Math.min(40, vw / 22), 0.02, (lt - 0.8) * 2, 0, true);
          if (lt > 1.6) {
            ctx.globalAlpha = U.clamp((lt - 1.6) * 2, 0, 1);
            ctx.font = SS.font(20, 700, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(S.goalSub, vw / 2, vh * 0.62);
            ctx.fillStyle = '#fff7e6'; ctx.fillText(S.goalSub, vw / 2, vh * 0.62);
            ctx.globalAlpha = 1;
          }
        },
      },
    ],
  });
})();
