/* =====================================================================
 * Art — all graphics are generated procedurally in code.
 * ---------------------------------------------------------------------
 * Static things (scooters, shopfronts, signs, props) are rendered once
 * into offscreen sprite canvases at the current device scale, so they
 * stay crisp on high-DPI screens and cheap to draw every frame.
 * Animated characters are drawn directly with simple shapes.
 * Text is ALWAYS real font text via fillText (see SS.font).
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const TAU = Math.PI * 2;

  const Art = (SS.Art = {
    scale: 1,          // device pixels per logical unit
    cache: new Map(),
    cacheBytes: 0,

    setScale(s) {
      if (Math.abs(s - this.scale) > 0.001) { this.cache.clear(); this.cacheBytes = 0; }
      this.scale = s;
    },

    /* ---------- sprite cache ---------- */
    // drawFn(ctx) draws in local units with origin at (ox, oy) of a w*h box.
    frame: 0,
    // opts.outline: add an illustrated ink outline around the sprite's silhouette
    sprite(key, w, h, ox, oy, drawFn, opts) {
      let s = this.cache.get(key);
      if (s) { s.used = this.frame; return s; }
      const sc = this.scale * 1.08 * (opts && opts.ent ? this.ENT : 1); // oversample for depth & entity scaling
      let c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * sc));
      c.height = Math.max(1, Math.ceil(h * sc));
      const g = c.getContext('2d');
      g.scale(sc, sc);
      g.translate(ox, oy);
      g.lineCap = 'round'; g.lineJoin = 'round';
      drawFn(g);
      if (opts && opts.outline) c = this.inkOutline(c, Math.max(1, Math.round(1.25 * sc)), opts.outline === true ? '#24150f' : opts.outline);
      s = { c, w, h, ox, oy, key, used: this.frame };
      this.cache.set(key, s);
      this.cacheBytes += c.width * c.height * 4;
      return s;
    },
    entSprite(key, w, h, ox, oy, fn) { return this.sprite(key, w, h, ox, oy, fn, { outline: true, ent: true }); },
    propSprite(key, w, h, ox, oy, fn) { return this.sprite(key, w, h, ox, oy, fn, { outline: true }); },
    inkOutline(src, d, col) {
      const o = document.createElement('canvas');
      o.width = src.width; o.height = src.height;
      const g = o.getContext('2d');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) g.drawImage(src, Math.round(dx * d), Math.round(dy * d));
      g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, o.width, o.height);
      g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
      src.width = src.height = 0;
      return o;
    },
    // evict sprites that haven't been drawn for a few seconds (keeps memory flat on long levels)
    gc() {
      this.frame++;
      if (this.frame % 120 !== 0) return;
      for (const [k, s] of this.cache) {
        if (this.frame - s.used > 240) { this.cacheBytes -= s.c.width * s.c.height * 4; s.c.width = s.c.height = 0; this.cache.delete(k); }
      }
    },
    drop(key) { const s = this.cache.get(key); if (s) { this.cacheBytes -= s.c.width * s.c.height * 4; this.cache.delete(key); } },

    draw(ctx, spr, x, y, s, flip) {
      s = s || 1;
      if (flip) {
        ctx.save(); ctx.translate(x, y); ctx.scale(-s, s);
        ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h);
        ctx.restore();
      } else {
        ctx.drawImage(spr.c, x - spr.ox * s, y - spr.oy * s, spr.w * s, spr.h * s);
      }
    },

    // perspective scale by depth (feet y)
    ENT: 1.22, // characters & vehicles are drawn bigger than the street grid (closer to the reference art)
    depth(y) { return this.ENT * U.lerp(0.86, 1.06, U.clamp((y - 176) / (540 - 176), 0, 1)); },

    /* ---------- primitive helpers ---------- */
    rr(g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    },
    limb(g, x1, y1, x2, y2, w, col) {
      g.strokeStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    },
    circle(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); },
    ellipse(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); },

    shadow(ctx, x, y, rx, ry, L) {
      ctx.fillStyle = L.shadow;
      ctx.beginPath();
      ctx.ellipse(x + L.shadowSkew * ry * 1.4, y + 1, rx * (1 + L.shadowLen * 0.5), ry, 0, 0, TAU);
      ctx.fill();
    },

    /* ---------- soft puff sprite (clouds, steam, dust) ---------- */
    puff(color) {
      return this.sprite('puff_' + color, 64, 64, 32, 32, (g) => {
        const gr = g.createRadialGradient(0, 0, 2, 0, 0, 32);
        gr.addColorStop(0, U.rgba(color, 0.9)); gr.addColorStop(0.45, U.rgba(color, 0.45)); gr.addColorStop(1, U.rgba(color, 0));
        g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
      });
    },
    glow(color) {
      return this.sprite('glow_' + color, 128, 128, 64, 64, (g) => {
        const gr = g.createRadialGradient(0, 0, 1, 0, 0, 64);
        gr.addColorStop(0, U.rgba(color, 0.85)); gr.addColorStop(0.25, U.rgba(color, 0.35)); gr.addColorStop(1, U.rgba(color, 0));
        g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
      });
    },
    headlightCone() {
      return this.sprite('hcone', 220, 90, 0, 45, (g) => {
        const gr = g.createLinearGradient(0, 0, 220, 0);
        gr.addColorStop(0, 'rgba(255,245,200,0.55)'); gr.addColorStop(1, 'rgba(255,245,200,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -5); g.lineTo(220, -40); g.lineTo(220, 40); g.lineTo(0, 5); g.closePath(); g.fill();
      });
    },

    /* =================================================================
     * PEOPLE
     * o: {x,y,s,face,phase,moving,skin,shirt,pants,hair,hat,mouth,
     *     carry,backpack,sunglasses,sit,crouch,rot,outline,arms,...}
     * ================================================================= */
    person(ctx, o) {
      ctx.save();
      ctx.translate(o.x, o.y - (o.lift || 0));
      const s = o.s || 1;
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale(s * (o.face || 1), s);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.halo) this.personPass(ctx, o, o.halo, 10);
      if (o.ink) this.personPass(ctx, o, o.ink, 5.2);
      if (o.outline) this.personPass(ctx, o, o.outline, 3.0);
      this.personPass(ctx, o, null, 0);
      ctx.restore();
    },

    personPass(g, o, oc, ex) {
      const m = o.moving || 0, ph = o.phase || 0;
      const sit = o.sit, crouch = o.crouch;
      const bob = sit ? 0 : -Math.abs(Math.sin(ph)) * 2.2 * m;
      const hipY = (sit ? -17 : crouch ? -14 : -30) + bob;
      const hunch = o.hunch || 0;
      const col = (c) => oc || c;
      const skin = col(o.skin || '#e0b088');
      const pants = col(o.pants || '#3a3f4a');
      const shirt = col(o.shirt || '#e8e2d0');
      const shoe = col(o.shoe || '#2a2420');

      // ---- legs ----
      if (sit) {
        this.limb(g, -2, hipY, 11, hipY + 1, 8 + ex, pants);
        this.limb(g, 11, hipY + 1, 12, -2, 7 + ex, pants);
        this.limb(g, 2, hipY, 14, hipY - 1, 8 + ex, pants);
        this.limb(g, 14, hipY - 1, 16, -1, 7 + ex, pants);
        this.ellipse(g, 15, -1, 4.5 + ex / 2, 2.5 + ex / 2, shoe);
      } else if (crouch) {
        this.limb(g, 0, hipY, 12, hipY - 6, 8 + ex, pants);
        this.limb(g, 12, hipY - 6, 10, -1, 7 + ex, pants);
        this.limb(g, -2, hipY, -8, -1, 7 + ex, pants);
        this.ellipse(g, 12, -1, 4.5 + ex / 2, 2.5 + ex / 2, shoe);
      } else {
        const a = Math.sin(ph) * 0.55 * m, b = -a;
        const legLen = 28;
        const knee = (ang) => [Math.sin(ang) * 14, hipY + Math.cos(ang) * 14];
        for (const [ang, shade] of [[b, -0.25], [a, 0]]) {
          const [kx, ky] = knee(ang);
          const lift = Math.max(0, -Math.cos(ph + (ang === a ? 0 : Math.PI))) * 4 * m;
          const fx = Math.sin(ang * 0.7) * legLen, fy = Math.min(-1, hipY + legLen) - lift;
          const c = oc || (shade ? U.shade(o.pants || '#3a3f4a', shade) : pants);
          this.limb(g, 0, hipY, kx, ky, 8 + ex, c);
          this.limb(g, kx, ky, fx, fy, 7 + ex, c);
          if (o.legsBare) this.limb(g, kx, ky + 3, fx, fy, 5.5 + ex, oc || o.skin);
          this.ellipse(g, fx + 2.5, fy + 0.5, 4.5 + ex / 2, 2.6 + ex / 2, shoe);
        }
      }

      const sh = hipY - 22 + hunch * 2; // shoulder line
      const hx = hunch * 4;
      // ---- backpack (behind) ----
      if (o.backpack) {
        g.fillStyle = col(o.backpack);
        this.rr(g, -19 - ex / 2, sh - 4 - ex / 2, 12 + ex, 26 + ex, 5); g.fill();
        if (!oc) { g.fillStyle = U.shade(o.backpack, -0.25); this.rr(g, -19, sh + 12, 12, 9, 3); g.fill();
          g.fillStyle = U.shade(o.backpack, 0.25); g.fillRect(-18, sh - 2, 3, 20); }
      }
      // ---- shoulder pole baskets (fruit seller), back basket drawn here ----
      if (o.pole && !oc) this.poleBaskets(g, o, sh, true);

      // ---- back arm ----
      const armSw = Math.sin(ph) * 0.6 * m;
      const backHand = o.arms === 'carry' ? [13, sh + 10] : o.arms === 'up' ? [10, sh - 12] : o.arms === 'pole' ? [-6, sh - 4]
        : o.arms === 'cards' ? [12, sh + 8] : [Math.sin(-armSw) * 16, sh + Math.cos(armSw) * 16];
      this.limb(g, 2, sh + 3, backHand[0], backHand[1], 5.5 + ex, oc || U.shade(o.skin || '#e0b088', -0.18));

      // ---- torso ----
      g.fillStyle = shirt;
      this.rr(g, -10 - ex / 2 + hx, sh - 2 - ex / 2, 20 + ex, hipY - sh + 6 + ex, 7); g.fill();
      if (!oc) {
        g.fillStyle = 'rgba(0,0,0,0.16)'; this.rr(g, -10 + hx, sh - 2, 7, hipY - sh + 6, 6); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.14)'; this.rr(g, 4 + hx, sh, 5, hipY - sh + 2, 4); g.fill();
        if (o.pattern === 'flowers') {
          g.fillStyle = 'rgba(255,240,120,0.85)';
          for (let i = 0; i < 6; i++) this.circle(g, -6 + hx + (i % 3) * 6, sh + 3 + Math.floor(i / 3) * 9, 1.7, g.fillStyle);
        }
        if (o.jacket) this.jacket(g, o, sh, hipY, hx);
        if (o.vest) { g.fillStyle = o.vest; this.rr(g, -9 + hx, sh, 18, 15, 4); g.fill(); }
      }

      // ---- head ----
      const hy = sh - 11 + hunch * 3, hxh = 1 + hx * 1.3;
      this.circle(g, hxh, hy, 10.5 + ex / 2, skin);
      if (!oc) {
        g.fillStyle = 'rgba(120,60,30,0.18)'; g.beginPath(); g.arc(hxh, hy, 10.5, Math.PI * 0.6, Math.PI * 1.4); g.fill();
        // hair
        g.fillStyle = o.hair || '#2a1e18';
        g.beginPath(); g.arc(hxh - 1, hy - 1, 9.8, Math.PI * 0.95, Math.PI * 2.05); g.fill();
        g.fillRect(hxh - 10, hy - 3, 6, 6);
        if (o.hairBun) this.circle(g, hxh - 9, hy - 4, 4, o.hair || '#2a1e18');
        // face
        if (o.sunglasses) {
          g.fillStyle = '#111'; this.rr(g, hxh + 2, hy - 3, 9, 4, 2); g.fill();
          g.fillStyle = 'rgba(120,200,255,0.6)'; g.fillRect(hxh + 4, hy - 2.5, 3, 1.2);
        } else {
          this.circle(g, hxh + 5.6, hy - 1, 1.9, '#fff');
          this.circle(g, hxh + 6.1, hy - 0.8, 1.2, '#1b1410');
          g.strokeStyle = '#2a1a12'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(hxh + 3.5, hy - 4.6); g.lineTo(hxh + 8, hy - 4.1); g.stroke();
          g.fillStyle = U.shade(o.skin || '#e0b088', -0.12); g.beginPath(); g.moveTo(hxh + 9.6, hy - 0.5); g.lineTo(hxh + 12, hy + 2.5); g.lineTo(hxh + 9.6, hy + 2.6); g.fill();
        }
        if (o.mouth) { this.ellipse(g, hxh + 6.5, hy + 4.5, 2.4, 2.6 * o.mouth, '#5a1a14'); }
        else { g.strokeStyle = 'rgba(90,40,30,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hxh + 4.5, hy + 4.3); g.lineTo(hxh + 7.5, hy + 4); g.stroke(); }
        if (o.beard) { g.fillStyle = 'rgba(230,230,230,0.9)'; g.beginPath(); g.moveTo(hxh + 2, hy + 5); g.lineTo(hxh + 6, hy + 12); g.lineTo(hxh + 8, hy + 5); g.fill(); }
        this.circle(g, hxh + 3, hy + 2, 2, 'rgba(230,110,90,0.25)');
        // hats
        if (o.hat === 'cone') {
          g.fillStyle = '#e6cf8f';
          g.beginPath(); g.moveTo(hxh - 19, hy - 4); g.lineTo(hxh + 1, hy - 21); g.lineTo(hxh + 21, hy - 4); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(140,110,60,0.6)'; g.lineWidth = 0.8;
          for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(hxh - 19 + i * 5, hy - 4 - i * 4.2); g.lineTo(hxh + 21 - i * 5, hy - 4 - i * 4.2); g.stroke(); }
          g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(hxh - 19, hy - 4.5, 40, 1.5);
        } else if (o.hat === 'cap') {
          g.fillStyle = o.hatColor || '#c84b3a';
          g.beginPath(); g.arc(hxh, hy - 2, 10, Math.PI, TAU); g.fill();
          this.rr(g, hxh + 3, hy - 4, 12, 3.2, 1.5); g.fill();
        } else if (o.hat === 'helmet') {
          g.fillStyle = o.hatColor || '#e14b3b';
          g.beginPath(); g.arc(hxh, hy - 1, 11, Math.PI * 0.92, TAU + 0.1); g.fill();
        }
      } else if (o.hat === 'cone') {
        g.fillStyle = oc; g.beginPath(); g.moveTo(hxh - 20, hy - 3); g.lineTo(hxh + 1, hy - 23); g.lineTo(hxh + 22, hy - 3); g.closePath(); g.fill();
      } else if (o.hat === 'cap' || o.hat === 'helmet') {
        g.fillStyle = oc; g.beginPath(); g.arc(hxh, hy - 2, 12, Math.PI, TAU); g.fill();
      }

      // ---- carried item (front) ----
      if (o.carry && !oc) this.carryItem(g, o.carry, 14 + hx, sh + 8, o.carryTilt || 0, o.cargoPct, o.carryColor);
      if (o.carry && oc) { g.fillStyle = oc; this.rr(g, 4 + hx, sh + 1, 22, 14, 5); g.fill(); }
      if (o.holding === 'rack' && !oc) this.sunglassesRack(g, 16 + hx, sh + 2);
      if (o.holding === 'phone' && !oc) { // phone held up, glowing map screen
        const px = o.arms === 'up' ? 11 : 14, py = o.arms === 'up' ? sh - 22 : sh + 10;
        g.fillStyle = '#1b1b22'; this.rr(g, px, py, 8, 13, 1.5); g.fill();
        g.fillStyle = '#9fe6b0'; g.fillRect(px + 1, py + 1.5, 6, 9);
        g.fillStyle = '#2f9e4f'; g.fillRect(px + 1, py + 6, 6, 1.2); g.fillRect(px + 3.5, py + 1.5, 1.2, 9);
        this.circle(g, px + 5, py + 4, 1.2, '#e8432d');
      }
      if (o.holding === 'brush' && !oc) { g.fillStyle = '#6b4a2a'; this.rr(g, 14, hipY - 2, 14, 7, 2); g.fill(); g.fillStyle = '#d9c9a0'; g.fillRect(15, hipY + 4, 12, 2); }
      if (o.holding === 'cards' && !oc) { g.fillStyle = '#fafafa'; g.save(); g.translate(13, sh + 6); g.rotate(-0.3 + Math.sin(o.phase * 0.5) * 0.15); g.fillRect(-4, -5, 6, 9); g.fillRect(-1, -6, 6, 9); g.fillStyle = '#c33'; g.fillRect(1, -4, 2, 2); g.restore(); }
      if (o.holding === 'bowl' && !oc) { this.ellipse(g, 14, sh + 6, 6, 3, '#f4f1ea'); }

      // ---- front arm ----
      const fh = o.arms === 'carry' ? [16, sh + 12] : o.arms === 'up' ? [14 + Math.sin(o.phase * 3) * 3, sh - 16] : o.arms === 'pole' ? [6, sh - 4]
        : o.arms === 'cards' ? [14, sh + 7] : o.arms === 'eat' ? [10, sh - 2 + Math.sin(o.phase) * 6] : [Math.sin(armSw) * 16, sh + Math.cos(armSw) * 16];
      this.limb(g, -1 + hx, sh + 3, fh[0], fh[1], 5.8 + ex, oc || o.sleeve || skin);
      if (!oc) this.circle(g, fh[0], fh[1], 3, skin);
      if (o.pole && !oc) this.poleBaskets(g, o, sh, false);
    },

    jacket(g, o, sh, hipY, hx) {
      const open = o.jacketOpen || 0;
      const jc = o.jacket;
      if (open > 0.05) { // lining full of fake watches
        g.fillStyle = '#5b2430'; this.rr(g, 2 + hx, sh, 6 + open * 16, hipY - sh + 2, 3); g.fill();
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
          const wx = 5 + hx + c * 7 * open + open * 3, wy = sh + 3 + r * 5.5;
          this.circle(g, wx, wy, 2.2, '#ffd34d'); this.circle(g, wx, wy, 1.2, '#fff8dc');
        }
      }
      g.fillStyle = jc;
      this.rr(g, -10 + hx, sh - 2, 13, hipY - sh + 6, 6); g.fill();
      g.save(); g.translate(3 + hx, sh); g.rotate(-open * 0.9);
      this.rr(g, 0, -2, 8, hipY - sh + 6, 4); g.fill(); g.restore();
    },

    poleBaskets(g, o, sh, back) {
      // đòn gánh: shoulder pole with two hanging baskets
      const sway = Math.sin(o.phase * 1.0) * 2;
      if (back) {
        this.limb(g, -30, sh - 2, 30, sh - 6, 3, '#9a7240');
        this.basket(g, -30 + sway, sh + 22, o.fruit || '#7fbf3a');
      } else this.basket(g, 30 + sway, sh + 18, o.fruit2 || '#f0a030');
    },
    basket(g, x, y, fruit) {
      g.strokeStyle = 'rgba(80,60,30,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x - 9, y - 6); g.moveTo(x, y - 24); g.lineTo(x + 9, y - 6); g.stroke();
      g.fillStyle = '#b8894a'; g.beginPath(); g.moveTo(x - 11, y - 7); g.lineTo(x + 11, y - 7); g.lineTo(x + 8, y + 2); g.lineTo(x - 8, y + 2); g.closePath(); g.fill();
      for (let i = 0; i < 5; i++) this.circle(g, x - 8 + i * 4, y - 8 - (i % 2) * 3, 3.2, i % 2 ? U.shade(fruit, -0.15) : fruit);
    },
    sunglassesRack(g, x, y) {
      g.fillStyle = '#e9e1cf'; this.rr(g, x - 2, y - 10, 16, 24, 2); g.fill();
      for (let r = 0; r < 4; r++) {
        const yy = y - 7 + r * 5.5;
        g.fillStyle = ['#111', '#4a2c14', '#123c6a', '#5a1030'][r];
        this.rr(g, x, yy, 5, 3, 1.4); g.fill(); this.rr(g, x + 7, yy, 5, 3, 1.4); g.fill();
      }
    },
    carryItem(g, kind, x, y, tilt, pct, color) {
      g.save(); g.translate(x, y); g.rotate(tilt || 0);
      const full = pct == null ? 1 : pct;
      if (kind === 'box') { // takeaway box in a plastic bag
        g.fillStyle = '#f6f3ec'; this.rr(g, -12, -13, 24, 13, 2); g.fill();
        g.fillStyle = '#e6e1d6'; g.fillRect(-12, -13, 24, 3);
        g.strokeStyle = '#d23a2a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-12, -6); g.lineTo(12, -6); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -13); g.quadraticCurveTo(0, -24, 6, -13); g.stroke();
        if (full < 0.6) { g.fillStyle = '#b5713a'; g.beginPath(); g.ellipse(6, 0.5, 5 * (1 - full), 1.5, 0, 0, Math.PI * 2); g.fill(); }
      } else if (kind === 'bun') { // bánh bao in a paper bag
        g.fillStyle = '#d9c08a'; this.rr(g, -10, -14, 20, 15, 2); g.fill();
        this.circle(g, -4, -15, 6, '#fbf7ee'); this.circle(g, 4, -16, 6, '#fbf7ee');
        g.strokeStyle = '#d9cdb0'; g.lineWidth = 0.8; g.beginPath(); g.arc(-4, -18, 2.5, 0, Math.PI); g.arc(4, -19, 2.5, 0, Math.PI); g.stroke();
      } else if (kind === 'bread') { // bánh mì in paper
        g.save(); g.rotate(-0.25);
        this.ellipse(g, 0, -6, 15, 4.5, '#e2a95a'); this.ellipse(g, 0, -7.5, 13, 2.5, '#efc27e');
        g.fillStyle = '#f4efe2'; g.fillRect(-15, -10, 12, 8);
        this.ellipse(g, 7, -9, 3, 1.4, '#6fbf4a');
        g.restore();
      } else if (kind === 'cup') { // iced drink with straw, the ice melts as it warms
        const c = color || '#6a3e22';
        g.fillStyle = 'rgba(230,245,255,0.55)'; g.beginPath(); g.moveTo(-7, -20); g.lineTo(7, -20); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill();
        const lvl = 4 + 14 * full;
        g.fillStyle = c; g.beginPath(); g.moveTo(-5 - (lvl / 20) * 2, -lvl); g.lineTo(5 + (lvl / 20) * 2, -lvl); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-4, -lvl + 1, 3, 3); g.fillRect(1, -lvl + 3, 3, 3);
        g.strokeStyle = '#e8432d'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(2, -16); g.lineTo(6, -28); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-6, -19, 1.5, 17);
      } else if (kind === 'pho') {
        g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-11, -6); g.quadraticCurveTo(0, 10, 11, -6); g.closePath(); g.fill();
        g.fillStyle = '#2f6db0'; g.fillRect(-9, -3, 18, 1.4);
        const lvl = 0.4 + 0.6 * (pct == null ? 1 : pct);
        this.ellipse(g, 0, -6, 10.5, 3, '#f3f0e8');
        this.ellipse(g, 0, -6 + (1 - lvl) * 2, 9 * lvl + 1, 2.2, '#c9873a');
        g.fillStyle = '#6fbf4a'; g.fillRect(-4, -7.5, 3, 1.5); g.fillRect(2, -6.5, 3, 1.5);
        this.limb(g, 4, -8, 13, -16, 1.2, '#8b5a2b'); this.limb(g, 6, -8, 14, -15, 1.2, '#8b5a2b');
      } else if (kind === 'cake') {
        g.fillStyle = '#fbf6f0'; this.rr(g, -12, -8, 24, 9, 2); g.fill();
        g.fillStyle = '#f6eee6'; this.rr(g, -9, -16, 18, 8, 2); g.fill();
        g.fillStyle = '#fffaf5'; this.rr(g, -6, -23, 12, 7, 2); g.fill();
        g.fillStyle = '#f2a7b8'; g.fillRect(-12, -9, 24, 1.6); g.fillRect(-9, -17, 18, 1.4); g.fillRect(-6, -24, 12, 1.3);
        this.circle(g, 0, -26, 2, '#e8506e');
        g.fillStyle = '#c9b089'; g.fillRect(-14, 1, 28, 2);
      } else if (kind === 'eggs') {
        g.fillStyle = '#c99a5a'; this.rr(g, -13, -8, 26, 10, 2); g.fill();
        g.strokeStyle = '#8a6434'; g.lineWidth = 0.8; g.strokeRect(-13, -8, 26, 10);
        const n = Math.max(0, Math.round(10 * (pct == null ? 1 : pct)));
        for (let i = 0; i < 10; i++) {
          const ex = -10 + (i % 5) * 5, ey = -9 - Math.floor(i / 5) * 3.2;
          this.ellipse(g, ex, ey, 2.4, 3, i < n ? '#f6ead2' : '#e0c27a');
        }
      }
      g.restore();
    },

    /* =================================================================
     * SCOOTERS
     * variant: {kind, body, seat, riders:[{shirt,helmet,skin,role}],
     *           cargo info}. Side sprite faces right, origin at ground.
     * Heads are drawn live (so riders can turn their heads).
     * ================================================================= */
    // riders' heads are baked in for two "look" states (ahead / turned toward you)
    scooterSprite(v, lookIdx) {
      const live = v.kind === 'banhbao';
      const key = 'sc_' + v.key + (live ? '' : '_' + lookIdx);
      return this.entSprite(key, 150, 120, 75, 104, (g) => {
        this.drawScooterBody(g, v);
        if (!live) for (const r of v.riders) this.riderHead(g, r.x + 3 + (r.small ? 0 : 1), r.headY, r, lookIdx ? -0.8 : 0.25, 0);
      });
    },
    // cars: side view facing right, origin on the ground (no lettering anywhere)
    carSprite(v) {
      return this.entSprite('car_' + v.key, 150, 100, 75, 92, (g) => {
        const b = v.body, dark = U.shade(b, -0.38), light = U.shade(b, 0.3), van = v.sub === 'van';
        const top = van ? -72 : -58;
        // cabin
        g.fillStyle = b;
        g.beginPath();
        if (van) { g.moveTo(-58, -34); g.lineTo(-56, top); g.lineTo(30, top); g.lineTo(48, -40); g.lineTo(58, -34); }
        else { g.moveTo(-44, -34); g.lineTo(-28, top); g.lineTo(18, top); g.lineTo(40, -36); }
        g.closePath(); g.fill();
        // windows
        const glass = g.createLinearGradient(0, top, 0, -36);
        glass.addColorStop(0, '#9fc3d8'); glass.addColorStop(0.5, '#4a6478'); glass.addColorStop(1, '#2b3a48');
        g.fillStyle = glass;
        if (van) { this.rr(g, -50, top + 6, 30, 22, 3); g.fill(); this.rr(g, -16, top + 6, 30, 22, 3); g.fill();
          g.beginPath(); g.moveTo(18, top + 6); g.lineTo(29, top + 6); g.lineTo(44, -42); g.lineTo(18, -42); g.closePath(); g.fill(); }
        else {
          g.beginPath(); g.moveTo(-38, -38); g.lineTo(-25, top + 4); g.lineTo(-6, top + 4); g.lineTo(-6, -38); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(-2, -38); g.lineTo(-2, top + 4); g.lineTo(15, top + 4); g.lineTo(33, -38); g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-20, top + 6); g.lineTo(-14, top + 6); g.lineTo(-24, -40); g.lineTo(-30, -40); g.closePath(); g.fill();
        this.circle(g, 8, -45, 5, 'rgba(25,20,30,0.55)'); // driver
        // lower body
        g.fillStyle = b; this.rr(g, -60, -38, 120, 26, 9); g.fill();
        g.fillStyle = light; this.rr(g, -56, -37, 112, 5, 3); g.fill();
        g.fillStyle = dark; this.rr(g, -60, -18, 120, 7, 4); g.fill();
        g.strokeStyle = U.shade(b, -0.25); g.lineWidth = 1;
        g.beginPath(); g.moveTo(-4, -37); g.lineTo(-4, -16); g.moveTo(van ? -20 : 30, -37); g.lineTo(van ? -20 : 30, -16); g.stroke();
        g.fillStyle = dark; g.fillRect(4, -30, 7, 2); g.fillRect(-14, -30, 7, 2);
        // wheel arches + wheels
        for (const wx of [-36, 37]) {
          g.fillStyle = '#1d1a1a'; g.beginPath(); g.arc(wx, -12, 14, Math.PI, Math.PI * 2); g.fill();
          this.circle(g, wx, -11, 11, '#141416'); this.circle(g, wx, -11, 6, '#b5bac0'); this.circle(g, wx, -11, 2, '#555');
        }
        // lights, mirror, bumpers
        g.fillStyle = '#fff4c8'; this.rr(g, 52, -34, 8, 6, 2); g.fill();
        g.fillStyle = '#d4252a'; this.rr(g, -61, -34, 6, 7, 2); g.fill();
        g.fillStyle = dark; this.rr(g, 24, -42, 7, 5, 2); g.fill();
        g.fillStyle = '#9aa0a6'; this.rr(g, 54, -16, 8, 5, 2); g.fill(); this.rr(g, -62, -16, 8, 5, 2); g.fill();
        if (v.sub === 'taxi') { g.fillStyle = '#fff6c8'; this.rr(g, -12, top - 6, 16, 6, 2); g.fill(); g.strokeStyle = dark; g.strokeRect(-12, top - 6, 16, 6); }
      });
    },
    // animated characters that don't move around (diners, vendors) are cached per animation frame
    personCached(ctx, o, key, frames) {
      const f = Math.floor((((o.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * frames);
      const sc = o.s || 1;
      const spr = this.entSprite('pp_' + key + '_' + f, 80, 120, 40, 108, (g) => {
        const oo = Object.assign({}, o, { x: 0, y: 0, s: 1, phase: f / frames * Math.PI * 2 });
        this.person(g, oo);
      });
      this.draw(ctx, spr, o.x, o.y, sc);
    },
    drawScooterBody(g, v) {
      const body = v.body, dark = U.shade(body, -0.35), light = U.shade(body, 0.3);
      // rear cargo (behind riders)
      this.scooterCargoBack(g, v);
      // wheels
      for (const wx of [-21, 22]) {
        this.circle(g, wx, -9, 9.5, '#18181b');
        this.circle(g, wx, -9, 4.5, '#8d939b');
        this.circle(g, wx, -9, 1.6, '#2a2a2e');
      }
      // main body
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(-33, -15); g.quadraticCurveTo(-34, -27, -22, -29); g.lineTo(-2, -28);
      g.quadraticCurveTo(3, -17, 9, -16); g.lineTo(14, -18); g.lineTo(19, -40); g.lineTo(24, -41);
      g.lineTo(26, -20); g.quadraticCurveTo(24, -13, 14, -12); g.lineTo(-12, -12); g.quadraticCurveTo(-28, -10, -33, -15);
      g.closePath(); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(-30, -13); g.lineTo(14, -13); g.lineTo(13, -11); g.lineTo(-24, -10); g.closePath(); g.fill();
      g.fillStyle = light; g.beginPath(); g.moveTo(-28, -25); g.quadraticCurveTo(-22, -28, -6, -27); g.lineTo(-7, -25); g.lineTo(-27, -23); g.closePath(); g.fill();
      // front fender
      g.fillStyle = body; g.beginPath(); g.arc(22, -9, 11.5, Math.PI * 1.08, Math.PI * 1.92); g.lineTo(31, -12); g.lineTo(13, -12); g.closePath(); g.fill();
      // tail light
      this.rr(g, -35, -22, 4, 4, 1.5); g.fillStyle = '#d4252a'; g.fill();
      // seat
      g.fillStyle = '#26221f'; this.rr(g, -27, -33, 26, 6, 3); g.fill();
      // handlebar + headlight + mirror
      this.limb(g, 20, -41, 16, -48, 3, '#2b2b2f');
      this.limb(g, 16, -48, 12, -49, 3, '#2b2b2f');
      this.limb(g, 18, -46, 16, -56, 1.2, '#2b2b2f'); this.ellipse(g, 16, -57, 2.6, 1.8, '#9fb6c8');
      g.fillStyle = light; this.rr(g, 19, -46, 9, 7, 3); g.fill();
      this.circle(g, 27, -42, 2.6, '#fff4c8');
      // riders (bodies, heads drawn live)
      const R = v.riders;
      for (let i = R.length - 1; i >= 0; i--) this.riderBody(g, R[i]);
      this.scooterCargoFront(g, v);
    },
    riderBody(g, r) {
      const x = r.x, sc = r.small ? 0.72 : 1;
      const hip = -30, sh = hip - 20 * sc;
      const pants = r.pants || '#33363f';
      if (r.role === 'driver') {
        this.limb(g, x, hip, x + 12, hip - 1, 8, pants);
        this.limb(g, x + 12, hip - 1, x + 15, -17, 7, pants);
        this.ellipse(g, x + 17, -16, 4.5, 2.4, '#2a2420');
      } else if (!r.small) {
        this.limb(g, x, hip, x + 9, hip, 7.5, pants);
        this.limb(g, x + 9, hip, x + 8, -18, 6.5, pants);
        this.ellipse(g, x + 10, -17, 4, 2.2, '#2a2420');
      } else {
        this.limb(g, x, hip + 2, x + 6, hip + 6, 5, pants);
      }
      // torso
      g.fillStyle = r.shirt;
      const tw = 17 * sc, th = (hip - sh) + 4;
      this.rr(g, x - tw / 2 + (r.lean || 3), sh, tw, th, 6 * sc); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.15)'; this.rr(g, x - tw / 2 + (r.lean || 3), sh, tw * 0.35, th, 5 * sc); g.fill();
      if (r.stripe) { // reflective jacket stripes (no logos)
        g.fillStyle = 'rgba(230,255,230,0.75)';
        g.fillRect(x - tw / 2 + (r.lean || 3), sh + th * 0.45, tw, 2);
      }
      if (r.bag) { // delivery backpack
        g.fillStyle = r.bag; this.rr(g, x - 20, sh - 4, 15, 22, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 18, sh, 11, 2);
      }
      // arm
      if (r.role === 'driver') { this.limb(g, x + 4, sh + 4, x + 16, -48, 5, r.shirt); this.circle(g, x + 16, -48, 2.8, r.skin); }
      else if (r.role === 'hold') { this.limb(g, x + 5, sh + 5, x + 13, sh + 10, 5, r.shirt); }
    },
    scooterCargoBack(g, v) {
      const k = v.kind;
      if (k === 'crates') {
        const cols = ['#c99a5a', '#b5884c', '#d6aa6a'];
        for (let i = 0; i < 3; i++) {
          g.fillStyle = cols[i]; this.rr(g, -50 + i * 2, -36 - i * 15, 26, 15, 1.5); g.fill();
          g.strokeStyle = 'rgba(90,60,20,0.6)'; g.lineWidth = 0.8; g.strokeRect(-50 + i * 2, -36 - i * 15, 26, 15);
          g.fillStyle = 'rgba(240,230,200,0.7)'; g.fillRect(-40 + i * 2, -36 - i * 15, 5, 15);
        }
      } else if (k === 'boxes') {
        const cols = ['#d8b27a', '#c99a5a', '#e2c08c', '#b88a52', '#d8b27a'];
        for (let i = 0; i < 5; i++) {
          const w = 30 - (i % 2) * 6;
          g.fillStyle = cols[i]; this.rr(g, -54 + (i % 2) * 4, -32 - i * 13, w, 13, 1); g.fill();
          g.strokeStyle = 'rgba(90,60,20,0.5)'; g.lineWidth = 0.8; g.strokeRect(-54 + (i % 2) * 4, -32 - i * 13, w, 13);
        }
        this.limb(g, -42, -98, -38, -30, 1.5, '#2f5f9a');
      } else if (k === 'chickens') {
        for (let c = 0; c < 2; c++) {
          const bx = -54 + c * 4, by = -30 - c * 22;
          g.fillStyle = 'rgba(120,80,40,0.25)'; g.fillRect(bx, by - 22, 30, 22);
          for (let i = 0; i < 3; i++) this.ellipse(g, bx + 6 + i * 9, by - 8, 5, 4.5, i % 2 ? '#f2eee4' : '#b5652b');
          g.strokeStyle = '#7a6a50'; g.lineWidth = 0.9;
          for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(bx + i * 5, by - 22); g.lineTo(bx + i * 5, by); g.stroke(); }
          g.strokeRect(bx, by - 22, 30, 22);
        }
      } else if (k === 'flowers') {
        g.fillStyle = '#a77b44'; g.beginPath(); g.moveTo(-58, -40); g.lineTo(-22, -40); g.lineTo(-26, -24); g.lineTo(-54, -24); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(80,50,20,0.5)'; g.lineWidth = 0.8;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-56 + i * 6, -40); g.lineTo(-54 + i * 5.5, -24); g.stroke(); }
        const fc = ['#ff5c8a', '#ffd23f', '#ff8f3f', '#ffffff', '#c74bd8', '#ff3f3f'];
        for (let i = 0; i < 22; i++) {
          const fx = -56 + (i * 37 % 34), fy = -44 - (i * 23 % 20);
          this.limb(g, fx, fy, fx + 1, -38, 1, '#3f8a3a');
          this.circle(g, fx, fy, 3.2, fc[i % fc.length]);
        }
      } else if (k === 'banhbao') {
        // far-side silver box peeking above
        this.silverBox(g, -44, -76, 40, 34, true);
      } else if (k === 'delivery') {
        // nothing at rear
      } else if (k === 'family') {
        // nothing
      }
    },
    scooterCargoFront(g, v) {
      if (v.kind === 'banhbao') {
        this.silverBox(g, -46, -58, 42, 36, false);
        // megaphone on the handlebar
        g.fillStyle = '#d7dade';
        g.beginPath(); g.moveTo(16, -58); g.lineTo(30, -66); g.lineTo(30, -50); g.closePath(); g.fill();
        g.fillStyle = '#9aa0a8'; this.rr(g, 12, -60, 6, 5, 1.5); g.fill();
      } else if (v.kind === 'flowers') {
        const fc = ['#ff5c8a', '#ffd23f', '#ffffff'];
        for (let i = 0; i < 7; i++) { this.limb(g, 12 + i * 1.5, -38 - i % 3 * 4, 10, -24, 1, '#3f8a3a'); this.circle(g, 12 + i * 1.5, -38 - (i % 3) * 4, 2.8, fc[i % 3]); }
      } else if (v.kind === 'crates') {
        g.fillStyle = '#7a8f3a'; this.rr(g, 2, -26, 14, 11, 2); g.fill();
        for (let i = 0; i < 3; i++) this.circle(g, 5 + i * 4, -27, 2.6, '#9ac24a');
      }
    },
    silverBox(g, x, y, w, h, far) {
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, far ? '#9ea4ab' : '#f2f4f6'); gr.addColorStop(0.5, far ? '#7d838b' : '#c3c8ce'); gr.addColorStop(1, far ? '#8b9198' : '#e4e7ea');
      g.fillStyle = gr; this.rr(g, x, y, w, h, 3); g.fill();
      g.strokeStyle = far ? '#6a7078' : '#8e949b'; g.lineWidth = 1; this.rr(g, x, y, w, h, 3); g.stroke();
      g.fillStyle = far ? '#7a8088' : '#aab0b7'; g.fillRect(x, y + 3, w, 2);
      if (!far) {
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 3, y + 6, 2, h - 10);
        // the sign: BÁNH BAO (from the allowed sign list)
        g.fillStyle = '#d42a24';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = SS.font(12.5, 800, true);
        g.fillText('BÁNH', x + w / 2 + 1, y + h * 0.38);
        g.fillText('BAO', x + w / 2 + 1, y + h * 0.75);
      }
    },
    // vertical (cross-street) scooter: front view (dir=1, coming down) or rear view (dir=-1)
    scooterVSprite(v, dir) {
      return this.entSprite('scv_' + v.key + '_' + dir, 70, 110, 35, 100, (g) => {
        const body = v.body, dark = U.shade(body, -0.35);
        const r = v.riders[0];
        if (dir < 0) { // seen from behind
          if (v.kind === 'crates' || v.kind === 'boxes' || v.kind === 'chickens') {
            g.fillStyle = '#c99a5a'; this.rr(g, -13, -66, 26, 30, 2); g.fill();
            g.strokeStyle = 'rgba(90,60,20,0.5)'; g.lineWidth = 1; g.strokeRect(-13, -66, 26, 30);
          }
          this.ellipse(g, 0, -8, 5, 9, '#18181b');
          g.fillStyle = body; this.rr(g, -11, -34, 22, 22, 7); g.fill();
          this.rr(g, -4, -30, 8, 4, 1.5); g.fillStyle = '#e02a2a'; g.fill();
          g.fillStyle = '#26221f'; this.rr(g, -8, -38, 16, 6, 3); g.fill();
          g.fillStyle = r.shirt; this.rr(g, -10, -58, 20, 24, 7); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.15)'; this.rr(g, -10, -58, 20, 6, 4); g.fill();
          this.limb(g, -9, -52, -15, -44, 5, r.shirt); this.limb(g, 9, -52, 15, -44, 5, r.shirt);
          this.limb(g, -17, -44, 17, -44, 2.5, '#2b2b2f');
        } else { // coming toward camera
          g.fillStyle = r.shirt; this.rr(g, -10, -60, 20, 24, 7); g.fill();
          this.limb(g, -8, -54, -15, -44, 5, r.shirt); this.limb(g, 8, -54, 15, -44, 5, r.shirt);
          this.circle(g, -15, -44, 2.6, r.skin); this.circle(g, 15, -44, 2.6, r.skin);
          this.limb(g, -18, -45, 18, -45, 2.5, '#2b2b2f');
          this.limb(g, -14, -45, -17, -54, 1.2, '#2b2b2f'); this.limb(g, 14, -45, 17, -54, 1.2, '#2b2b2f');
          this.ellipse(g, -17, -55, 2.4, 1.6, '#9fb6c8'); this.ellipse(g, 17, -55, 2.4, 1.6, '#9fb6c8');
          this.ellipse(g, 0, -9, 5, 9, '#18181b');
          g.fillStyle = body; this.rr(g, -12, -40, 24, 26, 8); g.fill();
          g.fillStyle = dark; this.rr(g, -12, -20, 24, 6, 3); g.fill();
          this.circle(g, 0, -34, 4, '#fff4c8');
          g.fillStyle = body; this.rr(g, -7, -16, 14, 7, 3); g.fill();
        }
      });
    },
    // live head on top of a rider (helmet, face turned by `look` -1..1)
    riderHead(ctx, x, y, r, look, mouth) {
      const sc = r.small ? 0.72 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      this.circle(ctx, 0, 0, 9, r.skin);
      if (r.helmet) {
        ctx.fillStyle = r.helmet;
        ctx.beginPath(); ctx.arc(-1, -1, 10.5, Math.PI * 0.95, TAU + 0.15); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-3, -6, 4, Math.PI * 1.1, Math.PI * 1.6); ctx.lineTo(-3, -6); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(1, 7); ctx.stroke();
      } else {
        ctx.fillStyle = r.hair || '#221a14'; ctx.beginPath(); ctx.arc(-1, -1, 9.4, Math.PI * 0.95, TAU + 0.05); ctx.fill();
      }
      const fx = 3.5 + look * 2.5;
      if (r.mask) { ctx.fillStyle = r.mask; this.rr(ctx, fx - 2, 1.5, 7, 5, 2); ctx.fill(); }
      this.circle(ctx, fx + 1.5, -1, 1.2, '#1b1410');
      if (mouth) this.ellipse(ctx, fx + 3, 4.5, 2.3, 2.8 * mouth, '#5a1a14');
      ctx.restore();
    },

    /* =================================================================
     * SHOPS & SIGNS
     * ================================================================= */
    // full facade sprite for one shop (origin at bottom-left of facade)
    shopSprite(shop, L) {
      const key = 'shop_' + shop.id + '_' + L.key;
      const H = 176, w = shop.w;
      return this.sprite(key, w + 8, H + 4, 4, H, (g) => this.drawShop(g, shop, L));
    },
    drawShop(g, shop, L) {
      const w = shop.w, top = shop.top, rng = U.rng(shop.seed);
      const wall = shop.color;
      // wall
      g.fillStyle = wall; g.fillRect(0, -176 + top, w, 176 - top);
      // grime & stains
      for (let i = 0; i < 9; i++) {
        g.fillStyle = 'rgba(60,40,20,' + (0.04 + rng() * 0.06) + ')';
        g.fillRect(rng() * w, -176 + top + rng() * 70, 6 + rng() * 40, 12 + rng() * 50);
      }
      // roof ledge
      g.fillStyle = U.shade(wall, -0.3); g.fillRect(-3, -176 + top, w + 6, 6);
      // upper floor: windows / balcony
      const upTop = -176 + top + 10, upBot = -92;
      const nWin = w > 230 ? 2 : 1;
      for (let i = 0; i < nWin; i++) {
        const ww = 46, wx = nWin === 1 ? w / 2 - ww / 2 : w * (0.28 + i * 0.44) - ww / 2;
        const wy = Math.max(upTop + 6, -150), wh = upBot - wy - 18;
        if (wh < 20) continue;
        // window glow / dark
        const lit = rng() < 0.4 + L.windowGlow * 0.5;
        g.fillStyle = lit ? U.mix('#2a2420', '#ffcf7a', 0.25 + L.windowGlow * 0.6) : '#2a2622';
        g.fillRect(wx, wy, ww, wh);
        // louvred shutters
        const sc = rng() < 0.5 ? '#3f7f6a' : '#4f6f8f';
        g.fillStyle = sc; g.fillRect(wx - 12, wy, 12, wh); g.fillRect(wx + ww, wy, 12, wh);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8;
        for (let y = wy + 3; y < wy + wh; y += 3.5) { g.beginPath(); g.moveTo(wx - 12, y); g.lineTo(wx, y); g.moveTo(wx + ww, y); g.lineTo(wx + ww + 12, y); g.stroke(); }
        g.fillStyle = U.shade(wall, -0.2); g.fillRect(wx - 14, wy - 4, ww + 28, 4);
      }
      // balcony slab + railing + plants
      g.fillStyle = U.shade(wall, -0.35); g.fillRect(-2, -98, w + 4, 6);
      g.strokeStyle = 'rgba(40,40,40,0.75)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(2, -112); g.lineTo(w - 2, -112); g.stroke();
      for (let x = 6; x < w - 2; x += 8) { g.beginPath(); g.moveTo(x, -112); g.lineTo(x, -98); g.stroke(); }
      for (let i = 0; i < 3; i++) {
        if (rng() < 0.35) continue;
        const px = 12 + rng() * (w - 30);
        g.fillStyle = '#8a4a2a'; g.fillRect(px, -106, 10, 8);
        for (let k = 0; k < 6; k++) this.circle(g, px + 5 + (rng() - 0.5) * 14, -110 - rng() * 10, 4 + rng() * 2, rng() < 0.5 ? '#3f7f3a' : '#5a9a45');
        if (rng() < 0.4) this.circle(g, px + 5, -114, 2.5, '#ff6a4a');
      }
      // AC unit
      if (rng() < 0.6) { const ax = rng() < 0.5 ? 8 : w - 34; g.fillStyle = '#d9dcd8'; g.fillRect(ax, -140, 26, 16); g.fillStyle = '#9aa'; for (let k = 0; k < 4; k++) g.fillRect(ax + 3, -137 + k * 3.5, 20, 1.2); }

      // ground floor shop opening
      const oy = -86, oh = 86;
      const gr = g.createLinearGradient(0, oy, 0, 0);
      gr.addColorStop(0, '#4a2c18'); gr.addColorStop(0.5, '#8a5a32'); gr.addColorStop(1, '#c98a4a');
      g.fillStyle = gr; g.fillRect(8, oy, w - 16, oh);
      // interior warm light
      const lg = g.createRadialGradient(w / 2, oy + 30, 5, w / 2, oy + 30, w * 0.6);
      lg.addColorStop(0, 'rgba(255,214,140,' + (0.55 + L.windowGlow * 0.35) + ')'); lg.addColorStop(1, 'rgba(255,190,110,0.05)');
      g.fillStyle = lg; g.fillRect(8, oy, w - 16, oh);
      this.shopInterior(g, shop, w, oy, rng);
      // pillars
      g.fillStyle = U.shade(wall, -0.12); g.fillRect(0, oy - 4, 9, oh + 4); g.fillRect(w - 9, oy - 4, 9, oh + 4);
      // roller shutter top
      g.fillStyle = '#6b6f73'; g.fillRect(8, oy, w - 16, 7);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.6;
      for (let y = oy + 2; y < oy + 7; y += 2) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }

      // awning
      if (shop.awning) {
        const ac = shop.awning;
        g.fillStyle = ac;
        g.beginPath(); g.moveTo(4, -84); g.lineTo(w - 4, -84); g.lineTo(w + 2, -64); g.lineTo(-2, -64); g.closePath(); g.fill();
        if (shop.stripes) {
          g.fillStyle = 'rgba(255,255,255,0.75)';
          for (let x = 4; x < w; x += 22) { g.beginPath(); g.moveTo(x, -84); g.lineTo(x + 11, -84); g.lineTo(x + 12, -64); g.lineTo(x + 1, -64); g.closePath(); g.fill(); }
        }
        g.fillStyle = U.shade(ac, -0.3);
        for (let x = -2; x < w + 2; x += 10) { g.beginPath(); g.arc(x + 5, -64, 5, 0, Math.PI); g.fill(); }
      }

      // sign
      this.drawSignBase(g, shop, L);
    },
    shopInterior(g, shop, w, oy, rng) {
      const t = shop.goods;
      // shelves / counter silhouettes for depth
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(16, oy + 24, w - 32, 3); g.fillRect(16, oy + 46, w - 32, 3);
      const items = { grocery: ['#e84a3a', '#f2c230', '#3d7fd0', '#4fbf7a', '#f08a2a'], beer: ['#c9a24a', '#e8d48a'], barber: ['#cfe8ff'],
        cafe: ['#6a3e22', '#3a2416'], tea: ['#7aa35a'], cane: ['#9ac24a'], steamer: ['#f4efe0'], pho: ['#d8c9a0'], grill: ['#8a5a3a'], rice: ['#f4efe0'], banhmi: ['#e8b86a'] }[t] || ['#aaa'];
      for (let row = 0; row < 2; row++) {
        for (let x = 20; x < w - 24; x += 7 + rng() * 5) {
          if (rng() < 0.2) continue;
          g.fillStyle = items[Math.floor(rng() * items.length)];
          const hh = 6 + rng() * 10;
          g.fillRect(x, oy + 24 + row * 22 - hh, 5, hh);
        }
      }
      if (t === 'barber') { g.fillStyle = 'rgba(200,230,255,0.5)'; g.fillRect(w / 2 - 18, oy + 14, 36, 30); }
      // a person inside (silhouette)
      const px = 30 + rng() * (w - 60);
      this.circle(g, px, oy + 46, 6, 'rgba(20,14,10,0.55)');
      g.fillStyle = 'rgba(20,14,10,0.5)'; this.rr(g, px - 8, oy + 52, 16, 26, 6); g.fill();
    },

    // measure text width in a sprite-friendly way
    textW(g, text, fs, display) { g.font = SS.font(fs, 800, display); return g.measureText(text).width; },

    // sign layout is computed once and cached on the shop
    signLayout(shop) {
      if (shop._sign) return shop._sign;
      const g = this.measureCtx || (this.measureCtx = document.createElement('canvas').getContext('2d'));
      const w = shop.w, st = shop.signStyle;
      let lay;
      if (st === 'vertical') {
        const words = shop.word.split(' ');
        const fs = 19;
        let mw = 0; for (const wd of words) mw = Math.max(mw, this.textW(g, wd, fs, true));
        const pw = mw + 16, ph = words.length * fs * 1.45 + 14;
        lay = { style: st, x: w - pw - 14, y: -170 + shop.top + 40, w: pw, h: ph, fs, lines: words };
        if (lay.y + ph > -88) lay.y = -88 - ph;
      } else if (st === 'icon' || st === 'blank') {
        lay = { style: st, x: w / 2 - 34, y: -150 + Math.max(0, shop.top - 20) * 0.5, w: 68, h: 40 };
      } else {
        let fs = 26;
        let tw = this.textW(g, shop.word, fs, st !== 'neon');
        const maxW = w * 0.82;
        if (tw + 28 > maxW) { fs = Math.max(18, fs * (maxW - 28) / tw); tw = this.textW(g, shop.word, fs, st !== 'neon'); }
        const pw = tw + 28, ph = fs * 1.75;
        lay = { style: st, x: w / 2 - pw / 2, y: -88 - ph - 26, w: pw, h: ph, fs, lines: [shop.word] };
        if (lay.y < -176 + shop.top + 4) lay.y = -176 + shop.top + 4;
      }
      shop._sign = lay;
      return lay;
    },

    drawSignBase(g, shop, L) {
      const s = this.signLayout(shop);
      const display = s.style !== 'neon';
      if (s.style === 'board' || s.style === 'vertical') {
        // painted wooden board (or hanging vertical sign)
        const bc = shop.boardColor, tc = shop.textColor;
        g.fillStyle = 'rgba(0,0,0,0.3)'; this.rr(g, s.x + 3, s.y + 3, s.w, s.h, 4); g.fill();
        g.fillStyle = bc; this.rr(g, s.x, s.y, s.w, s.h, 4); g.fill();
        g.strokeStyle = U.shade(bc, -0.35); g.lineWidth = 2; this.rr(g, s.x + 2, s.y + 2, s.w - 4, s.h - 4, 3); g.stroke();
        if (s.style === 'vertical') { this.limb(g, s.x + 8, s.y, s.x + 8, s.y - 10, 1.5, '#333'); this.limb(g, s.x + s.w - 8, s.y, s.x + s.w - 8, s.y - 10, 1.5, '#333'); }
        g.fillStyle = tc; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = SS.font(s.fs, 800, true);
        const lh = s.style === 'vertical' ? s.fs * 1.45 : 0;
        s.lines.forEach((ln, i) => {
          const cy = s.style === 'vertical' ? s.y + 7 + lh * (i + 0.5) + s.fs * 0.12 : s.y + s.h / 2 + s.fs * 0.14;
          g.fillText(ln, s.x + s.w / 2, cy);
        });
      } else if (s.style === 'neon') {
        // dark backing panel with unlit tubes; the glow is added live
        g.fillStyle = 'rgba(15,12,20,0.85)'; this.rr(g, s.x, s.y, s.w, s.h, 6); g.fill();
        g.strokeStyle = 'rgba(80,80,90,0.9)'; g.lineWidth = 1.5; this.rr(g, s.x, s.y, s.w, s.h, 6); g.stroke();
        g.font = SS.font(s.fs, 700, false); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = U.shade(shop.neon, -0.35);
        g.strokeText(s.lines[0], s.x + s.w / 2, s.y + s.h / 2 + s.fs * 0.14);
        g.fillStyle = U.mix(shop.neon, '#ffffff', 0.55);
        g.fillText(s.lines[0], s.x + s.w / 2, s.y + s.h / 2 + s.fs * 0.14);
      } else {
        // icon sign (no text): round board with a simple pictogram
        g.fillStyle = shop.boardColor; this.rr(g, s.x, s.y, s.w, s.h, 18); g.fill();
        g.strokeStyle = U.shade(shop.boardColor, -0.35); g.lineWidth = 2; this.rr(g, s.x + 2, s.y + 2, s.w - 4, s.h - 4, 16); g.stroke();
        if (s.style === 'icon') this.icon(g, shop.icon, s.x + s.w / 2, s.y + s.h / 2, 13, shop.textColor);
      }
    },
    // live neon glow (additive) for neon signs
    neonGlowSprite(shop) {
      const s = this.signLayout(shop);
      return this.sprite('neon_' + shop.id, s.w + 60, s.h + 60, 30 - s.x, 30 - s.y, (g) => {
        g.font = SS.font(s.fs, 700, false); g.textAlign = 'center'; g.textBaseline = 'middle';
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2 + s.fs * 0.14;
        g.shadowColor = shop.neon; g.shadowBlur = 16;
        g.lineWidth = 4; g.strokeStyle = shop.neon; g.strokeText(s.lines[0], cx, cy);
        g.shadowBlur = 6; g.fillStyle = U.mix(shop.neon, '#ffffff', 0.7); g.fillText(s.lines[0], cx, cy);
        g.shadowBlur = 0;
        g.strokeStyle = U.rgba(shop.neon, 0.9); g.lineWidth = 2; this.rr(g, s.x - 2, s.y - 2, s.w + 4, s.h + 4, 7); g.stroke();
      });
    },

    icon(g, name, x, y, r, col) {
      g.save(); g.translate(x, y);
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = r * 0.16;
      if (name === 'bowl') {
        g.beginPath(); g.moveTo(-r, -r * 0.1); g.quadraticCurveTo(0, r * 1.3, r, -r * 0.1); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(r * 0.2, -r * 0.3); g.lineTo(r * 0.9, -r * 1.1); g.moveTo(r * 0.45, -r * 0.3); g.lineTo(r * 1.1, -r * 0.95); g.stroke();
      } else if (name === 'cup') {
        this.rr(g, -r * 0.6, -r * 0.7, r * 1.1, r * 1.4, r * 0.2); g.fill();
        g.beginPath(); g.arc(r * 0.6, 0, r * 0.35, -Math.PI / 2, Math.PI / 2); g.stroke();
      } else if (name === 'bread') {
        g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.45, -0.3, 0, TAU); g.fill();
      } else if (name === 'bun') {
        g.beginPath(); g.arc(0, r * 0.2, r * 0.8, Math.PI, TAU); g.closePath(); g.fill();
      } else if (name === 'basket') {
        g.beginPath(); g.moveTo(-r, -r * 0.2); g.lineTo(r, -r * 0.2); g.lineTo(r * 0.7, r * 0.8); g.lineTo(-r * 0.7, r * 0.8); g.closePath(); g.fill();
        g.beginPath(); g.arc(0, -r * 0.2, r * 0.6, Math.PI, TAU); g.stroke();
      } else if (name === 'scissors') {
        g.beginPath(); g.arc(-r * 0.5, r * 0.5, r * 0.3, 0, TAU); g.arc(r * 0.5, r * 0.5, r * 0.3, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(-r * 0.3, r * 0.3); g.lineTo(r * 0.5, -r); g.moveTo(r * 0.3, r * 0.3); g.lineTo(-r * 0.5, -r); g.stroke();
      } else if (name === 'glass') {
        g.beginPath(); g.moveTo(-r * 0.6, -r); g.lineTo(r * 0.6, -r); g.lineTo(r * 0.45, r); g.lineTo(-r * 0.45, r); g.closePath(); g.fill();
      }
      g.restore();
    },

    /* ---------- far (parallax) building tile ---------- */
    farTile(idx, L) {
      return this.sprite('far_' + idx + '_' + L.key, 520, 190, 0, 190, (g) => {
        const rng = U.rng(1000 + idx * 77);
        let x = 0;
        while (x < 520) {
          const bw = 60 + rng() * 90, bh = 120 + rng() * 70;
          g.fillStyle = U.mix(L.far, L.farLit, rng() * 0.5);
          g.fillRect(x, -bh, bw + 1, bh);
          // roof clutter: water tanks, antennas
          if (rng() < 0.6) { g.fillStyle = U.shade(L.far, -0.2); g.fillRect(x + bw * 0.3, -bh - 10, 16, 10); this.circle(g, x + bw * 0.3 + 8, -bh - 10, 8, U.shade(L.far, -0.1)); }
          if (rng() < 0.5) this.limb(g, x + bw * 0.7, -bh, x + bw * 0.7, -bh - 22, 1, U.shade(L.far, -0.3));
          // windows
          for (let wy = -bh + 12; wy < -30; wy += 24) {
            for (let wx = x + 8; wx < x + bw - 14; wx += 20) {
              const lit = rng() < 0.15 + L.windowGlow * 0.5;
              g.fillStyle = lit ? U.rgba('#ffcf7a', 0.35 + L.windowGlow * 0.5) : 'rgba(0,0,0,0.22)';
              g.fillRect(wx, wy, 10, 13);
            }
          }
          // small balcony plants
          if (rng() < 0.5) { for (let k = 0; k < 4; k++) this.circle(g, x + 10 + rng() * (bw - 20), -bh + 40 + rng() * 40, 4, 'rgba(60,110,60,0.7)'); }
          x += bw;
        }
      });
    },

    /* =================================================================
     * PROPS / OBSTACLES (cached per instance seed)
     * ================================================================= */
    stool(g, x, y, col, h) {
      h = h || 12;
      g.fillStyle = U.shade(col, -0.2);
      g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 5, y - h); g.lineTo(x + 5, y - h); g.lineTo(x + 7, y); g.lineTo(x + 4, y); g.lineTo(x + 3, y - h + 4); g.lineTo(x - 3, y - h + 4); g.lineTo(x - 4, y); g.closePath(); g.fill();
      g.fillStyle = col; this.rr(g, x - 7, y - h - 3, 14, 4, 1.5); g.fill();
    },
    // a row of parked scooters (side view, overlapping, two rows deep)
    parkedSprite(o) {
      return this.propSprite('pk_' + o.seed + '_' + o.n, o.w + 60, 120, o.w / 2 + 30, 108, (g) => {
        const rng = U.rng(o.seed);
        const cols = SS.WORLDS.vietnam.palette.scooters, helm = SS.WORLDS.vietnam.palette.helmets;
        for (let row = 0; row < 2; row++) {
          const n = Math.max(2, Math.round(o.w / 34));
          for (let i = 0; i < n; i++) {
            const x = -o.w / 2 + 16 + i * ((o.w - 32) / Math.max(1, n - 1)) + (row ? 12 : 0);
            const y = row === 0 ? -o.d + 30 : -4;
            g.save(); g.translate(x, y); g.scale(rng() < 0.5 ? -0.78 : 0.78, 0.78);
            this.drawScooterBody(g, { kind: 'parked', body: cols[Math.floor(rng() * cols.length)], riders: [] });
            if (rng() < 0.45) { g.fillStyle = helm[Math.floor(rng() * helm.length)]; g.beginPath(); g.arc(-14, -38, 9, Math.PI, Math.PI * 2); g.fill(); g.fillRect(-23, -38, 18, 2); }
            g.restore();
          }
        }
      });
    },
    cartSprite(o) {
      return this.propSprite('cart_' + o.seed, 120, 130, 60, 120, (g) => {
        const rng = U.rng(o.seed);
        // wheels
        this.circle(g, -26, -8, 8, '#2a2a2a'); this.circle(g, 26, -8, 8, '#2a2a2a');
        this.circle(g, -26, -8, 3, '#888'); this.circle(g, 26, -8, 3, '#888');
        // cart body
        g.fillStyle = '#3f7f74'; this.rr(g, -40, -40, 80, 26, 3); g.fill();
        g.fillStyle = '#2f5f57'; g.fillRect(-40, -18, 80, 4);
        // glass cabinet
        g.fillStyle = 'rgba(200,230,240,0.45)'; g.fillRect(-36, -66, 72, 26);
        g.strokeStyle = '#c9d6dc'; g.lineWidth = 1.5; g.strokeRect(-36, -66, 72, 26);
        const goods = o.goods || 'banhmi';
        for (let i = 0; i < 7; i++) {
          if (goods === 'banhmi') { g.save(); g.translate(-28 + i * 9, -52); g.rotate(-0.4); this.ellipse(g, 0, 0, 8, 3, '#e8b86a'); g.restore(); }
          else this.circle(g, -28 + i * 9, -48, 4, ['#f2c230', '#e84a3a', '#7fbf3a'][i % 3]);
        }
        // umbrella
        this.limb(g, 30, -40, 30, -102, 2, '#555');
        const uc = ['#d84a3a', '#2f7f74', '#e9a23b'][Math.floor(rng() * 3)];
        g.fillStyle = uc; g.beginPath(); g.moveTo(-10, -96); g.quadraticCurveTo(30, -126, 70, -96); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(20, -96); g.quadraticCurveTo(30, -116, 40, -96); g.closePath(); g.fill();
      });
    },
    durianStallSprite(o, word) {
      return this.propSprite('durian_' + o.seed, 150, 160, 75, 150, (g) => {
        // table
        g.fillStyle = '#7a5a36'; g.fillRect(-56, -30, 112, 8);
        this.limb(g, -50, -22, -50, -2, 3, '#5a4026'); this.limb(g, 50, -22, 50, -2, 3, '#5a4026');
        // durians heaped
        for (let i = 0; i < 14; i++) {
          const dx = -48 + (i % 7) * 15 + (i >= 7 ? 7 : 0), dy = i >= 7 ? -48 : -38;
          this.durian(g, dx, dy, 8);
        }
        // split durian showing yellow flesh
        this.ellipse(g, 30, -56, 7, 5, '#f4d35e');
        // ground baskets
        g.fillStyle = '#b8894a'; g.beginPath(); g.moveTo(-70, -2); g.lineTo(-40, -2); g.lineTo(-44, -18); g.lineTo(-66, -18); g.closePath(); g.fill();
        for (let i = 0; i < 3; i++) this.durian(g, -62 + i * 8, -20, 6);
        // sign board: SẦU RIÊNG
        this.limb(g, -40, -60, -40, -112, 2, '#5a4026'); this.limb(g, 40, -60, 40, -112, 2, '#5a4026');
        g.fillStyle = '#f2c230'; this.rr(g, -60, -142, 120, 32, 4); g.fill();
        g.strokeStyle = '#8a6a10'; g.lineWidth = 2; this.rr(g, -58, -140, 116, 28, 3); g.stroke();
        g.fillStyle = '#2f6a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        let fs = 20; g.font = SS.font(fs, 800, true);
        const tw = g.measureText(word).width; if (tw > 104) { fs = fs * 104 / tw; g.font = SS.font(fs, 800, true); }
        g.fillText(word, 0, -126 + fs * 0.14);
      });
    },
    durian(g, x, y, r) {
      this.circle(g, x, y, r, '#8aa53a');
      g.fillStyle = '#5f7a22';
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); g.lineTo(x + Math.cos(a + 0.25) * r * 0.85, y + Math.sin(a + 0.25) * r * 0.85); g.lineTo(x + Math.cos(a - 0.25) * r * 0.85, y + Math.sin(a - 0.25) * r * 0.85); g.fill(); }
      this.circle(g, x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,200,0.25)');
    },
    potsSprite(o) {
      return this.propSprite('pots_' + o.seed, o.w + 30, 110, o.w / 2 + 15, 100, (g) => {
        const rng = U.rng(o.seed);
        const n = Math.max(2, Math.round(o.w / 26));
        for (let i = 0; i < n; i++) {
          const x = -o.w / 2 + 12 + i * (o.w - 24) / Math.max(1, n - 1), y = -((i % 2) * (o.d - 20)) - 4;
          const kind = rng();
          g.fillStyle = kind < 0.5 ? '#a0522d' : '#3d6d8a';
          g.beginPath(); g.moveTo(x - 9, y - 18); g.lineTo(x + 9, y - 18); g.lineTo(x + 7, y); g.lineTo(x - 7, y); g.closePath(); g.fill();
          if (kind < 0.35) { // kumquat tree
            for (let k = 0; k < 12; k++) this.circle(g, x + (rng() - 0.5) * 26, y - 30 - rng() * 30, 6, rng() < 0.5 ? '#2f6f35' : '#3f8a3a');
            for (let k = 0; k < 8; k++) this.circle(g, x + (rng() - 0.5) * 24, y - 28 - rng() * 30, 2.2, '#ff9a1a');
          } else if (kind < 0.7) { // palm-ish
            for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; this.limb(g, x, y - 18, x + Math.cos(a) * 26, y - 18 + Math.sin(a) * 30, 4, k % 2 ? '#3f8a3a' : '#2f7a35'); }
          } else { // flowering
            for (let k = 0; k < 10; k++) this.circle(g, x + (rng() - 0.5) * 20, y - 24 - rng() * 18, 5, '#3f8a3a');
            for (let k = 0; k < 7; k++) this.circle(g, x + (rng() - 0.5) * 20, y - 24 - rng() * 18, 2.6, rng() < 0.5 ? '#ff5c8a' : '#ffd23f');
          }
        }
      });
    },
    poleSprite() {
      return this.sprite('pole', 50, 470, 25, 460, (g) => {
        const gr = g.createLinearGradient(-6, 0, 6, 0);
        gr.addColorStop(0, '#5d5a55'); gr.addColorStop(0.5, '#8a867e'); gr.addColorStop(1, '#4a4743');
        g.fillStyle = gr; g.fillRect(-6, -460, 12, 460);
        g.fillStyle = '#3a3a3a'; g.fillRect(-12, -300, 24, 30); g.fillRect(-10, -240, 20, 22);
        g.fillStyle = '#c9c4b6'; g.fillRect(-8, -200, 16, 10);
        // coiled cable bundle
        g.strokeStyle = '#1b1b1b'; g.lineWidth = 2;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(0, -330 - i * 3, 14, 6, 0, 0, TAU); g.stroke(); }
        g.fillStyle = '#2a2a2a'; g.fillRect(-20, -420, 40, 4);
      });
    },
    tableSprite(o) {
      return this.propSprite('tbl_' + o.seed, o.w + 30, 70, o.w / 2 + 15, 60, (g) => {
        const rng = U.rng(o.seed);
        const cols = ['#d6382c', '#2c78c2', '#3f9a4a', '#e9a23b'];
        // low table
        g.fillStyle = '#c9cfd4'; this.rr(g, -18, -24, 36, 6, 2); g.fill();
        this.limb(g, -14, -18, -14, -4, 2, '#9aa'); this.limb(g, 14, -18, 14, -4, 2, '#9aa');
        // bowls / glasses
        const items = o.items || 'bowls';
        for (let i = 0; i < 3; i++) {
          if (items === 'cards') { g.fillStyle = '#fafafa'; g.fillRect(-12 + i * 8, -28, 6, 4); }
          else if (items === 'tea') { g.fillStyle = 'rgba(220,180,90,0.85)'; g.fillRect(-12 + i * 9, -32, 5, 8); }
          else { this.ellipse(g, -10 + i * 10, -26, 4.5, 2.2, '#f4f1ea'); }
        }
        // spare stools
        for (let i = 0; i < o.spare; i++) this.stool(g, -o.w / 2 + 10 + rng() * (o.w - 20), -2 - rng() * (o.d - 10), cols[Math.floor(rng() * 4)], 10);
      });
    },

    /* ---------- HUD icons ---------- */
    coin(g, x, y, r, t) {
      const sx = Math.abs(Math.cos(t || 0)) * 0.7 + 0.3;
      g.save(); g.translate(x, y); g.scale(sx, 1);
      this.circle(g, 0, 0, r, '#c98a12');
      this.circle(g, 0, -r * 0.08, r * 0.86, '#ffd34d');
      this.circle(g, 0, 0, r * 0.55, '#f2b42a');
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-r * 0.3, -r * 0.35, r * 0.25, 0, TAU); g.fill();
      g.restore();
    },
    heart(g, x, y, r, col) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(x, y + r * 0.9);
      g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
      g.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
      g.fill();
    },
    // HUD meter icon dials (confidence = walking figure, breath = lungs/wind)
    hudIcon(g, kind, x, y, r) {
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(15,18,28,0.75)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.lineWidth = r * 0.14; g.strokeStyle = kind === 'conf' ? '#f0a33a' : kind === 'breath' ? '#4cc7b8' : '#e9d9b0';
      g.beginPath(); g.arc(0, 0, r * 0.86, 0, TAU); g.stroke();
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = r * 0.13;
      if (kind === 'conf') { // little walking figure
        this.circle(g, r * 0.05, -r * 0.45, r * 0.16, '#fff');
        g.beginPath(); g.moveTo(0, -r * 0.25); g.lineTo(-r * 0.05, r * 0.15); g.lineTo(-r * 0.3, r * 0.5); g.moveTo(-r * 0.05, r * 0.15); g.lineTo(r * 0.25, r * 0.5);
        g.moveTo(-r * 0.3, -r * 0.05); g.lineTo(0, -r * 0.18); g.lineTo(r * 0.3, 0); g.stroke();
      } else if (kind === 'breath') { // wind lines
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-r * 0.45, -r * 0.3 + i * r * 0.3); g.lineTo(r * 0.25, -r * 0.3 + i * r * 0.3); g.arc(r * 0.25, -r * 0.42 + i * r * 0.3, r * 0.12, Math.PI / 2, -Math.PI / 2, true); g.stroke(); }
      }
      g.restore();
    },
  });
})();
