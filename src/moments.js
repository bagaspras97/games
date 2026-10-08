import { devParam } from "./dev.js";
// Rare special moments: big, slow background events (a whale passing, a dolphin
// pod, a giant squid…). One happens every so often, chosen by depth zone.
// They are purely visual — drawn behind the terrain — and the player gets a few
// pearls for witnessing one.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ease = (k) => k * k * (3 - 2 * k);

export const MOMENTS = {
  dolphins: { name: "Kawanan lumba-lumba bermain!", icon: "🐬", zones: [0], dur: 7, sound: "dolphin", draw: drawDolphins },
  baitball: { name: "Pusaran ribuan ikan kecil!", icon: "🌀", zones: [0, 1], dur: 10, sound: "zone", draw: drawBaitBall },
  humpback: { name: "Paus bungkuk melintas…", icon: "🐋", zones: [0, 1], dur: 15, sound: "whale", draw: drawHumpback },
  sperm: { name: "Paus sperma menyelam ke kedalaman…", icon: "🐳", zones: [1, 2], dur: 13, sound: "whale", draw: drawSperm },
  squid: { name: "Cumi-cumi raksasa muncul dari kegelapan!", icon: "🦑", zones: [2, 3], dur: 12, sound: "abyss", draw: drawGiantSquid },
  bigjelly: { name: "Ubur-ubur raksasa bercahaya naik perlahan…", icon: "🪼", zones: [3], dur: 14, sound: "zone", draw: drawGiantJelly },
  glowwave: { name: "Gelombang cahaya bioluminesensi!", icon: "✨", zones: [2, 3], dur: 7, sound: "discover", draw: drawGlowWave },
};

// Dev helper: ?moment=humpback starts that moment a few seconds into a dive.
const FORCED = devParam("moment");

let current = null;
let cooldown = FORCED ? 3 : rand(25, 45);

export function resetMoments() {
  current = null;
  cooldown = FORCED ? 3 : rand(25, 45);
}

export function activeMoment() { return current; }

// Returns { started } or { ended } events for the game to react to.
export function updateMoments(dt, zone, playing) {
  if (current) {
    current.t += dt;
    if (current.t >= current.def.dur) {
      const ended = current;
      current = null;
      cooldown = rand(40, 75);
      return { ended };
    }
    return null;
  }
  if (!playing) return null;
  cooldown -= dt;
  if (cooldown > 0) return null;
  const options = Object.entries(MOMENTS).filter(([, m]) => m.zones.includes(zone));
  const chosen = FORCED && MOMENTS[FORCED] ? [FORCED, MOMENTS[FORCED]] : pick(options);
  if (!chosen) return null;
  current = { key: chosen[0], def: chosen[1], t: 0, seed: Math.random() };
  return { started: current };
}

export function drawMoment(ctx, W, H, t) {
  if (!current) return;
  const k = Math.min(1, current.t / current.def.dur);
  // fade in/out at both ends
  const fade = Math.min(1, current.t / 1.2, (current.def.dur - current.t) / 1.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  current.def.draw(ctx, k, t, W, H, current);
  ctx.restore();
}

// ---------- 🐋 Humpback whale: huge, slow, long pectoral fins, song bubbles ----------
function drawHumpback(ctx, k, t, W, H) {
  const x = W + 450 - k * (W + 1100), y = H * 0.42 + Math.sin(k * Math.PI) * -30;
  ctx.translate(x, y);
  ctx.globalAlpha *= 0.85;
  const fl = Math.sin(t * 1.1) * 0.35;
  // bubble trail
  ctx.strokeStyle = "rgba(220,240,255,0.5)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const kk = (t * 0.4 + i / 10) % 1;
    ctx.beginPath(); ctx.arc(-160 + i * 6, -50 - kk * 160, 3 + kk * 6, 0, TAU); ctx.stroke();
  }
  // tail stock + fluke (vertical beat)
  ctx.fillStyle = "#24405f";
  ctx.beginPath(); ctx.moveTo(200, -30); ctx.quadraticCurveTo(300, fl * 30, 360, fl * 50); ctx.quadraticCurveTo(300, 30 + fl * 30, 200, 35); ctx.fill();
  ctx.save(); ctx.translate(360, fl * 50); ctx.rotate(fl * 0.8);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -50, 80, -70); ctx.quadraticCurveTo(50, -20, 20, 0);
  ctx.quadraticCurveTo(50, 20, 80, 70); ctx.quadraticCurveTo(30, 50, 0, 0); ctx.fill();
  ctx.restore();
  // far pectoral fin
  ctx.fillStyle = "#1d3550";
  ctx.save(); ctx.translate(-60, 10); ctx.rotate(-0.9 - fl * 0.5);
  ctx.beginPath(); ctx.ellipse(0, -90, 22, 100, 0, 0, TAU); ctx.fill(); ctx.restore();
  // body
  const g = ctx.createLinearGradient(0, -70, 0, 70);
  g.addColorStop(0, "#2c4c70"); g.addColorStop(0.6, "#3a5f88"); g.addColorStop(1, "#cfdcea");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-260, 10);
  ctx.quadraticCurveTo(-250, -60, -100, -70);
  ctx.quadraticCurveTo(80, -75, 210, -30);
  ctx.quadraticCurveTo(230, 0, 210, 35);
  ctx.quadraticCurveTo(0, 80, -200, 50);
  ctx.quadraticCurveTo(-265, 40, -260, 10);
  ctx.fill();
  // throat grooves
  ctx.strokeStyle = "rgba(60,90,130,0.6)"; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-240 + i * 6, 25 + i * 4); ctx.quadraticCurveTo(-120, 45 + i * 4, 0, 40 + i * 3); ctx.stroke(); }
  // tubercles on the head
  ctx.fillStyle = "rgba(20,40,60,0.6)";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-230 + i * 18, -30 - Math.sin(i) * 6, 4, 0, TAU); ctx.fill(); }
  // small dorsal fin
  ctx.fillStyle = "#24405f";
  ctx.beginPath(); ctx.moveTo(100, -60); ctx.lineTo(130, -85); ctx.lineTo(150, -55); ctx.fill();
  // near pectoral fin — very long, the humpback's signature
  ctx.fillStyle = "#4a6f98";
  ctx.save(); ctx.translate(-80, 40); ctx.rotate(0.9 + fl * 0.5);
  ctx.beginPath(); ctx.ellipse(0, 100, 24, 110, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#dfe8f2"; ctx.beginPath(); ctx.ellipse(6, 120, 12, 80, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // eye
  ctx.fillStyle = "#0b1a2b"; ctx.beginPath(); ctx.arc(-170, 8, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-172, 6, 2, 0, TAU); ctx.fill();
}

