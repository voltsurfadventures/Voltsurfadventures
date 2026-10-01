# BANH ZAI — Hanoi

*(Formerly "Street Smart". The name is set in one place: `TITLE` in `js/config.js`.)*

*"Frogger taught you to dodge. This teaches you to flow."*

A 2.5D belt-scroller about crossing Vietnamese traffic the way locals do: slowly and steadily, so the riders can read you and flow around you. It's built with HTML5 Canvas and plain JavaScript. There are no frameworks, no CDNs and no network requests, and it runs 100% offline.

This folder is the web project. Drop it into Capacitor's web directory to build the iOS and Android apps.

```
street-smart/
├── index.html            ★ entry file: the game shell (loading screen, rotate screen)
├── manifest.webmanifest  home-screen / full-screen settings
├── css/
│   ├── fonts.css         @font-face rules for the bundled fonts
│   └── style.css         page shell styles
├── assets/
│   ├── audio/            music, horn recordings, bánh bao call
│   ├── fonts/            Be Vietnam Pro + Baloo 2 (.woff2) and their licences
│   ├── characters/       reference PNGs (see "Handoff package")
│   ├── backgrounds/      reference PNGs
│   ├── ui/               reference PNGs and screenshots
│   ├── icons/            reference PNGs + placeholder app icon
│   ├── effects/          reference PNGs
│   └── asset-manifest.json
├── tools/export-assets.js  re-creates the reference PNGs from the code art
└── js/
    ├── config.js         ★ title, IAP flag, UI strings, cargo, sellers, lighting, worlds & levels
    ├── save.js           save/load module, in-app-purchase hook, haptics
    ├── banhbao-clip.js   the bánh bao call (base64 MP3, embedded for offline use)
    ├── audio.js          Web Audio: synth music, ambience, SFX, spatial megaphone call
    ├── input.js          virtual joystick + buttons (multi-touch), keyboard
    ├── art.js            procedural art + sprite cache (characters, scooters, shops, signs)
    ├── world.js          level layout generator (seeded, so each level is always the same)
    ├── game.js           gameplay: flow/confidence AI, sellers, bánh bao guy, durian clouds
    ├── render.js         layered rendering, lighting, effects, HUD
    ├── story.js          opening manga cutscene
    ├── ui.js             menus & screens
    └── main.js           boot, responsive hi-DPI canvas, safe areas, game loop, auto low-quality
```

## Handoff package (for a graphics pass)

**Important: this game loads no image files.** Every character, vehicle, shop, prop, icon and effect is drawn by JavaScript at runtime, mostly in `js/art.js`, with the screen layout in `js/render.js`, menus in `js/ui.js` and the cutscene in `js/story.js`. The PNGs in `assets/characters`, `assets/backgrounds`, `assets/ui`, `assets/icons` and `assets/effects` are **reference renders** of that code art, exported with the game's own drawing functions (`tools/export-assets.js`). They show exactly what each visual looks like, its size and its anchor, so an art tool can redraw them. To use new art in the game, the matching function in the "Drawn by" column must be changed to draw the new image instead (for example with `ctx.drawImage`); no gameplay code needs to change.

Everything the game uses is inside this folder: code, fonts (`assets/fonts`, 18 `.woff2` files) and sounds (`assets/audio`). There are no remote URLs; the game makes zero network requests.

### 1. Run it locally (phone or desktop)

Browsers block some features on `file://`, so serve the folder over HTTP:

```bash
cd street-smart
python3 -m http.server 8080        # or: npx http-server -p 8080
```

- **Desktop:** open <http://localhost:8080>, make the window wider than it is tall.
- **Phone:** put the phone on the same Wi-Fi, find your computer's local IP (e.g. `192.168.1.20`) and open `http://192.168.1.20:8080` in Chrome (Android) or Safari (iPhone). Turn the phone sideways. On Android the first tap goes full screen; on iPhone use Share → Add to Home Screen for full screen.
- **Controls:** touch and drag anywhere on the left half to walk (invisible joystick); SPRINT, HOLD BREATH, NO THANKS and BUY on the right. Desktop: WASD/arrows, Shift sprint, Space hold breath, E no thanks (hold E to buy), Esc pause.

### 2. Entry file

`index.html`. It links `css/fonts.css` and `css/style.css`, then loads the scripts in `js/` in this order: config, save, banhbao-clip, audio, art, input, world, game, render, story, ui, main. `js/main.js` boots the game.

### 3. Visual assets

All PNGs have transparent backgrounds except the full-screen screenshots (`street_*`, `story_shot_*`, `screen_*`) and the app icon. Exported at **2 device pixels per game unit**; characters and vehicles carry the game's extra oversampling (×1.08, and ×1.22 for characters/vehicles), exactly as the in-game sprite cache makes them. The machine-readable list is `assets/asset-manifest.json`.

