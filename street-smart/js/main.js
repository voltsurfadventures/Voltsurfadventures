/* =====================================================================
 * Main — boot, responsive high-DPI canvas, safe areas, fixed-timestep
 * loop, automatic low-quality mode, background pause/mute.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const C = SS.CONFIG;

  SS.View = { w: 960, h: C.VIEW_H, S: 1, cssW: 960, cssH: 540, unitsPerCss: 1, insets: { l: 0, r: 0, t: 0, b: 0 }, portrait: false };

  /* ---------------- Full screen ----------------
   * Browsers: enter real full screen on the first tap (a user gesture is
   * required) and lock to landscape where the browser allows it.
   * iPhone Safari has no full-screen API; there the game shows a tip to
   * "Add to Home Screen", which runs it full screen (see the meta tags and
   * manifest.webmanifest). In the Capacitor app the status bar is hidden. */
  const Full = (SS.Fullscreen = {
    autoTried: false,
    native() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); },
    standalone() {
      const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
      // an installed home-screen app (not just a browser that is in full screen right now)
      return navigator.standalone === true || mm('(display-mode: standalone)') || (mm('(display-mode: fullscreen)') && !this.isOn());
    },
    available() {
      if (this.native() || (this.standalone() && !this.isOn())) return false;
      const d = document, el = d.documentElement;
      return !!((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen));
    },
    isOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    needsHomeScreenTip() {
      const iOS = /iPhone|iPod/.test(navigator.userAgent);
      return iOS && !this.available() && !this.standalone() && !this.native();
    },
    enter() {
      if (!this.available() || this.isOn()) return;
      const el = document.documentElement;
      try {
        const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
        if (p && p.then) p.then(() => this.lockLandscape()).catch(() => {});
      } catch (e) { /* not allowed here (e.g. inside a frame) */ }
    },
    exit() {
      try { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { /* */ }
    },
    toggle() { if (this.isOn()) this.exit(); else this.enter(); },
    lockLandscape() {
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ }
    },
    // first tap on a phone/tablet: go full screen once (never nag after the player leaves it)
    auto(e) {
      if (this.autoTried) return;
      if (e && e.pointerType === 'mouse') return;
      if (!SS.Input.touchMode && !(e && e.type === 'touchend')) return;
      this.autoTried = true;
      this.enter();
    },
    nativeSetup() {
      if (!this.native()) return;
      const P = window.Capacitor.Plugins || {};
      try { if (P.StatusBar) { P.StatusBar.hide(); if (P.StatusBar.setOverlaysWebView) P.StatusBar.setOverlaysWebView({ overlay: true }); } } catch (e) { /* */ }
      try { if (P.ScreenOrientation && P.ScreenOrientation.lock) P.ScreenOrientation.lock({ orientation: 'landscape' }); } catch (e) { /* */ }
    },
  });

  const M = (SS.Main = {
    quality: 1,           // 1 = high, 0.5 = low (fewer particles, simpler effects)
    lowMode: false,
    acc: 0,
    last: 0,
    perf: { sum: 0, n: 0, slow: 0 },

    boot() {
      SS.Save.load();
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.safe = document.getElementById('safe-probe');
      SS.Input.init(this.canvas);
      this.applySettings(true);
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
      if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
      // full screen: phones go full screen on the first tap; re-measure when it changes
      Full.nativeSetup();
      const autoFs = (e) => Full.auto(e);
      window.addEventListener('pointerup', autoFs, true);
      window.addEventListener('touchend', autoFs, true);
      const fsChange = () => setTimeout(() => this.resize(), 60);
      document.addEventListener('fullscreenchange', fsChange);
      document.addEventListener('webkitfullscreenchange', fsChange);

      // auto-pause + mute when the app goes to the background
      const hide = () => { SS.UI.pause(); SS.Audio.suspend(); };
      document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else { SS.Audio.resume(); this.last = performance.now(); } });
      window.addEventListener('pagehide', hide);
      window.addEventListener('blur', () => { if (SS.UI.screen === 'game') SS.UI.pause(); });
      // Capacitor (if present) also reports app state changes
      document.addEventListener('pause', hide, false);
      document.addEventListener('resume', () => SS.Audio.resume(), false);

      this.waitForFonts().then(() => {
        SS.UI.init();
        const ld = document.getElementById('loading');
        if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 600); }
        this.last = performance.now();
        requestAnimationFrame((t) => this.frame(t));
      });
    },

    // Wait for the bundled fonts (or time out and use the fallback stack)
    waitForFonts() {
      if (!document.fonts || !document.fonts.load) return Promise.resolve();
      const loads = [
        "400 20px 'Be Vietnam Pro'", "600 20px 'Be Vietnam Pro'", "700 20px 'Be Vietnam Pro'", "800 20px 'Be Vietnam Pro'",
        "700 20px 'Baloo 2'", "800 20px 'Baloo 2'",
      ].map((f) => document.fonts.load(f, 'ẮẦỞỨ đĐ ơư').catch(() => null));
      const timeout = new Promise((r) => setTimeout(r, 2500));
      return Promise.race([Promise.all(loads).then(() => document.fonts.ready), timeout]);
    },

    applySettings(resizeNow) {
      const st = SS.Save.data.settings;
      SS.Audio.setVolumes(st.music, st.sfx);
      const g = st.graphics;
      const wasLow = this.lowMode;
      if (g === 'low') this.lowMode = true;
      else if (g === 'high') this.lowMode = false;
      this.quality = this.lowMode ? 0.5 : 1;
      if (resizeNow && wasLow !== this.lowMode && this.canvas) this.resize();
    },

    resize() {
      const V = SS.View;
      const vv = window.visualViewport;
      const cssW = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
      const cssH = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
      V.portrait = cssH > cssW * 1.05;
      document.body.classList.toggle('portrait', V.portrait);
      if (V.portrait && SS.UI && SS.UI.screen === 'game') SS.UI.pause();
      const dprCap = this.lowMode ? C.LOW_DPR : C.MAX_DPR;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      V.cssW = cssW; V.cssH = cssH;
      V.h = C.VIEW_H;
      V.w = C.VIEW_H * cssW / cssH;
      V.S = this.canvas.height / V.h;
      V.unitsPerCss = V.h / cssH;
      // UI sizes are specified in CSS pixels; keep them sane on tiny/huge screens
      V.unitsPerCss = Math.min(Math.max(V.unitsPerCss, 0.75), 1.6);
      // safe-area insets (notches, rounded corners, home indicator)
      const cs = this.safe ? getComputedStyle(this.safe) : null;
      const px = (v) => (parseFloat(v) || 0) * (V.h / cssH);
      V.insets = cs ? { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) } : { l: 0, r: 0, t: 0, b: 0 };
      SS.Art.setScale(V.S);
      SS.Input.layout();
      this.ctx.imageSmoothingEnabled = true;
    },

    frame(now) {
      requestAnimationFrame((t) => this.frame(t));
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // e.g. returning from background
      if (SS.View.portrait) { this.render(); return; }
      this.monitor(dt);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= C.STEP && steps < 5) {
        SS.Input.update();
        SS.UI.update(C.STEP);
        this.acc -= C.STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.render();
    },

    render() {
      const ctx = this.ctx, V = SS.View;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0a12';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(V.S, 0, 0, V.S, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      SS.UI.render(ctx);
      SS.Art.gc();
    },

    // automatic low-quality mode if the frame rate drops
    monitor(dt) {
      if (SS.Save.data.settings.graphics !== 'auto' || this.lowMode) return;
      const p = this.perf;
      p.sum += dt; p.n++;
      if (p.sum >= 2) {
        const avg = p.sum / p.n;
        if (avg > 1 / 45) p.slow++; else p.slow = Math.max(0, p.slow - 1);
        p.sum = 0; p.n = 0;
        if (p.slow >= 2) {
          this.lowMode = true; this.quality = 0.5;
          this.resize();
        }
      }
    },
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => M.boot());
  else M.boot();
})();
