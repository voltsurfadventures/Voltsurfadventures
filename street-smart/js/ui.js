/* =====================================================================
 * UI — all menus and screens, drawn on the canvas (immediate mode).
 * Screens: title, levels, settings, credits, game (+ pause overlay),
 * results, gameover. Every string comes from SS.STRINGS.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const S = SS.STRINGS;
  const Art = SS.Art;
  const TAU = Math.PI * 2;

  const UI = (SS.UI = {
    screen: 'title',
    overlay: null,      // 'pause' | 'confirmReset' | 'settings'
    session: null,
    demo: null,
    t: 0,
    hits: [],
    pressed: null,
    drag: null,
    toast: null,
    worldId: 'vietnam',
    musicStarted: false,

    init() {
      // cover art (title screen). If it is missing, the old code-drawn title is used.
      this.cover = new Image();
      this.cover.onload = () => { this.coverReady = true; };
      this.cover.src = 'assets/ui/cover.jpg';
      this.demo = new SS.Session(this.worldId, 1, { demo: true });
      this.go('title');
    },

    go(screen) {
      this.screen = screen; this.t = 0; this.overlay = null; this.pressed = null;
      if (['title', 'levels', 'settings', 'credits', 'howto', 'shop', 'passport', 'story', 'dealer'].includes(screen)) {
        if (this.session) { this.session.destroy(); this.session = null; }
        if (SS.Audio.unlocked) { SS.Audio.playMusic('menu'); SS.Audio.duckMusic(0.8); }
        SS.Audio.setIntensity(0); SS.Audio.setTension(0);
      }
    },

    playStory(then) {
      this.go('story');
      SS.Story.start(() => { if (this.screen === 'story') then(); });
    },

    startLevel(i) {
      if (!SS.Save.data.howtoSeen && this.screen !== 'howto') { this.howtoNext = () => this.startLevel(i); this.go('howto'); return; }
      if (this.session) this.session.destroy();
      const world = SS.WORLDS[this.worldId];
      SS.Audio.bbStop();
      this.session = new SS.Session(this.worldId, i, {});
      this.screen = 'game'; this.overlay = null; this.t = 0;
      SS.Audio.stopMusic();
      SS.Audio.playMusic(world.levels[i].music);
      SS.Audio.duckMusic(1);
    },

    wantsGameControls() {
      return this.screen === 'game' && !this.overlay && this.session && (this.session.state === 'play' || this.session.state === 'intro');
    },

    pause() {
      if (this.screen !== 'game' || this.overlay) return;
      this.overlay = 'pause'; this.t = 0;
      SS.Input.releaseAll();
      SS.Audio.duckMusic(0.35);
      SS.Audio.bbUpdate(0, 0);
      SS.Audio.setAmbience(0, false);
    },
    resume() {
      this.overlay = null;
      SS.Audio.duckMusic(1);
    },

    onLevelEnd(session, won) {
      const res = session.results();
      session.commitCoins();
      const lvl = session.level;
      res.isBest = false;
      if (res.endless) {
        res.isBest = res.total > SS.Save.data.endlessBest;
        if (res.isBest) { SS.Save.data.endlessBest = res.total; SS.Save.save(); }
        res.best = SS.Save.data.endlessBest;
      } else if (won) {
        res.isBest = SS.Save.recordResult(lvl.id, res.stars, res.total);
        if (lvl.tutorial) { SS.Save.data.tutorialDone = true; SS.Save.save(); }
      }
      this.res = res;
      this.screen = won || res.endless ? 'results' : 'gameover';
      this.t = 0; this.starsShown = 0;
      SS.Audio.setAmbience(0.3, true);
      SS.Audio.setIntensity(0); SS.Audio.setTension(0);
    },

    /* ---------- input routing ---------- */
    hitAt(x, y) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
      }
      return null;
    },
    pointerDown(x, y, id) {
      const h = this.hitAt(x, y);
      if (!h) return;
      if (h.slider) { this.drag = { h, id }; this.setSlider(h, x); return; }
      this.pressed = { id: h.id, ptr: id };
    },
    pointerMove(x, y, id) {
      if (this.drag && this.drag.id === id) this.setSlider(this.drag.h, x);
    },
    pointerUp(x, y, id) {
      if (this.drag && this.drag.id === id) { this.drag = null; SS.Save.save(); SS.Audio.sfx('click'); return; }
      const pr = this.pressed; this.pressed = null;
      if (!pr || pr.ptr !== id) return;
      const h = this.hitAt(x, y);
      if (h && h.id === pr.id && h.action) { SS.Audio.sfx('click'); SS.Haptics.vibrate(8); h.action(); }
    },
    setSlider(h, x) {
      const v = U.clamp((x - h.x - h.pad) / (h.w - h.pad * 2), 0, 1);
      SS.Save.data.settings[h.key] = Math.round(v * 20) / 20;
      SS.Main.applySettings();
    },
    key(code) {
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (this.screen === 'title' && !this.overlay) this.go('levels');
        else if (this.screen === 'results') this.nextLevel();
        else if (this.screen === 'gameover') this.startLevel(this.session.levelIndex);
        else if (this.overlay === 'pause') this.resume();
      }
      if (code === 'Escape') {
        if (this.overlay === 'pause' && this.t > 0.1) this.resume();
        else if (this.overlay === 'settings') this.overlay = 'pause';
        else if (this.overlay === 'confirmReset') this.overlay = null;
        else if (this.overlay === 'howto') this.overlay = 'pause';
        else if (['shop', 'passport'].includes(this.screen)) this.go(this.shopBack || 'levels');
        else if (['levels', 'settings', 'credits'].includes(this.screen)) this.go('title');
      }
    },

    nextLevel() {
      const w = SS.WORLDS[this.worldId];
      const n = this.session.levelIndex + 1;
      if (n < w.levels.length && this.levelAvailable(n)) this.startLevel(n);
      else this.go('levels');
    },
    levelAvailable(i) {
      const w = SS.WORLDS[this.worldId];
      if (w.levels[i].requiresFullGame && !SS.Purchases.isFullGameUnlocked()) return false;
      return SS.Save.isUnlocked(w, i);
    },

    /* ---------- update ---------- */
    update(dt) {
      this.t += dt;
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
      // the main theme starts as soon as audio exists (at load in the app; on the first tap in a browser)
      if (SS.Audio.unlocked && !this.musicStarted) {
        this.musicStarted = true;
        if (this.screen !== 'game') { SS.Audio.playMusic('menu'); SS.Audio.duckMusic(0.8); }
      }
      if (this.screen === 'game') {
        const s = this.session;
        if (SS.Input.pause && !this.overlay) { SS.Input.consumeEdges(); this.pause(); return; }
        if (!this.overlay) s.update(dt);
        else SS.Input.consumeEdges();
      } else if (this.screen === 'results' || this.screen === 'gameover') {
        this.session.update(dt); // keep the street alive behind the panel
        if (this.screen === 'results') {
          const want = Math.min(this.res.stars, Math.floor((this.t - 0.5) / 0.45) + 1);
          if (this.t > 0.5 && want > this.starsShown) { this.starsShown = want; SS.Audio.sfx('star'); SS.Haptics.vibrate(15); }
        }
      } else if (this.screen === 'story') {
        SS.Story.update(dt);
        SS.Input.consumeEdges();
      } else {
        this.demo.update(dt);
        SS.Input.consumeEdges();
      }
      SS.Audio.update(dt);
    },

    /* ---------- drawing helpers ---------- */
    u() { return SS.View.unitsPerCss; },
    button(ctx, id, x, y, w, h, label, opts) {
      opts = opts || {};
      const u = this.u();
      const down = this.pressed && this.pressed.id === id;
      const col = opts.color || '#f0a33a';
      const dy = down ? 2 * u : 0;
      if (!opts.flat) { ctx.fillStyle = U.shade(col, -0.45); Art.rr(ctx, x, y + 4 * u, w, h, h * 0.32); ctx.fill(); }
      const g = ctx.createLinearGradient(0, y + dy, 0, y + h + dy);
      g.addColorStop(0, U.shade(col, 0.18)); g.addColorStop(1, U.shade(col, -0.1));
      ctx.fillStyle = opts.flat ? 'rgba(255,255,255,0.08)' : g;
      Art.rr(ctx, x, y + dy, w, h, h * 0.32); ctx.fill();
      if (opts.flat) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 * u; Art.rr(ctx, x, y + dy, w, h, h * 0.32); ctx.stroke(); }
      ctx.fillStyle = opts.text || (opts.flat ? '#fff' : '#22140a');
      ctx.font = SS.font(opts.size || h * 0.4, 800, opts.display !== false);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2 + dy + h * 0.04);
      if (!opts.disabled) this.hits.push({ id, x, y, w, h, action: opts.action });
    },
    backButton(ctx, action) {
      const u = this.u(), ins = SS.View.insets;
      this.button(ctx, 'back', ins.l + 14 * u, ins.t + 12 * u, 96 * u, 40 * u, S.back, { flat: true, size: 15 * u, action });
    },
    dim(ctx, a) { ctx.fillStyle = 'rgba(8,8,16,' + a + ')'; ctx.fillRect(0, 0, SS.View.w, SS.View.h); },
    panel(ctx, x, y, w, h) {
      const u = this.u();
      ctx.fillStyle = 'rgba(14,16,28,0.92)'; Art.rr(ctx, x, y, w, h, 18 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(240,163,58,0.75)'; ctx.lineWidth = 2 * u; Art.rr(ctx, x, y, w, h, 18 * u); ctx.stroke();
    },
    text(ctx, str, x, y, size, color, weight, display, align) {
      ctx.font = SS.font(size, weight || 700, display);
      ctx.fillStyle = color || '#fff'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
    },
    starShape(ctx, x, y, r, filled, scale) {
      ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.48 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.strokeStyle = filled ? '#b87a10' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = r * 0.12; ctx.stroke();
      ctx.restore();
    },
    logo(ctx, cx, cy, size, maxW) {
      const t = this.t, u = this.u();
      const title = SS.CONFIG.TITLE;
      ctx.font = SS.font(size, 800, true);
      if (maxW) { const w = ctx.measureText(title).width * 1.12; if (w > maxW) size *= maxW / w; }
      ctx.save();
      ctx.translate(cx, cy + Math.sin(t * 1.6) * 3 * u);
      ctx.rotate(-0.03);
      ctx.font = SS.font(size, 800, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1a0f1e'; ctx.strokeText(title, 0, size * 0.06);
      ctx.lineWidth = size * 0.12; ctx.strokeStyle = '#ff4fa3'; ctx.strokeText(title, 0, 0);
      const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      g.addColorStop(0, '#fff6c8'); g.addColorStop(0.55, '#ffd23f'); g.addColorStop(1, '#f07a22');
      ctx.fillStyle = g; ctx.fillText(title, 0, 0);
      ctx.restore();
    },
    showToast(text) { this.toast = { text, t: 2 }; },

    /* ---------- render ---------- */
    render(ctx) {
      const V = SS.View, vw = V.w, vh = V.h;
      this.hits = [];
      const u = this.u();
      if (this.screen === 'game' || this.screen === 'results' || this.screen === 'gameover') {
        this.session.render(ctx);
        if (this.screen === 'game') {
          if (!this.overlay) SS.Input.draw(ctx, this.controlsInfo());
          if (this.overlay === 'pause') this.drawPause(ctx, vw, vh, u);
          if (this.overlay === 'settings') this.drawSettings(ctx, vw, vh, u, true);
          if (this.overlay === 'howto') this.drawHowto(ctx, vw, vh, u, () => { this.overlay = 'pause'; });
        } else if (this.screen === 'results') this.drawResults(ctx, vw, vh, u);
        else this.drawGameOver(ctx, vw, vh, u);
      } else {
        if (this.screen === 'story') {
          SS.Story.draw(ctx, vw, vh, u);
          this.hits.push({ id: 'storynext', x: 0, y: 0, w: vw, h: vh, action: () => SS.Story.next() });
          const ins = SS.View.insets;
          this.button(ctx, 'storyskip', vw - ins.r - 104 * u, ins.t + 16 * u, 88 * u, 34 * u, S.skip, { color: '#16141a', text: '#ffffff', size: 13 * u, action: () => SS.Story.finish() });
          return;
        }
        this.demo.render(ctx);
        if (this.screen === 'title') this.drawTitle(ctx, vw, vh, u);
        else if (this.screen === 'levels') this.drawLevels(ctx, vw, vh, u);
        else if (this.screen === 'settings') this.drawSettings(ctx, vw, vh, u, false);
        else if (this.screen === 'credits') this.drawCredits(ctx, vw, vh, u);
        else if (this.screen === 'shop') this.drawShop(ctx, vw, vh, u);
        else if (this.screen === 'dealer') this.drawDealer(ctx, vw, vh, u);
        else if (this.screen === 'passport') this.drawPassport(ctx, vw, vh, u);
        else if (this.screen === 'howto') this.drawHowto(ctx, vw, vh, u, () => { SS.Save.data.howtoSeen = true; SS.Save.save(); const n = this.howtoNext || (() => this.go('title')); this.howtoNext = null; n(); });
      }
      if (this.overlay === 'confirmReset') this.drawConfirm(ctx, vw, vh, u);
      if (this.toast) {
        const s = this.session || this.demo;
        ctx.globalAlpha = Math.min(1, this.toast.t * 3);
        s.panelText(ctx, this.toast.text, vw / 2, vh - V.insets.b - 70 * u, 400 * u, 15 * u, '#fff', 'rgba(15,18,30,0.9)', '#7ff0d8', 1);
        ctx.globalAlpha = 1;
      }
    },

    controlsInfo() {
      const s = this.session, p = s.player;
      if (!p) return {};
      const latched = !!p.latchedBy, near = s.nearSeller();
      const cloudNear = s.clouds.some((c) => Math.abs(c.x - p.x) < c.r + 120);
      const target = p.latchedBy || near;
      return {
        highlight: { nothanks: latched, breath: cloudNear && !p.holding, buy: !!target && s.coins >= (target ? target.cfg.price : 0) },
        dim: { buy: !target, nothanks: !latched, sprint: !!(s.rideDef && (s.rideDef.ability === 'rack' || p.abilityCD > 0)) },
        price: target ? String(target.cfg.price) : null,
        // riding: the SPRINT button becomes the scooter's ability
        labels: s.rideDef ? { sprint: s.rideDef.ability === 'horn' ? S.btnHorn : s.rideDef.ability === 'turbo' ? S.btnTurbo : s.rideDef.abilityName.toUpperCase() } : null,
        cooldown: s.rideDef && p.abilityCD > 0 ? { sprint: p.abilityCD / (s.rideDef.ability === 'turbo' ? 6 : 4) } : null,
      };
    },

    drawTitle(ctx, vw, vh, u) {
      if (this.coverReady) { this.drawCoverTitle(ctx, vw, vh, u); return; }
      const ins = SS.View.insets;
      const g = ctx.createLinearGradient(0, 0, vw * 0.7, 0);
      g.addColorStop(0, 'rgba(8,6,16,0.82)'); g.addColorStop(0.6, 'rgba(8,6,16,0.35)'); g.addColorStop(1, 'rgba(8,6,16,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      const k = U.easeOutBack(U.clamp(this.t / 0.7, 0, 1));
      const lx = ins.l + Math.min(300 * u, vw * 0.3);
      const size = Math.min(64 * u, vw * 0.075);
      ctx.save(); ctx.translate(lx, vh * 0.3); ctx.scale(k, k); this.logo(ctx, 0, 0, size, (lx - ins.l) * 2 - 24 * u); ctx.restore();
      ctx.globalAlpha = U.clamp((this.t - 0.4) / 0.5, 0, 1);
      this.text(ctx, SS.CONFIG.TAGLINE, lx, vh * 0.3 + size * 0.85, Math.min(15 * u, vw * 0.018), '#ffe8c0', 600);
      const w = SS.WORLDS[this.worldId];
      this.text(ctx, w.name + '  ·  ' + w.city.toUpperCase(), lx, vh * 0.3 - size * 0.85, 13 * u, '#7ff0d8', 800);
      const bw = 220 * u, bh = 56 * u, bx = lx - bw / 2;
      let by = vh * 0.3 + size * 0.85 + 34 * u;
      this.button(ctx, 'play', bx, by, bw, bh, S.play, { size: 26 * u, action: () => { if (!SS.Save.data.storySeen) this.playStory(() => this.go('levels')); else this.go('levels'); } });
      by += bh + 12 * u;
      this.button(ctx, 'howto', bx, by, bw / 2 - 6 * u, 38 * u, S.howToPlay, { flat: true, size: 12 * u, action: () => { this.howtoNext = () => this.go('title'); this.go('howto'); } });
      this.button(ctx, 'story', bx + bw / 2 + 6 * u, by, bw / 2 - 6 * u, 38 * u, S.storyBtn, { flat: true, size: 12 * u, action: () => this.playStory(() => this.go('title')) });
      by += 38 * u + 10 * u;
      this.button(ctx, 'settings', bx, by, bw / 2 - 6 * u, 42 * u, S.settings, { flat: true, size: 13 * u, action: () => this.go('settings') });
      this.button(ctx, 'credits', bx + bw / 2 + 6 * u, by, bw / 2 - 6 * u, 42 * u, S.credits, { flat: true, size: 13 * u, action: () => this.go('credits') });
      ctx.globalAlpha = 1;
      // coins
      this.coinBadge(ctx, vw - ins.r - 16 * u, ins.t + 14 * u, u);
      this.text(ctx, S.privacy + '   v' + SS.CONFIG.VERSION, vw / 2, vh - ins.b - 14 * u, 11 * u, 'rgba(255,255,255,0.6)', 600);
      if (!SS.Audio.unlocked && Math.floor(this.t * 2) % 2 === 0) this.text(ctx, S.tapToStart, lx, by + 70 * u, 13 * u, '#ffffff', 700);
      // full screen button (browsers that support it) or the iPhone home-screen tip
      if (SS.Fullscreen.available() && !SS.Fullscreen.isOn()) {
        this.button(ctx, 'fullscr', vw - ins.r - 150 * u, ins.t + 44 * u, 134 * u, 34 * u, S.fullscreenBtn, { color: '#3fb7a6', size: 12 * u, action: () => SS.Fullscreen.enter() });
      } else if (SS.Fullscreen.needsHomeScreenTip()) {
        this.text(ctx, S.iosFullTip, vw / 2, vh - ins.b - 32 * u, 11.5 * u, '#ffd23f', 700);
      }
    },
    // title screen built around the cover art: art on the left, menu column on the right
    drawCoverTitle(ctx, vw, vh, u) {
      const ins = SS.View.insets, img = this.cover;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh);
      const colW = 236 * u, gap = 18 * u;
      const aw = vw - ins.l - ins.r - colW - gap * 3, ah = vh - ins.t - ins.b - 16 * u;
      const k = U.easeOutBack(U.clamp(this.t / 0.8, 0, 1));
      const sc = Math.min(aw / img.width, ah / img.height) * (0.94 + 0.06 * k);
      const w = img.width * sc, h = img.height * sc;
      const cx = ins.l + gap + aw / 2, cy = ins.t + 8 * u + ah / 2;
      ctx.globalAlpha = U.clamp(this.t / 0.5, 0, 1);
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      ctx.globalAlpha = U.clamp((this.t - 0.3) / 0.5, 0, 1);
      const bx = vw - ins.r - gap - colW, bw = colW;
      const total = 56 * u + 12 * u + 40 * u + 10 * u + 40 * u;
      let by = vh / 2 - total / 2;
      const startNew = () => { SS.Save.newGame(); if (!SS.Save.data.storySeen) this.playStory(() => this.go('levels')); else this.go('levels'); };
      if (SS.Save.hasSave()) {
        this.button(ctx, 'continue', bx, by, bw * 0.6 - 5 * u, 56 * u, S.continueGame, { size: 21 * u, action: () => { SS.Save.continueGame(); this.go('levels'); } });
        this.button(ctx, 'play', bx + bw * 0.6 + 5 * u, by, bw * 0.4 - 5 * u, 56 * u, S.newGame, { flat: true, size: 13 * u, action: startNew });
      } else this.button(ctx, 'play', bx, by, bw, 56 * u, S.play, { size: 26 * u, action: startNew });
      by += 56 * u + 12 * u;
      this.button(ctx, 'howto', bx, by, bw / 2 - 5 * u, 40 * u, S.howToPlay, { flat: true, size: 11.5 * u, action: () => { this.howtoNext = () => this.go('title'); this.go('howto'); } });
      this.button(ctx, 'story', bx + bw / 2 + 5 * u, by, bw / 2 - 5 * u, 40 * u, S.storyBtn, { flat: true, size: 12 * u, action: () => this.playStory(() => this.go('title')) });
      by += 40 * u + 10 * u;
      this.button(ctx, 'settings', bx, by, bw / 2 - 5 * u, 40 * u, S.settings, { flat: true, size: 12 * u, action: () => this.go('settings') });
      this.button(ctx, 'credits', bx + bw / 2 + 5 * u, by, bw / 2 - 5 * u, 40 * u, S.credits, { flat: true, size: 12 * u, action: () => this.go('credits') });
      ctx.globalAlpha = 1;
      this.coinBadge(ctx, vw - ins.r - 16 * u, ins.t + 14 * u, u);
      this.text(ctx, S.privacy + '   v' + SS.CONFIG.VERSION, vw / 2, vh - ins.b - 12 * u, 10 * u, 'rgba(255,255,255,0.45)', 600);
      if (!SS.Audio.running()) {
        // browsers keep sound off until the first touch: ask for it, big and clear
        const k = 0.75 + 0.25 * Math.sin(this.t * 5);
        ctx.globalAlpha = k; ctx.fillStyle = 'rgba(0,0,0,0.55)'; Art.rr(ctx, vw / 2 - 170 * u, vh - ins.b - 70 * u, 340 * u, 44 * u, 22 * u); ctx.fill();
        this.text(ctx, S.tapAnywhere, vw / 2, vh - ins.b - 48 * u, 17 * u, '#ffd47a', 800, true);
        ctx.globalAlpha = 1;
      }
      if (SS.Fullscreen.available() && !SS.Fullscreen.isOn()) {
        this.button(ctx, 'fullscr', vw - ins.r - 150 * u, ins.t + 44 * u, 134 * u, 34 * u, S.fullscreenBtn, { color: '#3fb7a6', size: 12 * u, action: () => SS.Fullscreen.enter() });
      } else if (SS.Fullscreen.needsHomeScreenTip()) {
        this.text(ctx, S.iosFullTip, vw / 2, vh - ins.b - 32 * u, 11.5 * u, '#ffd23f', 700);
      }
    },
    // the scooter dealer: buy with coins, pick what you ride (or walk)
    drawDealer(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 410);
      const ins = SS.View.insets, G = SS.Save.data.garage;
      this.dim(ctx, 0.75);
      this.backButton(ctx, () => this.go('levels'));
      this.coinBadge(ctx, vw - ins.r - 16 * u, ins.t + 16 * u, u);
      this.text(ctx, S.dealer, vw / 2, ins.t + 30 * u, 22 * u, '#ffd23f', 800, true);
      this.text(ctx, S.dealerSub, vw / 2, ins.t + 54 * u, 11.5 * u, '#e8e2d0', 600);
      const list = SS.SCOOTERS, n = list.length, gap = 14 * u;
      const cw = Math.min(250 * u, (vw - ins.l - ins.r - 40 * u - gap * (n - 1)) / n), ch = Math.min(270 * u, vh - ins.t - ins.b - 130 * u);
      const x0 = vw / 2 - (n * cw + (n - 1) * gap) / 2, y0 = ins.t + 70 * u;
      const maxSpeed = Math.max(...list.map((s) => s.speed));
      list.forEach((sc, i) => {
        const x = x0 + i * (cw + gap), y = y0, owned = SS.Save.owns(sc.id), riding = G.ride === sc.id && owned;
        ctx.fillStyle = 'rgba(14,16,28,0.94)'; Art.rr(ctx, x, y, cw, ch, 14 * u); ctx.fill();
        ctx.strokeStyle = riding ? '#7fc96b' : owned ? 'rgba(127,201,107,0.5)' : 'rgba(255,210,63,0.5)'; ctx.lineWidth = (riding ? 3 : 1.5) * u; Art.rr(ctx, x, y, cw, ch, 14 * u); ctx.stroke();
        // the scooter itself
        ctx.save(); ctx.translate(x + cw / 2 + 4 * u, y + 96 * u); const k = 0.95 * u; ctx.scale(k, k);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 60, 8, 0, 0, Math.PI * 2); ctx.fill();
        const spr = Art.scooterSprite(this.session ? this.session.scooterVariant(sc, false) : SS.Session.prototype.scooterVariant(sc, false), 0);
        ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h); ctx.restore();
        this.text(ctx, sc.name, x + cw / 2, y + 116 * u, 17 * u, '#fff', 800, true);
        // speed bar
        this.text(ctx, S.statSpeed, x + 16 * u, y + 140 * u, 11 * u, 'rgba(255,255,255,0.7)', 700, false, 'left');
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; Art.rr(ctx, x + 70 * u, y + 135 * u, cw - 86 * u, 10 * u, 5 * u); ctx.fill();
        ctx.fillStyle = sc.body; Art.rr(ctx, x + 70 * u, y + 135 * u, (cw - 86 * u) * sc.speed / maxSpeed, 10 * u, 5 * u); ctx.fill();
        this.text(ctx, '★ ' + sc.abilityName, x + 16 * u, y + 162 * u, 12.5 * u, '#ffd75a', 800, false, 'left');
        ctx.font = SS.font(10.5 * u, 600); ctx.fillStyle = '#e8e2d0'; ctx.textAlign = 'left';
        this.wrap(ctx, sc.desc, cw - 32 * u).slice(0, 3).forEach((ln, k2) => ctx.fillText(ln, x + 16 * u, y + 182 * u + k2 * 14 * u));
        const bx = x + 14 * u, bw = cw - 28 * u, by = y + ch - 46 * u;
        if (riding) this.button(ctx, 'ride_' + sc.id, bx, by, bw, 34 * u, S.riding + ' ✓', { color: '#7fc96b', size: 14 * u, action: () => {} });
        else if (owned) this.button(ctx, 'ride_' + sc.id, bx, by, bw, 34 * u, S.chooseRide, { color: '#3d7fd0', size: 14 * u, action: () => { G.ride = sc.id; SS.Audio.sfx('horn', { type: 2 }); } });
        else {
          const afford = SS.Save.data.coins >= sc.price;
          this.button(ctx, 'buy_' + sc.id, bx, by, bw, 34 * u, sc.price.toLocaleString('en-US'), { size: 15 * u, color: afford ? '#ffd23f' : '#6a6a72', action: () => {
            if (SS.Save.data.coins < sc.price) { this.showToast(S.popNoCoins + ' (' + (sc.price - SS.Save.data.coins).toLocaleString('en-US') + ' more)'); return; }
            SS.Save.data.coins -= sc.price; G.owned[sc.id] = true; G.ride = sc.id;
            SS.Audio.sfx('powerup'); SS.Audio.sfx('horn', { type: 2 }); SS.Haptics.vibrate([20, 40, 20]); this.showToast(S.popBoughtScooter);
          } });
          ctx.font = SS.font(15 * u, 800, true);
          Art.coin(ctx, x + cw / 2 - ctx.measureText(sc.price.toLocaleString('en-US')).width / 2 - 14 * u, by + 17 * u, 7 * u, 0);
          if (!afford) {
            const k2 = U.clamp(SS.Save.data.coins / sc.price, 0, 1);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; Art.rr(ctx, bx, by - 12 * u, bw, 5 * u, 2.5 * u); ctx.fill();
            ctx.fillStyle = '#ffd23f'; Art.rr(ctx, bx, by - 12 * u, bw * k2, 5 * u, 2.5 * u); ctx.fill();
          }
        }
      });
      // walk instead
      const wy = y0 + ch + 12 * u, walking = !SS.Save.ride();
      this.button(ctx, 'walkinstead', vw / 2 - 190 * u, wy, 180 * u, 32 * u, walking ? S.walk + ' ✓' : S.walk, { flat: !walking, color: '#7fc96b', size: 13 * u, action: () => { G.ride = null; } });
      this.button(ctx, 'upgradebike', vw / 2 + 10 * u, wy, 180 * u, 32 * u, '🛵 ' + S.upgradeBike, { color: '#ffd23f', size: 13 * u, action: () => { this.shopBack = 'dealer'; this.go('shop'); } });
    },
    // SAVE GAME: keeps your coins, unlocked levels and upgrades for next time (CONTINUE)
    saveButton(ctx, x, y, w, h, u) {
      this.button(ctx, 'savegame', x, y, w, h, S.saveGame, { color: '#3fb7a6', size: 13 * u, action: () => { SS.Save.saveGame(); this.showToast(S.gameSaved); SS.Audio.sfx('coin'); } });
    },
    // the story goal: savings toward a new scooter
    scooterFund(ctx, x, y, w, u) {
      const nx = SS.Save.nextScooter(), have = SS.Save.data.coins, need = nx ? nx.price : 1, k = nx ? U.clamp(have / need, 0, 1) : 1;
      ctx.fillStyle = 'rgba(15,18,28,0.7)'; Art.rr(ctx, x, y, w, 40 * u, 10 * u); ctx.fill();
      ctx.strokeStyle = SS.COL_PLAYER; ctx.lineWidth = 2 * u; Art.rr(ctx, x, y, w, 40 * u, 10 * u); ctx.stroke();
      this.text(ctx, nx ? S.nextScooter + ': ' + nx.name : S.allScooters, x + 10 * u, y + 12 * u, 10.5 * u, '#9ff0c0', 800, false, 'left');
      if (nx) this.text(ctx, have.toLocaleString('en-US') + ' / ' + need.toLocaleString('en-US'), x + w - 10 * u, y + 12 * u, 10.5 * u, '#ffffff', 800, false, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; Art.rr(ctx, x + 10 * u, y + 23 * u, w - 20 * u, 9 * u, 4.5 * u); ctx.fill();
      if (k > 0) { ctx.fillStyle = SS.COL_PLAYER; Art.rr(ctx, x + 10 * u, y + 23 * u, Math.max(9 * u, (w - 20 * u) * k), 9 * u, 4.5 * u); ctx.fill(); }
      if (nx && k >= 1 && !this.fundToastShown) { this.fundToastShown = true; this.showToast(S.scooterReady); }
    },
    coinBadge(ctx, rx, y, u) {
      ctx.font = SS.font(17 * u, 800, true);
      const txt = String(SS.Save.data.coins);
      const w = ctx.measureText(txt).width + 46 * u;
      ctx.fillStyle = 'rgba(10,12,20,0.72)'; Art.rr(ctx, rx - w, y, w, 30 * u, 15 * u); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, rx - 34 * u, y + 16 * u);
      Art.coin(ctx, rx - 17 * u, y + 15 * u, 9 * u, 0);
    },

    drawLevels(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 400);
      const ins = SS.View.insets;
      this.dim(ctx, 0.55);
      this.backButton(ctx, () => this.go('title'));
      this.coinBadge(ctx, vw - ins.r - 16 * u, ins.t + 16 * u, u);
      this.scooterFund(ctx, ins.l + 124 * u, ins.t + 14 * u, 215 * u, u);
      this.hits.push({ id: 'fund', x: ins.l + 124 * u, y: ins.t + 14 * u, w: 215 * u, h: 40 * u, action: () => this.go('dealer') });
      const w = SS.WORLDS[this.worldId];
      this.text(ctx, S.levelSelect, vw / 2, ins.t + 30 * u, 22 * u, '#ffd23f', 800, true);
      this.text(ctx, w.name + '  ·  ' + w.city, vw / 2, ins.t + 54 * u, 12 * u, '#7ff0d8', 800);
      const n = w.levels.length, gap = 12 * u;
      const avail = vw - ins.l - ins.r - 32 * u;
      const cw = Math.min(215 * u, (avail - (n - 1) * gap) / n), ch = Math.min(232 * u, vh - ins.t - ins.b - 150 * u);
      const x0 = vw / 2 - (n * cw + (n - 1) * gap) / 2, y0 = ins.t + 72 * u;
      w.levels.forEach((lvl, i) => {
        const x = x0 + i * (cw + gap), y = y0;
        const k = U.easeOutCubic(U.clamp((this.t - i * 0.08) / 0.4, 0, 1));
        ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 30 * u);
        const iapLocked = lvl.requiresFullGame && !SS.Purchases.isFullGameUnlocked();
        const unlocked = SS.Save.isUnlocked(w, i) && !iapLocked;
        const rec = SS.Save.level(lvl.id);
        ctx.fillStyle = 'rgba(14,16,28,0.92)'; Art.rr(ctx, x, y, cw, ch, 14 * u); ctx.fill();
        // thumbnail: time-of-day sky + street strip
        const L = SS.LIGHTING[lvl.time];
        const th = ch * 0.36;
        ctx.save(); Art.rr(ctx, x, y, cw, th + 14 * u, 14 * u); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + th);
        g.addColorStop(0, lvl.endless ? '#ff7a4a' : L.sky[0]); g.addColorStop(1, lvl.endless ? '#3a1840' : L.sky[1]);
        ctx.fillStyle = g; ctx.fillRect(x, y, cw, th + 14 * u);
        ctx.fillStyle = L.far; for (let b = 0; b < 6; b++) ctx.fillRect(x + b * cw / 6, y + th * (0.3 + U.hash(b + i * 7) * 0.3), cw / 6 + 1, th);
        ctx.fillStyle = L.road; ctx.fillRect(x, y + th * 0.82, cw, th);
        if (lvl.time === 'night' || lvl.endless) for (let b = 0; b < 5; b++) { ctx.fillStyle = ['#ff4fa3', '#3ff0ff', '#ffe14a'][b % 3]; ctx.fillRect(x + 12 * u + b * cw / 5, y + th * 0.55, 14 * u, 4 * u); }
        ctx.restore();
        // the dishes on this shift
        const foods = lvl.foods.slice(0, 3);
        foods.forEach((fid, j) => {
          const F = SS.FOODS[fid];
          ctx.save(); ctx.translate(x + cw / 2 + (j - (foods.length - 1) / 2) * 34 * u, y + th * 0.66); ctx.scale(1.3 * u, 1.3 * u);
          Art.carryItem(ctx, F.carry, 0, 6, 0, 1, F.cup); ctx.restore();
        });
        this.text(ctx, lvl.endless ? S.endlessName.toUpperCase() : S.level + ' ' + (i + 1), x + cw / 2, y + th + 26 * u, 11 * u, '#f0a33a', 800);
        this.text(ctx, lvl.endless ? 'Rush Hour ∞' : lvl.name, x + cw / 2, y + th + 48 * u, Math.min(17 * u, cw / 11.5), '#fff', 800, true);
        this.text(ctx, lvl.endless ? S.best + ': ' + SS.Save.data.endlessBest : S.ordersCount.replace('{n}', lvl.orders), x + cw / 2, y + th + 70 * u, 12 * u, '#e8e2d0', 600);
        if (unlocked) {
          if (!lvl.endless) {
            for (let st = 0; st < 3; st++) this.starShape(ctx, x + cw / 2 + (st - 1) * 28 * u, y + th + 98 * u, 10 * u, st < rec.stars);
            this.text(ctx, rec.best ? S.best + ': ' + rec.best : ' ', x + cw / 2, y + th + 122 * u, 11 * u, '#9fe6ff', 700);
          }
          this.hits.push({ id: 'lvl' + i, x, y, w: cw, h: ch, action: () => this.startLevel(i) });
          ctx.strokeStyle = this.pressed && this.pressed.id === 'lvl' + i ? '#ffd23f' : 'rgba(240,163,58,0.6)';
          ctx.lineWidth = (this.pressed && this.pressed.id === 'lvl' + i ? 3 : 1.5) * u; Art.rr(ctx, x, y, cw, ch, 14 * u); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; Art.rr(ctx, x, y, cw, ch, 14 * u); ctx.fill();
          this.lockIcon(ctx, x + cw / 2, y + th + 98 * u, 12 * u);
          this.text(ctx, iapLocked ? S.fullGameLocked : S.locked, x + cw / 2, y + th + 126 * u, 12 * u, '#fff', 800);
          if (!iapLocked) this.text(ctx, lvl.endless ? S.endlessHint : S.lockedHint, x + cw / 2, y + th + 144 * u, 9.5 * u, 'rgba(255,255,255,0.7)', 600);
          else this.button(ctx, 'iap' + i, x + 12 * u, y + ch - 46 * u, cw - 24 * u, 34 * u, S.unlockFullGame, { size: 11 * u, color: '#7fc96b', action: () => SS.Purchases.unlockFullGame((ok) => { if (!ok) this.showToast(S.purchaseUnavailable); }) });
        }
        ctx.restore();
      });
      // upgrades + passport
      const bw = 170 * u, by = y0 + ch + 14 * u;
      this.saveButton(ctx, vw / 2 + bw * 0.5 + 24 * u, by, bw, 42 * u, u);
      // the scooter dealer + what you ride this shift
      const R = SS.Save.ride();
      this.button(ctx, 'todealer', vw - ins.r - 16 * u - 150 * u, ins.t + 46 * u, 150 * u, 22 * u, (R ? S.rideWith + ': ' + R.name : S.rideWith + ': ' + S.walk) + '  ▸', { color: R ? '#3d7fd0' : '#6a6a72', size: 10.5 * u, action: () => this.go('dealer') });
      this.button(ctx, 'toshop', vw / 2 - bw * 1.5 - 24 * u, by, bw, 42 * u, S.upgrades, { size: 15 * u, color: '#7fc96b', action: () => { this.shopBack = 'levels'; this.go('shop'); } });
      this.button(ctx, 'topass', vw / 2 - bw / 2, by, bw, 42 * u, S.passport, { size: 14 * u, color: '#ff8fb0', action: () => { this.shopBack = 'levels'; this.go('passport'); } });
    },

    drawShop(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 410);
      const ins = SS.View.insets;
      this.dim(ctx, 0.7);
      this.backButton(ctx, () => this.go(this.shopBack || 'levels'));
      this.coinBadge(ctx, vw - ins.r - 16 * u, ins.t + 16 * u, u);
      this.text(ctx, S.upgradeTitle, vw / 2, ins.t + 30 * u, 22 * u, '#7fc96b', 800, true);
      this.text(ctx, S.upgradeSub, vw / 2, ins.t + 54 * u, 12 * u, '#e8e2d0', 600);
      const ups = SS.UPGRADES, cols = 4, gap = 12 * u;
      const cw = Math.min(230 * u, (vw - ins.l - ins.r - 40 * u - gap * (cols - 1)) / cols), ch = 136 * u;
      const x0 = vw / 2 - (cols * cw + (cols - 1) * gap) / 2, y0 = ins.t + 72 * u;
      ups.forEach((up, i) => {
        const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap);
        const lvl = SS.Save.up(up.id), max = up.prices.length, price = up.prices[lvl];
        ctx.fillStyle = 'rgba(14,16,28,0.92)'; Art.rr(ctx, x, y, cw, ch, 12 * u); ctx.fill();
        ctx.strokeStyle = up.bike ? 'rgba(255,210,63,0.75)' : 'rgba(127,201,107,0.5)'; ctx.lineWidth = (up.bike ? 2.2 : 1.5) * u; Art.rr(ctx, x, y, cw, ch, 12 * u); ctx.stroke();
        if (up.bike) {
          ctx.fillStyle = '#ffd23f'; Art.rr(ctx, x + 12 * u, y - 8 * u, 40 * u, 15 * u, 7 * u); ctx.fill();
          this.text(ctx, '🛵 ' + S.bikeTag, x + 32 * u, y, 9 * u, '#1a1408', 800);
        }
        this.text(ctx, up.name, x + 14 * u, y + 22 * u, 13 * u, '#fff', 800, true, 'left');
        for (let k = 0; k < max; k++) { ctx.fillStyle = k < lvl ? '#7fc96b' : 'rgba(255,255,255,0.18)'; Art.rr(ctx, x + cw - 14 * u - (max - k) * 16 * u, y + 14 * u, 12 * u, 12 * u, 3 * u); ctx.fill(); }
        ctx.font = SS.font(11 * u, 600); ctx.fillStyle = '#e8e2d0'; ctx.textAlign = 'left';
        this.wrap(ctx, up.desc, cw - 28 * u).slice(0, 4).forEach((ln, k) => ctx.fillText(ln, x + 14 * u, y + 46 * u + k * 14 * u));
        if (lvl >= max) this.text(ctx, S.maxed, x + cw / 2, y + ch - 26 * u, 14 * u, '#7fc96b', 800, true);
        else {
          const afford = SS.Save.data.coins >= price;
          this.button(ctx, 'up_' + up.id, x + 14 * u, y + ch - 44 * u, cw - 28 * u, 34 * u, String(price), { size: 15 * u, color: afford ? '#ffd23f' : '#6a6a72', action: () => {
            if (SS.Save.data.coins < price) { this.showToast(S.popNoCoins); return; }
            SS.Save.data.coins -= price; SS.Save.data.upgrades[up.id] = lvl + 1; SS.Save.save();
            SS.Audio.sfx('buy'); SS.Haptics.vibrate([15, 30, 15]); this.showToast(S.bought);
          } });
          Art.coin(ctx, x + cw / 2 - ctx.measureText(String(price)).width / 2 - 14 * u, y + ch - 27 * u, 7 * u, 0);
        }
      });
    },

    drawPassport(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 400);
      const ins = SS.View.insets, st = SS.Save.data.stamps;
      this.dim(ctx, 0.7);
      this.backButton(ctx, () => this.go(this.shopBack || 'levels'));
      const pw = Math.min(vw - ins.l - ins.r - 40 * u, 640 * u), ph = Math.min(vh * 0.86, 330 * u), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2 + 12 * u;
      // a little passport booklet
      ctx.fillStyle = '#f3e7cf'; Art.rr(ctx, px, py, pw, ph, 14 * u); ctx.fill();
      ctx.strokeStyle = '#8a2f2a'; ctx.lineWidth = 3 * u; Art.rr(ctx, px + 6 * u, py + 6 * u, pw - 12 * u, ph - 12 * u, 10 * u); ctx.stroke();
      this.text(ctx, S.passport, vw / 2, py + 30 * u, 20 * u, '#8a2f2a', 800, true);
      this.text(ctx, S.passportSub, vw / 2, py + 52 * u, 11 * u, '#5a4030', 600);
      const ids = SS.FOOD_ORDER, cols = 4, cw = (pw - 40 * u) / cols, chh = (ph - 90 * u) / 2;
      ids.forEach((id, i) => {
        const F = SS.FOODS[id], x = px + 20 * u + (i % cols) * cw + cw / 2, y = py + 76 * u + Math.floor(i / cols) * chh + chh * 0.42;
        const have = !!st[id];
        ctx.save(); ctx.translate(x, y); ctx.scale(1.6 * u, 1.6 * u); ctx.globalAlpha = have ? 1 : 0.25;
        Art.carryItem(ctx, F.carry, 0, 8, 0, 1, F.cup); ctx.restore();
        if (have) { // red ink stamp
          ctx.save(); ctx.translate(x + 14 * u, y - 4 * u); ctx.rotate(-0.25);
          ctx.strokeStyle = 'rgba(190,40,40,0.8)'; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.arc(0, 0, 24 * u, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 19 * u, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        this.text(ctx, F.name, x, y + chh * 0.42, 12.5 * u, have ? '#3a2a1e' : 'rgba(58,42,30,0.45)', 800);
      });
      const got = ids.filter((k) => st[k]).length;
      this.text(ctx, got + ' / ' + ids.length, vw / 2, py + ph - 16 * u, 12 * u, '#8a2f2a', 800);
    },

    lockIcon(ctx, x, y, r) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.25;
      ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.55, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; Art.rr(ctx, x - r * 0.85, y - r * 0.4, r * 1.7, r * 1.3, r * 0.2); ctx.fill();
    },

    drawSettings(ctx, vw, vh, u, fromPause) {
      u = Math.min(u, vh * 0.96 / 520);
      this.dim(ctx, fromPause ? 0.7 : 0.6);
      const st = SS.Save.data.settings;
      const pw = Math.min(460 * u, vw * 0.8), ph = Math.min(478 * u, vh * 0.96), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, S.settings, vw / 2, py + 30 * u, 22 * u, '#ffd23f', 800, true);
      let y = py + 70 * u;
      const lx = px + 26 * u, cw = pw - 52 * u;
      const slider = (key, label) => {
        this.text(ctx, label, lx, y, 13 * u, '#fff', 700, false, 'left');
        this.text(ctx, Math.round(st[key] * 100) + '%', lx + cw, y, 13 * u, '#9fe6ff', 700, false, 'right');
        const sy = y + 20 * u, sw = cw, pad = 10 * u;
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; Art.rr(ctx, lx, sy - 4 * u, sw, 8 * u, 4 * u); ctx.fill();
        ctx.fillStyle = '#f0a33a'; Art.rr(ctx, lx, sy - 4 * u, pad + (sw - pad * 2) * st[key], 8 * u, 4 * u); ctx.fill();
        const kx = lx + pad + (sw - pad * 2) * st[key];
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(kx, sy, 11 * u, 0, TAU); ctx.fill();
        this.hits.push({ id: 'sl_' + key, x: lx - pad, y: sy - 22 * u, w: sw + pad * 2, h: 44 * u, slider: true, key, pad: pad * 2 });
        y += 56 * u;
      };
      slider('music', S.musicVolume);
      slider('sfx', S.sfxVolume);
      // on/off toggles, two per row
      const toggle = (id, label, val, half, act) => {
        const ox = half ? lx + cw / 2 + 8 * u : lx, w2 = cw / 2 - 8 * u;
        this.text(ctx, label, ox, y + 4 * u, 12.5 * u, '#fff', 700, false, 'left');
        this.button(ctx, id, ox + w2 - 64 * u, y - 13 * u, 64 * u, 34 * u, val ? S.on : S.off, { flat: !val, color: '#7fc96b', size: 12 * u, action: act });
      };
      toggle('vib', S.vibration, st.vibration, false, () => { SS.Save.setSetting('vibration', !st.vibration); SS.Haptics.vibrate(20); });
      toggle('zoom', S.zoomSetting, st.zoom !== false, true, () => SS.Save.setSetting('zoom', st.zoom === false));
      y += 46 * u;
      toggle('synth', S.synthMusic, !!st.synthMusic, false, () => { SS.Save.setSetting('synthMusic', !st.synthMusic); const w = SS.Audio.wantMusic; SS.Audio.stopMusic(); if (w) SS.Audio.playMusic(w); });
      if (SS.Fullscreen.available()) toggle('fulls', S.fullscreen, SS.Fullscreen.isOn(), true, () => SS.Fullscreen.toggle());
      y += 46 * u;
      this.text(ctx, S.graphics, lx, y + 4 * u, 13 * u, '#fff', 700, false, 'left');
      const opts = [['auto', S.gfxAuto], ['high', S.gfxHigh], ['low', S.gfxLow]];
      opts.forEach(([k, lab], i) => {
        const bw = 70 * u;
        this.button(ctx, 'gfx' + k, lx + cw - (3 - i) * (bw + 6 * u) + 6 * u, y - 14 * u, bw, 36 * u, lab, { flat: st.graphics !== k, color: '#3fb7a6', size: 12 * u, action: () => { SS.Save.setSetting('graphics', k); SS.Main.applySettings(true); } });
      });
      y += 48 * u;
      y += 6 * u;
      if (!fromPause) this.button(ctx, 'reset', vw / 2 - 110 * u, y - 6 * u, 220 * u, 38 * u, S.resetProgress, { color: '#e2574c', size: 13 * u, action: () => { this.overlay = 'confirmReset'; } });
      const back = fromPause ? () => { this.overlay = 'pause'; } : () => this.go('title');
      this.button(ctx, 'sback', vw / 2 - 80 * u, py + ph - 52 * u, 160 * u, 40 * u, S.back, { flat: true, size: 14 * u, action: back });
    },
    drawConfirm(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 220);
      this.hits = []; // modal
      this.dim(ctx, 0.6);
      const pw = Math.min(400 * u, vw * 0.8), ph = 190 * u, px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, S.resetConfirmTitle, vw / 2, py + 40 * u, 20 * u, '#fff', 800, true);
      this.text(ctx, S.resetConfirmBody, vw / 2, py + 76 * u, 13 * u, '#e8e2d0', 600);
      this.button(ctx, 'rno', px + 24 * u, py + ph - 64 * u, pw / 2 - 36 * u, 42 * u, S.cancel, { flat: true, size: 14 * u, action: () => { this.overlay = null; } });
      this.button(ctx, 'ryes', vw / 2 + 12 * u, py + ph - 64 * u, pw / 2 - 36 * u, 42 * u, S.yesReset, { color: '#e2574c', size: 14 * u, action: () => { SS.Save.reset(); this.overlay = null; this.showToast(S.progressReset); } });
    },
    drawCredits(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 380);
      this.dim(ctx, 0.65);
      this.backButton(ctx, () => this.go('title'));
      const pw = Math.min(560 * u, vw * 0.84), ph = Math.min(330 * u, vh * 0.8), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2 + 10 * u;
      this.panel(ctx, px, py, pw, ph);
      this.logo(ctx, vw / 2, py + 36 * u, 30 * u, pw - 40 * u);
      let y = py + 84 * u;
      for (const [a, b] of S.creditsLines) {
        this.text(ctx, a, vw / 2, y, 12 * u, '#f0a33a', 800);
        this.text(ctx, b, vw / 2, y + 17 * u, 13 * u, '#fff', 600);
        y += 44 * u;
      }
      this.text(ctx, S.privacy, vw / 2, py + ph - 18 * u, 11 * u, 'rgba(255,255,255,0.6)', 600);
    },
    drawPause(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 380);
      this.dim(ctx, 0.62);
      const pw = Math.min(360 * u, vw * 0.7), ph = 350 * u, px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, S.paused, vw / 2, py + 34 * u, 26 * u, '#ffd23f', 800, true);
      const bw = pw - 70 * u, bx = vw / 2 - bw / 2;
      let y = py + 64 * u;
      this.button(ctx, 'resume', bx, y, bw, 48 * u, S.resume, { size: 20 * u, action: () => this.resume() }); y += 60 * u;
      this.button(ctx, 'restart', bx, y, bw, 40 * u, S.restart, { flat: true, size: 14 * u, action: () => this.startLevel(this.session.levelIndex) }); y += 50 * u;
      this.button(ctx, 'phowto', bx, y, bw, 40 * u, S.howToPlay, { flat: true, size: 14 * u, action: () => { this.overlay = 'howto'; } }); y += 50 * u;
      this.button(ctx, 'psettings', bx, y, bw, 40 * u, S.settings, { flat: true, size: 14 * u, action: () => { this.overlay = 'settings'; } }); y += 50 * u;
      if (this.session.level.endless) this.button(ctx, 'endshift', bx, y, bw, 40 * u, S.endShift, { color: '#e2574c', size: 14 * u, action: () => { this.overlay = null; this.session.endEndless('cashout'); } });
      else this.button(ctx, 'quit', bx, y, bw, 40 * u, S.quit, { flat: true, size: 14 * u, action: () => this.go('levels') });
      this.text(ctx, SS.Input.touchMode ? S.controlsTouch : S.controlsKeys, vw / 2, vh - SS.View.insets.b - 18 * u, 11 * u, 'rgba(255,255,255,0.75)', 600);
    },

    // word-wrap helper for the rules screen
    wrap(ctx, text, maxW) {
      const words = text.split(' '), lines = []; let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      return lines;
    },
    drawHowto(ctx, vw, vh, u, done) {
      u = Math.min(u, vh * 0.97 / 400);
      this.dim(ctx, 0.78);
      const ins = SS.View.insets;
      const pw = Math.min(vw - ins.l - ins.r - 24 * u, 860 * u), ph = Math.min(vh * 0.95, 390 * u), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, S.howToPlay, vw / 2, py + 28 * u, 22 * u, '#ffd23f', 800, true);
      const cards = S.howto, n = cards.length, gap = 12 * u;
      const cw = (pw - 32 * u - gap * (n - 1)) / n, cy = py + 52 * u, ch = ph - 130 * u;
      const icons = [
        (x, y) => { ctx.save(); ctx.translate(x - 14 * u, y + 6 * u); ctx.scale(1.4 * u, 1.4 * u); Art.carryItem(ctx, 'pho', 0, 0, 0, 1); ctx.restore();
          ctx.fillStyle = '#ffd75a'; ctx.beginPath(); ctx.moveTo(x + 16 * u, y - 14 * u); ctx.lineTo(x + 36 * u, y - 6 * u); ctx.lineTo(x + 16 * u, y + 2 * u); ctx.fill(); ctx.fillRect(x + 14 * u, y - 14 * u, 3 * u, 30 * u); },
        (x, y) => Art.hudIcon(ctx, 'conf', x, y, 18 * u),
        (x, y) => { Art.hudIcon(ctx, 'breath', x - 14 * u, y, 15 * u); Art.coin(ctx, x + 18 * u, y, 10 * u, 0); },
        (x, y) => { ctx.save(); ctx.translate(x, y + 16 * u); ctx.scale(0.9 * u, 0.9 * u); Art.silverBox(ctx, -21, -36, 42, 36, false); ctx.restore(); },
      ];
      cards.forEach(([title, body], i) => {
        const x = px + 16 * u + i * (cw + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; Art.rr(ctx, x, cy, cw, ch, 12 * u); ctx.fill();
        icons[i](x + cw / 2, cy + 34 * u);
        this.text(ctx, title, x + cw / 2, cy + 72 * u, 13 * u, '#f0a33a', 800);
        ctx.font = SS.font(11.5 * u, 600); ctx.fillStyle = '#f2ece0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        this.wrap(ctx, body, cw - 18 * u).forEach((ln, k) => ctx.fillText(ln, x + cw / 2, cy + 94 * u + k * 15.5 * u));
      });
      this.text(ctx, S.howtoFooter, vw / 2, py + ph - 66 * u, 12 * u, '#9fe6ff', 700);
      this.button(ctx, 'howtogo', vw / 2 - 90 * u, py + ph - 50 * u, 180 * u, 40 * u, this.screen === 'howto' ? S.letsGo : S.back, { size: 16 * u, action: done });
    },

    statsLines(res) {
      const st = res.stats;
      return [
        [S.statOrders, res.delivered + ' / ' + res.orders],
        [S.statRating, res.delivered ? res.avg.toFixed(1) + ' / 5' : '-'],
        [S.coinsToFund, '+' + Math.max(0, res.coinsEarned | 0)],
        [S.statStreak, String(res.bestStreak)],
        [S.statNearMiss, String(st.nearMiss)],
        [S.statBanhBao, String(st.banhbao)],
        [S.statSellers, String(st.sellers)],
        [S.statTime, U.fmtTime(res.time)],
      ];
    },
    drawResults(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 420);
      const res = this.res;
      this.dim(ctx, U.clamp(this.t * 2, 0, 0.62));
      const k = U.easeOutBack(U.clamp(this.t / 0.5, 0, 1));
      const pw = Math.min(540 * u, vw * 0.86), ph = Math.min(400 * u, vh * 0.94), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      ctx.save(); ctx.translate(vw / 2, vh / 2); ctx.scale(k, k); ctx.translate(-vw / 2, -vh / 2);
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, res.endless ? (res.endlessDone ? S.endlessComplete : S.shiftOver) : S.shiftComplete, vw / 2, py + 32 * u, 28 * u, '#ffd23f', 800, true);
      if (res.endless) this.text(ctx, S.endlessReached.replace('{n}', res.day).replace('{max}', res.days), vw / 2, py + 54 * u, 13 * u, '#7ff0d8', 800);
      if (!res.endless) for (let s = 0; s < 3; s++) {
        const shown = s < this.starsShown;
        const pop = shown ? U.easeOutBack(U.clamp((this.t - 0.5 - s * 0.45) / 0.35, 0, 1)) : 1;
        this.starShape(ctx, vw / 2 + (s - 1) * 52 * u, py + 76 * u - (s === 1 ? 8 * u : 0), 20 * u, shown, shown ? pop : 1);
      } else this.text(ctx, S.statBest + ': ' + res.best, vw / 2, py + 72 * u, 15 * u, '#9fe6ff', 800);
      const counted = Math.round(res.total * U.clamp((this.t - 0.4) / 1.2, 0, 1));
      this.text(ctx, S.score + ': ' + counted, vw / 2, py + 116 * u, 22 * u, '#fff', 800, true);
      if (res.isBest && this.t > 1.7) this.text(ctx, S.newBest, vw / 2 + pw * 0.34, py + 116 * u, 13 * u, '#7ff0d8', 800);
      const lines = this.statsLines(res);
      const colW = (pw - 60 * u) / 2;
      lines.forEach(([a, b], i) => {
        const cx = px + 30 * u + (i % 2) * colW, y = py + 150 * u + Math.floor(i / 2) * 25 * u;
        this.text(ctx, a, cx, y, 12.5 * u, 'rgba(255,255,255,0.75)', 600, false, 'left');
        this.text(ctx, b, cx + colW - 18 * u, y, 13 * u, '#ffd75a', 800, false, 'right');
      });
      const w = SS.WORLDS[this.worldId];
      const nextI = this.session.levelIndex + 1;
      const hasNext = !res.endless && nextI < w.levels.length && this.levelAvailable(nextI);
      const nb = hasNext ? 4 : 3, by = py + ph - 60 * u, bw = (pw - 48 * u - (nb - 1) * 12 * u) / nb;
      this.saveButton(ctx, px + 24 * u + (bw + 12 * u) * (nb - 1), by, bw, 44 * u, u);
      this.button(ctx, 'rshop', px + 24 * u, by, bw, 44 * u, S.upgrades, { flat: true, size: 14 * u, action: () => { this.shopBack = 'levels'; this.go('shop'); } });
      this.button(ctx, 'rretry', px + 36 * u + bw, by, bw, 44 * u, S.retry, { flat: !!hasNext, size: 14 * u, action: () => this.startLevel(this.session.levelIndex) });
      if (hasNext) this.button(ctx, 'rnext', px + 48 * u + bw * 2, by, bw, 44 * u, S.next, { size: 15 * u, action: () => this.nextLevel() });
      ctx.restore();
    },
    drawGameOver(ctx, vw, vh, u) {
      u = Math.min(u, vh * 0.96 / 360);
      const res = this.res;
      this.dim(ctx, U.clamp(this.t * 2, 0, 0.66));
      const k = U.easeOutBack(U.clamp(this.t / 0.5, 0, 1));
      const pw = Math.min(500 * u, vw * 0.82), ph = Math.min(340 * u, vh * 0.92), px = vw / 2 - pw / 2, py = vh / 2 - ph / 2;
      ctx.save(); ctx.translate(vw / 2, vh / 2); ctx.scale(k, k); ctx.translate(-vw / 2, -vh / 2);
      this.panel(ctx, px, py, pw, ph);
      this.text(ctx, S.gameOver, vw / 2, py + 36 * u, 30 * u, '#ff6a5a', 800, true);
      this.text(ctx, res.reason === 'orders' ? S.cargoBroken : S.outOfLives, vw / 2, py + 70 * u, 14 * u, '#e8e2d0', 600);
      this.text(ctx, S.score + ': ' + res.base, vw / 2, py + 100 * u, 18 * u, '#fff', 800, true);
      const lines = this.statsLines(res).slice(0, 6);
      const colW = (pw - 60 * u) / 2;
      lines.forEach(([a, b], i) => {
        const cx = px + 30 * u + (i % 2) * colW, y = py + 134 * u + Math.floor(i / 2) * 25 * u;
        this.text(ctx, a, cx, y, 12.5 * u, 'rgba(255,255,255,0.75)', 600, false, 'left');
        this.text(ctx, b, cx + colW - 18 * u, y, 13 * u, '#ffd75a', 800, false, 'right');
      });
      const by = py + ph - 60 * u, bw = (pw - 72 * u) / 3;
      this.saveButton(ctx, px + pw / 2 - 80 * u, by - 54 * u, 160 * u, 40 * u, u);
      this.button(ctx, 'gmenu', px + 24 * u, by, bw, 44 * u, S.menu, { flat: true, size: 14 * u, action: () => this.go('levels') });
      this.button(ctx, 'gshop', px + 36 * u + bw, by, bw, 44 * u, S.upgrades, { flat: true, size: 14 * u, action: () => { this.shopBack = 'levels'; this.go('shop'); } });
      this.button(ctx, 'gretry', px + 48 * u + bw * 2, by, bw, 44 * u, S.retry, { size: 16 * u, action: () => this.startLevel(this.session.levelIndex) });
      ctx.restore();
    },
  });
})();
