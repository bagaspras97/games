// Daily missions: every day 3 new ones (2 funny, 1 regular), rewarded with pearls.
// Progress is stored in save.missions = { day, list: [{ id, progress, done, claimed }], chars: [] }.
//
// Events are reported with track(save, event, amount) — or with mode "max" for
// per-run bests such as depth. Funny missions mostly count knock-outs by type.

export const POOL = [
  // ---- funny (knock-outs & silly stuff) ----
  { id: "ko_zap", funny: true, event: "ko_zap", target: 3, reward: 30, text: "Kesetrum ubur-ubur 3 kali ⚡ (rambut jadi kribo?)" },
  { id: "ko_hook", funny: true, event: "ko_hook", target: 1, reward: 20, text: "Tertangkap kail pancing 1 kali 🎣 (salam untuk pak nelayan)" },
  { id: "ko_bag", funny: true, event: "ko_bag", target: 2, reward: 25, text: "Terbungkus kantong plastik 2 kali 🛍️" },
  { id: "ko_net", funny: true, event: "ko_net", target: 2, reward: 25, text: "Terjerat jaring 2 kali 🕸️ (kok betah?)" },
  { id: "ko_sword", funny: true, event: "ko_sword", target: 2, reward: 25, text: "Diseruduk ikan pedang 2 kali 🗡️" },
  { id: "ko_abyss", funny: true, event: "ko_abyss", target: 1, reward: 25, text: "Jadi camilan penghuni palung 1 kali 👀" },
  { id: "ko_surface", funny: true, event: "ko_surface", target: 1, reward: 20, text: "Terlempar keluar dari air 1 kali ☀️ (mau jemur badan?)" },
  { id: "ko_wall", funny: true, event: "ko_wall", target: 3, reward: 25, text: "Gedebuk ke dinding 3 kali 🧱" },
  { id: "ko_spike", funny: true, event: "ko_spike", target: 3, reward: 25, text: "Kempis tertusuk duri 3 kali 🦔 (psssh…)" },
  { id: "ko_early", funny: true, event: "ko_early", target: 1, reward: 15, text: "Kalah sebelum 50 m 😅 (sengaja juga boleh)" },
  { id: "flip_spam", funny: true, event: "flips", target: 100, mode: "max", reward: 30, text: "Mengembang-mengempis 100 kali dalam satu selaman 🎈" },
  // ---- regular ----
  { id: "pearls", event: "pearls", target: 50, reward: 30, text: "Kumpulkan 50 mutiara 🦪" },
  { id: "depth", event: "depth", target: 500, mode: "max", reward: 40, text: "Capai kedalaman 500 m 🌊" },
  { id: "ability", event: "ability", target: 5, reward: 30, text: "Pakai kemampuan khusus karakter 5 kali ⚡" },
  { id: "creature", event: "creature", target: 3, reward: 30, text: "Sapa 3 makhluk langka 📖" },
  { id: "shield", event: "shield_pop", target: 2, reward: 25, text: "Pecahkan 2 gelembung perisai 🫧" },
  { id: "moment", event: "moment", target: 2, reward: 30, text: "Saksikan 2 momen langka ✨ (paus, lumba-lumba…)" },
  { id: "chars", event: "chars", target: 2, mode: "max", reward: 20, text: "Menyelam dengan 2 karakter berbeda 🐠" },
];

const byId = (id) => POOL.find((m) => m.id === id);

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Deterministic per-day pick so the set does not change on reload.
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

function pickFor(day) {
  const rnd = seeded(day);
  const shuffle = (arr) => arr.map((m) => [rnd(), m]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const funny = shuffle(POOL.filter((m) => m.funny)).slice(0, 2);
  const regular = shuffle(POOL.filter((m) => !m.funny)).slice(0, 1);
  return [...funny, ...regular].map((m) => ({ id: m.id, progress: 0, done: false, claimed: false }));
}

// Make sure save.missions holds today's set (refreshes at local midnight).
export function ensureDaily(save) {
  const day = today();
  const ok = save.missions && save.missions.day === day && Array.isArray(save.missions.list) &&
    save.missions.list.every((m) => byId(m.id));
  if (!ok) save.missions = { day, list: pickFor(day), chars: [] };
  return save.missions;
}

// Report an event. Returns missions that were completed by this call.
export function track(save, event, amount = 1) {
  const ms = ensureDaily(save);
  const finished = [];
  for (const m of ms.list) {
    const def = byId(m.id);
    if (def.event !== event || m.done) continue;
    m.progress = def.mode === "max" ? Math.max(m.progress, amount) : m.progress + amount;
    if (m.progress >= def.target) {
      m.progress = def.target;
      m.done = true;
      finished.push(def);
    }
  }
  return finished;
}

// Track which characters were used today (for the "2 different characters" mission).
export function trackCharacter(save, id) {
  const ms = ensureDaily(save);
  if (!ms.chars.includes(id)) ms.chars.push(id);
  return track(save, "chars", ms.chars.length);
}

export function claimable(save) {
  const ms = ensureDaily(save);
  const bonus = streakInfo(save).doneToday && !ms.bonusClaimed ? 1 : 0;
  return ms.list.filter((m) => m.done && !m.claimed).length + bonus;
}

export function describe(m) {
  const def = byId(m.id);
  return { ...def, ...m };
}

// ---------- Daily streak ----------
// Finishing all of today's missions extends the streak (if yesterday was also
// finished) or starts a new one. Each streak day gives a bonus that grows over a
// 7-day cycle; missing a day resets it.

export const STREAK_REWARDS = [20, 30, 40, 50, 60, 80, 150];
export const streakReward = (day) => STREAK_REWARDS[(day - 1) % STREAK_REWARDS.length];

function dayOffset(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Current streak state as the UI should show it.
export function streakInfo(save) {
  const day = today();
  const s = save.streak || { count: 0, lastDay: null };
  const doneToday = s.lastDay === day;
  const alive = doneToday || s.lastDay === dayOffset(day, -1);
  const count = alive ? s.count : 0;
  const ms = ensureDaily(save);
  return {
    count,
    doneToday,
    claimed: !!ms.bonusClaimed,
    // the streak day today's bonus belongs to (or would belong to)
    day: doneToday ? count : count + 1,
  };
}

// Call when a mission completes; returns the streak day if today's set just got finished.
export function checkStreak(save) {
  const ms = ensureDaily(save);
  const day = today();
  if (!ms.list.every((m) => m.done)) return 0;
  const s = save.streak || { count: 0, lastDay: null };
  if (s.lastDay === day) return 0;
  s.count = s.lastDay === dayOffset(day, -1) ? s.count + 1 : 1;
  s.lastDay = day;
  save.streak = s;
  return s.count;
}
