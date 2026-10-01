/* Do not rotate the canvas. The phone's own landscape rotation is the layout. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.Main) return;
  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.style.transform = 'none';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
  }
  if (SS.Fullscreen) SS.Fullscreen.lockLandscape = function () {};
  SS.Main.resize = function () {
    const V = SS.View;
    const C = SS.CONFIG;
    const vv = window.visualViewport;
    const cssW = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const cssH = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    V.portrait = cssH > cssW * 1.05;
    document.body.classList.toggle('portrait', false);
    const dprCap = this.lowMode ? C.LOW_DPR : C.MAX_DPR;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.canvas.style.transform = 'none';
    this.canvas.style.left = '0px';
    this.canvas.style.top = '0px';
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    V.cssW = cssW;
    V.cssH = cssH;
    V.h = C.VIEW_H;
    V.w = C.VIEW_H * cssW / cssH;
    V.S = this.canvas.height / V.h;
    V.unitsPerCss = Math.min(Math.max(V.h / cssH, 0.75), 1.6);
    const cs = this.safe ? getComputedStyle(this.safe) : null;
    const px = (v) => (parseFloat(v) || 0) * (V.h / cssH);
    V.insets = cs ? { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) } : { l: 0, r: 0, t: 0, b: 0 };
    SS.Art.setScale(V.S);
    SS.Input.layout();
    this.ctx.imageSmoothingEnabled = true;
  };
  SS.Input.toView = function (e) {
    const r = this.canvas.getBoundingClientRect();
    const V = SS.View;
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * V.w,
      y: ((e.clientY - r.top) / Math.max(1, r.height)) * V.h
    };
  };
  SS.Main.frame = function (now) {
    requestAnimationFrame((t) => SS.Main.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.monitor(dt);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= SS.CONFIG.STEP && steps < 5) {
      SS.Input.update();
      SS.UI.update(SS.CONFIG.STEP);
      this.acc -= SS.CONFIG.STEP;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.render();
  };
  SS.Main.resize();
})();
