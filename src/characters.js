// Unlockable sea characters. Each one floats / sinks in its own way and gets a
// more elaborate animation the more pearls it costs.
//
// Movement modes:
//   toggle – tap flips buoyancy (float up ↔ sink down); g = acceleration, max = top speed
//   pulse  – tap gives an upward push, otherwise sinks slowly (jellyfish)
//   glide  – tap flips a constant diagonal glide up ↔ down (manta ray)
//
// draw(ctx, a) renders the character centred at (0,0) facing right, where `a` is
// the animation state: { t, up, vy, mood, pulse, flash, near }.
//   pulse: 0..1 just after a jellyfish push, flash: 0..1 just after a flip,
//   near: 0..1 how close the nearest pearl is (anglerfish jaw).

const TAU = Math.PI * 2;

function eye(ctx, x, y, r, mood, look = 0) {
  if (mood === "dead") {
    ctx.strokeStyle = "#1b1446"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
    ctx.stroke();
    return;
  }
  const rr = mood === "surprised" ? r * 1.3 : r;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  if (mood === "happy") {
    ctx.strokeStyle = "#1b1446"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y + rr * 0.3, rr * 0.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else {
    ctx.fillStyle = "#1b1446";
    ctx.beginPath(); ctx.arc(x + rr * 0.3, y + look * rr * 0.4, rr * 0.5, 0, TAU); ctx.fill();
  }
}

// ---------- 1. Puffy (pufferfish) ----------
function drawPuffy(ctx, a) {
  const s = a.up ? 56 : 42;
  const rx = s * 0.5, ry = a.up ? s * 0.5 : s * 0.32;
  const fin = Math.sin(a.t * 12) * 0.25;

  ctx.fillStyle = "#ffb340"; // tail
  ctx.beginPath();
  ctx.moveTo(-rx * 0.85, 0);
  ctx.lineTo(-rx * 1.35, -ry * 0.55 + fin * 10);
  ctx.lineTo(-rx * 1.35, ry * 0.55 + fin * 10);
  ctx.closePath(); ctx.fill();

  if (a.up) {
    ctx.fillStyle = "#e0a92a";
    for (let i = 0; i < 14; i++) {
      const an = (TAU * i) / 14, c = Math.cos(an), si = Math.sin(an);
      ctx.beginPath();
      ctx.moveTo(c * rx * 0.9 - si * 4, si * ry * 0.9 + c * 4);
      ctx.lineTo(c * rx * 1.22, si * ry * 1.22);
      ctx.lineTo(c * rx * 0.9 + si * 4, si * ry * 0.9 - c * 4);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#ffd84a";
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff3c4";
  ctx.beginPath(); ctx.ellipse(rx * 0.05, ry * 0.4, rx * 0.7, ry * 0.5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = "#ffb340";
  ctx.beginPath(); ctx.ellipse(-rx * 0.05, ry * 0.15, rx * 0.18, ry * 0.12, 0.5 + fin, 0, TAU); ctx.fill();
  eye(ctx, rx * 0.45, -ry * 0.2, s * 0.1, a.mood);
  ctx.fillStyle = "#1b1446";
  ctx.beginPath(); ctx.ellipse(rx * 0.9, ry * 0.15, s * 0.03, s * 0.05, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,120,150,.6)";
  ctx.beginPath(); ctx.arc(rx * 0.55, ry * 0.2, s * 0.06, 0, TAU); ctx.fill();
}

// ---------- 2. Kudi (seahorse) ----------
function drawKudi(ctx, a) {
  const curl = a.up ? 0.6 : 1.2;           // tail curls tighter when sinking
  const bob = Math.sin(a.t * 3) * 2;
  ctx.translate(0, bob);

  // curled tail
  ctx.strokeStyle = "#ff9f43"; ctx.lineCap = "round"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-2, 8);
  for (let i = 1; i <= 12; i++) {
    const k = i / 12, an = k * Math.PI * curl * 1.6;
    ctx.lineTo(-2 - Math.sin(an) * 10 * k - k * 4, 8 + Math.cos(an * 0.6) * 22 * k);
  }
  ctx.stroke();
  // body
  ctx.fillStyle = "#ffb85c";
  ctx.beginPath(); ctx.ellipse(0, -2, 11, 17, 0.15, 0, TAU); ctx.fill();
  // belly ridges
  ctx.strokeStyle = "#ffd9a0"; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(4, -2 + i * 5); ctx.lineTo(10, -1 + i * 5); ctx.stroke(); }
  // fluttering dorsal fin
  ctx.fillStyle = "rgba(255,240,200,0.85)";
  const flap = Math.sin(a.t * 30) * 4;
  ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-18 + flap, -2); ctx.lineTo(-9, 6); ctx.fill();
  // head + snout + crown
  ctx.fillStyle = "#ffb85c";
  ctx.beginPath(); ctx.ellipse(4, -22, 10, 8, 0.4, 0, TAU); ctx.fill();
  ctx.fillRect(10, -22, 14, 5);
  ctx.fillStyle = "#ff9f43";
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-2 + i * 5, -28); ctx.lineTo(i * 5, -36); ctx.lineTo(2 + i * 5, -28); ctx.fill(); }
  eye(ctx, 6, -24, 3.5, a.mood);
}

