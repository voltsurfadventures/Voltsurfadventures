/* =====================================================================
 * Input — virtual joystick + buttons (multi-touch), keyboard, mouse.
 * ---------------------------------------------------------------------
 * Gameplay reads:  ax, ay (analog -1..1), sprint, breath (held),
 *                  noThanks, buy, pause (edge-triggered, consumed by
 *                  the game each frame via consumeEdges()).
 * Menu pointer events are forwarded to SS.UI.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const Art = SS.Art;

  const I = (SS.Input = {
    keys: {},
    touchMode: false,
    ax: 0, ay: 0, sprint: false, breath: false,
    noThanks: false, buy: false, pause: false,
    buyHoldT: 0, eDownAt: 0, eBuyFired: false,
    joy: { id: null, bx: 0, by: 0, x: 0, y: 0, r: 55 },
    btns: {},          // id -> {x, y, r, label, pointer}
    ptrOwner: {},      // pointerId -> 'joy' | btnId | 'ui'

    init(canvas) {
      this.canvas = canvas;
      const opts = { passive: false };
      canvas.addEventListener('pointerdown', (e) => this.onDown(e), opts);
      window.addEventListener('pointermove', (e) => this.onMove(e), opts);
      window.addEventListener('pointerup', (e) => this.onUp(e), opts);
      window.addEventListener('pointercancel', (e) => this.onUp(e), opts);
      // stop page scroll / zoom / long-press menus
      const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
      canvas.addEventListener('touchstart', prevent, opts);
      canvas.addEventListener('touchmove', prevent, opts);
      canvas.addEventListener('touchend', prevent, opts);
      document.addEventListener('gesturestart', prevent, opts);
      document.addEventListener('contextmenu', prevent);
      document.addEventListener('dblclick', prevent, opts);
      window.addEventListener('keydown', (e) => this.onKey(e, true));
      window.addEventListener('keyup', (e) => this.onKey(e, false));
      window.addEventListener('blur', () => { this.keys = {}; this.releaseAll(); });
      // switching full screen / rotating can swallow the finger-up event
      const reset = () => this.releaseAll();
      document.addEventListener('fullscreenchange', reset);
      document.addEventListener('webkitfullscreenchange', reset);
      window.addEventListener('orientationchange', reset);
      canvas.addEventListener('touchend', (e) => { if (e.touches && e.touches.length === 0) this.releaseAll(); }, { passive: true });
    },

    toView(e) {
      const V = SS.View;
      if (V.rotated) { // the canvas is turned 90° clockwise: screen right edge = game top
        return { x: (e.clientY / V.screenH) * V.w, y: ((V.screenW - e.clientX) / V.screenW) * V.h };
      }
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * V.w, y: ((e.clientY - r.top) / r.height) * V.h };
    },

    gameControlsActive() { return SS.UI && SS.UI.wantsGameControls(); },

    onDown(e) {
      if (e.cancelable) e.preventDefault();
      SS.Audio.unlock();
      if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchMode = true;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      const p = this.toView(e);
      if (this.gameControlsActive()) {
        // pause button works for mouse and touch
        const pb = this.btns.pause;
        if (pb && Math.hypot(p.x - pb.x, p.y - pb.y) < pb.r * 1.25) { this.pause = true; this.ptrOwner[e.pointerId] = 'pause'; return; }
        if (this.touchMode) {
          for (const id of ['sprint', 'breath', 'nothanks', 'buy']) {
            const b = this.btns[id];
            if (b && Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.18) {
              this.ptrOwner[e.pointerId] = id; b.down = true; b.flash = 1;
              if (id === 'nothanks') this.noThanks = true;
              if (id === 'buy') this.buy = true;
              SS.Haptics.vibrate(8);
              return;
            }
          }
          const pad = this.pad;
          if (this.mode() === 'dpad') {
            if (pad && this.joy.id === null && Math.hypot(p.x - pad.x, p.y - pad.y) < pad.r * 1.35) {
              this.joy.id = e.pointerId; this.joy.x = p.x; this.joy.y = p.y;
              this.ptrOwner[e.pointerId] = 'joy';
            }
            return;
          }
          if (p.x < SS.View.w * 0.5 && p.y > SS.View.h * 0.22) {
            // Any thumb on the left half steers. The stick is drawn anchored in the bottom-left corner:
            // touch the stick itself and it works like a normal stick; touch elsewhere and your
            // thumb's starting point becomes the centre (so you never have to hunt for it).
            // A new thumb on the left always takes over (a lost touch can never lock the stick).
            if (this.joy.id !== null) delete this.ptrOwner[this.joy.id];
            const jb = this.joyBase, onStick = jb && Math.hypot(p.x - jb.x, p.y - jb.y) < this.joy.r * 1.5;
            const o = onStick ? jb : p;
            this.joy.id = e.pointerId; this.joy.bx = o.x; this.joy.by = o.y; this.joy.x = p.x; this.joy.y = p.y;
            this.ptrOwner[e.pointerId] = 'joy';
            return;
          }
          return;
        }
      }
      this.ptrOwner[e.pointerId] = 'ui';
      if (SS.UI) SS.UI.pointerDown(p.x, p.y, e.pointerId);
    },

    onMove(e) {
      const owner = this.ptrOwner[e.pointerId];
      if (!owner) return;
      if (e.cancelable) e.preventDefault();
      const p = this.toView(e);
      if (owner === 'joy' && this.mode() === 'dpad') { this.joy.x = p.x; this.joy.y = p.y; }
      else if (owner === 'joy') {
        const j = this.joy, R = j.r;
        const dx = p.x - j.bx, dy = p.y - j.by, d = Math.hypot(dx, dy);
        if (d > R * 1.25) { // the centre follows your thumb, so turning round is instant
          const k = (d - R * 1.25) / d; j.bx += dx * k; j.by += dy * k;
        }
        j.x = p.x; j.y = p.y;
      } else if (owner === 'ui') {
        if (SS.UI) SS.UI.pointerMove(p.x, p.y, e.pointerId);
      }
    },

    onUp(e) {
      const owner = this.ptrOwner[e.pointerId];
      delete this.ptrOwner[e.pointerId];
      if (!owner) return;
      if (owner === 'joy') { this.joy.id = null; }
      else if (owner === 'ui') { const p = this.toView(e); if (SS.UI) SS.UI.pointerUp(p.x, p.y, e.pointerId); }
      else if (this.btns[owner]) { this.btns[owner].down = false; }
    },

    releaseAll() {
      this.joy.id = null;
      for (const k in this.btns) this.btns[k].down = false;
      this.ptrOwner = {};
    },

    onKey(e, down) {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (down) SS.Audio.unlock();
      if (down && !e.repeat) {
        if (k === 'KeyE') { this.noThanks = true; this.eDownAt = performance.now(); this.eBuyFired = false; }
        if (k === 'Escape' || k === 'KeyP') this.pause = true;
        if (SS.UI) SS.UI.key(k);
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) this.touchMode = false;
      }
      this.keys[k] = down;
    },

    // called every simulation frame
    update() {
      const K = this.keys;
      let kx = (K.ArrowRight || K.KeyD ? 1 : 0) - (K.ArrowLeft || K.KeyA ? 1 : 0);
      let ky = (K.ArrowDown || K.KeyS ? 1 : 0) - (K.ArrowUp || K.KeyW ? 1 : 0);
      if (kx && ky) { kx *= Math.SQRT1_2; ky *= Math.SQRT1_2; }
      let ax = kx, ay = ky;
      const j = this.joy;
      if (j.id !== null && this.mode() === 'dpad' && this.pad) {
        // 8-way arrow pad: direction from where your thumb is on the pad
        const dx = j.x - this.pad.x, dy = j.y - this.pad.y, d = Math.hypot(dx, dy);
        if (d > this.pad.r * 0.18) {
          let sx = Math.abs(dx) > d * 0.38 ? Math.sign(dx) : 0, sy = Math.abs(dy) > d * 0.38 ? Math.sign(dy) : 0;
          if (sx && sy) { sx *= Math.SQRT1_2; sy *= Math.SQRT1_2; }
          ax = sx; ay = sy;
        }
      } else if (j.id !== null) {
        let dx = (j.x - j.bx) / j.r, dy = (j.y - j.by) / j.r;
        let m = Math.hypot(dx, dy);
        if (m < 0.12) { dx = 0; dy = 0; m = 0; }
        else {
          // remap: small dead zone -> 0, >0.7 -> full walk (easy to hold a steady pace)
          const mm = U.clamp((m - 0.12) / (0.7 - 0.12), 0, 1);
          dx = (dx / m) * mm; dy = (dy / m) * mm;
        }
        ax = dx; ay = dy;
      }
      this.ax = ax; this.ay = ay;
      this.sprint = !!(K.ShiftLeft || K.ShiftRight || (this.btns.sprint && this.btns.sprint.down));
      this.breath = !!(K.Space || (this.btns.breath && this.btns.breath.down));
      // hold E to buy
      if (K.KeyE && !this.eBuyFired) {
        this.buyHoldT = (performance.now() - this.eDownAt) / 1000;
        if (this.buyHoldT > 0.5) { this.buy = true; this.eBuyFired = true; this.buyHoldT = 0; }
      } else this.buyHoldT = 0;
    },

    // touch: an invisible floating joystick on the left half of the screen
    mode() { return 'joystick'; },

    consumeEdges() { this.noThanks = false; this.buy = false; this.pause = false; },

    /* ---------- layout (in view units, sized from CSS pixels) ---------- */
    layout() {
      const V = SS.View, u = V.unitsPerCss, ins = V.insets;
      const R = 33 * u, r = 27 * u, gap = 10 * u;
      const right = V.w - ins.r - 12 * u, bottom = V.h - ins.b - 10 * u;
      const S = SS.STRINGS;
      const mk = (id, x, y, rad, label, color) => {
        const old = this.btns[id] || {};
        this.btns[id] = { x, y, r: rad, label, color, down: old.down || false, flash: 0 };
      };
      // compact cluster tucked into the bottom-right corner
      mk('sprint', right - R, bottom - R, R, S.btnSprint, '#e2574c');
      mk('breath', right - 2 * R - r - gap, bottom - r, r, S.btnBreath, '#3fb7a6');
      mk('nothanks', right - R, bottom - 2 * R - r - gap, r, S.btnNoThanks, '#f0b43c');
      mk('buy', right - 2 * R - r - gap, bottom - 2 * R - r - gap + 4 * u, r * 0.92, S.btnBuy, '#7fc96b');
      mk('pause', V.w - ins.r - 30 * u, ins.t + 30 * u, 22 * u, '', '#ffffff');
      this.joy.r = 38 * u;
      const pr = 40 * u; // arrow pad: ~100 CSS px across, tucked into the bottom-left corner
      this.pad = { x: ins.l + 10 * u + pr, y: V.h - ins.b - 8 * u - pr, r: pr };
      this.joyBase = { x: ins.l + 10 * u + 42 * u, y: V.h - ins.b - 10 * u - 42 * u }; // fixed joystick, far bottom-left
    },

    /* ---------- drawing the touch controls ---------- */
    draw(ctx, ctxInfo) {
      const V = SS.View, u = V.unitsPerCss;
      // pause button (always)
      const pb = this.btns.pause;
      if (pb) {
        ctx.fillStyle = 'rgba(15,18,28,0.55)';
        ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(pb.x - 7 * u, pb.y - 8 * u, 5 * u, 16 * u);
        ctx.fillRect(pb.x + 2 * u, pb.y - 8 * u, 5 * u, 16 * u);
      }
      if (!this.touchMode) return;
      if (SS.UI && SS.UI.session && SS.UI.session.state === 'intro') return; // no controls during the opening scene
      const j = this.joy, active = j.id !== null;
      if (this.mode() === 'dpad') {
        const P = this.pad, arm = P.r * 0.68, w = P.r * 0.62;
        let dx = 0, dy = 0;
        if (active) { dx = this.ax; dy = this.ay; }
        ctx.globalAlpha = active ? 0.9 : 0.7;
        ctx.fillStyle = 'rgba(15,18,28,0.5)';
        Art.rr(ctx, P.x - w / 2, P.y - P.r, w, P.r * 2, w * 0.3); ctx.fill();
        Art.rr(ctx, P.x - P.r, P.y - w / 2, P.r * 2, w, w * 0.3); ctx.fill();
        for (const [ux, uy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const on = (ux && Math.sign(dx) === ux) || (uy && Math.sign(dy) === uy);
          const cx = P.x + ux * arm, cy = P.y + uy * arm, sz = w * 0.32;
          ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.moveTo(cx + ux * sz, cy + uy * sz);
          ctx.lineTo(cx - ux * sz * 0.6 + uy * sz, cy - uy * sz * 0.6 + ux * sz);
          ctx.lineTo(cx - ux * sz * 0.6 - uy * sz, cy - uy * sz * 0.6 - ux * sz);
          ctx.closePath(); ctx.fill();
        }
      } else {
        // see-through joystick, anchored in the far bottom-left corner
        const P = this.joyBase || this.pad, R = 42 * u;
        const bx = P.x, by = P.y;
        ctx.globalAlpha = active ? 0.8 : 0.5;
        ctx.fillStyle = 'rgba(15,18,28,0.5)';
        ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2 * u; ctx.stroke();
        // little direction chevrons round the rim
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let a = 0; a < 4; a++) {
          const ang = a * Math.PI / 2, cx = bx + Math.cos(ang) * R * 0.78, cy = by + Math.sin(ang) * R * 0.78, s2 = 5 * u;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * s2, cy + Math.sin(ang) * s2);
          ctx.lineTo(cx + Math.cos(ang + 2.3) * s2, cy + Math.sin(ang + 2.3) * s2);
          ctx.lineTo(cx + Math.cos(ang - 2.3) * s2, cy + Math.sin(ang - 2.3) * s2);
          ctx.closePath(); ctx.fill();
        }
        let kx = bx, ky = by;
        const mag = Math.hypot(this.ax, this.ay);
        if (active && mag > 0) {
          const ang = Math.atan2(this.ay, this.ax);
          kx = bx + Math.cos(ang) * R * 0.62 * Math.min(1, mag); ky = by + Math.sin(ang) * R * 0.62 * Math.min(1, mag);
          // glowing arc shows which way you are heading
          ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4 * u;
          ctx.beginPath(); ctx.arc(bx, by, R - 2 * u, ang - 0.5, ang + 0.5); ctx.stroke();
        }
        ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(kx, ky, 17 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
      // action buttons
      const info = ctxInfo || {};
      for (const id of ['sprint', 'breath', 'nothanks', 'buy']) {
        const b = this.btns[id];
        const highlight = info.highlight && info.highlight[id];
        const dim = info.dim && info.dim[id];
        ctx.globalAlpha = dim ? 0.3 : b.down || highlight ? 0.92 : 0.62;
        ctx.fillStyle = b.down ? U.shade(b.color, -0.25) : 'rgba(15,18,28,0.55)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = (highlight ? 4 : 2.5) * u;
        ctx.strokeStyle = b.color; ctx.stroke();
        if (highlight) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
          ctx.strokeStyle = U.rgba(b.color.length === 7 ? b.color : '#ffffff', 0.35 + pulse * 0.4);
          ctx.lineWidth = 6 * u;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 * u + pulse * 3 * u, 0, Math.PI * 2); ctx.stroke();
        }
        // label (wrap to two lines if needed)
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = (info.labels && info.labels[id]) || b.label;
        if (info.cooldown && info.cooldown[id]) { // cooldown sweep
          ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * u;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 3 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - info.cooldown[id])); ctx.stroke();
        }
        const words = label.split(' ');
        const fs = (words.length > 1 ? 8.5 : 10) * u;
        ctx.font = SS.font(fs, 800);
        if (words.length > 1) {
          ctx.fillText(words[0], b.x, b.y - fs * 0.55);
          ctx.fillText(words.slice(1).join(' '), b.x, b.y + fs * 0.6);
        } else ctx.fillText(label, b.x, b.y);
        if (id === 'buy' && info.price) {
          ctx.font = SS.font(9 * u, 700);
          ctx.fillStyle = '#ffd75a';
          ctx.fillText(info.price, b.x, b.y + b.r * 0.62);
        }
      }
      ctx.globalAlpha = 1;
    },
  });
})();