| File | Pixel size | Where it is used | What it shows | Drawn by (code) |
|---|---|---|---|---|
| `assets/characters/car_sedan.png` | 396×264 | Gameplay: traffic, side view | Car: sedan (no lettering) | `art.js carSprite()` |
| `assets/characters/car_taxi.png` | 396×264 | Gameplay: traffic, side view | Car: taxi (no lettering) | `art.js carSprite()` |
| `assets/characters/car_van.png` | 396×264 | Gameplay: traffic, side view | Car: van (no lettering) | `art.js carSprite()` |
| `assets/characters/customer_waiting.png` | 211×317 | Gameplay: the customer waiting for a delivery | Customer holding a phone, waving | `render.js drawCustomer()` |
| `assets/characters/player_idle.png` | 211×317 | Gameplay: the player (Minh) | Minh, the courier: green jacket, green helmet with white stripe, big green delivery box, white outline | `render.js playerLook() + art.js person()` |
| `assets/characters/player_sitting_sad.png` | 211×317 | Story cutscene shot 6 | Minh sitting on a stool in the rain | `story.js minhSad` |
| `assets/characters/player_walk_carry_sheet.png` | 1688×317 | Gameplay: player carrying an order | Walk cycle carrying a bowl of phở, 8 frames of 211x317 px | `art.js person() + carryItem()` |
| `assets/characters/player_walk_sheet.png` | 1688×317 | Gameplay: player walking (frame from walk phase) | Walk cycle, 8 frames of 211x317 px, left to right | `render.js playerLook() + art.js person()` |
| `assets/characters/scooter_banhbao.png` | 396×317 | Gameplay: the bánh bao bike (bonus) | Scooter, the bánh bao bike: steamer box and megaphone (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_boxes.png` | 396×317 | Gameplay: traffic, side view | Scooter, tall stack of boxes (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_chickens.png` | 396×317 | Gameplay: traffic, side view | Scooter, chickens in cages (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_couple.png` | 396×317 | Gameplay: traffic, side view | Scooter, rider + passenger (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_crates.png` | 396×317 | Gameplay: traffic, side view | Scooter, stacked crates on the back (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_crossing_away.png` | 185×290 | Gameplay: cross-street traffic going away | Scooter seen from behind | `art.js scooterVSprite()` |
| `assets/characters/scooter_crossing_toward.png` | 185×290 | Gameplay: cross-street traffic coming toward the camera | Scooter seen from the front | `art.js scooterVSprite()` |
| `assets/characters/scooter_delivery.png` | 396×317 | Gameplay: traffic, side view | Scooter, delivery rider with a box (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_family.png` | 396×317 | Gameplay: traffic, side view | Scooter, family of four on one bike (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_flowers.png` | 396×317 | Gameplay: traffic, side view | Scooter, flower baskets (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_ridehail.png` | 396×317 | Gameplay: traffic, side view | Scooter, ride-hail rider in green with a passenger (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/scooter_single.png` | 396×317 | Gameplay: traffic, side view | Scooter, one rider (faces right; flipped for left) | `art.js scooterSprite()` |
| `assets/characters/seller_fruit.png` | 211×317 | Gameplay: street seller (SS.SELLERS.fruit) | Fruit seller with a shoulder pole and baskets, conical hat | `render.js drawSeller()` |
| `assets/characters/seller_ride.png` | 211×317 | Gameplay: street seller (SS.SELLERS.ride) | Fake ride-hail driver in a green helmet waving a phone | `render.js drawSeller()` |
| `assets/characters/seller_shoe.png` | 211×317 | Gameplay: street seller (SS.SELLERS.shoe) | Shoe-shine man crouching with a brush | `render.js drawSeller()` |
| `assets/characters/seller_sunglasses.png` | 211×317 | Gameplay: street seller (SS.SELLERS.sunglasses) | Sunglasses seller with a display rack | `render.js drawSeller()` |
| `assets/characters/seller_watch.png` | 211×317 | Gameplay: street seller (SS.SELLERS.watch) | Watch seller opening his jacket full of watches | `render.js drawSeller()` |
| `assets/characters/vendor_shopkeeper.png` | 211×317 | Gameplay: shopkeeper handing over the order | Vendor in a red apron, waving | `render.js drawCustomer() (vendor branch)` |
| `assets/backgrounds/far_skyline_0.png` | 1124×411 | Background: distant buildings behind the shops (tiles repeat) | Far skyline tile 1 of 4 | `art.js farTile()` |
| `assets/backgrounds/far_skyline_1.png` | 1124×411 | Background: distant buildings behind the shops (tiles repeat) | Far skyline tile 2 of 4 | `art.js farTile()` |
| `assets/backgrounds/far_skyline_2.png` | 1124×411 | Background: distant buildings behind the shops (tiles repeat) | Far skyline tile 3 of 4 | `art.js farTile()` |
| `assets/backgrounds/far_skyline_3.png` | 1124×411 | Background: distant buildings behind the shops (tiles repeat) | Far skyline tile 4 of 4 | `art.js farTile()` |
| `assets/backgrounds/prop_durian_stall.png` | 324×346 | Gameplay: footpath obstacle | Durian stall with "SẦU RIÊNG" sign | `art.js (see render.js drawObstacle)` |
| `assets/backgrounds/prop_flower_pots.png` | 216×238 | Gameplay: footpath obstacle | Potted plants | `art.js (see render.js drawObstacle)` |
| `assets/backgrounds/prop_food_cart.png` | 260×281 | Gameplay: footpath obstacle | Street food cart with umbrella | `art.js (see render.js drawObstacle)` |
| `assets/backgrounds/prop_parked_scooters.png` | 458×260 | Gameplay: footpath obstacle | Row of parked scooters on the footpath (blocks walking) | `art.js (see render.js drawObstacle)` |
| `assets/backgrounds/prop_street_pole.png` | 108×1016 | Gameplay: power pole with tangled wires | Street pole | `art.js poleSprite()` |
| `assets/backgrounds/prop_table_stools.png` | 291×152 | Gameplay: footpath obstacle | Low table with plastic stools | `art.js (see render.js drawObstacle)` |
| `assets/backgrounds/shop_banhmi.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "BÁNH MÌ" and its goods (banhmi), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_barber.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "HỚT TÓC" and its goods (barber), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_beer.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "BIA HƠI" and its goods (beer), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_cafe.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "CÀ PHÊ" and its goods (cafe), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_cane.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "NƯỚC MÍA" and its goods (cane), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_grill.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "BÚN CHẢ" and its goods (grill), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_grocery.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "TẠP HÓA" and its goods (grocery), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_pho.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "PHỞ BÒ" and its goods (pho), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_pho_golden.png` | 536×389 | Background: shop fronts (golden lighting) | Shop "PHỞ BÒ" at golden | `art.js shopSprite()` |
| `assets/backgrounds/shop_pho_night.png` | 536×389 | Background: shop fronts (night lighting) | Shop "PHỞ BÒ" at night, neon sign | `art.js shopSprite()` |
| `assets/backgrounds/shop_rice.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "CƠM TẤM" and its goods (rice), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_steamer.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "BÁNH BAO" and its goods (steamer), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/shop_tea.png` | 536×389 | Background: shop fronts along the street | Shop front with sign "TRÀ ĐÁ" and its goods (tea), daytime | `art.js shopSprite() / drawShop()` |
| `assets/backgrounds/story_shot_1.png` | 2336×1080 | Opening story cutscene, shot 1 | Minh speeds through Hanoi ("VROOOM!") | `story.js shots[0]` |
| `assets/backgrounds/story_shot_2.png` | 2336×1080 | Opening story cutscene, shot 2 | He runs in for an order; the key left in the ignition ("TING!") | `story.js shots[1]` |
| `assets/backgrounds/story_shot_3.png` | 2336×1080 | Opening story cutscene, shot 3 | The tourist snatches the key ("SNATCH!!") | `story.js shots[2]` |
| `assets/backgrounds/story_shot_4.png` | 2336×1080 | Opening story cutscene, shot 4 | Minh's shocked face ("TRỜI ƠI!!") | `story.js shots[3]` |
| `assets/backgrounds/story_shot_5.png` | 2336×1080 | Opening story cutscene, shot 5 | The tourist rides off on Minh's scooter | `story.js shots[4]` |
| `assets/backgrounds/story_shot_6.png` | 2336×1080 | Opening story cutscene, shot 6 | Minh in the rain; Bà Lan tells him to walk | `story.js shots[5]` |
| `assets/backgrounds/story_shot_7.png` | 2336×1080 | Opening story cutscene, shot 7 | Goal card: save 1,500 coins for a new scooter | `story.js shots[6]` |
| `assets/backgrounds/street_golden.png` | 2336×1080 | Gameplay background, level 2 | Full street scene at golden: sky, far buildings, shop fronts, footpaths, road and traffic | `render.js render()` |
| `assets/backgrounds/street_morning.png` | 2336×1080 | Gameplay background, level 1 | Full street scene at morning: sky, far buildings, shop fronts, footpaths, road and traffic | `render.js render()` |
| `assets/backgrounds/street_night.png` | 2336×1080 | Gameplay background, level 3 | Full street scene at night: sky, far buildings, shop fronts, footpaths, road and traffic | `render.js render()` |
| `assets/ui/cover.jpg` | 1376×768 | Title screen (loaded by the game) | Banh Zai cover art: Minh in CRAB uniform running from the tourist on his stolen scooter (supplied by the author, made with Gemini) | `ui.js drawCoverTitle()` |
| `assets/ui/button_primary.png` | 480×140 | Menus: main buttons | Orange rounded button (PLAY) | `ui.js button()` |
| `assets/ui/logo.png` | 1520×320 | Title screen + loading | "STREET SMART" logo lettering (font: Baloo 2) | `ui.js logo()` |
| `assets/ui/screen_gameplay_hud.png` | 2336×1080 | Gameplay HUD | HUD: confidence + breath meters, hearts, coins, order chip, touch buttons, PICK UP marker, guide arrow | `render.js drawHUD() + input.js draw()` |
| `assets/ui/screen_levels.png` | 2336×1080 | Level select | Level cards, Scooter Fund meter, Upgrades and Food Passport buttons | `ui.js drawLevels()` |
| `assets/ui/screen_title.png` | 2336×1080 | Title screen | Title screen layout: logo, PLAY, HOW TO PLAY, STORY, SETTINGS, CREDITS | `ui.js drawTitle()` |
| `assets/icons/app_icon_1024.png` | 1024×1024 | App Store / Google Play icon (PLACEHOLDER, not loaded by the game) | Minh on a dark background with the logo | `tools/export-assets.js` |
| `assets/icons/coin.png` | 48×48 | Gameplay + HUD: coins | Gold coin | `art.js coin()` |
| `assets/icons/food_banhbao.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: bánh bao (BÁNH BAO) | `art.js carryItem()` |
| `assets/icons/food_banhmi.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: bánh mì (BÁNH MÌ) | `art.js carryItem()` |
| `assets/icons/food_buncha.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: bún chả (BÚN CHẢ) | `art.js carryItem()` |
| `assets/icons/food_caphe.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: iced coffee (CÀ PHÊ) | `art.js carryItem()` |
| `assets/icons/food_comtam.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: cơm tấm (CƠM TẤM) | `art.js carryItem()` |
| `assets/icons/food_nuocmia.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: sugarcane juice (NƯỚC MÍA) | `art.js carryItem()` |
| `assets/icons/food_pho.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: phở (PHỞ BÒ) | `art.js carryItem()` |
| `assets/icons/food_trada.png` | 96×96 | Gameplay: order badge, carried item, order chip, passport | Food: iced tea (TRÀ ĐÁ) | `art.js carryItem()` |
| `assets/icons/heart.png` | 48×48 | HUD: lives | Heart | `art.js heart()` |
| `assets/icons/hud_breath.png` | 64×64 | HUD: meter icon | Breath (lungs) | `art.js hudIcon()` |
| `assets/icons/hud_conf.png` | 64×64 | HUD: meter icon | Confidence (walking figure) | `art.js hudIcon()` |
| `assets/icons/sign_basket.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: basket | `art.js icon()` |
| `assets/icons/sign_bowl.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: bowl | `art.js icon()` |
| `assets/icons/sign_bread.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: bread | `art.js icon()` |
| `assets/icons/sign_bun.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: bun | `art.js icon()` |
| `assets/icons/sign_cup.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: cup | `art.js icon()` |
| `assets/icons/sign_glass.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: glass | `art.js icon()` |
| `assets/icons/sign_scissors.png` | 64×64 | Background: icon-style shop signs | Sign pictogram: scissors | `art.js icon()` |
| `assets/effects/glow_lantern.png` | 277×277 | Effect: warm light pools, lanterns, bánh bao glow | Radial glow (additive) | `art.js glow()` |
| `assets/effects/headlight_cone.png` | 476×195 | Effect: scooter headlights at night | Headlight beam (additive) | `art.js headlightCone()` |
| `assets/effects/neon_glow.png` | 411×228 | Effect: glow around neon signs at night | Neon sign glow | `art.js neonGlowSprite()` |
| `assets/effects/puff_durian.png` | 139×139 | Effect: durian stink cloud | Green-yellow puff | `art.js puff()` |
| `assets/effects/puff_dust.png` | 139×139 | Effect: dust kicked up by scooters | Soft round puff (tinted per use) | `art.js puff()` |

**Not exported as separate files (drawn inline every frame, see `js/render.js`):** particles (dust, steam, sparks, stars, petals, confetti, frost, splashes, feathers), rain streaks, the durian cloud squiggles, PICK UP / DELIVER beacons and rings, the guide arrow, the player marker, the bánh bao BONUS zone, speech bubbles, the HUD meters and the order chip. They appear in `ui/screen_gameplay_hud.png`. The cutscene close-ups (Minh's shocked face, the tourist, Bà Lan) are vector drawings in `js/story.js`; see `backgrounds/story_shot_*.png`.

**Fonts** (SIL Open Font License; licence texts in `assets/fonts/OFL-*.txt`): Be Vietnam Pro 400/600/700/800 (UI text) and Baloo 2 700/800 (titles, logo, signs), each split into Latin, Latin Extended and Vietnamese subsets: `baloo-2-latin-700-normal.woff2`, `baloo-2-latin-800-normal.woff2`, `baloo-2-latin-ext-700-normal.woff2`, `baloo-2-latin-ext-800-normal.woff2`, `baloo-2-vietnamese-700-normal.woff2`, `baloo-2-vietnamese-800-normal.woff2`, `be-vietnam-pro-latin-400-normal.woff2`, `be-vietnam-pro-latin-600-normal.woff2`, `be-vietnam-pro-latin-700-normal.woff2`, `be-vietnam-pro-latin-800-normal.woff2`, `be-vietnam-pro-latin-ext-400-normal.woff2`, `be-vietnam-pro-latin-ext-600-normal.woff2`, `be-vietnam-pro-latin-ext-700-normal.woff2`, `be-vietnam-pro-latin-ext-800-normal.woff2`, `be-vietnam-pro-vietnamese-400-normal.woff2`, `be-vietnam-pro-vietnamese-600-normal.woff2`, `be-vietnam-pro-vietnamese-700-normal.woff2`, `be-vietnam-pro-vietnamese-800-normal.woff2`.

**Sounds:** `assets/audio/banhbao_call.mp3` (50 KB), `assets/audio/car_horn_1.mp3` (8 KB), `assets/audio/car_horn_2.mp3` (5 KB), `assets/audio/horn_1.mp3` (6 KB), `assets/audio/horn_2.mp3` (6 KB), `assets/audio/horn_3.mp3` (5 KB), `assets/audio/horn_4.mp3` (6 KB), `assets/audio/horn_5.mp3` (4 KB), `assets/audio/horn_6.mp3` (4 KB), `assets/audio/music_main.mp3` (2945 KB). `banhbao_call.mp3` is a copy of the clip embedded in `js/banhbao-clip.js` (the game plays the embedded copy). All other sound effects and the fallback music are synthesised with Web Audio in `js/audio.js`.

### 4. Screen size and sprite sheets

- **Canvas:** the game works in logical units. Screen height is always **540 units**; width is 540 × the screen's aspect ratio (e.g. **1168 × 540** on an 844 × 390 phone, **960 × 540** at 16:9). The canvas backing store is CSS pixels × devicePixelRatio, capped at **2** (1.25 in low-quality mode). Landscape only.
- **Screen bands (logical y):** sky and shop fronts 0–176 (shop fronts end at y = 176), far footpath 176–224, road 224–440, near footpath 440–540. Characters and vehicles scale with depth from 0.86× (far) to 1.06× (near), times 1.22.
- **Sprite sheets:** the game has none; animation is drawn procedurally from a walk phase. For reference the exporter builds two: `assets/characters/player_walk_carry_sheet.png` = 8 frames of **211×317 px**, left to right; `assets/characters/player_walk_sheet.png` = 8 frames of **211×317 px**, left to right. Person sprites are drawn in an 80 × 120-unit box with the feet at (40, 108); side-view scooters face right and are flipped for left-moving traffic.

### 5. Art style and what is placeholder

- **Gameplay style:** flat, rounded "sticker" cartoon. Simple shapes, no gradients on characters, a dark brown ink outline (`#24150f`, about 1.25 units) around every sprite, and a white sticker outline on the player. Warm Hanoi palette; three lighting presets (morning, golden hour, neon night) tint the scene. Shop signs use only the approved Vietnamese words with correct diacritics, set in Baloo 2.
- **Cutscene style:** black-and-white manga. Game art converted to ink plus halftone screentone, with courier green (`#00b14f`) as the only spot colour, plus hand-drawn vector close-ups, speed lines and sound-effect lettering.
- **Placeholder:** all visual art is programmer art drawn in code. It is consistent and shippable, but it was not drawn by an artist, so every PNG above is a candidate for replacement. `icons/app_icon_1024.png` is a placeholder made by the exporter (the game does not use it). There is no splash screen image yet. Faces are minimal (dot eyes); there are no hand-drawn animation frames.
- **Not placeholder:** the music (`music_main.mp3`, the author's own track) and the horn recordings (`horn_*`, `car_horn_*`) are real audio supplied by the author; the bánh bao call is the author's recording.

### Changes made for this package

No gameplay code was changed and no existing file was renamed.

| Old | New |
|---|---|
| CSS inline in `index.html` (`<style>` block) | `css/style.css` (same rules) |
| `@font-face` rules inline in `index.html`, pointing to missing `.ttf` files | `css/fonts.css`, pointing to the included `.woff2` files |
| `assets/fonts/PUT_FONT_FILES_HERE.txt` | removed (the real fonts are now included) |
| (none) | added `assets/characters/`, `assets/backgrounds/`, `assets/ui/`, `assets/icons/`, `assets/effects/`, `assets/asset-manifest.json`, `assets/audio/banhbao_call.mp3`, `tools/export-assets.js` |

To re-export after changing the art code: `npm install playwright` then `node tools/export-assets.js`.

---

## Story

Minh was the fastest CRAB delivery rider in Hanoi's Old Quarter (CRAB is the game's parody courier company: green jacket, green cap, green CRAB box), until a bald Russian tourist in a tank top snatched the key he'd left in his scooter and rode off on it. Now he delivers on foot, saving his tips for a new scooter. The goal is **1,500 coins** (`SCOOTER_PRICE` in `js/config.js`), shown as the **Scooter Fund** on the level screen. Riding the new scooter is planned as Chapter 2.

The opening cutscene (`js/story.js`) plays the first time you press PLAY, and again from the **STORY** button. It is drawn like an old black-and-white manga: the game's own street and characters are rendered once, then converted into ink and halftone screentone, with only Minh's courier green kept in colour. The close-ups, speed lines, focus lines and sound-effect lettering are drawn live. The story text is in `SS.STRINGS.story`. Tap to go to the next shot; SKIP ends it.

## How it plays

Each level is a **delivery shift**: 3, 4 or 5 orders, plus an **Endless Rush Hour** mode that unlocks after level 1.

1. **Pick up** each order at the blue **PICK UP** marker (pho, bánh mì, iced coffee and more).
2. **Deliver** it to the customer under the pink **DELIVER** marker, often on the other side of the road.
3. **Hot food cools and iced drinks melt** (the HEAT or ICE bar), and sudden moves spill it (the CONDITION bar).
4. Speed plus care earns **1 to 5 stars and a tip**. Four-star deliveries in a row build a **streak** bonus.
5. Coins earned in a shift are banked when the shift ends; restart or quit and that shift's coins are lost. Spend savings in the **upgrade shop**: sandals, padded box, insulated bag, big lungs, traffic whisperer, lucky charm.
6. Each dish delivered with 4 or more stars earns a stamp in the **Food Passport**. Complete all 8 for a bonus.
7. **Street events**: traffic lights at every intersection (cross while the main road is red) and sudden downpours that slow riders' reactions and cool food faster.

**Fake CRAB drivers** (white T-shirt, black jeans, flip-flops) offer you a ride. Buying one takes you straight to your next stop, but it's a scam: when you arrive you're charged the same price again and a **SCAMMED!** alert shows how much you lost.

Food, upgrade and level data are all in `js/config.js` (`SS.FOODS`, `SS.UPGRADES`, levels).

## Real sound files (recommended)

Recorded sound beats anything synthesised in code. Put MP3 files in `assets/audio/` with the names below, and the game uses them in place of the built-in sounds. Missing files are fine. Built-in synthesised music is **off** by default (Settings → Built-in music), so until you add music the street ambience is the soundtrack.

| File | What it is |
|---|---|
| `horn_1.mp3` … `horn_6.mp3` | Scooter horns. Short beeps, 0.1–0.5 s, trimmed tight. **Included** (from the developer's own recording). |
| `car_horn_1.mp3` … `car_horn_3.mp3` | Car horns. Two are **included**: lower-pitched versions of the scooter horns. |
| `music_main.mp3` | Main track, used everywhere unless a level has its own (loops). **Included.** |
| `music_menu.mp3` | Title and menus (loops) |
| `music_morning.mp3` | Level 1 (loops) |
| `music_market.mp3` | Level 2 and Endless (loops) |
| `music_night.mp3` | Level 3 (loops) |
| `street_ambience.mp3` | Hanoi street bed: engines, voices, distant horns (loops) |
| `rain.mp3` | Rain loop |

Where to get sounds you can legally sell in a paid app:

- **Pixabay** (pixabay.com/sound-effects and /music). The Pixabay Content License allows commercial use without attribution. Search "scooter horn", "motorbike horn", "Vietnam street", "Hanoi traffic", "rain".
- **Freesound** (freesound.org). Filter by licence **Creative Commons 0** only. There are field recordings of Hanoi and Saigon traffic.
- **Your own recordings.** A phone recording of real Hanoi traffic, horns and rain is the best option, and you own it outright.
- **A composer** (Fiverr, SoundBetter) for an original soundtrack with a đàn tranh or đàn bầu flavour, with full commercial rights.

Keep each licence (screenshot or download receipt) with your project files.

Note: the files load over HTTP, so they work in Capacitor and on a local server, but not when you open `index.html` straight from disk.

## 1. Run it locally

Browsers block some features on `file://`, so serve the folder over HTTP:

```bash
cd street-smart
python3 -m http.server 8080        # or: npx http-server -p 8080
```

Then open <http://localhost:8080> and make the window wider than it is tall.

To test on your phone, open `http://<your-computer-ip>:8080` while both devices are on the same Wi-Fi.

**Desktop controls:** WASD or the arrow keys to walk, Shift to sprint, Space to hold your breath, E to say "No thanks" (hold E to buy), Esc or P to pause.

**Mobile controls:** touch and drag anywhere on the left half of the screen to walk (an invisible joystick). On the right are SPRINT, HOLD BREATH, NO THANKS and BUY.

---

## 2. Fonts (included)

The game uses two free fonts under the SIL Open Font License, already in `assets/fonts/` as `.woff2` files, with their licence texts (`OFL-BeVietnamPro.txt`, `OFL-Baloo2.txt`) which must ship with them. `css/fonts.css` loads them, split by script so only the needed parts download. If a font file is ever missing, the game falls back to `system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif`, all of which render Vietnamese diacritics.

---

## 3. Wrap it with Capacitor (iOS + Android)

You need Node.js 18+, Xcode (for iOS, on a Mac) and Android Studio (for Android).

```bash
# 1. create a wrapper project next to this folder
mkdir street-smart-app && cd street-smart-app
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 2. copy the game in as the web directory
mkdir www && cp -R ../street-smart/* www/

# 3. initialise Capacitor (use your own reverse-domain app id)
npx cap init "Street Smart" com.yourstudio.streetsmart --web-dir=www

# 4. add the platforms
npx cap add ios
npx cap add android

# 5. copy web files into the native projects (re-run after every game change)
npx cap sync

# 6. open the native IDEs, then build / run on a device
npx cap open ios
npx cap open android
```

Recommended `capacitor.config.json` additions:

```json
{
  "appId": "com.yourstudio.streetsmart",
  "appName": "Street Smart",
  "webDir": "www",
  "backgroundColor": "#0b0a12",
  "ios": { "contentInset": "never" },
  "android": { "backgroundColor": "#0b0a12" }
}
```

### Lock to landscape

- **iOS:** in Xcode, select the target, then *General → Deployment Info*. Untick Portrait and Upside Down, and keep Landscape Left and Landscape Right. Also tick **Requires full screen** and set *Status Bar Style → Hide during application launch*. To hide the status bar, add `UIStatusBarHidden = YES` and `UIViewControllerBasedStatusBarAppearance = NO` to `Info.plist`.
- **Android:** in `android/app/src/main/AndroidManifest.xml`, add `android:screenOrientation="sensorLandscape"` to the `<activity>` tag. For immersive full screen, add `@capacitor/status-bar` and hide it on start, or use a fullscreen theme.

The game also shows its own "rotate your device" screen if it is ever shown in portrait.

### Full screen on phones

The game has to fill the whole phone screen, with no status bar and no navigation bar.

1. Install the status-bar plugin. The game hides the bar itself on start-up (`SS.Fullscreen.nativeSetup()` in `js/main.js`):
   ```bash
   npm install @capacitor/status-bar
   npx cap sync
   ```
2. **Android:** to hide the navigation bar too ("immersive" mode), paste this into `android/app/src/main/java/.../MainActivity.java`:
   ```java
   import android.os.Bundle;
   import androidx.core.view.WindowCompat;
   import androidx.core.view.WindowInsetsCompat;
   import androidx.core.view.WindowInsetsControllerCompat;
   import com.getcapacitor.BridgeActivity;

   public class MainActivity extends BridgeActivity {
     @Override public void onWindowFocusChanged(boolean hasFocus) {
       super.onWindowFocusChanged(hasFocus);
       if (hasFocus) {
         WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
         WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
         c.hide(WindowInsetsCompat.Type.systemBars());
         c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
       }
     }
   }
   ```
   Also add `android:windowLayoutInDisplayCutoutMode` set to `shortEdges` to the app theme in `res/values/styles.xml`, so the game draws under the camera notch. The game already keeps its buttons inside the safe areas.
3. **iOS:** use the Info.plist keys listed above (`UIStatusBarHidden`, `UIViewControllerBasedStatusBarAppearance = NO`) and tick **Requires full screen**. The home indicator auto-hides while you play.

**In a mobile browser** (for testing): the game goes full screen on the first tap and locks to landscape where the browser allows it. There's also a FULL SCREEN button on the title screen and a toggle in Settings. iPhone Safari has no full-screen feature for web pages, so on iPhone the title screen shows a tip instead: tap Share, then *Add to Home Screen*. Opened from the home screen, the game runs full screen (`manifest.webmanifest` and the `apple-mobile-web-app-*` tags handle this).

### Optional native upgrades (one-line swaps)

- **Haptics:** `SS.Haptics.vibrate()` in `js/save.js` is the only place vibration happens. Replace its body with `@capacitor/haptics` calls (`Haptics.impact(...)`) for proper iOS haptics. iOS Safari/WKWebView has no `navigator.vibrate`.
- **Storage:** `SS.Save.readRaw()` and `writeRaw()` in `js/save.js` are the only persistence calls. Swap them for `@capacitor/preferences` if you want storage the OS won't clear. localStorage in a Capacitor WebView already persists between launches.
- **Background:** the game auto-pauses and suspends audio on `visibilitychange` and `pagehide`, which Capacitor fires when the app is backgrounded.

---

## 4. Configuration you'll want to know about

All in **`js/config.js`**:

- `SS.CONFIG.TITLE`: the game's name, used everywhere, including the loading screen and the browser tab.
- `SS.CONFIG.IAP_ENABLED`: **false by default**, so it ships as a paid app with everything unlocked. Set it to `true` to lock levels marked `requiresFullGame: true` (levels 2 and 3) behind an "Unlock full game" in-app purchase. Then implement `SS.Purchases.unlockFullGame()` and `restorePurchases()` in `js/save.js`, for example with RevenueCat or cordova-plugin-purchase. Apple requires a "Restore purchases" button if you go this route.
- `SS.STRINGS`: every UI string, in one object, for future translation.
- `SS.WORLDS`: worlds and levels as data. To add India, China or Australia, add a world entry (sign words, shop types, palette, levels) and its id to `SS.WORLD_ORDER`. The level select currently shows the first world. Adding a world picker is a small UI addition in `ui.js`.
- Level tuning per level: `length`, `density` (traffic), `speedMul`, `wildRiders` (share of phone-distracted riders), `intersections` (x positions), durian, seller and bánh bao frequency, and star thresholds.

### Text & signage rules (already enforced)

- All text is real font text drawn with `fillText`. Nothing is drawn as letter-shaped squiggles.
- Shop signs use only: PHỞ BÒ, CÀ PHÊ, BÁNH MÌ, BÚN CHẢ, BÁNH BAO, CƠM TẤM, TRÀ ĐÁ, NƯỚC MÍA, SẦU RIÊNG, TẠP HÓA, HỚT TÓC, BIA HƠI. A sign that wouldn't be legible becomes a plain pictogram (bowl, cup, …) instead.
- The durian stalls say SẦU RIÊNG, and the bánh bao bike's silver boxes say BÁNH BAO.

---

## 5. How the flow mechanic works (for tuning)

Every rider keeps their own estimate of your velocity. How fast and how accurately that estimate updates depends on your **Confidence**. Riders predict where you'll be when their front wheel reaches your line, and steer to pass **behind** you. If there's no room behind you (for example, you've just stepped off the kerb), they go round the front or brake smoothly. At high confidence they will always emergency-stop rather than hit you head-on.

Walking at a calm, steady pace builds confidence. Stopping, reversing, zig-zagging, sprinting, or loitering in the middle of the road for too long drains it. At low confidence riders notice you late, mis-predict you, panic, swerve and crash into each other.

The phone-distracted riders (a blue glow by their face) read you badly whatever your confidence, and they honk when they finally see you. The bánh bao guy is too busy shouting to read anyone.

All of this lives in `updateScooters()` and `updateConfidence()` in `js/game.js`.

---

## 6. Before you submit: checklist

**Must do**
- [ ] **Audio rights for the bánh bao call.** `js/banhbao-clip.js` contains the audio track from the video you supplied. That video looks like a screen recording of a YouTube Short. Before selling the game, make sure you have permission to use that recording commercially, or replace it with your own recording. To replace it: `ffmpeg -i mycall.wav -ac 1 -ar 22050 -b:a 48k call.mp3`, base64-encode the MP3, and paste it into `SS.BANHBAO_CLIP`. If the clip ever fails to decode, the game falls back to a synthesised megaphone chant automatically.
- [x] Fonts and their OFL licence texts are included (section 2).
- [ ] Choose the final title (`SS.CONFIG.TITLE`), bundle id and version.
- [ ] **App icon:** a 1024×1024 PNG with no transparency (required for iOS). A placeholder is in `assets/icons/app_icon_1024.png`. Generate every size with `npx @capacitor/assets generate` from `assets/icon.png` in the Capacitor project.
- [ ] **Splash screen:** a 2732×2732 PNG with the artwork centred, and a dark background matching `#0b0a12`. The same `@capacitor/assets` tool generates it from `assets/splash.png`.
- [ ] **Store screenshots** (landscape):
  - iPhone 6.9" (2868×1320 or 2796×1290) and 6.5" (2778×1284)
  - iPad 13" (2752×2064 or 2732×2048), if you support iPad
  - Google Play: at least 2 phone screenshots (16:9, e.g. 1920×1080), a 7" and 10" tablet set if you target tablets, plus a 1024×500 feature graphic
  - Tip: open the game in desktop Chrome, use DevTools device mode at those resolutions, and use "Capture screenshot".
- [ ] **Privacy:** the game collects no data. In App Store Connect choose "Data Not Collected", and in Play Console's Data safety form declare no data collected or shared. You still need a privacy-policy URL. A one-paragraph page saying the game collects no data is enough.
- [ ] **Age ratings:** complete the questionnaires (cartoon slapstick; no violence beyond comic tumbles).
- [ ] Test on a real low/mid-range Android phone and an older iPhone. The game drops to low-quality mode by itself if the frame rate falls, and players can force High or Low in Settings.

**Nice to have**
- [ ] Swap `SS.Haptics.vibrate` to `@capacitor/haptics` (iOS has no web vibration).
- [ ] Add a "Restore purchases" button if you turn `IAP_ENABLED` on.
- [ ] Localise `SS.STRINGS` (Vietnamese would be a lovely touch).

---

## 7. Credits & licences

- Code, art, music and sound effects are generated procedurally in this project.
- Fonts: Be Vietnam Pro and Baloo 2, SIL Open Font License 1.1.
- Bánh bao call: supplied by the developer (see the checklist about rights).
