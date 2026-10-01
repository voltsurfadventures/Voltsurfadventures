(function () {
  const SS = window.SS;
  SS.Story = {
    start(done) { this.done = done; if (done) done(); },
    next() { if (this.done) this.done(); },
    finish() { if (this.done) this.done(); },
    update() {},
    draw() {}
  };
})();
