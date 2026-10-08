// Tiny synthesized sound effects (Web Audio API, no asset files → stays far under size limits).
// Platforms require game audio to be silent while an ad plays: call setAdPlaying(true/false).

import { settings } from "./settings.js";

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

let platformMuted = false; // e.g. CrazyGames' muteAudio setting

function applyVolume() {
  if (master) master.gain.value = muted || adPlaying || platformMuted ? 0 : 0.5;
}

export function setPlatformMuted(v) {
  platformMuted = v;
  applyVolume();
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
  if (!ctx || muted || adPlaying || platformMuted || !settings.sfx) return;
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
  if (!ctx || muted || adPlaying || !settings.sfx) return;
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
  // Puffy inflates (bubbly rise) or deflates (falling "blup").
  flip(up) {
    tone({ type: "sine", from: up ? 220 : 700, to: up ? 760 : 180, dur: 0.14, vol: 0.3 });
    tone({ type: "sine", from: up ? 900 : 400, to: up ? 1300 : 250, dur: 0.05, vol: 0.12, delay: 0.05 });
  },
  pearl() {
    tone({ type: "sine", from: 1320, dur: 0.08, vol: 0.18 });
    tone({ type: "sine", from: 1760, dur: 0.16, vol: 0.14, delay: 0.06 });
  },
  shield() { [660, 880, 1100].forEach((f, i) => tone({ type: "sine", from: f, to: f * 1.5, dur: 0.12, vol: 0.18, delay: i * 0.05 })); },
  shieldPop() { noise(0.12, 0.35); tone({ type: "sine", from: 900, to: 200, dur: 0.15, vol: 0.25 }); },
  discover() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.18, vol: 0.18, delay: i * 0.09 })); },
  zone() { [392, 523, 784].forEach((f, i) => tone({ type: "sine", from: f, dur: 0.4, vol: 0.15, delay: i * 0.15 })); },
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
  // Knock-out sounds, one per hazard kind.
  pop() { noise(0.5, 0.3); tone({ type: "sine", from: 900, to: 300, dur: 0.6, vol: 0.15 }); },
  zap() {
    for (let i = 0; i < 6; i++) tone({ type: "square", from: 120 + Math.random() * 600, to: 80, dur: 0.07, vol: 0.18, delay: i * 0.07 });
  },
  reel() { tone({ type: "triangle", from: 200, to: 1200, dur: 0.9, vol: 0.2, delay: 0.3 }); },
  thud() { noise(0.2, 0.6); tone({ type: "sine", from: 120, to: 40, dur: 0.3, vol: 0.4 }); },
  rustle() { noise(0.6, 0.25); tone({ type: "sine", from: 500, to: 900, dur: 0.8, vol: 0.08, delay: 0.3 }); },
  abyss() { tone({ type: "sawtooth", from: 220, to: 40, dur: 1.1, vol: 0.2 }); noise(0.25, 0.5); },
  splash() { noise(0.4, 0.5); tone({ type: "sine", from: 400, to: 1400, dur: 0.3, vol: 0.2 }); },
  // Rare moments
  whale() { // long, gliding whale-song calls
    [[180, 320, 0, 1.4], [320, 150, 1.2, 1.6], [220, 420, 2.6, 1.2]].forEach(([a, b, d, len]) =>
      tone({ type: "sine", from: a, to: b, dur: len, vol: 0.22, delay: d }));
  },
  dolphin() { // playful clicks & whistles
    for (let i = 0; i < 6; i++) tone({ type: "sine", from: 1800 + i * 150, to: 2600, dur: 0.08, vol: 0.12, delay: i * 0.09 });
    tone({ type: "sine", from: 1400, to: 3000, dur: 0.4, vol: 0.12, delay: 0.6 });
  },
  revive() {
    [392, 523, 659, 784].forEach((f, i) => tone({ type: "triangle", from: f, dur: 0.12, vol: 0.2, delay: i * 0.08 }));
  },
};

// ---------- Background music ----------
// A small synthesized underwater loop (bass + soft arpeggio + hi-hat), scheduled ahead of
// time with the Web Audio clock so it stays in rhythm. Tempo follows game speed.

const BASS = [45, 45, 41, 41, 48, 48, 43, 43];           // MIDI notes, one per half bar (Am F C G)
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

let musicGain = null, musicFilter = null, timer = null, step = 0, nextTime = 0, bpm = 112;

export function setTempo(v) { bpm = Math.max(96, Math.min(140, v)); }

// Deeper water sounds more muffled: 0 = surface, 1 = abyss.
export function setMuffle(m) {
  if (musicFilter) musicFilter.frequency.setTargetAtTime(4000 - m * 3300, ctx.currentTime, 0.5);
}

function musicNote(freq, t, dur, type, vol) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hat(t) {
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = "highpass";
  f.frequency.value = 6000;
  g.gain.value = 0.08;
  src.buffer = buf;
  src.connect(f).connect(g).connect(musicGain);
  src.start(t);
}

function scheduleStep(t) {
  const sixteenth = 60 / bpm / 4;
  if (!settings.music) { step++; return sixteenth; } // keep time, create no notes
  const bar = Math.floor(step / 16) % 4;
  const s = step % 16;
  if (s % 4 === 0) musicNote(midi(BASS[bar * 2 + (s >= 8 ? 1 : 0)]), t, sixteenth * 3, "triangle", 0.35);
  if (s % 2 === 0) {
    const chord = CHORDS[bar];
    musicNote(midi(chord[(s / 2) % 3] + 12), t, sixteenth * 2, "triangle", 0.12);
  }
  if (s % 4 === 2) hat(t);
  step++;
  return sixteenth;
}

// Re-apply the music on/off setting (called when the setting changes).
export function applyMusicSetting() {
  if (musicGain) musicGain.gain.value = settings.music ? 0.6 : 0;
}

export function startMusic() {
  if (!ctx || timer) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.6;
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 4000;
    musicGain.connect(musicFilter).connect(master);
  }
  applyMusicSetting();
  step = 0;
  nextTime = ctx.currentTime + 0.05;
  timer = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.12) nextTime += scheduleStep(nextTime);
  }, 25);
}

export function stopMusic() {
  clearInterval(timer);
  timer = null;
}
