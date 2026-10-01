/* =====================================================================
 * Rendering for a game session: parallax layers, street, depth-sorted
 * entities, atmosphere, lighting, screen effects and HUD.
 * Readability first: background layers are hazier/darker than the
 * gameplay layer, and the player always has a rim light + ground ring.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const G = SS.GEOM;
  const Art = SS.Art;
  const S = SS.STRINGS;
  const TAU = Math.PI * 2;
  const P = SS.Session.prototype;

  const ents = []; // reusable draw list

  P.render = function (ctx) {
    const V = SS.View, vw = V.w, vh = V.h, L = this.L, p = this.player;
    const cx = this.cam.x - this.cam.sx, cy = -this.cam.sy;
    this.drawT = this.time;
    // zoom frame: scale the world around a point between the player and the middle of the street
    const z = this.demo || !p ? 1 : (this.zoom || 1);
    const fx = p ? U.clamp(p.x - cx, vw * 0.2, vw * 0.8) : vw / 2, fy = p ? U.clamp(p.y * 0.5 + 100, 180, 380) : vh / 2;
    this.zf = { z, x: fx, y: fy };
    ctx.save();
    if (z !== 1) { ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy); }
    // dizzy wobble when out of breath
    if (p && p.gassed > 0) {
      const k = Math.min(1, p.gassed);
      ctx.translate(vw / 2, vh / 2);
      ctx.rotate(Math.sin(this.time * 2.1) * 0.018 * k);
      ctx.scale(1 + Math.sin(this.time * 3.3) * 0.015 * k, 1 + Math.cos(this.time * 2.7) * 0.015 * k);
      ctx.translate(-vw / 2, -vh / 2);
    }
    this.drawSky(ctx, vw);
    this.drawFar(ctx, vw);
    ctx.save(); ctx.translate(-cx, cy);
    this.drawCrossStreetsFar(ctx, cx, vw);
    this.drawShops(ctx, cx, vw);
    ctx.restore();
    // haze + slight darkening keep the background behind the gameplay layer
    ctx.fillStyle = L.haze; ctx.fillRect(0, 0, vw, G.FACADE_BOT);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(0, 0, vw, G.FACADE_BOT);

    ctx.save(); ctx.translate(-cx, cy);
    this.drawWires(ctx, cx, vw); // wires & lanterns hang at the shop-front plane, behind the gameplay layer
    this.drawGround(ctx, cx, vw);
    this.drawDecals(ctx, cx, vw);
    this.collectEntities(cx, vw);
    this.drawShadows(ctx);
    if (L.headlights > 0) this.drawHeadlightCones(ctx);
    this.drawEntities(ctx);
    this.drawClouds(ctx);
    this.drawParticles(ctx);
    ctx.restore();

    this.drawLighting(ctx, cx, cy, vw, vh);
    this.drawEffects(ctx, vw, vh);
    ctx.restore();

    if (!this.demo) {
      ctx.save();
      if (z !== 1) { ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy); }
      ctx.translate(-cx, cy);
      this.drawWorldUI(ctx, cx, vw);
      ctx.restore();
      this.drawHUD(ctx, vw, vh);
    }
  };

  /* ---------------- background ---------------- */
  P.drawSky = function (ctx, vw) {
    const L = this.L;
    const g = ctx.createLinearGradient(0, 0, 0, G.FACADE_BOT);
    g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, G.FACADE_BOT + 2);
    if (this.L.key === 'night') { // a few stars
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 24; i++) { const x = ((i * 97.3 - this.cam.x * 0.05) % vw + vw) % vw; ctx.fillRect(x, (i * 37) % 70, 1.2, 1.2); }
    }
  };
  P.drawFar = function (ctx, vw) {
    const par = 0.5, tw = 520, ox = this.cam.x * par;
    const i0 = Math.floor(ox / tw) - 1, i1 = Math.floor((ox + vw) / tw) + 1;
    for (let i = i0; i <= i1; i++) Art.draw(ctx, Art.farTile(((i % 4) + 4) % 4, this.L), i * tw - ox, G.FACADE_BOT);
    ctx.fillStyle = this.L.hazeTop; ctx.fillRect(0, 0, vw, G.FACADE_BOT);
  };
  P.drawCrossStreetsFar = function (ctx, cx, vw) {
    const L = this.L, CH = G.CROSS_HALF, B = G.FACADE_BOT;
    for (const I of this.W.intersections) {
      if (I.x < cx - 200 || I.x > cx + vw + 200) continue;
      const x = I.x;
      // receding road
      ctx.fillStyle = U.shade(L.road, -0.15);
      ctx.beginPath(); ctx.moveTo(x - CH, B); ctx.lineTo(x + CH, B); ctx.lineTo(x + 30, 88); ctx.lineTo(x - 30, 88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = L.roadLine; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(x, B); ctx.lineTo(x, 90); ctx.stroke(); ctx.setLineDash([]);
      // building side faces converging
      for (const s of [-1, 1]) {
        ctx.fillStyle = U.shade(L.far, s < 0 ? 0.1 : -0.15);
        ctx.beginPath(); ctx.moveTo(x + s * CH, 0); ctx.lineTo(x + s * CH, B); ctx.lineTo(x + s * 30, 88); ctx.lineTo(x + s * 30, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L.windowGlow > 0.4 ? 'rgba(255,200,110,0.35)' : 'rgba(0,0,0,0.18)';
        for (let k = 0; k < 4; k++) {
          const t = 0.15 + k * 0.2, xx = x + s * U.lerp(CH, 30, t), yb = U.lerp(B, 88, t);
          ctx.fillRect(xx - (s > 0 ? 8 : 0), yb - 70 * (1 - t * 0.6), 8 * (1 - t * 0.5), 14 * (1 - t * 0.5));
        }
      }
      // tiny distant scooters
      ctx.fillStyle = 'rgba(30,30,40,0.55)';
      for (let k = 0; k < 3; k++) { const t = ((this.time * 0.15 + k * 0.33) % 1); ctx.fillRect(x - 6 + Math.sin(k) * 10 * (1 - t), U.lerp(92, B - 10, t), 4 + 8 * t, 3 + 6 * t); }
    }
  };
  P.drawShops = function (ctx, cx, vw) {
    const L = this.L;
    const t = this.time;
    for (const s of this.W.shops) {
      if (s.x + s.w < cx - 900 && Art.cache.has('shop_' + s.id + '_' + L.key)) { Art.drop('shop_' + s.id + '_' + L.key); Art.drop('neon_' + s.id); }
      if (s.x + s.w < cx - 30 || s.x > cx + vw + 30) continue;
      Art.draw(ctx, Art.shopSprite(s, L), s.x, G.FACADE_BOT);
    }
    // live neon glow (additive, flickering)
    if (L.neon > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.W.shops) {
        if (s.signStyle !== 'neon' || s.x + s.w < cx - 30 || s.x > cx + vw + 30) continue;
        let a = L.neon * (0.75 + 0.25 * Math.sin(t * 2 + s.id));
        if (s.flicker && Math.sin(t * s.flicker) > 0.93) a *= 0.25;
        ctx.globalAlpha = U.clamp(a, 0, 1);
        Art.draw(ctx, Art.neonGlowSprite(s), s.x, G.FACADE_BOT);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  };

  /* ---------------- ground ---------------- */
  P.groundTiles = function () {
    const L = this.L;
    const path = Art.sprite('path_' + L.key, 192, 100, 0, 0, (g) => {
      g.fillStyle = L.pathBase; g.fillRect(0, 0, 192, 100);
      const rng = U.rng(42);
      for (let y = 0; y < 100; y += 20) for (let x = (y / 20) % 2 ? -12 : 0; x < 192; x += 24) {
        g.fillStyle = U.shade(L.pathBase, (rng() - 0.5) * 0.14);
        g.fillRect(x + 1, y + 1, 22, 18);
      }
      g.strokeStyle = L.pathLine; g.lineWidth = 1;
      for (let y = 0; y <= 100; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(192, y); g.stroke(); }
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(40,30,20,0.08)'; g.beginPath(); g.ellipse(rng() * 192, rng() * 100, 4 + rng() * 12, 2 + rng() * 5, 0, 0, TAU); g.fill(); }
    });
    const road = Art.sprite('road_' + L.key, 384, G.ROAD_BOT - G.ROAD_TOP, 0, 0, (g) => {
      const h = G.ROAD_BOT - G.ROAD_TOP;
      g.fillStyle = L.road; g.fillRect(0, 0, 384, h);
      const rng = U.rng(7);
      for (let i = 0; i < 900; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(rng() * 384, rng() * h, 1.5, 1.5); }
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
      for (let i = 0; i < 5; i++) { let x = rng() * 384, y = rng() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 30; y += (rng() - 0.3) * 14; g.lineTo(x, y); } g.stroke(); }
      // worn tyre tracks
      g.fillStyle = 'rgba(0,0,0,0.07)';
      for (const ty of [30, 70, 128, 170]) g.fillRect(0, ty, 384, 10);
    });
    return { path, road };
  };
  P.drawGround = function (ctx, cx, vw) {
    const L = this.L, T = this.groundTiles();
    const x0 = Math.floor(cx / 192) * 192, x1 = cx + vw + 192;
    // far footpath
    for (let x = x0; x < x1; x += 192) ctx.drawImage(T.path.c, x, G.FACADE_BOT, 192, G.ROAD_TOP - G.FACADE_BOT);
    // near footpath
    for (let x = x0; x < x1; x += 192) ctx.drawImage(T.path.c, x, G.ROAD_BOT, 192, G.VIEW_H - G.ROAD_BOT);
    // road
    const rx0 = Math.floor(cx / 384) * 384;
    for (let x = rx0; x < x1 + 384; x += 384) ctx.drawImage(T.road.c, x, G.ROAD_TOP, 384, G.ROAD_BOT - G.ROAD_TOP);
    // shop threshold shadow on far footpath
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(cx, G.FACADE_BOT, vw, 6);
    // centre line
    ctx.strokeStyle = L.roadLine; ctx.lineWidth = 2.5; ctx.setLineDash([26, 30]);
    ctx.beginPath(); ctx.moveTo(x0 - (x0 % 56), 337); ctx.lineTo(x1, 337); ctx.stroke(); ctx.setLineDash([]);
    // cross streets: road runs through both footpaths + zebra crossings
    for (const I of this.W.intersections) {
      if (I.x < cx - 300 || I.x > cx + vw + 300) continue;
      const CH = G.CROSS_HALF;
      ctx.drawImage(T.road.c, 0, 0, 2 * CH, G.ROAD_TOP - G.FACADE_BOT, I.x - CH, G.FACADE_BOT, 2 * CH, G.ROAD_TOP - G.FACADE_BOT);
      ctx.drawImage(T.road.c, 100, 0, 2 * CH, G.VIEW_H - G.ROAD_BOT, I.x - CH, G.ROAD_BOT, 2 * CH, G.VIEW_H - G.ROAD_BOT);
      ctx.fillStyle = 'rgba(240,238,228,0.7)';
      for (let y = G.ROAD_TOP + 6; y < G.ROAD_BOT - 8; y += 18) ctx.fillRect(I.x - CH - 64, y, 50, 10);  // across the main road
      for (let x = I.x - CH + 8; x < I.x + CH - 8; x += 18) { ctx.fillRect(x, G.ROAD_BOT + 14, 10, 54); ctx.fillRect(x, G.FACADE_BOT + 6, 10, 34); }
      // kerb ends
      ctx.fillStyle = '#b9b2a2'; ctx.fillRect(I.x - CH - 4, G.ROAD_BOT, 4, G.VIEW_H - G.ROAD_BOT); ctx.fillRect(I.x + CH, G.ROAD_BOT, 4, G.VIEW_H - G.ROAD_BOT);
    }
    // kerbs
    const kerb = (y, h, top, face, skip) => {
      ctx.fillStyle = top; ctx.fillRect(cx - 10, y, vw + 20, h);
      ctx.fillStyle = face; ctx.fillRect(cx - 10, y + h, vw + 20, 3);
      for (const I of this.W.intersections) if (I.x > cx - 300 && I.x < cx + vw + 300) {
        ctx.drawImage(T.road.c, 0, 0, 2 * G.CROSS_HALF, h + 3, I.x - G.CROSS_HALF, y, 2 * G.CROSS_HALF, h + 3);
      }
    };
    // warm light spilling out of every shop onto the footpath
    const pool = Art.glow('#ffb468');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + L.windowGlow * 0.3;
    for (const sh of this.W.shops) {
      if (sh.x + sh.w < cx - 40 || sh.x > cx + vw + 40) continue;
      ctx.drawImage(pool.c, sh.x + sh.w * 0.05, G.FACADE_BOT - 34, sh.w * 0.9, 96);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    kerb(G.ROAD_TOP - 4, 4, U.shade(L.pathBase, 0.25), 'rgba(0,0,0,0.35)');
    kerb(G.ROAD_BOT, 5, U.shade(L.pathBase, 0.3), U.shade(L.pathBase, -0.35));
  };
  P.drawDecals = function (ctx, cx, vw) {
    const L = this.L;
    for (const d of this.W.decals) {
      if (d.x < cx - 150 || d.x > cx + vw + 150) continue;
      if (d.kind === 'manhole') {
        Art.ellipse(ctx, d.x, d.y, 16, 7, 'rgba(30,28,26,0.9)');
        ctx.strokeStyle = 'rgba(150,140,120,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(d.x, d.y, 12, 5, 0, 0, TAU); ctx.stroke();
      } else if (d.kind === 'puddle') {
        Art.ellipse(ctx, d.x, d.y, d.w / 2, d.w / 8, 'rgba(20,24,34,0.45)');
        if (L.puddles) { // neon reflections
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.1 * Math.sin(this.time * 2 + d.x);
          Art.ellipse(ctx, d.x - d.w * 0.1, d.y, d.w * 0.3, d.w / 14, d.c);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        } else Art.ellipse(ctx, d.x - d.w * 0.12, d.y - 1, d.w * 0.25, d.w / 20, 'rgba(255,255,255,0.15)');
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(d.x, d.y - 12, d.w, 24);
      }
    }
  };

  /* ---------------- entities ---------------- */
  P.collectEntities = function (cx, vw) {
    ents.length = 0;
    const x0 = cx - 160, x1 = cx + vw + 160;
    for (const o of this.W.obstacles) if (o.x + o.w / 2 > x0 && o.x - o.w / 2 < x1) ents.push({ y: o.y, k: 'o', o });
    for (const s of this.scooters) if (s.x > x0 - 60 && s.x < x1 + 60) ents.push({ y: s.y, k: 's', o: s });
    for (const s of this.sellers) ents.push({ y: s.y + 0.5, k: 'seller', o: s });
    for (const c of this.W.coins) if (!c.taken && c.x > x0 && c.x < x1) ents.push({ y: c.y - 0.1, k: 'c', o: c });
    if (this.player) ents.push({ y: this.player.y + 0.3, k: 'p', o: this.player });
    for (const c of this.customers) if (c.x > x0 && c.x < x1) ents.push({ y: c.y + 0.2, k: 'cust', o: c });
    ents.sort((a, b) => a.y - b.y);
  };
  P.drawShadows = function (ctx) {
    const L = this.L;
    for (const e of ents) {
      const o = e.o;
      if (e.k === 's') { const sc = Art.depth(o.y); if (o.vertical) Art.shadow(ctx, o.x, o.y, 13 * sc, 8 * sc, L); else Art.shadow(ctx, o.x, o.y, (o.len + 2) * sc, (o.halfW + 2) * sc * 0.9, L); }
      else if (e.k === 'p' || e.k === 'seller' || e.k === 'cust') { const z = o.tumble ? o.tumble.z : 0; Art.shadow(ctx, o.x, o.y, Math.max(6, 13 - z * 0.03), 4.5, L); }
      else if (e.k === 'o' && o.kind !== 'pole') { ctx.fillStyle = L.shadow; ctx.fillRect(o.x - o.w / 2 + L.shadowSkew * 6, o.y - o.d * 0.4, o.w, o.d * 0.4 + 3); }
    }
  };
  P.drawHeadlightCones = function (ctx) {
    const cone = Art.headlightCone(), L = this.L;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * L.headlights;
    for (const e of ents) {
      if (e.k !== 's') continue;
      const s = e.o, sc = Art.depth(s.y);
      ctx.save();
      if (!s.vertical) { ctx.translate(s.x + s.ax * 28 * sc, s.y - 2); ctx.scale(s.ax * 0.9 * sc, 0.36 * sc); }
      else if (s.ay > 0) { ctx.translate(s.x, s.y + 4); ctx.rotate(Math.PI / 2); ctx.scale(0.55, 0.45); }
      else { ctx.restore(); continue; }
      ctx.drawImage(cone.c, 0, -45, 220, 90);
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  P.drawEntities = function (ctx) {
    this.drawEntityList(ctx);
    // x-ray ghost: if anything is drawn over the player, a faint silhouette still shows through
    const p = this.player;
    if (p && !(this.state === 'won' && this.stateT > 1.2)) {
      const o = this.playerLook();
      if (p.tumble) { o.rot = p.tumble.rot; o.lift = p.tumble.z + 18; o.moving = 0; o.carry = null; o.arms = 'up'; }
      o.halo = null; ctx.globalAlpha = 0.32; Art.person(ctx, o); ctx.globalAlpha = 1;
    }
  };
  P.drawEntityList = function (ctx) {
    for (const e of ents) {
      if (e.k === 's') this.drawScooter(ctx, e.o);
      else if (e.k === 'o') this.drawObstacle(ctx, e.o);
      else if (e.k === 'p') this.drawPlayer(ctx);
      else if (e.k === 'seller') this.drawSeller(ctx, e.o);
      else if (e.k === 'cust') this.drawCustomer(ctx, e.o);
      else if (e.k === 'c') { const c = e.o; Art.coin(ctx, c.x, c.y - 12 - Math.sin(this.time * 3 + c.ph) * 3, 7.5, this.time * 2.5 + c.ph); }
    }
  };
  P.drawScooter = function (ctx, s) {
    const sc = Art.depth(s.y) * (s.isBB ? 1.14 : 1);
    if (s.isBB) { // the bánh bao bike glows softly so he's easy to spot in the swarm
      const gl = Art.glow('#fff4c0');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 + 0.1 * Math.sin(this.time * 6);
      ctx.drawImage(gl.c, s.x - 70, s.y - 110, 140, 120);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    const v = s.variant;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.crashed > 0) ctx.rotate(Math.sin(s.wobT * 18) * 0.12 * Math.min(1, s.crashed));
    const bounce = s.speed > 20 ? Math.sin(s.wob * 5) * 0.7 : 0;
    if (v.kind === 'car') {
      ctx.scale(sc * (s.ax < 0 ? -1 : 1), sc);
      const spr = Art.carSprite(v);
      ctx.drawImage(spr.c, -spr.ox, -spr.oy + bounce * 0.4, spr.w, spr.h);
    } else if (!s.vertical) {
      const dir = s.ax < 0 ? -1 : 1;
      ctx.scale(sc * dir, sc);
      const spr = Art.scooterSprite(v, s.lookT > 0 ? 1 : 0);
      ctx.drawImage(spr.c, -spr.ox, -spr.oy + bounce, spr.w, spr.h);
      if (s.isBB) for (const r of v.riders) Art.riderHead(ctx, r.x + 4, r.headY + bounce, r, 0.25, s.mouth); // mouth open mid-shout
      if (s.skill < 0.5 && !s.isBB) { // a "wild" rider looking at their phone: hard to read
        const r = v.riders[0];
        ctx.fillStyle = '#1b1b22'; ctx.fillRect(r.x + 13, r.headY + 9, 5, 8);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 9 + s.id);
        Art.ellipse(ctx, r.x + 12, r.headY + 6, 9, 7, '#7fc8ff');
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (v.kind === 'chickens') { // live chicken heads bobbing out of the cages
        for (let i = 0; i < 3; i++) {
          const hx = -48 + i * 9, hy = -54 - Math.abs(Math.sin(this.time * 6 + i * 2)) * 3;
          Art.circle(ctx, hx, hy, 3, i % 2 ? '#f2eee4' : '#b5652b'); Art.circle(ctx, hx + 1, hy - 3, 1.6, '#d9342b');
          ctx.fillStyle = '#f0b030'; ctx.beginPath(); ctx.moveTo(hx + 3, hy); ctx.lineTo(hx + 6, hy + 1); ctx.lineTo(hx + 3, hy + 2); ctx.fill();
        }
      }
    } else {
      ctx.scale(sc, sc);
      const dir = s.ay > 0 ? 1 : -1;
      const spr = Art.scooterVSprite(v, dir);
      ctx.drawImage(spr.c, -spr.ox, -spr.oy + bounce, spr.w, spr.h);
      const r = v.riders[0];
      Art.circle(ctx, 0, -66 + bounce, 9, r.skin);
      if (r.helmet) { ctx.fillStyle = r.helmet; ctx.beginPath(); ctx.arc(0, -67 + bounce, 10.5, Math.PI * (dir > 0 ? 1 : 0.9), dir > 0 ? TAU : TAU + 0.3); ctx.fill(); if (dir < 0) { ctx.beginPath(); ctx.arc(0, -66 + bounce, 10, 0, TAU); ctx.fill(); } }
      if (dir > 0) { Art.circle(ctx, -3, -65 + bounce, 1.2, '#1b1410'); Art.circle(ctx, 3, -65 + bounce, 1.2, '#1b1410'); if (r.mask) { ctx.fillStyle = r.mask; Art.rr(ctx, -4, -62 + bounce, 8, 5, 2); ctx.fill(); } }
    }
    ctx.restore();
  };

  P.drawObstacle = function (ctx, o) {
    const L = this.L, t = this.time;
    switch (o.kind) {
      case 'parked': Art.draw(ctx, Art.parkedSprite(o), o.x, o.y); break;
      case 'pots': Art.draw(ctx, Art.potsSprite(o), o.x, o.y); break;
      case 'pole': Art.draw(ctx, Art.poleSprite(), o.x, o.y); break;
      case 'cart': {
        const v = o.vendor;
        const up = Math.sin(t + v.ph) > 0.6;
        Art.personCached(ctx, { x: o.x + 18, y: o.y - o.d * 0.55, s: Art.depth(o.y) / Art.ENT * 1.02, face: -1, phase: 0, moving: 0, skin: v.skin, shirt: v.shirt, hat: v.hat, arms: up ? 'up' : null }, 'cv' + o.seed + (up ? 'u' : ''), 1);
        Art.draw(ctx, Art.cartSprite(o), o.x, o.y);
        // hanging bulb under the umbrella
        Art.circle(ctx, o.x + 8, o.y - 92, 3.2, '#fff2b0');
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + this.L.lantern * 0.4;
        ctx.drawImage(Art.glow('#ffc070').c, o.x - 52, o.y - 150, 120, 120);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.08 * SS.Main.quality) this.particle('steam', o.x + U.rand(-20, 20), o.y - 70, U.rand(-4, 4), -U.rand(14, 24), 1.4);
        break;
      }
      case 'durian': {
        Art.draw(ctx, Art.durianStallSprite(o, this.world.durianWord), o.x, o.y);
        if (o.near) Art.personCached(ctx, { x: o.x + 58, y: o.y - 4, s: Art.depth(o.y) / Art.ENT * 0.95, face: -1, phase: t * 1.5, sit: true, skin: '#c48b5f', shirt: '#7aa35a', hat: 'cone', arms: 'up' }, 'dv', 4);
        break;
      }
      case 'stools': case 'cards': case 'farstools': {
        const people = o.people || [];
        Art.draw(ctx, Art.tableSprite({ seed: o.seed, w: o.w, d: o.d, spare: o.kind === 'farstools' ? 3 : 1, items: o.items }), o.x, o.y - o.d * 0.25);
        for (const pp of people) {
          const x = o.x + pp.dx, y = o.y + pp.dy + 12;
          Art.stool(ctx, x, y, pp.stool, 12);
          Art.personCached(ctx, { x, y: y - 14, s: Art.depth(y) / Art.ENT * 1.0, face: pp.face, phase: t * 2 + pp.ph, sit: true, skin: pp.skin, shirt: pp.shirt, pants: pp.pants, hair: pp.hair, beard: pp.beard, hat: pp.hat,
            arms: o.kind === 'cards' ? 'cards' : 'eat', holding: o.kind === 'cards' ? 'cards' : 'bowl' }, 'op' + o.seed + '_' + people.indexOf(pp), 6);
        }
        break;
      }
      case 'fargoods': Art.draw(ctx, this.farGoodsSprite(o), o.x, o.y); break;
      case 'light': this.drawTrafficLight(ctx, o); break;
    }
  };
  P.drawTrafficLight = function (ctx, o) {
    const I = o.I, h = o.side === 'near' ? 150 : 120;
    const mainCol = I.phase === 0 ? 2 : I.phase === 1 ? 1 : 0; // 0 red, 1 amber, 2 green (for the main road)
    ctx.fillStyle = '#3a3d42'; ctx.fillRect(o.x - 2.5, o.y - h, 5, h);
    ctx.fillStyle = '#1d1f23'; Art.rr(ctx, o.x - 9, o.y - h - 44, 18, 46, 4); ctx.fill();
    const cols = ['#ff3b30', '#ffb020', '#34d058'];
    for (let i = 0; i < 3; i++) {
      const on = i === mainCol, cy = o.y - h - 36 + i * 14;
      Art.circle(ctx, o.x, cy, 5, on ? cols[i] : 'rgba(255,255,255,0.12)');
      if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(Art.glow(cols[i]).c, o.x - 22, cy - 22, 44, 44); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    // pedestrian signal: green walker when the main road is stopped
    const walk = I.phase === 2;
    ctx.fillStyle = '#1d1f23'; Art.rr(ctx, o.x + 8, o.y - h + 6, 16, 18, 3); ctx.fill();
    ctx.fillStyle = walk ? '#34d058' : '#ff3b30';
    Art.circle(ctx, o.x + 16, o.y - h + 10, 2, ctx.fillStyle); ctx.fillRect(o.x + 15, o.y - h + 12, 2.5, 6);
    if (walk) { ctx.fillRect(o.x + 13, o.y - h + 17, 2, 4); ctx.fillRect(o.x + 18, o.y - h + 17, 2, 4); } else ctx.fillRect(o.x + 15, o.y - h + 17, 2.5, 4);
  };
  P.farGoodsSprite = function (o) {
    return Art.propSprite('fg_' + o.seed, o.w + 20, 70, o.w / 2 + 10, 60, (g) => {
      const rng = U.rng(o.seed);
      const n = Math.max(2, Math.round(o.w / 26));
      const goodsCol = { grocery: ['#e84a3a', '#f2c230', '#3d7fd0'], banhmi: ['#e8b86a'], cane: ['#9ac24a', '#6a8a2a'], steamer: ['#f4efe0'], barber: ['#cfe8ff'] }[o.goods] || ['#7fbf3a', '#f0a030', '#e84a3a'];
      for (let i = 0; i < n; i++) {
        const x = -o.w / 2 + 6 + i * (o.w - 12) / n;
        g.fillStyle = '#b5884c'; Art.rr(g, x, -22, (o.w - 12) / n - 3, 20, 2); g.fill();
        g.strokeStyle = 'rgba(80,50,20,0.5)'; g.lineWidth = 0.8; g.strokeRect(x, -22, (o.w - 12) / n - 3, 20);
        for (let k = 0; k < 4; k++) Art.circle(g, x + 4 + k * ((o.w - 12) / n - 8) / 3, -24 - (k % 2) * 3, 3.5, goodsCol[Math.floor(rng() * goodsCol.length)]);
      }
    });
  };

  P.playerLook = function () {
    const p = this.player;
    return {
      x: p.x, y: p.y, s: Art.depth(p.y) * 1.06, face: p.face, phase: p.phase,
      moving: Math.min(1, Math.hypot(p.vx, p.vy) / SS.CONFIG.WALK_SPEED),
      skin: '#f0c9a0', shirt: SS.COL_PLAYER, pants: '#1d2747', hair: '#6b3e1f', backpack: '#ff5a14', shoe: '#11131c',
      hat: 'cap', hatColor: SS.COL_PLAYER, halo: '#ffffff',
      legsBare: true, carry: this.cargoDef.carry, carryColor: this.cargoDef.cup, cargoPct: p.cargo / 100, carryTilt: p.carryTilt || 0, arms: this.cargoDef.carry ? 'carry' : null,
      sunglasses: p.sunglasses > 0, mouth: p.gassed > 0 ? 0.8 : 0, outline: this.L.rim, ink: '#24150f',
    };
  };
  P.drawPlayer = function (ctx) {
    const p = this.player, L = this.L;
    if (this.state === 'won' && this.stateT > 1.2) return;
    // ground ring keeps the player readable in the swarm
    ctx.fillStyle = 'rgba(10,12,20,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.onRoad && p.conf < 30 ? '#ff4a3a' : SS.COL_PLAYER;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 8, 0, 0, TAU); ctx.stroke();
    if (p.invuln > 0 && !p.tumble && Math.floor(this.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    const o = this.playerLook();
    if (p.tumble) { o.rot = p.tumble.rot; o.lift = p.tumble.z + 18; o.moving = 0; o.mouth = 1; o.carry = null; o.arms = 'up'; }
    if (this.state === 'won') { o.face = 1; o.moving = 1; }
    Art.person(ctx, o);
    // holding breath: puffed cheeks
    if (p.holding) { Art.circle(ctx, p.x + p.face * 8 * o.s, p.y - 63 * o.s, 4.2 * o.s, 'rgba(240,150,140,0.9)'); }
    // gassed: little green stink swirl around the head
    if (p.gassed > 0) {
      ctx.strokeStyle = 'rgba(170,210,60,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = this.time * 4 + i * 2.1; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 16, p.y - 80 + Math.sin(a) * 5, 3, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  };
  P.drawCustomer = function (ctx, c) {
    if (c.vendor) {
      const L = c.look, wave = !c.handed && Math.abs(this.player.x - c.x) < 420;
      // a little counter with the food on it
      if (!c.handed) { ctx.fillStyle = '#8a5a32'; Art.rr(ctx, c.x + 12, c.y - 22, 30, 20, 3); ctx.fill(); ctx.fillStyle = '#6a4224'; ctx.fillRect(c.x + 12, c.y - 22, 30, 4);
        ctx.save(); ctx.translate(c.x + 27, c.y - 22); Art.carryItem(ctx, c.food.carry, 0, 0, 0, 1, c.food.cup); ctx.restore(); }
      Art.person(ctx, { ink: '#24150f', x: c.x, y: c.y, s: Art.depth(c.y), face: c.leaveT != null ? c.leaveDir : 1, phase: c.phase, moving: c.moving || 0,
        skin: L.skin, shirt: L.shirt, pants: L.pants, hair: L.hair, hat: L.hat, arms: wave ? 'up' : null, mouth: wave ? 0.5 + 0.5 * Math.sin(this.time * 8) : 0, vest: '#c84b3a' });
      return;
    }
    const L = c.look, o = this.order, waiting = o && o.cust === c && o.state === 'carrying';
    const near = waiting && Math.abs(this.player.x - c.x) < 300;
    Art.person(ctx, { ink: '#24150f', x: c.x, y: c.y, s: Art.depth(c.y), face: c.leaveT != null ? c.leaveDir : (this.player.x > c.x ? 1 : -1), phase: c.phase, moving: c.moving || 0,
      skin: L.skin, shirt: L.shirt, pants: L.pants, hair: L.hair, hat: L.hat, hatColor: L.hatColor,
      holding: c.leaveT == null ? 'phone' : null, arms: near || c.mood > 0 ? 'up' : null, mouth: c.bubbleT > 0 ? 0.6 : 0 });
  };
  P.drawSeller = function (ctx, s) {
    const t = this.time;
    const shake = s.shake > 0 ? (s.shake -= 1 / 60, Math.sin(t * 80) * 3) : 0;
    const base = { ink: '#24150f', x: s.x + shake, y: s.y, s: Art.depth(s.y), face: s.face, phase: s.phase, moving: s.moving || 0, skin: s.look.skin, shirt: s.look.shirt, pants: s.look.pants };
    const pitching = s.state === 'latched' || (s.state === 'approach' && s.engaged);
    if (s.type === 'sunglasses') Object.assign(base, { sunglasses: true, pattern: 'flowers', holding: 'rack', hat: 'cap', hatColor: '#1e1e22', arms: pitching ? 'up' : null, crouch: s.state === 'lurk', mouth: pitching ? 0.5 + 0.5 * Math.sin(t * 9) : 0 });
    else if (s.type === 'fruit') Object.assign(base, { hat: 'cone', pole: true, arms: 'pole', hunch: 1, s: base.s * 0.9, hairBun: true, hair: '#9a9a9a', fruit: '#7fbf3a', fruit2: '#f0a030', mouth: pitching ? 0.3 + 0.3 * Math.sin(t * 7) : 0 });
    else if (s.type === 'watch') Object.assign(base, { jacket: '#3b3f4a', jacketOpen: s.jacketOpen, arms: pitching ? 'up' : null, mouth: pitching ? 0.5 + 0.5 * Math.sin(t * 10) : 0, hair: '#111' });
    else if (s.type === 'ride') Object.assign(base, { shirt: '#2f9e4f', hat: 'helmet', hatColor: '#2f9e4f', holding: 'phone', arms: pitching ? 'up' : null,
      mouth: pitching ? 0.5 + 0.5 * Math.sin(t * 9) : 0, phase: pitching && !s.moving ? t * 3 : s.phase });
    else if (s.type === 'shoe') {
      Object.assign(base, { crouch: true, holding: 'brush', hat: 'cap', hatColor: '#3d7fd0', mouth: s.state === 'latched' ? 0.4 : 0, phase: s.state === 'latched' ? t * 10 : s.phase });
      ctx.fillStyle = '#7a5230'; Art.rr(ctx, s.x - 22 * s.face, s.y - 12, 16, 12, 2); ctx.fill();
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(s.x - 22 * s.face, s.y - 12, 16, 3);
    }
    if (s.state === 'leave') base.moving = 1;
    Art.person(ctx, base);
  };

  /* ---------------- atmosphere ---------------- */
  P.drawClouds = function (ctx) {
    if (!this.clouds.length) return;
    const puff = Art.puff('#b9c43a'), core = Art.puff('#8a9a20');
    const t = this.time;
    for (const c of this.clouds) {
      for (const q of c.puffs) {
        const a = q.a + t * q.sp;
        const x = c.x + Math.cos(a) * q.d * c.r, y = c.y + Math.sin(a) * q.d * c.r * 0.55;
        const r = c.r * q.s;
        ctx.globalAlpha = c.alpha * 0.42;
        ctx.drawImage(puff.c, x - r, y - r * 0.8, r * 2, r * 1.6);
      }
      ctx.globalAlpha = c.alpha * 0.28;
      ctx.drawImage(core.c, c.x - c.r * 0.6, c.y - c.r * 0.4, c.r * 1.2, c.r * 0.8);
      // stink squiggles rising
      ctx.globalAlpha = c.alpha * 0.6;
      ctx.strokeStyle = '#6f7f12'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const sx = c.x + (k - 1) * c.r * 0.4, sy = c.y - c.r * 0.2 - ((t * 20 + k * 15) % 30);
        ctx.beginPath(); ctx.moveTo(sx, sy + 14);
        ctx.bezierCurveTo(sx - 6, sy + 8, sx + 6, sy + 4, sx, sy - 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };
  P.drawParticles = function (ctx) {
    const night = this.L.key === 'night';
    const dustC = night ? '#5a5466' : '#c8b48a';
    for (const q of this.particles) {
      const k = q.life / q.max;
      switch (q.type) {
        case 'dust': { const spr = Art.puff(dustC), r = (6 + (1 - k) * 14) * q.size; ctx.globalAlpha = k * 0.45; ctx.drawImage(spr.c, q.x - r, q.y - r * 0.7 - (1 - k) * 6, r * 2, r * 1.4); break; }
        case 'steam': { const spr = Art.puff('#ffffff'), r = (4 + (1 - k) * 10) * q.size; ctx.globalAlpha = k * 0.35; ctx.drawImage(spr.c, q.x - r, q.y - r, r * 2, r * 2); break; }
        case 'puff': { const spr = Art.puff(q.color || '#b8c94a'), r = (5 + (1 - k) * 12); ctx.globalAlpha = k * 0.6; ctx.drawImage(spr.c, q.x - r, q.y - r, r * 2, r * 2); break; }
        case 'spark': ctx.globalAlpha = k; ctx.fillStyle = '#ffe680'; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-2.5, -0.8, 5, 1.6); ctx.fillRect(-0.8, -2.5, 1.6, 5); ctx.restore(); break;
        case 'star': ctx.globalAlpha = k; this.star(ctx, q.x, q.y, 5, '#ffd75a', q.rot); break;
        case 'splash': ctx.globalAlpha = k; Art.circle(ctx, q.x, q.y, 2.2 * q.size, q.color || '#c9873a'); break;
        case 'feather': ctx.globalAlpha = k; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); Art.ellipse(ctx, 0, 0, 4, 1.6, '#f4f1e8'); ctx.restore(); break;
        case 'petal': ctx.globalAlpha = k; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); Art.ellipse(ctx, 0, 0, 3, 1.8, '#ff6a9a'); ctx.restore(); break;
        case 'confetti': ctx.globalAlpha = Math.min(1, k * 2); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.color; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); break;
        case 'shard': ctx.globalAlpha = k; ctx.fillStyle = '#333'; ctx.fillRect(q.x, q.y, 3, 2); break;
        case 'frost': ctx.globalAlpha = k * 0.9; ctx.fillStyle = '#dff6ff'; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-2, -0.6, 4, 1.2); ctx.fillRect(-0.6, -2, 1.2, 4); ctx.restore(); break;
        case 'drop': ctx.globalAlpha = k * 0.7; ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(q.x, q.y, 6 * (1 - k) + 1, 2 * (1 - k) + 0.5, 0, 0, TAU); ctx.stroke(); break;
        case 'bun': ctx.globalAlpha = 1; Art.circle(ctx, q.x, q.y, 7, '#fbf7ee'); ctx.strokeStyle = '#d9cdb0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y - 3, 3, 0, Math.PI); ctx.stroke(); break;
      }
    }
    ctx.globalAlpha = 1;
  };
  P.star = function (ctx, x, y, r, col, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };
  P.drawWires = function (ctx, cx, vw) {
    const L = this.L, t = this.time;
    ctx.strokeStyle = 'rgba(18,16,16,0.85)'; ctx.lineWidth = 1.3;
    for (const w of this.W.wires) {
      if (Math.max(w.x1, w.x2) < cx - 50 || Math.min(w.x1, w.x2) > cx + vw + 50) continue;
      for (let i = 0; i < w.n; i++) {
        const sag = w.sag + i * 5;
        ctx.beginPath(); ctx.moveTo(w.x1, w.y1 + i * 3);
        ctx.quadraticCurveTo((w.x1 + w.x2) / 2, Math.max(w.y1, w.y2) + sag, w.x2, w.y2 + i * 2); ctx.stroke();
      }
    }
    // lantern strings
    const glow = Art.glow('#ff8a3a');
    for (const s of this.W.lanterns) {
      if (s.x + s.w < cx - 40 || s.x > cx + vw + 40) continue;
      ctx.strokeStyle = 'rgba(30,20,15,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x + s.w / 2, s.y + s.sag * 2, s.x + s.w, s.y); ctx.stroke();
      for (const it of s.items) {
        const lx = s.x + s.w * it.t, ly = s.y + 4 * s.sag * it.t * (1 - it.t) * 1 + 10;
        const sw = Math.sin(t * 1.6 + it.ph) * 0.12;
        ctx.save(); ctx.translate(lx, ly - 10); ctx.rotate(sw);
        ctx.strokeStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6); ctx.stroke();
        Art.ellipse(ctx, 0, 15, 8, 10, it.c);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-2, 6, 2, 18);
        ctx.fillStyle = '#d9a52a'; ctx.fillRect(-4, 5, 8, 3); ctx.fillRect(-4, 23, 8, 3);
        ctx.strokeStyle = '#d9a52a'; ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, 33); ctx.stroke();
        ctx.restore();
        if (L.lantern > 0.3) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = L.lantern * 0.45;
          ctx.drawImage(glow.c, lx - 30, ly - 10, 60, 60);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  };

  P.drawLighting = function (ctx, cx, cy, vw, vh) {
    const L = this.L;
    if (L.sunGlow) {
      const gx = L.key === 'golden' ? vw * 0.85 : vw * 0.1;
      const g = ctx.createRadialGradient(gx, -40, 10, gx, -40, vw * 0.7);
      g.addColorStop(0, L.sunGlow); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh); ctx.globalCompositeOperation = 'source-over';
    }
    if (L.neon > 0.5 && SS.Main.quality > 0.6) {
      // neon spill on the footpath and headlight bulbs
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.W.shops) {
        if (s.signStyle !== 'neon' || s.x + s.w < cx || s.x > cx + vw) continue;
        const gl = Art.glow(s.neon);
        ctx.globalAlpha = 0.22 * L.neon;
        ctx.drawImage(gl.c, s.x + s.w / 2 - cx - 120, G.FACADE_BOT - 60 + cy, 240, 150);
      }
      if (L.headlights > 0) {
        const hg = Art.glow('#fff2c0');
        ctx.globalAlpha = 0.6 * L.headlights;
        for (const sc of this.scooters) {
          if (sc.x < cx - 40 || sc.x > cx + vw + 40) continue;
          const d = Art.depth(sc.y);
          if (!sc.vertical) ctx.drawImage(hg.c, sc.x + sc.ax * 27 * d - cx - 14, sc.y - 42 * d + cy - 14, 28, 28);
          else if (sc.ay > 0) ctx.drawImage(hg.c, sc.x - cx - 14, sc.y - 34 * d + cy - 14, 28, 28);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // ambient tint + vignette, baked into one cached overlay
    const vk = 'vig_' + Math.round(vw) + '_' + Math.round(vh) + '_' + L.key;
    const vig = Art.sprite(vk, vw, vh, 0, 0, (g) => {
      g.fillStyle = L.ambient; g.fillRect(0, 0, vw, vh);
      const gr = g.createRadialGradient(vw / 2, vh * 0.55, vh * 0.35, vw / 2, vh * 0.55, vw * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,5,15,' + L.vignette + ')');
      g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
    });
    ctx.drawImage(vig.c, 0, 0, vw, vh);
  };

  P.drawEffects = function (ctx, vw, vh) {
    const p = this.player, t = this.time;
    if (this.freezeT > 0) {
      ctx.fillStyle = 'rgba(150,215,255,' + (0.16 + 0.04 * Math.sin(t * 6)) + ')'; ctx.fillRect(0, 0, vw, vh);
      ctx.strokeStyle = 'rgba(220,245,255,0.5)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, vw - 10, vh - 10);
    }
    if (this.slowT > 0) {
      if (this.slowOn) { ctx.fillStyle = 'rgba(255,215,140,0.12)'; ctx.fillRect(0, 0, vw, vh); }
      else { // glitch: the cheap watch cuts out
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = ['rgba(255,0,80,0.25)', 'rgba(0,255,220,0.25)', 'rgba(255,255,255,0.18)'][i % 3];
          ctx.fillRect(0, Math.random() * vh, vw, U.rand(2, 14));
        }
      }
    }
    if (p && p.gassed > 0) {
      ctx.fillStyle = 'rgba(120,170,30,' + (0.22 + 0.08 * Math.sin(t * 5)) * Math.min(1, p.gassed) + ')'; ctx.fillRect(0, 0, vw, vh);
    } else if (p && p.inCloud > 0.1 && !p.holding) {
      ctx.fillStyle = 'rgba(150,180,40,' + 0.12 * p.inCloud + ')'; ctx.fillRect(0, 0, vw, vh);
    }
    if (this.glare > 0) {
      const gx = this.glareX - this.cam.x, gy = this.glareY;
      const k = this.glare * (p && p.sunglasses > 0 ? 0.1 : 0.62);
      const g = ctx.createRadialGradient(gx, gy, 5, gx, gy, vw * 0.42);
      g.addColorStop(0, 'rgba(255,255,240,' + k + ')'); g.addColorStop(0.3, 'rgba(255,250,220,' + k * 0.6 + ')'); g.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
    if (p && p.onRoad && p.conf < 30 && this.state === 'play') {
      const a = (30 - p.conf) / 30 * (0.25 + 0.15 * Math.sin(t * 8));
      const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.4, vw / 2, vh / 2, vw * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(200,20,10,' + a + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
    if (this.rainK > 0.02) {
      ctx.fillStyle = 'rgba(30,40,60,' + 0.22 * this.rainK + ')'; ctx.fillRect(0, 0, vw, vh);
      ctx.strokeStyle = 'rgba(200,220,255,' + 0.45 * this.rainK + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      const n = Math.round(90 * this.rainK * (SS.Main.quality > 0.6 ? 1 : 0.5));
      for (let i = 0; i < n; i++) {
        const x = (U.hash(i * 3.1) * vw + this.time * 160 + i * 7) % (vw + 40) - 20;
        const y = (U.hash(i * 7.7) * vh + this.time * 900) % (vh + 40) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
      }
      ctx.stroke();
    }
    if (this.flash > 0) { ctx.fillStyle = 'rgba(255,240,230,' + this.flash * 0.6 + ')'; ctx.fillRect(0, 0, vw, vh); }
  };

  /* ---------------- world-space UI: bubbles, markers, popups ---------------- */
  const placed = [];
  P.bubble = function (ctx, x, y, text, opts) {
    opts = opts || {};
    const fs = opts.size || 15;
    ctx.font = SS.font(fs, 800, opts.display);
    const tw = ctx.measureText(text).width, pw = tw + 18, ph = fs + 14;
    const cx = this.cam.x, vw = SS.View.w;
    let bx = U.clamp(x - pw / 2, cx + 8, cx + vw - pw - 8);
    let by = y - ph;
    // nudge up so bubbles never overlap each other
    for (let guard = 0; guard < 6; guard++) {
      const hit = placed.find((r) => bx < r.x + r.w && bx + pw > r.x && by < r.y + r.h && by + ph > r.y);
      if (!hit) break;
      by = hit.y - ph - 4;
    }
    placed.push({ x: bx, y: by, w: pw, h: ph });
    ctx.fillStyle = opts.bg || 'rgba(255,253,246,0.96)';
    Art.rr(ctx, bx, by, pw, ph, 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(U.clamp(x - 6, bx + 8, bx + pw - 16), by + ph - 1); ctx.lineTo(U.clamp(x, bx + 10, bx + pw - 10), by + ph + 8); ctx.lineTo(U.clamp(x + 6, bx + 16, bx + pw - 8), by + ph - 1); ctx.fill();
    if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = 2; Art.rr(ctx, bx, by, pw, ph, 9); ctx.stroke(); }
    ctx.fillStyle = opts.color || '#1f1a17'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + pw / 2, by + ph / 2 + 1);
  };
  P.drawWorldUI = function (ctx, cx, vw) {
    const p = this.player, t = this.time;
    placed.length = 0;
    // order beacons: a column of light + a big food badge, easy to spot from far away
    const o = this.order;
    const beacon = (x, yFoot, col, food, label) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      const gr = ctx.createLinearGradient(0, yFoot, 0, 40);
      gr.addColorStop(0, U.rgba(col, 0.45)); gr.addColorStop(1, U.rgba(col, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gr; ctx.fillRect(x - 24, 40, 48, yFoot - 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = U.rgba(col, 0.18 + 0.12 * pulse); ctx.beginPath(); ctx.ellipse(x, yFoot, 58, 20, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, yFoot, 58, 20, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, yFoot, 58, 20, 0, 0, TAU); ctx.stroke();
      const by = yFoot - 108 - Math.sin(t * 3) * 5;
      ctx.fillStyle = 'rgba(15,15,22,0.9)'; ctx.beginPath(); ctx.arc(x, by, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, by, 26, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(x, by, 26, 0, TAU); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 9, by + 23); ctx.lineTo(x + 9, by + 23); ctx.lineTo(x, by + 36); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(x, by + 2); ctx.scale(1.35, 1.35); Art.carryItem(ctx, food.carry, 0, 7, 0, 1, food.cup); ctx.restore();
      ctx.font = SS.font(13, 800, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,12,20,0.9)'; ctx.strokeText(label, x, by - 36); ctx.fillStyle = col; ctx.fillText(label, x, by - 36);
    };
    if (o && o.state === 'waiting') {
      const sh = o.shop;
      ctx.strokeStyle = U.rgba(SS.COL_PICK, 0.55 + 0.35 * Math.sin(t * 5)); ctx.lineWidth = 4;
      ctx.strokeRect(sh.x + 6, G.FACADE_BOT - 86, sh.w - 12, 86 + G.ROAD_TOP - G.FACADE_BOT + 6); // outline the whole shop front
      beacon(o.vendor.x, o.vendor.y, SS.COL_PICK, o.food, S.pickUpTag);
    }
    if (o && o.state === 'carrying') beacon(o.drop.x, o.drop.y, SS.COL_DROP, o.food, S.deliverTag);
    // guide arrow at your feet, always pointing to where you need to go
    if (o && (o.state === 'waiting' || o.state === 'carrying') && p && !p.tumble) {
      const tx = o.state === 'waiting' ? o.vendor.x : o.drop.x, ty = o.state === 'waiting' ? o.vendor.y : o.drop.y;
      const dist = Math.hypot(tx - p.x, ty - p.y);
      if (dist > 90) {
        const ang = Math.atan2(ty - p.y, tx - p.x), col = o.state === 'waiting' ? SS.COL_PICK : SS.COL_DROP;
        const ax = p.x + Math.cos(ang) * 58, ay = p.y - 6 + Math.sin(ang) * 26;
        const pk = 1.45 + Math.sin(performance.now() / 160) * 0.15;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.scale(pk, pk);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-11, -17); ctx.lineTo(-4, 0); ctx.lineTo(-11, 17); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(10,10,18,0.9)'; ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-9, -14); ctx.lineTo(-3, 0); ctx.lineTo(-9, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-6, -10); ctx.lineTo(-1, 0); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // delivery rating pops up over the customer
    if (this.ratingFx && this.ratingFx.x != null) {
      const R = this.ratingFx, k = U.easeOutBack(U.clamp((2.4 - R.t) / 0.35, 0, 1)), a = U.clamp(R.t / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(R.x, R.y - 150 - (2.4 - R.t) * 10); ctx.scale(k, k);
      for (let i = 0; i < 5; i++) SS.UI.starShape(ctx, (i - 2) * 17, 0, 7, i < R.stars);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = SS.font(15, 800, true);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,15,25,0.85)';
      const tt = S.tipLine.replace('{tip}', R.tip) + (R.streak >= 2 ? '  ' + S.streak.replace('{n}', R.streak) : '');
      ctx.strokeText(tt, 0, 18); ctx.fillStyle = '#ffd75a'; ctx.fillText(tt, 0, 18);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // customer reactions
    for (const c of this.customers) if (c.bubble && c.bubbleT > 0) this.bubble(ctx, c.x, c.y - 96 * Art.depth(c.y), c.bubble, { size: 14, color: c.mood > 0 ? '#2f7a2f' : c.mood < 0 ? '#b5261e' : '#1f1a17' });
    // intersection goal: glowing target footpath + chevrons
    if (this.inter && this.inter.active) {
      const I = this.inter, far = I.goal === 'far';
      const y0 = far ? G.FACADE_BOT + 2 : G.ROAD_BOT + 6, h = far ? G.ROAD_TOP - G.FACADE_BOT - 4 : 80;
      ctx.fillStyle = U.rgba('#7ff0d8', 0.12 + 0.08 * Math.sin(t * 5));
      ctx.fillRect(cx, y0, I.x - G.CROSS_HALF - cx, h); ctx.fillRect(I.x + G.CROSS_HALF, y0, cx + vw - I.x - G.CROSS_HALF, h);
      if (!p.tumble) {
        const dir = far ? -1 : 1;
        for (let k = 0; k < 3; k++) {
          const a = ((t * 1.5 + k / 3) % 1);
          ctx.globalAlpha = Math.sin(a * Math.PI) * 0.8;
          const yy = p.y - 90 + dir * (a * 30) - (far ? 0 : -80);
          ctx.strokeStyle = '#7ff0d8'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(p.x - 9, yy - dir * 6); ctx.lineTo(p.x, yy); ctx.lineTo(p.x + 9, yy - dir * 6); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    // bánh bao timing window
    const b = this.bb;
    if (b && b.window && !b.grabbed && p && p.onRoad) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 14);
      ctx.strokeStyle = U.rgba('#ffd75a', 0.5 + pulse * 0.5); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, b.y, 24 + pulse * 5, 8 + pulse * 2, 0, 0, TAU); ctx.stroke();
      ctx.font = SS.font(15, 800, true); ctx.fillStyle = '#ffd75a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.now, p.x, b.y - 18);
    }
    // seller escape meter / prompts
    for (const s of this.sellers) {
      if (s.state !== 'latched') continue;
      const k = s.escape / s.cfg.escape;
      const x = s.x, y = s.y - 104 * Art.depth(s.y);
      ctx.fillStyle = 'rgba(15,18,28,0.75)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f0b43c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + TAU * U.clamp(k, 0, 1)); ctx.stroke();
      if (s.type === 'shoe') { ctx.strokeStyle = '#7fc96b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * U.clamp(s.finishT / s.cfg.finish, 0, 1)); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = SS.font(13, 800); ctx.fillStyle = '#ffd75a';
      ctx.fillText(S.btnBuy + ' ' + s.cfg.price, x, y + 26);
    }
    // speech bubbles
    for (const s of this.sellers) if (s.bubble && s.state !== 'lurk') this.bubble(ctx, s.x, s.y - 92 * Art.depth(s.y), s.bubble, { size: 15 });
    for (const s of this.scooters) {
      if (!s.bubble || s.x < cx - 50 || s.x > cx + vw + 50) continue;
      if (s.isBB) this.bubble(ctx, s.x, s.y - 112 * Art.depth(s.y), s.bubble.text, { size: 16, display: true, color: '#c8241e', border: '#c8241e' });
      else this.bubble(ctx, s.x, s.y - 84 * Art.depth(s.y), s.bubble.text, { size: 14 });
    }
    // floating popups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of this.popups) {
      const k = q.t / q.life;
      const sc = k < 0.15 ? U.easeOutBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = SS.font(q.size * sc, 800, true);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,15,25,0.85)';
      ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  };

  /* ---------------- HUD ---------------- */
  P.meter = function (ctx, x, y, w, h, frac, c1, c2, flash) {
    ctx.fillStyle = 'rgba(10,12,20,0.7)'; Art.rr(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.fill();
    if (frac > 0.005) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; Art.rr(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; Art.rr(ctx, x + 2, y + 1, Math.max(0, w * frac - 4), h * 0.35, h * 0.2); ctx.fill();
    }
    if (flash) { ctx.strokeStyle = 'rgba(255,255,255,' + flash + ')'; ctx.lineWidth = 2; Art.rr(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.stroke(); }
  };
  P.drawHUD = function (ctx, vw, vh) {
    const V = SS.View, u = V.unitsPerCss, ins = V.insets, p = this.player, t = this.time;
    const x0 = ins.l + 12 * u, y0 = ins.t + 10 * u;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const row = (i, kind, label, frac, c1, c2, flash, extra) => {
      const y = y0 + i * 34 * u;
      Art.hudIcon(ctx, kind, x0 + 14 * u, y + 14 * u, 14 * u);
      if (kind === 'cargo') this.cargoIcon(ctx, x0 + 14 * u, y + 14 * u, 9 * u);
      ctx.font = SS.font(11 * u, 800); ctx.fillStyle = '#fff';
      ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(label, x0 + 34 * u, y + 7 * u); ctx.fillText(label, x0 + 34 * u, y + 7 * u);
      if (extra) {
        const lw = ctx.measureText(label).width;
        ctx.font = SS.font(10 * u, 800); ctx.fillStyle = extra.c;
        ctx.strokeText(extra.t, x0 + 40 * u + lw, y + 7 * u); ctx.fillText(extra.t, x0 + 40 * u + lw, y + 7 * u);
      }
      this.meter(ctx, x0 + 34 * u, y + 15 * u, 132 * u, 8 * u, frac, c1, c2, flash);
    };
    const cf = p.conf / 100;
    const confC = cf < 0.3 ? ['#c8321e', '#ff6a3a'] : cf > 0.7 ? ['#f0a33a', '#7ff0d8'] : ['#e07a1f', '#f6c445'];
    const drain = p.onRoad && p.confWhy ? 0.5 + 0.5 * Math.sin(t * 16) : 0;
    const whyText = p.onRoad && p.confWhy ? { t: S.why[p.confWhy], c: '#ff9a7a' } : p.onRoad && p.conf > 70 ? { t: S.flowing, c: '#7ff0d8' } : null;
    row(0, 'conf', S.hudConfidence, cf, confC[0], confC[1], drain, whyText);
    const bInfo = p.holding ? { t: S.holding, c: '#9fe6ff' } : p.inCloud > 0.1 ? { t: S.stink, c: '#c6e65a' } : null;
    row(1, 'breath', S.hudBreath, p.breath / 100, p.inCloud > 0.1 && !p.holding ? '#9ab83a' : '#2f9e8f', p.inCloud > 0.1 && !p.holding ? '#d6e85a' : '#6ff0dc', p.inCloud > 0.1 ? 0.6 : 0, bInfo);

    // power-up chips
    let cy = y0 + 2 * 34 * u + 4 * u;
    const chip = (text, col) => {
      ctx.font = SS.font(11 * u, 800);
      const w = ctx.measureText(text).width + 16 * u;
      ctx.fillStyle = 'rgba(10,12,20,0.7)'; Art.rr(ctx, x0, cy, w, 20 * u, 10 * u); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5 * u; Art.rr(ctx, x0, cy, w, 20 * u, 10 * u); ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(text, x0 + 8 * u, cy + 10.5 * u);
      cy += 24 * u;
    };
    if (p.sunglasses > 0) chip(S.chipSunglasses + ' ×' + p.sunglasses, '#e8e8e8');
    if (this.slowT > 0) chip(S.chipSlowmo + ' ' + Math.ceil(this.slowT) + 's', '#ffd75a');
    if (this.freezeT > 0) chip(S.chipFreeze + ' ' + Math.ceil(this.freezeT) + 's', '#9fe6ff');
    if (p.boostT > 0) chip(S.chipBoost + ' ' + Math.ceil(p.boostT) + 's', '#7fc96b');
    if (this.streak >= 2) chip(S.streak.replace('{n}', this.streak), '#ff8fb0');

    // ---- top-right: lives + coins on one row, compact order chip underneath ----
    const pb = SS.Input.btns.pause;
    const rx = (pb ? pb.x - pb.r : vw - ins.r) - 10 * u;
    ctx.font = SS.font(15 * u, 800, true); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const coinTxt = String(this.coins);
    const cw = ctx.measureText(coinTxt).width + 38 * u;
    ctx.fillStyle = 'rgba(10,12,20,0.6)'; Art.rr(ctx, rx - cw, y0, cw, 24 * u, 12 * u); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(coinTxt, rx - 28 * u, y0 + 12.5 * u);
    Art.coin(ctx, rx - 14 * u, y0 + 12 * u, 7.5 * u, 0);
    const nl = Math.max(SS.CONFIG.LIVES, p.lives);
    for (let i = 0; i < nl; i++) Art.heart(ctx, rx - cw - 14 * u - i * 20 * u, y0 + 12 * u, 7.5 * u, i < p.lives ? '#ff4d5e' : 'rgba(255,255,255,0.22)');
    if (SS.Save.up('charm') && !this.charmUsed) Art.circle(ctx, rx - cw - 14 * u - nl * 20 * u, y0 + 12 * u, 5 * u, '#ffd75a');
    const o = this.order;
    if (o) {
      const F = o.food, carrying = o.state === 'carrying';
      const chW = 132 * u, chH = 38 * u, chX = rx - chW, chY = y0 + 30 * u;
      ctx.fillStyle = 'rgba(10,12,20,0.6)'; Art.rr(ctx, chX, chY, chW, chH, 10 * u); ctx.fill();
      ctx.strokeStyle = carrying ? SS.COL_DROP : SS.COL_PICK; ctx.lineWidth = 2.5 * u; Art.rr(ctx, chX, chY, chW, chH, 10 * u); ctx.stroke();
      ctx.save(); ctx.translate(chX + 19 * u, chY + 22 * u); ctx.scale(0.95 * u, 0.95 * u);
      Art.carryItem(ctx, F.carry, 0, F.carry === 'cup' ? 8 : 5, 0, carrying ? p.cargo / 100 : 1, F.cup);
      ctx.restore();
      ctx.textAlign = 'left';
      if (carrying) {
        const cold = F.temp === 'cold';
        this.meter(ctx, chX + 40 * u, chY + 10 * u, chW - 52 * u, 6 * u, o.heat / 100, cold ? '#3f7fd0' : '#c8321e', cold ? '#bff2ff' : '#ffcf5a', o.heat < 25 ? 0.5 + 0.5 * Math.sin(t * 10) : 0);
        const cg = p.cargo / 100;
        this.meter(ctx, chX + 40 * u, chY + 24 * u, chW - 52 * u, 6 * u, cg, cg < 0.3 ? '#c8321e' : '#d9a84a', cg < 0.3 ? '#ff6a3a' : '#f4e2a0', 0);
      } else {
        ctx.font = SS.font(10.5 * u, 800); ctx.fillStyle = SS.COL_PICK;
        ctx.fillText(o.shop.word, chX + 40 * u, chY + 19.5 * u);
      }
      // off-screen target: small arrow at the screen edge, level with the target
      const tx = o.state === 'waiting' ? o.vendor.x : o.drop.x;
      const sx = (tx - this.cam.x - this.zf.x) * this.zf.z + this.zf.x;
      if (sx < 0 || sx > vw) {
        const left = sx < 0, d2 = left ? -1 : 1;
        const ex = left ? ins.l + 62 * u : vw - ins.r - 62 * u, ey = vh * 0.42, col = carrying ? SS.COL_DROP : SS.COL_PICK;
        const pulse = 1 + 0.12 * Math.sin(t * 7);
        ctx.fillStyle = 'rgba(10,10,18,0.85)'; ctx.beginPath(); ctx.arc(ex, ey, 24 * u * pulse, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(ex, ey, 24 * u * pulse, 0, TAU); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(ex + d2 * 15 * u, ey); ctx.lineTo(ex - d2 * 8 * u, ey - 12 * u); ctx.lineTo(ex - d2 * 8 * u, ey + 12 * u); ctx.closePath(); ctx.fill();
        ctx.font = SS.font(12 * u, 800); ctx.textAlign = 'center';
        ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(10,10,18,0.9)';
        const mt = Math.round(Math.abs(tx - p.x) / 10) + ' m';
        ctx.strokeText(mt, ex, ey + 38 * u); ctx.fillText(mt, ex, ey + 38 * u);
        ctx.globalAlpha = 1;
      }
    }

    // the bánh bao bike is coming: small marker on the side his call comes from
    const b = this.bb;
    if (b) {
      const sx = b.x - this.cam.x;
      if (sx < -10 || sx > vw + 10) {
        const left = sx < 0, ex = left ? ins.l + 12 * u : vw - ins.r - 12 * u, ey = vh * 0.56;
        ctx.font = SS.font(11 * u, 800, true);
        const tw = ctx.measureText(S.banhbaoIndicator).width + 16 * u;
        const bx = left ? ex : ex - tw;
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 8);
        ctx.fillStyle = 'rgba(255,253,246,0.9)'; Art.rr(ctx, bx, ey - 10 * u, tw, 20 * u, 10 * u); ctx.fill();
        ctx.fillStyle = '#c8241e'; ctx.textAlign = 'center';
        ctx.fillText(S.banhbaoIndicator, bx + tw / 2, ey + 1 * u);
        ctx.globalAlpha = 1;
      }
    }

    // ---- top-centre: at most ONE short message at a time ----
    const T = this.tut.cur;
    const topY = ins.t + 8 * u;
    const pillMsg = (text, col, alpha) => {
      ctx.globalAlpha = alpha; ctx.font = SS.font(12 * u, 800); ctx.textAlign = 'center';
      const tw = Math.min(ctx.measureText(text).width + 24 * u, vw * 0.46);
      ctx.fillStyle = 'rgba(10,12,20,0.7)'; Art.rr(ctx, vw / 2 - tw / 2, topY, tw, 24 * u, 12 * u); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, vw / 2, topY + 12.5 * u);
      ctx.globalAlpha = 1;
    };
    if (T) this.panelText(ctx, T.text, vw / 2, topY, Math.min(380 * u, vw * 0.42), 11.5 * u, '#ffffff', 'rgba(15,18,30,0.72)', '#f0a33a', Math.min(1, this.tut.t * 3));
    else if (this.banner) pillMsg(this.banner.text, '#7ff0d8', U.clamp(this.banner.t * 2, 0, 1));
    else if (this.inter && this.inter.active) pillMsg(S.crossHintShort, '#7ff0d8', 0.9);

    // level intro card
    if (this.state === 'intro') this.drawIntroCard(ctx, vw, vh, u);
    // fake ride-hail lift: quick fade with motion streaks
    if (this.ride) {
      const a = Math.sin(Math.PI * U.clamp(this.ride.t / 1.2, 0, 1));
      ctx.fillStyle = 'rgba(8,8,14,' + a * 0.92 + ')'; ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 * u;
      for (let i = 0; i < 14; i++) { const y = (i * 53 + this.time * 900) % vh, x = (i * 137 + this.time * 2400) % (vw + 300) - 300; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 160 * u, y); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.font = SS.font(28 * u, 800, true); ctx.fillStyle = '#7fc96b';
      ctx.fillText(S.popRide, vw / 2, vh / 2);
      ctx.font = SS.font(14 * u, 700); ctx.fillStyle = '#fff'; ctx.fillText(S.popRideCargo, vw / 2, vh / 2 + 30 * u);
      ctx.globalAlpha = 1;
    }
  };
  P.cargoIcon = function (ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(r / 12, r / 12);
    Art.carryItem(ctx, this.cargoDef.carry || 'box', 0, 5, 0, this.player ? this.player.cargo / 100 : 1, this.cargoDef.cup);
    ctx.restore();
  };
  // wrapped text in a rounded panel
  P.panelText = function (ctx, text, cx, y, maxW, fs, col, bg, accent, alpha) {
    ctx.font = SS.font(fs, 700);
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW - 28 * (fs / 14) && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    let tw = 0; for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
    const pw = tw + 32 * fs / 14, ph = lines.length * fs * 1.35 + 18 * fs / 14;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = bg; Art.rr(ctx, cx - pw / 2, y, pw, ph, 10 * fs / 14); ctx.fill();
    if (accent) { ctx.fillStyle = accent; Art.rr(ctx, cx - pw / 2, y, 5 * fs / 14, ph, 3); ctx.fill(); }
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, cx, y + 9 * fs / 14 + fs * 1.35 * (i + 0.5)));
    ctx.globalAlpha = 1;
    return ph;
  };
  P.drawIntroCard = function (ctx, vw, vh, u) {
    const k = this.stateT < 0.4 ? U.easeOutCubic(this.stateT / 0.4) : this.stateT > 2.0 ? 1 - (this.stateT - 2.0) / 0.4 : 1;
    ctx.globalAlpha = U.clamp(k, 0, 1);
    const w = Math.min(500 * u, vw * 0.74), h = 150 * u, x = vw / 2 - w / 2, y = vh * 0.3;
    ctx.fillStyle = 'rgba(12,14,24,0.85)'; Art.rr(ctx, x, y, w, h, 16 * u); ctx.fill();
    ctx.strokeStyle = '#f0a33a'; ctx.lineWidth = 2 * u; Art.rr(ctx, x, y, w, h, 16 * u); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f0a33a'; ctx.font = SS.font(13 * u, 800);
    ctx.fillText(S.level + ' ' + (this.levelIndex + 1) + '  ·  ' + this.world.city.toUpperCase(), vw / 2, y + 26 * u);
    ctx.fillStyle = '#fff'; ctx.font = SS.font(30 * u, 800, true);
    ctx.fillText(this.level.name, vw / 2, y + 62 * u);
    ctx.font = SS.font(14 * u, 600); ctx.fillStyle = '#e8e2d0';
    ctx.font = SS.font(12.5 * u, 600);
    const lines = SS.UI.wrap(ctx, this.level.brief || '', w - 40 * u);
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, vw / 2, y + 94 * u + i * 16 * u));
    ctx.font = SS.font(11 * u, 700); ctx.fillStyle = '#9fe6ff';
    ctx.fillText(this.level.endless ? S.endlessName : S.ordersCount.replace('{n}', this.level.orders), vw / 2, y + 134 * u);
    ctx.globalAlpha = 1;
  };
})();
