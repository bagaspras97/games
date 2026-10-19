import { devParam, devFlag } from "./dev.js";
import { t, applyStatic } from "./i18n.js";
import { settings, saveSettings } from "./settings.js";
// "Puffy: Deep Sea Adventure" — one-tap hyper-casual deep-sea runner.
// Tap / click / space: Puffy inflates (floats up) or deflates (sinks down).
// Avoid hazards, collect pearls, grab shield bubbles, discover rare creatures.
import { createPlatform } from "./sdk/adapter.js";
import { CHARACTERS, getCharacter } from "./characters.js";
import { CREATURES, getCreature } from "./creatures.js";

const SECRET_ID = "bubu";
import {
  sfx, unlock, toggleMute, isMuted, setAdPlaying, applyMusicSetting, setPlatformMuted, startMusic, stopMusic, setTempo, setMuffle,
} from "./audio.js";
import * as fx from "./particles.js";
import { updateAmbient, drawAmbient } from "./ambient.js";
import { updateMoments, drawMoment, resetMoments } from "./moments.js";

const MOMENT_REWARD = 5;
import { DEATHS, deathFor } from "./deaths.js";
import * as missions from "./missions.js";
import { createBoss, updateBoss, bossHits, drawBoss } from "./bosses.js";
import { LEVELS, STAR_PEARL_RATIO, rewardPerStar, worldOptions, isUnlocked, totalStars } from "./levels.js";
import {
  W, H, PX_PER_M, ZONES, zoneIndex, createWorld, extend, prune, surfaceUnder, updateWorld, hitsHazard, isHarmless,
  setLowQuality, drawBackground, drawTerrain, drawDarkness, drawHazards, drawPickups, drawFinish, useSeed,
} from "./world.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);
const ui = {
  menu: $("menu"), over: $("over"), hud: $("score"),
  final: $("final"), best: $("best"), pearls: $("pearls"),
  play: $("play"), retry: $("retry"), revive: $("revive"),
  shop: $("shop"), shopPearls: $("shop-pearls"), shopGrid: $("shop-grid"), shopClose: $("shop-close"),
  freePearls: $("free-pearls"),
  dex: $("dex"), dexGrid: $("dex-grid"), dexCount: $("dex-count"), dexClose: $("dex-close"),
  banner: $("banner"), toast: $("toast"),
};

const INTERSTITIAL_EVERY = 3;  // runs between mid-game ads
const MIN_AD_GAP_MS = 60000;   // never show interstitials more often than this
const FREE_PEARLS = 40;        // reward for watching an ad in the shop…
const FREE_PEARLS_PER_DAY = 5; // …at most this many times per day
const CLIMB = 48;              // step height Puffy swims over automatically
// Dev helper: ?start=1000 begins the dive at 1000 m to test deeper zones.
const START_M = Number(devParam("start")) || 0;

let platform;
let save = { best: 0, pearls: 0, char: "puffy", owned: ["puffy"], dex: [] };
let state = "menu";            // menu | play | over | ad | shop | dex
let panelReturn = null;        // panel to show again when shop/dex closes
let runs = 0, lastAdAt = 0, revived = false;
let mode = "endless";          // endless | level
let lvl = null;                // current Adventure level
let lvlPearls = 0;             // pearls picked up in this level attempt
let boss = null, bossCtx = null; // exam-level boss and its last corridor info
let player, world, scroll, speed, depth, last, time = 0, zone = 0;
let shake = 0;
let shopCanvases = [];         // animated character previews in the shop
let finaleCanvases = [];       // ...and on the finale screen
let dexCanvases = [];          // animated creatures in the encyclopedia
let menuRenderedAt = -1;       // last time the menu stats were refreshed
let pendingFinale = false;     // finale unlocked but not shown yet
const hero = () => getCharacter(save.char);

function reset(withShield = false) {
  player = {
    x: 260, y: H - 140, vy: 0, up: false, gravity: 1, dir: 1,
    shield: withShield, invuln: 0, mood: "normal", moodT: 0, tilt: 0,
    pulse: 0, flash: 0, near: 0, sonarT: 3, flips: 0,
  };
  if (mode === "level") {
    tut = null;
    useSeed(lvl.seed); // same layout on every attempt
    const { startX, opts } = worldOptions(lvl);
    scroll = startX;
    world = createWorld(save.dex, scroll, opts);
    speed = 390 + lvl.difficulty * 90;
    zone = lvl.zone;
  } else {
    useSeed(null);
    scroll = START_M * PX_PER_M;
    tut = save.tutorialDone ? null : { step: 0 };
    world = createWorld(save.dex, scroll, tut ? { tutorial: true } : {});
    speed = 400;
    zone = zoneIndex(START_M);
  }
  depth = Math.floor(scroll / PX_PER_M);
  extend(world, scroll + W * 2);
  revived = false;
  lvlPearls = 0;
  boss = mode === "level" && lvl.exam ? createBoss(lvl.n) : null;
  bossCtx = null;
}

const box = () => hero().box(player.up);

function resize() {
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = W * scale + "px";
  canvas.style.height = H * scale + "px";
  // Phones held upright get a "turn your phone" screen (and the dive pauses).
  const portraitPhone = innerHeight > innerWidth && matchMedia("(pointer: coarse)").matches;
  show($("rotate"), portraitPhone);
  if (portraitPhone && state === "play") pauseGame();
}

function show(el, visible) { el.classList.toggle("hidden", !visible); }

function setMood(m, t = 0.5) { player.mood = m; player.moodT = t; }

let bannerTimer, toastTimer;
function banner(text) {
  ui.banner.textContent = text;
  show(ui.banner, true);
  ui.banner.classList.remove("pop"); void ui.banner.offsetWidth; ui.banner.classList.add("pop");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => show(ui.banner, false), 2400);
}
function toast(html, ms = 4000) {
  ui.toast.innerHTML = html;
  show(ui.toast, true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => show(ui.toast, false), ms);
}

// ---------- Missions ----------
function mission(event, amount = 1) {
  announce(missions.track(save, event, amount));
}

function announce(done) {
  for (const m of done) {
    sfx.discover();
    toast(t("missionDone", { text: m.text, n: m.reward }), 3500);
  }
  const streakDay = done.length ? missions.checkStreak(save) : 0;
  if (streakDay) {
    platform.save(save);
    setTimeout(() => {
      banner(t("streakBanner", { n: streakDay }));
      toast(t("streakToast", { n: streakDay, r: missions.streakReward(streakDay) }), 4500);
      sfx.buy();
    }, 1800);
  }
  if (done.length) updateMissionBadges();
}

function updateMissionBadges() {
  const n = missions.claimable(save);
  document.querySelectorAll(".open-missions").forEach((b) => {
    b.dataset.badge = n || "";
    b.classList.toggle("has-badge", n > 0);
  });
}

function renderStreak() {
  const st = missions.streakInfo(save);
  const box = $("streak");
  const cycleDay = ((st.day - 1) % 7) + 1;           // 1..7 position of today's bonus
  const weekStart = st.day - cycleDay + 1;
  let dots = "";
  for (let i = 1; i <= 7; i++) {
    const day = weekStart + i - 1;
    const cls = day < st.day || (day === st.day && st.doneToday) ? "done" : day === st.day ? "today" : "";
    dots += `<div class="s-day ${cls}"><b>${i === 7 ? "🎁" : t("streakDay", { n: i })}</b><span>${missions.streakReward(day)} 🦪</span></div>`;
  }
  const status = st.doneToday
    ? t("streakSafe", { n: st.count + 1 })
    : st.count > 0
      ? t("streakKeep")
      : t("streakStart");
  box.innerHTML = `<div class="s-head">${t("streakHead", { n: st.count })}</div><div class="s-row">${dots}</div><div class="s-status">${status}</div><div class="s-actions"></div>`;
  if (st.doneToday && !st.claimed) {
    const reward = missions.streakReward(st.count);
    const claim = document.createElement("button");
    claim.className = "alt small";
    claim.textContent = t("streakClaim", { n: reward });
    claim.onclick = () => claimStreak(1);
    const double = document.createElement("button");
    double.className = "ghost small";
    double.textContent = `🎬 x2 (+${reward * 2})`;
    double.onclick = () => claimStreak(2);
    box.querySelector(".s-actions").append(claim, double);
  } else if (st.doneToday) {
    box.querySelector(".s-actions").innerHTML = `<span class="m-done">${t("streakClaimed")}</span>`;
  }
}

async function claimStreak(mult) {
  const ms = missions.ensureDaily(save);
  const st = missions.streakInfo(save);
  if (!st.doneToday || ms.bonusClaimed) return;
  if (mult > 1) {
    const earned = await withAd(() => platform.rewarded());
    state = "missions";
    if (!earned) mult = 1;
  }
  ms.bonusClaimed = true;
  const reward = missions.streakReward(st.count) * mult;
  save.pearls += reward;
  sfx.buy();
  platform.save(save);
  ui.pearls.textContent = save.pearls;
  renderMissions();
  updateMissionBadges();
  toast(t("streakGot", { n: reward }), 1800);
}

