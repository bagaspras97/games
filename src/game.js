// "Gravity Hop" — one-tap hyper-casual runner.
// Tap / click / space flips gravity. Avoid the spikes. Collect coins.
import { createPlatform } from "./sdk/adapter.js";
import { SKINS, getSkin } from "./skins.js";

const W = 1280, H = 720; // 16:9 logical resolution (Poki requirement)
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
let player, obstacles, pickups, speed, distance, score, spawnTimer, last;

function reset() {
  player = { x: 260, y: H - 120, vy: 0, size: 44, gravity: 1, rot: 0 };
  obstacles = []; pickups = [];
  speed = 420; distance = 0; score = 0; spawnTimer = 0.8;
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

function gameOver() {
  state = "over";
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

function withAd(fn) {
  state = "ad";
  return fn();
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
    obstacles = obstacles.filter((o) => o.x > player.x + 400 || o.x < player.x - 100);
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
    if (save.coins < skin.price) return;
    save.coins -= skin.price;
    save.owned.push(skin.id);
  }
  save.skin = skin.id;
  platform.save(save);
  renderShop();
}

async function freeCoins() {
  ui.freeCoins.disabled = true;
  const earned = await platform.rewarded();
  ui.freeCoins.disabled = false;
  if (earned) {
    save.coins += FREE_COINS;
    platform.save(save);
  }
  renderShop();
}

function flip() {
  if (state !== "play") return;
  player.gravity *= -1;
  player.vy = 0;
}

function spawn() {
  const top = Math.random() < 0.5;
  const h = 60 + Math.random() * 120;
  obstacles.push({ x: W + 40, w: 50, h, top });
  if (Math.random() < 0.6) {
    pickups.push({ x: W + 220, y: 160 + Math.random() * (H - 320), r: 16 });
  }
}

const FLOOR = H - 80, CEIL = 80;

function update(dt) {
  speed += dt * 8;
  distance += speed * dt;
  score = Math.floor(distance / 100);

  player.vy += 2600 * player.gravity * dt;
  player.y += player.vy * dt;
  const half = player.size / 2;
  if (player.y > FLOOR - half) { player.y = FLOOR - half; player.vy = 0; }
  if (player.y < CEIL + half) { player.y = CEIL + half; player.vy = 0; }
  player.rot += dt * 6;

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawn();
    spawnTimer = Math.max(0.55, 1.3 - speed / 1500) + Math.random() * 0.4;
  }

  for (const o of obstacles) o.x -= speed * dt;
  for (const p of pickups) p.x -= speed * dt;
  obstacles = obstacles.filter((o) => o.x + o.w > -50);
  pickups = pickups.filter((p) => p.x > -50 && !p.taken);

  const px = player.x - half + 6, py = player.y - half + 6, ps = player.size - 12;
  for (const o of obstacles) {
    const oy = o.top ? CEIL : FLOOR - o.h;
    if (px < o.x + o.w && px + ps > o.x && py < oy + o.h && py + ps > oy) return gameOver();
  }
  for (const p of pickups) {
    if (Math.hypot(p.x - player.x, p.y - player.y) < p.r + half) {
      p.taken = true;
      save.coins++;
    }
  }
}

function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b1446");
  g.addColorStop(1, "#3a1d6e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ff4fa3";
  ctx.fillRect(0, 0, W, CEIL);
  ctx.fillRect(0, FLOOR, W, H - FLOOR);

  ctx.fillStyle = "#ffe14f";
  for (const o of obstacles) {
    ctx.beginPath();
    if (o.top) {
      ctx.moveTo(o.x, CEIL); ctx.lineTo(o.x + o.w, CEIL); ctx.lineTo(o.x + o.w / 2, CEIL + o.h);
    } else {
      ctx.moveTo(o.x, FLOOR); ctx.lineTo(o.x + o.w, FLOOR); ctx.lineTo(o.x + o.w / 2, FLOOR - o.h);
    }
    ctx.fill();
  }

  ctx.fillStyle = "#4fffd2";
  for (const p of pickups) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  if (player) {
    const skin = getSkin(save.skin);
    ctx.save();
    ctx.translate(player.x, player.y);
    if (skin.spin) ctx.rotate(player.rot);
    else if (player.gravity < 0) ctx.scale(1, -1); // face stays upright relative to "floor"
    skin.draw(ctx, player.size);
    ctx.restore();
  }

  ui.score.textContent = state === "menu" ? "" : `${score}  •  🪙 ${save.coins}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  if (state === "play") update(dt);
  draw();
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

  canvas.addEventListener("pointerdown", flip);
  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flip(); }
  });
  ui.play.onclick = startRun;
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
