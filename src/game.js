// "Puffy: Petualangan Laut Dalam" — one-tap hyper-casual deep-sea runner.
// Tap / click / space: Puffy inflates (floats up) or deflates (sinks down).
// Avoid hazards, collect pearls, grab shield bubbles, discover rare creatures.
import { createPlatform } from "./sdk/adapter.js";
import { CHARACTERS, getCharacter } from "./characters.js";
import { CREATURES, getCreature } from "./creatures.js";

const SECRET_ID = "bubu";
import {
  sfx, unlock, toggleMute, isMuted, setAdPlaying, startMusic, stopMusic, setTempo, setMuffle,
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
  drawBackground, drawTerrain, drawDarkness, drawHazards, drawPickups, drawFinish, useSeed,
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
const FREE_PEARLS = 25;        // reward for watching an ad in the shop
const CLIMB = 48;              // step height Puffy swims over automatically
// Dev helper: ?start=1000 begins the dive at 1000 m to test deeper zones.
const START_M = Number(new URLSearchParams(location.search).get("start")) || 0;

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
const hero = () => getCharacter(save.char);

function reset(withShield = false) {
  player = {
    x: 260, y: H - 140, vy: 0, up: false, gravity: 1, dir: 1,
    shield: withShield, invuln: 0, mood: "normal", moodT: 0, tilt: 0,
    pulse: 0, flash: 0, near: 0, sonarT: 3, flips: 0,
  };
  if (mode === "level") {
    useSeed(lvl.seed); // same layout on every attempt
    const { startX, opts } = worldOptions(lvl);
    scroll = startX;
    world = createWorld(save.dex, scroll, opts);
    speed = 390 + lvl.difficulty * 90;
    zone = lvl.zone;
  } else {
    useSeed(null);
    scroll = START_M * PX_PER_M;
    world = createWorld(save.dex, scroll);
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
    toast(`🎯 <b>Misi selesai!</b> ${m.text}<br>Ambil +${m.reward} 🦪 di menu 🎯 Misi`, 3500);
  }
  const streakDay = done.length ? missions.checkStreak(save) : 0;
  if (streakDay) {
    platform.save(save);
    setTimeout(() => {
      banner(`🔥 Streak ${streakDay} hari!`);
      toast(`🔥 <b>Semua misi hari ini selesai!</b><br>Bonus streak hari ke-${streakDay}: +${missions.streakReward(streakDay)} 🦪 menunggu di menu 🎯 Misi`, 4500);
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
    dots += `<div class="s-day ${cls}"><b>${i === 7 ? "🎁" : "Hari " + i}</b><span>${missions.streakReward(day)} 🦪</span></div>`;
  }
  const status = st.doneToday
    ? `Streak hari ini aman! Kembali besok untuk hari ke-${st.count + 1} 🔥`
    : st.count > 0
      ? `Selesaikan ketiga misi hari ini agar streak tidak putus!`
      : `Selesaikan ketiga misi hari ini untuk memulai streak!`;
  box.innerHTML = `<div class="s-head">🔥 Streak: <b>${st.count}</b> hari</div><div class="s-row">${dots}</div><div class="s-status">${status}</div><div class="s-actions"></div>`;
  if (st.doneToday && !st.claimed) {
    const reward = missions.streakReward(st.count);
    const claim = document.createElement("button");
    claim.className = "alt small";
    claim.textContent = `Ambil bonus +${reward} 🦪`;
    claim.onclick = () => claimStreak(1);
    const double = document.createElement("button");
    double.className = "ghost small";
    double.textContent = `🎬 x2 (+${reward * 2})`;
    double.onclick = () => claimStreak(2);
    box.querySelector(".s-actions").append(claim, double);
  } else if (st.doneToday) {
    box.querySelector(".s-actions").innerHTML = `<span class="m-done">✅ Bonus hari ini sudah diambil</span>`;
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
  toast(`🔥 Bonus streak +${reward} 🦪!`, 1800);
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
    if (d.claimed) actions.innerHTML = `<span class="m-done">✅ Hadiah diambil</span>`;
    else if (d.done) {
      const claim = document.createElement("button");
      claim.className = "alt small";
      claim.textContent = `Ambil +${d.reward} 🦪`;
      claim.onclick = () => claimMission(i, 1);
      const double = document.createElement("button");
      double.className = "ghost small";
      double.textContent = `🎬 x2 (+${d.reward * 2})`;
      double.onclick = () => claimMission(i, 2);
      actions.append(claim, double);
    } else actions.innerHTML = `<span class="m-reward">Hadiah: ${d.reward} 🦪</span>`;
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
  toast(`+${reward} 🦪 masuk ke kantong!`, 1800);
}

function startRun(withShield = false) {
  reset(withShield);
  announce(missions.trackCharacter(save, save.char));
  resetMoments();
  state = "play";
  show(ui.menu, false); show(ui.over, false); show(ui.toast, false);
  fx.clear();
  startMusic();
  platform.gameplayStart();
  if (mode === "level") banner(`🗺️ Level ${lvl.n}: ${lvl.name}`);
  if (boss) {
    const d = boss.def;
    setTimeout(() => {
      if (state !== "play") return;
      banner(`👑 BOS: ${d.icon} ${d.name}!`);
      toast("Bagian yang <b>berkedip merah</b> akan diserang — pindah ke sisi lain! Bertahanlah sampai 🏁", 3800);
      sfx.abyss();
    }, 2300);
  }
  else banner(`${ZONES[zone].icon} ${ZONES[zone].name}`);
  show($("progress"), mode === "level");
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
  mission("depth", depth);
  mission("flips", player.flips);
  sfx.discover();
  for (let i = 0; i < 4; i++) fx.sparkle(scroll + player.x + 40, player.y, ["#ffe27a", "#7ff0ff", "#ff9ab5", "#fff"][i]);

  $("done-title").textContent = `Level ${lvl.n} selesai!`;
  $("done-name").textContent = lvl.name;
  $("done-stars").innerHTML = [1, 2, 3].map((i) => `<span class="star ${i <= stars ? "on" : ""}" style="animation-delay:${i * 0.25}s">★</span>`).join("");
  $("done-info").innerHTML = `
    <div>${pearlOk ? "✅" : "▫️"} Mutiara ${lvlPearls} / ${world.pearlTotal} (butuh ${Math.round(STAR_PEARL_RATIO * 100)}%)</div>
    <div>${clean ? "✅" : "▫️"} Tanpa kalah (tanpa "Lanjutkan")</div>
    ${boss ? `<div>👑 Berhasil lolos dari ${boss.def.icon} ${boss.def.name}!</div>` : ""}
    <div class="done-reward">${reward ? `+${reward} 🦪 untuk ${gained} bintang baru!` : "Coba raih bintang yang belum didapat!"}</div>`;
  const next = LEVELS[lvl.n];
  show($("done-next"), !!next);
  show($("level-done"), true);
}

async function nextLevel() {
  show($("level-done"), false);
  if (runs % INTERSTITIAL_EVERY === 0 && Date.now() - lastAdAt > MIN_AD_GAP_MS) {
    await withAd(() => platform.interstitial());
    lastAdAt = Date.now();
  }
  startLevel(lvl.n + 1);
}

function addShake(amount) { shake = Math.max(shake, amount); }
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

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
    $("over-level").textContent = `🗺️ Level ${lvl.n}: ${lvl.name} — ${Math.min(done, lvl.meters)} / ${lvl.meters} m`;
  }
  $("over-title").textContent = `Aduh, ${hero().name}!`;
  $("over-cause").textContent = dying ? dying.label : "";
  ui.final.textContent = depth;
  ui.best.textContent = save.best;
  ui.pearls.textContent = save.pearls;
  show(ui.revive, !revived);
  show(ui.over, true);
}

async function withAd(fn) {
  state = "ad";
  setAdPlaying(true);
  try { return await fn(); }
  finally { setAdPlaying(false); }
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
    const label = equipped ? "Dipakai" : owned ? "Pakai"
      : hidden ? `🔒 Lengkapi Ensiklopedia (${save.dex.length}/${CREATURES.length})` : `🦪 ${ch.price}`;
    card.append(c);
    card.insertAdjacentHTML("beforeend", hidden
      ? `<b>??? <small>Karakter Rahasia</small></b><p class="desc">Temukan semua makhluk di 📖 Ensiklopedia Laut untuk membukanya.</p><p class="ability">⚡ ???</p><span class="price">${label}</span>`
      : `<b>${ch.name} <small>${ch.species}</small></b><p class="desc">${ch.desc}</p><p class="ability">⚡ ${ch.ability}</p><span class="price">${label}</span>`);
    if (hidden || (!owned && save.pearls < ch.price)) card.classList.add("locked");
    card.onclick = () => selectCharacter(ch);
    ui.shopGrid.append(card);
  }
}

// Shop previews loop each character's "float ↔ sink" animation.
function drawShopPreviews() {
  for (const { c, ch, hidden } of shopCanvases) {
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
  renderShop();
}

async function freePearls() {
  ui.freePearls.disabled = true;
  const earned = await withAd(() => platform.rewarded());
  state = "shop";
  ui.freePearls.disabled = false;
  if (earned) {
    save.pearls += FREE_PEARLS;
    sfx.buy();
    platform.save(save);
  }
  renderShop();
}

// ---------- Ensiklopedia Laut ----------
function renderDex() {
  ui.dexCount.textContent = `${save.dex.length} / ${CREATURES.length}`;
  const left = CREATURES.length - save.dex.length;
  $("dex-reward").innerHTML = left > 0
    ? `🔒 Temukan <b>${left}</b> makhluk lagi untuk membuka <b>karakter rahasia</b>!`
    : `🐋 Lengkap! <b>Bubu si Paus Biru Mini</b> sudah terbuka di menu 🐠 Karakter.`;
  ui.dexGrid.innerHTML = "";
  for (const c of CREATURES) {
    const found = save.dex.includes(c.id);
    const card = document.createElement("div");
    card.className = "card dex-card" + (found ? "" : " unknown");
    if (found) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 96;
      const cx = cv.getContext("2d");
      cx.translate(48, 48);
      c.draw(cx, 76);
      card.append(cv);
      card.insertAdjacentHTML("beforeend", `<b>${c.name}</b><span>${c.fact}</span>`);
    } else {
      card.insertAdjacentHTML("beforeend", `<div class="q">❓</div><b>???</b><span>Temukan di ${ZONES[c.zone].icon} ${ZONES[c.zone].name}</span>`);
    }
    ui.dexGrid.append(card);
  }
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

// Bubu's whale song: scares off swordfish & hooks and freezes jellyfish nearby.
function whaleSong(ch) {
  const wx = scroll + player.x;
  fx.sonar(wx, player.y);
  fx.text(wx, player.y - 46, "♪ Nyanyian paus!", "#a8dcff");
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
    if (h.type === "sword" && h.active) { h.fleeing = true; hit = true; fx.text(h.x, h.y - 30, "Buta tinta!", "#d6c8ff"); }
    if (h.type === "jelly") { h.stunUntil = time + 2.5; hit = true; fx.text(h.x, h.y - 34, "Beku!", "#d6c8ff"); }
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
      fx.text(h.x, h.y - 30, "Boing! Memantul", "#ffe27a");
      break;
    case "net": fx.text(scroll + player.x, player.y - 40, "Lolos dari jaring!", "#ffc98a"); sfx.click(); break;
    case "jelly": fx.text(h.x, h.y - 40, "Halo, teman! 🪼", "#ff9fe0"); sfx.pearl(); break;
    case "hook": fx.text(h.x, h.y - 24, "Meleset!", "#9fc3ff"); sfx.click(); break;
    case "bag":
      h.gone = true;
      save.pearls += 2;
      mission("pearls", 2);
      fx.sparkle(h.x, h.y, "#7ffff0");
      fx.text(h.x, h.y - 30, "Laut bersih! +2 🦪", "#7ffff0");
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
  if (mode === "endless") speed += dt * 7;
  scroll += speed * dt;
  if (world.finishX && scroll + player.x >= world.finishX) return levelComplete();
  depth = Math.floor(scroll / PX_PER_M);
  extend(world, scroll + W * 2);
  updateWorld(world, dt, scroll, time);
  prune(world, scroll);

  const z = zoneIndex(depth);
  if (z !== zone && mode === "endless") {
    zone = z;
    banner(`${ZONES[z].icon} ${ZONES[z].name} · ${ZONES[z].from} m`);
    sfx.zone();
  }
  setTempo(96 + (speed - 400) / 8);
  setMuffle(Math.min(1, depth / 2000));

  if (player.invuln > 0) player.invuln -= dt;
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
      save.pearls++;
      lvlPearls++;
      mission("pearls");
      sfx.pearl();
      fx.sparkle(p.x, p.y);
      setMood("happy", 0.4);
    } else if (p.kind === "shield") {
      if (!player.shield) { player.shield = true; sfx.shield(); }
      else { save.pearls += 3; sfx.pearl(); }
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
        toast(`📖 <b>Penemuan baru: ${c.name}!</b><br>${c.fact}`, 5000);
        if (unlockSecret()) {
          setTimeout(() => {
            banner("🐋 Karakter rahasia terbuka!");
            toast("🎉 <b>Ensiklopedia lengkap!</b><br>Bubu si Paus Biru Mini kini bisa dipilih di menu 🐠 Karakter.", 6000);
            sfx.buy();
          }, 2500);
        }
      } else {
        save.pearls += 5;
        sfx.pearl();
        toast(`${c.name} menyapa! +5 🦪`, 1800);
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
  ctx.save();
  if (shake > 0.3) {
    ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    shake *= Math.pow(0.002, dt);
  } else shake = 0;
  ctx.fillStyle = "#04122a";
  ctx.fillRect(-40, -40, W + 80, H + 80);

  drawBackground(ctx, scroll, depth, time);
  drawMoment(ctx, W, H, time);
  drawAmbient(ctx, time, Math.min(1, Math.max(0, (depth - 500) / 1200)));
  drawTerrain(ctx, world, scroll, depth, time, dt, player.x, player.y);
  drawDarkness(ctx, depth, player.x, player.y, hero().light);
  drawFinish(ctx, world, scroll, time);
  drawHazards(ctx, world, scroll, time);
  if (boss && bossCtx && mode === "level" && state !== "menu") drawBoss(ctx, boss, bossCtx, time);
  drawPickups(ctx, world, scroll, time, getCreature);
  fx.draw(ctx, scroll);
  if (state === "dying") {
    const anim = DEATHS[dying.key];
    ctx.save();
    ctx.translate(dying.x, dying.y);
    anim.draw(ctx, dying, Math.min(1, dying.t / anim.dur), heroSprite);
    ctx.restore();
  } else if (state !== "over" && state !== "ad") drawPlayer();
  ctx.restore();

  if (state === "menu") ui.hud.textContent = "";
  else if (mode === "level") {
    const startX = world.finishX - lvl.meters * PX_PER_M;
    const k = Math.max(0, Math.min(1, (scroll + player.x - startX) / (world.finishX - startX)));
    ui.hud.textContent = `Lv ${lvl.n}  •  🦪 ${lvlPearls}/${world.pearlTotal}${player.shield ? "  •  🫧" : ""}`;
    $("progress-fill").style.width = `${k * 100}%`;
  } else ui.hud.textContent = `${depth} m  •  🦪 ${save.pearls}${player.shield ? "  •  🫧" : ""}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  time += dt;
  if (state === "play") update(dt);
  else if (state === "dying") {
    const anim = DEATHS[dying.key];
    dying.t += dt;
    updateWorld(world, dt, scroll, time);
    anim.step(dying, dt, fx);
    if (dying.t >= anim.dur + 0.25) finishGameOver();
  }
  else if (state === "menu") { // idle animation behind the title screen
    scroll += 60 * dt;
    updateWorld(world, dt, scroll, time);
    player.y = H - 140 + Math.sin(time * 2) * 6;
    player.vy = Math.cos(time * 2) * 12;
  }
  fx.update(dt);
  const swimSpeed = state === "play" ? speed : state === "menu" ? 60 : 0;
  updateAmbient(dt, zoneIndex(depth), W, H, swimSpeed);
  const ev = updateMoments(dt, zoneIndex(depth), state === "play");
  if (ev && ev.started) {
    const m = ev.started.def;
    toast(`✨ <b>Momen langka!</b> ${m.icon} ${m.name}`, 4000);
    (sfx[m.sound] || sfx.zone)();
  } else if (ev && ev.ended && state === "play") { // witnessed it to the end
    save.pearls += MOMENT_REWARD;
    fx.text(scroll + player.x, player.y - 50, `${ev.ended.def.icon} Saksi momen langka! +${MOMENT_REWARD} 🦪`, "#fff6a8");
    sfx.pearl();
    mission("moment");
  }
  draw(dt);
  if (state === "shop") drawShopPreviews();
  requestAnimationFrame(loop);
}

async function boot() {
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
  if (!save.owned.includes(save.char)) save.char = "puffy";
  reset();

  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
  canvas.addEventListener("pointerdown", flip);
  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flip(); }
  });

  const muteBtn = $("mute");
  const muteLabel = () => { muteBtn.textContent = isMuted() ? "🔇" : "🔊"; };
  muteLabel();
  muteBtn.onclick = (e) => { e.stopPropagation(); toggleMute(); muteLabel(); muteBtn.blur(); };

  ui.play.onclick = () => { sfx.click(); startEndless(); };
  document.querySelectorAll(".open-levels").forEach((b) => { b.onclick = () => openPanel($("levels"), b.closest(".panel"), renderLevels); });
  $("levels-close").onclick = () => closePanel($("levels"));
  $("done-next").onclick = nextLevel;
  $("done-retry").onclick = () => startLevel(lvl.n);
  $("done-map").onclick = () => { show($("level-done"), false); state = "menu"; openPanel($("levels"), ui.menu, renderLevels); };
  $("over-map").onclick = () => openPanel($("levels"), ui.menu, renderLevels);
  ui.retry.onclick = retry;
  ui.revive.onclick = revive;
  document.querySelectorAll(".shield-start").forEach((b) => { b.onclick = () => startWithShield(b.closest(".panel")); });
  document.querySelectorAll(".open-shop").forEach((b) => { b.onclick = () => openPanel(ui.shop, b.closest(".panel"), renderShop); });
  document.querySelectorAll(".open-dex").forEach((b) => { b.onclick = () => openPanel(ui.dex, b.closest(".panel"), renderDex); });
  document.querySelectorAll(".open-missions").forEach((b) => { b.onclick = () => openPanel($("missions"), b.closest(".panel"), renderMissions); });
  $("missions-close").onclick = () => closePanel($("missions"));
  missions.ensureDaily(save);
  updateMissionBadges();
  ui.shopClose.onclick = () => closePanel(ui.shop);
  ui.dexClose.onclick = () => closePanel(ui.dex);
  ui.freePearls.onclick = freePearls;
  ui.freePearls.textContent = `🎬 +${FREE_PEARLS} mutiara (tonton iklan)`;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") gameOver("hidden");
  });

  // Dev helper (?debug): lets automated tests read the boss & player state.
  if (new URLSearchParams(location.search).has("debug")) window.__dbg = () => ({ boss, bossCtx, player, state });

  platform.loadingFinished();
  $("platform").textContent = platform.name;
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
