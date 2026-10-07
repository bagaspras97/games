// "Gravity Hop" — one-tap hyper-casual runner.
// Tap / click / space flips gravity. Avoid the spikes. Collect coins.
import { createPlatform } from "./sdk/adapter.js";
import { SKINS, getSkin } from "./skins.js";
import { sfx, unlock, toggleMute, isMuted, setAdPlaying } from "./audio.js";
import {
  W, H, createWorld, extend, prune, surfaceUnder,
  drawBackground, drawTerrain, drawSpikes, drawCoins,
} from "./world.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = {
  menu: document.getElementById("menu"),
  over: document.getElementById("over"),
  score: document.getElementById("score"),
  final: document.getElementById("final"),
  best: document.getElementById("best"),
  coins: document.getElementById("coins"),
  play: document.getElementById("play"),
  retry: document.getElementById("retry"),
  revive: document.getElementById("revive"),
  shop: document.getElementById("shop"),
  shopCoins: document.getElementById("shop-coins"),
  shopGrid: document.getElementById("shop-grid"),
  shopClose: document.getElementById("shop-close"),
  freeCoins: document.getElementById("free-coins"),
};

const INTERSTITIAL_EVERY = 3;  // runs between mid-game ads
const MIN_AD_GAP_MS = 60000;   // never show interstitials more often than this
const FREE_COINS = 25;         // reward for watching an ad in the shop

let platform;
let save = { best: 0, coins: 0, skin: "classic", owned: ["classic"] };
let state = "menu";            // menu | play | over | ad | shop
let shopReturn = null;         // panel to show again when the shop closes
let runs = 0, lastAdAt = 0, revived = false;
let player, world, scroll, speed, score, last, time = 0;
let shake = 0;                 // screen shake strength in px, decays every frame

function reset() {
  player = { x: 260, y: H - 160, vy: 0, size: 44, gravity: 1, rot: 0 };
  world = createWorld();
  scroll = 0; speed = 420; score = 0;
  extend(world, W * 2, 0);
  revived = false;
}

function resize() {
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = W * scale + "px";
  canvas.style.height = H * scale + "px";
}

function show(el, visible) { el.classList.toggle("hidden", !visible); }

function startRun() {
  reset();
  state = "play";
  show(ui.menu, false); show(ui.over, false);
  platform.gameplayStart();
}

function addShake(amount) { shake = Math.max(shake, amount); }

function vibrate(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {}
}

