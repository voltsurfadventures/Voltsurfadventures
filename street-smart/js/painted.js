/* Cheap style pass: dusk ink street, no generated images. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.Session) return;
  const P = SS.Session.prototype;
  const G = SS.GEOM;
  const sky = P.drawSky, shops = P.drawShops, ground = P.drawGround, wires = P.drawWires, player = P.drawPlayer;

  P.drawSky = function (ctx, vw) {
    sky.call(this, ctx, vw);
    const g = ctx.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, 'rgba(92,126,168,0.28)');
    g.addColorStop(0.55, 'rgba(242,168,104,0.34)');
    g.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, 170);
  };

  P.drawShops = function (ctx, cx, vw) {
    shops.call(this, ctx, cx, vw);
    const list = (this.W && this.W.shops) || [];
    for (const s of list) {
      if (s.x + s.w < cx - 10 || s.x > cx + vw + 10) continue;
      const x = s.x, w = s.w, y = G.FACADE_BOT;
      ctx.fillStyle = '#17867f';
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 86);
      ctx.quadraticCurveTo(x + w / 2, y - 98, x + w - 4, y - 86);
      ctx.lineTo(x + w - 2, y - 68);
      ctx.lineTo(x + 2, y - 68);
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,20,0.45)';
      ctx.lineWidth = 1.2;
      for (let i = 1; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 6 + i * ((w - 12) / 7), y - 84);
        ctx.lineTo(x + 4 + i * ((w - 12) / 7), y - 68);
        ctx.stroke();
      }
      const glow = ctx.createLinearGradient(0, y - 66, 0, y - 8);
      glow.addColorStop(0, 'rgba(255,196,110,0.42)');
      glow.addColorStop(1, 'rgba(255,150,70,0.05)');
      ctx.fillStyle = glow;
      ctx.fillRect(x + 12, y - 64, w - 24, 50);
      ctx.fillStyle = '#f6e7c4';
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.word || '', x + w / 2, y - 90);
    }
  };

  P.drawGround = function (ctx, cx, vw) {
    ground.call(this, ctx, cx, vw);
    ctx.save();
    ctx.translate(-cx, 0);
    ctx.fillStyle = 'rgba(92,64,42,0.16)';
    for (let x = Math.floor(cx / 36) * 36; x < cx + vw + 36; x += 36) {
      ctx.fillRect(x, 236, 30, 16);
      ctx.fillRect(x + 6, 456, 26, 12);
    }
    ctx.restore();
  };

  P.drawWires = function (ctx, cx, vw) {
    wires.call(this, ctx, cx, vw);
    ctx.save();
    ctx.translate(-cx, 0);
    ctx.strokeStyle = 'rgba(24,18,16,0.72)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 30, 28 + i * 7);
      ctx.bezierCurveTo(cx + vw * 0.35, 58 + i * 9, cx + vw * 0.62, 18 + i * 5, cx + vw + 30, 40 + i * 7);
      ctx.stroke();
    }
    for (let x = Math.floor(cx / 110) * 110; x < cx + vw; x += 110) {
      ctx.fillStyle = '#e24b32';
      ctx.beginPath();
      ctx.ellipse(x, 86, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a2418';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,170,70,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, 98, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  P.drawPlayer = function (ctx) {
    player.call(this, ctx);
    const p = this.player;
    if (!p) return;
    const s = SS.Art.depth(p.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale((p.face || 1) * s / 70, s / 70);
    ctx.fillStyle = '#111';
    ctx.fillRect(-18, -8, 36, 6);
    ctx.fillStyle = '#00b14f';
    ctx.fillRect(-22, -62, 18, 26);
    ctx.strokeStyle = '#08381f';
    ctx.strokeRect(-22, -62, 18, 26);
    ctx.fillStyle = '#f4f7f2';
    ctx.fillRect(-16, -54, 7, 7);
    ctx.fillStyle = '#00b14f';
    ctx.beginPath();
    ctx.arc(0, -78, 13, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(186,230,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(6, -72, 7, 3.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
})();
