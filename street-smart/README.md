# STREET SMART — Hanoi

*"Frogger taught you to dodge. This teaches you to flow."*

A 2.5D belt-scroller about crossing Vietnamese traffic the way locals do: slowly and steadily, so the riders can read you and flow around you. It's built with HTML5 Canvas and plain JavaScript. There are no frameworks, no CDNs and no network requests, and it runs 100% offline.

This folder is the web project. Drop it into Capacitor's web directory to build the iOS and Android apps.

```
street-smart/
├── index.html            the game shell (loading screen, rotate screen, @font-face)
├── assets/fonts/         put the font files here (see "Fonts")
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
    ├── ui.js             menus & screens
    └── main.js           boot, responsive hi-DPI canvas, safe areas, game loop, auto low-quality
```

---

## 1. Run it locally

Browsers block some features on `file://`, so serve the folder over HTTP:

```bash
cd street-smart
python3 -m http.server 8080        # or: npx http-server -p 8080
```

Then open <http://localhost:8080> and make the window wider than it is tall.

To test on your phone, open `http://<your-computer-ip>:8080` while both devices are on the same Wi-Fi.

**Desktop controls:** WASD or the arrow keys to walk, Shift to sprint, Space to hold your breath, E to say "No thanks" (hold E to buy), Esc or P to pause.

**Mobile controls:** a compact arrow pad in the bottom-left corner (or a floating joystick that only appears where you touch; switch in Settings → Touch controls). On the right are SPRINT, HOLD BREATH, NO THANKS and BUY.

---

## 2. Fonts (add these before release)

The game uses two free fonts under the SIL Open Font License. Download them and copy **exactly these filenames** into `assets/fonts/`:

| File | Family / weight | Download |
|---|---|---|
| `BeVietnamPro-Regular.ttf` | Be Vietnam Pro 400 | https://fonts.google.com/specimen/Be+Vietnam+Pro |
| `BeVietnamPro-SemiBold.ttf` | Be Vietnam Pro 600 | (same zip) |
| `BeVietnamPro-Bold.ttf` | Be Vietnam Pro 700 | (same zip) |
| `BeVietnamPro-ExtraBold.ttf` | Be Vietnam Pro 800 | (same zip) |
| `Baloo2-Bold.ttf` | Baloo 2 700 | https://fonts.google.com/specimen/Baloo+2 (inside the zip's `static/` folder) |
| `Baloo2-ExtraBold.ttf` | Baloo 2 800 | (same zip, `static/` folder) |

Also put each family's `OFL.txt` in the same folder. The licence requires you to ship it with the fonts.

Until the files are added, the game falls back to `system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif`. All of these render Vietnamese diacritics, so the game is fully playable without the font files. It just looks less branded. The six 404s you'll see in the browser console are these missing font files.

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
- [ ] Add the six font files and their `OFL.txt` (section 2).
- [ ] Choose the final title (`SS.CONFIG.TITLE`), bundle id and version.
- [ ] **App icon:** a 1024×1024 PNG with no transparency (required for iOS). Generate every size with `npx @capacitor/assets generate` from `assets/icon.png` in the Capacitor project.
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
