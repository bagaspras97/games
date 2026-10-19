// Rare sea creatures for the "Sea Encyclopedia". Touching one in-game discovers it.
// Each draw(ctx, s, t) renders the creature centred at (0,0), roughly `s` px wide,
// facing right. `t` (seconds) drives the idle animation; it defaults to 0.

const TAU = Math.PI * 2;
const INK = "rgba(18,16,48,0.55)"; // soft outline shared by every creature

function vgrad(ctx, y0, y1, top, bottom) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  return g;
}

// Big cute eye: white, dark iris looking forward, white glint.
function eye(ctx, x, y, r, iris = "#1b1446") {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = iris;
  ctx.beginPath(); ctx.arc(x + r * 0.22, y + r * 0.05, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x + r * 0.02, y - r * 0.25, r * 0.24, 0, TAU); ctx.fill();
}

// Tapering stroke along a list of points (tentacles, tails).
function taper(ctx, pts, w0, w1, color) {
  ctx.strokeStyle = color; ctx.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1));
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
}

export const CREATURES = [
  {
    id: "clownfish", zone: 0, name: "Clownfish",
    fact: "Clownfish live in symbiosis with sea anemones: they're immune to the stings and get a safe home.",
    draw(ctx, s, t = 0) {
      const wag = Math.sin(t * 7) * 0.22;
      ctx.lineJoin = "round";
      // tail
      ctx.save(); ctx.translate(-s * 0.34, 0); ctx.rotate(wag);
      ctx.fillStyle = "#ff8a1f"; ctx.strokeStyle = "#1b1446"; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.12, -s * 0.24, -s * 0.24, -s * 0.2);
      ctx.quadraticCurveTo(-s * 0.16, 0, -s * 0.24, s * 0.2); ctx.quadraticCurveTo(-s * 0.12, s * 0.24, 0, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
      // dorsal + belly fins
      ctx.fillStyle = "#ff8a1f"; ctx.strokeStyle = "#1b1446"; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.2); ctx.quadraticCurveTo(-s * 0.05, -s * 0.42, s * 0.14, -s * 0.22); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.2); ctx.quadraticCurveTo(-s * 0.02, s * 0.36, s * 0.08, s * 0.22); ctx.fill(); ctx.stroke();
      // body
      ctx.fillStyle = vgrad(ctx, -s * 0.26, s * 0.26, "#ffb24d", "#ff6400");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.26, 0, 0, TAU); ctx.fill();
      // white bands with black edges, clipped to the body
      ctx.save(); ctx.clip();
      for (const [x, w, bend] of [[s * 0.2, s * 0.09, s * 0.05], [-s * 0.04, s * 0.12, -s * 0.06], [-s * 0.3, s * 0.07, 0]]) {
        for (const [ww, col] of [[w + s * 0.05, "#1b1446"], [w, "#fff"]]) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(x - ww / 2, -s * 0.3); ctx.quadraticCurveTo(x - ww / 2 + bend, 0, x - ww / 2, s * 0.3);
          ctx.lineTo(x + ww / 2, s * 0.3); ctx.quadraticCurveTo(x + ww / 2 + bend, 0, x + ww / 2, -s * 0.3); ctx.fill();
        }
      }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.26, 0, 0, TAU); ctx.stroke();
      // pectoral fin, flapping
      ctx.save(); ctx.translate(s * 0.08, s * 0.08); ctx.rotate(0.5 + Math.sin(t * 9) * 0.35);
      ctx.fillStyle = "rgba(255,190,110,0.85)"; ctx.strokeStyle = "rgba(27,20,70,0.5)"; ctx.lineWidth = s * 0.012;
      ctx.beginPath(); ctx.ellipse(-s * 0.05, 0, s * 0.065, s * 0.035, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      eye(ctx, s * 0.29, -s * 0.06, s * 0.07);
      ctx.strokeStyle = "#7a2a00"; ctx.lineWidth = s * 0.02; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(s * 0.34, s * 0.07, s * 0.035, 0.2, 2.2); ctx.stroke();
    },
  },
  {
    id: "seahorse", zone: 0, name: "Seahorse",
    fact: "Among seahorses, the father carries the eggs in a pouch until they hatch.",
    draw(ctx, s, t = 0) {
      ctx.save();
      ctx.translate(0, Math.sin(t * 2) * s * 0.03);
      ctx.rotate(Math.sin(t * 1.6) * 0.06);
      const body = "#ffc43d", dark = "#c9861a";
      // curled tail
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const k = i / 18;
        if (k < 0.45) pts.push([-s * 0.02 - k * s * 0.08, s * 0.16 + k * s * 0.5]);
        else {
          const a = (k - 0.45) / 0.55 * Math.PI * 1.6 + Math.sin(t * 2) * 0.15;
          const r = s * 0.11 * (1 - (k - 0.45) * 1.1);
          pts.push([-s * 0.06 + s * 0.1 - Math.cos(a) * r - s * 0.0, s * 0.4 + Math.sin(a) * r]);
        }
      }
      taper(ctx, pts, s * 0.16, s * 0.04, dark);
      taper(ctx, pts, s * 0.12, s * 0.025, body);
      // dorsal fin, fluttering fast
      ctx.save(); ctx.translate(-s * 0.15, s * 0.02); ctx.scale(0.75 + Math.sin(t * 18) * 0.25, 1);
      ctx.fillStyle = "rgba(255,235,170,0.85)"; ctx.strokeStyle = dark; ctx.lineWidth = s * 0.015;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.quadraticCurveTo(-s * 0.16, 0, 0, s * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, i * s * 0.035); ctx.lineTo(-s * 0.1, i * s * 0.045); ctx.stroke(); }
      ctx.restore();
      // belly
      ctx.fillStyle = vgrad(ctx, -s * 0.2, s * 0.25, "#ffd86b", "#f2a321");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(0, s * 0.03, s * 0.15, s * 0.22, 0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffeeb8";
      ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.06, s * 0.07, s * 0.16, 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = s * 0.014;
      for (let i = 0; i < 5; i++) { const y = -s * 0.1 + i * s * 0.07; ctx.beginPath(); ctx.moveTo(-s * 0.1, y); ctx.quadraticCurveTo(0, y + s * 0.03, s * 0.12, y); ctx.stroke(); }
      // neck + head
      ctx.fillStyle = body; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(-s * 0.02, -s * 0.2, s * 0.09, s * 0.08, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.03, -s * 0.31, s * 0.13, s * 0.1, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
      // snout
      ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.33); ctx.quadraticCurveTo(s * 0.2, -s * 0.3, s * 0.26, -s * 0.28); ctx.lineTo(s * 0.26, -s * 0.23); ctx.quadraticCurveTo(s * 0.2, -s * 0.24, s * 0.12, -s * 0.24); ctx.closePath(); ctx.fill(); ctx.stroke();
      // crown spikes
      ctx.fillStyle = dark;
      for (let i = 0; i < 3; i++) { const x = -s * 0.06 + i * s * 0.05; ctx.beginPath(); ctx.moveTo(x, -s * 0.38); ctx.lineTo(x + s * 0.02, -s * 0.47); ctx.lineTo(x + s * 0.04, -s * 0.38); ctx.fill(); }
      eye(ctx, s * 0.06, -s * 0.33, s * 0.055);
      ctx.restore();
    },
  },
  {
    id: "turtle", zone: 1, name: "Sea Turtle",
    fact: "Female sea turtles migrate thousands of kilometres, then return to lay eggs on the beach where they hatched.",
    draw(ctx, s, t = 0) {
      const paddle = Math.sin(t * 2.4);
      const skin = "#8fd17a", skinDark = "#4f9a4a";
      ctx.lineJoin = "round";
      // flippers: front ones sweep, back ones trail
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(s * 0.14, side * s * 0.2); ctx.rotate(side * (0.85 + paddle * 0.35));
        ctx.fillStyle = skin; ctx.strokeStyle = skinDark; ctx.lineWidth = s * 0.02;
        ctx.beginPath(); ctx.ellipse(0, side * s * 0.17, s * 0.075, s * 0.19, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.translate(-s * 0.26, side * s * 0.17); ctx.rotate(side * (2.3 - paddle * 0.2));
        ctx.fillStyle = skin; ctx.strokeStyle = skinDark; ctx.lineWidth = s * 0.02;
        ctx.beginPath(); ctx.ellipse(0, side * s * 0.06, s * 0.045, s * 0.08, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // head
      ctx.fillStyle = skin; ctx.strokeStyle = skinDark; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(s * 0.37, Math.sin(t * 1.2) * s * 0.015, s * 0.13, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = skinDark;
      for (const [x, y] of [[0.33, -0.04], [0.38, 0.05], [0.3, 0.03]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.015, 0, TAU); ctx.fill(); }
      eye(ctx, s * 0.42, -s * 0.03, s * 0.045);
      ctx.strokeStyle = "#2d5c2a"; ctx.lineWidth = s * 0.015;
      ctx.beginPath(); ctx.arc(s * 0.44, s * 0.03, s * 0.035, 0.1, 1.6); ctx.stroke();
      // shell
      ctx.fillStyle = vgrad(ctx, -s * 0.26, s * 0.26, "#6dbb63", "#2e6b37");
      ctx.strokeStyle = "#c7e88a"; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.33, s * 0.25, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(210,240,150,0.65)"; ctx.lineWidth = s * 0.016;
      const hex = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); };
      hex(0, 0, s * 0.09);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; hex(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.14, s * 0.055); }
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.12, s * 0.14, s * 0.05, -0.2, 0, TAU); ctx.fill();
    },
  },
  {
    id: "manta", zone: 1, name: "Manta Ray",
    fact: "Manta rays have the largest brain of any fish and are famously curious and intelligent.",
    draw(ctx, s, t = 0) {
      const flap = 0.78 + Math.sin(t * 2.6) * 0.22;
      // tail
      const tail = [];
      for (let i = 0; i <= 10; i++) tail.push([-s * 0.12 - i * s * 0.045, Math.sin(t * 3 - i * 0.6) * s * 0.025 * (i / 10)]);
      taper(ctx, tail, s * 0.03, s * 0.008, "#1f2a4a");
      // wings + body
      const wing = (sign) => {
        ctx.moveTo(s * 0.3, 0);
        ctx.quadraticCurveTo(s * 0.12, sign * s * 0.12, -s * 0.05, sign * s * 0.5 * flap);
        ctx.quadraticCurveTo(-s * 0.06, sign * s * 0.2, -s * 0.16, 0);
      };
      ctx.fillStyle = vgrad(ctx, -s * 0.5, s * 0.5, "#4b66a3", "#1f2c52");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022; ctx.lineJoin = "round";
      ctx.beginPath(); wing(-1); wing(1); ctx.fill(); ctx.stroke();
      // pale shoulder patches + belly sheen
      ctx.fillStyle = "rgba(235,245,255,0.75)";
      for (const sign of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.04, sign * s * 0.15 * flap, s * 0.09, s * 0.05, sign * 0.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.ellipse(s * 0.06, 0, s * 0.2, s * 0.06, 0, 0, TAU); ctx.fill();
      // cephalic fins (the curled "horns")
      ctx.strokeStyle = "#2b3c6b"; ctx.lineWidth = s * 0.04; ctx.lineCap = "round";
      for (const sign of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.28, sign * s * 0.04); ctx.quadraticCurveTo(s * 0.4, sign * s * 0.06, s * 0.36, sign * s * 0.12); ctx.stroke(); }
      eye(ctx, s * 0.24, -s * 0.07, s * 0.04, "#0b1530");
      eye(ctx, s * 0.24, s * 0.07, s * 0.04, "#0b1530");
    },
  },
  {
    id: "octopus", zone: 2, name: "Octopus",
    fact: "Octopuses have three hearts, blue blood, and can change skin colour in an instant.",
    draw(ctx, s, t = 0) {
      const col = "#d0559f", dark = "#8f2f6c";
      // eight wavy tentacles with curled tips
      for (let i = 0; i < 8; i++) {
        const bx = -s * 0.2 + i * s * 0.057;
        const dir = i < 4 ? -1 : 1;
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const f = k / 12;
          const wave = Math.sin(t * 3 + i * 0.8 + f * 4) * s * 0.05 * f;
          const curl = f > 0.75 ? dir * (f - 0.75) * s * 0.4 : 0;
          pts.push([bx + dir * f * s * 0.12 + wave + curl, s * 0.02 + f * s * 0.38 - (f > 0.75 ? (f - 0.75) * s * 0.25 : 0)]);
        }
        taper(ctx, pts, s * 0.075, s * 0.02, i % 2 ? col : "#c24c93");
        ctx.fillStyle = "#ffd6ec";
        for (let k = 3; k < 10; k += 2) { ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1] + s * 0.012, s * 0.011, 0, TAU); ctx.fill(); }
      }
      // mantle
      ctx.fillStyle = vgrad(ctx, -s * 0.4, s * 0.08, "#ef7fc0", "#a83a7f");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.15 + Math.sin(t * 1.5) * s * 0.01, s * 0.25, s * 0.25, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,210,235,0.55)";
      for (const [x, y, r] of [[-0.12, -0.28, 0.03], [0.1, -0.3, 0.024], [0.02, -0.34, 0.018], [-0.17, -0.16, 0.02]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.ellipse(-s * 0.08, -s * 0.3, s * 0.08, s * 0.04, -0.5, 0, TAU); ctx.fill();
      eye(ctx, -s * 0.09, -s * 0.12, s * 0.065);
      eye(ctx, s * 0.09, -s * 0.12, s * 0.065);
      ctx.fillStyle = "rgba(255,120,170,0.6)";
      ctx.beginPath(); ctx.ellipse(-s * 0.17, -s * 0.04, s * 0.04, s * 0.022, 0, 0, TAU); ctx.ellipse(s * 0.17, -s * 0.04, s * 0.04, s * 0.022, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = s * 0.018; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, -s * 0.03, s * 0.035, 0.3, Math.PI - 0.3); ctx.stroke();
    },
  },
  {
    id: "lanternfish", zone: 2, name: "Lanternfish",
    fact: "Lanternfish make their own light, and many swim hundreds of metres up every night to feed.",
    draw(ctx, s, t = 0) {
      const wag = Math.sin(t * 8) * 0.25;
      // forked tail
      ctx.save(); ctx.translate(-s * 0.32, 0); ctx.rotate(wag);
      ctx.fillStyle = "#56668c"; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.2, -s * 0.15); ctx.lineTo(-s * 0.13, 0); ctx.lineTo(-s * 0.2, s * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // fins
      ctx.fillStyle = "#6c7fa8"; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.018;
      ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.14); ctx.lineTo(s * 0.04, -s * 0.26); ctx.lineTo(s * 0.1, -s * 0.13); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.12); ctx.lineTo(-s * 0.12, s * 0.22); ctx.lineTo(-s * 0.04, s * 0.13); ctx.fill(); ctx.stroke();
      // silvery body
      const g = ctx.createLinearGradient(0, -s * 0.17, 0, s * 0.17);
      g.addColorStop(0, "#3d4a6e"); g.addColorStop(0.45, "#9fb6dc"); g.addColorStop(1, "#dfe9fa");
      ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.37, s * 0.17, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // glowing photophores, rippling along the belly
      for (let i = 0; i < 7; i++) {
        const glow = 0.55 + 0.45 * Math.sin(t * 4 - i * 0.7);
        const x = -s * 0.26 + i * s * 0.075, y = s * 0.1 - Math.abs(i - 3) * s * 0.006;
        ctx.fillStyle = `rgba(140,245,255,${0.25 * glow})`;
        ctx.beginPath(); ctx.arc(x, y, s * 0.04, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(200,255,255,${0.6 + 0.4 * glow})`;
        ctx.beginPath(); ctx.arc(x, y, s * 0.018, 0, TAU); ctx.fill();
      }
      // big night-vision eye
      eye(ctx, s * 0.24, -s * 0.03, s * 0.085, "#1b3a7a");
      ctx.fillStyle = "rgba(140,245,255,0.9)";
      ctx.beginPath(); ctx.arc(s * 0.33, s * 0.05, s * 0.02, 0, TAU); ctx.fill();
    },
  },
  {
    id: "angler", zone: 3, name: "Anglerfish",
    fact: "The glowing lure on its head is full of luminous bacteria that attract prey in the dark.",
    draw(ctx, s, t = 0) {
      const bob = Math.sin(t * 2.2) * s * 0.04;
      const glow = 0.6 + 0.4 * Math.sin(t * 3.3);
      // stalk + lure
      ctx.strokeStyle = "#7a6a8f"; ctx.lineWidth = s * 0.025; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(s * 0.04, -s * 0.24); ctx.quadraticCurveTo(s * 0.2, -s * 0.56, s * 0.42, -s * 0.34 + bob); ctx.stroke();
      const halo = ctx.createRadialGradient(s * 0.42, -s * 0.32 + bob, 0, s * 0.42, -s * 0.32 + bob, s * 0.2);
      halo.addColorStop(0, `rgba(255,248,170,${0.7 * glow})`); halo.addColorStop(1, "rgba(255,248,170,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.32 + bob, s * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fffbd0";
      ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.32 + bob, s * 0.055, 0, TAU); ctx.fill();
      // fins + tail
      ctx.fillStyle = "#4a3e60"; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.lineTo(-s * 0.46, -s * 0.17 + Math.sin(t * 5) * s * 0.03); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s * 0.46, s * 0.17 + Math.sin(t * 5) * s * 0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.24); ctx.lineTo(-s * 0.2, -s * 0.36); ctx.lineTo(-s * 0.02, -s * 0.27); ctx.fill(); ctx.stroke();
      // body
      const g = ctx.createRadialGradient(-s * 0.06, -s * 0.08, s * 0.04, 0, 0, s * 0.32);
      g.addColorStop(0, "#6a5a86"); g.addColorStop(1, "#2a2238");
      ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill(); ctx.stroke();
      // glowing spots
      ctx.fillStyle = `rgba(170,140,255,${0.35 + 0.3 * glow})`;
      for (const [x, y] of [[-0.14, 0.1], [-0.18, -0.06], [-0.06, 0.18], [0.02, -0.18]]) { ctx.beginPath(); ctx.arc(s * x, s * y, s * 0.018, 0, TAU); ctx.fill(); }
      // gaping jaw with needle teeth
      ctx.fillStyle = "#14101e";
      ctx.beginPath(); ctx.moveTo(s * 0.06, s * 0.02); ctx.quadraticCurveTo(s * 0.2, s * 0.24, s * 0.34, s * 0.06); ctx.lineTo(s * 0.3, -s * 0.02); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4f0ff";
      for (let i = 0; i < 5; i++) {
        const x = s * 0.1 + i * s * 0.05;
        ctx.beginPath(); ctx.moveTo(x, s * 0.0); ctx.lineTo(x + s * 0.012, s * 0.08); ctx.lineTo(x + s * 0.024, s * 0.01); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + s * 0.01, s * 0.16 - i * s * 0.015); ctx.lineTo(x + s * 0.025, s * 0.08 - i * s * 0.01); ctx.lineTo(x + s * 0.04, s * 0.15 - i * s * 0.015); ctx.fill();
      }
      eye(ctx, s * 0.1, -s * 0.1, s * 0.055, "#3b2a6a");
    },
  },
  {
    id: "vampsquid", zone: 3, name: "Vampire Squid",
    fact: "Vampire squid live in oxygen-poor ocean layers where most other animals can't survive.",
    draw(ctx, s, t = 0) {
      const open = 1 + Math.sin(t * 1.8) * 0.12;
      const glow = 0.6 + 0.4 * Math.sin(t * 2.5);
      // webbed cloak with eight arm tips
      ctx.fillStyle = vgrad(ctx, -s * 0.05, s * 0.45, "#a3243b", "#4e0d1f");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.02);
      for (let i = 0; i <= 7; i++) {
        const a = Math.PI * (0.92 - i / 7 * 0.84);
        const tipX = Math.cos(a) * s * 0.42 * open, tipY = s * 0.05 + Math.sin(a) * s * 0.38;
        const midA = a + Math.PI * 0.06;
        if (i > 0) ctx.quadraticCurveTo(Math.cos(midA) * s * 0.22 * open, s * 0.05 + Math.sin(midA) * s * 0.2, tipX, tipY);
        else ctx.lineTo(tipX, tipY);
      }
      ctx.lineTo(s * 0.16, -s * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
      // cirri: soft spikes along the arms
      ctx.strokeStyle = "rgba(20,0,10,0.6)"; ctx.lineWidth = s * 0.012; ctx.lineCap = "round";
      for (let i = 0; i <= 7; i++) {
        const a = Math.PI * (0.92 - i / 7 * 0.84);
        for (let k = 1; k <= 2; k++) { const r = s * (0.14 + k * 0.09); const x = Math.cos(a) * r * open, y = s * 0.05 + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s * 0.03, y + Math.sin(a) * s * 0.03); ctx.stroke(); }
      }
      // mantle with flapping ear-fins
      for (const sign of [-1, 1]) {
        ctx.save(); ctx.translate(sign * s * 0.14, -s * 0.3); ctx.rotate(sign * (0.4 + Math.sin(t * 4) * 0.25));
        ctx.fillStyle = "#c2344f"; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.018;
        ctx.beginPath(); ctx.ellipse(sign * s * 0.06, 0, s * 0.08, s * 0.045, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = vgrad(ctx, -s * 0.45, 0, "#d64563", "#8f1c35");
      ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.18, s * 0.17, s * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.3, s * 0.05, s * 0.09, -0.3, 0, TAU); ctx.fill();
      // big glowing blue eyes
      for (const sign of [-1, 1]) {
        const x = sign * s * 0.075, y = -s * 0.06;
        const h = ctx.createRadialGradient(x, y, 0, x, y, s * 0.11);
        h.addColorStop(0, `rgba(90,220,255,${0.55 * glow})`); h.addColorStop(1, "rgba(90,220,255,0)");
        ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, s * 0.11, 0, TAU); ctx.fill();
        eye(ctx, x, y, s * 0.055, "#0a6fa8");
      }
    },
  },
];

export function getCreature(id) {
  return CREATURES.find((c) => c.id === id);
}
