// Lightweight particle system. Particles live in world coordinates so they
// scroll with the terrain; draw() takes the camera scroll.

const MAX = 400;
let list = [];

export function clear() { list = []; }

function add(p) {
  if (list.length >= MAX) list.shift();
  list.push(p);
}

const rand = (a, b) => a + Math.random() * (b - a);

// Burst of bubbles + coloured bits when Puffy gets hurt.
export function explode(x, y, colors) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(80, 320);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -200, life: rand(0.6, 1.2), max: 1.2, size: rand(6, 16), color: "#d8f6ff", shape: "bubble" });
  }
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(150, 650);
    add({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900,
      life: rand(0.5, 1.1), max: 1.1, size: rand(4, 10),
      color: colors[i % colors.length], shape: "square", rot: rand(0, 6), vr: rand(-12, 12),
    });
  }
}

// Ring of sparkles when a pearl / item is collected.
export function sparkle(x, y, color = "#fff4fb") {
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12, v = rand(120, 240);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0.45, max: 0.45, size: rand(3, 5), shape: "dot", color });
  }
}

// Burst of bubbles when Puffy inflates / deflates.
export function puff(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(60, 180);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -120, life: 0.5, max: 0.5, size: rand(4, 10), color: "#d8f6ff", shape: "bubble" });
  }
}

// Dark ink cloud when the octopus jets away.
export function ink(x, y) {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(30, 160);
    add({ x: x + rand(-10, 10), y: y + rand(-10, 10), vx: Math.cos(a) * v - 120, vy: Math.sin(a) * v, g: 0, life: rand(0.6, 1.1), max: 1.1, size: rand(10, 26), color: "#1a1028", shape: "dot" });
  }
}

// Bubble trail behind Puffy (tinted by skin), drifting upward.
export function trail(x, y, color) {
  if (Math.random() < 0.5) return;
  add({ x: x + rand(-4, 4), y: y + rand(-8, 8), vx: rand(-50, -20), vy: rand(-60, -20), g: 0, life: 0.6, max: 0.6, size: rand(3, 7), color, shape: "bubble" });
}

// Ring wave when the shield bubble pops.
export function ring(x, y) {
  add({ x, y, vx: 0, vy: 0, g: 0, life: 0.4, max: 0.4, size: 40, grow: 260, color: "#a8f4ff", shape: "ring" });
}

export function update(dt) {
  for (const p of list) {
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot += p.vr * dt;
    if (p.grow) p.size += p.grow * dt;
    p.life -= dt;
  }
  list = list.filter((p) => p.life > 0);
}

export function draw(ctx, scroll) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    const x = p.x - scroll;
    if (p.shape === "square") {
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    } else if (p.shape === "bubble" || p.shape === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.shape === "ring" ? 4 : 1.5;
      ctx.beginPath();
      ctx.arc(x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
