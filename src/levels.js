// Adventure mode: 20 hand-tuned levels, 5 per depth zone. Each level has a fixed
// seed so its layout is the same on every attempt, a length to the finish line
// and a difficulty (hazard & trench density). The 5th level of a zone is a
// longer, harder "Ujian" (exam) that closes the zone.
//
// Stars: ⭐ reach the finish, ⭐⭐ also collect ≥ 70% of the pearls,
//        ⭐⭐⭐ also finish without getting hit (no shield pop, no revive).

import { ZONES, PX_PER_M } from "./world.js";

const NAMES = [
  ["Kolam Terumbu", "Taman Anemon", "Lorong Karang", "Celah Es", "Ujian Dangkal"],
  ["Padang Lamun", "Arus Biru", "Jalur Penyu", "Kail Nelayan", "Ujian Laut Terbuka"],
  ["Lembah Senja", "Jaring Hantu", "Lintasan Ikan Pedang", "Gua Plastik", "Ujian Senja"],
  ["Gerbang Gelap", "Hutan Bercahaya", "Palung Sunyi", "Sarang Ubur-ubur", "Ujian Palung Terdalam"],
];

export const LEVELS = [];
for (let z = 0; z < 4; z++) {
  for (let i = 0; i < 5; i++) {
    const n = z * 5 + i + 1;
    const exam = i === 4;
    LEVELS.push({
      n, zone: z, exam,
      name: NAMES[z][i],
      seed: n * 7919 + 13,
      meters: 160 + i * 30 + z * 40 + (exam ? 60 : 0),
      difficulty: Math.min(1, z * 0.22 + i * 0.05 + (exam ? 0.08 : 0)),
    });
  }
}

// Dev helper: ?finish=20 shortens every level to 20 m to test the finish screen.
const SHORT = Number(new URLSearchParams(location.search).get("finish")) || 0;
if (SHORT) for (const L of LEVELS) L.meters = SHORT;

export const STAR_PEARL_RATIO = 0.7;
export const rewardPerStar = (lvl) => 10 + lvl.n * 2;

// World-generation options for a level (start at the zone's depth so colours,
// decoration and hazards match the zone).
export function worldOptions(lvl) {
  return {
    startX: ZONES[lvl.zone].from * PX_PER_M,
    opts: { zone: lvl.zone, difficulty: lvl.difficulty, length: lvl.meters * PX_PER_M },
  };
}

export function isUnlocked(save, n) {
  return n === 1 || (save.levels && save.levels[n - 1] > 0);
}

export function totalStars(save) {
  return Object.values(save.levels || {}).reduce((a, b) => a + b, 0);
}
