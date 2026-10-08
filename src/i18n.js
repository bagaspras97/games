// Language support (Indonesian / English).
//
// Indonesian is the source language and stays in the data files. Two helpers:
//   tr(text)        – translate a fixed Indonesian string (names, facts, labels…)
//   t(key, vars)    – templated UI text, e.g. t("levelDone", { n: 3 })
// Static HTML uses data-i18n="key" (innerHTML) and data-i18n-aria="key".
//
// The language defaults to the browser's (id → Indonesian, anything else →
// English) and can be switched with the 🌐 button; the choice is remembered.

let lang = "en";
try {
  const saved = localStorage.getItem("hop_lang");
  lang = saved || ((navigator.language || "en").toLowerCase().startsWith("id") ? "id" : "en");
} catch (e) {}

export const getLang = () => lang;

export function setLang(l) {
  lang = l;
  try { localStorage.setItem("hop_lang", l); } catch (e) {}
  document.documentElement.lang = l;
  applyStatic();
}

export function tr(text) {
  if (lang === "id" || text == null) return text;
  return EN[text] ?? text;
}

export function t(key, vars = {}) {
  const entry = UI[key];
  if (!entry) return key;
  const s = entry[lang] ?? entry.id;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

export function applyStatic() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.title = t("title");
}

// ---------- UI text (templated) ----------
const UI = {
  title: { id: "Puffy: Petualangan Laut Dalam", en: "Puffy: Deep Sea Adventure" },
  subtitle: { id: "Petualangan Laut Dalam", en: "Deep Sea Adventure" },
  intro: {
    id: "Tap / klik / spasi: Puffy <b>mengembang</b> (naik) atau <b>mengempis</b> (turun).<br>Hindari bahaya, kumpulkan 🦪 mutiara, temukan makhluk langka!",
    en: "Tap / click / space: Puffy <b>puffs up</b> (rises) or <b>deflates</b> (sinks).<br>Dodge hazards, collect 🦪 pearls, discover rare creatures!",
  },
  adventure: { id: "🗺️ Petualangan", en: "🗺️ Adventure" },
  freeMode: { id: "♾️ Mode Bebas", en: "♾️ Free Dive" },
  freeShield: { id: "🫧 Bebas + perisai (iklan)", en: "🫧 Free Dive + shield (ad)" },
  characters: { id: "🐠 Karakter", en: "🐠 Characters" },
  encyclopedia: { id: "📖 Ensiklopedia", en: "📖 Encyclopedia" },
  missions: { id: "🎯 Misi", en: "🎯 Missions" },
  sound: { id: "Suara", en: "Sound" },
  language: { id: "Bahasa", en: "Language" },
  langBtn: { id: "🌐 ID", en: "🌐 EN" },
  pause: { id: "Jeda", en: "Pause" },
  paused: { id: "⏸ Dijeda", en: "⏸ Paused" },
  pausedSub: { id: "Tarik napas dulu, Puffy 🐡", en: "Take a breath, Puffy 🐡" },
  resume: { id: "▶ Lanjut", en: "▶ Resume" },
  mainMenu: { id: "🏠 Menu utama", en: "🏠 Main menu" },
  back: { id: "Kembali", en: "Back" },
  swapTitle: { id: "🐠 Ganti karakter", en: "🐠 Swap character" },
  swapSub: {
    id: "Permainan dijeda. Setelah berganti: kebal 1 detik, lalu tunggu 8 detik untuk ganti lagi. (Tombol <b>C</b>)",
    en: "Game paused. After swapping: 1 s of invulnerability, then wait 8 s to swap again. (Key <b>C</b>)",
  },
  swapClose: { id: "▶ Lanjut menyelam", en: "▶ Keep diving" },
  swapBtn: { id: "🐠 Ganti", en: "🐠 Swap" },
  swapTo: { id: "Ganti ke {name}!", en: "Switched to {name}!" },
  overTitle: { id: "Aduh, {name}!", en: "Oops, {name}!" },
  depthLbl: { id: "Kedalaman:", en: "Depth:" },
  bestLbl: { id: "Terbaik:", en: "Best:" },
  revive: { id: "▶ Lanjutkan (tonton iklan)", en: "▶ Continue (watch ad)" },
  retry: { id: "Selam lagi", en: "Dive again" },
  retryShield: { id: "🫧 Selam lagi + perisai (iklan)", en: "🫧 Dive again + shield (ad)" },
  levelMap: { id: "🗺️ Peta level", en: "🗺️ Level map" },
  overLevel: { id: "🗺️ Level {n}: {name} — {done} / {total} m", en: "🗺️ Level {n}: {name} — {done} / {total} m" },
  shopTitle: { id: "🐠 Karakter Laut", en: "🐠 Sea Characters" },
  shopSub: { id: "Setiap karakter punya cara mengapung & tenggelam sendiri.", en: "Every character floats & sinks in its own way." },
  inUse: { id: "Dipakai", en: "Equipped" },
  use: { id: "Pakai", en: "Use" },
  lockedDex: { id: "🔒 Lengkapi Ensiklopedia ({n}/{total})", en: "🔒 Complete the Encyclopedia ({n}/{total})" },
  secretTitle: { id: "Karakter Rahasia", en: "Secret Character" },
  secretDesc: {
    id: "Temukan semua makhluk di 📖 Ensiklopedia Laut untuk membukanya.",
    en: "Find every creature in the 📖 Sea Encyclopedia to unlock it.",
  },
  skillFree: { id: "(Mode Bebas)", en: "(Free Dive)" },
  freePearls: {
    id: "🎬 +{n} mutiara (tonton iklan) · sisa {left}/{max} hari ini",
    en: "🎬 +{n} pearls (watch ad) · {left}/{max} left today",
  },
  freePearlsOut: { id: "🎬 Jatah iklan hari ini habis — kembali besok!", en: "🎬 No more ad rewards today — come back tomorrow!" },
  levelsTitle: { id: "🗺️ Petualangan", en: "🗺️ Adventure" },
  starsLbl: { id: "Bintang:", en: "Stars:" },
  levelsRules: {
    id: "★ selesai · ★★ + 70% mutiara · ★★★ + tanpa kalah (perisai boleh pecah)",
    en: "★ finish · ★★ + 70% pearls · ★★★ + no knock-out (a popped shield is fine)",
  },
  levelsPearls: {
    id: "🦪 Mutiara di level dihitung untuk bintang; hadiahnya dibayar lewat bonus bintang baru.",
    en: "🦪 Pearls in a level count toward stars; you're paid through new-star bonuses.",
  },
  levelBanner: { id: "🗺️ Level {n}: {name}", en: "🗺️ Level {n}: {name}" },
  bossBanner: { id: "👑 BOS: {icon} {name}!", en: "👑 BOSS: {icon} {name}!" },
  bossHint: {
    id: "Bagian yang <b>berkedip merah</b> akan diserang — pindah ke sisi lain! Bertahanlah sampai 🏁",
    en: "The <b>flashing red</b> side is about to be hit — switch sides! Survive until 🏁",
  },
  levelDone: { id: "Level {n} selesai!", en: "Level {n} complete!" },
  levelDoneTitle: { id: "Level selesai!", en: "Level complete!" },
  doneNext: { id: "Level berikutnya ▶", en: "Next level ▶" },
  doneRetry: { id: "↻ Ulangi", en: "↻ Retry" },
  doneMap: { id: "🗺️ Peta", en: "🗺️ Map" },
  donePearls: { id: "Mutiara {got} / {total} (butuh {pct}%)", en: "Pearls {got} / {total} (need {pct}%)" },
  doneClean: { id: 'Tanpa kalah (tanpa "Lanjutkan")', en: 'No knock-out (no "Continue")' },
  doneBoss: { id: "👑 Berhasil lolos dari {icon} {name}!", en: "👑 You escaped {icon} {name}!" },
  doneReward: { id: "+{n} 🦪 untuk {s} bintang baru!", en: "+{n} 🦪 for {s} new star(s)!" },
  doneNoReward: { id: "Coba raih bintang yang belum didapat!", en: "Try for the stars you're still missing!" },
  missionsTitle: { id: "🎯 Misi Harian", en: "🎯 Daily Missions" },
  missionsSub: { id: "Misi baru setiap hari. Ada yang serius, ada yang… kocak 😜", en: "New missions every day. Some serious, some… silly 😜" },
  missionDone: { id: "🎯 <b>Misi selesai!</b> {text}<br>Ambil +{n} 🦪 di menu 🎯 Misi", en: "🎯 <b>Mission complete!</b> {text}<br>Claim +{n} 🦪 in 🎯 Missions" },
  claim: { id: "Ambil +{n} 🦪", en: "Claim +{n} 🦪" },
  claimed: { id: "✅ Hadiah diambil", en: "✅ Reward claimed" },
  rewardLabel: { id: "Hadiah: {n} 🦪", en: "Reward: {n} 🦪" },
  pocket: { id: "+{n} 🦪 masuk ke kantong!", en: "+{n} 🦪 added!" },
  streakBanner: { id: "🔥 Streak {n} hari!", en: "🔥 {n}-day streak!" },
  streakToast: {
    id: "🔥 <b>Semua misi hari ini selesai!</b><br>Bonus streak hari ke-{n}: +{r} 🦪 menunggu di menu 🎯 Misi",
    en: "🔥 <b>All of today's missions done!</b><br>Day {n} streak bonus: +{r} 🦪 waiting in 🎯 Missions",
  },
  streakDay: { id: "Hari {n}", en: "Day {n}" },
  streakHead: { id: "🔥 Streak: <b>{n}</b> hari", en: "🔥 Streak: <b>{n}</b> days" },
  streakSafe: { id: "Streak hari ini aman! Kembali besok untuk hari ke-{n} 🔥", en: "Today's streak is safe! Come back tomorrow for day {n} 🔥" },
  streakKeep: { id: "Selesaikan ketiga misi hari ini agar streak tidak putus!", en: "Finish all three missions today to keep your streak!" },
  streakStart: { id: "Selesaikan ketiga misi hari ini untuk memulai streak!", en: "Finish all three missions today to start a streak!" },
  streakClaim: { id: "Ambil bonus +{n} 🦪", en: "Claim bonus +{n} 🦪" },
  streakClaimed: { id: "✅ Bonus hari ini sudah diambil", en: "✅ Today's bonus claimed" },
  streakGot: { id: "🔥 Bonus streak +{n} 🦪!", en: "🔥 Streak bonus +{n} 🦪!" },
  dexTitle: { id: "📖 Ensiklopedia Laut", en: "📖 Sea Encyclopedia" },
  dexSub: { id: "Makhluk langka hanya muncul di <b>♾️ Mode Bebas</b>. Ditemukan:", en: "Rare creatures only appear in <b>♾️ Free Dive</b>. Found:" },
  dexFindIn: { id: "Temukan di ♾️ Mode Bebas, {zone}", en: "Find it in ♾️ Free Dive, {zone}" },
  dexLeft: {
    id: "🔒 Temukan <b>{n}</b> makhluk lagi untuk membuka <b>karakter rahasia</b>!",
    en: "🔒 Find <b>{n}</b> more creature(s) to unlock a <b>secret character</b>!",
  },
  dexDone: {
    id: "🐋 Lengkap! <b>Bubu si Paus Biru Mini</b> sudah terbuka di menu 🐠 Karakter.",
    en: "🐋 Complete! <b>Bubu the Mini Blue Whale</b> is unlocked in 🐠 Characters.",
  },
  discovered: { id: "📖 <b>Penemuan baru: {name}!</b><br>{fact}", en: "📖 <b>New discovery: {name}!</b><br>{fact}" },
  secretBanner: { id: "🐋 Karakter rahasia terbuka!", en: "🐋 Secret character unlocked!" },
  secretToast: {
    id: "🎉 <b>Ensiklopedia lengkap!</b><br>Bubu si Paus Biru Mini kini bisa dipilih di menu 🐠 Karakter.",
    en: "🎉 <b>Encyclopedia complete!</b><br>Bubu the Mini Blue Whale can now be picked in 🐠 Characters.",
  },
  greets: { id: "{name} menyapa! +5 🦪", en: "{name} says hi! +5 🦪" },
  momentToast: { id: "✨ <b>Momen langka!</b> {icon} {name}", en: "✨ <b>Rare moment!</b> {icon} {name}" },
  momentSeen: { id: "{icon} Saksi momen langka!", en: "{icon} Rare moment witnessed!" },
  zoneBanner: { id: "{icon} {name} · {m} m", en: "{icon} {name} · {m} m" },
  fakeAd: { id: "Iklan simulasi…", en: "Simulated ad…" },
  skip: { id: "Lewati", en: "Skip" },
  tut1: { id: "👆 <b>Tap</b> (atau Spasi) untuk <b>naik</b>… tap lagi untuk <b>turun</b>!", en: "👆 <b>Tap</b> (or Space) to <b>rise</b>… tap again to <b>sink</b>!" },
  tut2: { id: "🦪 Kumpulkan <b>mutiara</b> — pakai untuk membuka karakter baru!", en: "🦪 Collect <b>pearls</b> — use them to unlock new characters!" },
  tut3: { id: "⚠️ Ada <b>bahaya</b> di bawah! Tap untuk <b>pindah ke atas</b>!", en: "⚠️ <b>Hazard</b> below! Tap to <b>move up</b>!" },
  tutOops: { id: "Hampir! Pindah sisi lebih cepat ya 😉", en: "Close one! Switch sides a bit earlier 😉" },
  tutDone: { id: "🎉 Hebat! Kamu siap menyelam!", en: "🎉 Great! You're ready to dive!" },
  tip_skill: { id: "💡 <b>Tips:</b> tombol bulat ⚡ di kanan bawah (atau <b>X</b>) memakai <b>skill khusus</b> karaktermu!", en: "💡 <b>Tip:</b> the round ⚡ button bottom-right (or <b>X</b>) uses your character's <b>special skill</b>!" },
  tip_swap: { id: "💡 <b>Tips:</b> di Mode Bebas kamu bisa <b>ganti karakter</b> di tengah jalan — tombol 🐠 kiri atas (atau <b>C</b>).", en: "💡 <b>Tip:</b> in Free Dive you can <b>swap characters</b> mid-dive — 🐠 button top-left (or <b>C</b>)." },
  tip_missions: { id: "💡 <b>Tips:</b> cek <b>🎯 Misi</b> harian — kalah dengan cara lucu pun bisa dapat mutiara!", en: "💡 <b>Tip:</b> check the daily <b>🎯 Missions</b> — even silly knock-outs can earn pearls!" },
  tip_shop: { id: "💡 Mutiaramu cukup untuk <b>karakter baru</b>! Buka <b>🐠 Karakter</b>.", en: "💡 You have enough pearls for a <b>new character</b>! Open <b>🐠 Characters</b>." },
  tip_adventure: { id: "💡 <b>Tips:</b> coba <b>🗺️ Petualangan</b> — 20 level, bintang, dan bos!", en: "💡 <b>Tip:</b> try <b>🗺️ Adventure</b> — 20 levels, stars and bosses!" },
  rotate: { id: "🔄 Putar HP-mu ke posisi mendatar untuk bermain", en: "🔄 Turn your phone sideways to play" },
};

