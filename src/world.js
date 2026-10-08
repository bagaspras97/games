import { devParam } from "./dev.js";
// Deep-sea world: seabed (floor) and ice/rock ceiling made of stepped segments,
// trenches ("palung"), zone-based hazards, pearls, shield bubbles and rare creatures.
// All x values are world coordinates; the camera scrolls by `scroll`.

import { CREATURES } from "./creatures.js";
import { makeFloorDeco, makeCeilDeco, drawFloorDeco, drawCeilDeco, drawCaustics } from "./decor.js";

export const W = 1280, H = 720;
const BASE_FLOOR = H - 90, BASE_CEIL = 90;
const MIN_GAP = 340;   // minimum free space between ceiling and floor
const STEP = 44;       // max height change between neighbours (auto-climbable)
export const PX_PER_M = 50;

export const ZONES = [
  { from: 0, name: "Perairan Dangkal", icon: "🌤️" },
  { from: 300, name: "Laut Terbuka", icon: "🌊" },
  { from: 800, name: "Zona Senja", icon: "🌑" },
  { from: 1500, name: "Zona Gelap", icon: "✨" },
];

export function zoneIndex(depth) {
  let z = 0;
  for (let i = 0; i < ZONES.length; i++) if (depth >= ZONES[i].from) z = i;
  return z;
}

