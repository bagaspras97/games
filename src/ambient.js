// Background sea life: fish, schools, turtles, rays, glowing deep-sea creatures.
// They live in screen space on parallax layers (smaller = farther), swim with
// wiggling tails, and dart away when the player swims close.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Species per zone (repeats = more common).
const BY_ZONE = [
  ["tang", "tang", "butterfly", "school", "school", "angel", "turtle", "wrasse"],
  ["school", "school", "angel", "tang", "turtle", "ray", "barracuda", "wrasse"],
  ["hatchet", "hatchet", "lantern", "lantern", "squid", "school", "ray"],
  ["lantern", "lantern", "lantern", "siphono", "squid", "hatchet", "bigangler"],
];
const WANT = [11, 10, 9, 9]; // target number of creatures on screen per zone

let list = [];

export function clearAmbient() { list = []; }

function spawn(zone, W, H, anywhere) {
  const kind = pick(BY_ZONE[zone]);
  const layer = rand(0.45, 0.95);                 // 1 = close to the play layer
  const dir = Math.random() < 0.8 ? -1 : 1;        // most swim against the scroll
  const y = rand(130, H - 150);
  const x = anywhere ? rand(0, W) : dir < 0 ? W + 80 : -80;
  const base = { kind, layer, dir, x, y, baseY: y, phase: rand(0, TAU), flee: 0, vx: 0, vy: 0 };
  if (kind === "school") { // a school = several small fish moving together
    const n = 6 + Math.floor(Math.random() * 6), color = pick(["#c9e4ff", "#ffe7a0", "#b5f0d8"]);
    for (let i = 0; i < n; i++) {
      list.push({ ...base, kind: "sardine", color, x: base.x + (i % 4) * 18 * -dir, y: y + Math.floor(i / 4) * 14 + rand(-4, 4), baseY: y + Math.floor(i / 4) * 14, phase: base.phase + i * 0.4, speed: 90 });
    }
    return;
  }
  const speeds = { tang: 70, butterfly: 55, angel: 45, wrasse: 80, turtle: 35, ray: 50, barracuda: 120, hatchet: 40, lantern: 60, squid: 70, siphono: 20, bigangler: 25 };
  const colors = { tang: pick(["#3a7bff", "#ffd23a"]), butterfly: "#ffe45a", angel: pick(["#6fa8ff", "#ffb84a"]), wrasse: pick(["#4fd6a0", "#ff7ad0"]) };
  list.push({ ...base, speed: speeds[kind], color: colors[kind] });
}

export function updateAmbient(dt, zone, W, H, scrollSpeed, px, py) {
  if (list.length === 0) for (let i = 0; i < WANT[zone]; i++) spawn(zone, W, H, true);
  else if (list.length < WANT[zone] && Math.random() < dt * 1.2) spawn(zone, W, H, false);

  for (const f of list) {
    // react: dart away from the player when close (closer layers react more)
    const dx = f.x - px, dy = f.y - py, d = Math.hypot(dx, dy);
    if (d < 170 * f.layer) {
      f.flee = 1;
      f.vx += (dx / (d || 1)) * 900 * dt;
      f.vy += (dy / (d || 1)) * 700 * dt;
      if (Math.sign(dx) !== 0) f.dir = Math.sign(dx);
    }
    f.flee = Math.max(0, f.flee - dt * 0.8);
    f.vx *= 1 - Math.min(1, dt * 1.5);
    f.vy *= 1 - Math.min(1, dt * 1.5);
    const swim = f.dir * f.speed * (1 + f.flee * 2.5);
    f.x += (swim + f.vx - scrollSpeed * f.layer * 0.6) * dt;
    f.baseY += f.vy * dt;
    f.y = f.baseY + Math.sin(f.phase + f.x * 0.01) * 8;
    f.baseY = Math.max(110, Math.min(H - 120, f.baseY));
  }
  list = list.filter((f) => f.x > -200 && f.x < W + 200);
}

export function drawAmbient(ctx, t, dark) {
  // far layers first
  list.sort((a, b) => a.layer - b.layer);
  for (const f of list) {
    ctx.save();
    ctx.translate(f.x, f.y);
    const s = f.layer * 1.35;
    ctx.scale(s * f.dir * -1, s); // art faces left; flip when swimming right
    ctx.globalAlpha = 0.45 + f.layer * 0.45;
    const wag = Math.sin(t * (10 + f.flee * 18) + f.phase); // tail beat (faster when fleeing)
    DRAW[f.kind](ctx, f, t, wag, dark);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function eye(ctx, x, y, r = 2) {
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x - r * 0.3, y, r * 0.55, 0, TAU); ctx.fill();
}

function tail(ctx, x, wag, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, -h + wag * 3); ctx.lineTo(x + w, h + wag * 3); ctx.fill();
}

