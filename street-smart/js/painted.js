/* Painted dusk pass. Draws the Old Quarter look on top of the placeholder shapes. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.Session) return;
  const P = SS.Session.prototype;
  const G = SS.GEOM;
  const sky = P.drawSky;
  const shops = P.drawShops;
  const ground = P.drawGround;
  const wires = P.drawWires;
  const player = P.drawPlayer;

  P.drawSky = function (ctx, vw) {
    sky.call(this, ctx, vw);
    const g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, 'rgba(255,176,110,0.35)');
    g.addColorStop(1, 'rgba(255,210,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, 150);
  };

  P.drawShops = function (ctx, cx, vw) {
    shops.call(this, ctx, cx, vw);
    const shopsW = this.W && this.W.shops || [];
    for (const s of shopsW) {
      if (s.x + s.w < cx - 20 || s.x > cx + vw + 20) continue;
      const x = s.x, w = s.w, y = G.FACADE_BOT;
      ctx.fillStyle = '#1f8f88';
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 78);
      ctx.lineTo(x + w - 6, y - 78);
      ctx.lineTo(x + w - 2, y - 62);
      ctx.lineTo(x + 2, y - 62);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * ((w - 16) / 6), y - 76, 2, 14);
      ctx.fillStyle = 'rgba(255,186,90,0.28)';
      ctx.fillRect(x + 14, y - 58, w - 28, 42);
      ctx.fillStyle = '#f4e2b0';
      ctx.font = '700 11px Baloo 2, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.word || s.type || '', x + w / 2, y - 84);
    }
  };

  P.drawGround = function (ctx, cx, vw) {
    ground.call(this, ctx, cx, vw);
    ctx.save();
    ctx.translate(-cx, 0);
    ctx.strokeStyle = 'rgba(40,30,20,0.18)';
    ctx.lineWidth = 2;
    for (let x = Math.floor(cx / 48) * 48; x < cx + vw; x += 48) {
      ctx.strokeRect(x, 232, 44, 18);
      ctx.strokeRect(x + 8, 448, 36, 14);
    }
    ctx.restore();
  };

  P.drawWires = function (ctx, cx, vw) {
    wires.call(this, ctx, cx, vw);
    ctx.save();
    ctx.translate(-cx, 0);
    ctx.strokeStyle = 'rgba(20,16,14,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 40, 36 + i * 8);
      ctx.bezierCurveTo(cx + vw * 0.3, 54 + i * 10, cx + vw * 0.6, 24 + i * 6, cx + vw + 40, 42 + i * 8);
      ctx.stroke();
    }
    for (let x = Math.floor(cx / 90) * 90; x < cx + vw; x += 90) {
      ctx.fillStyle = '#e24b32';
      ctx.beginPath();
      ctx.ellipse(x, 78, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,180,80,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, 86, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  P.drawPlayer = function (ctx) {
    player.call(this, ctx);
    const p = this.player;
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale((p.face || 1) * 1.05, 1.05);
    ctx.fillStyle = '#00b14f';
    ctx.fillRect(-16, -78, 22, 28);
    ctx.fillStyle = '#f7f7f2';
    ctx.fillRect(-8, -70, 7, 7);
    ctx.fillStyle = '#00b14f';
    ctx.beginPath();
    ctx.arc(-2, -96, 12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,230,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(4, -90, 7, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
})();
