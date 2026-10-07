// Procedural cave terrain: floor & ceiling made of segments that step up/down,
// with occasional trenches ("palung") where the floor or ceiling is missing.
// All x values are world coordinates; the camera scrolls by `scroll`.

export const W = 1280, H = 720;
const BASE_FLOOR = H - 90, BASE_CEIL = 90;
const MIN_GAP = 330;   // minimum free space between ceiling and floor
const STEP = 44;       // max height change between neighbours (auto-climbable)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createWorld() {
  const world = { segs: [], spikes: [], coins: [], end: 0, floor: BASE_FLOOR, ceil: BASE_CEIL, lastPit: true };
  addSeg(world, 1400, BASE_FLOOR, BASE_CEIL); // flat, safe start
  return world;
}

function addSeg(world, w, floor, ceil) {
  const seg = { x: world.end, w, floor, ceil };
  world.segs.push(seg);
  world.end += w;
  return seg;
}

// Generate terrain until the world reaches `untilX`. `level` (0..1) scales difficulty.
export function extend(world, untilX, level) {
  while (world.end < untilX) {
    const pitChance = world.lastPit ? 0 : 0.18 + level * 0.22;
    if (Math.random() < pitChance) {
      // Trench: remove floor or ceiling. Keep the other side flat so the player can flip over it.
      const bottom = Math.random() < 0.6;
      const w = rand(170, 230 + level * 90);
      const seg = addSeg(world, w, bottom ? null : world.floor, bottom ? world.ceil : null);
      seg.pit = bottom ? "bottom" : "top";
      // Reward coin over the trench, on the safe side.
      const cy = bottom ? world.ceil + 50 : world.floor - 50;
      world.coins.push({ x: seg.x + w / 2, y: cy, r: 16 });
      world.lastPit = true;
      continue;
    }

    // Normal segment: nudge floor/ceiling by up to one step, staying inside bounds.
    world.floor = clamp(world.floor + pick([-STEP, 0, 0, STEP]), H - 190, BASE_FLOOR);
    world.ceil = clamp(world.ceil + pick([-STEP, 0, 0, STEP]), BASE_CEIL, 190);
    if (world.floor - world.ceil < MIN_GAP) world.ceil = world.floor - MIN_GAP;
    const w = rand(260, 520);
    const seg = addSeg(world, w, world.floor, world.ceil);
    world.lastPit = false;

    // Spike on this segment (not right at the edges so it stays readable).
    if (Math.random() < 0.55 + level * 0.35) {
      const top = Math.random() < 0.5;
      const h = rand(50, 95 + level * 30);
      world.spikes.push({ x: seg.x + rand(80, w - 130), w: 50, h, top, base: top ? seg.ceil : seg.floor });
    }
    if (Math.random() < 0.5) {
      world.coins.push({ x: seg.x + rand(60, w - 60), y: rand(seg.ceil + 60, seg.floor - 60), r: 16 });
    }
  }
}

// Drop everything that has scrolled off the left side of the screen.
export function prune(world, scroll) {
  const left = scroll - 200;
  world.segs = world.segs.filter((s) => s.x + s.w > left);
  world.spikes = world.spikes.filter((s) => s.x + s.w > left);
  world.coins = world.coins.filter((c) => c.x > left && !c.taken);
}

export function segAt(world, x) {
  return world.segs.find((s) => x >= s.x && x < s.x + s.w);
}

// Highest floor / lowest ceiling under the span [x0, x1] (null if only trench below/above).
export function surfaceUnder(world, x0, x1) {
  let floor = null, ceil = null;
  for (const s of world.segs) {
    if (s.x + s.w <= x0 || s.x >= x1) continue;
    if (s.floor !== null) floor = floor === null ? s.floor : Math.min(floor, s.floor);
    if (s.ceil !== null) ceil = ceil === null ? s.ceil : Math.max(ceil, s.ceil);
  }
  return { floor, ceil };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- Rendering ----------
const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.4 }));

