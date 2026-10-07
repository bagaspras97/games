// "Puffy: Petualangan Laut Dalam" — one-tap hyper-casual deep-sea runner.
// Tap / click / space: Puffy inflates (floats up) or deflates (sinks down).
// Avoid hazards, collect pearls, grab shield bubbles, discover rare creatures.
import { createPlatform } from "./sdk/adapter.js";
import { SKINS, getSkin } from "./skins.js";
import { CREATURES, getCreature } from "./creatures.js";
import {
  sfx, unlock, toggleMute, isMuted, setAdPlaying, startMusic, stopMusic, setTempo, setMuffle,
} from "./audio.js";
import * as fx from "./particles.js";
import {
  W, H, PX_PER_M, ZONES, zoneIndex, createWorld, extend, prune, surfaceUnder, updateWorld, hitsHazard,
  drawBackground, drawTerrain, drawDarkness, drawHazards, drawPickups,
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
const GRAVITY = 2000;          // water: a bit softer than air
const MAX_FALL = 760;
const SIZE_PUFFED = 56, SIZE_SLIM = 42;
const CLIMB = 48;              // step height Puffy swims over automatically
// Dev helper: ?start=1000 begins the dive at 1000 m to test deeper zones.
const START_M = Number(new URLSearchParams(location.search).get("start")) || 0;

let platform;
let save = { best: 0, pearls: 0, skin: "classic", owned: ["classic"], dex: [] };
let state = "menu";            // menu | play | over | ad | shop | dex
let panelReturn = null;        // panel to show again when shop/dex closes
let runs = 0, lastAdAt = 0, revived = false;
let player, world, scroll, speed, depth, last, time = 0, zone = 0;
let shake = 0;

function reset(withShield = false) {
  player = {
    x: 260, y: H - 140, vy: 0, puffed: false, gravity: 1,
    shield: withShield, invuln: 0, mood: "normal", moodT: 0, tilt: 0,
  };
  scroll = START_M * PX_PER_M;
  world = createWorld(save.dex, scroll);
  speed = 400; depth = START_M; zone = zoneIndex(START_M);
  extend(world, scroll + W * 2);
  revived = false;
}

const size = () => (player.puffed ? SIZE_PUFFED : SIZE_SLIM);
const halfH = () => (player.puffed ? SIZE_PUFFED * 0.5 : SIZE_SLIM * 0.34);
const halfW = () => size() * 0.5;
const hitR = () => (player.puffed ? SIZE_PUFFED * 0.44 : SIZE_SLIM * 0.36);

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

function startRun(withShield = false) {
  reset(withShield);
  state = "play";
  show(ui.menu, false); show(ui.over, false); show(ui.toast, false);
  fx.clear();
  startMusic();
  platform.gameplayStart();
  banner(`${ZONES[zone].icon} ${ZONES[zone].name}`);
}

function addShake(amount) { shake = Math.max(shake, amount); }
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// cause: "hazard" | "wall" | "pit" | "hidden". Shake & vibration only when touching a hazard.
function gameOver(cause) {
  state = "over";
  stopMusic();
  if (cause !== "hidden") {
    sfx.death();
    addShake(22);
    vibrate([60, 40, 90]);
    setMood("dead", 99);
    fx.explode(scroll + player.x, player.y, [getSkin(save.skin).color, "#ffffff", "#ffb3c7"]);
  }
  platform.gameplayStop();
  runs++;
  save.best = Math.max(save.best, depth);
  platform.save(save);
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
    player.puffed = false; player.gravity = 1; player.vy = 0;
    player.y = surfaceUnder(world, wx - 30, wx + 30).floor - halfH();
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
  state = panel === ui.shop ? "shop" : "dex";
  show(ui.menu, false); show(ui.over, false);
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
  for (const skin of SKINS) {
    const owned = save.owned.includes(skin.id);
    const equipped = save.skin === skin.id;
    const card = document.createElement("button");
    card.className = "card" + (equipped ? " equipped" : "");
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const cx = c.getContext("2d");
    cx.translate(50, 52);
    skin.draw(cx, 52, true, "normal");
    const label = equipped ? "Dipakai" : owned ? "Pakai" : `🦪 ${skin.price}`;
    card.append(c);
    card.insertAdjacentHTML("beforeend", `<b>${skin.name}</b><span>${label}</span>`);
    if (!owned && save.pearls < skin.price) card.classList.add("locked");
    card.onclick = () => selectSkin(skin);
    ui.shopGrid.append(card);
  }
}

function selectSkin(skin) {
  if (!save.owned.includes(skin.id)) {
    if (save.pearls < skin.price) { sfx.denied(); return; }
    save.pearls -= skin.price;
    save.owned.push(skin.id);
    sfx.buy();
  } else sfx.click();
  save.skin = skin.id;
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
  player.puffed = !player.puffed;
  player.gravity = player.puffed ? -1 : 1;
  player.vy *= 0.2;
  sfx.flip(player.puffed);
  setMood("surprised", 0.25);
  fx.puff(scroll + player.x, player.y);
}

function popShield() {
  player.shield = false;
  player.invuln = 1.2;
  sfx.shieldPop();
  fx.ring(scroll + player.x, player.y);
  setMood("surprised", 0.6);
}

function update(dt) {
  speed += dt * 7;
  scroll += speed * dt;
  depth = Math.floor(scroll / PX_PER_M);
  extend(world, scroll + W * 2);
  updateWorld(world, dt, scroll, time);
  prune(world, scroll);

  const z = zoneIndex(depth);
  if (z !== zone) {
    zone = z;
    banner(`${ZONES[z].icon} ${ZONES[z].name} · ${ZONES[z].from} m`);
    sfx.zone();
  }
  setTempo(96 + (speed - 400) / 8);
  setMuffle(Math.min(1, depth / 2000));

  if (player.invuln > 0) player.invuln -= dt;
  if (player.moodT > 0 && (player.moodT -= dt) <= 0) player.mood = "normal";

  const hh = halfH(), hw = halfW();
  const wx = scroll + player.x;
  player.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, player.vy + GRAVITY * player.gravity * dt));
  player.y += player.vy * dt;
  player.tilt = player.vy / MAX_FALL * 0.35;

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

  const r = hitR();
  for (const h of world.hazards) {
    if (h.gone || !hitsHazard(h, wx, player.y, r)) continue;
    if (player.invuln > 0) continue;
    if (player.shield) { popShield(); h.gone = true; continue; }
    return gameOver("hazard");
  }

  for (const p of world.pickups) {
    if (p.taken || Math.hypot(p.x - wx, p.y + (p.bob || 0) - player.y) > p.r + r) continue;
    p.taken = true;
    if (p.kind === "pearl") {
      save.pearls++;
      sfx.pearl();
      fx.sparkle(p.x, p.y);
      setMood("happy", 0.4);
    } else if (p.kind === "shield") {
      if (!player.shield) { player.shield = true; sfx.shield(); }
      else { save.pearls += 3; sfx.pearl(); }
      fx.sparkle(p.x, p.y, "#a8f4ff");
    } else if (p.kind === "creature") {
      const c = getCreature(p.id);
      fx.sparkle(p.x, p.y, "#fff6a8");
      setMood("happy", 1);
      if (!save.dex.includes(c.id)) {
        save.dex.push(c.id);
        platform.save(save);
        sfx.discover();
        toast(`📖 <b>Penemuan baru: ${c.name}!</b><br>${c.fact}`, 5000);
      } else {
        save.pearls += 5;
        sfx.pearl();
        toast(`${c.name} menyapa! +5 🦪`, 1800);
      }
    }
  }

  fx.trail(wx - hw, player.y, getSkin(save.skin).color);
}

