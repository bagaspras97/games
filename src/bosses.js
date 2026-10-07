// Bosses for the Adventure "Ujian" (exam) levels. The player cannot fight back —
// the goal is to survive the boss's attacks until the finish line.
//
// Every attack targets a LANE: the upper half of the corridor ("top") or the lower
// half ("bottom"). A flashing red band warns which lane is about to be hit, then
// the attack sweeps through it — switch to the other side in time!
//
//   🦀 L5  Kepiting Raksasa — a giant claw sweeps in from the right
//   🦈 L10 Hiu Martil       — the shark lunges from behind (left → right)
//   🐙 L15 Gurita Raksasa   — tentacles burst up/down just ahead of you
//   🎣 L20 Anglerfish Raksasa — chomping lunges from behind, in the dark

const TAU = Math.PI * 2;

export const BOSSES = {
  5: { key: "crab", name: "Kepiting Raksasa", icon: "🦀", every: 3.0, warn: 1.1, attack: "sweepLeft", speed: 1000 },
  10: { key: "shark", name: "Hiu Martil", icon: "🦈", every: 2.8, warn: 1.0, attack: "sweepRight", speed: 1150 },
  15: { key: "kraken", name: "Gurita Raksasa", icon: "🐙", every: 2.4, warn: 1.0, attack: "tentacle", speed: 0 },
  20: { key: "angler", name: "Anglerfish Raksasa", icon: "🎣", every: 2.3, warn: 0.95, attack: "sweepRight", speed: 1250 },
};

export function createBoss(levelNumber) {
  const def = BOSSES[levelNumber];
  if (!def) return null;
  return { def, t: 0, next: 3.5, attacks: [], enter: 0, lunging: false };
}

// lane of a y position given the corridor
export const laneOf = (y, ceil, floor) => (y < (ceil + floor) / 2 ? "top" : "bottom");

// ctx: { W, player {x, y, worldX}, ceil, floor, progress 0..1, scroll }
// Returns { warn: true } when a new warning starts (for a sound).
export function updateBoss(b, dt, c) {
  b.t += dt;
  b.enter = Math.min(1, b.enter + dt * 0.8);
  let warned = false;
  b.next -= dt;
  if (b.next <= 0 && c.progress < 0.97) {
    // mostly aim at the player's lane so they have to react
    const playerLane = laneOf(c.player.y, c.ceil, c.floor);
    const lane = Math.random() < 0.65 ? playerLane : (Math.random() < 0.5 ? "top" : "bottom");
    const a = { lane, warn: b.def.warn, t: 0 };
    if (b.def.attack === "sweepLeft") a.x = c.W + 160;
    if (b.def.attack === "sweepRight") a.x = -220;
    if (b.def.attack === "tentacle") a.wx = c.player.worldX + 330; // fixed in the world, just ahead
    b.attacks.push(a);
    b.next = Math.max(1.5, b.def.every - c.progress * 0.9);
    warned = true;
  }
  for (const a of b.attacks) {
    a.t += dt;
    if (a.warn > 0) { a.warn -= dt; continue; }
    if (b.def.attack === "sweepLeft") a.x -= b.def.speed * dt;
    else if (b.def.attack === "sweepRight") a.x += b.def.speed * dt;
    else a.life = (a.life || 0) + dt;
  }
  b.attacks = b.attacks.filter((a) =>
    a.x === undefined ? (a.life || 0) < 1.3 : a.x > -320 && a.x < c.W + 320);
  b.lunging = b.attacks.some((a) => a.warn <= 0 && b.def.attack === "sweepRight");
  return { warn: warned };
}

// Is the player inside an active attack?
export function bossHits(b, c) {
  for (const a of b.attacks) {
    if (a.warn > 0) continue;
    if (laneOf(c.player.y, c.ceil, c.floor) !== a.lane) continue;
    if (a.x !== undefined && Math.abs(a.x - c.player.x) < 70) return true;
    if (a.wx !== undefined && a.life > 0.2 && Math.abs(a.wx - c.player.worldX) < 40) return true;
  }
  return false;
}

