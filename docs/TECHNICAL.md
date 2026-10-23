# Technical Guide

How *Puffy: Deep Sea Adventure* is built, how to run and test it, and how to extend it. For what the game *is* (modes, characters, economy), see the [Game Design Document](GAME_DESIGN.md).

## 1. Overview

| | |
|---|---|
| Language | Vanilla JavaScript, ES modules (`<script type="module">`), no framework, no bundler |
| Rendering | HTML5 Canvas 2D, logical resolution 1280×720 (16:9), scaled to the window; UI panels are HTML/CSS on top |
| Audio | Web Audio API, all sounds and music synthesised at runtime |
| Assets | None. Characters, creatures, terrain, decoration and covers are drawn in code |
| Size | ~80 KB zipped (`release/puffy-*.zip`) |
| Storage | `localStorage`, or the portal's cloud save through the SDK adapter |
| Browsers | Current Chrome, Edge, Firefox and Safari (desktop and mobile) |

## 2. Running locally

ES modules do not load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://localhost:8000          (local adapter: simulated ads)
```

### Developer URL parameters (localhost only)

| Parameter | Effect |
|---|---|
| `?platform=local\|crazygames\|poki\|youtube\|facebook` | Choose the SDK adapter (works everywhere) |
| `?start=1000` | Start Free Dive at 1000 m |
| `?hazard=jelly` | Spawn only this hazard (`urchin`, `coral`, `icicle`, `jelly`, `hook`, `sword`, `net`, `bag`) |
| `?finish=25` | Every Adventure level is 25 m long |
| `?moment=humpback` | Trigger a rare moment soon |
| `?debug` | Exposes `window.__dbg()` (state, player, world, `gameOver`, `levelComplete`, `save`, `unlockSecret`) for tests |

These are read through `src/dev.js` and ignored on any host other than `localhost`, `127.0.0.1` or a `file` origin, so players cannot cheat on a portal.

## 3. File map

```
index.html            All HTML panels and all CSS (design system tokens at the top)
src/game.js           Entry point: boot, game loop, state machine, input, UI wiring, ads, saving
src/world.js          World model: terrain segments, trenches, hazards, pickups, zones, seeded RNG,
                      collision helpers and all world rendering