// All drawings face LEFT (head at negative x).
const DRAW = {
  sardine(ctx, f, t, wag) {
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 3.5, 0, 0, TAU); ctx.fill();
    tail(ctx, 8, wag, 6, 4, f.color);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(-8, -1, 14, 1);
  },
  tang(ctx, f, t, wag) {
    tail(ctx, 14, wag, 10, 8, f.color);
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = f.color === "#3a7bff" ? "#111a40" : "#fff3b0";
    ctx.beginPath(); ctx.ellipse(2, -3, 10, 4, -0.2, 0, TAU); ctx.fill();
    eye(ctx, -11, -3);
  },
  butterfly(ctx, f, t, wag) {
    tail(ctx, 12, wag, 7, 6, "#f0c030");
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#222"; ctx.fillRect(-9, -12, 3, 24);
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(7, -3, 3, 0, TAU); ctx.fill(); // eye spot
    ctx.beginPath(); ctx.moveTo(-13, 1); ctx.lineTo(-19, 2); ctx.lineWidth = 2; ctx.strokeStyle = "#e0b020"; ctx.stroke();
    eye(ctx, -9, -4, 1.8);
  },
  angel(ctx, f, t, wag) {
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -30, 8, -30 + wag * 2); ctx.quadraticCurveTo(4, 0, 8, 30 + wag * 2); ctx.quadraticCurveTo(0, 30, -14, 0); ctx.fill();
    tail(ctx, 10, wag, 8, 7, f.color);
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 5, -14); ctx.lineTo(-6 + i * 5, 14); ctx.stroke(); }
    eye(ctx, -8, -3);
  },
  wrasse(ctx, f, t, wag) {
    tail(ctx, 15, wag, 8, 5, f.color);
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(-14, -1.5, 26, 3);
    eye(ctx, -12, -1.5, 1.8);
  },
  barracuda(ctx, f, t, wag) {
    tail(ctx, 30, wag, 10, 7, "#9aa8b8");
    ctx.fillStyle = "#b8c4d2";
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(40,50,70,0.5)";
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-16 + i * 8, -2, 2, 3, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-34, 1); ctx.lineTo(-40, 3); ctx.lineWidth = 2; ctx.strokeStyle = "#b8c4d2"; ctx.stroke();
    eye(ctx, -26, -2, 1.8);
  },
  turtle(ctx, f, t, wag) {
    const flap = Math.sin(t * 2 + f.phase);
    ctx.fillStyle = "#6fbf73";
    ctx.beginPath(); ctx.ellipse(-8, -14, 16, 5, -0.6 + flap * 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-30, 0, 8, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3e8a4a";
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#8fdc84"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#6fbf73";
    ctx.beginPath(); ctx.ellipse(-6, 14, 14, 4, 0.6 - flap * 0.4, 0, TAU); ctx.fill();
    eye(ctx, -33, -2, 1.8);
  },
  ray(ctx, f, t, wag) {
    const flap = Math.sin(t * 2.5 + f.phase) * 10;
    ctx.fillStyle = "#4a5f8a";
    ctx.beginPath();
    ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -12 - flap, 14, -34 - flap); ctx.quadraticCurveTo(10, 0, 14, 34 + flap); ctx.quadraticCurveTo(0, 12 + flap, -22, 0);
    ctx.fill();
    ctx.strokeStyle = "#4a5f8a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(30, wag * 5, 46, wag * 8); ctx.stroke();
  },
  hatchet(ctx, f, t, wag, dark) { // silvery, mirror-like deep fish
    tail(ctx, 8, wag, 6, 5, "#c8d2e0");
    ctx.fillStyle = "#d8e0ec";
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(8, -8); ctx.lineTo(6, 10); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(127,255,240,${0.4 + 0.4 * Math.sin(t * 3 + f.phase)})`;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-4 + i * 3, 6, 1, 0, TAU); ctx.fill(); }
    eye(ctx, -6, -3, 2.6);
  },
  lantern(ctx, f, t, wag) {
    tail(ctx, 10, wag, 6, 4, "#56627e");
    ctx.fillStyle = "#56627e";
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 4.5, 0, 0, TAU); ctx.fill();
    const g = 0.5 + 0.5 * Math.sin(t * 4 + f.phase);
    ctx.fillStyle = `rgba(159,246,255,${0.5 + g * 0.5})`; ctx.shadowColor = "#9ff6ff"; ctx.shadowBlur = 8;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-6 + i * 4, 3, 1.3, 0, TAU); ctx.fill(); }
    ctx.shadowBlur = 0;
    eye(ctx, -8, -1, 1.6);
  },
  squid(ctx, f, t, wag) {
    const pulse = Math.sin(t * 3 + f.phase);
    ctx.fillStyle = "rgba(255,170,190,0.85)";
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(10, -10, 26, 0); ctx.quadraticCurveTo(10, 10, -6, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(32, -6); ctx.lineTo(32, 6); ctx.fill();
    ctx.strokeStyle = "rgba(255,170,190,0.85)"; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-6, i * 1.5); ctx.quadraticCurveTo(-14, i * (3 + pulse), -22 - pulse * 3, i * (4 + pulse)); ctx.stroke(); }
    eye(ctx, 0, -2, 2);
  },
  siphono(ctx, f, t) { // long glowing chain colony
    for (let i = 0; i < 12; i++) {
      const g = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 - i * 0.5 + f.phase));
      ctx.fillStyle = `rgba(255,160,240,${g})`; ctx.shadowColor = "#ffa0f0"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(i * 9, Math.sin(t * 1.5 + i * 0.6) * 6, 3.2 - i * 0.12, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  },
  bigangler(ctx, f, t) { // huge dim silhouette far away — only the lure is bright
    ctx.fillStyle = "rgba(10,8,20,0.9)";
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(80, -30); ctx.lineTo(80, 30); ctx.fill();
    ctx.strokeStyle = "rgba(60,50,80,0.9)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-20, -40); ctx.quadraticCurveTo(-50, -90, -70, -60); ctx.stroke();
    const g = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.fillStyle = "#fff59a"; ctx.shadowColor = "#fff59a"; ctx.shadowBlur = 30 * g;
    ctx.beginPath(); ctx.arc(-70, -58, 6 * g + 2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  },
};
