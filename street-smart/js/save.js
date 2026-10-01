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
    settings: { music: 0.45, sfx: 0.9, vibration: true, graphics: 'auto', controls: 'dpad' },
    howtoSeen: false,
  });

  const Save = (SS.Save = {
    data: DEFAULTS(),

    readRaw() {
      try { return window.localStorage.getItem(SS.CONFIG.SAVE_KEY); } catch (e) { return null; }
    },
    writeRaw(str) {
      try { window.localStorage.setItem(SS.CONFIG.SAVE_KEY, str); return true; } catch (e) { return false; }
    },

    load() {
      const d = DEFAULTS();
      const raw = this.readRaw();
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p && typeof p === 'object') {
            d.coins = Math.max(0, p.coins | 0);
            d.levels = p.levels && typeof p.levels === 'object' ? p.levels : {};
            d.fullGame = !!p.fullGame;
            d.tutorialDone = !!p.tutorialDone;
            d.howtoSeen = !!p.howtoSeen;
            if (p.settings) Object.assign(d.settings, p.settings);
          }
        } catch (e) { /* corrupt save: start fresh */ }
      }
      this.data = d;
      return d;
    },

    save() { this.writeRaw(JSON.stringify(this.data)); },

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
      const keepPurchase = this.data.fullGame; // never wipe a purchase
      this.data = DEFAULTS();
      this.data.settings = keepSettings;
      this.data.fullGame = keepPurchase;
      this.save();
    },

    // levels unlock in order across a world
    isUnlocked(world, index) {
      if (index === 0) return true;
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