src/characters.js     The 7 playable characters: physics parameters, abilities, skills, drawing
src/creatures.js      The 8 encyclopedia creatures: facts and animated drawing
src/levels.js         The 20 Adventure levels (seed, length, difficulty), star rules and rewards
src/bosses.js         The 4 bosses: attack timing, lanes, collision and drawing
src/missions.js       Daily mission pool, per-day selection, progress tracking, streak
src/moments.js        Rare background events (whales, dolphins, …)
src/deaths.js         Hazard-specific defeat animations and captions
src/decor.js          Seabed / ceiling decoration (kelp, coral, anemones, …)
src/ambient.js        Background fish on parallax layers
src/particles.js      Bubbles, sparkles, bursts, floating text
src/audio.js          Synthesised sound effects and music, mute handling
src/settings.js       Player settings (music, sfx, vibration, graphics)
src/i18n.js           All UI strings: t(key, vars) and data-i18n binding
src/dev.js            Localhost-only developer parameters
src/sdk/adapter.js    Platform SDK adapters (local, CrazyGames, Poki, YouTube, Facebook)
tools/build.py        Builds release/puffy-<platform>.zip
tools/covers.html     Renders store covers and icon from the game's own art
tools/tests/*.mjs     Playwright regression tests
release/              Zips, covers, store listing, release checklist
docs/                 This documentation and screenshots
```

## 4. Runtime architecture

### 4.1 Boot

`game.js` calls `boot()`:

1. UI strings are applied (`applyStatic()`) and the canvas is sized to the window.
2. `createPlatform()` picks and initialises the SDK adapter (§6). If the SDK fails to load, it falls back to the local adapter so the game still runs.
3. The save is loaded through the adapter and sanitised (old `coins` saves migrated to pearls, unknown characters removed, Bubu only if the encyclopedia is complete, today's missions ensured).
4. Settings and the graphics mode are applied and input handlers are wired.
5. `platform.loadingFinished()` is called and the `requestAnimationFrame` loop starts.

### 4.2 Game loop

`loop(now)` runs every frame:

- `dt` is the frame time, **clamped to 33 ms** so a stalled tab never makes objects jump through each other.
- Depending on `state` it updates the dive (`update(dt)`), the defeat animation, or the idle animation behind menus.
- It then draws the world in layers, roughly: background and light rays → ambient fish and rare moment → terrain and decoration → finish line → pickups → hazards → boss → player and effects → particles → darkness overlay (deep zones) → shake.
- Panel canvases (menu logo, character previews, encyclopedia creatures, dazed character on Game Over) are redrawn only while their panel is visible.

### 4.3 State machine

A single `state` string drives the game:

| State | Meaning |
|---|---|
| `menu` | Main menu, idle animation behind it |
| `play` | Dive in progress |
| `paused` | Pause panel (manual or tab hidden) |
| `swap` | Character swap panel (dive paused) |
| `dying` | Defeat animation playing |
| `over` | Game Over panel |
| `done` | Level complete panel |
| `ad` | An ad is playing (game audio muted) |
| `shop`, `dex`, `missions`, `levels`, `finale` | Full-screen panels |

Panels are opened with `openPanel(panel, from, render)` and closed with `closePanel()`, which returns to the screen they came from. `quitToMenu()` ends a dive from Pause or Game Over.

### 4.4 Player physics

Each character has a movement `mode` (`src/characters.js`):

| Mode | Characters | Behaviour |
|---|---|---|
| `toggle` | Puffy, Kudi, Okto, Lumi, Bubu | A tap flips buoyancy; the character accelerates by `g` up to `max` px/s toward the ceiling or floor |
| `pulse` | Jeli | A tap adds an upward `impulse`; gravity pulls down otherwise |
| `glide` | Mantra | A tap flips a constant diagonal glide at `speed` px/s |

Okto's `jet` makes the side switch very fast and briefly invulnerable. Steps up to 48 px (`CLIMB`) are climbed automatically.

**Speed:** Free Dive starts at 400 px/s and gains 7 px/s every second. Adventure levels use a fixed `390 + difficulty × 90` px/s. Depth in metres is `scroll / 50` (`PX_PER_M`).

### 4.5 Collision

The player is a circle from the character's `box()` (per character; Puffy's grows when puffed up). Hazards expose a shape that `hitsHazard(h, cx, cy, cr)` tests against that circle; `isHarmless(h, t)` filters hazards that are stunned, fleeing or otherwise inactive. Passive abilities are checked before a hit counts (e.g. Kudi ignores nets, Mantra ignores hooks). A shield absorbs one hit; `invuln` time (after a swap, revive or Okto jet) ignores hits. Falling into a trench or leaving the water is detected from `surfaceUnder()`.

## 5. World generation

`createWorld()` builds a flat, calm start; `extend(world, untilX)` keeps adding **segments** ahead of the camera and `prune()` drops those behind it.

- Each segment has a floor and ceiling height. Neighbouring segments differ by at most 44 px, and floor and ceiling stay at least 340 px apart, so the corridor is always passable.
- Some segments are **trenches** (`pit`) in the floor or ceiling.
- Hazards are chosen from the zone's list (`HAZARDS_BY_ZONE`), cumulative by zone. Density grows with depth (Free Dive) or with the level's `difficulty` (Adventure).
- Pearls are placed in patterns chosen by a **tier** (0–4): position inside the zone in Free Dive, `(level − 1) mod 5` in Adventure.
- Per segment: a pearl pattern with 60% chance, a shield bubble with 5%, and in Free Dive an encyclopedia creature of the current zone with 5% (creatures not yet discovered are picked first).

**Determinism:** all generation goes through `rnd()`. `useSeed(seed)` switches it to a seeded **mulberry32** generator, so each Adventure level (`seed = n × 7919 + 13`) has the same layout on every attempt. Free Dive uses `Math.random`.

## 6. Platform SDK adapters

The game talks to one interface (`src/sdk/adapter.js`):

```js
init(onProgress)        // Promise: load and initialise the SDK
loadingFinished()       // assets ready
gameplayStart()         // active play begins / resumes
gameplayStop()          // play stops (menus, game over, pause by the player)
interstitial()          // Promise<void>: mid-game ad
rewarded()              // Promise<boolean>: true if the reward was earned
save(obj) / load()      // persist progress
onMuteChange(cb)        // optional: platform-level mute (CrazyGames muteAudio)
```

| Adapter | Notes |
|---|---|
| `local` | Default for development. Simulated ad overlay with a countdown and Skip; saves to `localStorage` |
| `crazygames` | SDK v3: `loadingStart/Stop`, `gameplayStart/Stop`, `requestAd("midgame" \| "rewarded")`, `SDK.data` for saves, `muteAudio` setting and listener |
| `poki` | Poki SDK v2: `gameLoadingFinished`, `gameplayStart/Stop`, `commercialBreak`, `rewardedBreak` |
| `youtube` | YouTube Playables `ytgame`: `firstFrameReady`, `gameReady`, interstitial / rewarded ads, `saveData/loadData` |
| `facebook` | Instant Games 7.1: interstitial and rewarded video by placement ID (to be filled in), player data for saves |

The adapter is chosen by `?platform=` or by `window.PUFFY_PLATFORM`, which `tools/build.py` writes into each release zip.

**Platform rules followed:** `gameplayStop` is not sent when the tab loses focus (CrazyGames handles focus itself; the game just pauses locally). Audio is muted during ads and when the portal requests it.

### Ads in the game

All ad calls go through `withAd(fn)`:

1. Sets `state = "ad"` and mutes the game.
2. Awaits the adapter call, **racing it against a 45 s timeout**. An error or timeout counts as "no reward".
3. Always un-mutes in `finally`; the caller restores the screen.

So a blocked or broken ad can never freeze the game. Interstitials are shown only every `INTERSTITIAL_EVERY = 3` runs and at least `MIN_AD_GAP_MS = 60000` apart; the +40 pearls ad is limited by `FREE_PEARLS_PER_DAY = 5`.

## 7. Saving

| `localStorage` key | Contents |
|---|---|
| `hop_save` | Game progress (or the portal's cloud save through the adapter) |
| `hop_settings` | `{ music, sfx, vibrate, graphics: "auto" \| "high" \| "low" }`; kept when progress is reset |
| `hop_muted` | Sound button state |

**Progress object (`hop_save`):**

```js
{
  best: 840,                         // best Free Dive depth in metres
  pearls: 620,                       // purse
  char: "kudi",                      // selected character
  owned: ["puffy", "kudi"],          // unlocked characters
  dex: ["clownfish", "seahorse"],    // discovered creatures
  levels: { "1": 3, "2": 2 },        // best stars per Adventure level
  missions: { day: "2026-10-23", list: [{ id, progress, done, claimed }], chars: [], bonusClaimed },
  streak: { count: 2, lastDay: "2026-10-22" },
  adPearls: { day: "2026-10-23", count: 1 },
  tips: { skill: 1, swap: 1 },       // one-time tips already shown
  tutorialDone: true,
  finale: true                       // finale screen already unlocked
}
```

Unknown keys are kept and missing keys get defaults on load, so new fields can be added without migrations. Saves are written at natural points (end of dive, purchase, claim, level complete).

## 8. UI and design system

All panels are HTML elements in `index.html`, shown and hidden with the `hidden` class. Text comes from `src/i18n.js`: elements with `data-i18n="key"` are filled by `applyStatic()`, and code uses `t("key", { vars })`.

### Tokens

Defined once in `:root` at the top of the stylesheet:

| Token | Desktop | Short screens | Used for |
|---|---|---|---|
| `--fs-display` | 84px | 46px | Logo only |
| `--fs-h1` | 56px | 32px | Result screens (game over, level complete, finale) |
| `--fs-h2` | 40px | 24px | Screen titles |
| `--fs-card` | 22px | 17px | Big card labels |
| `--fs-h3` | 18px | 14px | Section and card titles |
| `--fs-body` | 16px | 13px | Paragraphs, list items |
| `--fs-small` | 13px | 11px | Secondary lines, notes |
| `--fs-xs` | 12px | 10px | Dense card copy |
| `--fs-micro` | 11px | 9px | Uppercase labels |
| `--fs-btn` / `-sm` / `-xs` | 18 / 15 / 13px | 15 / 13 / 11px | Buttons |

Colours: `--cyan`, `--gold`, `--pink`, `--rose`, `--ink`, `--navy`, `--surface`, `--line`. Radii: `--r-lg` 22px, `--r-md` 16px, `--r-sm` 12px. Font: `--font` (system rounded face with fallbacks).

**Rules:** titles are white, weight 900, with `--title-shadow`; only the logo uses the gradient wordmark. Cards use `--surface` with a 1px `--line` border. Short screens (`max-height: 520px`, i.e. landscape phones) only change token values, so every page scales together. The shared rules live in the "Design system" block at the end of the stylesheet; component blocks after it (e.g. the Characters panel) use the same tokens.

### Responsiveness

- The canvas keeps 16:9 and is letterboxed; panels use flexbox and scroll when they do not fit.
- A "rotate your phone" overlay appears in portrait.
- Keyboard hints on in-game buttons appear only with `(hover: hover) and (pointer: fine)`.

### Graphics quality

`Light` mode renders at 75% resolution, disables `shadowBlur` glows and skips decorative layers and background fish. In `Auto`, the game measures FPS during the first 4 s of play and switches to Light below 45 FPS.

## 9. Testing

Automated tests use Playwright with Chromium against a local server:

```bash
python3 -m http.server 8123 --bind 127.0.0.1 &
node tools/tests/ads.mjs          # 19 checks
node tools/tests/ads-level.mjs    # interstitial between levels
node tools/tests/finale.mjs       # 31 checks
```

| Test | Covers |
|---|---|
| `ads.mjs` | Every ad entry point (shield start from menu and Game Over, revive and skip, +40 pearls and skip, retry interstitial, mission ×2, streak ×2) and SDK failures (throws, never answers, `adError`) via a mocked CrazyGames SDK |
| `ads-level.mjs` | Interstitial before the next Adventure level |
| `finale.mjs` | All four finale triggers, no repeat after reload, menu button, confetti, reduced motion, pop sound and the SFX setting |

The tests need the `playwright` package and a Chromium binary (`executablePath` is set to `/opt/pw-browsers/chromium`; change it for your machine). They use `?debug` to force a game over or level completion.

**Manual checks before a release:** see [`release/CHECKLIST.md`](../release/CHECKLIST.md) — real Android and iPhone, the portal's QA tool with the real SDK, and a proofread of the English text.

## 10. Build and release

```bash
python3 tools/build.py              # all platforms
python3 tools/build.py crazygames   # one platform
```

Each zip contains `index.html` and `src/`, with `window.PUFFY_PLATFORM` set so the right SDK loads without URL parameters. Output: `release/puffy-<platform>.zip`.

**Covers:** open `tools/covers.html` on the local server; it renders the 1920×1080, 800×1200 and 800×800 covers and the 512×512 icon from the game's own drawing code. Save each canvas (e.g. with a browser screenshot of the element) into `release/covers/`.

## 11. Extending the game

| To add… | Do this |
|---|---|
| A character | Add an entry to `CHARACTERS` in `src/characters.js` (id, name, species, price, colour, `mode` and physics values, `ability`, `skill`, `draw(ctx, a)`). Implement the passive in the collision code and the skill in `useSkill()` in `game.js` |
| A creature | Add an entry to `CREATURES` in `src/creatures.js` (`id`, `zone`, `name`, `fact`, `draw(ctx, s, t)`). If the total changes, check the Bubu unlock and finale conditions (they use `CREATURES.length`) |
| A mission | Add an object to `POOL` in `src/missions.js` with an `event` that the game already reports through `mission(event, amount)`, or report a new event from `game.js` |
| A level | Levels are generated in `src/levels.js` (names, seed, length, difficulty). Bosses are keyed by level number in `BOSSES` (`src/bosses.js`) |
| A hazard | Add it to `HAZARDS_BY_ZONE`, its spawn and movement in `world.js`, its shape in `hitsHazard`, its drawing in `drawHazards`, and a defeat animation in `src/deaths.js` |
| A rare moment | Add an entry to `MOMENTS` in `src/moments.js` with its zones, duration, sound and `draw` |
| UI text | Add a key to `src/i18n.js` and use `data-i18n="key"` or `t("key")` |
| A platform | Add an adapter object with the interface in §6 to `src/sdk/adapter.js`, register it in `adapters`, and add it to `PLATFORMS` in `tools/build.py` |

## 12. Known limitations

- Not yet tested on real phones or with the real portal SDKs (only mocked in tests).
- Facebook placement IDs and `fbapp-config.json` are placeholders.
- Settings and the mute state stay in `localStorage` even on portals with cloud saves (they are small device preferences).
- The system rounded font differs slightly between Apple, Windows and Android.
- English only; all strings are in `src/i18n.js` and the data files, ready for translation.
