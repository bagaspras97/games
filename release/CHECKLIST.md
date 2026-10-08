# Release checklist — CrazyGames first

Sources: [CrazyGames requirements](https://docs.crazygames.com/requirements/intro/) · [Technical](https://docs.crazygames.com/requirements/technical) · [Game covers](https://docs.crazygames.com/requirements/game-covers/) · [SDK game module](https://docs.crazygames.com/sdk/html5-v3/game/)

CrazyGames releases in two stages: **Basic Launch** (~2 weeks with a limited audience, SDK optional, no monetization) → if the numbers are good, **Full Launch** (SDK required, ads + revenue share).

## 1. Build

```bash
python3 tools/build.py crazygames      # -> release/puffy-crazygames.zip (~76 KB)
```

The zip already contains `window.PUFFY_PLATFORM = "crazygames"`, so it loads the CrazyGames SDK v3 without URL parameters. Upload the zip as an HTML5 game.

## 2. Already done & verified in this repo ✅

| Requirement | Status |
|---|---|
| Initial download ≤ 50 MB (total ≤ 250 MB) | ✅ ~76 KB zipped, ~240 KB unzipped |
| Covers 1920×1080, 800×1200, 800×800 — no border, only the title as text | ✅ `release/covers/` |
| `loadingStart` → `loadingStop` around boot | ✅ (mock-SDK test) |
| `gameplayStart` on start / resume / revive / next level; `gameplayStop` on pause, menus, game over, level end | ✅ |
| **No** `gameplayStop` when the tab loses focus (CrazyGames handles it) | ✅ auto-pause sends nothing |
| Ads only through the SDK (`midgame`, `rewarded`), game audio muted during ads | ✅ |
| Respect `muteAudio` setting + its change listener | ✅ |
| Progress saved via the SDK data module (`SDK.data`) | ✅ (settings & language use localStorage — small UI prefs) |
| Interstitials not too frequent | ✅ every 3 runs, ≥ 60 s apart |
| Works on desktop and mobile (landscape), pause on tab switch, rotate-phone screen | ✅ |
| English text | ✅ (+ Indonesian) |
| Dev URL cheats disabled on real domains | ✅ |

## 3. Still to do by hand ⏳

1. **Create a CrazyGames developer account** and start a new game submission.
2. **Test on the CrazyGames QA tool / preview** before submitting (real SDK, real ads) — check: ads play and resume the game, rewarded ad gives the reward, sound stays muted during ads.
3. **Play on at least one real Android phone and one iPhone** (Safari) — touch, sound unlock, performance, rotate screen.
4. **Proof-read the English** in `src/i18n.js` and `release/STORE_LISTING.md` (ideally by a native speaker).
5. Fill the form with `release/STORE_LISTING.md` (title, description, controls, tags) and upload the 3 covers.
6. After Basic Launch: read the stats (playtime, retention) and tune prices (`src/characters.js`), difficulty (`src/levels.js`, `src/world.js`) and ad frequency (`INTERSTITIAL_EVERY` in `src/game.js`).

## 4. Other portals (later)

```bash
python3 tools/build.py poki        # Poki (requires Poki SDK; Poki reviews & invites)
python3 tools/build.py youtube     # YouTube Playables (no in-game purchases; ads only via SDK)
python3 tools/build.py facebook    # Facebook Instant Games (set FB placement IDs in src/sdk/adapter.js + fbapp-config.json)
```