// ---------- Fixed strings (Indonesian → English) ----------
const EN = {
  // zones
  "Perairan Dangkal": "Shallow Waters", "Laut Terbuka": "Open Sea", "Zona Senja": "Twilight Zone", "Zona Gelap": "Midnight Zone",
  // characters
  "Ikan Buntal": "Pufferfish", "Kuda Laut": "Seahorse", "Ubur-ubur": "Jellyfish", "Gurita": "Octopus", "Pari Manta": "Manta Ray",
  "Ikan Sungut Ganda": "Anglerfish", "Paus Biru Mini": "Mini Blue Whale",
  "Ketuk: mengembang (naik) ↔ mengempis (turun).": "Tap: puff up (rise) ↔ deflate (sink).",
  "Melayang lembut & ramping: naik-turun lebih pelan, mudah dikendalikan.": "Slim and gentle: rises and sinks slower, easy to control.",
  "Ketuk = denyut dorong ke atas. Tanpa ketukan, perlahan tenggelam.": "Tap = a pulse upward. Without taps it slowly sinks.",
  "Semburan tinta: pindah sisi super cepat & kebal sesaat saat menyembur.": "Ink jet: switches sides super fast and is briefly invulnerable.",
  "Meluncur zig-zag dengan kecepatan tetap; bisa berbelok di tengah air.": "Glides in zig-zags at a steady speed; can turn mid-water.",
  "Lentera menerangi laut gelap & menarik mutiara di sekitarnya.": "Its lantern lights up the dark sea and attracts nearby pearls.",
  "Karakter rahasia! Besar & tenang: naik-turun sedang, menyembur dari lubang napas.": "Secret character! Big and calm: medium rise/sink, spouts from its blowhole.",
  "Saat mengembang, ikan pedang memantul dari durinya.": "When puffed up, swordfish bounce off its spikes.",
  "Tubuh ramping: lolos menyelinap di antara lubang jaring.": "Slim body: slips right through fishing nets.",
  "Kebal sengatan ubur-ubur listrik (sesama ubur-ubur!).": "Immune to electric jellyfish (they're family!).",
  "Tinta membutakan ikan pedang & membekukan ubur-ubur di dekatnya.": "Ink blinds swordfish and freezes nearby jellyfish.",
  "Kulit licin & pipih: kail pancing selalu meleset.": "Slippery and flat: fishing hooks always miss.",
  "Mulut besar menangkap sampah plastik untuk dibuang: laut bersih +2 🦪.": "Big mouth catches plastic trash to bin it: clean sea +2 🦪.",
  "Nyanyian paus tiap 6 detik: mengusir ikan pedang, kail & membekukan ubur-ubur di sekitarnya.": "Whale song every 6 s: scares off swordfish and hooks, freezes nearby jellyfish.",
  "Ledakan Duri": "Spike Burst", "Pusaran Ekor": "Tail Whirl", "Setrum Balik": "Shock Wave", "Lengan Gurita": "Octo Arms",
  "Sayap Penerjang": "Wing Charge", "Sorot Lentera": "Lantern Flash", "Semburan Paus": "Whale Spout",
  "Duri menyembur ke segala arah, memecahkan bahaya di sekitar.": "Spikes fly in every direction, popping nearby hazards.",
  "Menyedot semua mutiara di layar & menghalau ubur-ubur dan plastik di dekatnya.": "Pulls in every pearl on screen and blows away nearby jellyfish and plastic.",
  "Gelombang listrik ke depan menghancurkan bahaya di jalurnya.": "An electric wave forward destroys hazards in its path.",
  "Tentakel meraih & melempar hingga 3 bahaya terdekat di depan.": "Tentacles grab and fling up to 3 nearest hazards ahead.",
  "Menerjang 2 detik: kebal & menembus semua bahaya yang ditabrak.": "Charge for 2 s: invulnerable and smashing through every hazard.",
  "Cahaya kuat membekukan semua bahaya di layar selama 3 detik.": "A bright flash freezes every hazard on screen for 3 s.",
  "Semburan air raksasa menyapu bersih semua bahaya di layar.": "A giant water spout washes every hazard off the screen.",
  // creatures
  "Ikan Badut": "Clownfish", "Penyu": "Sea Turtle", "Ikan Lentera": "Lanternfish", "Cumi Vampir": "Vampire Squid",
  "Hidup bersimbiosis dengan anemon laut: ia kebal terhadap sengatan anemon dan mendapat tempat berlindung.":
    "Lives in symbiosis with sea anemones: it's immune to their sting and gets a safe home.",
  "Pada kuda laut, justru sang jantan yang mengandung telur di kantung perutnya hingga menetas.":
    "In seahorses it's the father who carries the eggs in his pouch until they hatch.",
  "Penyu betina bisa bermigrasi ribuan kilometer lalu kembali bertelur di pantai tempat ia dulu menetas.":
    "Female sea turtles migrate thousands of kilometres and return to lay eggs on the beach where they hatched.",
  "Pari manta memiliki otak terbesar di antara ikan dan diduga mampu mengenali dirinya di cermin.":
    "Manta rays have the largest brain of any fish and may recognise themselves in a mirror.",
  "Gurita punya tiga jantung, darah berwarna biru, dan bisa mengubah warna kulit dalam sekejap.":
    "Octopuses have three hearts, blue blood, and can change skin colour in an instant.",
  "Ikan lentera menghasilkan cahaya sendiri dan setiap malam bermigrasi naik ratusan meter untuk mencari makan.":
    "Lanternfish make their own light and swim hundreds of metres up every night to feed.",
  "Umpan bercahaya di kepalanya berisi bakteri yang berpendar, dipakai untuk memancing mangsa dalam gelap.":
    "The glowing lure on its head is full of luminous bacteria, used to attract prey in the dark.",
  "Cumi vampir mampu hidup di lapisan laut yang sangat miskin oksigen, tempat sebagian besar hewan lain tidak bertahan.":
    "Vampire squid live in ocean layers so low in oxygen that most other animals can't survive.",
  // levels
  "Kolam Terumbu": "Reef Pool", "Taman Anemon": "Anemone Garden", "Lorong Karang": "Coral Alley", "Celah Es": "Ice Crack", "Ujian Dangkal": "Shallows Trial",
  "Padang Lamun": "Seagrass Meadow", "Arus Biru": "Blue Current", "Jalur Penyu": "Turtle Route", "Kail Nelayan": "Fisher's Hooks", "Ujian Laut Terbuka": "Open Sea Trial",
  "Lembah Senja": "Twilight Valley", "Jaring Hantu": "Ghost Nets", "Lintasan Ikan Pedang": "Swordfish Run", "Gua Plastik": "Plastic Cave", "Ujian Senja": "Twilight Trial",
  "Gerbang Gelap": "Dark Gate", "Hutan Bercahaya": "Glowing Forest", "Palung Sunyi": "Silent Trench", "Sarang Ubur-ubur": "Jellyfish Nest", "Ujian Palung Terdalam": "Deepest Trench Trial",
  // bosses
  "Kepiting Raksasa": "Giant Crab", "Hiu Martil": "Hammerhead Shark", "Gurita Raksasa": "Giant Octopus", "Anglerfish Raksasa": "Giant Anglerfish",
  // knock-out causes
  "Gedebuk! Menabrak dinding karang.": "Thud! Smacked into the reef wall.",
  "Terlempar keluar dari air!": "Launched right out of the water!",
  "Tersedot ke dalam palung… ada yang menunggu di sana!": "Sucked into the trench… something was waiting down there!",
  "Dijepit capit Kepiting Raksasa!": "Pinched by the Giant Crab!",
  "Diseruduk Hiu Martil!": "Rammed by the Hammerhead!",
  "Ditarik tentakel Gurita Raksasa!": "Dragged off by the Giant Octopus!",
  "Dilahap Anglerfish Raksasa!": "Gobbled by the Giant Anglerfish!",
  "Tertusuk bulu babi! Psssh…": "Poked by a sea urchin! Psssh…",
  "Tergores karang tajam!": "Scraped by sharp coral!",
  "Tertusuk es runcing!": "Stabbed by an icicle!",
  "Bzzzt! Tersetrum ubur-ubur listrik.": "Bzzzt! Zapped by an electric jellyfish.",
  "Tersangkut kail pancing!": "Caught on a fishing hook!",
  "Terjerat jaring nelayan!": "Tangled in a fishing net!",
  "Diseruduk ikan pedang!": "Rammed by a swordfish!",
  "Terbungkus sampah plastik!": "Wrapped up in plastic trash!",
  "Aduh!": "Ouch!",
  // floating texts
  "♪ Nyanyian paus!": "♪ Whale song!", "Buta tinta!": "Inked!", "Beku!": "Frozen!", "Boing! Memantul": "Boing! Bounced",
  "Lolos dari jaring!": "Slipped through!", "Halo, teman! 🪼": "Hi, buddy! 🪼", "Meleset!": "Missed!",
  "Laut bersih! +2 🦪": "Clean sea! +2 🦪", "Laut bersih!": "Clean sea!",
  // moments
  "Kawanan lumba-lumba bermain!": "A pod of dolphins at play!", "Pusaran ribuan ikan kecil!": "A swirling ball of a thousand tiny fish!",
  "Paus bungkuk melintas…": "A humpback whale glides by…", "Paus sperma menyelam ke kedalaman…": "A sperm whale dives into the deep…",
  "Cumi-cumi raksasa muncul dari kegelapan!": "A giant squid emerges from the dark!",
  "Ubur-ubur raksasa bercahaya naik perlahan…": "A giant glowing jellyfish slowly rises…",
  "Gelombang cahaya bioluminesensi!": "A wave of bioluminescence!",
  // missions
  "Kesetrum ubur-ubur 3 kali ⚡ (rambut jadi kribo?)": "Get zapped by jellyfish 3 times ⚡ (frizzy hair?)",
  "Tertangkap kail pancing 1 kali 🎣 (salam untuk pak nelayan)": "Get caught on a hook once 🎣 (say hi to the fisherman)",
  "Terbungkus kantong plastik 2 kali 🛍️": "Get wrapped in a plastic bag 2 times 🛍️",
  "Terjerat jaring 2 kali 🕸️ (kok betah?)": "Get tangled in a net 2 times 🕸️ (comfy in there?)",
  "Diseruduk ikan pedang 2 kali 🗡️": "Get rammed by a swordfish 2 times 🗡️",
  "Jadi camilan penghuni palung 1 kali 👀": "Become a trench monster's snack once 👀",
  "Terlempar keluar dari air 1 kali ☀️ (mau jemur badan?)": "Get launched out of the water once ☀️ (sunbathing?)",
  "Gedebuk ke dinding 3 kali 🧱": "Thud into a wall 3 times 🧱",
  "Kempis tertusuk duri 3 kali 🦔 (psssh…)": "Get popped by spikes 3 times 🦔 (psssh…)",
  "Kalah sebelum 50 m 😅 (sengaja juga boleh)": "Get knocked out before 50 m 😅 (on purpose counts)",
  "Mengembang-mengempis 100 kali dalam satu selaman 🎈": "Puff up/deflate 100 times in one dive 🎈",
  "Kumpulkan 50 mutiara 🦪": "Collect 50 pearls 🦪",
  "Capai kedalaman 500 m 🌊": "Reach a depth of 500 m 🌊",
  "Pakai kemampuan khusus karakter 5 kali ⚡": "Use character abilities 5 times ⚡",
  "Sapa 3 makhluk langka 📖": "Meet 3 rare creatures 📖",
  "Pecahkan 2 gelembung perisai 🫧": "Pop 2 shield bubbles 🫧",
  "Saksikan 2 momen langka ✨ (paus, lumba-lumba…)": "Witness 2 rare moments ✨ (whales, dolphins…)",
  "Menyelam dengan 2 karakter berbeda 🐠": "Dive with 2 different characters 🐠",
};
