/* =====================================================================
 * Save / load, purchases hook and haptics.
 * ---------------------------------------------------------------------
 * ALL persistence goes through SS.Save. It uses localStorage today
 * (wrapped in try/catch). To move to native storage later (e.g.
 * @capacitor/preferences), only change readRaw() / writeRaw().
 * ===================================================================== */
(function () {
  'use strict';
  const SS = window.SS;

  const DEFAULTS = () => ({
    version: 1,
    coins: 0,
    levels: {},            // levelId -> { stars, best, completed }
    fullGame: false,       // set by the in-app purchase hook
    tutorialDone: false,
    settings: { music: 0.45, sfx: 0.9, vibration: true, graphics: 'auto', synthMusic: false, zoom: true },
    howtoSeen: false,
    storySeen: false,     // opening cutscene watched
    upgrades: {},          // upgradeId -> level
    stamps: {},            // foodId -> true (food passport)
    passportDone: false,
    endlessBest: 0,
  });

  // progress (coins, levels, upgrades...) lives only in this play-through until the
  // player presses SAVE GAME; settings and "seen" flags are always kept.
  const PROGRESS = ['coins', 'levels', 'fullGame', 'upgrades', 'stamps', 'passportDone', 'endlessBest'];
  const clean = (p) => {
    const d = DEFAULTS();
    if (!p || typeof p !== 'object') return d;
    d.coins = Math.max(0, p.coins | 0);
    d.levels = p.levels && typeof p.levels === 'object' ? p.levels : {};
    d.fullGame = !!p.fullGame;
    d.upgrades = p.upgrades && typeof p.upgrades === 'object' ? p.upgrades : {};
    d.stamps = p.stamps && typeof p.stamps === 'object' ? p.stamps : {};
    d.passportDone = !!p.passportDone;
    d.endlessBest = Math.max(0, p.endlessBest | 0);
    return d;
  };

  const Save = (SS.Save = {
    data: DEFAULTS(),
    slot: null,           // the saved game (null = none)

    readRaw() {
      try { return window.localStorage.getItem(SS.CONFIG.SAVE_KEY); } catch (e) { return null; }
    },
    writeRaw(str) {
      try { window.localStorage.setItem(SS.CONFIG.SAVE_KEY, str); return true; } catch (e) { return false; }
    },

    // on start-up: settings and flags only. Progress starts at zero (NEW GAME).
    load() {
      const d = DEFAULTS();
      let slot = null;
      const raw = this.readRaw();
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p === 'object') {
            d.tutorialDone = !!p.tutorialDone;
            d.howtoSeen = !!p.howtoSeen;
            d.storySeen = !!p.storySeen;
            if (p.settings) Object.assign(d.settings, p.settings);
            if (p.slot) slot = clean(p.slot);
            else if (p.version === 1 && (p.coins || (p.levels && Object.keys(p.levels).length))) slot = clean(p); // older saves
            if (p.fullGame) d.fullGame = true; // a purchase is never lost
          }
        } catch (e) { /* corrupt save: start fresh */ }
      }
      this.data = d;
      this.slot = slot;
      return d;
    },
    hasSave() { return !!this.slot; },
    // SAVE GAME: copy this play-through's progress into the save slot
    saveGame() {
      const s = {};
      for (const k of PROGRESS) s[k] = JSON.parse(JSON.stringify(this.data[k]));
      s.savedAt = Date.now();
      this.slot = s;
      this.save();
      return true;
    },
    // CONTINUE: load the saved progress
    continueGame() {
      if (!this.slot) return false;
      const c = clean(this.slot);
      for (const k of PROGRESS) this.data[k] = c[k];
      if (this.slot.fullGame) this.data.fullGame = true;
      return true;
    },
    // NEW GAME: progress back to zero (the save slot is kept until you save over it)
    newGame() {
      const d = DEFAULTS();
      const buy = this.data.fullGame;
      for (const k of PROGRESS) this.data[k] = d[k];
      this.data.fullGame = buy;
    },

    // writes settings, flags and the save slot (never the unsaved progress)
    save() {
      const d = this.data;
      this.writeRaw(JSON.stringify({ version: 2, settings: d.settings, tutorialDone: d.tutorialDone, howtoSeen: d.howtoSeen, storySeen: d.storySeen,
        fullGame: d.fullGame || (this.slot && this.slot.fullGame), slot: this.slot }));
    },

    level(id) { return this.data.levels[id] || { stars: 0, best: 0, completed: false }; },

    recordResult(id, stars, score) {
      const cur = this.level(id);
      const isBest = score > (cur.best || 0);
      this.data.levels[id] = {
        stars: Math.max(cur.stars || 0, stars),
        best: Math.max(cur.best || 0, score),
        completed: true,
      };
      this.save();
      return isBest;
    },

    addCoins(n) { this.data.coins = Math.max(0, this.data.coins + n); this.save(); },

    setSetting(key, value) { this.data.settings[key] = value; this.save(); },

    reset() {
      const keepSettings = this.data.settings;
      const keepPurchase = this.data.fullGame || (this.slot && this.slot.fullGame); // never wipe a purchase
      this.data = DEFAULTS();
      this.data.settings = keepSettings;
      this.data.fullGame = !!keepPurchase;
      this.slot = null;
      this.save();
    },

    // levels unlock in order across a world
    up(id) { return this.data.upgrades[id] | 0; },

    isUnlocked(world, index) {
      if (index === 0) return true;
      const lv = world.levels[index];
      if (lv.unlockAfter) return !!this.level(lv.unlockAfter).completed;
      const prev = world.levels[index - 1];
      return !!this.level(prev.id).completed;
    },
  });

  /* ---------------- In-app purchase hook (OFF by default) ----------------
   * When SS.CONFIG.IAP_ENABLED is false the full game is always unlocked.
   * To sell a free + "unlock full game" version later:
   *  1. set IAP_ENABLED: true in config.js
   *  2. implement unlockFullGame() with your store plugin (e.g. RevenueCat
   *     or cordova-plugin-purchase) and call done(true) on success
   *  3. implement restorePurchases() the same way (required by Apple)
   * --------------------------------------------------------------------- */
  SS.Purchases = {
    isFullGameUnlocked() {
      return !SS.CONFIG.IAP_ENABLED || !!Save.data.fullGame;
    },
    // TODO(IAP): hook up the native purchase flow here.
    unlockFullGame(done) {
      // Intentionally empty. Example once wired:
      //   Store.purchase('full_game').then(() => { Save.data.fullGame = true; Save.save(); done(true); })
      if (done) done(false);
    },
    // TODO(IAP): restore previous purchases here.
    restorePurchases(done) { if (done) done(false); },
  };

  /* ---------------- Haptics ----------------
   * One function so it can later call @capacitor/haptics instead. */
  SS.Haptics = {
    vibrate(pattern) {
      if (!Save.data.settings.vibration) return;
      try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
    },
  };
})();