function renderMissions() {
  renderStreak();
  const ms = missions.ensureDaily(save);
  const list = $("missions-list");
  list.innerHTML = "";
  ms.list.forEach((m, i) => {
    const d = missions.describe(m);
    const card = document.createElement("div");
    card.className = "mission" + (d.claimed ? " claimed" : d.done ? " ready" : "");
    const pct = Math.round((d.progress / d.target) * 100);
    card.innerHTML = `
      <div class="m-text">${d.funny ? "😜 " : ""}${d.text}</div>
      <div class="m-bar"><i style="width:${pct}%"></i><span>${d.progress} / ${d.target}</span></div>
      <div class="m-actions"></div>`;
    const actions = card.querySelector(".m-actions");
    if (d.claimed) actions.innerHTML = `<span class="m-done">${t("claimed")}</span>`;
    else if (d.done) {
      const claim = document.createElement("button");
      claim.className = "alt small";
      claim.textContent = t("claim", { n: d.reward });
      claim.onclick = () => claimMission(i, 1);
      const double = document.createElement("button");
      double.className = "ghost small";
      double.textContent = `🎬 x2 (+${d.reward * 2})`;
      double.onclick = () => claimMission(i, 2);
      actions.append(claim, double);
    } else actions.innerHTML = `<span class="m-reward">${t("rewardLabel", { n: d.reward })}</span>`;
    list.append(card);
  });
}

async function claimMission(i, mult) {
  const m = missions.ensureDaily(save).list[i];
  if (!m.done || m.claimed) return;
  if (mult > 1) {
    const earned = await withAd(() => platform.rewarded());
    state = "missions";
    if (!earned) mult = 1;
  }
  m.claimed = true;
  const reward = missions.describe(m).reward * mult;
  save.pearls += reward;
  sfx.buy();
  platform.save(save);
  ui.pearls.textContent = save.pearls;
  renderMissions();
  updateMissionBadges();
  toast(t("pocket", { n: reward }), 1800);
}

// ---------- Pause ----------
// auto: paused because the tab was hidden. Portals (e.g. CrazyGames) handle focus
// loss themselves and ask us NOT to send gameplayStop for it.
let autoPaused = false;
function pauseGame(auto = false) {
  if (state !== "play") return;
  state = "paused";
  autoPaused = auto;
  stopMusic();
  if (!auto) platform.gameplayStop();
  show(ui.banner, false); show(ui.toast, false);
  show($("pause-panel"), true);
}

function resumeGame() {
  show($("pause-panel"), false);
  state = "play";
  last = performance.now();
  startMusic();
  if (!autoPaused) platform.gameplayStart();
  autoPaused = false;
}

// Leave the current dive without a Game Over (pearls already earned are kept).
function quitToMenu() {
  show($("pause-panel"), false); show($("progress"), false);
  if (autoPaused) platform.gameplayStop(); // the dive is really over now
  autoPaused = false;
  showHint(""); tut = null;
  if (mode === "endless") save.best = Math.max(save.best, depth);
  platform.save(save);
  mode = "endless"; lvl = null;
  reset();
  state = "menu";
  show(ui.menu, true);
}

// ---------- Mid-dive character swap (Free mode only) ----------
const SWAP_COOLDOWN = 8;       // seconds before you can swap again
let swapCooldown = 0;

function canSwap() {
  return state === "play" && mode === "endless" && save.owned.length > 1 && swapCooldown <= 0;
}

function updateSwapButton() {
  const b = $("swap");
  const visible = (state === "play" || state === "swap") && mode === "endless" && save.owned.length > 1;
  show(b, visible);
  if (!visible) return;
  b.disabled = swapCooldown > 0;
  b.textContent = swapCooldown > 0 ? `🐠 ${Math.ceil(swapCooldown)}` : t("swapBtn");
}

function openSwap() {
  if (!canSwap()) return;
  state = "swap";                 // pauses the dive
  platform.gameplayStop();
  const grid = $("swap-grid");
  grid.innerHTML = "";
  for (const ch of CHARACTERS.filter((c) => save.owned.includes(c.id))) {
    const b = document.createElement("button");
    b.className = "card char-card" + (ch.id === save.char ? " equipped" : "");
    const cv = document.createElement("canvas");
    cv.width = cv.height = 120;
    const cx = cv.getContext("2d");
    cx.translate(60, 64);
    ch.draw(cx, { t: time, up: true, vy: 0, mood: "happy", pulse: 0, flash: 0, near: 0 });
    b.append(cv);
    b.insertAdjacentHTML("beforeend", `<b>${ch.name}</b><p class="ability">⚡ ${ch.ability}</p>`);
    b.onclick = () => chooseSwap(ch.id);
    grid.append(b);
  }
  show(ui.banner, false); show(ui.toast, false);
  show($("swap-panel"), true);
}

function closeSwap() {
  show($("swap-panel"), false);
  state = "play";
  last = performance.now();
  platform.gameplayStart();
}

function chooseSwap(id) {
  if (id !== save.char) {
    save.char = id;
    const ch = hero();
    // carry the current direction over to the new way of moving
    if (ch.mode === "pulse") { player.up = false; player.gravity = 1; }
    else if (ch.mode === "glide") player.dir = player.up ? -1 : 1;
    else player.gravity = player.up ? -1 : 1;
    player.vy = 0;
    player.sonarT = 3;
    player.invuln = Math.max(player.invuln, 1);  // a short grace period
    swapCooldown = SWAP_COOLDOWN;
    fx.puff(scroll + player.x, player.y);
    fx.text(scroll + player.x, player.y - 46, t("swapTo", { name: ch.name }), ch.color);
    sfx.buy();
    platform.save(save);
    announce(missions.trackCharacter(save, id));
  }
  closeSwap();
}

// ---------- Active skills (Free mode only) ----------
let skillCD = 0;                // seconds until the skill is ready
let effects = [];               // short skill visuals: { kind, t, dur, ... }

const onScreen = (h) => h.x - scroll > -80 && h.x - scroll < W + 80;
// a hazard's visual centre (several hazard types store y differently)
function hazardY(h) {
  if (h.type === "coral") return h.base - h.h / 2;
  if (h.type === "icicle") return h.base + h.h / 2;
  if (h.type === "net") return h.fromTop ? h.base + h.h / 2 : h.base - h.h / 2;
  return h.y;
}

function destroyHazard(h, color = "#ffffff") {
  if (h.gone) return;
  h.gone = true;
  fx.sparkle(h.x, hazardY(h), color);
  fx.puff(h.x, hazardY(h));
}

function updateSkillButton() {
  const b = $("skill");
  const visible = (state === "play" || state === "swap") && mode === "endless";
  show(b, visible);
  if (!visible) return;
  const sk = hero().skill;
  b.disabled = skillCD > 0;
  b.innerHTML = skillCD > 0
    ? `<span class="sk-icon">${sk.icon}</span><span class="sk-cd">${Math.ceil(skillCD)}</span>`
    : `<span class="sk-icon">${sk.icon}</span><span class="sk-name">${sk.name}</span>`;
  b.style.setProperty("--p", skillCD > 0 ? 1 - skillCD / sk.cd : 1);
}

function useSkill() {
  if (state !== "play" || mode !== "endless" || skillCD > 0) return;
  const ch = hero(), sk = ch.skill;
  const wx = scroll + player.x, py = player.y;
  skillCD = sk.cd;
  sfx.shield();
  fx.text(wx, py - 52, `${sk.icon} ${sk.name}!`, ch.color);
  mission("ability");
  switch (ch.id) {
    case "puffy": { // spike burst: destroys hazards around
      effects.push({ kind: "spikes", t: 0, dur: 0.45 });
      for (const h of world.hazards) if (Math.hypot(h.x - wx, hazardY(h) - py) < 280) destroyHazard(h, "#ffe27a");
      player.up = true; player.gravity = -1; // Puffy puffs up for the burst
      break;
    }
    case "kudi": { // tail whirl: pulls all pearls on screen, blows small hazards away
      effects.push({ kind: "whirl", t: 0, dur: 1.2 });
      for (const p of world.pickups) if (p.kind === "pearl" && !p.taken && onScreen(p)) p.pulled = true;
      for (const h of world.hazards) {
        if (Math.hypot(h.x - wx, hazardY(h) - py) > 340) continue;
        if (h.type === "bag") destroyHazard(h, "#ffc98a");
        if (h.type === "jelly") h.stunUntil = time + 3;
      }
      break;
    }
    case "jeli": { // electric wave forward along the player's height
      effects.push({ kind: "bolt", t: 0, dur: 0.5, y: py });
      for (const h of world.hazards) {
        const dx = h.x - wx;
        if (dx > -20 && dx < 800 && Math.abs(hazardY(h) - py) < 240) destroyHazard(h, "#fff36b");
      }
      break;
    }
    case "okto": { // arms grab and fling up to 3 nearest hazards ahead
      const targets = world.hazards.filter((h) => !h.gone && h.x > wx - 20 && h.x - wx < 520)
        .sort((a, b) => a.x - b.x).slice(0, 3);
      for (const h of targets) {
        effects.push({ kind: "arm", t: 0, dur: 0.4, tx: h.x, ty: hazardY(h) });
        destroyHazard(h, "#d6485c");
      }
      fx.ink(wx, py);
      break;
    }
    case "mantra": { // 2 s charge: invulnerable and smashes through hazards
      player.dash = 2;
      player.invuln = Math.max(player.invuln, 2);
      effects.push({ kind: "dash", t: 0, dur: 2 });
      break;
    }
    case "lumi": { // lantern beam freezes everything on screen
      effects.push({ kind: "beam", t: 0, dur: 0.6 });
      for (const h of world.hazards) if (onScreen(h)) h.stunUntil = time + 3;
      break;
    }
    case "bubu": { // giant water spout wipes the screen clean
      effects.push({ kind: "wave", t: 0, dur: 0.8 });
      for (const h of world.hazards) if (onScreen(h)) destroyHazard(h, "#a8dcff");
      addShake(10);
      break;
    }
  }
}