// ---------- 3. Jeli (jellyfish) ----------
function drawJeli(ctx, a) {
  const squeeze = a.pulse;                 // bell contracts right after a push
  const bw = 26 * (1 - squeeze * 0.3), bh = 22 * (1 + squeeze * 0.25);
  ctx.rotate(Math.PI / 2 * 0); // stays upright
  // tentacles trail opposite to motion and wave with a phase lag
  ctx.strokeStyle = "rgba(255,170,230,0.85)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const x0 = -bw * 0.7 + (i * bw * 1.4) / 5;
    ctx.beginPath(); ctx.moveTo(x0, 2);
    for (let k = 1; k <= 6; k++) {
      const drag = (a.vy / 600) * k * 3;
      ctx.lineTo(x0 - k * 2 + Math.sin(a.t * 6 - k * 0.8 + i) * (3 + k), 2 + k * (7 + squeeze * -2) - drag);
    }
    ctx.stroke();
  }
  // frilly oral arms
  ctx.strokeStyle = "rgba(255,120,200,0.9)"; ctx.lineWidth = 5;
  for (let i = -1; i <= 1; i += 2) {
    ctx.beginPath(); ctx.moveTo(i * 5, 2);
    ctx.quadraticCurveTo(i * 10 + Math.sin(a.t * 4) * 4, 18, i * 4, 30 - squeeze * 6); ctx.stroke();
  }
  // glowing bell
  ctx.fillStyle = "rgba(255,140,220,0.85)"; ctx.shadowColor = "#ff8ae0"; ctx.shadowBlur = 18 + squeeze * 20;
  ctx.beginPath();
  ctx.moveTo(-bw, 4);
  ctx.bezierCurveTo(-bw, -bh * 1.3, bw, -bh * 1.3, bw, 4);
  for (let i = 0; i <= 6; i++) ctx.lineTo(bw - (i * bw * 2) / 6, 4 + (i % 2 ? 4 : 0)); // scalloped rim
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.ellipse(-bw * 0.35, -bh * 0.55, bw * 0.25, bh * 0.18, -0.4, 0, TAU); ctx.fill();
  // inner glowing pattern
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -bh * 0.2, bw * 0.35, Math.PI, 0); ctx.stroke();
  eye(ctx, -6, -bh * 0.35, 3.5, a.mood);
  eye(ctx, 6, -bh * 0.35, 3.5, a.mood);
}