// Gameplay generation goes through rnd() so Adventure levels can use a fixed seed
// (same layout every attempt); endless mode keeps Math.random.
let rnd = Math.random;
export function useSeed(seed) {
  if (seed == null) { rnd = Math.random; return; }
  let a = seed >>> 0;
  rnd = () => { // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Hazards unlocked per zone (cumulative): 1 = natural, 2 = moving creatures, 3 = human-made.
const HAZARDS_BY_ZONE = [
  ["urchin", "coral", "icicle"],
  ["urchin", "coral", "icicle", "jelly", "jelly", "hook"],
  ["urchin", "coral", "icicle", "jelly", "hook", "sword", "net", "bag"],
  ["urchin", "coral", "icicle", "jelly", "jelly", "hook", "sword", "sword", "net", "bag"],
];

// opts (Adventure levels): { zone, difficulty 0..1, length px } — a finish line at startX + length.
export function createWorld(dex = [], startX = 0, opts = {}) {
  const world = {
    segs: [], hazards: [], pickups: [], end: startX,
    floor: BASE_FLOOR, ceil: BASE_CEIL, lastPit: true, dex, opts,
    finishX: opts.length ? startX + opts.length : null, pearlTotal: 0,
  };
  // flat, safe, calm start (longer during the first-time tutorial)
  const start = addSeg(world, opts.tutorial ? 4600 : 1400, BASE_FLOOR, BASE_CEIL);
  start.deco = start.deco.filter((_, i) => i % 2 === 0);
  start.cdeco = [];
  return world;
}

function addSeg(world, w, floor, ceil) {
  const zone = zoneIndex(world.end / PX_PER_M);
  const seg = { x: world.end, w, floor, ceil, deco: makeFloorDeco(zone, w), cdeco: makeCeilDeco(zone, w) };
  world.segs.push(seg);
  world.end += w;
  return seg;
}

// Generate terrain until the world reaches `untilX`.
export function extend(world, untilX) {
  while (world.end < untilX) {
    const depth = world.end / PX_PER_M;
    const zone = world.opts.zone ?? zoneIndex(depth);
    const level = world.opts.difficulty ?? clamp(depth / 2000, 0, 1);
    if (world.finishX && world.end >= world.finishX - 200) { // calm water past the finish line
      world.floor = BASE_FLOOR; world.ceil = BASE_CEIL;
      addSeg(world, 600, BASE_FLOOR, BASE_CEIL);
      continue;
    }

    const pitChance = world.lastPit ? 0 : 0.16 + level * 0.22;
    if (rnd() < pitChance) {
      const bottom = rnd() < 0.6;
      const w = rand(170, 230 + level * 90);
      const seg = addSeg(world, w, bottom ? null : world.floor, bottom ? world.ceil : null);
      seg.pit = bottom ? "bottom" : "top";
      seg.eyes = rnd() < 0.6; // something watching from the trench...
      addPearl(world, seg.x + w / 2, bottom ? world.ceil + 50 : world.floor - 50);
      world.lastPit = true;
      continue;
    }

    world.floor = clamp(world.floor + pick([-STEP, 0, 0, STEP]), H - 190, BASE_FLOOR);
    world.ceil = clamp(world.ceil + pick([-STEP, 0, 0, STEP]), BASE_CEIL, 190);
    if (world.floor - world.ceil < MIN_GAP) world.ceil = world.floor - MIN_GAP;
    const w = rand(280, 540);
    const seg = addSeg(world, w, world.floor, world.ceil);
    world.lastPit = false;

    if (rnd() < 0.6 + level * 0.35) spawnHazard(world, seg, pick(HAZARDS_BY_ZONE[zone]));

    if (rnd() < 0.6) placePearlPattern(world, seg, zone);
    if (rnd() < 0.05) {
      world.pickups.push({ kind: "shield", x: seg.x + w / 2, y: (seg.ceil + seg.floor) / 2, r: 22 });
    }
    if (!world.finishX && rnd() < 0.05) { // rare creatures (Ensiklopedia) live in Free mode only
      const pool = CREATURES.filter((c) => c.zone === zone);
      const fresh = pool.filter((c) => !world.dex.includes(c.id));
      const c = pick(fresh.length ? fresh : pool);
      world.pickups.push({ kind: "creature", id: c.id, x: seg.x + w * 0.6, y: rand(seg.ceil + 80, seg.floor - 80), baseY: 0, r: 26 });
    }
  }
}

// Pearl formations. Besides looking varied, several of them hint at a route:
// runs along the floor/ceiling reward staying put, diagonals invite a flip.
//
// Pattern difficulty depends on a TIER 0..4 = the level's position inside its zone
// (Level 1, 6, 11, 16 → tier 0 … the Ujian → tier 4). In Free mode the tier follows
// how far you are into the current zone. Every zone starts easy again.
const PEARL_TIERS = [
  ["line", "floorRun", "ceilRun"],                                   // 0: no movement needed
  ["line", "floorRun", "ceilRun", "hill", "valley"],                 // 1: gentle curves
  ["floorRun", "ceilRun", "hill", "valley", "rise", "fall"],         // 2: one flip to follow
  ["hill", "valley", "rise", "fall", "wave", "zigzag"],              // 3: rhythm
  ["rise", "fall", "wave", "zigzag", "zigzag"],                      // 4: constant flipping
];

function pearlTier(world, zone) {
  if (world.opts.pearlTier != null) return world.opts.pearlTier;
  const depth = world.end / PX_PER_M;
  const from = ZONES[zone].from, to = ZONES[zone + 1] ? ZONES[zone + 1].from : from + 1000;
  return clamp(Math.floor(((depth - from) / (to - from)) * 5), 0, 4);
}

function placePearlPattern(world, seg, zone) {
  const tier = pearlTier(world, zone);
  const gap = 42;
  const maxN = Math.floor((seg.w - 120) / gap);
  if (maxN < 3) return;
  const n = Math.min(maxN, 3 + Math.floor(rnd() * (2 + tier)));     // tier 0: 3-4 … tier 4: 3-8
  const x0 = seg.x + 60 + rnd() * Math.max(0, seg.w - 120 - (n - 1) * gap);
  const top = seg.ceil + 40, bottom = seg.floor - 40, mid = (top + bottom) / 2;
  const kind = pick(PEARL_TIERS[tier]);
  const amp = rand(25 + tier * 12, 45 + tier * 15);                   // bigger swings when harder
  const base = rand(top + amp, bottom - amp);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    let y;
    switch (kind) {
      case "line": y = base; break;
      case "floorRun": y = bottom; break;
      case "ceilRun": y = top; break;
      case "rise": y = bottom - (bottom - top) * k; break;
      case "fall": y = top + (bottom - top) * k; break;
      case "hill": y = base - Math.sin(k * Math.PI) * amp; break;
      case "valley": y = base + Math.sin(k * Math.PI) * amp; break;
      case "zigzag": y = mid + (i % 2 ? -1 : 1) * Math.min(amp, (bottom - top) / 2); break;
      case "wave": y = base + Math.sin(k * Math.PI * 2) * amp; break;
    }
    pts.push([x0 + i * gap, clamp(y, top, bottom)]);
  }
  // never put a pearl inside a static hazard
  const solid = world.hazards.filter((h) => ["urchin", "coral", "icicle", "net"].includes(h.type) && h.x > seg.x - 100 && h.x < seg.x + seg.w);
  for (const [x, y] of pts) {
    if (solid.some((h) => hitsHazard(h, x, y, 16))) continue;
    addPearl(world, x, y);
  }
}

function addPearl(world, x, y) {
  world.pickups.push({ kind: "pearl", x, y, r: 12 });
  if (!world.finishX || x < world.finishX) world.pearlTotal++;
}

// Dev helper (?hazard=jelly): every hazard becomes this type, to test abilities.
const FORCED = devParam("hazard");

function spawnHazard(world, seg, type) {
  if (FORCED) type = FORCED;
  const x = seg.x + rand(90, seg.w - 140);
  const mid = (seg.ceil + seg.floor) / 2;
  const h = { type, x };
  switch (type) {
    case "urchin": Object.assign(h, { y: seg.floor - 20, r: 22 }); break;
    case "coral": Object.assign(h, { base: seg.floor, w: 50, h: rand(60, 110), top: false }); break;
    case "icicle": Object.assign(h, { base: seg.ceil, w: 44, h: rand(60, 110), top: true }); break;
    case "jelly": Object.assign(h, { baseY: mid, y: mid, amp: rand(60, 120), phase: rand(0, 6), r: 24 }); break;
    case "hook": Object.assign(h, { top: seg.ceil, len: rand(110, 210), y: seg.ceil, r: 14 }); break;
    case "sword": Object.assign(h, { y: rand(seg.ceil + 60, seg.floor - 60), active: false, speed: rand(420, 560) }); break;
    case "net": {
      const fromTop = rnd() < 0.5;
      Object.assign(h, { w: 90, h: rand(100, 140), fromTop, base: fromTop ? seg.ceil : seg.floor });
      break;
    }
    case "bag": Object.assign(h, { baseY: rand(seg.ceil + 80, seg.floor - 80), y: 0, phase: rand(0, 6), r: 20 }); break;
  }
  world.hazards.push(h);
}

export function updateWorld(world, dt, scroll, t) {
  for (const h of world.hazards) {
    const sx = h.x - scroll;
    if (h.stunUntil > t) continue; // frozen (ink, whale song, lantern beam…)
    if (h.type === "jelly") h.y = h.baseY + Math.sin(t * 1.8 + h.phase) * h.amp;
    else if (h.type === "hook") {
      const progress = clamp((W + 100 - sx) / 500, 0, 1);
      if (h.fleeing) h.len = Math.max(0, h.len - 420 * dt); // reeled away
      h.y = h.top + h.len * progress + Math.sin(t * 2) * 6;
    } else if (h.type === "sword") {
      if (!h.active && sx < W + 520) h.active = true;
      if (h.fleeing) { h.x += 380 * dt; h.y -= 220 * dt; } // bounced / scared away
      else if (h.active) h.x -= h.speed * dt;
    } else if (h.type === "bag") {
      h.y = h.baseY + Math.sin(t * 0.9 + h.phase) * 30;
      h.x -= 25 * dt;
    }
  }
  for (const p of world.pickups) if (p.kind !== "pearl") p.bob = Math.sin(t * 2 + p.x) * 8;
}

// Circle (cx, cy, cr) vs hazard.
// A hazard that a character ability has neutralised (fleeing / stunned).
export function isHarmless(h, t) {
  return h.fleeing || h.stunUntil > t;
}

export function hitsHazard(h, cx, cy, cr) {
  const circle = (x, y, r) => Math.hypot(cx - x, cy - y) < cr + r;
  const rect = (x, y, w, hh) => {
    const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + hh);
    return Math.hypot(cx - nx, cy - ny) < cr;
  };
  switch (h.type) {
    case "urchin": case "jelly": case "bag": return circle(h.x, h.y, h.r);
    case "hook": return circle(h.x, h.y + 10, h.r);
    case "sword": return circle(h.x, h.y, 14) || circle(h.x + 28, h.y, 16) || circle(h.x - 30, h.y, 6);
    case "coral": case "icicle": {
      const y = h.top ? h.base : h.base - h.h;
      return rect(h.x + h.w * 0.3, y + (h.top ? 0 : h.h * 0.15), h.w * 0.4, h.h * 0.85);
    }
    case "net": return rect(h.x, h.fromTop ? h.base : h.base - h.h, h.w, h.h);
  }
  return false;
}

