// Living seabed & ceiling decoration. Every piece is animated and some react to
// the player: tube worms duck into their tubes, clams snap shut, anemones lean
// away and the little clownfish hides. Pieces are chosen per depth zone.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Which floor pieces grow in which zone (repeats = more common).
const FLOOR_BY_ZONE = [
  ["kelp", "kelp", "branch", "branch", "brain", "fan", "anemone", "anemone", "star", "clam", "grass", "grass", "rock"],
  ["kelp", "branch", "brain", "fan", "fan", "anemone", "clam", "grass", "rock", "star", "sponge"],
  ["fan", "sponge", "sponge", "tubeworm", "tubeworm", "rock", "crinoid", "anemone", "grass"],
  ["tubeworm", "tubeworm", "glowshroom", "glowshroom", "crinoid", "sponge", "rock", "vent"],
];
const CEIL_BY_ZONE = [
  ["icicle", "icicle", "drip"],
  ["icicle", "drip", "barnacle"],
  ["stalactite", "barnacle", "glowworm"],
  ["stalactite", "glowworm", "glowworm"],
];
const CORAL_COLORS = ["#ff7aa2", "#ff9f5a", "#c58bff", "#ffd45a", "#5fd3c8", "#ff6f61"];

export function makeFloorDeco(zone, w) {
  const out = [];
  for (let x = 40; x < w - 30; x += rand(120, 240)) {
    out.push({
      dx: x, kind: pick(FLOOR_BY_ZONE[zone]), h: rand(0.8, 1.3),
      color: pick(CORAL_COLORS), phase: rand(0, TAU), open: 1, hide: 0,
    });
  }
  return out;
}

export function makeCeilDeco(zone, w) {
  const out = [];
  for (let x = 40; x < w - 30; x += rand(170, 340)) {
    out.push({ dx: x, kind: pick(CEIL_BY_ZONE[zone]), h: rand(0.7, 1.3), phase: rand(0, TAU), drop: rand(0, 1) });
  }
  return out;
}

// Ease a reaction value towards a target (used for hide / open animations).
function approach(v, target, speed, dt) {
  return v + (target - v) * Math.min(1, speed * dt);
}

