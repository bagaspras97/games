// Tiny synthesized sound effects (Web Audio API, no asset files → stays far under size limits).
// Platforms require game audio to be silent while an ad plays: call setAdPlaying(true/false).

let ctx = null, master = null;
let muted = false, adPlaying = false;

try { muted = localStorage.getItem("hop_muted") === "1"; } catch (e) {}

// Browsers only allow audio after a user gesture; call this from input handlers.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
  }
  if (ctx.state === "suspended") ctx.resume();
}

function applyVolume() {
  if (master) master.gain.value = muted || adPlaying ? 0 : 0.5;
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem("hop_muted", muted ? "1" : "0"); } catch (e) {}
  applyVolume();
  return muted;
}

export function setAdPlaying(v) {
  adPlaying = v;
  applyVolume();
}

// One oscillator note with a pitch sweep and a quick decay envelope.
function tone({ type = "square", from, to = from, dur = 0.12, vol = 0.3, delay = 0 }) {
  if (!ctx || muted || adPlaying) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur = 0.3, vol = 0.4) {
  if (!ctx || muted || adPlaying) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  flip(up) { tone({ type: "triangle", from: up ? 320 : 520, to: up ? 640 : 260, dur: 0.1, vol: 0.25 }); },
  coin() {
    tone({ type: "square", from: 988, dur: 0.06, vol: 0.12 });
    tone({ type: "square", from: 1319, dur: 0.12, vol: 0.12, delay: 0.06 });
  },
  land() { tone({ type: "sine", from: 140, to: 70, dur: 0.06, vol: 0.18 }); },
  death() {
    noise(0.35, 0.5);
    tone({ type: "sawtooth", from: 300, to: 50, dur: 0.45, vol: 0.25 });
  },
  buy() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: "square", from: f, dur: 0.09, vol: 0.12, delay: i * 0.07 }));
  },
  denied() { tone({ type: "square", from: 160, to: 120, dur: 0.15, vol: 0.15 }); },
  click() { tone({ type: "triangle", from: 660, dur: 0.04, vol: 0.12 }); },
  revive() {
    [392, 523, 659, 784].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.12, vol: 0.2, delay: i * 0.08 }));
  },
};