// ---------- 🐳 Sperm whale: blocky head, diving diagonally ----------
function drawSperm(ctx, k, t, W, H) {
  const x = W + 400 - k * (W + 900), y = H * 0.25 + k * H * 0.45;
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  ctx.globalAlpha *= 0.75;
  const fl = Math.sin(t * 1.3) * 0.4;
  ctx.fillStyle = "#3a3f4c";
  ctx.beginPath(); ctx.moveTo(180, -20); ctx.quadraticCurveTo(260, fl * 30, 300, fl * 40); ctx.quadraticCurveTo(260, 20 + fl * 30, 180, 30); ctx.fill();
  ctx.save(); ctx.translate(300, fl * 40); ctx.rotate(fl);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -40, 60, -50); ctx.lineTo(20, 0); ctx.lineTo(60, 50); ctx.quadraticCurveTo(20, 40, 0, 0); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#4a5060";
  ctx.beginPath();
  ctx.moveTo(-220, -50); ctx.lineTo(-40, -60); ctx.quadraticCurveTo(150, -50, 200, 0); ctx.quadraticCurveTo(150, 45, -40, 50);
  ctx.lineTo(-200, 55); ctx.quadraticCurveTo(-240, 0, -220, -50); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3; // narrow lower jaw
  ctx.beginPath(); ctx.moveTo(-200, 45); ctx.lineTo(-60, 40); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2; // wrinkles
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(20 + i * 25, -40); ctx.quadraticCurveTo(30 + i * 25, 0, 20 + i * 25, 40); ctx.stroke(); }
  ctx.fillStyle = "#0b0f18"; ctx.beginPath(); ctx.arc(-60, 10, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3a3f4c"; ctx.beginPath(); ctx.ellipse(-30, 45, 30, 9, 0.5 + fl, 0, TAU); ctx.fill();
}

// ---------- 🐬 Dolphins: a pod leaping in arcs ----------
function drawDolphins(ctx, k, t, W, H, m) {
  for (let i = 0; i < 4; i++) {
    const kk = k * 1.15 - i * 0.05;
    if (kk < 0 || kk > 1) continue;
    const x = -150 + kk * (W + 300);
    const arc = Math.sin(kk * Math.PI * 4 + i);
    const y = H * 0.35 + i * 34 + arc * -70;
    const ang = Math.cos(kk * Math.PI * 4 + i) * -0.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = "#7d94ad";
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#dfe8f2"; ctx.beginPath(); ctx.ellipse(4, 6, 36, 6, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#7d94ad";
    ctx.beginPath(); ctx.moveTo(42, -2); ctx.lineTo(62, 2); ctx.lineTo(42, 6); ctx.fill();           // beak
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(4, -30); ctx.lineTo(14, -12); ctx.fill();       // dorsal
    const f = Math.sin(t * 9 + i) * 0.4;
    ctx.save(); ctx.translate(-44, 0); ctx.rotate(f);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -14); ctx.lineTo(-12, 0); ctx.lineTo(-18, 14); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(30, -3, 2.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(46, 2, 8, 0.2, 0.9); ctx.stroke(); // smile
    ctx.restore();
  }
}

