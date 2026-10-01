#!/usr/bin/env node
/* =====================================================================
 * Export reference PNGs of every visual in Street Smart.
 * ---------------------------------------------------------------------
 * The game draws all of its art in code (js/art.js, js/render.js,
 * js/ui.js, js/story.js); it loads no image files. This tool opens the
 * game in a headless browser, calls the game's own drawing functions,
 * and saves the results to assets/<category>/*.png, plus
 * assets/asset-manifest.json (file, pixel size, where it is used, what it
 * shows, which code draws it).
 *
 * Use the PNGs as the brief for new art. The game does not load them.
 *
 * Run (from the project folder):
 *   npm install playwright      (once; any recent version)
 *   node tools/export-assets.js
 * ===================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const SCALE = 2; // device pixels per logical game unit for the exports

// tiny static server so the game loads exactly as it does on a phone
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1168, height: 540 }, deviceScaleFactor: SCALE })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.SS && SS.UI && SS.UI.demo, null, { timeout: 15000 });
  await page.waitForTimeout(1200);

  const out = [];
  const save = async (list) => {
    for (const a of list) {
      const file = path.join(ROOT, 'assets', a.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(a.data.split(',')[1], 'base64'));
      delete a.data;
      out.push(a);
    }
  };

  /* ---------- 1. sprites drawn by js/art.js (transparent PNGs) ---------- */
  await save(await page.evaluate((SCALE) => {
    const Art = SS.Art, U = SS.U;
    window.__render = SS.Main.render; SS.Main.render = () => {}; // pause the live renderer while we borrow the sprite cache
    Art.setScale(SCALE);
    const res = [];
    const png = (c) => c.toDataURL('image/png');
    const add = (p, c, used, what, code) => res.push({ path: p, w: c.width, h: c.height, used, what, code, data: png(c) });
    const sheet = (frames) => {
      const fw = frames[0].width, fh = frames[0].height, c = document.createElement('canvas');
      c.width = fw * frames.length; c.height = fh;
      frames.forEach((f, i) => c.getContext('2d').drawImage(f, i * fw, 0));
      return { c, fw, fh, n: frames.length };
    };
    const personSprite = (key, o) => Art.entSprite('exp_' + key, 80, 120, 40, 108, (g) => Art.person(g, Object.assign({ x: 0, y: 0, s: 1 }, o))).c;
    const sess = new SS.Session('vietnam', 0, { demo: true });

    // ---- player (courier) ----
    // same values as render.js playerLook() (CRAB courier)
    const P = (extra) => Object.assign({ face: 1, skin: '#e9b98f', shirt: SS.COL_PLAYER, zip: true, pants: '#4a3426', hair: '#1f140e', hairStyle: 'side', courierBox: SS.COL_PLAYER, boxText: SS.STRINGS.brand, shoe: '#2e3138',
      hat: 'cap', hatColor: SS.COL_PLAYER, halo: '#ffffff', ink: '#24150f' }, extra);
    add('characters/player_idle.png', personSprite('pl_idle', P({ moving: 0 })), 'Gameplay: the player (Minh)', 'Minh, the CRAB courier: green zip jacket, green cap, green CRAB box, brown trousers, white outline', 'render.js playerLook() + art.js person()');
    let sh = sheet([0, 1, 2, 3, 4, 5, 6, 7].map((f) => personSprite('pl_walk' + f, P({ moving: 1, phase: f * Math.PI / 4 }))));
    add('characters/player_walk_sheet.png', sh.c, 'Gameplay: player walking (frame from walk phase)', `Walk cycle, 8 frames of ${sh.fw}x${sh.fh} px, left to right`, 'render.js playerLook() + art.js person()');
    sh = sheet([0, 1, 2, 3, 4, 5, 6, 7].map((f) => personSprite('pl_carry' + f, P({ moving: 1, phase: f * Math.PI / 4, carry: 'pho', arms: 'carry', cargoPct: 1 }))));
    add('characters/player_walk_carry_sheet.png', sh.c, 'Gameplay: player carrying an order', `Walk cycle carrying a bowl of phở, 8 frames of ${sh.fw}x${sh.fh} px`, 'art.js person() + carryItem()');
    add('characters/player_sitting_sad.png', personSprite('pl_sit', P({ sit: true, hunch: 1, halo: null })), 'Story cutscene shot 6', 'Minh sitting on a stool in the rain', 'story.js minhSad');

    // ---- customers, vendors, sellers ----
    add('characters/customer_waiting.png', personSprite('cust', { face: -1, skin: '#d9a77a', shirt: '#5fa3b8', pants: '#33363f', hair: '#1d1611', holding: 'phone', arms: 'up', ink: '#24150f' }), 'Gameplay: the customer waiting for a delivery', 'Customer holding a phone, waving', 'render.js drawCustomer()');
    add('characters/vendor_shopkeeper.png', personSprite('vend', { face: 1, skin: '#c48b5f', shirt: '#f2efe6', pants: '#3a3f4a', hair: '#1d1611', vest: '#c84b3a', arms: 'up', mouth: 0.5, ink: '#24150f' }), 'Gameplay: shopkeeper handing over the order', 'Vendor in a red apron, waving', 'render.js drawCustomer() (vendor branch)');
    const sellers = {
      sunglasses: { sunglasses: true, pattern: 'flowers', holding: 'rack', hat: 'cap', hatColor: '#1e1e22', arms: 'up', shirt: '#e05a7a' },
      fruit: { hat: 'cone', pole: true, arms: 'pole', hunch: 1, hairBun: true, hair: '#9a9a9a', fruit: '#7fbf3a', fruit2: '#f0a030', shirt: '#7aa35a' },
      watch: { jacket: '#3b3f4a', jacketOpen: true, arms: 'up', hair: '#111', shirt: '#e8e2d0' },
      ride: { shirt: '#f2f1ec', pants: '#1b1d24', flipflops: true, hairStyle: 'spiky', hair: '#16100c', holding: 'phone', arms: 'up' },
      shoe: { crouch: true, holding: 'brush', hat: 'cap', hatColor: '#3d7fd0', shirt: '#d97a2b' },
    };
    const sellerWhat = { sunglasses: 'Sunglasses seller with a display rack', fruit: 'Fruit seller with a shoulder pole and baskets, conical hat', watch: 'Watch seller opening his jacket full of watches', ride: 'Fake CRAB driver: white T-shirt, black jeans, flip-flops, waving a phone', shoe: 'Shoe-shine man crouching with a brush' };
    for (const k in sellers) add(`characters/seller_${k}.png`, personSprite('sel_' + k, Object.assign({ face: -1, skin: '#c48b5f', pants: '#33363f', ink: '#24150f', mouth: 0.5 }, sellers[k])), 'Gameplay: street seller (SS.SELLERS.' + k + ')', sellerWhat[k], 'render.js drawSeller()');

    // ---- traffic ----
    const rng = U.rng(5), pal = sess.world.palette;
    const kinds = { single: 'one rider', couple: 'rider + passenger', family: 'family of four on one bike', crates: 'stacked crates on the back', flowers: 'flower baskets', chickens: 'chickens in cages', boxes: 'tall stack of boxes', delivery: 'delivery rider with a box', ridehail: 'ride-hail rider in green with a passenger', banhbao: 'the bánh bao bike: steamer box and megaphone' };
    for (const k in kinds) {
      const v = sess.makeVariant(k, 'exp_' + k, rng, pal);
      let sc = Art.scooterSprite(v, 0).c;
      if (k === 'banhbao') { // his head is drawn live in the game (mouth moves); add it for the reference
        const spr = Art.scooterSprite(v, 0), k2 = sc.width / spr.w, c2 = document.createElement('canvas');
        c2.width = sc.width; c2.height = sc.height; const g2 = c2.getContext('2d'); g2.drawImage(sc, 0, 0);
        g2.scale(k2, k2); g2.translate(spr.ox, spr.oy); for (const r of v.riders) Art.riderHead(g2, r.x + 4, r.headY, r, 0.25, 0.6);
        sc = c2;
      }
      add(`characters/scooter_${k}.png`, sc, k === 'banhbao' ? 'Gameplay: the bánh bao bike (bonus)' : 'Gameplay: traffic, side view', 'Scooter, ' + kinds[k] + ' (faces right; flipped for left)', 'art.js scooterSprite()');
    }
    const vs = sess.makeVariant('couple', 'exp_v', rng, pal);
    add('characters/scooter_crossing_toward.png', Art.scooterVSprite(vs, 1).c, 'Gameplay: cross-street traffic coming toward the camera', 'Scooter seen from the front', 'art.js scooterVSprite()');
    add('characters/scooter_crossing_away.png', Art.scooterVSprite(vs, -1).c, 'Gameplay: cross-street traffic going away', 'Scooter seen from behind', 'art.js scooterVSprite()');
    for (const sub of ['sedan', 'taxi', 'van']) {
      let v; for (let i = 0; i < 50; i++) { v = sess.makeVariant('car', 'exp_car_' + sub + i, rng, pal); if (v.sub === sub) break; }
      add(`characters/car_${sub}.png`, Art.carSprite(v).c, 'Gameplay: traffic, side view', 'Car: ' + sub + ' (no lettering)', 'art.js carSprite()');
    }

    // ---- shops, one per sign word, in the three lighting presets ----
    const base = sess.W.shops.find((s) => !s.isDest) || sess.W.shops[0];
    for (const tod of ['morning', 'golden', 'night']) {
      const L = Object.assign({ key: tod }, SS.LIGHTING[tod]);
      for (const t of sess.world.shopTypes) {
        const shop = Object.assign({}, base, { id: 'exp_' + t.word + tod, word: t.word, goods: t.goods, icon: t.icon, signStyle: tod === 'night' ? 'neon' : 'board', w: 240, seed: 1234 });
        const slug = t.goods;
        if (tod === 'morning') add(`backgrounds/shop_${slug}.png`, Art.shopSprite(shop, L).c, 'Background: shop fronts along the street', `Shop front with sign "${t.word}" and its goods (${t.goods}), daytime`, 'art.js shopSprite() / drawShop()');
        else if (t.goods === 'pho') add(`backgrounds/shop_${slug}_${tod}.png`, Art.shopSprite(shop, L).c, 'Background: shop fronts (' + tod + ' lighting)', `Shop "${t.word}" at ${tod}` + (tod === 'night' ? ', neon sign' : ''), 'art.js shopSprite()');
      }
    }
    for (let i = 0; i < 4; i++) add(`backgrounds/far_skyline_${i}.png`, Art.farTile(i, sess.L).c, 'Background: distant buildings behind the shops (tiles repeat)', 'Far skyline tile ' + (i + 1) + ' of 4', 'art.js farTile()');

    // ---- props (the footpath obstacles) ----
    const ob = (kind) => sess.W.obstacles.find((o) => o.kind === kind);
    const props = [
      ['parked', 'prop_parked_scooters', 'Row of parked scooters on the footpath (blocks walking)', (o) => Art.parkedSprite(o)],
      ['cart', 'prop_food_cart', 'Street food cart with umbrella', (o) => Art.cartSprite(o)],
      ['durian', 'prop_durian_stall', 'Durian stall with "SẦU RIÊNG" sign', (o) => Art.durianStallSprite(o, sess.world.durianWord)],
      ['pots', 'prop_flower_pots', 'Potted plants', (o) => Art.potsSprite(o)],
      ['stools', 'prop_table_stools', 'Low table with plastic stools', (o) => Art.tableSprite({ seed: o.seed, w: o.w, d: o.d, spare: 1, items: o.items })],
    ];
    for (const [kind, name, what, fn] of props) { const o = ob(kind); if (o) add(`backgrounds/${name}.png`, fn(o).c, 'Gameplay: footpath obstacle', what, 'art.js (see render.js drawObstacle)'); }
    add('backgrounds/prop_street_pole.png', Art.poleSprite().c, 'Gameplay: power pole with tangled wires', 'Street pole', 'art.js poleSprite()');

    // ---- effects ----
    add('effects/puff_dust.png', Art.puff('#c8b48a').c, 'Effect: dust kicked up by scooters', 'Soft round puff (tinted per use)', 'art.js puff()');
    add('effects/puff_durian.png', Art.puff('#b9c43a').c, 'Effect: durian stink cloud', 'Green-yellow puff', 'art.js puff()');
    add('effects/glow_lantern.png', Art.glow('#ffc070').c, 'Effect: warm light pools, lanterns, bánh bao glow', 'Radial glow (additive)', 'art.js glow()');
    add('effects/headlight_cone.png', Art.headlightCone().c, 'Effect: scooter headlights at night', 'Headlight beam (additive)', 'art.js headlightCone()');
    const neonShop = Object.assign({}, base, { id: 'exp_neon', word: 'BIA HƠI', signStyle: 'neon', neon: '#ff4fa3', w: 240 });
    add('effects/neon_glow.png', Art.neonGlowSprite(neonShop).c, 'Effect: glow around neon signs at night', 'Neon sign glow', 'art.js neonGlowSprite()');

    // ---- icons ----
    const iconCanvas = (r, fn) => { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(r * 2 * SCALE); const g = c.getContext('2d'); g.scale(SCALE, SCALE); g.translate(r, r); g.lineCap = 'round'; g.lineJoin = 'round'; fn(g); return c; };
    for (const id of SS.FOOD_ORDER) {
      const F = SS.FOODS[id];
      add(`icons/food_${id}.png`, iconCanvas(24, (g) => { g.translate(0, 8); Art.carryItem(g, F.carry, 0, 0, 0, 1, F.cup); }), 'Gameplay: order badge, carried item, order chip, passport', `Food: ${F.name} (${F.shop})`, 'art.js carryItem()');
    }
    for (const n of ['bowl', 'cup', 'bread', 'bun', 'basket', 'scissors', 'glass']) add(`icons/sign_${n}.png`, iconCanvas(16, (g) => Art.icon(g, n, 0, 0, 13, '#2a1a12')), 'Background: icon-style shop signs', 'Sign pictogram: ' + n, 'art.js icon()');
    add('icons/coin.png', iconCanvas(12, (g) => Art.coin(g, 0, 0, 10, 0)), 'Gameplay + HUD: coins', 'Gold coin', 'art.js coin()');
    add('icons/heart.png', iconCanvas(12, (g) => Art.heart(g, 0, 0, 10, '#ff5a6a')), 'HUD: lives', 'Heart', 'art.js heart()');
    for (const k of ['conf', 'breath']) add(`icons/hud_${k}.png`, iconCanvas(16, (g) => Art.hudIcon(g, k, 0, 0, 14)), 'HUD: meter icon', k === 'conf' ? 'Confidence (walking figure)' : 'Breath (lungs)', 'art.js hudIcon()');

    // ---- UI ----
    const lc = document.createElement('canvas'); lc.width = 760 * SCALE; lc.height = 160 * SCALE;
    const lg = lc.getContext('2d'); lg.scale(SCALE, SCALE); SS.UI.logo(lg, 380, 80, 70, 740);
    add('ui/logo.png', lc, 'Title screen + loading', '"STREET SMART" logo lettering (font: Baloo 2)', 'ui.js logo()');
    const bc = document.createElement('canvas'); bc.width = 240 * SCALE; bc.height = 70 * SCALE;
    const bg = bc.getContext('2d'); bg.scale(SCALE, SCALE); SS.UI.hits = []; SS.UI.button(bg, 'exp', 10, 6, 220, 56, SS.STRINGS.play, { size: 26 });
    add('ui/button_primary.png', bc, 'Menus: main buttons', 'Orange rounded button (PLAY)', 'ui.js button()');
    // app icon (placeholder; not used by the game itself)
    const ic = document.createElement('canvas'); ic.width = ic.height = 1024; const g = ic.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, '#3a2030'); gr.addColorStop(1, '#120c18'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    g.save(); g.translate(512, 610); g.scale(4.2, 4.2); Art.person(g, Object.assign({ x: 0, y: 0, s: 1 }, P({ moving: 0.6, phase: 1 }))); g.restore();
    SS.UI.logo(g, 512, 170, 120, 960);
    add('icons/app_icon_1024.png', ic, 'App Store / Google Play icon (PLACEHOLDER, not loaded by the game)', 'Minh on a dark background with the logo', 'tools/export-assets.js');
    return res;
  }, SCALE));

  /* ---------- 2. full-screen references (screenshots) ---------- */
  const shot = async (p, used, what, code) => {
    const file = path.join(ROOT, 'assets', p); fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    out.push({ path: p, w: 1168 * SCALE, h: 540 * SCALE, used, what, code });
  };
  await page.evaluate(() => { SS.Art.setScale(SS.View.S); SS.Main.render = window.__render; SS.Save.data.howtoSeen = true; SS.Save.data.storySeen = true; });
  // empty streets in each lighting (no HUD)
  for (const [i, tod] of [[0, 'morning'], [1, 'golden'], [2, 'night']]) {
    await page.evaluate((i) => { const s = new SS.Session('vietnam', i, { demo: true }); s.cam.x = 900; SS.UI.go('title'); SS.UI.demo = s; SS.UI.screen = 'blank'; SS.UI.render = function (ctx) { this.demo.render(ctx); }; }, i);
    await page.waitForTimeout(700);
    await shot(`backgrounds/street_${tod}.png`, `Gameplay background, level ${i + 1}`, `Full street scene at ${tod}: sky, far buildings, shop fronts, footpaths, road and traffic`, 'render.js render()');
  }
  await page.reload(); await page.waitForFunction(() => window.SS && SS.UI && SS.UI.demo); await page.waitForTimeout(1200);
  await page.evaluate(() => { SS.Save.data.howtoSeen = true; SS.Save.data.storySeen = true; SS.Save.data.coins = 640; SS.UI.go('title'); });
  await page.waitForTimeout(600);
  await shot('ui/screen_title.png', 'Title screen', 'Title screen layout: logo, PLAY, HOW TO PLAY, STORY, SETTINGS, CREDITS', 'ui.js drawTitle()');
  await page.evaluate(() => SS.UI.go('levels')); await page.waitForTimeout(500);
  await shot('ui/screen_levels.png', 'Level select', 'Level cards, Scooter Fund meter, Upgrades and Food Passport buttons', 'ui.js drawLevels()');
  await page.evaluate(() => { SS.Input.touchMode = true; SS.UI.startLevel(0); SS.UI.session.state = 'play'; }); await page.waitForTimeout(2500);
  await shot('ui/screen_gameplay_hud.png', 'Gameplay HUD', 'HUD: confidence + breath meters, hearts, coins, order chip, touch buttons, PICK UP marker, guide arrow', 'render.js drawHUD() + input.js draw()');
  // story frames (the cutscene loads its two paintings first)
  await page.evaluate(() => SS.UI.playStory(() => {})); await page.waitForFunction(() => SS.Story.imgs && !SS.Story.loading, null, { timeout: 10000 });
  const times = [3.5, 3.0, 3.2, 2.2, 1.6, 3.5, 5.0, 3.0];
  const shotWhat = ['The Old Quarter at rush hour (street painting, slow pan)', 'Minh and his CRAB box (cover art, push-in)', 'The key left in a parked scooter ("TING!")', 'The tourist snatches the key ("SNATCH!!")', 'Minh\'s shocked face ("TRỜI ƠI!!")', 'The tourist rides off on Minh\'s scooter ("Spasibo!")', 'Rain; Bà Lan tells Minh to deliver on foot', 'Goal card: save 1,500 coins for a new scooter'];
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(([i, t]) => { SS.Story.prev = null; SS.Story.shot = i; SS.Story.lt = t; SS.Story.fired = { s: 1, g: 1, h: 1, h2: 1, t: 1, r: 1, p: 1, c: 1 }; SS.Story.shake = 0; SS.Story.flash = 0; }, [i, times[i]]);
    await page.waitForTimeout(120);
    await shot(`backgrounds/story_shot_${i + 1}.png`, 'Opening story cutscene, shot ' + (i + 1), shotWhat[i], 'story.js shots[' + i + ']');
  }

  fs.writeFileSync(path.join(ROOT, 'assets', 'asset-manifest.json'), JSON.stringify(out, null, 2));
  console.log(`exported ${out.length} files` + (errors.length ? '\nerrors:\n' + errors.join('\n') : ''));
  await browser.close(); srv.close();
})();
