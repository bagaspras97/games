import { t } from "../i18n.js";
// Platform SDK adapter.
// The game only talks to this interface; each platform gets its own implementation:
//   init(onProgress)       -> Promise, load + initialise the SDK
//   loadingFinished()      -> game assets ready
//   gameplayStart()/Stop() -> signal active play (required by Poki & CrazyGames)
//   interstitial()         -> Promise<void>, show a mid-game ad (game must be paused)
//   rewarded()             -> Promise<boolean>, true if the player earned the reward
//   save(obj)/load()       -> persist small progress data
//
// Platform is chosen with ?platform=poki|crazygames|youtube|facebook|local
// (default: local, which shows a fake ad overlay for testing).

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

const localStore = {
  save(data) {
    try { localStorage.setItem("hop_save", JSON.stringify(data)); } catch (e) {}
    return Promise.resolve();
  },
  load() {
    try { return Promise.resolve(JSON.parse(localStorage.getItem("hop_save")) || {}); }
    catch (e) { return Promise.resolve({}); }
  },
};

// ---------- Local / development ----------
function fakeAd(label, seconds) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "fake-ad";
    el.innerHTML = `<div><b>${label}</b><br>${t("fakeAd")} <span>${seconds}</span>s<br><button>${t("skip")}</button></div>`;
    document.body.appendChild(el);
    let left = seconds;
    const finish = (completed) => { clearInterval(t); el.remove(); resolve(completed); };
    const t = setInterval(() => {
      left--;
      el.querySelector("span").textContent = left;
      if (left <= 0) finish(true);
    }, 1000);
    el.querySelector("button").onclick = () => finish(false);
  });
}

const local = {
  name: "local",
  async init(onProgress) { onProgress && onProgress(1); },
  loadingFinished() {},
  gameplayStart() {},
  gameplayStop() {},
  async interstitial() { await fakeAd("Interstitial", 2); },
  rewarded() { return fakeAd("Rewarded", 3); },
  ...localStore,
};

// ---------- Poki ----------  https://sdk.poki.com/
const poki = {
  name: "poki",
  async init() {
    await loadScript("https://game-cdn.poki.com/scripts/v2/poki-sdk.js");
    await window.PokiSDK.init().catch(() => {}); // adblock still lets the game run
  },
  loadingFinished() { window.PokiSDK.gameLoadingFinished(); },
  gameplayStart() { window.PokiSDK.gameplayStart(); },
  gameplayStop() { window.PokiSDK.gameplayStop(); },
  interstitial() { return window.PokiSDK.commercialBreak(); },
  rewarded() { return window.PokiSDK.rewardedBreak(); },
  ...localStore,
};

// ---------- CrazyGames (SDK v3) ----------  https://docs.crazygames.com/
const crazygames = {
  name: "crazygames",
  async init() {
    await loadScript("https://sdk.crazygames.com/crazygames-sdk-v3.js");
    await window.CrazyGames.SDK.init();
    window.CrazyGames.SDK.game.loadingStart();
  },
  loadingFinished() { window.CrazyGames.SDK.game.loadingStop(); },
  gameplayStart() { window.CrazyGames.SDK.game.gameplayStart(); },
  gameplayStop() { window.CrazyGames.SDK.game.gameplayStop(); },
  _ad(type) {
    return new Promise((resolve) => {
      window.CrazyGames.SDK.ad.requestAd(type, {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    });
  },
  async interstitial() { await this._ad("midgame"); },
  rewarded() { return this._ad("rewarded"); },
  save(data) {
    window.CrazyGames.SDK.data.setItem("hop_save", JSON.stringify(data));
    return Promise.resolve();
  },
  load() {
    try { return Promise.resolve(JSON.parse(window.CrazyGames.SDK.data.getItem("hop_save")) || {}); }
    catch (e) { return Promise.resolve({}); }
  },
};

// ---------- YouTube Playables ----------  https://developers.google.com/youtube/gaming/playables
// Note: Playables must not use any other ad network and must not offer purchases.
const youtube = {
  name: "youtube",
  async init() {
    await loadScript("https://www.youtube.com/game_api/v1");
    window.ytgame.game.firstFrameReady();
  },
  loadingFinished() { window.ytgame.game.gameReady(); },
  gameplayStart() {},
  gameplayStop() {},
  async interstitial() { try { await window.ytgame.ads.requestInterstitialAd(); } catch (e) {} },
  async rewarded() {
    try { return !!(await window.ytgame.ads.requestRewardedAd("continue")); }
    catch (e) { return false; }
  },
  save(data) { return window.ytgame.game.saveData(JSON.stringify(data)); },
  async load() {
    try { return JSON.parse(await window.ytgame.game.loadData()) || {}; }
    catch (e) { return {}; }
  },
};

// ---------- Facebook Instant Games ----------  https://developers.facebook.com/docs/games
// Replace the placement IDs with the ones from your Audience Network dashboard.
const FB_INTERSTITIAL_ID = "YOUR_INTERSTITIAL_PLACEMENT_ID";
const FB_REWARDED_ID = "YOUR_REWARDED_PLACEMENT_ID";
const facebook = {
  name: "facebook",
  async init(onProgress) {
    await loadScript("https://connect.facebook.net/en_US/fbinstant.7.1.js");
    await window.FBInstant.initializeAsync();
    this._progress = (p) => window.FBInstant.setLoadingProgress(Math.round(p * 100));
    onProgress && this._progress(1);
  },
  loadingFinished() { window.FBInstant.startGameAsync(); },
  gameplayStart() {},
  gameplayStop() {},
  async interstitial() {
    try {
      const ad = await window.FBInstant.getInterstitialAdAsync(FB_INTERSTITIAL_ID);
      await ad.loadAsync();
      await ad.showAsync();
    } catch (e) {}
  },
  async rewarded() {
    try {
      const ad = await window.FBInstant.getRewardedVideoAsync(FB_REWARDED_ID);
      await ad.loadAsync();
      await ad.showAsync();
      return true;
    } catch (e) { return false; }
  },
  save(data) { return window.FBInstant.player.setDataAsync({ save: data }); },
  async load() {
    try { return (await window.FBInstant.player.getDataAsync(["save"])).save || {}; }
    catch (e) { return {}; }
  },
};

const adapters = { local, poki, crazygames, youtube, facebook };

export async function createPlatform() {
  const requested = new URLSearchParams(location.search).get("platform") || "local";
  const adapter = adapters[requested] || local;
  try {
    await adapter.init();
    return adapter;
  } catch (e) {
    console.warn(`[sdk] ${adapter.name} failed, falling back to local:`, e);
    return local;
  }
}
