/* =====================================================================
 * Story — the opening cutscene as a paper cut-out animation.
 * ---------------------------------------------------------------------
 * A little paper theatre: cut-paper Hanoi street scenery, puppets with
 * pinned joints, choppy 12 fps "stop-motion" movement, paper drop
 * shadows and a paper grain. The puppets' faces (and Minh's CRAB box)
 * are cut straight out of the Banh Zai cover art (assets/ui/cover.jpg),
 * so the characters keep the cover's likeness; everything else is cut
 * paper drawn in code.
 *
 * SS.Story.start(onDone)  plays it; tap = next scene, SKIP = end.
 * Words live in SS.STRINGS.story.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const TAU = Math.PI * 2;
  const W = 960, H = 540;              // the paper stage (scaled to fit the screen)
  const FPS = 12;                      // stop-motion frame rate
  const step = (t) => Math.floor(t * FPS) / FPS;
  const ease = (k) => { k = U.clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const out3 = (k) => 1 - Math.pow(1 - U.clamp(k, 0, 1), 3);
  const INK = '#2a1a12', PAPER = '#fbf4e6';

  // pieces cut from the cover art (source pixels)
  const CUT = {
    minhHead: { cx: 742, cy: 330, rx: 47, ry: 61 },
    tourHead: { cx: 935, cy: 362, rx: 30, ry: 40 },
    box: [[570, 300], [652, 334], [646, 420], [612, 452], [535, 402]],
  };

  /* ---------------- paper rendering ---------------- */
  let grain = null;
  function makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = 200 + Math.random() * 55; d.data[i] = v; d.data[i + 1] = v * 0.97; d.data[i + 2] = v * 0.9; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    g.strokeStyle = 'rgba(120,90,60,0.18)'; g.lineWidth = 0.6;
    for (let i = 0; i < 40; i++) { const x = Math.random() * 128, y = Math.random() * 128, a = Math.random() * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke(); }
    grain = c;
  }
  // a cut paper shape: drop shadow + white cut edge + colour + grain
  function paper(ctx, path, fill, o) {
    o = o || {};
    const edge = o.edge == null ? 3 : o.edge;
    ctx.save();
    ctx.shadowColor = 'rgba(50,30,10,' + (o.shadow == null ? 0.38 : o.shadow) + ')'; ctx.shadowBlur = o.blur || 6; ctx.shadowOffsetX = o.sx == null ? 3 : o.sx; ctx.shadowOffsetY = o.sy == null ? 4 : o.sy;
    path(); ctx.fillStyle = PAPER; ctx.fill();
    if (edge) { ctx.lineWidth = edge * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = PAPER; ctx.stroke(); }
    ctx.restore();
    ctx.save(); path(); ctx.fillStyle = fill; ctx.fill();
    if (grain && !o.noGrain) { ctx.clip(); ctx.globalAlpha = 0.16; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fill(); }
    ctx.restore();
  }
  const rect = (ctx, x, y, w, h, r) => () => { ctx.beginPath(); if (r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); } else ctx.rect(x, y, w, h); };
  const poly = (ctx, pts) => () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const ellipse = (ctx, x, y, rx, ry) => () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); };
  // hand-cut look: wobble a polygon's points a little
  function rough(pts, seed, amt) { const r = U.rng(seed); return pts.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]); }
  // brass split pin at a joint
  function pin(ctx, x, y) { ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,240,190,0.9)'; ctx.beginPath(); ctx.arc(x - 0.8, y - 0.8, 0.9, 0, TAU); ctx.fill(); }
  // a limb strip from its pivot, pointing down at angle a
  function limb(ctx, x, y, a, len, w, fill, end) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    paper(ctx, rect(ctx, -w / 2, -w / 2, w, len + w / 2, w / 2), fill, { edge: 2, blur: 3, sx: 2, sy: 2 });
    if (end) end(ctx, len);
    ctx.restore();
    pin(ctx, x, y);
    return [x - Math.sin(a) * len, y + Math.cos(a) * len];
  }
  // a piece of the cover art, cut out with a paper edge
  function cutHead(ctx, img, c, x, y, h, rot) {
    const k = h / (c.ry * 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(k, k);
    paper(ctx, ellipse(ctx, 0, 0, c.rx + 3, c.ry + 3), PAPER, { edge: 0, noGrain: true });
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, TAU); ctx.clip();
    ctx.drawImage(img, -c.cx, -c.cy);
    ctx.restore(); ctx.restore();
  }
  function cutPoly(ctx, img, pts, x, y, scale, rot) {
    let cx = 0, cy = 0; pts.forEach(([a, b]) => { cx += a; cy += b; }); cx /= pts.length; cy /= pts.length;
    const local = pts.map(([a, b]) => [a - cx, b - cy]);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(scale, scale);
    paper(ctx, poly(ctx, local), PAPER, { edge: 3, noGrain: true });
    ctx.save(); poly(ctx, local)(); ctx.clip(); ctx.drawImage(img, -cx, -cy); ctx.restore();
    ctx.restore();
  }

  /* ---------------- puppets ---------------- */
  // pose: { walk: phase (or null), sit, armF, armB, lean, jump }
  function minh(ctx, img, x, y, s, flip, pose, t) {
    pose = pose || {};
    const r = U.rng(Math.floor(t * FPS) + 3);
    ctx.save(); ctx.translate(x, y - (pose.jump || 0)); ctx.scale(s * (flip ? -1 : 1), s); ctx.rotate((pose.lean || 0) + (r() - 0.5) * 0.02);
    const wph = pose.walk;
    const bob = wph != null ? -Math.abs(Math.sin(wph)) * 4 : 0;
    ctx.translate(0, bob);
    const hipY = pose.sit ? -62 : -72;
    const legA = wph != null ? Math.sin(wph) * 0.5 : 0;
    // back leg, back arm
    const shoe = (c, len) => paper(c, ellipse(c, 5, len + 2, 11, 6), '#3a3d44', { edge: 1.5, blur: 2, sx: 1, sy: 1 });
    if (pose.sit) { const k = limb(ctx, -4, hipY, -1.45, 34, 17, '#4a3426'); limb(ctx, k[0], k[1], 0.05, 32, 15, '#4a3426', shoe); }
    else { const k = limb(ctx, -4, hipY, -legA, 36, 17, '#3d2b20'); limb(ctx, k[0], k[1], Math.max(0, legA) * 0.6, 34, 15, '#3d2b20', shoe); }
    limb(ctx, -6, -134, pose.armB != null ? pose.armB : -legA * 0.8, 30, 13, '#23843c', (c, len) => paper(c, ellipse(c, 0, len + 4, 6, 6), '#e2a77c', { edge: 1, blur: 1 }));
    // CRAB box (cut from the cover) on his back
    if (!pose.noBox) cutPoly(ctx, img, CUT.box, -34, -118, 0.62, -0.08);
    // torso: green zip jacket
    paper(ctx, poly(ctx, rough([[-22, -144], [22, -144], [26, -70], [-24, -70]], 7, 2)), '#2a9a45');
    ctx.strokeStyle = 'rgba(20,60,30,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, -140); ctx.lineTo(7, -74); ctx.stroke();
    paper(ctx, poly(ctx, [[-10, -146], [12, -146], [2, -134]]), '#1f7a36', { edge: 1, blur: 1 });
    // front leg
    if (pose.sit) { const k = limb(ctx, 6, hipY, -1.5, 34, 17, '#4a3426'); limb(ctx, k[0], k[1], -0.05, 32, 15, '#4a3426', shoe); }
    else { const k = limb(ctx, 6, hipY, legA, 36, 17, '#4a3426'); limb(ctx, k[0], k[1], Math.max(0, -legA) * 0.6, 34, 15, '#4a3426', shoe); }
    // head (cut from the cover)
    cutHead(ctx, img, CUT.minhHead, 8, -176, 66 * (pose.headScale || 1), (pose.headRot || 0) + (r() - 0.5) * 0.04);
    // front arm (+ optional held item)
    const hand = (c, len) => { paper(c, ellipse(c, 0, len + 4, 6.5, 6.5), '#e9b98f', { edge: 1, blur: 1 }); if (pose.hold) pose.hold(c, len); };
    limb(ctx, 8, -134, pose.armF != null ? pose.armF : legA * 0.8, 30, 13, '#2a9a45', hand);
    ctx.restore();
  }
  function tourist(ctx, img, x, y, s, flip, pose, t) {
    pose = pose || {};
    const r = U.rng(Math.floor(t * FPS) + 11);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s); ctx.rotate((pose.lean || 0) + (r() - 0.5) * 0.02);
    const wph = pose.walk, legA = wph != null ? Math.sin(wph) * 0.45 : 0;
    ctx.translate(0, wph != null ? -Math.abs(Math.sin(wph)) * 4 : 0);
    const hipY = pose.sit ? -60 : -74;
    const flop = (c, len) => { paper(c, ellipse(c, 5, len + 3, 12, 4), '#d8322a', { edge: 1.5, blur: 2, sx: 1, sy: 1 }); paper(c, ellipse(c, 3, len, 8, 4.5), '#f2b7a6', { edge: 0, blur: 0, shadow: 0 }); };
    const legs = (ox, a, col) => {
      if (pose.sit) { const k = limb(ctx, ox, hipY, -1.4, 32, 22, '#3b6ea5'); limb(ctx, k[0], k[1], 0.05, 30, 14, '#f2b7a6', flop); }
      else { const k = limb(ctx, ox, hipY, a, 30, 22, col); limb(ctx, k[0], k[1], 0, 36, 14, '#f2b7a6', flop); }
    };
    legs(-6, -legA, '#335f90');
    limb(ctx, -10, -138, pose.armB != null ? pose.armB : -legA, 32, 15, '#f2b7a6', (c, len) => paper(c, ellipse(c, 0, len + 4, 7, 7), '#f2b7a6', { edge: 1, blur: 1 }));
    // belly + white tank top
    paper(ctx, poly(ctx, rough([[-26, -148], [24, -148], [34, -96], [26, -70], [-28, -70], [-34, -100]], 5, 2)), '#f2b7a6');
    paper(ctx, poly(ctx, rough([[-18, -146], [-8, -132], [8, -132], [18, -146], [30, -98], [24, -72], [-26, -72], [-30, -100]], 9, 1.5)), '#fbfaf5', { edge: 1, blur: 2 });
    // cargo shorts with a pocket
    paper(ctx, poly(ctx, [[-28, -78], [28, -78], [30, -56], [-30, -56]]), '#3b6ea5', { edge: 2, blur: 2 });
    paper(ctx, rect(ctx, 12, -74, 12, 12, 2), '#335f90', { edge: 1, blur: 1 });
    legs(8, legA, '#3b6ea5');
    cutHead(ctx, img, CUT.tourHead, 4, -178, 62 * (pose.headScale || 1), (pose.headRot || 0) + (r() - 0.5) * 0.04);
    const hand = (c, len) => { paper(c, ellipse(c, 0, len + 4, 7, 7), '#f2b7a6', { edge: 1, blur: 1 }); if (pose.hold) pose.hold(c, len); };
    limb(ctx, 12, -138, pose.armF != null ? pose.armF : legA, 32, 15, '#f2b7a6', hand);
    ctx.restore();
  }
  // Bà Lan: conical hat, white blouse, black trousers, ladle
  function baLan(ctx, x, y, s, flip, pose, t) {
    pose = pose || {};
    const r = U.rng(Math.floor(t * FPS) + 17);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s); ctx.rotate((r() - 0.5) * 0.02);
    const wph = pose.walk, legA = wph != null ? Math.sin(wph) * 0.35 : 0;
    ctx.translate(0, wph != null ? -Math.abs(Math.sin(wph)) * 3 : 0);
    const foot = (c, len) => paper(c, ellipse(c, 4, len + 2, 9, 4), '#5a3a22', { edge: 1, blur: 1 });
    limb(ctx, -4, -66, -legA, 64, 14, '#26232a', foot);
    limb(ctx, -6, -126, -legA * 0.6, 50, 11, '#f4efe2', (c, len) => paper(c, ellipse(c, 0, len + 3, 5, 5), '#d9a77a', { edge: 1, blur: 1 }));
    paper(ctx, poly(ctx, rough([[-18, -132], [18, -132], [22, -62], [-22, -62]], 3, 2)), '#f4efe2');
    ctx.fillStyle = INK; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(3, -122 + i * 18, 1.8, 0, TAU); ctx.fill(); }
    limb(ctx, 6, -66, legA, 64, 14, '#2e2a31', foot);
    // face (cut paper) + features
    paper(ctx, ellipse(ctx, 4, -150, 16, 19), '#e6bf98');
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, -154); ctx.lineTo(10, -155); ctx.moveTo(14, -154); ctx.lineTo(19, -153); ctx.stroke();      // eyes
    ctx.beginPath(); ctx.moveTo(2, -161); ctx.lineTo(10, -164); ctx.moveTo(13, -164); ctx.lineTo(20, -161); ctx.stroke();      // stern brows
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(13, -141, 4, pose.talk ? 3 + Math.abs(Math.sin(t * 14)) * 2 : 1.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,30,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -146); ctx.lineTo(-2, -144); ctx.stroke();
    // nón lá
    paper(ctx, poly(ctx, [[-34, -160], [6, -196], [44, -160]]), '#e9d49a');
    ctx.strokeStyle = 'rgba(140,110,50,0.55)'; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const k = i / 5; ctx.beginPath(); ctx.moveTo(6 - 40 * k, -196 + 36 * k); ctx.lineTo(6 + 38 * k, -196 + 36 * k); ctx.stroke(); }
    // ladle arm, pointing
    limb(ctx, 8, -126, pose.armF != null ? pose.armF : -2.0 + Math.sin(t * 8) * 0.15, 48, 11, '#f4efe2', (c, len) => {
      paper(c, ellipse(c, 0, len + 3, 5, 5), '#d9a77a', { edge: 1, blur: 1 });
      paper(c, rect(c, -2, len + 4, 4, 40), '#b9b4aa', { edge: 1, blur: 1 });
      paper(c, ellipse(c, 0, len + 48, 10, 7), '#b9b4aa', { edge: 1, blur: 1 });
    });
    ctx.restore();
  }
  // paper scooter (faces right). opts: { col, key: draw key in ignition, riderGap }
  function scooter(ctx, x, y, s, flip, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s);
    const wr = o.moving ? t * 14 : 0;
    const wheel = (wx) => { ctx.save(); ctx.translate(wx, -20); paper(ctx, ellipse(ctx, 0, 0, 20, 20), '#1d1d22', { edge: 2 }); ctx.rotate(step(wr)); ctx.fillStyle = '#9a9aa2'; ctx.fillRect(-12, -2, 24, 4); ctx.fillRect(-2, -12, 4, 24); ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.restore(); };
    wheel(-58); wheel(56);
    const col = o.col || '#4a4d57', dark = U.shade(col, -0.3);
    paper(ctx, poly(ctx, rough([[-104, -36], [-100, -66], [-80, -84], [-20, -86], [-6, -62], [-8, -36]], 21, 2)), col);   // rear body
    paper(ctx, poly(ctx, [[-14, -40], [44, -40], [46, -28], [-14, -28]]), dark, { edge: 2 });                                // floorboard
    paper(ctx, poly(ctx, rough([[36, -30], [58, -30], [84, -112], [66, -116], [50, -66]], 22, 2)), col);                     // front apron
    paper(ctx, poly(ctx, [[34, -26], [44, -44], [70, -46], [80, -26]]), dark, { edge: 2 });                                  // front fender
    paper(ctx, rect(ctx, -92, -100, 78, 16, 8), '#26262c', { edge: 2 });                                                     // seat
    paper(ctx, rect(ctx, 60, -128, 44, 9, 4), '#2a2a30', { edge: 2 });                                                       // handlebar
    paper(ctx, ellipse(ctx, 88, -110, 9, 8), '#ffe9a8', { edge: 2 });                                                        // headlight
    paper(ctx, rect(ctx, -110, -62, 14, 9, 3), '#c8321e', { edge: 1 });                                                      // tail light
    paper(ctx, rect(ctx, -84, -32, 46, 6, 3), '#9a9aa2', { edge: 1, blur: 2 });                                              // exhaust
    if (o.key) { ctx.save(); ctx.translate(58, -92); ctx.rotate(-0.4); keyShape(ctx, 0.7); ctx.restore(); }
    ctx.restore();
  }
  function keyShape(ctx, s) {
    ctx.save(); ctx.scale(s, s);
    paper(ctx, rect(ctx, -3, -6, 6, 22, 2), '#d9dde2', { edge: 1.5, blur: 2 });
    paper(ctx, ellipse(ctx, 0, -14, 9, 9), '#d9dde2', { edge: 1.5, blur: 2 });
    paper(ctx, rect(ctx, 8, -34, 24, 13, 2), SS.COL_PLAYER, { edge: 1.5, blur: 2 });
    ctx.restore();
  }
  // traffic on sticks (stick puppets), for the background
  function stickBike(ctx, x, y, s, col, rider, t, dir) {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 10 * s); ctx.lineTo(x + 6, H + 20); ctx.stroke();
    scooter(ctx, x, y, s, dir < 0, t, { col, moving: true });
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (dir < 0 ? -1 : 1), s);
    paper(ctx, rect(ctx, -26, -150, 34, 56, 10), rider, { edge: 2 });
    paper(ctx, ellipse(ctx, -8, -170, 18, 18), ['#e9b98f', '#d9a77a', '#c48b5f'][Math.abs(Math.round(x)) % 3], { edge: 2 });
    paper(ctx, poly(ctx, [[-28, -176], [-6, -196], [14, -176]]), ['#e14b3b', '#f2c230', '#3d7fd0', '#f4f4f0'][Math.abs(Math.round(y)) % 4], { edge: 2 });
    ctx.restore();
  }

  /* ---------------- scenery ---------------- */
  function sky(ctx, a, b) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400); if (grain) { ctx.save(); ctx.globalAlpha = 0.18; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore(); } }
  function streetSet(ctx, t, o) {
    o = o || {};
    sky(ctx, o.rain ? '#5c6a82' : '#f3b56c', o.rain ? '#8a93a6' : '#f6d9a2');
    if (!o.rain) paper(ctx, ellipse(ctx, 780, 110, 46, 46), '#fff1c4', { edge: 0, shadow: 0.15 });
    // far tube houses
    const far = ['#c98f62', '#b9886a', '#d3a26e', '#a8826a', '#c79a74'];
    for (let i = 0; i < 13; i++) {
      const x = -280 + i * 118, h = 150 + ((i * 37) % 70);
      paper(ctx, poly(ctx, rough([[x, 330], [x, 330 - h], [x + 112, 330 - h - 8], [x + 112, 330]], 30 + i, 4)), o.rain ? U.shade(far[i % 5], -0.3) : far[i % 5], { shadow: 0.25 });
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 2; wx++) paper(ctx, rect(ctx, x + 18 + wx * 50, 330 - h + 26 + wy * 42, 26, 24, 2), o.rain ? '#3b4256' : (wy + i) % 3 ? '#5a6d7a' : '#ffd98a', { edge: 1, blur: 2, shadow: 0.2 });
    }
    // the café (the one sign word on screen is a real Vietnamese one)
    paper(ctx, rect(ctx, 410, 200, 280, 180), o.rain ? '#7a8a7a' : '#4f8f84');
    paper(ctx, rect(ctx, 440, 260, 90, 120, 4), '#2a2026', { edge: 2 });                                 // door
    paper(ctx, rect(ctx, 560, 270, 100, 70, 4), o.rain ? '#4b5368' : '#ffd98a', { edge: 2 });            // window glow
    const stripes = 8;
    for (let i = 0; i < stripes; i++) paper(ctx, poly(ctx, [[400 + i * 37.5, 236], [437.5 + i * 37.5, 236], [442 + i * 37.5, 262], [404 + i * 37.5, 262]]), i % 2 ? '#fbf4e6' : '#d8433a', { edge: 1, blur: 2 });
    ctx.save(); ctx.translate(550, 214); ctx.rotate(-0.02);
    paper(ctx, rect(ctx, -86, -22, 172, 40, 6), '#2a1a12');
    ctx.font = SS.font(26, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd47a'; ctx.fillText('CÀ PHÊ', 0, 0);
    ctx.restore();
    // footpath + road
    paper(ctx, rect(ctx, -320, 376, W + 640, 44), o.rain ? '#8d8a84' : '#d8c3a0', { shadow: 0.2 });
    paper(ctx, rect(ctx, -320, 418, W + 640, 160), o.rain ? '#4a4d55' : '#6b6a70', { shadow: 0.3 });
    for (let i = 0; i < 13; i++) paper(ctx, rect(ctx, -270 + i * 120, 490, 60, 6, 2), '#efe6d2', { edge: 0, shadow: 0.1 });
    // wires + swinging paper lanterns
    ctx.strokeStyle = '#2a2026'; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(-300, 110 + k * 22); ctx.quadraticCurveTo(W / 2, 170 + k * 22, W + 300, 100 + k * 22); ctx.stroke(); }
    const lxs = [-120, 40, 200, 340, 760, 900, 1050];
    for (let i = 0; i < lxs.length; i++) {
      const lx = lxs[i], ly = 128 + Math.sin(((lx + 300) / (W + 600)) * Math.PI) * 26, sw = Math.sin(step(t) * 2 + i) * 0.12;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(sw);
      ctx.strokeStyle = '#2a2026'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 6); ctx.stroke();
      paper(ctx, ellipse(ctx, 0, 22, 14, 17), i % 2 ? '#e8432d' : '#f2a33a', { edge: 2 });
      ctx.restore();
    }
  }
  function rainOver(ctx, t) {
    const r = U.rng(5); const tt = step(t);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y0 = r() * H, sp = 260 + r() * 120, y = ((y0 + tt * sp) % (H + 60)) - 30;
      paper(ctx, poly(ctx, [[x, y], [x + 4, y + 12], [x, y + 16], [x - 4, y + 12]]), '#cfe3ff', { edge: 0, shadow: 0.15, blur: 1, sx: 1, sy: 1, noGrain: true });
    }
  }

  /* ---------------- words: cut-out letters, captions, balloons ---------------- */
  function cutLetters(ctx, text, x, y, size, k, palette, seed) {
    if (k <= 0) return;
    const chars = [...text], r = U.rng(seed || 3);
    ctx.font = SS.font(size, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const widths = chars.map((c) => (c === ' ' ? size * 0.4 : ctx.measureText(c).width + size * 0.3));
    let tw = widths.reduce((a, b) => a + b, 0), cx = x - tw / 2;
    chars.forEach((c, i) => {
      const w = widths[i], rot = (r() - 0.5) * 0.35, dy = (r() - 0.5) * size * 0.15, col = palette[Math.floor(r() * palette.length)];
      const ki = U.clamp(k * chars.length * 0.6 - i * 0.6, 0, 1);
      if (c !== ' ' && ki > 0) {
        const pop = ki < 1 ? 0.4 + ki * 0.8 : 1;
        ctx.save(); ctx.translate(cx + w / 2, y + dy); ctx.rotate(rot); ctx.scale(pop, pop);
        paper(ctx, rect(ctx, -w / 2 + 2, -size * 0.62, w - 4, size * 1.24, 4), col, { edge: 2 });
        ctx.fillStyle = col === '#fbf4e6' || col === '#ffd47a' ? INK : '#fffaf0'; ctx.fillText(c, 0, size * 0.05);
        ctx.restore();
      }
      cx += w;
    });
  }
  function caption(ctx, text, x, y, maxW, k) {
    if (k <= 0) return;
    ctx.font = SS.font(19, 700, false);
    const lines = SS.UI.wrap(ctx, text, maxW - 36), lh = 25, w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36), h = lines.length * lh + 22;
    const slide = (1 - out3(k * 2.5)) * -40;
    ctx.save(); ctx.translate(x, y + slide); ctx.rotate(-0.015);
    // torn paper strip
    const pts = []; const r = U.rng(text.length);
    for (let i = 0; i <= 12; i++) pts.push([i * w / 12, (r() - 0.5) * 5]);
    for (let i = 12; i >= 0; i--) pts.push([i * w / 12, h + (r() - 0.5) * 6]);
    paper(ctx, poly(ctx, pts), '#fffaf0', { edge: 0 });
    let left = Math.ceil(text.length * U.clamp(k * 1.2, 0, 1));
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; ctx.fillText(part, 18, 12 + i * lh); });
    ctx.restore();
  }
  function balloon(ctx, text, x, y, maxW, tx, ty, k, shout) {
    if (k <= 0) return;
    const s = out3(k * 3);
    ctx.font = SS.font(19, 800, true);
    const lines = SS.UI.wrap(ctx, text, maxW), lh = 22, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34, h = lines.length * lh + 22;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const ax = (tx - x) / s, ay = (ty - y) / s;
    const shape = () => {
      ctx.beginPath();
      if (shout) { const r = U.rng(4); for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, kk = i % 2 ? 0.86 : 1.1 + r() * 0.08; const px = Math.cos(a) * w * 0.6 * kk, py = Math.sin(a) * h * 0.72 * kk; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); }
      else ctx.ellipse(0, 0, w * 0.6, h * 0.66, 0, 0, TAU);
      ctx.moveTo(-10, h * 0.3); ctx.lineTo(ax, ay); ctx.lineTo(12, h * 0.36);
    };
    paper(ctx, shape, '#fffaf0', { edge: 2 });
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }
  function sparkle(ctx, x, y, k) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    paper(ctx, poly(ctx, [[0, -26], [6, -6], [26, 0], [6, 6], [0, 26], [-6, 6], [-26, 0], [-6, -6]]), '#fff6c0', { edge: 2 });
    ctx.restore();
  }
  function puff(ctx, x, y, r) { paper(ctx, ellipse(ctx, x, y, r, r * 0.8), '#e6e1d6', { edge: 2, shadow: 0.2 }); }

  /* ---------------- the player ---------------- */
  const Story = (SS.Story = {
    active: false, shot: 0, lt: 0, t: 0, shake: 0, imgs: null, wipe: 0,

    start(onDone) {
      this.onDone = onDone; this.shot = 0; this.lt = 0; this.t = 0; this.active = true; this.fired = {}; this.shake = 0; this.wipe = 0;
      this.loading = true;
      this.load().then((ok) => { this.loading = false; if (!ok) this.finish(); else { this.lt = 0; SS.Audio.duckMusic(0.55); } });
    },
    load() {
      if (this.imgs) return Promise.resolve(true);
      return new Promise((res) => {
        const i = new Image();
        i.onload = () => { this.imgs = { cover: i }; if (!grain) makeGrain(); res(true); };
        i.onerror = () => res(false);
        i.src = 'assets/ui/cover.jpg';
      });
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
      this.shot++; this.lt = 0; this.fired = {}; this.wipe = 1;
    },
    once(id, at, fn) { if (this.lt >= at && !this.fired[id]) { this.fired[id] = true; fn(); } },

    update(dt) {
      if (!this.active || this.loading) return;
      this.t += dt; this.lt += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      this.wipe = Math.max(0, this.wipe - dt * 2.4);
      const sh = this.shots[this.shot];
      if (sh.sfx) sh.sfx.call(this);
      if (this.lt >= sh.dur && !sh.hold) this.next();
    },

    draw(ctx, vw, vh, u) {
      ctx.fillStyle = '#2a1f18'; ctx.fillRect(0, 0, vw, vh);
      if (!this.active || this.loading || !this.imgs) return;
      // fit the paper stage to the screen (fill the width; the scenery runs past the edges)
      const sc = Math.min(vw / W * 1.25, vh / H), ox = (vw - W * sc) / 2, oy = (vh - H * sc) / 2;
      const sh = this.shots[this.shot];
      const cam = sh.cam ? sh.cam(this.lt) : { x: W / 2, y: H / 2, z: 1 };
      ctx.save();
      ctx.translate(ox + W * sc / 2, oy + H * sc / 2);
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      ctx.scale(sc * cam.z, sc * cam.z);
      ctx.translate(-cam.x, -cam.y);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      sh.draw.call(this, ctx, this.lt, this.imgs.cover);
      ctx.restore();
      // screen-space words
      if (sh.words) sh.words.call(this, ctx, this.lt, vw, vh, SS.STRINGS.story);
      // paper wipe between scenes
      if (this.wipe > 0) {
        const x = vw * (1 - ease(1 - this.wipe)) * 1.2 - vw * 0.1;
        ctx.save(); ctx.fillStyle = '#efe2c8';
        ctx.beginPath(); ctx.moveTo(x, -10); const r = U.rng(2);
        for (let y = 0; y <= vh + 20; y += 24) ctx.lineTo(x + (r() - 0.5) * 18, y);
        ctx.lineTo(vw + 10, vh + 10); ctx.lineTo(vw + 10, -10); ctx.closePath();
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = -6; ctx.fill();
        ctx.restore();
      }
      // progress dots
      const n = this.shots.length;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i === this.shot ? '#f39a3b' : 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(vw / 2 + (i - (n - 1) / 2) * 14, vh - 12, i === this.shot ? 4 : 3, 0, TAU); ctx.fill(); }
    },

    shots: [
      { // 1. Minh rides into the Old Quarter and parks at the café
        dur: 6.5,
        sfx() { this.once('h', 0.4, () => SS.Audio.sfx('horn', { vol: 0.7 })); this.once('h2', 3.3, () => SS.Audio.sfx('horn', { type: 2, vol: 0.5 })); },
        draw(ctx, lt, img) {
          const t = step(lt);
          streetSet(ctx, lt);
          stickBike(ctx, 1250 - ((t * 260) % 1600), 455, 0.5, '#3a6ea5', '#3d7fd0', t, -1);
          const k = ease(t / 3.2), x = U.lerp(-200, 470, k), bump = t < 3.2 ? Math.sin(t * 30) * 1.5 : 0;
          scooter(ctx, x, 470 + bump, 0.95, false, t, { col: '#c8321e', moving: t < 3.2 });
          minh(ctx, img, x - 22, 452 + bump, 0.92, false, { sit: true, armF: -1.2, armB: -1.1, lean: 0.08 }, t);
          if (t < 3.2) for (let i = 0; i < 3; i++) puff(ctx, x - 110 - i * 26 - (t * 40) % 26, 450 - i * 6, 10 + i * 3);
          stickBike(ctx, -260 + ((t * 300 + 600) % 1500), 528, 0.6, '#2f7f74', '#e8e2d0', t, 1);
        },
        words(ctx, lt, vw, vh, S) {
          caption(ctx, S.s1p, vw * 0.04, vh * 0.05, Math.min(vw * 0.6, 560), (lt - 0.3) * 0.6);
          cutLetters(ctx, S.vroom, vw * 0.72, vh * 0.3, 40, (lt - 0.5) * 1.2, ['#f39a3b', '#e8432d', '#ffd47a'], 5);
        },
      },
      { // 2. he hops off, the key stays in, he runs inside
        dur: 6.5,
        sfx() { this.once('t', 2.2, () => SS.Audio.sfx('star')); },
        draw(ctx, lt, img) {
          const t = step(lt);
          streetSet(ctx, lt);
          // hop off (arc), then walk to the door and shrink into it
          let x, y, sc = 0.92, pose;
          if (t < 0.8) { const k = t / 0.8; x = U.lerp(448, 380, k); y = U.lerp(452, 398, k) - Math.sin(k * Math.PI) * 50; pose = { armF: -2.4, armB: -2.2 }; }
          else if (t < 4.6) { const k = (t - 0.8) / 3.8; x = U.lerp(380, 488, k); y = 398; pose = { walk: t * 9, hold: (c, len) => paper(c, rect(c, -9, len, 18, 22, 3), '#d8433a', { edge: 1.5 }) }; sc = U.lerp(0.92, 0.6, ease((t - 3.2) / 1.4)); }
          else { x = 488; y = 380; sc = 0; }
          if (sc > 0) minh(ctx, img, x, y, sc, false, pose, t);
          scooter(ctx, 470, 470, 0.95, false, t, { col: '#c8321e', key: true });
          sparkle(ctx, 500, 372, U.clamp((t - 2.2) * 4, 0, 1) * (1 - U.clamp((t - 3.4) * 2, 0, 1)));
        },
        words(ctx, lt, vw, vh, S) {
          caption(ctx, S.s2p, vw * 0.04, vh * 0.05, Math.min(vw * 0.6, 560), (lt - 0.2) * 0.55);
          cutLetters(ctx, S.ting, vw * 0.62, vh * 0.42, 30, (lt - 2.2) * 2, ['#fbf4e6', '#ffd47a'], 8);
        },
      },
      { // 3. the tourist strolls in, spots the key, snatches it
        dur: 6.5,
        sfx() { this.once('s', 3.3, () => { SS.Audio.sfx('shatter'); SS.Audio.sfx('whoosh'); this.shake = 14; SS.Haptics.vibrate(30); }); this.once('e', 2.2, () => SS.Audio.sfx('pickup')); },
        cam: (lt) => ({ x: U.lerp(480, 560, ease((lt - 2) / 1.5)), y: U.lerp(270, 300, ease((lt - 2) / 1.5)), z: U.lerp(1, 1.35, ease((lt - 2) / 1.5)) }),
        draw(ctx, lt, img) {
          const t = step(lt);
          streetSet(ctx, lt);
          const hasKey = t >= 3.3;
          scooter(ctx, 470, 470, 0.95, false, t, { col: '#c8321e', key: !hasKey });
          const x = t < 2 ? U.lerp(1080, 640, t / 2) : 640;
          const reach = t < 2.8 ? 0 : t < 3.3 ? ease((t - 2.8) / 0.5) : 1 - ease((t - 3.5) / 0.6);
          tourist(ctx, img, x, 404, 0.95, true, {
            walk: t < 2 ? t * 8 : null, lean: reach * 0.25,
            armF: t < 2 ? null : -0.6 - reach * 1.3,
            hold: hasKey ? (c, len) => { c.save(); c.translate(0, len + 10); c.rotate(Math.sin(t * 10) * 0.3); keyShape(c, 0.55); c.restore(); } : null,
          }, t);
          if (t >= 2 && t < 3) cutLetters(ctx, '!', x + 6, 170, 40, (t - 2) * 3, ['#e8432d'], 2);
        },
        words(ctx, lt, vw, vh, S) {
          cutLetters(ctx, S.snatch, vw * 0.32, vh * 0.26, 46, (lt - 3.3) * 2.5, ['#e8432d', '#f39a3b', '#ffd47a', '#2a1a12'], 12);
          balloon(ctx, S.tourist1, vw * 0.7, vh * 0.2, 260, vw * 0.62, vh * 0.34, lt - 4.1);
        },
      },
      { // 4. he rides off on Minh's scooter; Minh comes out: TRỜI ƠI!!
        dur: 6.5,
        sfx() { this.once('h', 0.3, () => SS.Audio.sfx('horn', { type: 2, vol: 0.9 })); this.once('g', 3.2, () => { SS.Audio.sfx('gasp'); this.shake = 10; }); },
        cam: (lt) => { const k = ease((lt - 3.0) / 0.5); return { x: U.lerp(480, 470, k), y: U.lerp(270, 250, k), z: U.lerp(1, 1.9, k) }; },
        draw(ctx, lt, img) {
          const t = step(lt);
          streetSet(ctx, lt);
          const sx = 470 + Math.max(0, t - 0.2) * 420;
          if (sx < 1300) {
            scooter(ctx, sx, 470, 0.95, false, t, { col: '#c8321e', moving: true });
            tourist(ctx, img, sx - 20, 452, 0.92, false, { sit: true, armF: -1.3, armB: -1.2, lean: 0.06 }, t);
            for (let i = 0; i < 3; i++) puff(ctx, sx - 120 - i * 28, 448 - i * 8, 11 + i * 4);
          }
          // Minh steps out of the café with the coffee
          if (t > 1.6) {
            const k = ease((t - 1.6) / 1.0);
            minh(ctx, img, U.lerp(488, 470, k), 404, U.lerp(0.6, 0.95, k), false, {
              armF: -1.0, armB: t > 3.1 ? -2.6 : 0.2, headScale: t > 3.1 ? 1.25 : 1,
              hold: t < 3.1 ? (c, len) => { paper(c, rect(c, -8, len - 2, 16, 24, 3), '#c98f62', { edge: 1.5 }); paper(c, rect(c, -1, len - 14, 3, 14), '#f4efe2', { edge: 1 }); } : null,
            }, t);
          }
          if (t > 3.1) { const k = U.clamp((t - 3.1) / 0.6, 0, 1); paper(ctx, ellipse(ctx, 520, 410 + k * 4, 22 * k + 2, 6 * k + 1), '#7a4a2a', { edge: 1, shadow: 0.1 }); }
        },
        words(ctx, lt, vw, vh, S) {
          balloon(ctx, S.tourist2, vw * 0.8, vh * 0.2, 220, vw * 0.9, vh * 0.42, lt - 0.6);
          cutLetters(ctx, S.troiOi, vw * 0.5, vh * 0.16, 52, (lt - 3.2) * 2.2, ['#2a9a45', '#1f7a36', '#fbf4e6'], 21);
          caption(ctx, S.s5, vw * 0.04, vh * 0.78, Math.min(vw * 0.6, 520), (lt - 4.4) * 1.2);
        },
      },
      { // 5. rain... and Bà Lan
        dur: 8.0,
        sfx() { this.once('r', 0.1, () => SS.Audio.sfx('slosh')); },
        draw(ctx, lt, img) {
          const t = step(lt);
          streetSet(ctx, lt, { rain: true });
          // blue plastic stool + sad Minh
          paper(ctx, rect(ctx, 398, 330, 48, 76, 5), '#3d7fd0'); paper(ctx, rect(ctx, 404, 352, 36, 8, 2), '#2f63a8', { edge: 0, shadow: 0 });
          minh(ctx, img, 420, 388, 0.92, false, { sit: true, armF: -0.6, armB: -0.4, headRot: 0.18, lean: 0.12 }, t);
          // Bà Lan walks in from the left
          const bx = t < 2.4 ? U.lerp(-120, 250, t / 2.4) : 250;
          baLan(ctx, bx, 408, 1.05, false, { walk: t < 2.4 ? t * 7 : null, talk: t > 2.6 && t < 5.4 }, t);
          rainOver(ctx, lt);
        },
        words(ctx, lt, vw, vh, S) {
          caption(ctx, S.s6p, vw * 0.04, vh * 0.05, Math.min(vw * 0.6, 520), (lt - 0.2) * 0.8);
          balloon(ctx, S.baLan, vw * 0.3, vh * 0.3, 330, vw * 0.27, vh * 0.48, lt - 2.6, true);
          balloon(ctx, S.minh2b, vw * 0.66, vh * 0.32, 240, vw * 0.48, vh * 0.52, lt - 5.6);
        },
      },
      { // 6. the goal
        dur: 9, hold: true,
        sfx() { this.once('p', 0.3, () => SS.Audio.sfx('powerup')); this.once('c', 1.4, () => SS.Audio.sfx('coin')); },
        draw(ctx, lt, img) {
          const t = step(lt);
          sky(ctx, '#f3b56c', '#f9e4b8');
          // paper sunburst
          for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + t * 0.1; paper(ctx, poly(ctx, [[480, 300], [480 + Math.cos(a) * 700, 300 + Math.sin(a) * 700], [480 + Math.cos(a + 0.18) * 700, 300 + Math.sin(a + 0.18) * 700]]), i % 2 ? '#f7c77e' : '#f2a95a', { edge: 0, shadow: 0 }); }
          // the dream scooter on a price tag
          const k = out3(t / 0.8);
          paper(ctx, poly(ctx, [[640, 250], [800, 250], [830, 290], [800, 330], [640, 330]]), '#fffaf0');
          ctx.save(); ctx.translate(720, 290); ctx.font = SS.font(30, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
          ctx.fillText(SS.CONFIG.SCOOTER_PRICE.toLocaleString('en-US'), -6, 0); ctx.restore();
          paper(ctx, ellipse(ctx, 812, 290, 7, 7), '#2a1a12', { edge: 0, shadow: 0 });
          scooter(ctx, 520, 450, 1.1 * k, false, t, { col: '#e8322a' });
          minh(ctx, img, 330, 450, 1.0, false, { armF: -2.8 + Math.sin(t * 8) * 0.25, armB: 0.3, jump: Math.abs(Math.sin(t * 5)) * 10 }, t);
          for (let i = 0; i < 5; i++) { const a = t * 1.5 + i * 1.3; const cx = 480 + Math.cos(a) * 330, cy = 230 + Math.sin(a * 1.2) * 60; paper(ctx, ellipse(ctx, cx, cy, 14, 14), '#f2c230', { edge: 2 }); ctx.fillStyle = '#c99a20'; ctx.font = SS.font(14, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₫', cx, cy + 1); }
        },
        words(ctx, lt, vw, vh, S) {
          cutLetters(ctx, S.goalTitle, vw * 0.5, vh * 0.14, 44, (lt - 0.2) * 1.5, ['#e8432d', '#f39a3b', '#2a9a45', '#2a1a12'], 31);
          caption(ctx, S.goal.replace('{n}', SS.CONFIG.SCOOTER_PRICE.toLocaleString('en-US')) + '. ' + S.goalSub, vw * 0.5 - Math.min(vw * 0.7, 560) / 2, vh * 0.27, Math.min(vw * 0.7, 560), (lt - 0.9) * 0.9);
          if (lt > 2.6 && Math.floor(lt * 2) % 2 === 0) cutLetters(ctx, S.tapToPlay, vw * 0.86, vh * 0.86, 20, 1, ['#fbf4e6'], 40);
        },
      },
    ],
  });
})();
