/* =====================================================================
 * World builder — turns a level config into a street layout.
 * ---------------------------------------------------------------------
 * Deterministic per level (seeded RNG), so the same level always has
 * the same street. Produces: shops (far side facades + signs),
 * footpath obstacles, intersections, durian stalls, coins, lanterns,
 * poles, ground decals and seller spawn triggers.
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;
  const U = SS.U;
  const G = SS.GEOM;

  const BOARD = [
    { b: '#c8372d', t: '#fff4d6' }, { b: '#f2c230', t: '#7a1f12' }, { b: '#1f4f7a', t: '#ffe08a' },
    { b: '#2f7f4f', t: '#fff8e0' }, { b: '#f4efe0', t: '#b5261e' }, { b: '#7a2440', t: '#ffe6a8' },
  ];
  const NEON = ['#ff4fa3', '#3ff0ff', '#ff9a3c', '#63ff8a', '#ff4848', '#ffe14a', '#b48cff'];

  SS.World = {
    build(world, level, levelIndex) {
      const rng = U.rng(9001 + levelIndex * 7919 + level.length);
      const L = level.length;
      const W = {
        length: L, shops: [], obstacles: [], durians: [], coins: [], lanterns: [], poles: [],
        decals: [], sellerTriggers: [], intersections: [], destination: null, wires: [],
      };
      const time = level.time;
      const CH = G.CROSS_HALF;

      // ---------- intersections ----------
      for (const ix of level.intersections) W.intersections.push({ x: ix, done: false, active: false });
      const inInter = (x, pad) => W.intersections.some((I) => Math.abs(x - I.x) < CH + (pad || 0));

      // ---------- shops along the far side ----------
      let id = 0;
      const destW = 300, destX = L - destW / 2;
      // fill [from, to) with shops, leaving cross-street gaps open
      const fill = (from, to) => {
        let x = from;
        while (x < to - 1) {
          const gap = W.intersections.find((I) => x < I.x + CH + 6 && x >= I.x - CH - 6);
          if (gap) { x = gap.x + CH + 6; continue; }
          const nextGap = W.intersections.find((I) => I.x - CH - 6 > x && I.x - CH - 6 < to);
          const limit = nextGap ? Math.min(to, nextGap.x - CH - 6) : to;
          let w = Math.round(rng.range(190, 290));
          if (x + w > limit) w = limit - x;
          if (w < 110) { // too narrow: widen the previous shop instead
            const prev = W.shops[W.shops.length - 1];
            if (prev && Math.abs(prev.x + prev.w - x) < 1 && !prev.isDest) prev.w += w;
            x += w; continue;
          }
          W.shops.push(this.makeShop(id++, x, w, rng.weighted(world.shopTypes), rng, world, time, false));
          x += w;
        }
      };
      fill(-700, destX);
      const destType = world.shopTypes.find((t) => t.word === level.destination) || world.shopTypes[0];
      W.destination = this.makeShop(id++, destX, destW, destType, rng, world, time, true);
      W.shops.push(W.destination);
      fill(destX + destW, L + 1700);

      // ---------- far footpath displays (narrow; often blocked) ----------
      for (const s of W.shops) {
        if (s.isDest) continue;
        if (rng() < 0.55) {
          const ox = s.x + rng.range(30, s.w - 70), ow = rng.range(50, 100);
          if (inInter(ox, 340) || inInter(ox + ow, 340)) continue;
          if (ox > L - 420) continue;
          W.obstacles.push(this.farDisplay(ox + ow / 2, ow, s, rng));
        }
      }

      // ---------- durian stalls ----------
      let durNear = true;
      for (let dx = level.durianFirst; dx < L - 500; dx += level.durianEvery * rng.range(0.85, 1.15)) {
        let px = dx;
        if (inInter(px, 300)) px += 420;
        const near = durNear || rng() < 0.3;
        durNear = !durNear;
        const st = { kind: 'durian', x: px, y: near ? 530 : 222, w: 120, d: near ? 46 : 28, near, seed: 500 + W.durians.length, timer: rng.range(0.5, 2.5) };
        W.durians.push(st); W.obstacles.push(st);
      }

      // ---------- near footpath obstacles ----------
      const dens = level.obstacleDensity;
      let nx = level.tutorial ? 520 : 380;
      let firstBlock = true;
      while (nx < L - 420) {
        if (inInter(nx, 440)) { const I = W.intersections.find((I2) => Math.abs(nx - I2.x) < CH + 440); nx = I.x + CH + 460; continue; }
        if (W.durians.some((d) => d.near && Math.abs(d.x - nx) < 120)) { nx += 150; continue; }
        // blocked stretch forcing the player out into the road
        const len = firstBlock && level.tutorial ? 360 : rng.range(170, 260 + 220 * dens);
        firstBlock = false;
        this.fillBlocked(W, nx, len, rng);
        nx += len;
        // open stretch with the odd small prop on one row
        const open = rng.range(160, 420) * (1.4 - dens * 0.6);
        if (open > 240 && rng() < 0.6) {
          const ox = nx + open / 2;
          if (!inInter(ox, 440) && !W.durians.some((d) => d.near && Math.abs(d.x - ox) < 120)) W.obstacles.push(this.smallProp(ox, rng));
        }
        nx += open;
      }

      // ---------- poles along the near kerb (wire anchors) ----------
      for (let px = 260; px < L + 900; px += rng.range(380, 520)) {
        if (inInter(px, 30)) continue;
        W.poles.push({ kind: 'pole', x: px, y: 449, w: 12, d: 7 });
        W.obstacles.push(W.poles[W.poles.length - 1]);
      }
      // overhead wire bundles: pole -> facade, pole -> pole
      for (let i = 0; i < W.poles.length; i++) {
        const p = W.poles[i], n = W.poles[i + 1];
        // wires stay above the sign line or drop to awning height, so signs stay readable
        W.wires.push({ x1: p.x, y1: 6, x2: p.x - rng.range(140, 280), y2: rng.range(118, 132), sag: rng.range(4, 14), n: 3 + Math.floor(rng() * 4) });
        if (n) W.wires.push({ x1: p.x, y1: 2, x2: n.x, y2: 2, sag: rng.range(4, 10), n: 2 + Math.floor(rng() * 3) });
      }

      // ---------- lanterns strung over the street ----------
      for (let lx = 200; lx < L + 1200; lx += rng.range(260, 420)) {
        const n = 3 + Math.floor(rng() * 4), y0 = rng.range(112, 122);
        const cols = ['#e2392b', '#f07a22', '#f2c230'];
        const string = { x: lx, y: y0, w: rng.range(140, 220), sag: rng.range(4, 9), items: [] };
        for (let k = 0; k < n; k++) string.items.push({ t: (k + 0.5) / n, c: cols[Math.floor(rng() * 3)], ph: rng() * 6 });
        W.lanterns.push(string);
      }

      // ---------- coins ----------
      for (let i = 0; i < level.coinGroups; i++) {
        const cx = rng.range(500, L - 300);
        const pattern = rng();
        if (pattern < 0.55) { // line across the road (rewards crossing)
          const y0 = rng.range(G.ROAD_TOP + 18, G.ROAD_BOT - 70);
          for (let k = 0; k < 5; k++) W.coins.push({ x: cx + k * 8, y: y0 + k * 16, taken: false, ph: rng() * 6, v: 5 }); // risky: in the traffic
        } else if (pattern < 0.85) { // line along the road
          const y0 = rng.range(G.ROAD_TOP + 20, G.ROAD_BOT - 14);
          for (let k = 0; k < 5; k++) W.coins.push({ x: cx + k * 26, y: y0, taken: false, ph: rng() * 6, v: 5 });
        } else { // footpath arc
          for (let k = 0; k < 4; k++) W.coins.push({ x: cx + k * 24, y: 512 - Math.sin(k / 3 * Math.PI) * 30, taken: false, ph: rng() * 6, v: 1 }); // safe: on the footpath
        }
      }
      // drop coins that sit inside obstacles
      W.coins = W.coins.filter((c) => !W.obstacles.some((o) => c.x > o.x - o.w / 2 - 8 && c.x < o.x + o.w / 2 + 8 && c.y > o.y - o.d - 8 && c.y < o.y + 8));

      // ---------- ground decals ----------
      for (let dx = 300; dx < L + 1200; dx += rng.range(260, 520)) {
        const r = rng();
        if (r < 0.25) W.decals.push({ kind: 'manhole', x: dx, y: rng.range(G.ROAD_TOP + 30, G.ROAD_BOT - 20) });
        else if (r < 0.5 || (SS.LIGHTING[time].puddles && r < 0.85)) W.decals.push({ kind: 'puddle', x: dx, y: rng.range(G.ROAD_TOP + 20, G.ROAD_BOT - 16), w: rng.range(40, 110), c: NEON[Math.floor(rng() * NEON.length)] });
        else W.decals.push({ kind: 'patch', x: dx, y: rng.range(G.ROAD_TOP + 20, G.ROAD_BOT - 20), w: rng.range(40, 120) });
      }

      // ---------- seller triggers ----------
      let si = 0;
      for (let sx = level.sellerFirst; sx < L - 700; sx += level.sellerEvery * rng.range(0.8, 1.2)) {
        if (inInter(sx, 380)) continue;
        W.sellerTriggers.push({ x: sx, type: level.sellerTypes[si % level.sellerTypes.length], fired: false });
        si++;
      }
      return W;
    },

    makeShop(id, x, w, typ, rng, world, time, isDest) {
      const pal = world.palette;
      const pick = (a) => a[Math.floor(rng() * a.length)];
      let style;
      const r = rng();
      if (time === 'night') style = r < 0.6 ? 'neon' : r < 0.8 ? 'vertical' : r < 0.95 ? 'board' : 'icon';
      else if (time === 'golden') style = r < 0.3 ? 'neon' : r < 0.55 ? 'vertical' : r < 0.9 ? 'board' : 'icon';
      else style = r < 0.15 ? 'neon' : r < 0.4 ? 'vertical' : r < 0.88 ? 'board' : r < 0.96 ? 'icon' : 'blank';
      if (isDest) style = time === 'night' ? 'neon' : 'board';
      const bt = pick(BOARD);
      return {
        id, x, w, seed: Math.floor(rng() * 1e9), isDest,
        top: isDest ? 6 : Math.round(rng.range(0, 56)),
        color: pick(pal.facades), awning: rng() < 0.85 ? pick(pal.awnings) : null, stripes: rng() < 0.4,
        word: typ.word, goods: typ.goods, icon: typ.icon,
        signStyle: style, boardColor: bt.b, textColor: bt.t, neon: pick(NEON),
        flicker: rng() < 0.2 ? rng.range(3, 9) : 0,
      };
    },

    // obstacles: {kind, x (centre), y (front edge / depth-sort key), w, d (depth extent)}
    fillBlocked(W, x0, len, rng) {
      const kinds = ['parked', 'parked', 'stools', 'cart', 'cards', 'pots'];
      let x = x0;
      while (x < x0 + len) {
        const k = kinds[Math.floor(rng() * kinds.length)];
        if (k === 'parked') {
          const w = Math.min(rng.range(110, 190), x0 + len - x + 40);
          W.obstacles.push({ kind: 'parked', x: x + w / 2, y: 536, w, d: 94, n: Math.max(2, Math.round(w / 40)), seed: Math.floor(rng() * 1e6) });
          x += w - 6;
        } else {
          // two rows: back (by the kerb) and front (by the wall)
          const w = rng.range(80, 120);
          W.obstacles.push(this.rowProp(k, x + w / 2, 490, 48, w, rng));
          const k2 = ['stools', 'pots', 'cards', 'cart'][Math.floor(rng() * 4)];
          W.obstacles.push(this.rowProp(k2, x + w / 2 + rng.range(-10, 10), 536, 50, w, rng));
          x += w - 4;
        }
      }
    },
    rowProp(kind, x, y, d, w, rng) {
      const pal = SS.WORLDS.vietnam.palette;
      const o = { kind, x, y, w, d, seed: Math.floor(rng() * 1e6) };
      if (kind === 'stools' || kind === 'cards') {
        o.spare = 2;
        o.items = kind === 'cards' ? 'cards' : rng() < 0.5 ? 'tea' : 'bowls';
        o.people = [];
        const n = kind === 'cards' ? 2 : 1 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
          o.people.push({
            dx: i === 0 ? -w * 0.28 : w * 0.28, dy: -d * 0.35, face: i === 0 ? 1 : -1, ph: rng() * 6,
            skin: pal.skin[Math.floor(rng() * pal.skin.length)],
            shirt: kind === 'cards' ? ['#e8e2d0', '#c9d6dc', '#d8c9a0'][i % 3] : pal.shirts[Math.floor(rng() * pal.shirts.length)],
            pants: ['#3a3f4a', '#5a4a3a', '#2f2f35'][Math.floor(rng() * 3)],
            hair: kind === 'cards' ? '#d8d8d8' : '#231a14', beard: kind === 'cards' && rng() < 0.5,
            stool: ['#d6382c', '#2c78c2', '#3f9a4a'][Math.floor(rng() * 3)],
            hat: kind === 'cards' && rng() < 0.3 ? 'cap' : null,
          });
        }
      } else if (kind === 'cart') {
        o.goods = rng() < 0.5 ? 'banhmi' : 'fruit';
        o.vendor = { skin: pal.skin[Math.floor(rng() * pal.skin.length)], shirt: pal.shirts[Math.floor(rng() * pal.shirts.length)], ph: rng() * 6, hat: rng() < 0.5 ? 'cone' : null };
      }
      return o;
    },
    smallProp(x, rng) {
      const k = rng() < 0.5 ? 'pots' : 'stools';
      return this.rowProp(k, x, rng() < 0.5 ? 490 : 536, 46, 70, rng);
    },
    farDisplay(x, w, shop, rng) {
      const goodsKind = { cafe: 'stools', tea: 'stools', beer: 'stools', pho: 'stools', grill: 'stools', rice: 'stools' }[shop.goods] || 'goods';
      return { kind: goodsKind === 'stools' ? 'farstools' : 'fargoods', x, y: 223, w, d: 36, seed: Math.floor(rng() * 1e6), goods: shop.goods };
    },
  };
})();
