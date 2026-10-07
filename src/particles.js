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

// Burst of square debris + sparks when the player crashes.
export function explode(x, y, colors) {
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(150, 650);
    add({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900,
      life: rand(0.5, 1.1), max: 1.1, size: rand(4, 10),
      color: colors[i % colors.length], shape: "square", rot: rand(0, 6), vr: rand(-12, 12),
    });
  }
}

// Ring of sparkles when a coin is collected.
export function sparkle(x, y) {
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12, v = rand(120, 240);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0.45, max: 0.45, size: rand(3, 5), color: "#4fffd2", shape: "dot" });
  }
}

// Small puff where the player pushes off when flipping gravity.
export function puff(x, y, dir) {
  for (let i = 0; i < 8; i++) {
    add({ x: x + rand(-18, 18), y, vx: rand(-80, 80), vy: dir * rand(40, 140), g: 0, life: 0.35, max: 0.35, size: rand(4, 7), color: "#ffd1ec", shape: "dot" });
  }
}

// Continuous trail behind the running player.
export function trail(x, y, color) {
  add({ x: x + rand(-6, 6), y: y + rand(-10, 10), vx: rand(-60, -20), vy: rand(-20, 20), g: 0, life: 0.4, max: 0.4, size: rand(3, 6), color, shape: "dot" });
}

export function update(dt) {
  for (const p of list) {
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vr) p.rot += p.vr * dt;
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
    } else {
      ctx.beginPath();
      ctx.arc(x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
