// Rare sea creatures for the "Ensiklopedia Laut". Touching one in-game discovers it.
// Each draw() renders the creature centred at (0,0), roughly `s` px wide.

export const CREATURES = [
  {
    id: "clownfish", zone: 0, name: "Ikan Badut",
    fact: "Hidup bersimbiosis dengan anemon laut: ia kebal terhadap sengatan anemon dan mendapat tempat berlindung.",
    draw(ctx, s) {
      ctx.fillStyle = "#ff7a1a";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.35, 0); ctx.lineTo(-s * 0.55, -s * 0.18); ctx.lineTo(-s * 0.55, s * 0.18); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-s * 0.12, -s * 0.24, s * 0.08, s * 0.48);
      ctx.fillRect(s * 0.14, -s * 0.2, s * 0.07, s * 0.4);
      eye(ctx, s * 0.26, -s * 0.05, s * 0.05);
    },
  },
  {
    id: "seahorse", zone: 0, name: "Kuda Laut",
    fact: "Pada kuda laut, justru sang jantan yang mengandung telur di kantung perutnya hingga menetas.",
    draw(ctx, s) {
      ctx.strokeStyle = "#ffcf4a";
      ctx.lineCap = "round";
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.quadraticCurveTo(s * 0.18, 0, 0, s * 0.2);
      ctx.quadraticCurveTo(-s * 0.12, s * 0.38, s * 0.08, s * 0.42);
      ctx.stroke();
      ctx.fillStyle = "#ffcf4a";
      ctx.beginPath(); ctx.ellipse(s * 0.05, -s * 0.36, s * 0.14, s * 0.1, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(s * 0.12, -s * 0.38, s * 0.18, s * 0.06);
      eye(ctx, s * 0.06, -s * 0.38, s * 0.035);
    },
  },
  {
    id: "turtle", zone: 1, name: "Penyu",
    fact: "Penyu betina bisa bermigrasi ribuan kilometer lalu kembali bertelur di pantai tempat ia dulu menetas.",
    draw(ctx, s) {
      ctx.fillStyle = "#6fcf6a";
      ctx.beginPath(); ctx.ellipse(s * 0.38, 0, s * 0.12, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 0.28, s * 0.2, s * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.28, s * 0.2, s * 0.07, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3d8a47";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.32, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8fdc84"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      eye(ctx, s * 0.42, -s * 0.03, s * 0.03);
    },
  },
  {
    id: "manta", zone: 1, name: "Pari Manta",
    fact: "Pari manta memiliki otak terbesar di antara ikan dan diduga mampu mengenali dirinya di cermin.",
    draw(ctx, s) {
      ctx.fillStyle = "#3b4f7a";
      ctx.beginPath();
      ctx.moveTo(s * 0.35, 0); ctx.quadraticCurveTo(0, -s * 0.15, -s * 0.15, -s * 0.48);
      ctx.quadraticCurveTo(-s * 0.1, 0, -s * 0.15, s * 0.48); ctx.quadraticCurveTo(0, s * 0.15, s * 0.35, 0);
      ctx.fill();
      ctx.strokeStyle = "#3b4f7a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(-s * 0.55, 0); ctx.stroke();
      eye(ctx, s * 0.22, -s * 0.06, s * 0.03, "#fff");
    },
  },
  {
    id: "octopus", zone: 2, name: "Gurita",
    fact: "Gurita punya tiga jantung, darah berwarna biru, dan bisa mengubah warna kulit dalam sekejap.",
    draw(ctx, s) {
      ctx.fillStyle = "#c2569a";
      ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.26, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c2569a"; ctx.lineWidth = s * 0.07; ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const x = -s * 0.2 + i * s * 0.1;
        ctx.beginPath(); ctx.moveTo(x, s * 0.05);
        ctx.quadraticCurveTo(x + (i % 2 ? 8 : -8), s * 0.25, x, s * 0.42); ctx.stroke();
      }
      eye(ctx, -s * 0.09, -s * 0.1, s * 0.04);
      eye(ctx, s * 0.09, -s * 0.1, s * 0.04);
    },
  },
  {
    id: "lanternfish", zone: 2, name: "Ikan Lentera",
    fact: "Ikan lentera menghasilkan cahaya sendiri dan setiap malam bermigrasi naik ratusan meter untuk mencari makan.",
    draw(ctx, s) {
      ctx.fillStyle = "#5c6b8a";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.38, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.32, 0); ctx.lineTo(-s * 0.52, -s * 0.14); ctx.lineTo(-s * 0.52, s * 0.14); ctx.fill();
      ctx.fillStyle = "#9ff6ff"; ctx.shadowColor = "#9ff6ff"; ctx.shadowBlur = 8;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-s * 0.2 + i * s * 0.1, s * 0.08, s * 0.025, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowBlur = 0;
      eye(ctx, s * 0.24, -s * 0.03, s * 0.05, "#fff");
    },
  },
  {
    id: "angler", zone: 3, name: "Ikan Sungut Ganda",
    fact: "Umpan bercahaya di kepalanya berisi bakteri yang berpendar, dipakai untuk memancing mangsa dalam gelap.",
    draw(ctx, s) {
      ctx.strokeStyle = "#7a6a8f"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.22); ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.42, -s * 0.3); ctx.stroke();
      ctx.fillStyle = "#fff59a"; ctx.shadowColor = "#fff59a"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.28, s * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#3f3550";
      ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.lineTo(-s * 0.45, -s * 0.15); ctx.lineTo(-s * 0.45, s * 0.15); ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); const x = s * 0.08 + i * s * 0.05;
        ctx.moveTo(x, s * 0.06); ctx.lineTo(x + s * 0.02, s * 0.14); ctx.lineTo(x + s * 0.04, s * 0.06); ctx.fill();
      }
      eye(ctx, s * 0.1, -s * 0.08, s * 0.05, "#fff");
    },
  },
  {
    id: "vampsquid", zone: 3, name: "Cumi Vampir",
    fact: "Cumi vampir mampu hidup di lapisan laut yang sangat miskin oksigen, tempat sebagian besar hewan lain tidak bertahan.",
    draw(ctx, s) {
      ctx.fillStyle = "#a3243b";
      ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.18, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, s * 0.05); ctx.quadraticCurveTo(0, s * 0.55, s * 0.3, s * 0.05); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4fd6ff";
      ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.05, s * 0.05, 0, Math.PI * 2); ctx.arc(s * 0.07, -s * 0.05, s * 0.05, 0, Math.PI * 2); ctx.fill();
    },
  },
];

function eye(ctx, x, y, r, color = "#1b1446") {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function getCreature(id) {
  return CREATURES.find((c) => c.id === id);
}
