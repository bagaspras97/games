// Knock-out animations: each hazard gets its own short "what happened" scene
// before the Game Over panel appears.
//
// Every entry: { label, dur, sound, start(d, fx), step(d, dt, fx), draw(ctx, d, k, sprite) }
//   d      – state: { x, y (screen), wx (world x), h (hazard or null), t, rnd }
//   k      – progress 0..1
//   sprite – (tint, alpha) => offscreen canvas of the knocked-out character, centred at 110,110

import { H } from "./world.js";

const TAU = Math.PI * 2;
const easeIn = (k) => k * k;
const easeOut = (k) => 1 - (1 - k) * (1 - k);

function blit(ctx, img, scale = 1) {
  ctx.drawImage(img, -110 * scale, -110 * scale, 220 * scale, 220 * scale);
}

function stars(ctx, t, r = 34, y = -40) {
  ctx.fillStyle = "#ffe14f";
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + (i * TAU) / 3;
    star(ctx, Math.cos(a) * r, y + Math.sin(a) * 8, 7);
  }
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

function bolt(ctx, x0, y0, x1, y1) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i < 5; i++) {
    const k = i / 5;
    ctx.lineTo(x0 + (x1 - x0) * k + (Math.random() - 0.5) * 18, y0 + (y1 - y0) * k + (Math.random() - 0.5) * 18);
  }
  ctx.lineTo(x1, y1); ctx.stroke();
}