export function prune(world, scroll) {
  const left = scroll - 250;
  world.segs = world.segs.filter((s) => s.x + s.w > left);
  world.hazards = world.hazards.filter((h) => h.x + 120 > left && !h.gone);
  world.pickups = world.pickups.filter((p) => p.x > left && !p.taken);
}

export function surfaceUnder(world, x0, x1) {
  let floor = null, ceil = null;
  for (const s of world.segs) {
    if (s.x + s.w <= x0 || s.x >= x1) continue;
    if (s.floor !== null) floor = floor === null ? s.floor : Math.min(floor, s.floor);
    if (s.ceil !== null) ceil = ceil === null ? s.ceil : Math.max(ceil, s.ceil);
  }
  return { floor, ceil };
}

// ---------- Colour helpers ----------
function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// Interpolate a colour along depth stops [[depth, color], ...].
function byDepth(stops, d) {
  if (d <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (d < stops[i][0]) {
      const [d0, c0] = stops[i - 1], [d1, c1] = stops[i];
      return mix(c0, c1, (d - d0) / (d1 - d0));
    }
  }
  return stops[stops.length - 1][1];
}

const SEA_TOP = [[0, "#5cc8f2"], [300, "#2a86c4"], [800, "#103e74"], [1500, "#04122a"], [2500, "#020814"]];
const SEA_BOTTOM = [[0, "#1677b8"], [300, "#0d4c8a"], [800, "#072650"], [1500, "#020a1a"], [2500, "#01040c"]];
const SAND = [[0, "#e8cc8c"], [300, "#c9a86c"], [800, "#6f6a78"], [1500, "#3a3550"]];
const SAND_DARK = [[0, "#a9824a"], [300, "#7d6640"], [800, "#3c3a4e"], [1500, "#1c1a2c"]];
const ICE = [[0, "#e6f8ff"], [300, "#a8d6ea"], [800, "#4f5f7e"], [1500, "#2a2d45"]];
const ICE_DARK = [[0, "#8ccbe6"], [300, "#5d98b8"], [800, "#2c3550"], [1500, "#14152a"]];