// ---------- 🌀 Bait ball: hundreds of tiny fish swirling as one ----------
function drawBaitBall(ctx, k, t, W, H, m) {
  const cx = W + 200 - ease(k) * (W + 400), cy = H * 0.45 + Math.sin(t * 0.7) * 30;
  for (let i = 0; i < 90; i++) {
    const r = 30 + ((i * 37) % 70) + Math.sin(t * 2 + i) * 6;
    const a = t * (1.4 + (i % 3) * 0.2) + i * 0.7;
    const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r * 0.8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    const shine = Math.sin(a * 2 + t * 3) > 0.6;
    ctx.fillStyle = shine ? "#ffffff" : "#b9cde0";
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------- 🦑 Giant squid: long arms & two huge tentacles ----------
function drawGiantSquid(ctx, k, t, W, H) {
  const x = W + 300 - ease(k) * (W + 800), y = H * 0.2 + k * H * 0.4;
  ctx.translate(x, y);
  ctx.rotate(0.35);
  ctx.globalAlpha *= 0.8;
  // arms trail behind (to the right)
  ctx.strokeStyle = "#a83a4a"; ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    ctx.lineWidth = 9 - i * 0.6;
    ctx.beginPath(); ctx.moveTo(60, -20 + i * 6);
    for (let s = 1; s <= 8; s++) ctx.lineTo(60 + s * 26, -20 + i * 6 + Math.sin(t * 2.5 + s * 0.6 + i) * s * 2.2);
    ctx.stroke();
  }
  ctx.lineWidth = 4; // two long feeding tentacles with clubs
  for (let j = 0; j < 2; j++) {
    ctx.beginPath(); ctx.moveTo(60, j * 10);
    let ex = 0, ey = 0;
    for (let s = 1; s <= 14; s++) { ex = 60 + s * 30; ey = j * 10 + Math.sin(t * 2 + s * 0.4 + j * 2) * s * 3; ctx.lineTo(ex, ey); }
    ctx.stroke();
    ctx.fillStyle = "#a83a4a"; ctx.beginPath(); ctx.ellipse(ex + 10, ey, 18, 8, 0, 0, TAU); ctx.fill();
  }
  // mantle
  const g = ctx.createLinearGradient(-220, 0, 60, 0);
  g.addColorStop(0, "#7a2434"); g.addColorStop(1, "#c4505e");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-230, 0); ctx.quadraticCurveTo(-120, -55, 60, -30); ctx.lineTo(60, 40); ctx.quadraticCurveTo(-120, 55, -230, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-230, 0); ctx.lineTo(-270, -40); ctx.lineTo(-250, 0); ctx.lineTo(-270, 40); ctx.fill(); // fins
  // the giant eye (largest in the animal kingdom)
  ctx.fillStyle = "#f2e6c8"; ctx.beginPath(); ctx.arc(30, 0, 18, 0, TAU); ctx.fill();
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(26 + Math.sin(t) * 3, 0, 9, 0, TAU); ctx.fill();
}

// ---------- 🪼 Giant glowing jellyfish rising from the abyss ----------
function drawGiantJelly(ctx, k, t, W, H) {
  const x = W * 0.62 - k * 260, y = H + 180 - ease(k) * (H + 420);
  ctx.translate(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
  // trailing tentacles
  ctx.strokeStyle = `rgba(255,160,240,${0.35 + pulse * 0.25})`; ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const x0 = -90 + i * 20;
    ctx.beginPath(); ctx.moveTo(x0, 20);
    for (let s = 1; s <= 10; s++) ctx.lineTo(x0 + Math.sin(t * 1.5 - s * 0.5 + i) * s * 2.5, 20 + s * 26);
    ctx.stroke();
  }
  // bell
  ctx.shadowColor = "#ff9cf0"; ctx.shadowBlur = 40 + pulse * 40;
  const g = ctx.createRadialGradient(0, -20, 10, 0, 0, 140);
  g.addColorStop(0, `rgba(255,220,250,${0.8})`); g.addColorStop(0.6, "rgba(200,120,255,0.55)"); g.addColorStop(1, "rgba(120,180,255,0.15)");
  ctx.fillStyle = g;
  const bw = 120 * (1 - pulse * 0.08), bh = 100 * (1 + pulse * 0.06);
  ctx.beginPath(); ctx.moveTo(-bw, 20); ctx.bezierCurveTo(-bw, -bh * 1.3, bw, -bh * 1.3, bw, 20); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 20 + i * 18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
}

// ---------- ✨ A wave of bioluminescence sweeping across the water ----------
function drawGlowWave(ctx, k, t, W, H, m) {
  const front = -200 + k * (W + 400);
  for (let i = 0; i < 160; i++) {
    const sx = ((i * 97.3 + m.seed * 1000) % (W + 200)) - 100;
    const sy = 100 + ((i * 53.7) % (H - 200));
    const d = Math.abs(sx - front);
    if (d > 220) continue;
    const a = 1 - d / 220;
    ctx.fillStyle = i % 3 ? `rgba(120,230,255,${a})` : `rgba(160,255,200,${a})`;
    ctx.shadowColor = "#7ff0ff"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(sx + Math.sin(t * 3 + i) * 4, sy, 2 + a * 2.5, 0, TAU); ctx.fill();
  }
  ctx.shadowBlur = 0;
}