// ---------- 4. Okto (octopus) ----------
function drawOkto(ctx, a) {
  const speed = Math.min(1, Math.abs(a.vy) / 900);
  const dir = a.vy === 0 ? (a.up ? -1 : 1) : Math.sign(a.vy);
  // chromatophore flash: red → orange after each jet
  const col = a.flash > 0 ? mixRGB([255, 230, 120], [214, 72, 92], 1 - a.flash) : "rgb(214,72,92)";
  const dark = "rgb(150,40,64)";
  // tentacles: stream behind the jet when fast, curl and wiggle when resting
  ctx.strokeStyle = col; ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const x0 = -16 + i * 4.5;
    ctx.lineWidth = 6 - Math.abs(i - 3.5) * 0.6;
    ctx.beginPath(); ctx.moveTo(x0, 0);
    for (let k = 1; k <= 7; k++) {
      const wiggle = Math.sin(a.t * 7 + i * 0.9 + k * 0.7) * (1 - speed) * 6;
      const stream = -dir * k * 5 * speed;          // behind the movement
      const rest = k * 4 * (1 - speed) * (a.up ? -1 : 1) * -1;
      ctx.lineTo(x0 - k * 2.5 * speed + wiggle, stream + rest + (1 - speed) * 6);
    }
    ctx.stroke();
  }
  // suckers
  ctx.fillStyle = "rgba(255,210,210,0.8)";
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-12 + i * 9, 6 * (1 - speed), 1.8, 0, TAU); ctx.fill(); }
  // mantle (squashes in the direction of the jet)
  const sx = 1 - speed * 0.2, sy = 1 + speed * 0.25;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(-2, -dir * 14 * sy * 0.6 - 8 * (1 - speed), 20 * sx, 18 * sy, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dark;
  [[-10, -16], [2, -22], [8, -12]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y * (dir < 0 ? -0.2 : 1) - (dir < 0 ? 10 : 0), 3, 0, TAU); ctx.fill();
  });
  // eyes look where it is going
  eye(ctx, 2, -6, 5, a.mood, dir);
  eye(ctx, 12, -6, 5, a.mood, dir);
}

// ---------- 5. Mantra (manta ray) ----------
function drawMantra(ctx, a) {
  const flap = Math.sin(a.t * 6);
  ctx.rotate(Math.max(-0.4, Math.min(0.4, a.vy / 800)));
  // whip tail
  ctx.strokeStyle = "#2c3e66"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-24, 0);
  for (let k = 1; k <= 6; k++) ctx.lineTo(-24 - k * 7, Math.sin(a.t * 5 - k * 0.7) * k * 1.2);
  ctx.stroke();
  // far wing (behind body)
  ctx.fillStyle = "#2c3e66";
  ctx.beginPath();
  ctx.moveTo(14, -2); ctx.quadraticCurveTo(0, -10 - flap * 6, -16 + flap * 4, -30 - flap * 12); ctx.quadraticCurveTo(-10, -6, -22, 0);
  ctx.fill();
  // body
  ctx.fillStyle = "#3b5486";
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e9eef8";
  ctx.beginPath(); ctx.ellipse(2, 4, 22, 4, 0, 0, Math.PI); ctx.fill();
  // near wing (in front, flaps opposite)
  ctx.fillStyle = "#4a66a0";
  ctx.beginPath();
  ctx.moveTo(14, 2); ctx.quadraticCurveTo(0, 10 + flap * 6, -16 - flap * 4, 30 + flap * 12); ctx.quadraticCurveTo(-10, 6, -22, 0);
  ctx.fill();
  // wing tip highlights
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 4); ctx.quadraticCurveTo(-2, 12 + flap * 5, -14 - flap * 4, 26 + flap * 11); ctx.stroke();
  // cephalic fins (curl in and out)
  ctx.strokeStyle = "#3b5486"; ctx.lineWidth = 4;
  const c = Math.sin(a.t * 3) * 3;
  ctx.beginPath(); ctx.moveTo(26, -3); ctx.quadraticCurveTo(34, -8 - c, 32, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26, 3); ctx.quadraticCurveTo(34, 8 + c, 32, 1); ctx.stroke();
  eye(ctx, 20, -3, 3, a.mood);
}