// ---------- Background ----------
const snow = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.5, s: Math.random() * 0.3 + 0.1 }));
const glows = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, c: pick(["#7ffff0", "#9fb7ff", "#ff9ff3"]), p: Math.random() * 6 }));

export function drawBackground(ctx, scroll, depth, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, byDepth(SEA_TOP, depth));
  g.addColorStop(1, byDepth(SEA_BOTTOM, depth));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // sun rays in shallow water
  const rayA = clamp(1 - depth / 450, 0, 1) * 0.18;
  if (rayA > 0) {
    ctx.fillStyle = `rgba(255,255,255,${rayA})`;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 320 - scroll * 0.1 + Math.sin(t * 0.4 + i) * 30) % (W + 400) + W + 400) % (W + 400) - 200;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 80, 0); ctx.lineTo(x - 120, H); ctx.lineTo(x - 260, H);
      ctx.fill();
    }
  }

  // distant reef mounds & the odd shipwreck (far parallax)
  drawFarScenery(ctx, scroll, depth);

  // kelp forest silhouette (parallax)
  ctx.strokeStyle = "rgba(0,30,40,0.2)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const x = ((i * 140 - scroll * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
    const h = 120 + (i * 53) % 130;
    ctx.beginPath(); ctx.moveTo(x, H);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 1.2 + i + k * 0.7) * 12, H - (h * k) / 6);
    ctx.stroke();
  }

  // marine snow
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  for (const s of snow) {
    const x = ((s.x - scroll * s.s) % W + W) % W;
    const y = (s.y + t * 12 * s.s) % H;
    ctx.fillRect(x, y, s.r, s.r);
  }

  // bioluminescence in the deep
  const glowA = clamp((depth - 700) / 600, 0, 1);
  if (glowA > 0) {
    for (const s of glows) {
      const x = ((s.x - scroll * 0.2) % W + W) % W;
      ctx.globalAlpha = glowA * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p)));
      ctx.fillStyle = s.c; ctx.shadowColor = s.c; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, s.y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}