// ---------- Drawing ----------
export function drawBoss(ctx, b, c, t) {
  const mid = (c.ceil + c.floor) / 2;
  // warnings: flashing red lane bands with "!" signs
  for (const a of b.attacks) {
    if (a.warn <= 0) continue;
    const y0 = a.lane === "top" ? c.ceil : mid, y1 = a.lane === "top" ? mid : c.floor;
    const flash = 0.18 + 0.14 * Math.sin(t * 22);
    let x0 = 0, w = c.W;
    if (a.wx !== undefined) { x0 = a.wx - c.scroll - 60; w = 120; }
    ctx.fillStyle = `rgba(255,50,70,${flash})`;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.fillStyle = "#ff3b5c"; ctx.font = "bold 34px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ex = a.wx !== undefined ? a.wx - c.scroll : b.def.attack === "sweepLeft" ? c.W - 40 : 40;
    ctx.fillText("!", ex, (y0 + y1) / 2);
  }
  ctx.textBaseline = "alphabetic";
  DRAW[b.def.key](ctx, b, c, t, mid);
}

const DRAW = {
  crab(ctx, b, c, t, mid) {
    // the crab sits at the right edge
    const x = c.W + 40 - b.enter * 120, y = c.floor - 40 + Math.sin(t * 3) * 4;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#c8352e";
    for (let i = 0; i < 4; i++) { // legs
      ctx.save(); ctx.rotate(-0.6 - i * 0.25 + Math.sin(t * 6 + i) * 0.08);
      ctx.fillRect(-120, -6, 90, 10); ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 110, 62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e85a4f"; ctx.beginPath(); ctx.ellipse(-10, -16, 80, 34, 0, 0, TAU); ctx.fill();
    for (const s of [-1, 1]) { // eye stalks
      ctx.strokeStyle = "#c8352e"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-50 + s * 22, -50); ctx.lineTo(-56 + s * 22, -90); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-56 + s * 22, -96, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-60 + s * 22, -96, 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (const a of b.attacks) if (a.warn <= 0) drawClaw(ctx, a.x, a.lane === "top" ? (c.ceil + mid) / 2 : (mid + c.floor) / 2, t);
    if (!b.attacks.some((a) => a.warn <= 0)) drawClaw(ctx, x - 120, y - 40, t, 0.6);
  },
  shark(ctx, b, c, t, mid) {
    if (!b.lunging) drawHammerhead(ctx, -40 + b.enter * 110, mid + Math.sin(t * 1.5) * 80, t, 0.8);
    for (const a of b.attacks) if (a.warn <= 0) drawHammerhead(ctx, a.x, a.lane === "top" ? (c.ceil + mid) / 2 : (mid + c.floor) / 2, t, 1.1);
  },
  kraken(ctx, b, c, t, mid) {
    // huge eyes glowing in the background, tentacle tips waving from the screen edges
    ctx.save();
    ctx.globalAlpha = 0.35 * b.enter;
    ctx.fillStyle = "#ffcf4a";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c.W * 0.78 + s * 70, mid, 26, 12 + Math.sin(t) * 2, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#111";
    for (const s of [-1, 1]) { ctx.fillRect(c.W * 0.78 + s * 70 - 3, mid - 10, 6, 20); }
    ctx.restore();
    for (const a of b.attacks) {
      const x = a.wx - c.scroll;
      if (a.warn > 0) { // bubbles rising from where it will strike
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        for (let i = 0; i < 4; i++) {
          const k = (t * 2 + i / 4) % 1, yb = a.lane === "top" ? c.ceil + k * 60 : c.floor - k * 60;
          ctx.beginPath(); ctx.arc(x + Math.sin(i * 3) * 14, yb, 4, 0, TAU); ctx.stroke();
        }
        continue;
      }
      const grow = Math.min(1, a.life / 0.2) * (a.life > 1.0 ? Math.max(0, 1 - (a.life - 1.0) / 0.3) : 1);
      const from = a.lane === "top" ? c.ceil : c.floor, to = mid, len = (to - from) * grow;
      ctx.strokeStyle = "#8a2d63"; ctx.lineCap = "round";
      ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(x, from);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 8 + k) * 10, from + (len * k) / 6);
      ctx.stroke();
      ctx.fillStyle = "#f2a3cf"; // suckers
      for (let k = 1; k <= 5; k++) { ctx.beginPath(); ctx.arc(x + 10 + Math.sin(t * 8 + k) * 10, from + (len * k) / 6, 5, 0, TAU); ctx.fill(); }
    }
  },
  angler(ctx, b, c, t, mid) {
    if (!b.lunging) drawAngler(ctx, -60 + b.enter * 120, mid + Math.sin(t * 1.2) * 70, t, 0.9, 0.3);
    for (const a of b.attacks) if (a.warn <= 0) drawAngler(ctx, a.x, a.lane === "top" ? (c.ceil + mid) / 2 : (mid + c.floor) / 2, t, 1.05, 1);
  },
};