function gameOver() {
  state = "over";
  sfx.death();
  addShake(22);
  vibrate([60, 40, 90]);
  platform.gameplayStop();
  runs++;
  save.best = Math.max(save.best, score);
  platform.save(save);
  ui.final.textContent = score;
  ui.best.textContent = save.best;
  ui.coins.textContent = save.coins;
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

async function revive() {
  show(ui.over, false);
  const earned = await withAd(() => platform.rewarded());
  if (earned) {
    revived = true;
    sfx.revive();
    // Clear nearby hazards and drop the player back on a safe flat strip.
    const wx = scroll + player.x;
    world.spikes = world.spikes.filter((o) => o.x > wx + 500 || o.x < wx - 100);
    for (const seg of world.segs) {
      if (seg.x + seg.w > wx - 100 && seg.x < wx + 500) {
        seg.pit = null;
        seg.floor = seg.floor ?? H - 90;
        seg.ceil = seg.ceil ?? 90;
      }
    }
    player.y = surfaceUnder(world, wx - 30, wx + 30).floor - player.size / 2;
    player.gravity = 1; player.vy = 0;
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
function openShop(from) {
  shopReturn = from;
  state = "shop";
  show(ui.menu, false); show(ui.over, false);
  renderShop();
  show(ui.shop, true);
}

function closeShop() {
  show(ui.shop, false);
  ui.coins.textContent = save.coins;
  state = shopReturn === ui.over ? "over" : "menu";
  show(shopReturn, true);
}

function renderShop() {
  ui.shopCoins.textContent = save.coins;
  ui.shopGrid.innerHTML = "";
  for (const skin of SKINS) {
    const owned = save.owned.includes(skin.id);
    const equipped = save.skin === skin.id;
    const card = document.createElement("button");
    card.className = "skin" + (equipped ? " equipped" : "");
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const cx = c.getContext("2d");
    cx.translate(48, 52);
    skin.draw(cx, 44);
    const label = equipped ? "Dipakai" : owned ? "Pakai" : `🪙 ${skin.price}`;
    card.append(c);
    card.insertAdjacentHTML("beforeend", `<b>${skin.name}</b><span>${label}</span>`);
    if (!owned && save.coins < skin.price) card.classList.add("locked");
    card.onclick = () => selectSkin(skin);
    ui.shopGrid.append(card);
  }
}

function selectSkin(skin) {
  if (!save.owned.includes(skin.id)) {
    if (save.coins < skin.price) { sfx.denied(); addShake(6); return; }
    save.coins -= skin.price;
    sfx.buy();
    save.owned.push(skin.id);
  }
  else sfx.click();
  save.skin = skin.id;
  platform.save(save);
  renderShop();
}

async function freeCoins() {
  ui.freeCoins.disabled = true;
  const earned = await withAd(() => platform.rewarded());
  state = "shop";
  ui.freeCoins.disabled = false;
  if (earned) {
    save.coins += FREE_COINS;
    sfx.buy();
    platform.save(save);
  }
  renderShop();
}

function flip() {
  if (state !== "play") return;
  player.gravity *= -1;
  player.vy = 0;
  sfx.flip(player.gravity < 0);
  addShake(3);
}

const CLIMB = 48; // step height the player walks up automatically

function update(dt) {
  speed += dt * 8;
  scroll += speed * dt;
  score = Math.floor(scroll / 100);
  extend(world, scroll + W * 2, Math.min(1, scroll / 40000));
  prune(world, scroll);

  const half = player.size / 2;
  const wx = scroll + player.x;
  player.vy += 2600 * player.gravity * dt;
  player.y += player.vy * dt;
  player.rot += dt * 6;

  // Hitting the side of a wall (e.g. the far edge of a trench) is fatal.
  const front = surfaceUnder(world, wx + half - 4, wx + half);
  if (front.floor !== null && player.y + half > front.floor + CLIMB) return gameOver();
  if (front.ceil !== null && player.y - half < front.ceil - CLIMB) return gameOver();

  // Land on floor / ceiling (small steps are climbed automatically).
  const under = surfaceUnder(world, wx - half + 4, wx + half - 4);
  const impact = Math.abs(player.vy);
  let landed = false;
  if (under.floor !== null && player.y + half > under.floor) { player.y = under.floor - half; player.vy = Math.min(player.vy, 0); landed = true; }
  if (under.ceil !== null && player.y - half < under.ceil) { player.y = under.ceil + half; player.vy = Math.max(player.vy, 0); landed = true; }
  if (landed && impact > 500) { sfx.land(); addShake(Math.min(8, impact / 160)); vibrate(15); }

  // Fell into a trench.
  if (player.y - half > H || player.y + half < 0) return gameOver();

  const px = wx - half + 6, py = player.y - half + 6, ps = player.size - 12;
  for (const o of world.spikes) {
    const ox = o.x + o.w * 0.2, ow = o.w * 0.6;
    const oy = o.top ? o.base : o.base - o.h;
    if (px < ox + ow && px + ps > ox && py < oy + o.h && py + ps > oy) return gameOver();
  }
  for (const c of world.coins) {
    if (!c.taken && Math.hypot(c.x - wx, c.y - player.y) < c.r + half) {
      c.taken = true;
      save.coins++;
      sfx.coin();
    }
  }
}

function draw(dt) {
  ctx.save();
  if (shake > 0.3) {
    ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    shake *= Math.pow(0.002, dt); // fast exponential decay
  } else shake = 0;
  ctx.fillStyle = "#140f38";
  ctx.fillRect(-40, -40, W + 80, H + 80); // cover edges revealed by the shake
  drawBackground(ctx, scroll);
  drawTerrain(ctx, world, scroll, time);
  drawSpikes(ctx, world, scroll);
  drawCoins(ctx, world, scroll, time);

  if (player) {
    const skin = getSkin(save.skin);
    ctx.save();
    ctx.translate(player.x, player.y);
    if (skin.spin) ctx.rotate(player.rot);
    else if (player.gravity < 0) ctx.scale(1, -1); // face stays upright relative to "floor"
    skin.draw(ctx, player.size);
    ctx.restore();
  }

  ctx.restore();
  ui.score.textContent = state === "menu" ? "" : `${score}  •  🪙 ${save.coins}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  time += dt;
  if (state === "play") update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

async function boot() {
  resize();
  addEventListener("resize", resize);
  platform = await createPlatform();
  save = Object.assign(save, await platform.load());
  if (!Array.isArray(save.owned)) save.owned = ["classic"];
  if (!save.owned.includes(save.skin)) save.skin = "classic";
  reset();

  addEventListener("pointerdown", unlock, true);
  addEventListener("keydown", unlock, true);
  canvas.addEventListener("pointerdown", flip);
  const muteBtn = document.getElementById("mute");
  const muteLabel = () => { muteBtn.textContent = isMuted() ? "🔇" : "🔊"; };
  muteLabel();
  muteBtn.onclick = (e) => { e.stopPropagation(); toggleMute(); muteLabel(); muteBtn.blur(); };
  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flip(); }
  });
  ui.play.onclick = () => { sfx.click(); startRun(); };
  ui.retry.onclick = retry;
  ui.revive.onclick = revive;
  document.querySelectorAll(".open-shop").forEach((b) => {
    b.onclick = () => openShop(b.closest(".panel"));
  });
  ui.shopClose.onclick = closeShop;
  ui.freeCoins.onclick = freeCoins;
  ui.freeCoins.textContent = `🎬 +${FREE_COINS} koin (tonton iklan)`;

  // Pause the game when the tab/app is hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") gameOver();
  });

  platform.loadingFinished();
  document.getElementById("platform").textContent = platform.name;
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
