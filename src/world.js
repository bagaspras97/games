// Deep-sea world: seabed (floor) and ice/rock ceiling made of stepped segments,
// trenches ("palung"), zone-based hazards, pearls, shield bubbles and rare creatures.
// All x values are world coordinates; the camera scrolls by `scroll`.

import { CREATURES } from "./creatures.js";

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

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Hazards unlocked per zone (cumulative): 1 = natural, 2 = moving creatures, 3 = human-made.
const HAZARDS_BY_ZONE = [
  ["urchin", "coral", "icicle"],
  ["urchin", "coral", "icicle", "jelly", "jelly", "hook"],
  ["urchin", "coral", "icicle", "jelly", "hook", "sword", "net", "bag"],
  ["urchin", "coral", "icicle", "jelly", "jelly", "hook", "sword", "sword", "net", "bag"],
];

export function createWorld(dex = [], startX = 0) {
  const world = {
    segs: [], hazards: [], pickups: [], end: startX,
    floor: BASE_FLOOR, ceil: BASE_CEIL, lastPit: true, dex,
  };
  addSeg(world, 1400, BASE_FLOOR, BASE_CEIL); // flat, safe start
  return world;
}

function addSeg(world, w, floor, ceil) {
  const deco = [];
  for (let x = 30; x < w - 20; x += rand(60, 140)) deco.push({ dx: x, kind: pick(["weed", "weed", "coral", "rock", "shell"]), h: rand(18, 42) });
  const seg = { x: world.end, w, floor, ceil, deco };
  world.segs.push(seg);
  world.end += w;
  return seg;
}

// Generate terrain until the world reaches `untilX`.
export function extend(world, untilX) {
  while (world.end < untilX) {
    const depth = world.end / PX_PER_M;
    const zone = zoneIndex(depth);
    const level = clamp(depth / 2000, 0, 1);

    const pitChance = world.lastPit ? 0 : 0.16 + level * 0.22;
    if (Math.random() < pitChance) {
      const bottom = Math.random() < 0.6;
      const w = rand(170, 230 + level * 90);
      const seg = addSeg(world, w, bottom ? null : world.floor, bottom ? world.ceil : null);
      seg.pit = bottom ? "bottom" : "top";
      seg.eyes = Math.random() < 0.6; // something watching from the trench...
      world.pickups.push({ kind: "pearl", x: seg.x + w / 2, y: bottom ? world.ceil + 50 : world.floor - 50, r: 12 });
      world.lastPit = true;
      continue;
    }

    world.floor = clamp(world.floor + pick([-STEP, 0, 0, STEP]), H - 190, BASE_FLOOR);
    world.ceil = clamp(world.ceil + pick([-STEP, 0, 0, STEP]), BASE_CEIL, 190);
    if (world.floor - world.ceil < MIN_GAP) world.ceil = world.floor - MIN_GAP;
    const w = rand(280, 540);
    const seg = addSeg(world, w, world.floor, world.ceil);
    world.lastPit = false;

    if (Math.random() < 0.6 + level * 0.35) spawnHazard(world, seg, pick(HAZARDS_BY_ZONE[zone]));

    // pearls: small arcs of 3
    if (Math.random() < 0.55) {
      const cx = seg.x + rand(80, w - 120), cy = rand(seg.ceil + 70, seg.floor - 70);
      for (let i = 0; i < 3; i++) world.pickups.push({ kind: "pearl", x: cx + i * 40, y: cy - Math.sin((i / 2) * Math.PI) * 20, r: 12 });
    }
    if (Math.random() < 0.05) {
      world.pickups.push({ kind: "shield", x: seg.x + w / 2, y: (seg.ceil + seg.floor) / 2, r: 22 });
    }
    if (Math.random() < 0.05) {
      const pool = CREATURES.filter((c) => c.zone === zone);
      const fresh = pool.filter((c) => !world.dex.includes(c.id));
      const c = pick(fresh.length ? fresh : pool);
      world.pickups.push({ kind: "creature", id: c.id, x: seg.x + w * 0.6, y: rand(seg.ceil + 80, seg.floor - 80), baseY: 0, r: 26 });
    }
  }
}

function spawnHazard(world, seg, type) {
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
      const fromTop = Math.random() < 0.5;
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
    if (h.type === "jelly") h.y = h.baseY + Math.sin(t * 1.8 + h.phase) * h.amp;
    else if (h.type === "hook") {
      const progress = clamp((W + 100 - sx) / 500, 0, 1);
      h.y = h.top + h.len * progress + Math.sin(t * 2) * 6;
    } else if (h.type === "sword") {
      if (!h.active && sx < W + 520) h.active = true;
      if (h.active) h.x -= h.speed * dt;
    } else if (h.type === "bag") {
      h.y = h.baseY + Math.sin(t * 0.9 + h.phase) * 30;
      h.x -= 25 * dt;
    }
  }
  for (const p of world.pickups) if (p.kind !== "pearl") p.bob = Math.sin(t * 2 + p.x) * 8;
}

// Circle (cx, cy, cr) vs hazard.
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

  // far fish school silhouettes
  ctx.fillStyle = `rgba(0,20,50,${0.25})`;
  for (let i = 0; i < 9; i++) {
    const x = ((i * 150 - scroll * 0.12 - t * 25) % (W + 300) + W + 300) % (W + 300) - 150;
    const y = 250 + Math.sin(i * 1.7) * 80 + Math.sin(t + i) * 6;
    ctx.beginPath(); ctx.ellipse(x, y, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x + 22, y - 6); ctx.lineTo(x + 22, y + 6); ctx.fill();
  }

  // kelp forest silhouette (parallax)
  ctx.strokeStyle = "rgba(0,30,40,0.35)";
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

// ---------- Terrain ----------
export function drawTerrain(ctx, world, scroll, depth, t) {
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
      for (const d of s.deco) drawDeco(ctx, x + d.dx, s.floor, d, t);
    }
    if (s.ceil !== null) {
      const g = ctx.createLinearGradient(0, 0, 0, s.ceil);
      g.addColorStop(0, iceDark); g.addColorStop(1, ice);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, s.ceil);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, s.ceil - 4, w, 4);
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

function drawDeco(ctx, x, y, d, t) {
  if (d.kind === "weed") {
    ctx.strokeStyle = "#3fae6a"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.sin(t * 2 + x) * 8, y - d.h / 2, x + Math.sin(t * 2 + x + 1) * 10, y - d.h);
    ctx.stroke();
  } else if (d.kind === "coral") {
    ctx.strokeStyle = "#ff8fa8"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - d.h * 0.7);
    ctx.moveTo(x, y - d.h * 0.35); ctx.lineTo(x - 9, y - d.h * 0.65);
    ctx.moveTo(x, y - d.h * 0.45); ctx.lineTo(x + 9, y - d.h * 0.8);
    ctx.stroke();
  } else if (d.kind === "rock") {
    ctx.fillStyle = "rgba(60,60,80,0.45)";
    ctx.beginPath(); ctx.ellipse(x, y, 14, 8, 0, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillStyle = "#ffd6c9";
    ctx.beginPath(); ctx.arc(x, y - 4, 6, Math.PI, 0); ctx.fill();
  }
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