function drawClaw(ctx, x, y, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const snap = Math.abs(Math.sin(t * 10)) * 0.4;
  ctx.fillStyle = "#c8352e";
  ctx.fillRect(0, -14, 160, 28); // arm
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e85a4f";
  ctx.save(); ctx.rotate(-snap);
  ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-70, -40, -95, -6); ctx.quadraticCurveTo(-60, -14, -10, -2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.rotate(snap);
  ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-70, 40, -95, 6); ctx.quadraticCurveTo(-60, 14, -10, 2); ctx.fill(); ctx.restore();
  ctx.restore();
}

function drawHammerhead(ctx, x, y, t, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const wag = Math.sin(t * 9) * 0.35;
  ctx.fillStyle = "#6f8299";
  ctx.save(); ctx.translate(-110, 0); ctx.rotate(wag); // tail
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-50, -40); ctx.lineTo(-30, 0); ctx.lineTo(-44, 26); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 120, 30, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(20, -70); ctx.lineTo(40, -24); ctx.fill(); // dorsal fin
  ctx.fillStyle = "#e3e9f0"; ctx.beginPath(); ctx.ellipse(10, 12, 100, 14, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = "#6f8299"; ctx.fillRect(100, -40, 26, 80); // the hammer
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(114, -36, 6, 0, TAU); ctx.arc(114, 36, 6, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawAngler(ctx, x, y, t, s, open) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const jaw = 20 + open * 30 * Math.abs(Math.sin(t * 8));
  ctx.fillStyle = "#1c1428";
  ctx.beginPath(); ctx.arc(0, 0, 95, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-150, -50); ctx.lineTo(-140, 0); ctx.lineTo(-150, 50); ctx.fill();
  ctx.fillStyle = "#05030a"; // mouth
  ctx.beginPath(); ctx.moveTo(95, -jaw); ctx.lineTo(10, 0); ctx.lineTo(95, jaw); ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 6; i++) {
    const tx = 30 + i * 12;
    ctx.beginPath(); ctx.moveTo(tx, -jaw * (tx / 95) - 2); ctx.lineTo(tx + 5, -jaw * (tx / 95) + 14); ctx.lineTo(tx + 10, -jaw * ((tx + 10) / 95) - 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx, jaw * (tx / 95) + 2); ctx.lineTo(tx + 5, jaw * (tx / 95) - 14); ctx.lineTo(tx + 10, jaw * ((tx + 10) / 95) + 2); ctx.fill();
  }
  ctx.fillStyle = "#ffef5a"; ctx.beginPath(); ctx.arc(20, -40, 10, 0, TAU); ctx.fill(); // eye
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(24, -40, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#3a2e50"; ctx.lineWidth = 5; // lure
  ctx.beginPath(); ctx.moveTo(-10, -90); ctx.quadraticCurveTo(60, -170, 130, -110 + Math.sin(t * 3) * 10); ctx.stroke();
  const g = 0.7 + 0.3 * Math.sin(t * 5);
  ctx.fillStyle = "#fff59a"; ctx.shadowColor = "#fff59a"; ctx.shadowBlur = 40 * g;
  ctx.beginPath(); ctx.arc(130, -108 + Math.sin(t * 3) * 10, 12 * g + 4, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
