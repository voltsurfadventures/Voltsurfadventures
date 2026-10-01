/* Gameplay pass: confidence does not freeze you. Less traffic, louder hits, useful shops and rare drops. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.Session) return;
  const P = SS.Session.prototype;
  const density = P.density;
  const buy = P.buyFrom;
  const player = P.updatePlayer;
  const render = P.render;

  P.density = function () { return density.call(this) * 0.62; };

  P.buyFrom = function (s) {
    buy.call(this, s);
    if (s && s.type === 'fruit' && this.player) {
      this.player.boostT = Math.max(this.player.boostT, 8);
      this.coins += 6;
      this.popup('Fruit rush', this.player.x, this.player.y - 140, '#b6f37a', 1.4);
    }
  };

  P.updatePlayer = function (dt) {
    const p = this.player;
    if (p && this.W && this.W.coins && !this._rareMarked) {
      this._rareMarked = true;
      this.W.coins.forEach((c) => {
        const r = Math.random();
        if (r < 0.035) c.kind = 'shoes';
        else if (r < 0.06) c.kind = 'shield';
      });
    }
    player.call(this, dt);
    if (!p) return;
    p.hurt = Math.max(0, (p.hurt || 0) - dt);
    if (p.conf < 20 && !p.onRoad) p.conf = Math.min(40, p.conf + 18 * dt);
    if (p.shoesT > 0) { p.shoesT -= dt; p.boostT = Math.max(p.boostT, 0.2); }
    for (const s of this.scooters || []) {
      if (!p.onRoad || p.invuln > 0) continue;
      const along = (s.x - p.x) * (s.ax || 1);
      const lat = Math.abs(s.y - p.y);
      if (along > 0 && along < 70 && lat < 28) {
        p.conf = Math.max(0, p.conf - 10 * dt);
        p.hurt = Math.max(p.hurt, 0.25);
      }
    }
    for (const c of (this.W && this.W.coins) || []) {
      if (!c.kind || c.taken) continue;
      if (Math.abs(c.x - p.x) < 26 && Math.abs(c.y - p.y) < 22) {
        c.taken = true;
        if (c.kind === 'shoes') {
          p.shoesT = 10; p.boostT = 10;
          this.popup('Fast shoes', p.x, p.y - 120, '#9fe6ff', 1.5);
        } else {
          p.invuln = Math.max(p.invuln, 4);
          this.popup('Ward', p.x, p.y - 120, '#f0a33a', 1.5);
        }
      }
    }
  };

  P.render = function (ctx) {
    render.call(this, ctx);
    const p = this.player;
    if (!p || !p.hurt) return;
    const V = SS.View;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(255,40,40,' + (0.28 * Math.min(1, p.hurt)) + ')';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  };
})();
