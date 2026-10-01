(function () {
  const SS = window.SS;
  const panels = [
    'Minh takes the green helmet. The Old Quarter is already moving.',
    'Teal awnings, lanterns, and a lane of scooters. Flow, do not freeze.',
    'The box on his back is the order. Cross clean and the shift pays.'
  ];
  SS.Story = {
    i: 0,
    done: null,
    start(done) { this.i = 0; this.done = done; },
    next() { this.i++; if (this.i >= panels.length && this.done) this.done(); },
    finish() { if (this.done) this.done(); },
    update() {},
    draw(ctx, vw, vh) {
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, '#f0b07a');
      g.addColorStop(0.45, '#c9845a');
      g.addColorStop(1, '#6a5348');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = '#1f8f88';
      ctx.fillRect(40, vh * 0.42, vw - 80, 70);
      ctx.fillStyle = '#e24b32';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(80 + i * ((vw - 120) / 5), vh * 0.28, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#00b14f';
      ctx.fillRect(vw * 0.46, vh * 0.52, 36, 48);
      ctx.beginPath();
      ctx.arc(vw * 0.5, vh * 0.5, 16, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b120e';
      ctx.fillRect(48, vh - 92, vw - 96, 64);
      ctx.fillStyle = '#fff6e8';
      ctx.font = '600 16px Be Vietnam Pro, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(panels[Math.min(this.i, panels.length - 1)], vw / 2, vh - 54);
      ctx.font = '500 12px Be Vietnam Pro, sans-serif';
      ctx.fillText('Tap for the next panel', vw / 2, vh - 34);
    }
  };
})();