// px, py: player position in screen space (for reactions); dark: 0..1 depth darkness
export function drawFloorDeco(ctx, x, y, d, t, dt, px, py, dark) {
  const near = Math.hypot(x - px, y - 30 - py) < 150;
  const sway = Math.sin(t * 1.6 + d.phase);
  ctx.save();
  switch (d.kind) {
    case "kelp": { // tall kelp with leaves, swaying in the current
      const H = 90 * d.h;
      ctx.strokeStyle = "#2f9e5a"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y);
      const pts = [];
      for (let k = 1; k <= 6; k++) {
        const px2 = x + Math.sin(t * 1.4 + d.phase + k * 0.6) * k * 2.4, py2 = y - (H * k) / 6;
        pts.push([px2, py2]); ctx.lineTo(px2, py2);
      }
      ctx.stroke();
      ctx.fillStyle = "#4cc27a";
      pts.forEach(([lx, ly], i) => {
        const side = i % 2 ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(lx + side * 7, ly, 9, 3.5, side * 0.6 + sway * 0.2, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = "#e0c25a"; // float bladder at the top
      ctx.beginPath(); ctx.arc(pts[5][0], pts[5][1] - 3, 4, 0, TAU); ctx.fill();
      break;
    }
    case "grass": { // a clump of seagrass blades
      ctx.strokeStyle = "#3fae6a"; ctx.lineWidth = 3; ctx.lineCap = "round";
      for (let i = -2; i <= 2; i++) {
        const h = (22 + Math.abs(i) * -3 + 10) * d.h;
        ctx.beginPath(); ctx.moveTo(x + i * 4, y);
        ctx.quadraticCurveTo(x + i * 5 + sway * 4, y - h / 2, x + i * 6 + Math.sin(t * 2 + d.phase + i) * 7, y - h);
        ctx.stroke();
      }
      break;
    }
    case "branch": { // branching (staghorn) coral with polyps that pulse
      ctx.strokeStyle = d.color; ctx.lineWidth = 6; ctx.lineCap = "round";
      const H = 46 * d.h;
      const branch = (bx, by, len, ang, depth) => {
        const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
        ctx.lineWidth = 6 - depth * 1.6;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        if (depth < 2) { branch(ex, ey, len * 0.7, ang - 0.5, depth + 1); branch(ex, ey, len * 0.7, ang + 0.45, depth + 1); }
        else {
          ctx.fillStyle = "#fff6e0";
          ctx.beginPath(); ctx.arc(ex, ey, 2 + Math.sin(t * 3 + d.phase + bx) * 0.8, 0, TAU); ctx.fill();
        }
      };
      branch(x, y, H * 0.45, sway * 0.03, 0);
      break;
    }
    case "brain": { // round brain coral with maze grooves
      const r = 18 * d.h;
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.2 * (i / 4), r * (i / 4), 0, Math.PI, 0);
        ctx.setLineDash([5, 3]); ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    }
    case "fan": { // sea fan (gorgonian) — a waving lattice
      const H = 60 * d.h;
      ctx.strokeStyle = d.color; ctx.lineWidth = 2;
      const lean = sway * 6;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + i * 5, y - H * 0.5, x + i * 8 + lean, y - H * (1 - Math.abs(i) * 0.06));
        ctx.stroke();
      }
      ctx.globalAlpha = 0.6;
      for (let j = 1; j <= 4; j++) {
        ctx.beginPath();
        ctx.ellipse(x + lean * (j / 4), y - H * 0.18 * j, 6 + j * 7, 3, 0, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case "anemone": { // tentacles wave; lean away & shrink when the player is close; clownfish hides
      d.hide = approach(d.hide, near ? 1 : 0, 4, dt);
      const H = 30 * d.h * (1 - d.hide * 0.5);
      ctx.fillStyle = "#c95b8e";
      ctx.beginPath(); ctx.ellipse(x, y - 4, 14, 7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#ff9ec7"; ctx.lineWidth = 4; ctx.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.22;
        const wave = Math.sin(t * 3 + i + d.phase) * 0.25 - d.hide * 0.4;
        ctx.beginPath(); ctx.moveTo(x + (i - 4) * 2.5, y - 8);
        ctx.quadraticCurveTo(x + Math.cos(a + wave) * H * 0.6, y - 8 + Math.sin(a + wave) * H * 0.6,
          x + Math.cos(a + wave * 2) * H, y - 8 + Math.sin(a + wave * 2) * H);
        ctx.stroke();
      }
      if (dark < 0.3) { // a clownfish peeking out (hides when the player passes)
        const peek = (1 - d.hide) * (0.5 + 0.5 * Math.sin(t * 0.8 + d.phase));
        const fx = x + 10 + peek * 12, fy = y - 18 - peek * 6;
        ctx.globalAlpha = Math.max(0, peek);
        ctx.fillStyle = "#ff7a1a";
        ctx.beginPath(); ctx.ellipse(fx, fy, 8, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(fx - 2, fy - 5, 2.5, 10);
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(fx + 5, fy - 1, 1.2, 0, TAU); ctx.fill();
      }
      break;
    }
    case "star": { // sea star slowly crawling / waving one arm
      ctx.fillStyle = "#ff8a5c";
      ctx.translate(x + Math.sin(t * 0.3 + d.phase) * 6, y - 4);
      ctx.rotate(d.phase);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 4 : 11 + (i === 0 ? Math.sin(t * 2) * 2 : 0), a = (Math.PI / 5) * i;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.55);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffd0b0";
      for (let i = 0; i < 5; i++) { const a = (TAU / 5) * i; ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 3, 1.2, 0, TAU); ctx.fill(); }
      break;
    }
    case "clam": { // giant clam breathing open/closed; snaps shut when the player is near
      const target = near ? 0 : 0.6 + 0.4 * Math.sin(t * 0.9 + d.phase);
      d.open = approach(d.open, target, near ? 12 : 2, dt);
      ctx.fillStyle = "#7a5fa8";
      ctx.beginPath(); ctx.ellipse(x, y - 4, 16, 6, 0, 0, Math.PI); ctx.fill();
      if (d.open > 0.15) { // shiny pearl glint inside
        ctx.fillStyle = "#fff4fb"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y - 6, 3.5 * d.open, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.save();
      ctx.translate(x - 16, y - 4); ctx.rotate(-d.open * 0.7);
      ctx.fillStyle = "#9b7fd0";
      ctx.beginPath(); ctx.ellipse(16, 0, 16, 9, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16 + i * 6, -8); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case "rock": {
      ctx.fillStyle = "rgba(70,70,95,0.7)";
      ctx.beginPath(); ctx.ellipse(x, y, 18 * d.h, 10 * d.h, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "rgba(230,230,240,0.6)"; // barnacles
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 8 + i * 7, y - 6 - (i % 2) * 3, 2, 0, TAU); ctx.fill(); }
      break;
    }
    case "sponge": { // barrel sponges that exhale little particles
      ctx.fillStyle = dark > 0.3 ? "#8a5a9a" : "#e0a040";
      for (let i = 0; i < 3; i++) {
        const h = (18 + i * 8) * d.h, bx = x - 10 + i * 10;
        ctx.fillRect(bx - 4, y - h, 8, h);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(bx, y - h, 4, 2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = dark > 0.3 ? "#8a5a9a" : "#e0a040";
      }
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const k = (t * 0.6 + d.phase) % 1;
      ctx.beginPath(); ctx.arc(x + 10, y - 34 * d.h - k * 30, 1.5 * (1 - k) + 0.5, 0, TAU); ctx.fill();
      break;
    }
    case "tubeworm": { // red-plumed worms that zip into their tubes when approached
      d.hide = approach(d.hide, near ? 1 : 0, near ? 14 : 1.5, dt);
      for (let i = 0; i < 3; i++) {
        const h = (26 + i * 10) * d.h, bx = x - 8 + i * 8;
        ctx.fillStyle = "#e8e2d0";
        ctx.fillRect(bx - 3, y - h, 6, h);
        const plume = 1 - d.hide;
        if (plume > 0.05) {
          ctx.fillStyle = "#ff3b5c";
          ctx.beginPath();
          ctx.ellipse(bx + Math.sin(t * 2 + i) * 1.5, y - h - 6 * plume, 5 * plume, 8 * plume, 0, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    case "crinoid": { // feather star on a stalk, arms opening and closing
      const H = 50 * d.h;
      ctx.strokeStyle = "#b7a3d9"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 5, y - H / 2, x, y - H); ctx.stroke();
      const open = 0.6 + 0.4 * Math.sin(t * 1.2 + d.phase);
      ctx.strokeStyle = "#e6d7ff"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i - 3.5) * 0.35 * open;
        ctx.beginPath(); ctx.moveTo(x, y - H);
        ctx.quadraticCurveTo(x + Math.cos(a) * 10, y - H + Math.sin(a) * 10, x + Math.cos(a) * 20, y - H + Math.sin(a) * 20 + 6);
        ctx.stroke();
      }
      break;
    }
    case "glowshroom": { // bioluminescent sponge "mushrooms" that pulse
      const g = 0.5 + 0.5 * Math.sin(t * 2 + d.phase);
      ctx.fillStyle = "#3a2a55";
      ctx.fillRect(x - 2, y - 16 * d.h, 4, 16 * d.h);
      ctx.fillStyle = `rgba(127,255,240,${0.5 + g * 0.5})`;
      ctx.shadowColor = "#7ffff0"; ctx.shadowBlur = 10 + g * 14;
      ctx.beginPath(); ctx.ellipse(x, y - 16 * d.h, 10 * d.h, 6 * d.h, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 12, y - 8, 6, 4, 0, Math.PI, 0); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "vent": { // hydrothermal vent puffing dark smoke
      ctx.fillStyle = "#2b2533";
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y - 34 * d.h); ctx.lineTo(x + 5, y - 34 * d.h); ctx.lineTo(x + 14, y); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const k = ((t * 0.5 + i / 5 + d.phase) % 1);
        ctx.fillStyle = `rgba(40,30,50,${0.6 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(k * 6 + i) * 6, y - 34 * d.h - k * 90, 6 + k * 14, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,120,40,0.7)";
      ctx.beginPath(); ctx.arc(x, y - 34 * d.h, 3, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export function drawCeilDeco(ctx, x, y, d, t) {
  ctx.save();
  switch (d.kind) {
    case "icicle": {
      const h = 22 * d.h;
      ctx.fillStyle = "rgba(230,248,255,0.85)";
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + h); ctx.fill();
      break;
    }
    case "drip": { // melting drop falling from the ice
      const k = (t * 0.5 + d.drop) % 1;
      ctx.fillStyle = "rgba(230,248,255,0.8)";
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 10); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + 12 + k * 60, 2.2 * (1 - k * 0.5), 0, TAU); ctx.fill();
      break;
    }
    case "barnacle": {
      ctx.fillStyle = "rgba(220,220,230,0.8)";
      for (let i = 0; i < 4; i++) {
        const bx = x - 12 + i * 8;
        ctx.beginPath(); ctx.moveTo(bx - 4, y); ctx.lineTo(bx, y + 7 + (i % 2) * 2); ctx.lineTo(bx + 4, y); ctx.fill();
        // little feeding legs flicking out
        if (Math.sin(t * 4 + i + d.phase) > 0.6) {
          ctx.strokeStyle = "#ffe0b0"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx, y + 8); ctx.lineTo(bx + 3, y + 13); ctx.stroke();
        }
      }
      break;
    }
    case "stalactite": {
      const h = 34 * d.h;
      ctx.fillStyle = "#3a3550";
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + 2, y + h); ctx.lineTo(x - 2, y + h * 0.8); ctx.fill();
      break;
    }
    case "glowworm": { // dangling glowing threads
      ctx.strokeStyle = "rgba(160,255,240,0.5)"; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const len = (24 + i * 14) * d.h, sx = x - 8 + i * 8 + Math.sin(t + i + d.phase) * 2;
        ctx.beginPath(); ctx.moveTo(x - 8 + i * 8, y); ctx.lineTo(sx, y + len); ctx.stroke();
        const g = 0.5 + 0.5 * Math.sin(t * 3 + i * 2 + d.phase);
        ctx.fillStyle = `rgba(160,255,240,${0.4 + g * 0.6})`; ctx.shadowColor = "#a0fff0"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(sx, y + len, 2.4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
      break;
    }
  }
  ctx.restore();
}

// Caustic light ripples dancing on the sand in shallow water.
export function drawCaustics(ctx, x, y, w, t, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 40) {
    const wx = x + i;
    ctx.beginPath();
    ctx.moveTo(wx, y + 8 + Math.sin(t * 2 + wx * 0.05) * 3);
    ctx.quadraticCurveTo(wx + 10, y + 14 + Math.sin(t * 2.5 + wx) * 4, wx + 22, y + 8 + Math.cos(t * 2 + wx * 0.03) * 3);
    ctx.stroke();
  }
  ctx.restore();
}