export const DEATHS = {
  // Bulu babi / karang / es runcing: punctured, leaks air and zips around like a balloon.
  spike: {
    dur: 1.4, sound: "pop",
    start(d, fx) { fx.explode(d.wx, d.y, ["#ffffff", "#ffb3c7"]); },
    step(d, dt, fx) { if (Math.random() < 0.7) fx.puff(d.wx + d.ox, d.y + d.oy); },
    draw(ctx, d, k, sprite) {
      d.ox = Math.sin(k * 28) * 40 * k - k * 60;
      d.oy = -k * 160 + Math.cos(k * 21) * 20 * k;
      ctx.translate(d.ox, d.oy);
      ctx.rotate(k * 9);
      const red = k < 0.25 && Math.floor(k * 40) % 2 === 0;
      blit(ctx, sprite(red ? "#ff3b3b" : null, 0.6), 1 - k * 0.55);
    },
  },

  // Ubur-ubur: electrocuted — flickers, skeleton flash, bolts, ends charred & smoking.
  zap: {
    dur: 1.4, sound: "zap",
    start() {},
    step(d, dt, fx) { if (d.t > 0.8 && Math.random() < 0.4) fx.trail(d.wx, d.y - 20, "#777"); },
    draw(ctx, d, k, sprite) {
      if (k < 0.65) {
        ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        const flash = Math.floor(k * 30) % 2 === 0;
        blit(ctx, sprite(flash ? "#ffffff" : "#fff36b", flash ? 0.85 : 0.35));
        ctx.strokeStyle = "#fff36b"; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * TAU;
          bolt(ctx, Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 70, Math.sin(a) * 70);
        }
      } else {
        const kk = (k - 0.65) / 0.35;
        ctx.translate(0, easeIn(kk) * 60);
        blit(ctx, sprite("#2a2230", 0.75));
        ctx.fillStyle = "rgba(255,255,255,.8)"; // little puff of hair-like sparks
        ctx.fillRect(-2, -34, 4, 6);
      }
    },
  },

  // Kail: hooked by the mouth and reeled up out of the screen.
  hook: {
    dur: 1.5, sound: "reel",
    start() {},
    step() {},
    draw(ctx, d, k, sprite) {
      const lift = k < 0.25 ? Math.sin(k * 60) * 4 : -easeIn((k - 0.25) / 0.75) * (d.y + 160);
      ctx.strokeStyle = "#d9d9d9"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(18, -d.y - 20); ctx.lineTo(18, lift - 6); ctx.stroke();
      ctx.translate(0, lift);
      ctx.rotate(-0.5 + Math.sin(d.t * 18) * 0.25);
      blit(ctx, sprite(null));
      ctx.strokeStyle = "#8a8f99"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(24, 0, 8, Math.PI * 1.2, Math.PI * 0.4); ctx.stroke();
    },
  },

  // Jaring: the net wraps around, character struggles, then gets hauled away.
  net: {
    dur: 1.6, sound: "thud",
    start() {},
    step() {},
    draw(ctx, d, k, sprite) {
      const wrap = easeOut(Math.min(1, k / 0.25));
      const haul = k > 0.55 ? easeIn((k - 0.55) / 0.45) : 0;
      ctx.translate(0, -haul * (d.y + 160));
      if (haul > 0) {
        ctx.strokeStyle = "rgba(210,200,170,0.9)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -d.y - 200); ctx.stroke();
      }
      ctx.save();
      ctx.rotate(Math.sin(d.t * 25) * 0.25 * (1 - haul));
      blit(ctx, sprite(null), 0.9);
      ctx.restore();
      const r = 80 - wrap * 36;
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      ctx.strokeStyle = "rgba(220,210,180,0.95)"; ctx.lineWidth = 2;
      for (let i = -r; i <= r; i += 10) {
        ctx.beginPath(); ctx.moveTo(i, -r); ctx.lineTo(i + r * 0.3, r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r, i); ctx.lineTo(r, i - r * 0.3); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#e0773a";
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 5, 0, TAU); ctx.fill(); }
    },
  },

  // Ikan pedang: rammed — impact stars, knocked back spinning off the left side.
  sword: {
    dur: 1.2, sound: "thud",
    start(d, fx) { fx.sparkle(d.wx + 20, d.y, "#ffe14f"); fx.sparkle(d.wx + 20, d.y, "#ffffff"); },
    step() {},
    draw(ctx, d, k, sprite) {
      if (k < 0.12) { // impact flash
        ctx.fillStyle = "#ffe14f";
        star(ctx, 28, 0, 30 * (1 - k / 0.12) + 8);
      }
      ctx.translate(-easeOut(k) * 520, -Math.sin(k * Math.PI) * 140);
      ctx.rotate(-k * 14);
      blit(ctx, sprite(k < 0.15 ? "#ffffff" : null, 0.6));
      stars(ctx, d.t, 30, -30);
    },
  },

  // Sampah plastik: bag engulfs the character, which drifts up helplessly.
  bag: {
    dur: 1.8, sound: "rustle",
    start() {},
    step() {},
    draw(ctx, d, k, sprite) {
      const wrap = easeOut(Math.min(1, k / 0.25));
      ctx.translate(Math.sin(d.t * 3) * 20 * k, -easeIn(k) * 220);
      ctx.rotate(Math.sin(d.t * 4) * 0.2);
      blit(ctx, sprite("#c8d3dc", 0.35 * wrap));
      ctx.fillStyle = `rgba(235,240,245,${0.55 * wrap})`;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * wrap})`; ctx.lineWidth = 2;
      const s = 30 + 25 * wrap;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.6);
      ctx.quadraticCurveTo(-s * 1.2, s * 1.1, 0, s * 1.05);
      ctx.quadraticCurveTo(s * 1.2, s * 1.1, s, -s * 0.6);
      ctx.quadraticCurveTo(0, -s * 0.9, -s, -s * 0.6);
      ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.75, s * 0.25, Math.PI, 0); ctx.arc(s * 0.4, -s * 0.75, s * 0.25, Math.PI, 0); ctx.stroke();
    },
  },

  // Palung bawah: spirals down into the dark where big jaws snap shut.
  abyss: {
    dur: 1.6, sound: "abyss",
    start() {},
    step() {},
    draw(ctx, d, k, sprite) {
      ctx.save();
      ctx.translate(Math.sin(k * 12) * 30 * (1 - k), easeIn(k) * 40);
      ctx.rotate(k * 10);
      if (k < 0.75) blit(ctx, sprite("#000010", k * 0.7), 1 - k * 0.8);
      ctx.restore();
      // jaws rising from below
      const open = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.15);
      const jy = H - d.y + 30 - Math.min(1, k * 1.6) * 90;
      ctx.fillStyle = "#05030a";
      ctx.beginPath(); ctx.ellipse(0, jy + 50, 120, 70, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = -4; i <= 4; i++) {
        const x = i * 22;
        ctx.beginPath(); ctx.moveTo(x - 9, jy - 30 * open); ctx.lineTo(x, jy - 30 * open + 22); ctx.lineTo(x + 9, jy - 30 * open); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 9, jy + 20 * open + 10); ctx.lineTo(x, jy + 20 * open - 12); ctx.lineTo(x + 9, jy + 20 * open + 10); ctx.fill();
      }
      ctx.fillStyle = "#ffef5a"; ctx.shadowColor = "#ffef5a"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.ellipse(-45, jy - 50, 9, 6 * open + 1, 0, 0, TAU); ctx.ellipse(45, jy - 50, 9, 6 * open + 1, 0, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    },
  },

  // Palung atas: launched out of the water with a splash.
  surface: {
    dur: 1.3, sound: "splash",
    start(d, fx) { for (let i = 0; i < 3; i++) fx.puff(d.wx, 10); },
    step(d, dt, fx) { if (Math.random() < 0.5) fx.sparkle(d.wx + (Math.random() - 0.5) * 80, 4, "#e6f8ff"); },
    draw(ctx, d, k, sprite) {
      ctx.translate(k * 80, -easeOut(k) * (d.y + 140));
      ctx.rotate(k * 8);
      blit(ctx, sprite(null), 1 + k * 0.2);
    },
  },

  // Dinding: SPLAT flat against the wall, dizzy stars, then slides down.
  wall: {
    dur: 1.5, sound: "thud",
    start() {},
    step() {},
    draw(ctx, d, k, sprite) {
      const squash = k < 0.15 ? 1 - (k / 0.15) * 0.55 : 0.45 + Math.min(1, (k - 0.15) / 0.4) * 0.55;
      const slide = k > 0.5 ? easeIn((k - 0.5) / 0.5) * 260 : 0;
      ctx.translate(-((1 - squash) * 20) - k * 30, slide);
      ctx.save();
      ctx.scale(squash, 2 - squash);
      blit(ctx, sprite(null));
      ctx.restore();
      stars(ctx, d.t, 34, -44);
    },
  },
};

// Hazard / cause → animation key and the line shown on the Game Over panel.
export function deathFor(cause, h, playerY) {
  if (cause === "wall") return { key: "wall", label: "Gedebuk! Menabrak dinding karang." };
  if (cause === "pit") return playerY < H / 2
    ? { key: "surface", label: "Terlempar keluar dari air!" }
    : { key: "abyss", label: "Tersedot ke dalam palung… ada yang menunggu di sana!" };
  switch (h && h.type) {
    case "boss_crab": return { key: "sword", label: "Dijepit capit Kepiting Raksasa!" };
    case "boss_shark": return { key: "sword", label: "Diseruduk Hiu Martil!" };
    case "boss_kraken": return { key: "hook", label: "Ditarik tentakel Gurita Raksasa!" };
    case "boss_angler": return { key: "abyss", label: "Dilahap Anglerfish Raksasa!" };
    case "urchin": return { key: "spike", label: "Tertusuk bulu babi! Psssh…" };
    case "coral": return { key: "spike", label: "Tergores karang tajam!" };
    case "icicle": return { key: "spike", label: "Tertusuk es runcing!" };
    case "jelly": return { key: "zap", label: "Bzzzt! Tersetrum ubur-ubur listrik." };
    case "hook": return { key: "hook", label: "Tersangkut kail pancing!" };
    case "net": return { key: "net", label: "Terjerat jaring nelayan!" };
    case "sword": return { key: "sword", label: "Diseruduk ikan pedang!" };
    case "bag": return { key: "bag", label: "Terbungkus sampah plastik!" };
  }
  return { key: "spike", label: "Aduh!" };
}