function drawFarScenery(ctx, scroll, depth) {
  const a = clamp(1 - depth / 1200, 0.15, 1);
  // rolling reef mounds with coral bumps
  ctx.fillStyle = `rgba(10,50,90,${0.35 * a})`;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) {
    const wx = x + scroll * 0.18;
    ctx.lineTo(x, H - 150 - Math.sin(wx * 0.004) * 40 - Math.abs(Math.sin(wx * 0.03)) * 14);
  }
  ctx.lineTo(W, H); ctx.fill();
  // shipwreck every ~5000 px of far-layer distance
  const span = 5000, off = (scroll * 0.18) % span;
  const sx = W + 300 - off;
  if (sx > -400 && sx < W + 400 && depth > 150) {
    ctx.save();
    ctx.translate(sx, H - 170);
    ctx.rotate(-0.12);
    ctx.fillStyle = `rgba(5,25,50,${0.55 * a})`;
    ctx.beginPath(); ctx.moveTo(-160, 0); ctx.lineTo(150, 0); ctx.lineTo(120, 50); ctx.lineTo(-130, 50); ctx.fill();
    ctx.fillRect(-40, -110, 10, 110); ctx.fillRect(40, -80, 8, 80);           // masts
    ctx.fillRect(-90, -30, 70, 30);                                         // cabin
    ctx.beginPath(); ctx.moveTo(-35, -105); ctx.lineTo(10, -60); ctx.lineTo(-35, -60); ctx.fill(); // torn sail
    ctx.restore();
  }
}

// ---------- Terrain ----------
// dt, px, py: frame time and player screen position, so decorations can react.
export function drawTerrain(ctx, world, scroll, depth, t, dt = 0, px = -999, py = -999) {
  const dark = clamp((depth - 500) / 1200, 0, 1);
  const caustic = clamp(1 - depth / 400, 0, 1) * 0.18;
  const sand = byDepth(SAND, depth), sandDark = byDepth(SAND_DARK, depth);
  const ice = byDepth(ICE, depth), iceDark = byDepth(ICE_DARK, depth);

  for (const s of world.segs) {
    const x = Math.floor(s.x - scroll), w = Math.ceil(s.w) + 1;
    if (x > W || x + w < 0) continue;

    if (s.floor !== null) {
      const g = ctx.createLinearGradient(0, s.floor, 0, H);
      g.addColorStop(0, sand); g.addColorStop(1, sandDark);
      ctx.fillStyle = g;
      ctx.fillRect(x, s.floor, w, H - s.floor);
      drawCaustics(ctx, x, s.floor, w, t, caustic);
      ctx.globalAlpha = 0.7; // decoration stays in the background, hazards & pearls pop
      for (const d of s.deco) drawFloorDeco(ctx, x + d.dx, s.floor, d, t, dt, px, py, dark);
      ctx.globalAlpha = 1;
    }
    if (s.ceil !== null) {
      const g = ctx.createLinearGradient(0, 0, 0, s.ceil);
      g.addColorStop(0, iceDark); g.addColorStop(1, ice);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, s.ceil);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, s.ceil - 4, w, 4);
      ctx.globalAlpha = 0.7;
      for (const d of s.cdeco) drawCeilDeco(ctx, x + d.dx, s.ceil, d, t);
      ctx.globalAlpha = 1;
    }

    if (s.pit === "bottom") {
      const g = ctx.createLinearGradient(0, H - 200, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(x, H - 200, w, 200);
      if (s.eyes && Math.sin(t * 0.8 + s.x) > -0.7) { // blinking eyes in the trench
        ctx.fillStyle = "#ffef5a"; ctx.shadowColor = "#ffef5a"; ctx.shadowBlur = 10;
        const ex = x + w / 2;
        ctx.beginPath(); ctx.ellipse(ex - 14, H - 40, 5, 3, 0, 0, Math.PI * 2); ctx.ellipse(ex + 14, H - 40, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (s.pit === "top") {
      const g = ctx.createLinearGradient(0, 0, 0, 220);
      g.addColorStop(0, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, 220);
    }
  }
}

// Finish line of an Adventure level: two glowing kelp posts, a checkered banner
// and a curtain of rising bubbles.
export function drawFinish(ctx, world, scroll, t) {
  if (!world.finishX) return;
  const x = world.finishX - scroll;
  if (x < -120 || x > W + 120) return;
  const top = 70, bottom = H - 70;
  ctx.save();
  ctx.fillStyle = "rgba(255,240,150,0.12)";
  ctx.fillRect(x - 30, 0, 60, H);
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const k = (t * 0.5 + i / 14) % 1;
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.3 + t) * 22, bottom - k * (bottom - top), 3 + (i % 3), 0, Math.PI * 2); ctx.stroke();
  }
  for (const side of [-1, 1]) { // posts
    ctx.strokeStyle = "#3fbf6a"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + side * 34, bottom);
    for (let k = 1; k <= 8; k++) ctx.lineTo(x + side * 34 + Math.sin(t * 2 + k) * 4, bottom - ((bottom - top) * k) / 8);
    ctx.stroke();
  }
  const by = top + 20 + Math.sin(t * 2) * 4; // checkered banner
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff";
    ctx.fillRect(x - 40 + i * 10, by + j * 10, 10, 10);
  }
  ctx.fillStyle = "#ffe27a"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
  ctx.fillText("FINISH", x, by + 46);
  ctx.restore();
}

