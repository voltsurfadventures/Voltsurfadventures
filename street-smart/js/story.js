/* =====================================================================
 * Story — the opening cutscene, drawn like an old black-and-white manga.
 * ---------------------------------------------------------------------
 * Everything is made in code: the game's own street and characters are
 * rendered once into off-screen canvases, then turned into ink + halftone
 * screentone (only Minh's courier green stays in colour). Panels slide
 * in, captions type out, and speed lines, focus lines and sound-effect
 * lettering are drawn live on top.
 *
 * SS.Story.start(onDone)  plays it; tap = next shot, SKIP = end.
 * All words live in SS.STRINGS.story.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const Art = SS.Art;
  const TAU = Math.PI * 2;

  const PAPER = '#f4efe3', INK = '#16141a';
  const GREEN = () => SS.COL_PLAYER;
  const ease = (k) => 1 - Math.pow(1 - U.clamp(k, 0, 1), 3);
  const pop = (k) => { k = U.clamp(k, 0, 1); return k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 * (1 - k) + (k - 1) * 0.0 : 1; };

  /* ---------------- off-screen helpers ---------------- */
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // ink + halftone screentone. Pixels that are clearly the courier green stay green.
  function mangaize(c, keepGreen) {
    const g = c.getContext('2d');
    let id;
    try { id = g.getImageData(0, 0, c.width, c.height); } catch (e) { return c; }
    const d = id.data, w = c.width;
    const cell = Math.max(4, Math.round(SS.View.S * 2.1)), half = cell / 2;
    const pr = 244, pg = 239, pb = 227, ir = 22, ig = 20, ib = 26;
    for (let i = 0, n = d.length; i < n; i += 4) {
      const a = d[i + 3];
      if (a < 110) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const L = 0.299 * r + 0.587 * gg + 0.114 * b;
      if (keepGreen && gg > r + 45 && gg > b + 20) {
        if (L > 105) { d[i] = 0; d[i + 1] = 177; d[i + 2] = 79; }
        else if (L > 55) { d[i] = 0; d[i + 1] = 118; d[i + 2] = 52; }
        else { d[i] = ir; d[i + 1] = ig; d[i + 2] = ib; }
        continue;
      }
      // posterise to a few screentone densities
      let cov;
      if (L > 212) cov = 0;
      else if (L > 168) cov = 0.12;
      else if (L > 122) cov = 0.32;
      else if (L > 78) cov = 0.58;
      else if (L > 42) cov = 0.82;
      else cov = 1;
      let ink;
      if (cov === 0) ink = false;
      else if (cov === 1) ink = true;
      else {
        // dots on a 45-degree lattice (classic screentone)
        const p = i / 4, x = p % w, y = (p / w) | 0;
        const u = (((x + y) % cell) + cell) % cell - half, v = (((x - y) % cell) + cell) % cell - half;
        const R = half * Math.sqrt(cov / 0.785) * 1.02;
        ink = cov < 0.6 ? (u * u + v * v < R * R) : !(u * u + v * v < (half * Math.sqrt((1 - cov) / 0.785)) ** 2);
      }
      if (ink) { d[i] = ir; d[i + 1] = ig; d[i + 2] = ib; } else { d[i] = pr; d[i + 1] = pg; d[i + 2] = pb; }
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  // draw something in logical units into an off-screen canvas (device pixels), then mangaize it
  function bake(w, h, ox, oy, scale, fn, keepGreen) {
    const S = SS.View.S, c = mk(w * scale * S, h * scale * S), g = c.getContext('2d');
    g.setTransform(S * scale, 0, 0, S * scale, ox * S * scale, oy * S * scale);
    g.lineCap = 'round'; g.lineJoin = 'round';
    fn(g);
    mangaize(c, keepGreen);
    return { c, w: w * scale, h: h * scale, ox: ox * scale, oy: oy * scale };
  }
  function put(ctx, spr, x, y, flip, k) {
    k = k || 1;
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(spr.c, -spr.ox * k, -spr.oy * k, spr.w * k, spr.h * k);
    ctx.restore();
  }

  /* ---------------- characters ---------------- */
  const minhLook = (extra) => Object.assign({
    x: 0, y: 0, s: 1, face: 1, phase: 0, moving: 0, skin: '#e9b98f', shirt: SS.COL_PLAYER, zip: true, pants: '#4a3426', hair: '#1f140e', hairStyle: 'side',
    courierBox: SS.COL_PLAYER, boxText: SS.STRINGS.brand, shoe: '#2e3138', hat: 'cap', hatColor: SS.COL_PLAYER, ink: '#16141a',
  }, extra || {});
  const minhBike = (riding) => ({
    key: 'story_minh_' + (riding ? 'ride' : 'park'), kind: 'delivery', body: '#d8d2c4',
    riders: riding ? [{ role: 'driver', x: -6, shirt: SS.COL_PLAYER, helmet: SS.COL_PLAYER, stripe: true, skin: '#f0c9a0', pants: '#24262e', bag: SS.COL_PLAYER, headY: -60 }] : [],
  });
  const touristBike = () => ({
    key: 'story_tourist_ride', kind: 'single', body: '#d8d2c4',
    riders: [{ role: 'driver', x: -6, shirt: '#f4f2ec', helmet: null, hair: '#f2a08c', skin: '#f2a08c', pants: '#3b6ea5', headY: -60 }], // bald, tank top, blue cargo shorts
  });

  /* ---------------- live drawing helpers ---------------- */
  function speedLines(ctx, x, y, w, h, t, dir, n, col) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = col || INK; ctx.lineCap = 'round';
    const r = U.rng(7);
    for (let i = 0; i < n; i++) {
      const yy = y + r() * h, len = 40 + r() * 160, sp = 900 + r() * 900;
      const xx = x + (((r() * w * 2 - t * sp * dir) % (w + len * 2)) + (w + len * 2)) % (w + len * 2) - len;
      ctx.lineWidth = 0.8 + r() * 2.2; ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len * dir, yy); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function focusLines(ctx, x, y, w, h, cx, cy, inner, n, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = INK;
    const r = U.rng(11 + Math.floor(t * 12)), far = Math.hypot(w, h);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, wd = 0.004 + r() * 0.014, r0 = inner * (0.85 + r() * 0.5);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far);
      ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function rain(ctx, x, y, w, h, t) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(22,20,26,0.55)'; ctx.lineWidth = 1.2;
    const r = U.rng(3);
    for (let i = 0; i < 90; i++) {
      const sx = r() * (w + 100), sy = r() * h, sp = 600 + r() * 300;
      const yy = y + ((sy + t * sp) % (h + 40)) - 20, xx = x + sx - ((t * sp * 0.25) % 100);
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 5, yy + 18); ctx.stroke();
    }
    ctx.restore();
  }
  function burst(ctx, x, y, rx, ry, spikes, fill, stroke, seed) {
    const r = U.rng(seed || 5);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * TAU, k = i % 2 ? 0.62 + r() * 0.12 : 1 + r() * 0.18;
      const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.stroke();
  }
  // big sound-effect lettering
  function sfxText(ctx, text, x, y, size, rot, fill, k, shake) {
    if (k <= 0) return;
    const s = pop(k) * Math.min(1, k * 4);
    ctx.save();
    ctx.translate(x + (shake ? (Math.random() - 0.5) * shake : 0), y + (shake ? (Math.random() - 0.5) * shake : 0));
    ctx.rotate(rot); ctx.scale(s, s);
    ctx.font = SS.font(size, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.3; ctx.strokeStyle = INK; ctx.strokeText(text, 0, 0);
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = '#ffffff'; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  // caption box (narration), typed out
  function caption(ctx, text, x, y, maxW, size, k, align) {
    if (k <= 0) return;
    const shown = text.slice(0, Math.ceil(text.length * U.clamp(k, 0, 1)));
    ctx.font = SS.font(size, 700, false);
    const lines = SS.UI.wrap(ctx, text, maxW - size * 1.4);
    const lh = size * 1.28, w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.4), h = lines.length * lh + size * 0.9;
    const bx = align === 'right' ? x - w : x;
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(bx, y, w, h);
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.strokeRect(bx, y, w, h);
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let left = shown.length;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left)); left -= l.length + 1;
      ctx.fillText(part, bx + size * 0.7, y + size * 0.45 + i * lh);
    });
  }
  // speech balloon with a tail pointing at (tx, ty)
  function balloon(ctx, text, x, y, maxW, size, tx, ty, k, shout) {
    if (k <= 0) return;
    const s = ease(k * 2.5);
    ctx.font = SS.font(size, 800, true);
    const lines = SS.UI.wrap(ctx, text, maxW);
    const lh = size * 1.18, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.6, h = lines.length * lh + size * 1.1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    // tail
    const ax = (tx - x) / s, ay = (ty - y) / s;
    ctx.beginPath(); ctx.moveTo(-size * 0.5, h * 0.25); ctx.lineTo(ax, ay); ctx.lineTo(size * 0.5, h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (shout) burst(ctx, 0, 0, w * 0.62, h * 0.72, 14, '#ffffff', INK, 9);
    else { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.58, h * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.56, h * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }
  // a manga panel: clip, draw, border. dir = where it slides in from.
  function panel(ctx, x, y, w, h, k, dir, fn) {
    if (k <= 0) return;
    const e = ease(k * 3.2), off = (1 - e) * 90;
    const dx = dir === 'l' ? -off : dir === 'r' ? off : 0, dy = dir === 'u' ? -off : dir === 'd' ? off : 0;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 5);
    ctx.translate(dx, dy);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
    fn(x, y, w, h);
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  // a crop of the baked street backdrop that covers a panel
  function street(ctx, bg, x, y, w, h, focusX, focusY, zoom, pan) {
    const S = SS.View.S, sw = (w / zoom), sh = (h / zoom);
    const sx = U.clamp(focusX - sw / 2 + (pan || 0), 0, SS.View.w - sw), sy = U.clamp(focusY - sh / 2, 0, SS.View.h - sh);
    ctx.drawImage(bg, sx * S, sy * S, sw * S, sh * S, x, y, w, h);
  }


  /* ---------------- hand-drawn close-ups (vector, manga style) ---------------- */
  function hatch(ctx, x, y, w, h, gap, ang) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
    const d = Math.hypot(w, h);
    for (let i = -d; i < d; i += gap) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + Math.cos(ang) * d, y + Math.sin(ang) * d); ctx.stroke(); }
    ctx.restore();
  }
  function flower(ctx, x, y, r) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.32, a, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, TAU); ctx.fill();
  }
  // the rude tourist: sunburn, aviators, loud flowery shirt, smug grin, grabbing hand
  function drawTourist(ctx, cx, cy, r, t, keyK) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // sunburnt shoulders + white tank top
    ctx.fillStyle = '#f2b7a6'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-r * 2.2, r * 3.2); ctx.quadraticCurveTo(-r * 2.1, r * 1.35, -r * 0.6, r * 1.15); ctx.lineTo(r * 0.6, r * 1.15);
    ctx.quadraticCurveTo(r * 2.1, r * 1.35, r * 2.2, r * 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    hatch(ctx, -r * 2.1, r * 1.5, r * 0.6, r * 0.8, 6, 1.1); hatch(ctx, r * 1.5, r * 1.5, r * 0.6, r * 0.8, 6, 1.1);
    ctx.fillStyle = '#fffdf6';
    ctx.beginPath(); ctx.moveTo(-r * 1.25, r * 3.2); ctx.lineTo(-r * 1.0, r * 1.3); ctx.lineTo(-r * 0.7, r * 1.25);
    ctx.quadraticCurveTo(0, r * 2.1, r * 0.7, r * 1.25); ctx.lineTo(r * 1.0, r * 1.3); ctx.lineTo(r * 1.25, r * 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // neck
    ctx.fillStyle = '#f2b7a6'; ctx.fillRect(-r * 0.38, r * 0.7, r * 0.76, r * 0.5); ctx.strokeRect(-r * 0.38, r * 0.7, r * 0.76, r * 0.5);
    // head
    ctx.fillStyle = '#f6c7b6'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 1.08, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // sunburn: hatching on cheeks and nose
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.93, r * 1.06, 0, 0, TAU); ctx.clip();
    hatch(ctx, -r * 0.85, r * 0.15, r * 0.45, r * 0.35, 6, 1.1); hatch(ctx, r * 0.4, r * 0.15, r * 0.45, r * 0.35, 6, 1.1);
    ctx.restore();
    // bald and shiny
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.72, r * 0.32, r * 0.12, -0.35, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.18, -r * 0.86, r * 0.1, r * 0.05, -0.2, 0, TAU); ctx.fill();
    // aviators
    ctx.fillStyle = INK;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.08, -r * 0.08); ctx.quadraticCurveTo(sx * r * 0.85, -r * 0.2, sx * r * 0.8, r * 0.12); ctx.quadraticCurveTo(sx * r * 0.62, r * 0.45, sx * r * 0.2, r * 0.25); ctx.closePath(); ctx.fill(); }
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.06); ctx.lineTo(r * 0.1, -r * 0.06); ctx.stroke();
    ctx.fillStyle = '#ffffff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.42, -r * 0.03, r * 0.12, r * 0.05, -0.4, 0, TAU); ctx.fill(); }
    // nose
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, r * 0.25); ctx.quadraticCurveTo(r * 0.16, r * 0.45, -r * 0.04, r * 0.48); ctx.stroke();
    // smug grin with teeth
    ctx.fillStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.62); ctx.quadraticCurveTo(0, r * 0.98 + Math.sin(t * 9) * r * 0.02, r * 0.55, r * 0.55); ctx.quadraticCurveTo(0, r * 0.72, -r * 0.5, r * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.16, r * 0.66); ctx.lineTo(i * r * 0.16, r * 0.8); ctx.stroke(); }
    ctx.restore();
    // the grabbing hand, big in the foreground, key + green tag dangling
    if (keyK > 0) {
      const hx = cx - r * 2.1, hy = cy - r * 0.55 - (1 - ease(keyK)) * r * 2;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.25);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.fillStyle = '#f6c7b6';
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();       // fist
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-r * 0.36 + i * r * 0.24, -r * 0.36, r * 0.14, r * 0.2, 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.45); ctx.lineTo(r * 0.75, r * 1.6); ctx.lineTo(-r * 0.2, r * 1.7); ctx.lineTo(-r * 0.45, r * 0.4); ctx.fill(); ctx.stroke(); // wrist
      ctx.save(); ctx.translate(-r * 0.1, r * 0.35); ctx.rotate(Math.sin(t * 7) * 0.25);
      ctx.fillStyle = '#ffffff'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.16, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.62, r * 0.22, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r * 0.06, r * 0.8, r * 0.12, r * 0.55); ctx.strokeRect(-r * 0.06, r * 0.8, r * 0.12, r * 0.55);
      ctx.fillStyle = GREEN(); ctx.fillRect(r * 0.12, r * 0.25, r * 0.5, r * 0.28); ctx.strokeRect(r * 0.12, r * 0.25, r * 0.5, r * 0.28);
      ctx.restore();
      ctx.restore();
      // motion arcs behind the hand
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx + r * 0.9, hy + r * 0.2, r * (0.9 + i * 0.22), Math.PI * 0.55, Math.PI * 0.95); ctx.stroke(); }
    }
  }
  // Bà Lan: conical hat, stern face, ladle pointing at you
  function drawBaLan(ctx, cx, cy, r, t) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 5;
    // blouse (áo bà ba) with buttons
    ctx.fillStyle = '#fffdf6';
    ctx.beginPath(); ctx.moveTo(-r * 2, r * 3.4); ctx.quadraticCurveTo(-r * 1.9, r * 1.4, -r * 0.5, r * 1.15); ctx.lineTo(r * 0.5, r * 1.15); ctx.quadraticCurveTo(r * 1.9, r * 1.4, r * 2, r * 3.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    hatch(ctx, -r * 2, r * 1.6, r * 0.7, r * 1.8, 7, 1.2);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, r * 1.2); ctx.lineTo(r * 0.15, r * 3.4); ctx.stroke();
    ctx.fillStyle = INK; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(r * 0.06 + i * r * 0.04, r * 1.7 + i * r * 0.5, r * 0.07, 0, TAU); ctx.fill(); }
    // neck + face
    ctx.lineWidth = 5; ctx.fillStyle = '#efd2b4';
    ctx.fillRect(-r * 0.32, r * 0.7, r * 0.64, r * 0.5); ctx.strokeRect(-r * 0.32, r * 0.7, r * 0.64, r * 0.5);
    ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * 0.85, r * 0.98, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // stern eyes, furrowed brows, wrinkles
    ctx.lineWidth = 4;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx * r * 0.18, r * 0.05); ctx.lineTo(sx * r * 0.55, r * 0.0); ctx.stroke();                         // eye line
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * r * 0.36, r * 0.06, r * 0.07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx * r * 0.12, -r * 0.14); ctx.lineTo(sx * r * 0.6, -r * 0.26); ctx.stroke();                       // brow
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx * r * 0.6, r * 0.12); ctx.lineTo(sx * r * 0.72, r * 0.2); ctx.stroke(); ctx.lineWidth = 4;
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.18); ctx.lineTo(-r * 0.02, -r * 0.05); ctx.moveTo(r * 0.05, -r * 0.18); ctx.lineTo(r * 0.02, -r * 0.05); ctx.stroke();
    // shouting mouth
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, r * 0.56, r * 0.22, r * 0.15 + Math.abs(Math.sin(t * 10)) * r * 0.06, 0, 0, TAU); ctx.fill();
    // conical hat (nón lá) with weave lines
    ctx.lineWidth = 5; ctx.fillStyle = '#f3ead2';
    ctx.save(); ctx.translate(0, r * 0.28);
    ctx.beginPath(); ctx.moveTo(-r * 1.75, -r * 0.42); ctx.lineTo(0, -r * 1.9); ctx.lineTo(r * 1.75, -r * 0.42); ctx.quadraticCurveTo(0, -r * 0.2, -r * 1.75, -r * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.8;
    for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(-r * 1.75 * k, -r * 1.9 + (r * 1.48) * k); ctx.lineTo(r * 1.75 * k, -r * 1.9 + (r * 1.48) * k); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    // ladle, pointing out of the panel
    ctx.save(); ctx.translate(cx - r * 1.5, cy + r * 1.6); ctx.rotate(-0.9 + Math.sin(t * 6) * 0.08);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.fillStyle = '#d8d2c4';
    ctx.fillRect(-r * 0.08, -r * 2.4, r * 0.16, r * 2.4); ctx.strokeRect(-r * 0.08, -r * 2.4, r * 0.16, r * 2.4);
    ctx.beginPath(); ctx.arc(0, -r * 2.55, r * 0.42, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efd2b4'; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.34, r * 0.28, 0, 0, TAU); ctx.fill(); ctx.stroke(); // hand
    ctx.restore();
  }

  /* ---------------- the shots ---------------- */
  const Story = (SS.Story = {
    active: false,
    t: 0, shot: 0, lt: 0, shake: 0, assets: null,

    start(onDone) {
      this.onDone = onDone; this.shot = 0; this.lt = 0; this.t = 0; this.active = true; this.fired = {};
      try { this.build(); } catch (e) { this.assets = null; }
      if (!this.assets) { this.finish(); return; }
      SS.Audio.duckMusic(0.45);
    },
    finish() {
      this.active = false;
      SS.Save.data.storySeen = true; SS.Save.save();
      SS.Audio.duckMusic(0.8);
      const f = this.onDone; this.onDone = null;
      if (f) f();
    },
    next() {
      SS.Audio.sfx('whoosh');
      if (this.shot >= this.shots.length - 1) { this.finish(); return; }
      this.shot++; this.lt = 0; this.fired = {};
    },
    once(id, at, fn) { if (this.lt >= at && !this.fired[id]) { this.fired[id] = true; fn(); } },

    update(dt) {
      if (!this.active) return;
      this.t += dt; this.lt += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      const sh = this.shots[this.shot];
      if (sh.sfx) sh.sfx.call(this);
      if (this.lt >= sh.dur && !sh.hold) this.next();
    },

    build() {
      const V = SS.View;
      if (this.assets && this.assets.S === V.S && this.assets.w === V.w) return;
      const A = { S: V.S, w: V.w };
      // street backdrop: the real game street (at the café), no traffic, inked
      const sess = new SS.Session('vietnam', 0, { demo: true });
      const cafe = sess.W.shops.find((s) => s.word === 'CÀ PHÊ' && s.x > 300) || sess.W.shops[4];
      sess.cam.x = cafe.x + cafe.w / 2 - V.w * 0.42;
      sess.scooters = []; sess.sellers = []; sess.clouds = []; sess.particles = [];
      sess.bb = null; sess.W.coins = [];
      const bg = mk(V.w * V.S, V.h * V.S), bctx = bg.getContext('2d');
      bctx.setTransform(V.S, 0, 0, V.S, 0, 0);
      sess.render(bctx);
      SS.Audio.bbStop();
      mangaize(bg, false);
      A.bg = bg; A.cafeX = cafe.x + cafe.w / 2 - sess.cam.x;
      // characters
      A.minhRide = bake(150, 110, 90, 98, 2.3, (g) => { const spr = Art.scooterSprite(minhBike(true), 0); g.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); }, true);
      A.parked = bake(150, 90, 90, 80, 2.0, (g) => { const spr = Art.scooterSprite(minhBike(false), 0); g.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); }, true);
      A.touristRide = bake(150, 110, 90, 98, 2.0, (g) => { const spr = Art.scooterSprite(touristBike(), 0); g.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); }, true);
      A.minhWalk = [0, 1, 2, 3].map((f) => bake(90, 120, 45, 112, 2.3, (g) => Art.person(g, minhLook({ moving: 1, phase: f * Math.PI / 2, carry: 'cup', carryColor: '#7a4a2a', arms: 'carry' })), true));
      A.minhRun = [0, 1, 2, 3].map((f) => bake(90, 120, 45, 112, 2.3, (g) => Art.person(g, minhLook({ moving: 1, phase: f * Math.PI / 2, arms: 'up', mouth: 1 })), true));
      A.minhSad = bake(90, 100, 45, 92, 2.6, (g) => { g.fillStyle = '#3d7fd0'; Art.rr(g, -12, -16, 24, 16, 3); g.fill(); Art.person(g, minhLook({ sit: true, hunch: 1 })); }, true);
      this.assets = A;
    },

    draw(ctx, vw, vh, u) {
      if (!this.active || !this.assets) return;
      const A = this.assets, ins = SS.View.insets;
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-20, -20, vw + 40, vh + 40);
      const m = 12, L = ins.l + m, T = ins.t + m, R = vw - ins.r - m, B = vh - ins.b - m;
      this.shots[this.shot].draw.call(this, ctx, A, this.lt, { L, T, R, B, W: R - L, H: B - T, vw, vh, u });
      ctx.restore();
      // progress dots + skip (hit areas are added by the UI)
      const n = this.shots.length;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i === this.shot ? INK : 'rgba(22,20,26,0.25)';
        ctx.beginPath(); ctx.arc(vw / 2 + (i - (n - 1) / 2) * 14, vh - ins.b - 10, i === this.shot ? 4 : 3, 0, TAU); ctx.fill();
      }
    },

    shots: [
      { // 1. the fastest courier in the Old Quarter
        dur: 5.2,
        sfx() { this.once('h', 0.5, () => SS.Audio.sfx('horn', { vol: 0.9 })); this.once('w', 0.2, () => SS.Audio.sfx('whoosh')); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story;
          panel(ctx, F.L, F.T, F.W, F.H, lt, 'd', (x, y, w, h) => {
            street(ctx, A.bg, x, y, w, h, SS.View.w * 0.5, 360, 1.15, -lt * 40);
            speedLines(ctx, x, y + h * 0.35, w, h * 0.6, lt, -1, 26);
            const k = ease(lt / 1.6), bx = U.lerp(x - 260, x + w * 0.56, k);
            put(ctx, A.minhRide, bx, y + h * 0.93 + Math.sin(lt * 30) * 1.2);
            sfxText(ctx, S.vroom, x + w * 0.74, y + h * 0.36, 64, -0.12, '#ffffff', (lt - 0.6) * 1.6);
            caption(ctx, S.s1, x + 14, y + 14, Math.min(w * 0.55, 420), 17, (lt - 0.3) * 0.9);
          });
        },
      },
      { // 2. ran in with an order... and left the key in
        dur: 6.2,
        sfx() { this.once('t', 2.6, () => SS.Audio.sfx('star')); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story, g = 10, lw = F.W * 0.6;
          panel(ctx, F.L, F.T, lw, F.H, lt, 'l', (x, y, w, h) => {
            street(ctx, A.bg, x, y, w, h, A.cafeX, 330, 1.25, 0);
            put(ctx, A.parked, x + w * 0.24, y + h * 0.95);
            const f = A.minhWalk[Math.floor(lt * 7) % 4];
            put(ctx, f, x + w * 0.5 + Math.min(lt, 3) * 26, y + h * 0.95);
            caption(ctx, S.s2a, x + 12, y + 12, w - 24, 16, (lt - 0.2) * 0.8);
          });
          panel(ctx, F.L + lw + g, F.T, F.W - lw - g, F.H, lt - 1.7, 'r', (x, y, w, h) => {
            // close-up: the key, still in the ignition
            const cx = x + w * 0.5, cy = y + h * 0.56, r = Math.min(w, h) * 0.22;
            focusLines(ctx, x, y, w, h, cx, cy, r * 1.5, 70, 0);
            ctx.fillStyle = '#d8d2c4'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.25, r * 1.05, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = INK; ctx.fillRect(cx - r * 0.08, cy - r * 0.32, r * 0.16, r * 0.64);
            // key
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.5 + Math.sin(lt * 3) * 0.05);
            ctx.fillStyle = '#ffffff'; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.rect(-r * 0.12, -r * 1.1, r * 0.24, r * 0.9); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, -r * 1.42, r * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(0, -r * 1.42, r * 0.13, 0, TAU); ctx.fill(); ctx.stroke();
            // key ring + green tag
            ctx.beginPath(); ctx.arc(r * 0.4, -r * 1.85, r * 0.22, 0, TAU); ctx.stroke();
            ctx.fillStyle = GREEN(); ctx.beginPath(); ctx.rect(r * 0.4, -r * 2.05, r * 0.7, r * 0.42); ctx.fill(); ctx.stroke();
            ctx.restore();
            // glint
            const gk = U.clamp((lt - 2.5) * 3, 0, 1) * (1 - U.clamp((lt - 3.4) * 2, 0, 1));
            if (gk > 0) { ctx.save(); ctx.translate(cx - r * 0.9, cy - r * 1.45); ctx.rotate(lt * 2); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
              ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.12 : r * 0.55 * gk; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
            sfxText(ctx, S.ting, x + w * 0.3, y + h * 0.2, 34, -0.1, '#ffffff', (lt - 2.5) * 2);
            caption(ctx, S.s2b, x + w - 10, y + h - 64, w - 20, 16, (lt - 3.2) * 1.2, 'right');
          });
        },
      },
      { // 3. SNATCH!
        dur: 5.0,
        sfx() { this.once('s', 0.9, () => { SS.Audio.sfx('shatter'); SS.Audio.sfx('whoosh'); this.shake = 14; SS.Haptics.vibrate(30); }); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story;
          panel(ctx, F.L, F.T, F.W, F.H, lt, 'r', (x, y, w, h) => {
            focusLines(ctx, x, y, w, h, x + w * 0.62, y + h * 0.4, Math.min(w, h) * 0.32, 160, lt > 0.9 ? lt : 0);
            // tourist leans in from the right, then the hand snaps up with the key
            const k = ease((lt - 0.05) / 0.7), r = Math.min(h * 0.24, w * 0.12);
            drawTourist(ctx, U.lerp(x + w + r * 3, x + w * 0.72, k), y + h * 0.42, r, lt, (lt - 0.8) * 3);
            if (lt > 0.85) burst(ctx, x + w * 0.27, y + h * 0.42, 190, 92, 16, '#ffffff', INK, 21);
            sfxText(ctx, S.snatch, x + w * 0.27, y + h * 0.42, 70, -0.14, '#e8322a', (lt - 0.85) * 3, lt < 1.6 ? 6 : 0);
            balloon(ctx, S.tourist1, x + w * 0.34, y + h * 0.82, 260, 18, x + w * 0.62, y + h * 0.66, lt - 1.9);
          });
        },
      },
      { // 4. shock close-up
        dur: 3.8,
        sfx() { this.once('g', 0.25, () => { SS.Audio.sfx('gasp'); this.shake = 8; }); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story;
          panel(ctx, F.L, F.T, F.W, F.H, lt, 'u', (x, y, w, h) => {
            const cx = x + w * 0.5, cy = y + h * 0.6, r = Math.min(w * 0.2, h * 0.36);
            focusLines(ctx, x, y, w, h, cx, cy, r * 1.25, 190, lt);
            ctx.save(); ctx.translate(cx + (lt < 1 ? (Math.random() - 0.5) * 5 : 0), cy);
            ctx.strokeStyle = INK; ctx.lineWidth = 5;
            // face
            ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.ellipse(0, r * 0.08, r * 0.92, r * 1.02, 0, 0, TAU); ctx.fill(); ctx.stroke();
            // helmet (green, white stripe)
            ctx.fillStyle = GREEN(); ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 1.0, Math.PI * 1.02, TAU - 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.fillRect(-r * 0.08, -r * 1.16, r * 0.16, r * 0.95); ctx.strokeRect(-r * 0.08, -r * 1.16, r * 0.16, r * 0.95);
            // shock hatching on the forehead
            ctx.lineWidth = 2.5;
            for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.11, -r * 0.12); ctx.lineTo(i * r * 0.11, r * 0.16); ctx.stroke(); }
            // huge eyes, tiny trembling pupils
            ctx.lineWidth = 4;
            for (const s of [-1, 1]) {
              ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(s * r * 0.38, r * 0.32, r * 0.25, r * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
              ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * r * 0.38 + Math.sin(lt * 40 + s) * 1.5, r * 0.32, r * 0.05, 0, TAU); ctx.fill();
              ctx.beginPath(); ctx.moveTo(s * r * 0.2, r * -0.02); ctx.lineTo(s * r * 0.58, r * -0.12); ctx.stroke(); // brows up
            }
            // mouth wide open
            ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, r * 0.78, r * 0.26, r * 0.2 + Math.sin(lt * 18) * r * 0.02, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#d24a4a'; ctx.beginPath(); ctx.ellipse(0, r * 0.88, r * 0.14, r * 0.07, 0, 0, TAU); ctx.fill();
            // sweat drops
            ctx.fillStyle = '#ffffff'; ctx.lineWidth = 3;
            for (const [dx, dy, sz] of [[1.05, 0.0, 0.16], [1.2, 0.4, 0.11], [-1.1, 0.2, 0.13]]) {
              const yy = dy * r + ((lt * 30) % 20);
              ctx.beginPath(); ctx.moveTo(dx * r, yy - sz * r * 1.4); ctx.quadraticCurveTo(dx * r + sz * r, yy, dx * r, yy + sz * r * 0.6); ctx.quadraticCurveTo(dx * r - sz * r, yy, dx * r, yy - sz * r * 1.4); ctx.fill(); ctx.stroke();
            }
            ctx.restore();
            sfxText(ctx, S.troiOi, x + w * 0.5, y + h * 0.16, 72, -0.06, GREEN(), (lt - 0.2) * 2.5, 5);
          });
        },
      },
      { // 5. key gone, scooter gone
        dur: 5.4,
        sfx() { this.once('h', 0.4, () => SS.Audio.sfx('horn', { type: 2, vol: 0.9 })); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story;
          panel(ctx, F.L, F.T, F.W, F.H, lt, 'd', (x, y, w, h) => {
            street(ctx, A.bg, x, y, w, h, SS.View.w * 0.62, 360, 1.12, 0);
            speedLines(ctx, x, y + h * 0.45, w, h * 0.5, lt, 1, 18);
            const tx = x + w * 0.38 + lt * 190;
            put(ctx, A.touristRide, tx, y + h * 0.93 + Math.sin(lt * 30));
            balloon(ctx, S.tourist2, tx - 30, y + h * 0.3, 200, 17, tx - 40, y + h * 0.55, lt - 0.7);
            const f = A.minhRun[Math.floor(lt * 10) % 4];
            put(ctx, f, x + w * 0.12 + Math.min(lt, 2) * 40, y + h * 0.96 + Math.abs(Math.sin(lt * 10)) * -4);
            balloon(ctx, S.minhWait, x + w * 0.2, y + h * 0.34, 200, 17, x + w * 0.16, y + h * 0.6, lt - 1.4, true);
            caption(ctx, S.s5, x + w - 14, y + h - 58, Math.min(w * 0.55, 420), 17, (lt - 2.4) * 1.1, 'right');
          });
        },
      },
      { // 6. rain... and Bà Lan's idea
        dur: 7.4,
        sfx() { this.once('r', 0.1, () => SS.Audio.sfx('slosh')); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story, g = 10, lw = F.W * 0.48;
          panel(ctx, F.L, F.T, lw, F.H, lt, 'l', (x, y, w, h) => {
            // dark screentone sky + rain
            ctx.fillStyle = '#6d6a72'; ctx.fillRect(x, y, w, h);
            street(ctx, A.bg, x, y, w, h * 0.7, SS.View.w * 0.4, 250, 1.4, 0);
            ctx.fillStyle = 'rgba(22,20,26,0.35)'; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#c9c3b6'; ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
            put(ctx, A.minhSad, x + w * 0.5, y + h * 0.95);
            rain(ctx, x, y, w, h, lt);
            caption(ctx, S.s6, x + 12, y + 12, w - 24, 16, (lt - 0.3) * 1.2);
            balloon(ctx, S.minh2, x + w * 0.42, y + h * 0.42, 190, 15, x + w * 0.5, y + h * 0.62, lt - 4.4);
          });
          panel(ctx, F.L + lw + g, F.T, F.W - lw - g, F.H, lt - 1.6, 'r', (x, y, w, h) => {
            focusLines(ctx, x, y, w, h, x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.4, 60, 0);
            drawBaLan(ctx, x + w * 0.6, y + h * 0.52, Math.min(h * 0.17, w * 0.17), lt);
            balloon(ctx, S.baLan, x + w * 0.42, y + h * 0.14, Math.min(250, w * 0.66), 16, x + w * 0.55, y + h * 0.3, lt - 2.1, true);
          });
        },
      },
      { // 7. the goal (full colour)
        dur: 7, hold: true,
        sfx() { this.once('p', 0.2, () => SS.Audio.sfx('powerup')); this.once('c', 1.2, () => SS.Audio.sfx('coin')); },
        draw(ctx, A, lt, F) {
          const S = SS.STRINGS.story, { vw, vh } = F;
          const gr = ctx.createRadialGradient(vw / 2, vh * 0.55, 10, vw / 2, vh * 0.55, vw * 0.7);
          gr.addColorStop(0, '#ffe58a'); gr.addColorStop(0.55, '#f6a33a'); gr.addColorStop(1, '#c2412d');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
          // sunburst
          ctx.save(); ctx.translate(vw / 2, vh * 0.58); ctx.rotate(lt * 0.15); ctx.fillStyle = 'rgba(255,255,255,0.16)';
          for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, vw, (i / 18) * TAU, (i / 18) * TAU + TAU / 36); ctx.closePath(); ctx.fill(); }
          ctx.restore();
          for (let i = 0; i < 8; i++) { const a = lt * 1.2 + i * TAU / 8; Art.coin(ctx, vw / 2 + Math.cos(a) * 250, vh * 0.66 + Math.sin(a) * 80, 10, lt * 4 + i); }
          // the dream scooter (in colour), with Minh on it
          const k = ease(lt / 0.8), sc = 2.6 * (0.6 + 0.4 * k);
          ctx.save(); ctx.translate(vw / 2, vh * 0.8); ctx.scale(sc, sc);
          ctx.globalAlpha = 0.25; Art.ellipse(ctx, 0, 0, 50, 7, '#000'); ctx.globalAlpha = 1;
          const spr = Art.scooterSprite({ key: 'story_goal', kind: 'delivery', body: '#e8322a', riders: [{ role: 'driver', x: -6, shirt: SS.COL_PLAYER, helmet: SS.COL_PLAYER, stripe: true, skin: '#f0c9a0', pants: '#24262e', bag: SS.COL_PLAYER, headY: -60 }] }, 0);
          ctx.drawImage(spr.c, -spr.ox, -spr.oy + Math.sin(lt * 6) * 0.6, spr.w, spr.h);
          ctx.restore();
          // title + goal
          const ty = F.T + 34;
          sfxText(ctx, S.goalTitle, vw / 2, ty, 34, -0.03, '#ffd23f', (lt - 0.1) * 2);
          const fs = Math.min(30, vw / 26);
          sfxText(ctx, S.goal.replace('{n}', SS.CONFIG.SCOOTER_PRICE.toLocaleString('en-US')), vw / 2, ty + 52, fs, 0, '#ffffff', (lt - 0.6) * 2);
          if (lt > 1.4) {
            ctx.globalAlpha = U.clamp((lt - 1.4) * 2, 0, 1);
            ctx.font = SS.font(16, 700, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,10,10,0.7)'; ctx.strokeText(S.goalSub, vw / 2, ty + 92);
            ctx.fillStyle = '#ffffff'; ctx.fillText(S.goalSub, vw / 2, ty + 92);
            ctx.globalAlpha = 1;
          }
          if (lt > 2.4 && Math.floor(lt * 2) % 2 === 0) {
            ctx.font = SS.font(17, 800, true); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,10,10,0.7)';
            ctx.strokeText(S.tapToPlay, vw / 2, F.B - 26); ctx.fillText(S.tapToPlay, vw / 2, F.B - 26);
          }
        },
      },
    ],
  });
})();