function silhouette(ctx, scroll, speed, amp, baseY, dir, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, dir > 0 ? H : 0);
  for (let x = 0; x <= W; x += 40) {
    const wx = x + scroll * speed;
    const y = baseY + dir * -amp * (0.5 + 0.5 * Math.sin(wx * 0.006) * Math.cos(wx * 0.0023));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, dir > 0 ? H : 0);
  ctx.fill();
}

export function drawBackground(ctx, scroll) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#140f38");
  g.addColorStop(0.5, "#24175a");
  g.addColorStop(1, "#140f38");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  for (const s of stars) {
    const x = ((s.x - scroll * 0.05) % W + W) % W;
    ctx.globalAlpha = 0.3 + s.r / 3;
    ctx.fillRect(x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // Far cave walls (stalactites / stalagmites) with parallax.
  silhouette(ctx, scroll, 0.15, 140, H - 40, 1, "#2a1b63");
  silhouette(ctx, scroll, 0.15, 140, 40, -1, "#2a1b63");
  silhouette(ctx, scroll, 0.35, 90, H - 20, 1, "#33207a");
  silhouette(ctx, scroll, 0.35, 90, 20, -1, "#33207a");
}

export function drawTerrain(ctx, world, scroll, t) {
  for (const s of world.segs) {
    const x = Math.floor(s.x - scroll), w = Math.ceil(s.w) + 1;
    if (x > W || x + w < 0) continue;

    if (s.floor !== null) {
      const g = ctx.createLinearGradient(0, s.floor, 0, H);
      g.addColorStop(0, "#ff4fa3");
      g.addColorStop(0.15, "#b0307a");
      g.addColorStop(1, "#4a1747");
      ctx.fillStyle = g;
      ctx.fillRect(x, s.floor, w, H - s.floor);
      ctx.fillStyle = "#ffd1ec";
      ctx.fillRect(x, s.floor, w, 5);
    }
    if (s.ceil !== null) {
      const g = ctx.createLinearGradient(0, 0, 0, s.ceil);
      g.addColorStop(0, "#4a1747");
      g.addColorStop(0.85, "#b0307a");
      g.addColorStop(1, "#ff4fa3");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, s.ceil);
      ctx.fillStyle = "#ffd1ec";
      ctx.fillRect(x, s.ceil - 5, w, 5);
    }

    // Trench: glowing abyss + warning stripes at the lip.
    if (s.pit) {
      const bottom = s.pit === "bottom";
      const pulse = 0.55 + 0.25 * Math.sin(t * 5);
      const g = bottom ? ctx.createLinearGradient(0, H - 160, 0, H) : ctx.createLinearGradient(0, 160, 0, 0);
      g.addColorStop(0, "rgba(255,60,60,0)");
      g.addColorStop(1, `rgba(255,60,60,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, bottom ? H - 160 : 0, w, 160);
      // jagged teeth at the bottom of the trench
      ctx.fillStyle = "#ff3c5a";
      ctx.beginPath();
      for (let i = 0; i < w; i += 28) {
        const y0 = bottom ? H : 0, tip = bottom ? H - 34 : 34;
        ctx.moveTo(x + i, y0); ctx.lineTo(x + i + 14, tip); ctx.lineTo(x + i + 28, y0);
      }
      ctx.fill();
    }
  }
}

export function drawSpikes(ctx, world, scroll) {
  ctx.fillStyle = "#ffe14f";
  ctx.shadowColor = "#ffe14f";
  ctx.shadowBlur = 12;
  for (const o of world.spikes) {
    const x = o.x - scroll;
    if (x > W + 60 || x < -60) continue;
    ctx.beginPath();
    const dir = o.top ? 1 : -1;
    ctx.moveTo(x, o.base); ctx.lineTo(x + o.w, o.base); ctx.lineTo(x + o.w / 2, o.base + dir * o.h);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function drawCoins(ctx, world, scroll, t) {
  for (const c of world.coins) {
    const x = c.x - scroll;
    if (x > W + 40 || x < -40) continue;
    const sx = Math.abs(Math.cos(t * 4 + c.x)); // spinning coin
    ctx.fillStyle = "#4fffd2";
    ctx.shadowColor = "#4fffd2";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(x, c.y, c.r * (0.3 + 0.7 * sx), c.r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