function drawPlayer() {
  const skin = getSkin(save.skin);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);
  if (player.invuln > 0 && Math.floor(time * 12) % 2) ctx.globalAlpha = 0.4;
  skin.draw(ctx, size(), player.puffed, player.mood);
  ctx.restore();
  if (player.shield) {
    const r = size() * 0.8 + Math.sin(time * 5) * 2;
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
  drawTerrain(ctx, world, scroll, depth, time);
  drawDarkness(ctx, depth, player.x, player.y);
  drawHazards(ctx, world, scroll, time);
  drawPickups(ctx, world, scroll, time, getCreature);
  fx.draw(ctx, scroll);
  if (state !== "over" && state !== "ad") drawPlayer();
  ctx.restore();

  ui.hud.textContent = state === "menu" ? "" : `${depth} m  •  🦪 ${save.pearls}${player.shield ? "  •  🫧" : ""}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  time += dt;
  if (state === "play") update(dt);
  else if (state === "menu") { // idle animation behind the title screen
    scroll += 60 * dt;
    updateWorld(world, dt, scroll, time);
    player.y = H - 140 + Math.sin(time * 2) * 6;
  }
  fx.update(dt);
  draw(dt);
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
  if (!Array.isArray(save.owned)) save.owned = ["classic"];
  save.owned = save.owned.filter((id) => SKINS.some((s) => s.id === id));
  if (!save.owned.includes("classic")) save.owned.unshift("classic");
  if (!save.owned.includes(save.skin)) save.skin = "classic";
  if (!Array.isArray(save.dex)) save.dex = [];
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

  ui.play.onclick = () => { sfx.click(); startRun(); };
  ui.retry.onclick = retry;
  ui.revive.onclick = revive;
  document.querySelectorAll(".shield-start").forEach((b) => { b.onclick = () => startWithShield(b.closest(".panel")); });
  document.querySelectorAll(".open-shop").forEach((b) => { b.onclick = () => openPanel(ui.shop, b.closest(".panel"), renderShop); });
  document.querySelectorAll(".open-dex").forEach((b) => { b.onclick = () => openPanel(ui.dex, b.closest(".panel"), renderDex); });
  ui.shopClose.onclick = () => closePanel(ui.shop);
  ui.dexClose.onclick = () => closePanel(ui.dex);
  ui.freePearls.onclick = freePearls;
  ui.freePearls.textContent = `🎬 +${FREE_PEARLS} mutiara (tonton iklan)`;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") gameOver("hidden");
  });

  platform.loadingFinished();
  $("platform").textContent = platform.name;
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