// Darken the scene with depth, leaving a pool of light around Puffy.
export function drawDarkness(ctx, depth, px, py, light = 0) {
  const a = clamp((depth - 500) / 1200, 0, 0.7) * (light ? 0.75 : 1);
  if (a <= 0) return;
  // light > 0: a lantern (anglerfish) gives a bigger, brighter pool of light
  const g = ctx.createRadialGradient(px, py, 60 + light * 0.4, px, py, 520 + light);
  g.addColorStop(0, "rgba(0,0,10,0)");
  g.addColorStop(1, `rgba(0,0,10,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);
}

// ---------- Hazards ----------
export function drawHazards(ctx, world, scroll, t) {
  for (const h of world.hazards) {
    const x = h.x - scroll;
    if (x > W + 160 || x < -160) {
      if (h.type === "sword" && h.active && x > W) drawWarning(ctx, h.y, t);
      continue;
    }
    ctx.save();
    if (isHarmless(h, t)) ctx.globalAlpha = 0.4;
    switch (h.type) {
      case "urchin": drawUrchin(ctx, x, h.y, h.r, t); break;
      case "coral": drawCoralSpike(ctx, x, h); break;
      case "icicle": drawIcicle(ctx, x, h); break;
      case "jelly": drawJelly(ctx, x, h.y, h.r, t); break;
      case "hook": drawHook(ctx, x, h); break;
      case "sword": drawSword(ctx, x, h.y, t); if (x > W - 10) drawWarning(ctx, h.y, t); break;
      case "net": drawNet(ctx, x, h); break;
      case "bag": drawBag(ctx, x, h.y, t + h.phase); break;
    }
    ctx.restore();
  }
}

function drawWarning(ctx, y, t) {
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 20);
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath(); ctx.arc(W - 34, y, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 30px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("!", W - 34, y + 1);
  ctx.globalAlpha = 1;
}

function drawUrchin(ctx, x, y, r, t) {
  ctx.strokeStyle = "#2b1840"; ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const a = (Math.PI * 2 * i) / 18 + Math.sin(t * 2) * 0.05;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); ctx.stroke();
  }
  ctx.fillStyle = "#5a2d82";
  ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
}

function drawCoralSpike(ctx, x, h) {
  ctx.fillStyle = "#ff5e57";
  ctx.beginPath();
  ctx.moveTo(x, h.base); ctx.lineTo(x + h.w / 2, h.base - h.h); ctx.lineTo(x + h.w, h.base);
  ctx.fill();
  ctx.strokeStyle = "#ff5e57"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + h.w * 0.4, h.base - h.h * 0.35); ctx.lineTo(x + h.w * 0.05, h.base - h.h * 0.7);
  ctx.moveTo(x + h.w * 0.6, h.base - h.h * 0.5); ctx.lineTo(x + h.w * 0.95, h.base - h.h * 0.8);
  ctx.stroke();
}

function drawIcicle(ctx, x, h) {
  ctx.fillStyle = "#cdf3ff";
  ctx.beginPath();
  ctx.moveTo(x, h.base); ctx.lineTo(x + h.w, h.base); ctx.lineTo(x + h.w / 2, h.base + h.h);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.moveTo(x + h.w * 0.3, h.base); ctx.lineTo(x + h.w * 0.45, h.base); ctx.lineTo(x + h.w / 2, h.base + h.h * 0.8);
  ctx.fill();
}

function drawJelly(ctx, x, y, r, t) {
  ctx.strokeStyle = "rgba(255,170,230,0.8)"; ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * 7, y);
    for (let k = 1; k <= 4; k++) ctx.lineTo(x + i * 7 + Math.sin(t * 5 + k + i) * 4, y + k * 10);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,120,210,0.85)"; ctx.shadowColor = "#ff8ae0"; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.quadraticCurveTo(x, y + 8, x - r, y); ctx.fill();
  ctx.shadowBlur = 0;
  if (Math.sin(t * 13 + x) > 0.3) { // electric sparks
    ctx.strokeStyle = "#fff36b"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r - 6, y - 10); ctx.lineTo(x - r - 14, y - 2); ctx.lineTo(x - r - 6, y + 2); ctx.lineTo(x - r - 14, y + 10);
    ctx.moveTo(x + r + 6, y - 10); ctx.lineTo(x + r + 14, y - 2); ctx.lineTo(x + r + 6, y + 2); ctx.lineTo(x + r + 14, y + 10);
    ctx.stroke();
  }
}

function drawHook(ctx, x, h) {
  ctx.strokeStyle = "#d9d9d9"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h.y); ctx.stroke();
  ctx.strokeStyle = "#8a8f99"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, h.y); ctx.lineTo(x, h.y + 18);
  ctx.arc(x - 9, h.y + 18, 9, 0, Math.PI * 0.9);
  ctx.stroke();
  ctx.fillStyle = "#c46a5a"; // worm bait
  ctx.beginPath(); ctx.ellipse(x - 14, h.y + 22, 6, 3, 0.5, 0, Math.PI * 2); ctx.fill();
}

function drawSword(ctx, x, y, t) {
  ctx.fillStyle = "#4a6fa5";
  ctx.beginPath(); ctx.ellipse(x + 20, y, 34, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 50, y); ctx.lineTo(x + 70, y - 16 + Math.sin(t * 20) * 3); ctx.lineTo(x + 70, y + 16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 15, y - 10); ctx.lineTo(x + 30, y - 26); ctx.lineTo(x + 36, y - 10); ctx.fill();
  ctx.strokeStyle = "#7f9cc9"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 10, y - 2); ctx.lineTo(x - 50, y - 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + 2, y - 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x + 1, y - 4, 2, 0, Math.PI * 2); ctx.fill();
}

function drawNet(ctx, x, h) {
  const y0 = h.fromTop ? h.base : h.base - h.h;
  ctx.strokeStyle = "rgba(210,200,170,0.9)"; ctx.lineWidth = 2;
  for (let i = 0; i <= h.w; i += 15) { ctx.beginPath(); ctx.moveTo(x + i, y0); ctx.lineTo(x + i, y0 + h.h); ctx.stroke(); }
  for (let j = 0; j <= h.h; j += 15) { ctx.beginPath(); ctx.moveTo(x, y0 + j); ctx.lineTo(x + h.w, y0 + j); ctx.stroke(); }
  ctx.fillStyle = "#e0773a"; // floats
  for (let i = 0; i <= h.w; i += 45) { ctx.beginPath(); ctx.arc(x + i, h.fromTop ? y0 + h.h : y0, 6, 0, Math.PI * 2); ctx.fill(); }
}

function drawBag(ctx, x, y, t) {
  ctx.fillStyle = "rgba(235,240,245,0.75)";
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 12);
  ctx.quadraticCurveTo(x - 24 + Math.sin(t * 3) * 4, y + 20, x, y + 22);
  ctx.quadraticCurveTo(x + 24 + Math.sin(t * 3 + 1) * 4, y + 20, x + 18, y - 12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(235,240,245,0.8)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x - 8, y - 14, 6, Math.PI, 0); ctx.arc(x + 8, y - 14, 6, Math.PI, 0); ctx.stroke();
}

// ---------- Pickups ----------
export function drawPickups(ctx, world, scroll, t, creatureById) {
  for (const p of world.pickups) {
    const x = p.x - scroll;
    if (x > W + 60 || x < -60) continue;
    const y = p.y + (p.bob || 0);
    if (p.kind === "pearl") {
      ctx.fillStyle = "#fff4fb"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f2c9e4";
      ctx.beginPath(); ctx.arc(x + 3, y + 3, p.r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x - 4, y - 4, 3, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "shield") {
      const r = p.r + Math.sin(t * 4) * 2;
      ctx.fillStyle = "rgba(160,240,255,0.25)";
      ctx.strokeStyle = "#a8f4ff"; ctx.lineWidth = 3; ctx.shadowColor = "#a8f4ff"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "creature") {
      const c = creatureById(p.id);
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3);
      ctx.fillStyle = "#fff6a8";
      ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); c.draw(ctx, 64); ctx.restore();
    }
  }
}