// ---------- 6. Lumi (anglerfish) ----------
// The lure is a little spring-damper: it lags behind vertical movement.
function drawLumi(ctx, a) {
  const jaw = Math.max(a.near, a.mood === "surprised" ? 0.8 : 0, a.mood === "happy" ? 0.5 : 0);
  const swim = Math.sin(a.t * 8);
  // tail
  ctx.fillStyle = "#3a3152";
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-36, -12 + swim * 5); ctx.lineTo(-32, 0); ctx.lineTo(-36, 12 + swim * 5); ctx.fill();
  // body
  ctx.fillStyle = "#4b3f6b";
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
  // bioluminescent spots
  for (let i = 0; i < 5; i++) {
    const g = 0.4 + 0.6 * Math.abs(Math.sin(a.t * 2 + i));
    ctx.fillStyle = `rgba(127,255,240,${g})`;
    ctx.beginPath(); ctx.arc(-14 + i * 6, 10 + Math.sin(i) * 3, 1.8, 0, TAU); ctx.fill();
  }
  // pectoral fin
  ctx.fillStyle = "#3a3152";
  ctx.beginPath(); ctx.ellipse(-4, 8, 8, 4, 0.6 + swim * 0.3, 0, TAU); ctx.fill();
  // big mouth that opens towards pearls
  const open = 4 + jaw * 12;
  ctx.fillStyle = "#1a1226";
  ctx.beginPath(); ctx.moveTo(24, 2); ctx.lineTo(8, 4); ctx.lineTo(24, 2 + open); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 4; i++) {
    const x = 12 + i * 3.5;
    ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x + 1.5, 7); ctx.lineTo(x + 3, 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 2 + open); ctx.lineTo(x + 1.5, open - 2); ctx.lineTo(x + 3, 2 + open); ctx.fill();
  }
  // lure on a springy stalk
  const lag = Math.max(-1, Math.min(1, -a.vy / 700));
  const lx = 30 + Math.sin(a.t * 2) * 3, ly = -38 + lag * 16 + Math.sin(a.t * 3) * 2;
  ctx.strokeStyle = "#6a5a8f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(6, -22); ctx.quadraticCurveTo(14, -46 + lag * 10, lx, ly); ctx.stroke();
  const pulse = 0.7 + 0.3 * Math.sin(a.t * 5);
  ctx.fillStyle = "#fff59a"; ctx.shadowColor = "#fff59a"; ctx.shadowBlur = 20 * pulse;
  ctx.beginPath(); ctx.arc(lx, ly, 5 * pulse + 1, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  eye(ctx, 10, -8, 5, a.mood);
}

function mixRGB(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

// box(up) → half width / half height for terrain, r for hazard hits.
export const CHARACTERS = [
  {
    id: "puffy", name: "Puffy", species: "Ikan Buntal", price: 0, color: "#ffe27a",
    desc: "Ketuk: mengembang (naik) ↔ mengempis (turun).",
    mode: "toggle", g: 2000, max: 760,
    box: (up) => (up ? { hw: 28, hh: 28, r: 24 } : { hw: 21, hh: 14, r: 15 }),
    draw: drawPuffy,
  },
  {
    id: "kudi", name: "Kudi", species: "Kuda Laut", price: 40, color: "#ffc98a",
    desc: "Melayang lembut & ramping: naik-turun lebih pelan, mudah dikendalikan.",
    mode: "toggle", g: 1100, max: 430,
    box: () => ({ hw: 14, hh: 26, r: 14 }),
    draw: drawKudi,
  },
  {
    id: "jeli", name: "Jeli", species: "Ubur-ubur", price: 90, color: "#ff9fe0",
    desc: "Ketuk = denyut dorong ke atas. Tanpa ketukan, perlahan tenggelam.",
    mode: "pulse", g: 950, max: 620, impulse: 470,
    box: () => ({ hw: 22, hh: 20, r: 19 }),
    draw: drawJeli,
  },
  {
    id: "okto", name: "Okto", species: "Gurita", price: 150, color: "#2a1a36",
    desc: "Semburan tinta: pindah sisi super cepat & kebal sesaat saat menyembur.",
    mode: "toggle", g: 3400, max: 1150, jet: true,
    box: () => ({ hw: 22, hh: 22, r: 19 }),
    draw: drawOkto,
  },
  {
    id: "mantra", name: "Mantra", species: "Pari Manta", price: 220, color: "#9fc3ff",
    desc: "Meluncur zig-zag dengan kecepatan tetap; bisa berbelok di tengah air.",
    mode: "glide", speed: 300,
    box: () => ({ hw: 30, hh: 14, r: 15 }),
    draw: drawMantra,
  },
  {
    id: "lumi", name: "Lumi", species: "Ikan Sungut Ganda", price: 320, color: "#7ffff0",
    desc: "Lentera menerangi laut gelap & menarik mutiara di sekitarnya.",
    mode: "toggle", g: 2000, max: 760, light: 360, magnet: 150,
    box: () => ({ hw: 26, hh: 24, r: 21 }),
    draw: drawLumi,
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
