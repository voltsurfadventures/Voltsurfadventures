/* =====================================================================
 * Audio — everything synthesised with the plain Web Audio API.
 * ---------------------------------------------------------------------
 *  - Music: step sequencer with Karplus-Strong plucked strings (đàn
 *    tranh / đàn bầu flavour with pitch bends), bass and percussion.
 *    One track per level + jingles. Intensity & tension layers.
 *  - Ambience: engine hum, rumble, distant horns, crowd chatter.
 *  - SFX: whooshes with doppler, horns, crashes, coins, coughs...
 *  - Bánh bao call: embedded clip decoded after the first tap, played
 *    through a megaphone chain and panned/attenuated by position.
 *    Falls back to a synthesised chant if decoding fails.
 * Audio only starts after the first user gesture (SS.Audio.unlock()).
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------- Music data ----------------
   * Each track loops 8 bars of 16 steps over a 4-chord progression.
   * mel: a..o = pentatonic scale degree (wraps octaves); A..O = same with a
   *      đàn bầu slide up into the note; '.' = rest.
   * chords: semitones above root-12 for the warm pad (one chord per bar).
   * roots: bass root per bar (semitones from bassRoot); bassPat: bass rhythm.
   * drums: k = kick, r = rim, s = shaker, w = mõ (wood block); x = hit, o = soft. */
  const TRACKS = {
    morning: { // D major, easy lo-fi stroll
      bpm: 84, root: 62, bassRoot: 38, scale: [0, 2, 4, 7, 9], swing: 0.12, pluckVel: 0.36,
      chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], roots: [0, -3, -7, -5],
      bassPat: 'x.....x...x...o.',
      mel: ['c...d...f.....e.', 'd.......c...b...', 'b...d...e...d.b.', 'D...........a...',
            'c...d...f...h...', 'g.....f.e...d...', 'e...d...b...d...', 'A.......b...a...'],
      drums: { k: 'x.......x.....x.', r: '....x.......x...', s: '..o...o...o...o.', w: 'x...............' },
    },
    market: { // G major, busier market bounce
      bpm: 98, root: 67, bassRoot: 43, scale: [0, 2, 4, 7, 9], swing: 0.14, pluckVel: 0.34,
      chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], roots: [0, -3, -7, -5],
      bassPat: 'x.....x.x...x...',
      mel: ['f.g.h...g.f.d...', 'e...d.....b.d...', 'b.d.e.d.b...a...', 'D.......d.e.f...',
            'f.g.h...i.h.g...', 'f...e.d...b.d...', 'e.d.b...a...b.d.', 'A.......a.......'],
      drums: { k: 'x.....x...x.....', r: '....x.......x...', s: 'o.o.o.o.o.o.o.o.', w: '..x.....x..x....' },
    },
    night: { // A minor, neon chill
      bpm: 90, root: 69, bassRoot: 33, scale: [0, 3, 5, 7, 10], swing: 0.1, pluckVel: 0.33,
      chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]], roots: [0, -4, 3, -2],
      bassPat: 'x.......x.x.....',
      mel: ['d...c...a...c.d.', 'c.......a.......', 'e...d...c...a...', 'D...............',
            'd...e...f...e.d.', 'c.......a...c...', 'b...a...b...c...', 'A...............'],
      drums: { k: 'x.......x.x.....', r: '....x.......x...', s: 'o.o.o.o.o.o.o.o.', w: '...............x' },
    },
  };

  // Jingles: [beat offset, degree char] on a given scale
  const JINGLES = {
    title:    { bpm: 120, root: 62, scale: [0, 2, 4, 7, 9], notes: [[0, 'a'], [0.5, 'c'], [1, 'd'], [1.5, 'f'], [2.5, 'g'], [3, 'F'], [3, 'a']] },
    complete: { bpm: 132, root: 62, scale: [0, 2, 4, 7, 9], notes: [[0, 'a'], [0.25, 'c'], [0.5, 'd'], [0.75, 'f'], [1, 'h'], [1.25, 'i'], [2, 'K'], [2, 'f'], [2, 'i'], [2, 'd']] },
    gameover: { bpm: 90,  root: 57, scale: [0, 3, 5, 7, 10], notes: [[0, 'f'], [0.5, 'd'], [1, 'c'], [1.5, 'b'], [2.5, 'A'], [2.5, 'f']] },
    star:     { bpm: 200, root: 74, scale: [0, 2, 4, 7, 9], notes: [[0, 'a'], [0.5, 'c'], [1, 'f']] },
  };

  const A = (SS.Audio = {
    ctx: null,
    unlocked: false,
    hasPanner: false,
    vol: { music: 0.7, sfx: 0.9 },
    pluckCache: {},
    lastSfx: {},
    // music state
    track: null, trackId: null, step: 0, nextTime: 0, timer: null,
    intensity: 0, tension: 0,
    // bánh bao
    bbBuffer: null, bbFailed: false, bbSrc: null, bbActive: false, bbChantTimer: 0,

    /* ---------- set-up ---------- */
    running() { return !!(this.ctx && this.ctx.state === 'running'); },
    unlock() {
      if (this.unlocked) {
        if (this.ctx && this.ctx.state !== 'running' && !this.bgSuspended) {
          this.ctx.resume();
          // iOS: a silent buffer inside the gesture completes the unlock
          try { const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0); } catch (e) { /* ignore */ }
        }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { this.ctx = new AC(); } catch (e2) { return; } }
      const c = this.ctx;
      this.unlocked = true;
      // iOS: play a silent buffer inside the gesture to fully unlock
      try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) { /* ignore */ }
      if (c.state === 'suspended') c.resume();
      this.hasPanner = typeof c.createStereoPanner === 'function';

      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(this.comp);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.musicDuck = c.createGain(); this.musicDuck.connect(this.musicBus);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      // a little room reverb (generated impulse response) glues the music together
      this.reverb = c.createConvolver();
      const irLen = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, irLen, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
      this.reverb.buffer = ir;
      const rvOut = c.createGain(); rvOut.gain.value = 0.32; this.reverb.connect(rvOut); rvOut.connect(this.musicBus);
      this.musicSend = c.createGain(); this.musicSend.gain.value = 0.35; this.musicDuck.connect(this.musicSend); this.musicSend.connect(this.reverb);
      this.ambBus = c.createGain(); this.ambBus.gain.value = 0; this.ambBus.connect(this.sfxBus);

      // shared noise buffers
      const sr = c.sampleRate;
      this.noise = c.createBuffer(1, sr * 2, sr);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.brown = c.createBuffer(1, sr * 3, sr);
      const bd = this.brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }

      this.applyVolumes();
      this.loadSamples();
      this.buildBanhBaoChain();
      this.decodeBanhBao();
      this.startAmbience();
      if (this.pendingMusic) { const p = this.pendingMusic; this.pendingMusic = null; this.playMusic(p); }
    },

    /* ---------- optional recorded sounds ----------
     * Drop MP3s into assets/audio/ with these names and they replace the
     * synthesised versions automatically (see README). Missing files are fine. */
    SAMPLES: ['horn_1', 'horn_2', 'horn_3', 'horn_4', 'horn_5', 'horn_6', 'car_horn_1', 'car_horn_2', 'car_horn_3',
      'music_main', 'music_menu', 'music_morning', 'music_market', 'music_night', 'street_ambience', 'rain'],
    samples: {},
    loadSamples() {
      if (!window.fetch || location.protocol === 'file:') return;
      for (const name of this.SAMPLES) {
        fetch('assets/audio/' + name + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => {
          if (!ab) return;
          const ok = (buf) => { this.samples[name] = buf; this.onSample(name); };
          const pr = this.ctx.decodeAudioData(ab, ok, () => {});
          if (pr && pr.catch) pr.catch(() => {});
        }).catch(() => {});
      }
    },
    onSample(name) {
      if (this.wantMusic && (name === 'music_' + this.wantMusic || (name === 'music_main' && !this.musicSrc))) { const w = this.wantMusic; this.trackId = null; this.playMusic(w); }
      if (name === 'street_ambience' && !this.ambSrc) this.startLoop('street_ambience', this.ambBus, 0.55, (s) => { this.ambSrc = s; });
      if (name === 'rain' && this.rainGain) { this.startLoop('rain', this.rainGain, 2.5, () => {}); if (this.rainNoise) { try { this.rainNoise.stop(); } catch (e) { /* */ } } }
    },
    startLoop(name, dest, gain, cb) {
      const s = this.ctx.createBufferSource(); s.buffer = this.samples[name]; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(dest); s.start(); cb(s);
      return s;
    },
    hornSamples(car) {
      const list = [];
      for (let i = 1; i <= 6; i++) { const b = this.samples[(car ? 'car_horn_' : 'horn_') + i]; if (b) list.push(b); }
      return list;
    },

    setVolumes(music, sfx) { this.vol.music = music; this.vol.sfx = sfx; this.applyVolumes(); },
    applyVolumes() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    },

    // auto-mute when the app goes to the background
    suspend() { this.bgSuspended = true; if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
    resume() { this.bgSuspended = false; if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); },

    now() { return this.ctx ? this.ctx.currentTime : 0; },

    // create a stereo panner (or a passthrough on old browsers)
    panNode(p) {
      const c = this.ctx;
      if (this.hasPanner) { const n = c.createStereoPanner(); n.pan.value = U.clamp(p || 0, -1, 1); return n; }
      return c.createGain();
    },

    noiseSrc(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf || this.noise; s.loop = true; s.loopStart = Math.random(); return s; },

    env(g, t, a, peak, d, sus, r, len) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setTargetAtTime(peak * sus, t + a, d);
      g.gain.setTargetAtTime(0.0001, t + len, r);
    },

    /* ---------- Karplus-Strong plucked string ---------- */
    pluckBuffer(midi) {
      if (this.pluckCache[midi]) return this.pluckCache[midi];
      const c = this.ctx, sr = c.sampleRate, f = mtof(midi);
      const len = Math.floor(sr * 1.5);
      const buf = c.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / f));
      const ring = new Float32Array(N);
      let lp = 0;
      for (let i = 0; i < N; i++) { lp = lp * 0.35 + (Math.random() * 2 - 1) * 0.65; ring[i] = lp; }
      const rho = Math.pow(10, -3 / (1.25 * f)); // ~1.25 s decay
      let idx = 0, peak = 0;
      for (let i = 0; i < len; i++) {
        const cur = ring[idx], nxt = ring[idx + 1 === N ? 0 : idx + 1];
        ring[idx] = (cur * 0.5 + nxt * 0.5) * rho;
        d[i] = cur;
        if (Math.abs(cur) > peak) peak = Math.abs(cur);
        idx = idx + 1 === N ? 0 : idx + 1;
      }
      const norm = peak > 0 ? 0.8 / peak : 1;
      const fade = Math.floor(sr * 0.05);
      for (let i = 0; i < len; i++) { d[i] *= norm; if (i > len - fade) d[i] *= (len - i) / fade; }
      this.pluckCache[midi] = buf;
      return buf;
    },

    pluck(midi, t, vel, pan, bend, dest) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.pluckBuffer(midi);
      if (bend) { // đàn bầu style slide up into the note, then gentle vibrato
        src.playbackRate.setValueAtTime(Math.pow(2, -2 / 12), t);
        src.playbackRate.linearRampToValueAtTime(1, t + 0.16);
        src.playbackRate.linearRampToValueAtTime(1.012, t + 0.32);
        src.playbackRate.linearRampToValueAtTime(0.992, t + 0.48);
        src.playbackRate.linearRampToValueAtTime(1.0, t + 0.64);
      }
      const g = c.createGain(); g.gain.value = vel;
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200; tone.Q.value = 0.8;
      const p = this.panNode(pan || 0);
      src.connect(tone); tone.connect(g); g.connect(p); p.connect(dest || this.musicDuck);
      src.start(t); src.stop(t + 1.5);
    },

    degMidi(root, scale, d) { return root + scale[d % 5] + 12 * Math.floor(d / 5); },

    /* ---------- drums & bass ---------- */
    kick(t, v) { // soft round lo-fi kick
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); g.connect(this.musicDuck); o.start(t); o.stop(t + 0.36);
    },
    rim(t, v) { // dry rim click
      const c = this.ctx, n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 2.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      n.connect(f); f.connect(g); g.connect(this.musicDuck); n.start(t); n.stop(t + 0.08);
      const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 820;
      og.gain.setValueAtTime(0.08 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(og); og.connect(this.musicDuck); o.start(t); o.stop(t + 0.04);
    },
    shaker(t, v) {
      const c = this.ctx, n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(f); f.connect(g); g.connect(this.musicDuck); n.start(t); n.stop(t + 0.09);
    },
    woodblock(t, v, hi) { // mõ — Vietnamese wooden temple block
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sine'; o.frequency.setValueAtTime(hi ? 1250 : 880, t); o.frequency.exponentialRampToValueAtTime(hi ? 1150 : 820, t + 0.05);
      f.type = 'bandpass'; f.frequency.value = hi ? 1250 : 880; f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(f); f.connect(g); g.connect(this.musicDuck); o.start(t); o.stop(t + 0.1);
    },
    bass(t, midi, len) { // warm round bass
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = mtof(midi);
      o2.type = 'triangle'; o2.frequency.value = mtof(midi) * 2; const g2 = c.createGain(); g2.gain.value = 0.15;
      f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42, t + 0.012);
      g.gain.setTargetAtTime(0.25, t + 0.04, 0.12); g.gain.setTargetAtTime(0.0001, t + len, 0.05);
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.musicDuck);
      o.start(t); o2.start(t); o.stop(t + len + 0.4); o2.stop(t + len + 0.4);
    },
    chord(t, notes, len) { // soft electric-piano-ish pad, one chord per bar
      const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(700, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03);
      g.gain.setTargetAtTime(0.028, t + 0.08, 0.4); g.gain.setTargetAtTime(0.0001, t + len - 0.05, 0.12);
      f.connect(g); g.connect(this.musicDuck);
      for (const m of notes) {
        for (const det of [-6, 6]) {
          const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
          o.connect(f); o.start(t); o.stop(t + len + 0.6);
        }
      }
    },

    /* ---------- music sequencer ---------- */
    playMusic(id) {
      this.wantMusic = id;
      if (!this.ctx) { this.pendingMusic = id; return; }
      if (this.trackId === id && (this.timer || this.musicSrc)) return;
      this.stopMusic();
      this.trackId = id;
      const t0 = this.ctx.currentTime;
      this.musicDuck.gain.cancelScheduledValues(t0);
      this.musicDuck.gain.setValueAtTime(0.0001, t0);
      this.musicDuck.gain.linearRampToValueAtTime(1, t0 + 0.8);
      // a level's own track if there is one, otherwise the main track (music_main.mp3) everywhere
      const file = this.samples['music_' + id] || this.samples.music_main;
      if (file) { // a real recorded track
        const s = this.ctx.createBufferSource(); s.buffer = file; s.loop = true;
        s.connect(this.musicDuck); s.start(); this.musicSrc = s;
        return;
      }
      if (!SS.Save.data.settings.synthMusic) return; // built-in music is off by default
      const tr = TRACKS[id] || TRACKS.morning;
      this.track = tr; this.step = 0;
      this.nextTime = t0 + 0.08;
      this.startPad(tr);
      this.timer = setInterval(() => this.schedule(), 25);
    },
    stopMusic(fade) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null; this.trackId = null;
      if (this.musicSrc) { try { this.musicSrc.stop(); } catch (e) { /* */ } this.musicSrc = null; }
      this.stopPad();
    },
    schedule() {
      const c = this.ctx; if (!c || !this.track) return;
      const tr = this.track, stepDur = 60 / tr.bpm / 4;
      while (this.nextTime < c.currentTime + 0.14) {
        let t = this.nextTime;
        if (this.step % 2 === 1) t += tr.swing * stepDur;
        if (c.state === 'running') this.playStep(tr, this.step, t, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    },
    playStep(tr, step, t, sd) {
      const s16 = step % 16, bar = Math.floor(step / 16), cb = bar % 4;
      const I = this.intensity;
      if (s16 === 0) this.chord(t, tr.chords[cb].map((x) => tr.root - 12 + x), sd * 16);
      // melody (đàn tranh pluck)
      const ch = tr.mel[bar % tr.mel.length][s16];
      if (ch && ch !== '.') {
        const up = ch >= 'A' && ch <= 'O';
        const d = (up ? ch.charCodeAt(0) - 65 : ch.charCodeAt(0) - 97);
        this.pluck(this.degMidi(tr.root, tr.scale, d), t, tr.pluckVel, (s16 % 8 < 4) ? -0.2 : 0.2, up);
      }
      // bass
      const bp = tr.bassPat[s16];
      if (bp !== '.') this.bass(t, tr.bassRoot + tr.roots[cb] + (bp === 'o' ? 12 : 0), sd * 2.6);
      // drums (last bar of 8 gets a small fill)
      const D = tr.drums, fill = bar % 8 === 7 && s16 >= 12;
      const hit = (str) => str[s16] === 'x' ? 1 : str[s16] === 'o' ? 0.55 : 0;
      let v;
      if ((v = hit(D.k))) this.kick(t, v);
      if ((v = fill && s16 % 2 === 0 ? 0.7 : hit(D.r))) this.rim(t, v);
      if ((v = hit(D.s))) this.shaker(t, v * (0.7 + I * 0.5));
      if ((v = hit(D.w))) this.woodblock(t, v, s16 % 8 === 6);
      // intersections: extra shaker + soft plucked arpeggio
      if (I > 0.35) {
        if (!hit(D.s) && s16 % 2 === 1) this.shaker(t, 0.6 * I);
        if (s16 % 4 === 2) {
          const chord = tr.chords[cb];
          this.pluck(tr.root + chord[(s16 / 4 | 0) % chord.length], t, 0.13 * I, 0.45, false);
        }
        if (I > 0.7 && s16 % 8 === 4) this.kick(t, 0.35);
      }
    },
    setIntensity(x) { this.intensity = U.clamp(x, 0, 1); },

    // low-confidence tension pad: detuned saws through a wobbling filter
    startPad(tr) {
      const c = this.ctx;
      this.padGain = c.createGain(); this.padGain.gain.value = 0.0001;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4; lg.gain.value = 200;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      this.padOsc = [lfo];
      for (const iv of tr.chords[0].slice(0, 3)) {
        for (const det of [-9, 9]) {
          const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(tr.root - 24 + iv + 1); o.detune.value = det;
          o.connect(f); o.start(); this.padOsc.push(o);
        }
      }
      f.connect(this.padGain); this.padGain.connect(this.musicDuck);
    },
    stopPad() {
      if (!this.padOsc) return;
      const t = this.ctx.currentTime;
      try { this.padGain.gain.setTargetAtTime(0.0001, t, 0.1); } catch (e) { /* */ }
      for (const o of this.padOsc) { try { o.stop(t + 0.5); } catch (e) { /* */ } }
      this.padOsc = null;
    },
    setTension(x) {
      this.tension = U.clamp(x, 0, 1);
      if (this.padGain) this.padGain.gain.setTargetAtTime(0.0001 + this.tension * 0.09, this.ctx.currentTime, 0.25);
    },
    duckMusic(level) { if (this.ctx) this.musicDuck.gain.setTargetAtTime(level, this.ctx.currentTime, 0.15); },

    playJingle(id) {
      if (!this.ctx) return;
      const j = JINGLES[id]; if (!j) return;
      const t0 = this.ctx.currentTime + 0.05, beat = 60 / j.bpm;
      for (const [b, ch] of j.notes) {
        const up = ch >= 'A' && ch <= 'O';
        const d = up ? ch.charCodeAt(0) - 65 : ch.charCodeAt(0) - 97;
        this.pluck(this.degMidi(j.root, j.scale, d), t0 + b * beat, 0.45, (Math.random() - 0.5) * 0.5, up, this.sfxBus);
      }
      if (id === 'complete') { this.woodblock(t0, 0.8, false); this.woodblock(t0 + beat * 2, 1, true); }
    },

    /* ---------- ambience ---------- */
    startAmbience() {
      const c = this.ctx;
      // engine hum: detuned low saws through a lowpass that wanders
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 2;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 110;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      this.humGain = c.createGain(); this.humGain.gain.value = 0.0001;
      for (const fr of [52, 57.5, 69, 83]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
        const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 0.7 + Math.random(); vg.gain.value = 3;
        vib.connect(vg); vg.connect(o.frequency); vib.start();
        o.connect(f); o.start();
      }
      f.connect(this.humGain); this.humGain.connect(this.ambBus);
      // traffic rumble (brown noise)
      const r = this.noiseSrc(this.brown), rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 520;
      this.rumbleGain = c.createGain(); this.rumbleGain.gain.value = 0.0001;
      r.connect(rf); rf.connect(this.rumbleGain); this.rumbleGain.connect(this.ambBus); r.start();
      this.hornTimer = 1; this.chatTimer = 0.3;
      // rain: hissing filtered noise, faded in by setRain()
      const rn = this.noiseSrc(), rhp = c.createBiquadFilter(), rlp = c.createBiquadFilter();
      rhp.type = 'highpass'; rhp.frequency.value = 900; rlp.type = 'lowpass'; rlp.frequency.value = 7000;
      this.rainGain = c.createGain(); this.rainGain.gain.value = 0.0001;
      rn.connect(rhp); rhp.connect(rlp); rlp.connect(this.rainGain); this.rainGain.connect(this.sfxBus); rn.start(); this.rainNoise = rn;
      // four positional engine voices, assigned each frame to the nearest bikes (see Session.audioTick)
      this.engines = [];
      for (let i = 0; i < 4; i++) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 1.5;
        const am = c.createGain(); am.gain.value = 0.55;
        const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24; const lg = c.createGain(); lg.gain.value = 0.4;
        lfo.connect(lg); lg.connect(am.gain);
        const v = c.createGain(); v.gain.value = 0.0001;
        const pn = this.panNode(0);
        o.connect(lp); lp.connect(am); am.connect(v); v.connect(pn); pn.connect(this.ambBus);
        o.start(); lfo.start();
        this.engines.push({ o, lfo, v, pn, lp });
      }
    },
    setRain(k) {
      if (!this.rainGain) return;
      this.rainGain.gain.setTargetAtTime(Math.max(0.0001, k * 0.22), this.ctx.currentTime, 0.4);
    },
    setEngine(i, freq, vol, pan) {
      const e = this.engines && this.engines[i]; if (!e) return;
      const t = this.ctx.currentTime;
      e.o.frequency.setTargetAtTime(freq, t, 0.06);
      e.lfo.frequency.setTargetAtTime(freq / 2.9, t, 0.06);
      e.lp.frequency.setTargetAtTime(400 + freq * 4, t, 0.1);
      e.v.gain.setTargetAtTime(Math.max(0.0001, vol), t, 0.08);
      if (this.hasPanner) e.pn.pan.setTargetAtTime(U.clamp(pan, -1, 1), t, 0.06);
    },
    // density: 0..1.5 ; on: whether ambience should play (in-game)
    setAmbience(density, on) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.ambDensity = density; this.ambOn = on;
      this.ambBus.gain.setTargetAtTime(on ? 1 : 0, t, 0.4);
      this.humGain.gain.setTargetAtTime(0.03 + density * 0.05, t, 0.5);
      this.rumbleGain.gain.setTargetAtTime(0.1 + density * 0.16, t, 0.5);
    },
    update(dt) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (this.ambOn) {
        const d = this.ambDensity || 0.5;
        this.hornTimer -= dt;
        if (this.hornTimer <= 0) {
          this.hornTimer = U.rand(0.6, 2.6) / (0.4 + d);
          this.horn(U.rand(-1, 1), U.randi(0, 5), 0.15 + Math.random() * 0.15);
        }
        this.chatTimer -= dt;
        if (this.chatTimer <= 0) { this.chatTimer = U.rand(0.25, 0.7); this.chatter(0.25 + d * 0.15); }
      }
      if (this.bbActive && !this.bbBuffer) this.updateChant(dt);
    },
    chatter(level) {
      const c = this.ctx, t = c.currentTime;
      const n = this.noiseSrc(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = U.rand(350, 900); f.Q.value = 7;
      f2.type = 'bandpass'; f2.frequency.value = U.rand(1100, 2400); f2.Q.value = 9;
      const len = U.rand(0.07, 0.2), pk = 0.05 * level;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
      const p = this.panNode(U.rand(-0.9, 0.9));
      n.connect(f); n.connect(f2); f.connect(g); f2.connect(g); g.connect(p); p.connect(this.ambBus);
      n.start(t); n.stop(t + len + 0.05);
    },

    /* ---------- SFX ---------- */
    rate(name, minGap) {
      const t = performance.now();
      if (this.lastSfx[name] && t - this.lastSfx[name] < minGap) return false;
      this.lastSfx[name] = t; return true;
    },
    out(pan) { const p = this.panNode(pan || 0); p.connect(this.sfxBus); return p; },

    sfx(name, o) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      o = o || {};
      const fn = this['sfx_' + name];
      if (fn) fn.call(this, this.ctx.currentTime + 0.005, o);
    },

    sfx_click(t) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g); g.connect(this.out()); o.start(t); o.stop(t + 0.07);
    },
    sfx_coin(t, o) {
      if (!this.rate('coin', 40)) return;
      const out = this.out(o.pan);
      [[1568, 0], [2093, 0.06]].forEach(([f, dt]) => {
        const os = this.ctx.createOscillator(), g = this.ctx.createGain();
        os.type = 'square'; os.frequency.value = f;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.09, t + dt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
        os.connect(lp); lp.connect(g); g.connect(out); os.start(t + dt); os.stop(t + dt + 0.2);
      });
    },
    // scooter whoosh with doppler pitch drop and pan sweep
    sfx_whoosh(t, o) {
      if (!this.rate('whoosh', 70)) return;
      const c = this.ctx, dir = o.dir || 1, v = o.vol || 1, len = 0.55;
      const p = this.panNode(-0.8 * dir);
      if (this.hasPanner) p.pan.linearRampToValueAtTime(0.8 * dir, t + len);
      p.connect(this.sfxBus);
      const n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * v, t + len * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      n.connect(f); f.connect(g); g.connect(p); n.start(t); n.stop(t + len + 0.05);
      const e = c.createOscillator(), ef = c.createBiquadFilter(), eg = c.createGain();
      e.type = 'sawtooth'; const base = U.rand(95, 140);
      e.frequency.setValueAtTime(base * 1.35, t); e.frequency.linearRampToValueAtTime(base * 1.25, t + len * 0.35);
      e.frequency.exponentialRampToValueAtTime(base * 0.8, t + len * 0.55);
      ef.type = 'lowpass'; ef.frequency.value = 900;
      eg.gain.setValueAtTime(0.0001, t); eg.gain.linearRampToValueAtTime(0.13 * v, t + len * 0.35); eg.gain.exponentialRampToValueAtTime(0.0001, t + len);
      e.connect(ef); ef.connect(eg); eg.connect(p); e.start(t); e.stop(t + len + 0.05);
    },
    // Scooter horns are cheap electric buzzers ("meep"); car horns are lower two-tone blasts.
    horn(pan, type, vol, t, car) {
      const c = this.ctx; t = t || c.currentTime + 0.005;
      const smp = this.hornSamples(car);
      if (smp.length) {
        const s = c.createBufferSource(); s.buffer = smp[type % smp.length];
        s.playbackRate.value = U.rand(0.94, 1.08);
        const g = c.createGain(); g.gain.value = (car ? 0.4 : 0.32) * vol;
        const p = this.panNode(pan); s.connect(g); g.connect(p); p.connect(this.sfxBus); s.start(t);
        return;
      }
      // Electric disc horn model: a nasal buzz (strong 3rd-7th harmonics), hard-clipped,
      // shaped by two resonances, with a tiny pitch sag at the end of each beep.
      if (!this.hornWave) {
        const n = 24, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++) im[k] = (k === 1 ? 0.35 : k <= 7 ? 1.0 / Math.sqrt(k) : 0.9 / k) * (k % 2 ? 1 : 0.7);
        this.hornWave = c.createPeriodicWave(re, im);
        const cv = new Float32Array(512);
        for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; cv[i] = Math.max(-0.6, Math.min(0.6, x * 1.8)); }
        this.hornClip = cv;
      }
      const f = car ? [330, 370, 310][type % 3] : [420, 455, 480, 510, 440, 465][type % 6];
      const patterns = [[[0, 0.11]], [[0, 0.08], [0.13, 0.08]], [[0, 0.3]], [[0, 0.06], [0.1, 0.06], [0.2, 0.1]], [[0, 0.15]], [[0, 0.07], [0.11, 0.2]]];
      const pat = patterns[(type * 7 + (car ? 2 : 0)) % patterns.length];
      const end = t + pat[pat.length - 1][0] + pat[pat.length - 1][1] + 0.08;
      const ws = c.createWaveShaper(); ws.curve = this.hornClip;
      const f1 = c.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = car ? 900 : 2000; f1.Q.value = 3; f1.gain.value = 9;
      const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = car ? 1600 : 3100; f2.Q.value = 4; f2.gain.value = 7;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = car ? 200 : 320;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const g = c.createGain(); g.gain.value = 0.0001;
      const p = this.panNode(pan);
      ws.connect(f1); f1.connect(f2); f2.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p); p.connect(this.sfxBus);
      const freqs = car ? [f, f * 1.26] : [f, f * 1.006];
      for (const fr of freqs) {
        const o = c.createOscillator(); o.setPeriodicWave(this.hornWave); o.frequency.setValueAtTime(fr, t);
        for (const [st, d] of pat) { o.frequency.setValueAtTime(fr, t + st); o.frequency.linearRampToValueAtTime(fr * 0.97, t + st + d); }
        const og = c.createGain(); og.gain.value = 0.7; o.connect(og); og.connect(ws); o.start(t); o.stop(end);
      }
      const pk = (car ? 0.12 : 0.1) * vol;
      for (const [st, d] of pat) { g.gain.setValueAtTime(0.0001, t + st); g.gain.linearRampToValueAtTime(pk, t + st + 0.006); g.gain.setValueAtTime(pk * 0.9, t + st + d); g.gain.linearRampToValueAtTime(0.0001, t + st + d + 0.02); }
    },
    sfx_horn(t, o) { if (this.rate('horn', 60)) this.horn(o.pan || 0, o.type != null ? o.type : U.randi(0, 5), o.vol || 1, t, o.car); },
    sfx_crash(t, o) {
      const c = this.ctx, out = this.out(o.pan);
      const n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.5);
      g.gain.setValueAtTime(0.5 * (o.vol || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.65);
      for (let i = 0; i < 5; i++) {
        const os = c.createOscillator(), og = c.createGain(), tt = t + Math.random() * 0.25;
        os.type = 'triangle'; os.frequency.value = U.rand(300, 1700);
        og.gain.setValueAtTime(0.12, tt); og.gain.exponentialRampToValueAtTime(0.0001, tt + U.rand(0.1, 0.35));
        os.connect(og); og.connect(out); os.start(tt); os.stop(tt + 0.4);
      }
      this.sfx_thud(t, { vol: 1 });
    },
    sfx_thud(t, o) {
      const c = this.ctx, os = c.createOscillator(), g = c.createGain();
      os.frequency.setValueAtTime(120, t); os.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.6 * (o.vol || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      os.connect(g); g.connect(this.out(o.pan)); os.start(t); os.stop(t + 0.25);
    },
    sfx_bump(t, o) { if (this.rate('bump', 200)) this.sfx_thud(t, { vol: 0.5, pan: o.pan }); },
    sfx_tumble(t) { // comic slide whistle down + thud
      const c = this.ctx, os = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(1200, t); os.frequency.exponentialRampToValueAtTime(220, t + 0.55);
      vib.frequency.value = 18; vg.gain.value = 30; vib.connect(vg); vg.connect(os.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.03); g.gain.setValueAtTime(0.2, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      os.connect(g); g.connect(this.out()); os.start(t); vib.start(t); os.stop(t + 0.62); vib.stop(t + 0.62);
      this.sfx_thud(t + 0.6, { vol: 0.8 });
    },
    sfx_gas(t, o) {
      if (!this.rate('gas', 300)) return;
      const c = this.ctx, n = this.noiseSrc(this.brown), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(250, t); f.frequency.linearRampToValueAtTime(1300, t + 0.25); f.frequency.exponentialRampToValueAtTime(300, t + 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4 * (o.vol || 1), t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      n.connect(f); f.connect(g); g.connect(this.out(o.pan)); n.start(t); n.stop(t + 1.05);
    },
    // police whistle: two sharp trilled blasts
    sfx_whistle(t, o) {
      const c = this.ctx, out = this.out(o.pan), v = o.vol == null ? 1 : o.vol;
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.32, len = i ? 0.38 : 0.22;
        const osc = c.createOscillator(), trill = c.createOscillator(), tg = c.createGain(), g = c.createGain();
        osc.type = 'sine'; osc.frequency.value = 2900;
        trill.type = 'square'; trill.frequency.value = 38; tg.gain.value = 140;
        trill.connect(tg); tg.connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.22 * v, tt + 0.02); g.gain.setValueAtTime(0.22 * v, tt + len - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
        osc.connect(g); g.connect(out); osc.start(tt); trill.start(tt); osc.stop(tt + len + 0.02); trill.stop(tt + len + 0.02);
      }
    },
    // a real-sounding "cough-cough": a burst of breath noise through throat formants
    // plus a short voiced rasp, twice
    sfx_cough(t) {
      const c = this.ctx, out = this.out();
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.26, len = i ? 0.2 : 0.24;
        const bus = c.createGain(); bus.gain.value = 1.15; bus.connect(out);
        // breath burst through two formants
        const n = this.noiseSrc(), g = c.createGain();
        for (const [fq, q, gain] of [[520, 2.2, 1.0], [1450, 3, 0.7], [2600, 4, 0.35]]) {
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq * (1 - i * 0.06); f.Q.value = q;
          const fg = c.createGain(); fg.gain.value = gain; n.connect(f); f.connect(fg); fg.connect(g);
        }
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(1.4, tt + 0.012);
        g.gain.exponentialRampToValueAtTime(0.25, tt + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
        g.connect(bus); n.start(tt); n.stop(tt + len + 0.05);
        // voiced rasp (the "hck" of the throat)
        const o = c.createOscillator(), og = c.createGain(), lp = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(190 - i * 15, tt); o.frequency.exponentialRampToValueAtTime(110, tt + len);
        lp.type = 'lowpass'; lp.frequency.value = 1200;
        og.gain.setValueAtTime(0.0001, tt); og.gain.linearRampToValueAtTime(0.35, tt + 0.015); og.gain.exponentialRampToValueAtTime(0.0001, tt + len * 0.8);
        o.connect(lp); lp.connect(og); og.connect(bus); o.start(tt); o.stop(tt + len);
      }
    },
    sfx_gasp(t) {
      const c = this.ctx, n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1800, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      n.connect(f); f.connect(g); g.connect(this.out()); n.start(t); n.stop(t + 0.4);
    },
    sfx_slosh(t, o) {
      if (!this.rate('slosh', 260)) return;
      const c = this.ctx, kind = o.kind || 'pho', out = this.out();
      if (kind === 'eggs') { // little cracks
        for (let i = 0; i < 3; i++) {
          const tt = t + i * 0.045, n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'highpass'; f.frequency.value = 2500;
          g.gain.setValueAtTime(0.25 * (o.vol || 1), tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
          n.connect(f); f.connect(g); g.connect(out); n.start(tt); n.stop(tt + 0.04);
        }
        return;
      }
      const n = this.noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.Q.value = 8;
      f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 0.1); f.frequency.linearRampToValueAtTime(350, t + 0.22); f.frequency.linearRampToValueAtTime(700, t + 0.32);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * (o.vol || 1), t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.42);
    },
    // cheerful synthetic "voice" blips for seller calls (the words appear in speech bubbles)
    sfx_seller(t, o) {
      if (!this.rate('seller', 500)) return;
      const c = this.ctx, out = this.out(o.pan), base = o.pitch || 220;
      const syl = o.syllables || [1, 1.2, 1, 1.2];
      syl.forEach((m, i) => {
        const tt = t + i * 0.15, os = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
        os.type = 'sawtooth'; os.frequency.setValueAtTime(base * m, tt); os.frequency.linearRampToValueAtTime(base * m * 0.94, tt + 0.12);
        f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1300 + i * 150; f2.Q.value = 6;
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.22, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.13);
        os.connect(f1); os.connect(f2); f1.connect(g); f2.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.15);
      });
    },
    sfx_nothanks(t) {
      const c = this.ctx, os = c.createOscillator(), g = c.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(520, t); os.frequency.setValueAtTime(390, t + 0.07);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      os.connect(g); g.connect(this.out()); os.start(t); os.stop(t + 0.16);
    },
    sfx_buy(t) { // ka-ching
      const c = this.ctx, out = this.out();
      [1760, 2637, 3520].forEach((f, i) => {
        const os = c.createOscillator(), g = c.createGain(), tt = t + i * 0.05;
        os.type = 'sine'; os.frequency.value = f;
        g.gain.setValueAtTime(0.16, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
        os.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.42);
      });
    },
    sfx_powerup(t) {
      const c = this.ctx, out = this.out();
      [0, 4, 7, 12, 16].forEach((s, i) => {
        const os = c.createOscillator(), g = c.createGain(), tt = t + i * 0.06;
        os.type = 'triangle'; os.frequency.value = mtof(72 + s);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.16, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3);
        os.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.32);
      });
    },
    sfx_pickup(t) { // bright two-note "order up" ding
      const c = this.ctx, out = this.out();
      [[1047, 0], [1568, 0.09]].forEach(([f, d]) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.22, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
        o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.55);
      });
    },
    sfx_freeze(t) {
      const c = this.ctx, out = this.out();
      for (let i = 0; i < 8; i++) {
        const os = c.createOscillator(), g = c.createGain(), tt = t + i * 0.04;
        os.type = 'sine'; os.frequency.value = mtof(96 - i * 3);
        g.gain.setValueAtTime(0.08, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.35);
        os.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.36);
      }
    },
    sfx_glitch(t) {
      if (!this.rate('glitch', 150)) return;
      const c = this.ctx, out = this.out();
      for (let i = 0; i < 4; i++) {
        const os = c.createOscillator(), g = c.createGain(), tt = t + i * 0.035;
        os.type = 'square'; os.frequency.value = U.rand(80, 1600);
        g.gain.setValueAtTime(0.06, tt); g.gain.setValueAtTime(0.0001, tt + 0.03);
        os.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.035);
      }
    },
    sfx_nearmiss(t, o) {
      if (!this.rate('nearmiss', 150)) return;
      const c = this.ctx, os = c.createOscillator(), g = c.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(880, t); os.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      os.connect(g); g.connect(this.out(o.pan)); os.start(t); os.stop(t + 0.13);
    },
    sfx_star(t) { this.playJingle('star'); },
    sfx_shatter(t) { this.sfx_slosh(t, { kind: 'eggs', vol: 1.6 }); this.sfx_thud(t, { vol: 0.6 }); },

    /* ---------- the bánh bao call ---------- */
    buildBanhBaoChain() {
      const c = this.ctx;
      // megaphone: highpass -> bandpass (1-3 kHz) -> soft distortion -> slapback echo -> panner -> gain
      this.bbIn = c.createGain();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1750; bp.Q.value = 0.9;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      const drive = c.createGain(); drive.gain.value = 3.2;
      const ws = c.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
      ws.curve = curve; ws.oversample = '2x';
      const post = c.createGain(); post.gain.value = 0.5;
      const delay = c.createDelay(0.5); delay.delayTime.value = 0.085;
      const fb = c.createGain(); fb.gain.value = 0.28;
      const wet = c.createGain(); wet.gain.value = 0.45;
      this.bbPan = this.panNode(0);
      this.bbGain = c.createGain(); this.bbGain.gain.value = 0.0001;
      this.bbIn.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(drive); drive.connect(ws); ws.connect(post);
      post.connect(this.bbPan);
      post.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.bbPan);
      // a bit of the unfiltered clip body keeps it intelligible
      const body = c.createBiquadFilter(); body.type = 'bandpass'; body.frequency.value = 1000; body.Q.value = 0.5;
      const bodyG = c.createGain(); bodyG.gain.value = 0.35;
      this.bbIn.connect(body); body.connect(bodyG); bodyG.connect(this.bbPan);
      this.bbPan.connect(this.bbGain); this.bbGain.connect(this.sfxBus);
    },
    decodeBanhBao() {
      const self = this;
      try {
        const uri = SS.BANHBAO_CLIP || '';
        const b64 = uri.slice(uri.indexOf(',') + 1);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ok = (buf) => { self.bbBuffer = buf; if (self.bbActive) { self.bbActive = false; self.bbStart(); } };
        const fail = () => { self.bbFailed = true; };
        const p = this.ctx.decodeAudioData(bytes.buffer, ok, fail);
        if (p && p.catch) p.catch(fail);
      } catch (e) { this.bbFailed = true; }
    },
    bbStart() {
      if (!this.ctx || this.bbActive) return;
      this.bbActive = true;
      if (this.bbBuffer) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.bbBuffer; s.loop = true;
        s.connect(this.bbIn); s.start(this.ctx.currentTime, Math.random() * this.bbBuffer.duration * 0.5);
        this.bbSrc = s;
      } else {
        this.bbChantTimer = 0; // synthesised fallback, driven from update()
      }
    },
    bbStop() {
      if (!this.bbActive) return;
      this.bbActive = false;
      if (this.ctx) this.bbGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      if (this.bbSrc) { const s = this.bbSrc; this.bbSrc = null; try { s.stop(this.ctx.currentTime + 0.4); } catch (e) { /* */ } }
    },
    // pan -1..1, vol 0..1 (from distance)
    bbUpdate(pan, vol) {
      if (!this.ctx || !this.bbActive) return;
      const t = this.ctx.currentTime;
      if (this.hasPanner) this.bbPan.pan.setTargetAtTime(U.clamp(pan, -1, 1), t, 0.05);
      this.bbGain.gain.setTargetAtTime(Math.max(0.0001, vol * 0.95), t, 0.06);
    },
    // Fallback: synthesised megaphone chant "bánh bao" (rising, then falling)
    updateChant(dt) {
      this.bbChantTimer -= dt;
      if (this.bbChantTimer > 0) return;
      this.bbChantTimer = 1.7;
      const c = this.ctx, t = c.currentTime + 0.02;
      const syl = (tt, f0, f1, fa, fb, len) => {
        const o = c.createOscillator(), g = c.createGain(), F1 = c.createBiquadFilter(), F2 = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0, tt); o.frequency.linearRampToValueAtTime(f1, tt + len);
        F1.type = 'bandpass'; F1.Q.value = 6; F1.frequency.setValueAtTime(fa, tt); F1.frequency.linearRampToValueAtTime(fb, tt + len);
        F2.type = 'bandpass'; F2.Q.value = 8; F2.frequency.value = 1250;
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.9, tt + 0.03);
        g.gain.setValueAtTime(0.9, tt + len - 0.06); g.gain.linearRampToValueAtTime(0.0001, tt + len);
        o.connect(F1); o.connect(F2); F1.connect(g); F2.connect(g); g.connect(this.bbIn);
        o.start(tt); o.stop(tt + len + 0.02);
      };
      syl(t, 210, 265, 800, 900, 0.32);         // "bánh" (rising tone)
      syl(t + 0.4, 250, 215, 850, 450, 0.5);    // "bao" (level, vowel a -> o)
    },
  });
})();
