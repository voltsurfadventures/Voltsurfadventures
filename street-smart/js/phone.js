/* Phone portrait: fill the screen with the landscape game, rotated. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.Main || !SS.Input) return;
  const rot = document.getElementById('rotate');
  if (rot) rot.style.display = 'none';
  const origResize = SS.Main.resize.bind(SS.Main);
  SS.Main.resize = function () {
    origResize();
    const V = SS.View;
    const vv = window.visualViewport;
    const cssW = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const cssH = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    V.portrait = cssH > cssW * 1.05;
    document.body.classList.toggle('portrait', V.portrait);
    if (!V.portrait) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = this.canvas;
    canvas.style.width = cssH + 'px';
    canvas.style.height = cssW + 'px';
    canvas.style.position = 'fixed';
    canvas.style.left = ((cssW - cssH) / 2) + 'px';
    canvas.style.top = ((cssH - cssW) / 2) + 'px';
    canvas.style.transform = 'rotate(-90deg)';
    canvas.style.transformOrigin = 'center center';
    canvas.width = Math.round(cssH * dpr);
    canvas.height = Math.round(cssW * dpr);
    V.cssW = cssH; V.cssH = cssW;
    V.h = SS.CONFIG.VIEW_H;
    V.w = SS.CONFIG.VIEW_H * cssH / cssW;
    V.S = canvas.height / V.h;
    SS.Art.setScale(V.S);
    SS.Input.layout();
  };
  const frame = SS.Main.frame;
  SS.Main.frame = function (now) {
    if (SS.View.portrait) {
      requestAnimationFrame((t) => SS.Main.frame(t));
      let dt = (now - SS.Main.last) / 1000;
      SS.Main.last = now;
      if (dt > 0.25) dt = 0.25;
      SS.Main.monitor(dt);
      SS.Main.acc += dt;
      let steps = 0;
      while (SS.Main.acc >= SS.CONFIG.STEP && steps < 5) {
        SS.Input.update();
        SS.UI.update(SS.CONFIG.STEP);
        SS.Main.acc -= SS.CONFIG.STEP;
        steps++;
      }
      if (steps === 5) SS.Main.acc = 0;
      SS.Main.render();
      return;
    }
    return frame.call(SS.Main, now);
  };
  SS.Input.toView = function (e) {
    const r = this.canvas.getBoundingClientRect();
    const V = SS.View;
    const sx = (e.clientX - r.left) / Math.max(1, r.width);
    const sy = (e.clientY - r.top) / Math.max(1, r.height);
    if (V.portrait) return { x: sy * V.w, y: (1 - sx) * V.h };
    return { x: sx * V.w, y: sy * V.h };
  };
  SS.Main.resize();
})();