function drawEffects() {
  for (const e of effects) {
    const k = e.t / e.dur, a = 1 - k;
    ctx.save();
    switch (e.kind) {
      case "spikes": // ring of flying spikes
        ctx.fillStyle = `rgba(255,226,122,${a})`;
        for (let i = 0; i < 16; i++) {
          const an = (Math.PI * 2 * i) / 16, r = 30 + k * 260;
          ctx.save(); ctx.translate(player.x + Math.cos(an) * r, player.y + Math.sin(an) * r); ctx.rotate(an);
          ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -5); ctx.lineTo(-8, 5); ctx.fill(); ctx.restore();
        }
        break;
      case "whirl":
        ctx.strokeStyle = `rgba(255,201,138,${a})`; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(player.x, player.y, 40 + i * 30 + Math.sin(time * 10 + i) * 6, time * 8 + i, time * 8 + i + 4); ctx.stroke(); }
        break;
      case "bolt": // jagged lightning line forward
        ctx.strokeStyle = `rgba(255,243,107,${a})`; ctx.lineWidth = 6; ctx.shadowColor = "#fff36b"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(player.x + 20, e.y);
        for (let x = 60; x <= 800; x += 40) ctx.lineTo(player.x + x, e.y + (Math.random() - 0.5) * 60);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,243,107,${0.12 * a})`;            // the band it clears
        ctx.fillRect(player.x, e.y - 240, 800, 480);
        break;
      case "arm": // tentacle reaching out to the grabbed hazard
        ctx.strokeStyle = `rgba(214,72,92,${a})`; ctx.lineWidth = 12; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(player.x, player.y);
        ctx.quadraticCurveTo((player.x + e.tx - scroll) / 2, player.y - 80, e.tx - scroll, e.ty); ctx.stroke();
        break;
      case "dash":
        ctx.fillStyle = `rgba(159,195,255,${0.35 * a + 0.1})`;
        for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.ellipse(player.x - i * 26, player.y, 24 - i * 3, 8, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      case "beam": // lantern flash
        ctx.fillStyle = `rgba(255,245,154,${0.45 * a})`;
        ctx.fillRect(0, 0, W, H);
        break;
      case "wave": // water wall sweeping right
        ctx.fillStyle = `rgba(168,220,255,${0.6 * a})`;
        ctx.fillRect(player.x + k * W - 80, 0, 160, H);
        break;
    }
    ctx.restore();
  }
}

function startRun(withShield = false) {
  swapCooldown = 0;
  skillCD = 0;
  effects = [];
  reset(withShield);
  announce(missions.trackCharacter(save, save.char));
  resetMoments();
  state = "play";
  show(ui.menu, false); show(ui.over, false); show(ui.toast, false);
  fx.clear();
  startMusic();
  platform.gameplayStart();
  if (mode === "level") banner(t("levelBanner", { n: lvl.n, name: lvl.name }));
  if (tut) showHint(t("tut1"));
  else if (mode === "endless") {
    tipLater("skill", 3500);
    if (save.owned.length > 1) tipLater("swap", 9000);
  }
  if (boss) {
    const d = boss.def;
    setTimeout(() => {
      if (state !== "play") return;
      banner(t("bossBanner", { icon: d.icon, name: d.name }));
      toast(t("bossHint"), 3800);
      sfx.abyss();
    }, 2300);
  }
  else if (mode !== "level" && !tut) banner(`${ZONES[zone].icon} ${ZONES[zone].name}`);
  show($("progress"), mode === "level");
}

// ---------- First-time tutorial & one-time tips ----------
// tut: null, or { step } — 0: try tapping (the world waits), 1: collect pearls,
// 2: dodge a practice urchin, then done. Runs once, on the very first Free Dive.
let tut = null;
let tutPearls = 0;

function showHint(html) {
  const el = $("hint");
  el.innerHTML = html;
  show(el, !!html);
}

function tutorialAhead(kind) {
  const wx = scroll + player.x;
  const top = 90, bottom = H - 90;
  if (kind === "pearls") {
    for (let i = 0; i < 5; i++) world.pickups.push({ kind: "pearl", x: wx + 420 + i * 46, y: bottom - 60 - i * 40, r: 12 });
  } else {
    world.hazards.push({ type: "urchin", x: wx + 650, y: bottom - 20, r: 22, tutorial: true });
    tut.urchinX = wx + 650;
  }
}

function updateTutorial() {
  if (!tut) return;
  const wx = scroll + player.x;
  if (tut.step === 0 && player.flips >= 2) {
    tut.step = 1; tutPearls = 0;
    showHint(t("tut2")); tutorialAhead("pearls");
    tut.until = wx + 420 + 5 * 46 + 80;
  } else if (tut.step === 1 && wx > tut.until) {
    tut.step = 2;
    showHint(t("tut3")); tutorialAhead("urchin");
  } else if (tut.step === 2 && wx > tut.urchinX + 60) {
    tut = null;
    showHint("");
    banner(t("tutDone"));
    sfx.discover();
    save.tutorialDone = true;
    platform.save(save);
  }
}

// Each tip is shown once ever, a little later than the moment that triggers it.
function tipLater(key, ms = 0) {
  if (!Array.isArray(save.tips)) save.tips = [];
  if (save.tips.includes(key)) return;
  setTimeout(() => {
    if (save.tips.includes(key)) return;
    if (ms && state !== "play" && state !== "over") return; // context gone; try another time
    save.tips.push(key);
    platform.save(save);
    toast(t("tip_" + key), 5200);
  }, ms);
}

// ---------- Adventure mode ----------
function startLevel(n) {
  mode = "level";
  lvl = LEVELS[n - 1];
  show($("levels"), false); show($("level-done"), false);
  startRun();
}

function startEndless() {
  mode = "endless";
  lvl = null;
  startRun();
}

function renderLevels() {
  $("levels-stars").textContent = `${totalStars(save)} / ${LEVELS.length * 3}`;
  const grid = $("levels-grid");
  grid.innerHTML = "";
  ZONES.forEach((z, zi) => {
    const row = document.createElement("div");
    row.className = "lv-zone";
    row.innerHTML = `<div class="lv-zone-name">${z.icon} ${z.name}</div><div class="lv-row"></div>`;
    for (const L of LEVELS.filter((l) => l.zone === zi)) {
      const stars = (save.levels || {})[L.n] || 0;
      const open = isUnlocked(save, L.n);
      const b = document.createElement("button");
      b.className = "lv" + (open ? "" : " locked") + (L.exam ? " exam" : "") + (stars ? " cleared" : "");
      b.title = L.name;
      b.innerHTML = open
        ? `<b>${L.exam ? "👑" : ""}${L.n}</b><span>${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>`
        : `<b>🔒</b><span>${L.n}</span>`;
      b.onclick = () => { if (open) { sfx.click(); startLevel(L.n); } else sfx.denied(); };
      row.querySelector(".lv-row").append(b);
    }
    grid.append(row);
  });
}

function levelComplete() {
  state = "done";
  show($("progress"), false);
  stopMusic();
  platform.gameplayStop();
  runs++;
  const pearlOk = world.pearlTotal === 0 || lvlPearls >= Math.ceil(world.pearlTotal * STAR_PEARL_RATIO);
  // ★★★ = finish without having to continue after a knock-out. A shield bubble
  // that pops along the way is fine — it saved you, it doesn't cost a star.
  const clean = !revived;
  const stars = 1 + (pearlOk ? 1 : 0) + (pearlOk && clean ? 1 : 0);
  if (!save.levels) save.levels = {};
  const before = save.levels[lvl.n] || 0;
  const gained = Math.max(0, stars - before);
  const reward = gained * rewardPerStar(lvl);
  save.levels[lvl.n] = Math.max(before, stars);
  save.pearls += reward;
  platform.save(save);
  checkFinale();
  mission("depth", depth);
  mission("flips", player.flips);
  sfx.discover();
  for (let i = 0; i < 4; i++) fx.sparkle(scroll + player.x + 40, player.y, ["#ffe27a", "#7ff0ff", "#ff9ab5", "#fff"][i]);

  $("done-title").textContent = t("levelDone", { n: lvl.n });
  $("done-name").textContent = lvl.name;
  $("done-stars").innerHTML = [1, 2, 3].map((i) => `<span class="star ${i <= stars ? "on" : ""}" style="animation-delay:${i * 0.25}s">★</span>`).join("");
  $("done-info").innerHTML = `
    <div>${pearlOk ? "✅" : "▫️"} ${t("donePearls", { got: lvlPearls, total: world.pearlTotal, pct: Math.round(STAR_PEARL_RATIO * 100) })}</div>
    <div>${clean ? "✅" : "▫️"} ${t("doneClean")}</div>
    ${boss ? `<div>${t("doneBoss", { icon: boss.def.icon, name: boss.def.name })}</div>` : ""}
    <div class="done-reward">${reward ? t("doneReward", { n: reward, s: gained }) : t("doneNoReward")}</div>`;
  const next = LEVELS[lvl.n];
  show($("done-next"), !!next);
  show($("level-done"), true);
}

async function nextLevel() {
  if (maybeShowFinale()) return;
  show($("level-done"), false);
  if (runs % INTERSTITIAL_EVERY === 0 && Date.now() - lastAdAt > MIN_AD_GAP_MS) {
    await withAd(() => platform.interstitial());
    lastAdAt = Date.now();
  }
  startLevel(lvl.n + 1);
}

function addShake(amount) { shake = Math.max(shake, amount); }
function vibrate(ms) { if (!settings.vibrate) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ---------- Graphics quality ----------
// Light mode: renders at 75% resolution, turns off glow (shadowBlur — the most
// expensive effect) and skips decorative background layers & ambient fish.
let lowGfx = false, gfxScale = 1;
const shadowDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur");
Object.defineProperty(ctx, "shadowBlur", {
  get() { return shadowDesc.get.call(this); },
  set(v) { shadowDesc.set.call(this, lowGfx ? 0 : v); },
});

function applyGraphics(low) {
  lowGfx = low;
  gfxScale = low ? 0.75 : 1;
  canvas.width = W * gfxScale;
  canvas.height = H * gfxScale;
  setLowQuality(low);
}

// "auto": watch the first seconds of play; if it runs slowly, switch to light.
let fpsFrames = 0, fpsTime = 0;
function autoGraphics(rawDt) {
  if (settings.graphics !== "auto" || lowGfx || state !== "play") return;
  fpsFrames++; fpsTime += rawDt;
  if (fpsTime < 4) return;
  const fps = fpsFrames / fpsTime;
  fpsFrames = 0; fpsTime = 0;
  if (fps < 45) { applyGraphics(true); toast(t("gfxAutoToast"), 3500); }
}

// ---------- Settings panel ----------
let settingsReturn = null;
function renderSettings() {
  const onOff = (v) => (v ? t("on") : t("off"));
  $("set-music").textContent = `🎵 ${t("musicLbl")}: ${onOff(settings.music)}`;
  $("set-sfx").textContent = `🔊 ${t("sfxLbl")}: ${onOff(settings.sfx)}`;
  $("set-vibrate").textContent = `📳 ${t("vibrateLbl")}: ${onOff(settings.vibrate)}`;
  $("set-gfx").textContent = `✨ ${t("gfxLbl")}: ${t("gfx_" + settings.graphics)}`;
  $("set-reset").textContent = resetArmed ? t("resetConfirm") : t("resetProgress");
  ["set-music", "set-sfx", "set-vibrate"].forEach((id) => $(id).classList.toggle("off", !settings[id.slice(4)]));
}
function openSettings(from) {
  settingsReturn = from;
  resetArmed = false;
  show(from, false);
  renderSettings();
  show($("settings"), true);
}
function closeSettings() {
  show($("settings"), false);
  show(settingsReturn, true);
}
let resetArmed = false;
function toggleSetting(key) {
  settings[key] = !settings[key];
  saveSettings();
  if (key === "music") applyMusicSetting();
  sfx.click();
  renderSettings();
}

// cause: "hazard" | "wall" | "pit" | "hidden". Each hazard plays its own knock-out
// animation (see deaths.js) before the Game Over panel. Shake & vibration only on hazards.
let dying = null;

function gameOver(cause, h = null) {
  stopMusic();
  platform.gameplayStop();
  if (cause === "hidden") { dying = null; return finishGameOver(); }
  const { key, label } = deathFor(cause, h, player.y);
  dying = { key, label, t: 0, x: player.x, y: player.y, wx: scroll + player.x, h, ox: 0, oy: 0 };
  if (h && h.type === "bag") h.gone = true; // the bag is drawn wrapped around the character
  state = "dying";
  setMood("dead", 99);
  addShake(cause === "wall" || key === "sword" ? 26 : 16);
  vibrate([60, 40, 90]);
  (sfx[DEATHS[key].sound] || sfx.death)();
  DEATHS[key].start(dying, fx);
}

// Offscreen sprite of the knocked-out character, optionally tinted (red flash, charred…).
const spriteCanvas = document.createElement("canvas");
spriteCanvas.width = spriteCanvas.height = 220;
function heroSprite(tint, alpha = 0.6) {
  const c = spriteCanvas.getContext("2d");
  c.clearRect(0, 0, 220, 220);
  c.save();
  c.translate(110, 110);
  hero().draw(c, { t: time, up: player.up, vy: 0, mood: "dead", pulse: 0, flash: 0, near: 0 });
  c.restore();
  if (tint) {
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = alpha;
    c.fillStyle = tint;
    c.fillRect(0, 0, 220, 220);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
  return spriteCanvas;
}

function finishGameOver() {
  state = "over";
  showHint("");
  tipLater("missions", 600);
  if (runs >= 2 && mode === "endless") tipLater("adventure", 600);
  const cheapest = CHARACTERS.filter((c) => !c.secret && !save.owned.includes(c.id)).map((c) => c.price).sort((a, b) => a - b)[0];
  if (cheapest && save.pearls >= cheapest) tipLater("shop", 600);
  show($("progress"), false);
  runs++;
  if (dying) {
    mission("ko_" + dying.key);
    if (depth - START_M < 50) mission("ko_early");
  }
  mission("depth", depth);
  mission("flips", player.flips);
  if (mode === "endless") save.best = Math.max(save.best, depth);
  platform.save(save);
  show($("over-stats"), mode === "endless");
  show($("over-level"), mode === "level");
  show($("over-map"), mode === "level");
  if (mode === "level") {
    const done = Math.max(0, Math.round((scroll + player.x - (world.finishX - lvl.meters * PX_PER_M)) / PX_PER_M));
    $("over-level").textContent = t("overLevel", { n: lvl.n, name: lvl.name, done: Math.min(done, lvl.meters), total: lvl.meters });
  }
  $("over-title").textContent = t("overTitle", { name: hero().name });
  $("over-cause").textContent = dying ? dying.label : "";
  ui.final.textContent = depth;
  ui.best.textContent = save.best;
  ui.pearls.textContent = save.pearls;
  show(ui.revive, !revived);
  show(ui.over, true);
  checkFinale();
  maybeShowFinale();
}

async function withAd(fn) {
  state = "ad";
  setAdPlaying(true);
  // Fail-safe: an ad that errors or never answers must not freeze the game.
  const AD_TIMEOUT_MS = 45000;
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), AD_TIMEOUT_MS); }),
    ]);
  } catch (e) {
    console.warn("[ad] failed:", e);
    return false;
  } finally {
    clearTimeout(timer);
    setAdPlaying(false);
  }
}

async function retry() {
  // Interstitial only at a natural break, and rate-limited (platform guidelines).
  if (runs % INTERSTITIAL_EVERY === 0 && Date.now() - lastAdAt > MIN_AD_GAP_MS) {
    show(ui.over, false);
    await withAd(() => platform.interstitial());
    lastAdAt = Date.now();
  }
  startRun();
}

// Rewarded: start the run already protected by a shield bubble.
async function startWithShield(from) {
  if (from === ui.menu) { mode = "endless"; lvl = null; } // the menu's shield button is for Free mode
  show(from, false);
  const earned = await withAd(() => platform.rewarded());
  if (earned) { startRun(true); sfx.shield(); return; }
  state = from === ui.over ? "over" : "menu";
  show(from, true);
}

async function revive() {
  show(ui.over, false);
  const earned = await withAd(() => platform.rewarded());
  if (earned) {
    revived = true;
    sfx.revive();
    startMusic();
    // Clear nearby hazards and put Puffy back on a safe flat strip.
    const wx = scroll + player.x;
    world.hazards = world.hazards.filter((h) => h.x > wx + 600 || h.x < wx - 150);
    for (const seg of world.segs) {
      if (seg.x + seg.w > wx - 100 && seg.x < wx + 600) {
        seg.pit = null;
        seg.floor = seg.floor ?? H - 90;
        seg.ceil = seg.ceil ?? 90;
      }
    }
    player.up = false; player.gravity = 1; player.dir = 1; player.vy = 0;
    player.y = surfaceUnder(world, wx - 30, wx + 30).floor - box().hh;
    player.invuln = 1.5;
    setMood("happy", 1);
    state = "play";
    platform.gameplayStart();
    last = performance.now();
  } else {
    state = "over";
    show(ui.revive, false);
    show(ui.over, true);
  }
}

// ---------- Skin shop ----------
function openPanel(panel, from, render) {
  panelReturn = from;
  state = panel === ui.shop ? "shop" : panel === ui.dex ? "dex" : panel.id;
  show(ui.menu, false); show(ui.over, false);
  show(ui.banner, false); show(ui.toast, false); // keep panels uncluttered
  render();
  show(panel, true);
}

function closePanel(panel) {
  show(panel, false);
  ui.pearls.textContent = save.pearls;
  state = panelReturn === ui.over ? "over" : "menu";
  show(panelReturn, true);
}

function renderShop() {
  updateFreePearlsButton();
  ui.shopPearls.textContent = save.pearls;
  ui.shopGrid.innerHTML = "";
  shopCanvases = [];
  for (const ch of CHARACTERS) {
    const owned = save.owned.includes(ch.id);
    const equipped = save.char === ch.id;
    const hidden = ch.secret && !owned;
    const card = document.createElement("button");
    card.className = "card char-card" + (equipped ? " equipped" : "") + (ch.secret ? " secret" : "");
    const c = document.createElement("canvas");
    c.width = c.height = 120;
    shopCanvases.push({ c, ch, hidden });
    const label = equipped ? t("inUse") : owned ? t("use")
      : hidden ? t("lockedDex", { n: save.dex.length, total: CREATURES.length }) : `🦪 ${ch.price}`;
    card.append(c);
    card.insertAdjacentHTML("beforeend", hidden
      ? `<b>??? <small>${t("secretTitle")}</small></b><p class="desc">${t("secretDesc")}</p><p class="ability">⚡ ???</p><span class="price">${label}</span>`
      : `<b>${ch.name} <small>${ch.species}</small></b><p class="desc">${ch.desc}</p><p class="ability">⚡ ${ch.ability}</p><p class="skill">${ch.skill.icon} <b>${ch.skill.name}</b> ${t("skillFree")}: ${ch.skill.desc}</p><span class="price">${label}</span>`);
    if (hidden || (!owned && save.pearls < ch.price)) card.classList.add("locked");
    card.onclick = () => selectCharacter(ch);
    ui.shopGrid.append(card);
  }
}

// Shop previews loop each character's "float ↔ sink" animation.
function drawPreviews(list) {
  for (const { c, ch, hidden } of list) {
    const cx = c.getContext("2d");
    cx.clearRect(0, 0, c.width, c.height);
    const phase = Math.floor(time / 1.4) % 2 === 0;
    const vy = ch.mode === "glide" ? (phase ? -300 : 300) : Math.sin(time * 2) * 400;
    cx.save();
    cx.translate(60, 64);
    ch.draw(cx, { t: time, up: phase, vy, mood: "normal", pulse: Math.max(0, 1 - (time % 1.4) * 2), flash: Math.max(0, 1 - (time % 1.4) * 2), near: phase ? 0.6 : 0 });
    cx.restore();
    if (hidden) { // silhouette for the locked secret character
      cx.globalCompositeOperation = "source-atop";
      cx.fillStyle = "#0b1e3a";
      cx.fillRect(0, 0, c.width, c.height);
      cx.globalCompositeOperation = "source-over";
      cx.fillStyle = "#fff"; cx.font = "bold 34px system-ui"; cx.textAlign = "center";
      cx.fillText("?", 60, 76);
    }
  }
}

function selectCharacter(ch) {
  if (ch.secret && !save.owned.includes(ch.id)) { sfx.denied(); return; }
  if (!save.owned.includes(ch.id)) {
    if (save.pearls < ch.price) { sfx.denied(); return; }
    save.pearls -= ch.price;
    save.owned.push(ch.id);
    sfx.buy();
  } else sfx.click();
  save.char = ch.id;
  platform.save(save);
  checkFinale();
  renderShop();
  maybeShowFinale();
}

function adPearlsLeft() {
  const day = missions.today();
  if (!save.adPearls || save.adPearls.day !== day) save.adPearls = { day, count: 0 };
  return FREE_PEARLS_PER_DAY - save.adPearls.count;
}

function updateFreePearlsButton() {
  const left = adPearlsLeft();
  ui.freePearls.disabled = left <= 0;
  ui.freePearls.textContent = left > 0
    ? t("freePearls", { n: FREE_PEARLS, left, max: FREE_PEARLS_PER_DAY })
    : t("freePearlsOut");
}

async function freePearls() {
  if (adPearlsLeft() <= 0) return;
  ui.freePearls.disabled = true;
  const earned = await withAd(() => platform.rewarded());
  state = "shop";
  if (earned) {
    save.adPearls.count++;
    save.pearls += FREE_PEARLS;
    sfx.buy();
    platform.save(save);
  }
  renderShop();
}

// ---------- Sea Encyclopedia ----------
function renderDex() {
  ui.dexCount.textContent = `${save.dex.length} / ${CREATURES.length}`;
  const left = CREATURES.length - save.dex.length;
  $("dex-reward").innerHTML = left > 0
    ? t("dexLeft", { n: left })
    : t("dexDone");
  $("dex-bar").style.width = `${(save.dex.length / CREATURES.length) * 100}%`;
  ui.dexGrid.innerHTML = "";
  dexCanvases = [];
  CREATURES.forEach((c, i) => {
    const found = save.dex.includes(c.id);
    const zone = ZONES[c.zone];
    const card = document.createElement("div");
    card.className = `card dex-card zone-${c.zone} ${found ? "found" : "unknown"}`;
    card.insertAdjacentHTML("beforeend",
      `<div class="dex-head"><span class="dex-no">No. ${String(i + 1).padStart(2, "0")}</span><span class="dex-zone">${zone.icon} ${zone.name}</span></div>`);
    const cv = document.createElement("canvas");
    cv.width = 240; cv.height = 160;
    card.append(cv);
    dexCanvases.push({ cv, c, found, phase: i * 0.9 });
    card.insertAdjacentHTML("beforeend", found
      ? `<b>${c.name}</b><span class="fact">${c.fact}</span>`
      : `<b>???</b><span class="fact">${t("dexFindIn", { zone: zone.icon + " " + zone.name })}</span>`);
    ui.dexGrid.append(card);
  });
  drawDexPreviews();
}

// Discovered creatures swim in place; undiscovered ones show as a dark silhouette.
function drawDexPreviews() {
  for (const { cv, c, found, phase } of dexCanvases) {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2, cv.height / 2 + Math.sin(time * 1.6 + phase) * 4);
    c.draw(g, 150, time + phase);
    g.restore();
    if (!found) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(4,12,32,0.94)";
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "rgba(255,255,255,0.75)"; g.font = "900 40px system-ui"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("?", cv.width / 2, cv.height / 2);
    }
  }
}

// ---------- Main menu ----------
function renderMenu() {
  const stars = totalStars(save), maxStars = LEVELS.length * 3;
  const cleared = LEVELS.filter((L) => (save.levels?.[L.n] || 0) >= 1).length;
  $("menu-adv-sub").textContent = cleared >= LEVELS.length
    ? t("advSubDone", { s: stars, max: maxStars })
    : t("advSub", { n: cleared + 1, s: stars, max: maxStars });
  $("menu-free-sub").textContent = save.best > 0 ? t("freeSub", { m: save.best }) : t("freeSubNew");
  const stat = (icon, value, label, cls = "") => `<span class="stat" title="${t(label)}"><i>${icon}</i><span class="${cls}">${value}</span></span>`;
  $("menu-stats").innerHTML =
    stat("🦪", save.pearls, "statPearls") + stat("📏", `${save.best} m`, "statBest") +
    stat("★", `${stars}/${maxStars}`, "statStars", "st") + stat("📖", `${save.dex.length}/${CREATURES.length}`, "statDex");
}

// The selected character bobs next to the logo, puffing up and down.
function drawMenuLogo() {
  const cv = $("logo-hero"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  const ch = hero();
  const phase = Math.floor(time / 1.6) % 2 === 0;
  g.save();
  g.translate(cv.width / 2, cv.height / 2 + Math.sin(time * 2) * 6);
  g.scale(1.35, 1.35);
  ch.draw(g, { t: time, up: phase, vy: ch.mode === "glide" ? (phase ? -300 : 300) : Math.sin(time * 2) * 300, mood: "happy",
    pulse: Math.max(0, 1 - (time % 1.6) * 2), flash: 0, near: 0 });
  g.restore();
}

// ---------- Gameplay ----------
function flip() {
  if (state !== "play") return;
  const ch = hero();
  if (ch.mode === "pulse") {
    player.vy = -ch.impulse;
    player.pulse = 1;
    sfx.flip(true);
  } else if (ch.mode === "glide") {
    player.dir *= -1;
    player.up = player.dir < 0;
    sfx.flip(player.up);
  } else {
    player.up = !player.up;
    player.gravity = player.up ? -1 : 1;
    if (ch.jet) { // octopus: instant ink jet + brief invulnerability
      player.vy = player.gravity * ch.max * 0.7;
      player.invuln = Math.max(player.invuln, 0.25);
      fx.ink(scroll + player.x, player.y);
      inkBlast();
    } else player.vy *= 0.2;
    sfx.flip(player.up);
  }
  player.flash = 1;
  player.flips++;
  setMood("surprised", 0.25);
  if (!ch.jet) fx.puff(scroll + player.x, player.y);
}

// Grants the secret character once the encyclopedia is complete. Returns true if newly unlocked.
function unlockSecret() {
  if (save.dex.length < CREATURES.length || save.owned.includes(SECRET_ID)) return false;
  save.owned.push(SECRET_ID);
  platform.save(save);
  return true;
}

// ---------- Finale ----------
// Reached once every level is cleared, every character (Bubu included) is owned and
// the Encyclopedia is complete. Shown once, at a calm moment, then from the menu.
function gameComplete() {
  return LEVELS.every((L) => (save.levels?.[L.n] || 0) >= 1)
    && CHARACTERS.every((c) => save.owned.includes(c.id))
    && save.dex.length >= CREATURES.length;
}

function updateFinaleButton() { show($("menu-finale"), !!save.finale); }

function checkFinale() {
  if (save.finale || !gameComplete()) return;
  save.finale = true;
  pendingFinale = true;
  platform.save(save);
  updateFinaleButton();
}

function maybeShowFinale() {
  if (!pendingFinale) return false;
  pendingFinale = false;
  showFinale();
  return true;
}

function showFinale() {
  show($("level-done"), false); show(ui.shop, false); show(ui.over, false);
  openPanel($("finale"), ui.menu, renderFinale);
  sfx.discover();
  startConfetti();
}

function renderFinale() {
  const cleared = LEVELS.filter((L) => (save.levels?.[L.n] || 0) >= 1).length;
  const stars = totalStars(save), maxStars = LEVELS.length * 3;
  const chip = (v, label) => `<div class="chip"><b>${v}</b><span>${t(label)}</span></div>`;
  $("finale-stats").innerHTML =
    chip(`${cleared}/${LEVELS.length}`, "finaleLevels") + chip(`${stars}/${maxStars}`, "finaleStars") +
    chip(`${save.owned.length}/${CHARACTERS.length}`, "finaleChars") + chip(`${save.dex.length}/${CREATURES.length}`, "finaleCreatures") +
    chip(`${save.best} m`, "finaleBest");
  $("finale-note").textContent = stars >= maxStars ? t("finalePerfect") : t("finaleStarsLeft", { n: maxStars - stars });
  const row = $("finale-chars");
  row.innerHTML = "";
  finaleCanvases = [];
  for (const ch of CHARACTERS) {
    const c = document.createElement("canvas");
    c.width = c.height = 120;
    finaleCanvases.push({ c, ch, hidden: false });
    row.append(c);
  }
}

// Confetti: two cannons at the bottom corners, then a light shower from the top.
// Its own overlay canvas and rAF loop that only runs while the finale is open;
// skipped for prefers-reduced-motion, thinner in light graphics mode.
const CONFETTI_COLORS = ["#ffe27a", "#7ff0ff", "#ff9ab5", "#ffffff", "#9fe870", "#b9a2ff", "#ffb340"];
const confetti = { raf: 0, parts: [], last: 0, age: 0 };

function startConfetti() {
  stopConfetti();
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("confetti");
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  show(cv, true);
  sfx.confetti();
  confetti.parts = []; confetti.age = 0; confetti.last = performance.now();
  const n = lowGfx ? 45 : 90;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < n; i++) {
      const dir = side === 0 ? 1 : -1;
      const ang = (Math.PI / 180) * (58 + Math.random() * 24);          // 58–82° from the floor
      const sp = Math.sqrt(2 * 900 * cv.height * (0.6 + Math.random() * 0.45)); // peaks at 60–105% of the screen height
      spawnConfetti(side === 0 ? 0 : cv.width, cv.height + 10, Math.cos(ang) * sp * dir, -Math.sin(ang) * sp);
    }
  }
  confetti.raf = requestAnimationFrame(stepConfetti);
}

function spawnConfetti(x, y, vx, vy) {
  confetti.parts.push({
    x, y, vx, vy, w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
    rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10, flip: Math.random() * 6.28,
    color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
  });
}

function stepConfetti(now) {
  const cv = $("confetti"), g = cv.getContext("2d");
  const dt = Math.max(0, Math.min(0.05, (now - confetti.last) / 1000));   // rAF time can precede performance.now()
  confetti.last = now; confetti.age += dt;
  if (confetti.age > 0.6 && confetti.age < 4.5 && Math.random() < dt * (lowGfx ? 12 : 26)) { // top shower
    spawnConfetti(Math.random() * cv.width, -12, (Math.random() - 0.5) * 80, 40 + Math.random() * 60);
  }
  g.clearRect(0, 0, cv.width, cv.height);
  const next = [];
  for (const p of confetti.parts) {
    p.vy += 900 * dt;
    if (p.vy > 230) p.vy -= (p.vy - 230) * Math.min(1, 5 * dt);          // flutter down slowly
    p.vx *= Math.pow(0.35, dt);
    p.x += (p.vx + Math.sin(p.flip * 0.7) * 30) * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.flip += 7 * dt;
    if (p.y > cv.height + 24) continue;
    next.push(p);
    g.save();
    g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.flip));
    g.fillStyle = p.color;
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    g.restore();
  }
  confetti.parts = next;
  if (next.length || confetti.age < 4.5) confetti.raf = requestAnimationFrame(stepConfetti);
  else stopConfetti();
}

function stopConfetti() {
  cancelAnimationFrame(confetti.raf);
  confetti.raf = 0; confetti.parts = [];
  const cv = $("confetti");
  cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  show(cv, false);
}

// Bubu's whale song: scares off swordfish & hooks and freezes jellyfish nearby.
function whaleSong(ch) {
  const wx = scroll + player.x;
  fx.sonar(wx, player.y);
  fx.text(wx, player.y - 46, "♪ Whale song!", "#a8dcff");
  sfx.zone();
  player.flash = 1;
  mission("ability");
  for (const h of world.hazards) {
    if (Math.hypot(h.x - wx, (h.y ?? player.y) - player.y) > ch.sonar.radius || isHarmless(h, time)) continue;
    if ((h.type === "sword" && h.active) || h.type === "hook") h.fleeing = true;
    if (h.type === "jelly") h.stunUntil = time + 3;
  }
}

// Okto's ink: swordfish nearby flee, jellyfish nearby freeze for a moment.
function inkBlast() {
  const wx = scroll + player.x;
  let hit = false;
  for (const h of world.hazards) {
    if (Math.hypot(h.x - wx, (h.y ?? player.y) - player.y) > 380 || isHarmless(h, time)) continue;
    if (h.type === "sword" && h.active) { h.fleeing = true; hit = true; fx.text(h.x, h.y - 30, "Inked!", "#d6c8ff"); }
    if (h.type === "jelly") { h.stunUntil = time + 2.5; hit = true; fx.text(h.x, h.y - 34, "Frozen!", "#d6c8ff"); }
  }
  if (hit) { sfx.shieldPop(); mission("ability"); }
}

// Character ability vs. a hazard Puffy & friends are touching. Returns true if handled.
function useAbility(h) {
  const ch = hero();
  if (!ch.immune || !ch.immune(h, player)) return false;
  if (h.noted) return true;
  h.noted = true;
  switch (h.type) {
    case "sword":
      h.fleeing = true;
      sfx.denied();
      fx.text(h.x, h.y - 30, "Boing!", "#ffe27a");
      break;
    case "net": fx.text(scroll + player.x, player.y - 40, "Slipped through!", "#ffc98a"); sfx.click(); break;
    case "jelly": fx.text(h.x, h.y - 40, "Hi, buddy! 🪼", "#ff9fe0"); sfx.pearl(); break;
    case "hook": fx.text(h.x, h.y - 24, "Missed!", "#9fc3ff"); sfx.click(); break;
    case "bag":
      h.gone = true;
      fx.sparkle(h.x, h.y, "#7ffff0");
      if (mode === "endless") {
        save.pearls += 2;
        mission("pearls", 2);
        fx.text(h.x, h.y - 30, "Clean sea! +2 🦪", "#7ffff0");
      } else fx.text(h.x, h.y - 30, "Clean sea!", "#7ffff0");
      sfx.pearl();
      break;
  }
  setMood("happy", 0.6);
  mission("ability");
  return true;
}

function popShield() {
  mission("shield_pop");
  player.shield = false;
  player.invuln = 1.2;
  sfx.shieldPop();
  fx.ring(scroll + player.x, player.y);
  setMood("surprised", 0.6);
}

function update(dt) {
  if (mode === "endless" && !tut) speed += dt * 7;
  scroll += (tut && tut.step === 0 ? 0 : speed) * dt;   // the tutorial waits for the first taps
  updateTutorial();
  if (world.finishX && scroll + player.x >= world.finishX) return levelComplete();
  depth = Math.floor(scroll / PX_PER_M);
  extend(world, scroll + W * 2);
  updateWorld(world, dt, scroll, time);
  prune(world, scroll);

  const z = zoneIndex(depth);
  if (z !== zone && mode === "endless") {
    zone = z;
    banner(t("zoneBanner", { icon: ZONES[z].icon, name: ZONES[z].name, m: ZONES[z].from }));
    sfx.zone();
  }
  setTempo(96 + (speed - 400) / 8);
  setMuffle(Math.min(1, depth / 2000));

  if (player.invuln > 0) player.invuln -= dt;
  if (swapCooldown > 0) swapCooldown -= dt;
  if (skillCD > 0) skillCD -= dt;
  if (player.dash > 0) player.dash -= dt;
  effects = effects.filter((e) => (e.t += dt) < e.dur);
  for (const p of world.pickups) { // Kudi's whirl pulls pearls in
    if (!p.pulled || p.taken) continue;
    p.x += (scroll + player.x - p.x) * Math.min(1, dt * 8);
    p.y += (player.y - p.y) * Math.min(1, dt * 8);
  }
  if (player.moodT > 0 && (player.moodT -= dt) <= 0) player.mood = "normal";

  const ch = hero();
  const { hw, hh, r } = box();
  const wx = scroll + player.x;
  if (ch.mode === "glide") player.vy = player.dir * ch.speed;
  else {
    const g = ch.mode === "pulse" ? ch.g : ch.g * player.gravity;
    player.vy = Math.max(-ch.max, Math.min(ch.max, player.vy + g * dt));
  }
  player.y += player.vy * dt;
  player.tilt = ch.mode === "toggle" && ch.id === "puffy" ? player.vy / ch.max * 0.35 : 0;
  player.pulse = Math.max(0, player.pulse - dt * 3);
  if (ch.sonar && (player.sonarT -= dt) <= 0) { player.sonarT = ch.sonar.every; whaleSong(ch); }
  player.flash = Math.max(0, player.flash - dt * 2);

  // Swimming into the side of a wall (e.g. the far edge of a trench).
  const front = surfaceUnder(world, wx + hw - 4, wx + hw);
  const wallHit = (front.floor !== null && player.y + hh > front.floor + CLIMB) ||
                  (front.ceil !== null && player.y - hh < front.ceil - CLIMB);
  if (wallHit && player.invuln <= 0) {
    if (!player.shield) return gameOver("wall");
    popShield(); flip();
  }

  // Rest on seabed / ceiling (small steps are climbed automatically).
  const under = surfaceUnder(world, wx - hw + 6, wx + hw - 6);
  if (under.floor !== null && player.y + hh > under.floor) { player.y = under.floor - hh; player.vy = Math.min(player.vy, 0); }
  if (under.ceil !== null && player.y - hh < under.ceil) { player.y = under.ceil + hh; player.vy = Math.max(player.vy, 0); }

  // Sucked into a trench / thrown out of the water.
  if (player.y - hh > H || player.y + hh < 0) {
    if (player.shield) { popShield(); flip(); }
    else if (player.invuln <= 0) return gameOver("pit");
    player.y = Math.max(hh, Math.min(H - hh, player.y));
    player.vy = 0;
  }

  for (const h of world.hazards) {
    if (h.gone || isHarmless(h, time) || !hitsHazard(h, wx, player.y, r)) continue;
    if (player.dash > 0) { destroyHazard(h, "#9fc3ff"); continue; } // Mantra's charge
    if (h.tutorial) { destroyHazard(h); toast(t("tutOops"), 2200); player.invuln = 1; continue; }
    if (useAbility(h)) continue;
    if (player.invuln > 0) continue;
    if (player.shield) { popShield(); h.gone = true; continue; }
    return gameOver("hazard", h);
  }

  // Lumi's lure pulls nearby pearls in; its jaw opens as they approach.
  player.near = 0;
  if (boss) {
    const s = surfaceUnder(world, wx - 10, wx + 10);
    const startX = world.finishX - lvl.meters * PX_PER_M;
    bossCtx = {
      W, scroll, player: { x: player.x, y: player.y, worldX: wx },
      ceil: s.ceil ?? 90, floor: s.floor ?? H - 90,
      progress: (wx - startX) / (world.finishX - startX),
    };
    if (updateBoss(boss, dt, bossCtx).warn) sfx.denied();
    if (bossHits(boss, bossCtx) && player.invuln <= 0) {
      if (player.shield) popShield();
      else return gameOver("boss", { type: "boss_" + boss.def.key });
    }
  }

  for (const p of world.pickups) {
    if (p.kind !== "pearl" || p.taken) continue;
    const d = Math.hypot(p.x - wx, p.y - player.y);
    if (ch.magnet && d < ch.magnet) {
      p.x += (wx - p.x) * Math.min(1, dt * 6);
      p.y += (player.y - p.y) * Math.min(1, dt * 6);
    }
    if (d < 160) player.near = Math.max(player.near, 1 - d / 160);
  }

  for (const p of world.pickups) {
    if (p.taken || Math.hypot(p.x - wx, p.y + (p.bob || 0) - player.y) > p.r + r) continue;
    p.taken = true;
    if (p.kind === "pearl") {
      if (mode === "level") lvlPearls++; // Adventure: counts toward ★★, paid out as star bonus
      else save.pearls++;
      mission("pearls");
      sfx.pearl();
      fx.sparkle(p.x, p.y);
      setMood("happy", 0.4);
    } else if (p.kind === "shield") {
      if (!player.shield) { player.shield = true; sfx.shield(); }
      else { if (mode === "endless") save.pearls += 3; sfx.pearl(); }
      fx.sparkle(p.x, p.y, "#a8f4ff");
    } else if (p.kind === "creature") {
      const c = getCreature(p.id);
      mission("creature");
      fx.sparkle(p.x, p.y, "#fff6a8");
      setMood("happy", 1);
      if (!save.dex.includes(c.id)) {
        save.dex.push(c.id);
        platform.save(save);
        sfx.discover();
        toast(t("discovered", { name: c.name, fact: c.fact }), 5000);
        if (unlockSecret()) {
          setTimeout(() => {
            banner(t("secretBanner"));
            toast(t("secretToast"), 6000);
            sfx.buy();
          }, 2500);
        }
      } else {
        save.pearls += 5;
        sfx.pearl();
        toast(t("greets", { name: c.name }), 1800);
      }
    }
  }

  fx.trail(wx - hw, player.y, ch.color);
}

function drawPlayer() {
  const ch = hero();
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);
  if (player.invuln > 0 && Math.floor(time * 12) % 2) ctx.globalAlpha = 0.4;
  ch.draw(ctx, { t: time, up: player.up, vy: player.vy, mood: player.mood, pulse: player.pulse, flash: player.flash, near: player.near });
  ctx.restore();
  if (player.shield) {
    const r = box().r * 1.9 + Math.sin(time * 5) * 2;
    ctx.strokeStyle = "rgba(168,244,255,0.9)"; ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(168,244,255,0.15)";
    ctx.beginPath(); ctx.arc(player.x, player.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function draw(dt) {
  ctx.setTransform(gfxScale, 0, 0, gfxScale, 0, 0);
  ctx.save();
  if (shake > 0.3) {
    ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    shake *= Math.pow(0.002, dt);
  } else shake = 0;
  ctx.fillStyle = "#04122a";
  ctx.fillRect(-40, -40, W + 80, H + 80);

  drawBackground(ctx, scroll, depth, time);
  drawMoment(ctx, W, H, time);
  if (!lowGfx) drawAmbient(ctx, time, Math.min(1, Math.max(0, (depth - 500) / 1200)));
  drawTerrain(ctx, world, scroll, depth, time, dt, player.x, player.y);
  drawDarkness(ctx, depth, player.x, player.y, hero().light);
  drawFinish(ctx, world, scroll, time);
  drawHazards(ctx, world, scroll, time);
  if (boss && bossCtx && mode === "level" && state !== "menu") drawBoss(ctx, boss, bossCtx, time);
  drawPickups(ctx, world, scroll, time, getCreature);
  fx.draw(ctx, scroll);
  if (effects.length) drawEffects();
  if (state === "dying") {
    const anim = DEATHS[dying.key];
    ctx.save();
    ctx.translate(dying.x, dying.y);
    anim.draw(ctx, dying, Math.min(1, dying.t / anim.dur), heroSprite);
    ctx.restore();
  } else if (state !== "over" && state !== "ad") drawPlayer();
  ctx.restore();

  if (!["play", "paused", "swap", "dying", "over", "ad", "done"].includes(state)) ui.hud.textContent = "";
  else if (mode === "level") {
    const startX = world.finishX - lvl.meters * PX_PER_M;
    const k = Math.max(0, Math.min(1, (scroll + player.x - startX) / (world.finishX - startX)));
    ui.hud.textContent = `Lv ${lvl.n}  •  🦪 ${lvlPearls}/${world.pearlTotal}${player.shield ? "  •  🫧" : ""}`;
    $("progress-fill").style.width = `${k * 100}%`;
  } else ui.hud.textContent = `${depth} m  •  🦪 ${save.pearls}${player.shield ? "  •  🫧" : ""}`;
}

function loop(now) {
  autoGraphics((now - last) / 1000 || 0);
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  time += dt;
  updateSwapButton();
  show($("pause"), state === "play");
  updateSkillButton();
  if (state === "play") update(dt);
  else if (state === "dying") {
    const anim = DEATHS[dying.key];
    dying.t += dt;
    updateWorld(world, dt, scroll, time);
    anim.step(dying, dt, fx);
    if (dying.t >= anim.dur + 0.25) finishGameOver();
  }
  else if (state === "menu" || state === "finale") { // idle animation behind the title screen
    scroll += 60 * dt;
    updateWorld(world, dt, scroll, time);
    player.y = H - 140 + Math.sin(time * 2) * 6;
    player.vy = Math.cos(time * 2) * 12;
  }
  fx.update(dt);
  const swimSpeed = state === "play" ? speed : state === "menu" || state === "finale" ? 60 : 0;
  updateAmbient(dt, zoneIndex(depth), W, H, swimSpeed);
  const ev = updateMoments(dt, zoneIndex(depth), state === "play");
  if (ev && ev.started) {
    const m = ev.started.def;
    toast(t("momentToast", { icon: m.icon, name: m.name }), 4000);
    (sfx[m.sound] || sfx.zone)();
  } else if (ev && ev.ended && state === "play") { // witnessed it to the end
    const paid = mode === "endless"; // Adventure pays out through star bonuses only
    if (paid) save.pearls += MOMENT_REWARD;
    fx.text(scroll + player.x, player.y - 50, `${t("momentSeen", { icon: ev.ended.def.icon })}${paid ? ` +${MOMENT_REWARD} 🦪` : ""}`, "#fff6a8");
    sfx.pearl();
    mission("moment");
  }
  draw(dt);
  if (state === "shop") drawPreviews(shopCanvases);
  else if (state === "finale") drawPreviews(finaleCanvases);
  else if (state === "dex") drawDexPreviews();
  else if (state === "menu") {
    drawMenuLogo();
    if (time - menuRenderedAt > 0.5 || time < menuRenderedAt) { menuRenderedAt = time; renderMenu(); }
  }
  requestAnimationFrame(loop);
}

async function boot() {
  applyStatic();
  resize();
  addEventListener("resize", resize);
  platform = await createPlatform();
  const loaded = await platform.load();
  if (loaded.coins !== undefined) { // saves from the earlier "coins" version
    if (loaded.pearls === undefined) loaded.pearls = loaded.coins;
    delete loaded.coins;
  }
  save = Object.assign(save, loaded);
  delete save.skin; // skins were replaced by characters
  if (!Array.isArray(save.owned)) save.owned = [];
  save.owned = save.owned.filter((id) => CHARACTERS.some((c) => c.id === id));
  if (!save.owned.includes("puffy")) save.owned.unshift("puffy");
  if (!save.owned.includes(save.char)) save.char = "puffy";
  if (!Array.isArray(save.dex)) save.dex = [];
  save.owned = save.owned.filter((id) => id !== SECRET_ID || save.dex.length >= CREATURES.length);
  unlockSecret();
  checkFinale();
  pendingFinale = false;   // an already-complete save just gets the 🏆 button
  updateFinaleButton();
  if (!save.owned.includes(save.char)) save.char = "puffy";
  reset();

  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
  canvas.addEventListener("pointerdown", flip);
  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flip(); }
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "play") pauseGame(); else if (state === "paused") resumeGame(); }
    if (e.code === "KeyX") useSkill();
    if (e.code === "KeyC") { if (state === "swap") closeSwap(); else openSwap(); }
  });

  const muteBtn = $("mute");
  const muteLabel = () => { muteBtn.textContent = isMuted() ? "🔇" : "🔊"; };
  muteLabel();
  muteBtn.onclick = (e) => { e.stopPropagation(); toggleMute(); muteLabel(); muteBtn.blur(); };

  ui.play.onclick = () => { sfx.click(); startEndless(); };
  applyGraphics(settings.graphics === "low");
  document.querySelectorAll(".open-settings").forEach((b) => { b.onclick = () => openSettings(b.closest(".panel")); });
  $("settings-close").onclick = closeSettings;
  $("set-music").onclick = () => toggleSetting("music");
  $("set-sfx").onclick = () => toggleSetting("sfx");
  $("set-vibrate").onclick = () => { toggleSetting("vibrate"); vibrate(40); };
  $("set-gfx").onclick = () => {
    const order = ["auto", "high", "low"];
    settings.graphics = order[(order.indexOf(settings.graphics) + 1) % order.length];
    saveSettings();
    applyGraphics(settings.graphics === "low");
    sfx.click();
    renderSettings();
  };
  $("set-reset").onclick = () => {
    if (!resetArmed) { resetArmed = true; sfx.denied(); renderSettings(); return; }
    try { localStorage.removeItem("hop_save"); } catch (e) {}
    location.reload();
  };
  $("swap").onclick = (e) => { e.stopPropagation(); $("swap").blur(); openSwap(); };
  $("swap-close").onclick = closeSwap;
  $("skill").addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); useSkill(); });
  document.querySelectorAll(".open-levels").forEach((b) => { b.onclick = () => openPanel($("levels"), b.closest(".panel"), renderLevels); });
  $("levels-close").onclick = () => closePanel($("levels"));
  $("done-next").onclick = nextLevel;
  $("done-retry").onclick = () => { if (!maybeShowFinale()) startLevel(lvl.n); };
  $("done-map").onclick = () => { if (maybeShowFinale()) return; show($("level-done"), false); state = "menu"; openPanel($("levels"), ui.menu, renderLevels); };
  $("over-map").onclick = () => openPanel($("levels"), ui.menu, renderLevels);
  ui.retry.onclick = retry;
  ui.revive.onclick = revive;
  document.querySelectorAll(".shield-start").forEach((b) => { b.onclick = () => startWithShield(b.closest(".panel")); });
  document.querySelectorAll(".open-shop").forEach((b) => { b.onclick = () => openPanel(ui.shop, b.closest(".panel"), renderShop); });
  document.querySelectorAll(".open-dex").forEach((b) => { b.onclick = () => openPanel(ui.dex, b.closest(".panel"), renderDex); });
  document.querySelectorAll(".open-missions").forEach((b) => { b.onclick = () => openPanel($("missions"), b.closest(".panel"), renderMissions); });
  $("missions-close").onclick = () => closePanel($("missions"));
  $("menu-finale").onclick = () => { sfx.click(); showFinale(); };
  $("finale-close").onclick = () => { sfx.click(); stopConfetti(); closePanel($("finale")); };
  missions.ensureDaily(save);
  updateMissionBadges();
  ui.shopClose.onclick = () => closePanel(ui.shop);
  ui.dexClose.onclick = () => closePanel(ui.dex);
  ui.freePearls.onclick = freePearls;
  updateFreePearlsButton();

  // Switching tabs / a phone notification pauses the dive instead of ending it.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") pauseGame(true);
  });
  $("pause").onclick = (e) => { e.stopPropagation(); $("pause").blur(); pauseGame(); };
  $("pause-resume").onclick = resumeGame;
  $("pause-quit").onclick = quitToMenu;

  // Dev helper (?debug): lets automated tests read the boss & player state.
  if (devFlag("debug")) window.__dbg = () => ({ boss, bossCtx, player, state, world, scroll, time, gameOver, levelComplete, save, unlockSecret });

  if (platform.onMuteChange) platform.onMuteChange(setPlatformMuted);
  platform.loadingFinished();
  $("platform").textContent = platform.name;
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
