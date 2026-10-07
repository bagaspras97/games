// Puffy the pufferfish skins. draw(ctx, s, puffed, mood) renders Puffy centred at
// (0,0) facing right. `s` is the base size; puffed Puffy is round and spiky,
// deflated Puffy is a slim oval. mood: "normal" | "surprised" | "happy" | "dead".

function drawPuffy(ctx, s, puffed, mood, p) {
  const rx = puffed ? s * 0.5 : s * 0.5;
  const ry = puffed ? s * 0.5 : s * 0.32;

  if (p.glow) { ctx.shadowColor = p.glow; ctx.shadowBlur = s * 0.5; }

  // tail
  ctx.fillStyle = p.fin;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.85, 0);
  ctx.lineTo(-rx * 1.35, -ry * 0.55);
  ctx.lineTo(-rx * 1.35, ry * 0.55);
  ctx.closePath();
  ctx.fill();

  // spikes (only when puffed)
  if (puffed) {
    ctx.fillStyle = p.spike;
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      const c = Math.cos(a), si = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(c * rx * 0.9 - si * 4, si * ry * 0.9 + c * 4);
      ctx.lineTo(c * rx * 1.22, si * ry * 1.22);
      ctx.lineTo(c * rx * 0.9 + si * 4, si * ry * 0.9 - c * 4);
      ctx.fill();
    }
  }

  // body + belly
  ctx.fillStyle = p.body;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(rx * 0.05, ry * 0.4, rx * 0.7, ry * 0.5, 0, 0, Math.PI); ctx.fill();

  if (p.stripes) {
    ctx.fillStyle = p.stripes;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.ellipse(i * rx * 0.38, -ry * 0.35, rx * 0.08, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (p.spots) {
    ctx.fillStyle = p.spots;
    [[-0.4, -0.3], [0, -0.55], [-0.15, 0.05], [0.35, -0.4]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(rx * x, ry * y, s * 0.05, 0, Math.PI * 2); ctx.fill();
    });
  }

  // side fin
  ctx.fillStyle = p.fin;
  ctx.beginPath(); ctx.ellipse(-rx * 0.05, ry * 0.15, rx * 0.18, ry * 0.12, 0.5, 0, Math.PI * 2); ctx.fill();

  // face
  const ex = rx * 0.45, ey = -ry * 0.2, er = s * (mood === "surprised" ? 0.13 : 0.1);
  if (mood === "dead") {
    ctx.strokeStyle = "#1b1446"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er);
    ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1446";
    if (mood === "happy") {
      ctx.lineWidth = 3; ctx.strokeStyle = "#1b1446";
      ctx.beginPath(); ctx.arc(ex, ey + er * 0.3, er * 0.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(ex + er * 0.3, ey, er * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // mouth
  ctx.fillStyle = "#1b1446";
  ctx.beginPath();
  if (mood === "surprised" || mood === "dead") ctx.arc(rx * 0.88, ry * 0.15, s * 0.05, 0, Math.PI * 2);
  else ctx.ellipse(rx * 0.9, ry * 0.15, s * 0.03, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.hat) drawHat(ctx, s, ry, p.hat);
  if (p.blush) {
    ctx.fillStyle = "rgba(255,120,150,.6)";
    ctx.beginPath(); ctx.arc(rx * 0.55, ry * 0.2, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHat(ctx, s, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, -ry * 0.85);
  ctx.quadraticCurveTo(0, -ry * 0.85 - s * 0.45, s * 0.35, -ry * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(0, -ry * 0.85 - s * 0.14, s * 0.06, 0, Math.PI * 2); ctx.fill();
}

const skin = (id, name, price, trail, palette) => ({
  id, name, price, color: trail,
  draw(ctx, s, puffed = true, mood = "normal") { drawPuffy(ctx, s, puffed, mood, palette); },
});

export const SKINS = [
  skin("classic", "Puffy", 0, "#ffe27a", { body: "#ffd84a", belly: "#fff3c4", spike: "#e0a92a", fin: "#ffb340", blush: true }),
  skin("ocean", "Biru Laut", 20, "#7fd4ff", { body: "#4fb8ff", belly: "#d9f3ff", spike: "#2a7fc2", fin: "#2a9be0" }),
  skin("coral", "Koral", 40, "#ff9ab5", { body: "#ff7a9c", belly: "#ffe0e8", spike: "#d14d72", fin: "#ff5a84", blush: true }),
  skin("spotty", "Tutul", 60, "#c4f07a", { body: "#9bdc4a", belly: "#efffd6", spike: "#5d9a22", fin: "#76b832", spots: "#3f6d16" }),
  skin("pirate", "Bajak Laut", 90, "#ffd84a", { body: "#ffd84a", belly: "#fff3c4", spike: "#e0a92a", fin: "#ffb340", hat: "#1e1e2e" }),
  skin("glow", "Bercahaya", 130, "#7ffff0", { body: "#2fd6c6", belly: "#c9fff9", spike: "#1a8f86", fin: "#24b3a6", glow: "#7ffff0" }),
  skin("gold", "Emas", 200, "#ffe066", { body: "#ffc800", belly: "#fff1a8", spike: "#c79200", fin: "#ffaf00", stripes: "#e6a800", glow: "#ffd700" }),
];

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}
