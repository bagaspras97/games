// Character skins. Each draw() renders the player centred at (0,0) with side length s.
// Prices are in coins; "classic" is always owned.

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function eyes(ctx, s, color = "#1b1446") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-s * 0.18, -s * 0.08, s * 0.08, 0, Math.PI * 2);
  ctx.arc(s * 0.18, -s * 0.08, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

export const SKINS = [
  {
    id: "classic", color: "#ffffff", name: "Klasik", price: 0, spin: true,
    draw(ctx, s) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-s / 2, -s / 2, s, s);
    },
  },
  {
    id: "neon", color: "#4fffd2", name: "Neon", price: 20, spin: true,
    draw(ctx, s) {
      ctx.shadowColor = "#4fffd2";
      ctx.shadowBlur = s * 0.6;
      ctx.strokeStyle = "#4fffd2";
      ctx.lineWidth = s * 0.14;
      ctx.strokeRect(-s / 2 + 4, -s / 2 + 4, s - 8, s - 8);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: "slime", color: "#7dff5a", name: "Slime", price: 40, spin: false,
    draw(ctx, s) {
      ctx.fillStyle = "#7dff5a";
      roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.35);
      ctx.fill();
      eyes(ctx, s);
      ctx.fillStyle = "#1b1446";
      ctx.fillRect(-s * 0.12, s * 0.12, s * 0.24, s * 0.06);
    },
  },
  {
    id: "cat", color: "#ffb347", name: "Kucing", price: 60, spin: false,
    draw(ctx, s) {
      ctx.fillStyle = "#ffb347";
      ctx.beginPath(); // ears
      ctx.moveTo(-s / 2, -s * 0.2); ctx.lineTo(-s * 0.4, -s * 0.7); ctx.lineTo(-s * 0.1, -s * 0.45);
      ctx.moveTo(s / 2, -s * 0.2); ctx.lineTo(s * 0.4, -s * 0.7); ctx.lineTo(s * 0.1, -s * 0.45);
      ctx.fill();
      roundRect(ctx, -s / 2, -s * 0.45, s, s * 0.95, s * 0.25);
      ctx.fill();
      eyes(ctx, s);
      ctx.strokeStyle = "#1b1446";
      ctx.lineWidth = 2;
      ctx.beginPath(); // whiskers
      ctx.moveTo(-s * 0.45, s * 0.12); ctx.lineTo(-s * 0.2, s * 0.1);
      ctx.moveTo(s * 0.45, s * 0.12); ctx.lineTo(s * 0.2, s * 0.1);
      ctx.stroke();
    },
  },
  {
    id: "robot", color: "#9aa7c7", name: "Robot", price: 80, spin: false,
    draw(ctx, s) {
      ctx.fillStyle = "#9aa7c7";
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = "#56607a";
      ctx.fillRect(-s * 0.04, -s * 0.75, s * 0.08, s * 0.25); // antenna
      ctx.fillStyle = "#ff4fa3";
      ctx.beginPath(); ctx.arc(0, -s * 0.78, s * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1b1446";
      ctx.fillRect(-s * 0.35, -s * 0.2, s * 0.7, s * 0.22); // visor
      ctx.fillStyle = "#4fffd2";
      ctx.fillRect(-s * 0.28, -s * 0.14, s * 0.14, s * 0.1);
      ctx.fillRect(s * 0.14, -s * 0.14, s * 0.14, s * 0.1);
    },
  },
  {
    id: "fire", color: "#ff9a3c", name: "Api", price: 120, spin: true,
    draw(ctx, s) {
      const g = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.6);
      g.addColorStop(0, "#fff6a8");
      g.addColorStop(0.5, "#ff9a3c");
      g.addColorStop(1, "#ff3c3c");
      ctx.fillStyle = g;
      ctx.shadowColor = "#ff6a00";
      ctx.shadowBlur = s * 0.5;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: "star", color: "#ffd700", name: "Bintang Emas", price: 200, spin: true,
    draw(ctx, s) {
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = s * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.25 : s * 0.6;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  },
];

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}
