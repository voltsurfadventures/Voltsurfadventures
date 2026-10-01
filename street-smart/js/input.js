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
    },

    toView(e) {
      const r = this.canvas.getBoundingClientRect();
      const V = SS.View;
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
          if (p.x < SS.View.w * 0.55 && this.joy.id === null) {
            this.joy.id = e.pointerId; this.joy.bx = p.x; this.joy.by = p.y; this.joy.x = p.x; this.joy.y = p.y;
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
      if (owner === 'joy') {
        const j = this.joy, R = j.r;
        let dx = p.x - j.bx, dy = p.y - j.by;
        const d = Math.hypot(dx, dy);
        if (d > R * 1.6) { // drag the base along so the stick never "runs out"
          const k = (d - R * 1.6) / d; j.bx += dx * k; j.by += dy * k;
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
      if (j.id !== null) {
        let dx = (j.x - j.bx) / j.r, dy = (j.y - j.by) / j.r;
        let m = Math.hypot(dx, dy);
        if (m < 0.18) { dx = 0; dy = 0; m = 0; }
        else {
          // remap: dead zone -> 0, >0.85 -> full walk (easy to hold a steady pace)
          const mm = U.clamp((m - 0.18) / (0.85 - 0.18), 0, 1);
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

    consumeEdges() { this.noThanks = false; this.buy = false; this.pause = false; },

    /* ---------- layout (in view units, sized from CSS pixels) ---------- */
    layout() {
      const V = SS.View, u = V.unitsPerCss, ins = V.insets;
      const R = 42 * u, r = 34 * u, gap = 14 * u;
      const right = V.w - ins.r - 18 * u, bottom = V.h - ins.b - 16 * u;
      const S = SS.STRINGS;
      const mk = (id, x, y, rad, label, color) => {
        const old = this.btns[id] || {};
        this.btns[id] = { x, y, r: rad, label, color, down: old.down || false, flash: 0 };
      };
      mk('sprint', right - R, bottom - R, R, S.btnSprint, '#e2574c');
      mk('breath', right - 2 * R - r - gap, bottom - r - 2 * u, r, S.btnBreath, '#3fb7a6');
      mk('nothanks', right - R + 2 * u, bottom - 2 * R - r - gap, r, S.btnNoThanks, '#f0b43c');
      mk('buy', right - 2 * R - r - gap - 6 * u, bottom - 2 * R - r - gap - 14 * u, r * 0.9, S.btnBuy, '#7fc96b');
      mk('pause', V.w - ins.r - 30 * u, ins.t + 30 * u, 22 * u, '', '#ffffff');
      this.joy.r = 56 * u;
      this.joyHome = { x: ins.l + 30 * u + 70 * u, y: V.h - ins.b - 30 * u - 62 * u };
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
      // joystick
      const j = this.joy, active = j.id !== null;
      const bx = active ? j.bx : this.joyHome.x, by = active ? j.by : this.joyHome.y;
      ctx.globalAlpha = active ? 0.9 : 0.45;
      ctx.fillStyle = 'rgba(15,18,28,0.35)';
      ctx.beginPath(); ctx.arc(bx, by, j.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2 * u; ctx.stroke();
      let kx = bx, ky = by;
      if (active) {
        const dx = j.x - j.bx, dy = j.y - j.by, d = Math.hypot(dx, dy), m = Math.min(d, j.r);
        if (d > 0) { kx = bx + (dx / d) * m; ky = by + (dy / d) * m; }
      }
      const g = ctx.createRadialGradient(kx - 6 * u, ky - 6 * u, 2 * u, kx, ky, 26 * u);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(200,210,225,0.7)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(kx, ky, 25 * u, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // action buttons
      const info = ctxInfo || {};
      for (const id of ['sprint', 'breath', 'nothanks', 'buy']) {
        const b = this.btns[id];
        const highlight = info.highlight && info.highlight[id];
        const dim = info.dim && info.dim[id];
        ctx.globalAlpha = dim ? 0.38 : 0.92;
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
        const words = b.label.split(' ');
        const fs = (words.length > 1 ? 10.5 : 12) * u;
        ctx.font = SS.font(fs, 800);
        if (words.length > 1) {
          ctx.fillText(words[0], b.x, b.y - fs * 0.55);
          ctx.fillText(words.slice(1).join(' '), b.x, b.y + fs * 0.6);
        } else ctx.fillText(b.label, b.x, b.y);
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
