# 🐡 Puffy: Petualangan Laut Dalam

Game web hyper-casual satu tombol (HTML5 + Canvas, tanpa build step, tanpa file aset) dengan **adapter SDK** untuk Poki, CrazyGames, YouTube Playables, dan Facebook Instant Games.

![screenshot](docs/screenshot.png)

## Konsep
Puffy si ikan buntal menyelam makin dalam. **Tap / klik / Spasi**: Puffy **mengembang** (mengapung ke atas) atau **mengempis** (tenggelam ke bawah). Skor = **kedalaman (m)**.

| Zona | Kedalaman | Bahaya |
|---|---|---|
| 🌤️ Perairan Dangkal | 0–300 m | Bulu babi, karang tajam, es runcing |
| 🌊 Laut Terbuka | 300–800 m | + Ubur-ubur listrik, kail pancing |
| 🌑 Zona Senja | 800–1500 m | + Ikan pedang (didahului tanda "!"), jaring, sampah plastik |
| ✨ Zona Gelap | 1500 m+ | Semua, lebih rapat; laut gelap dengan cahaya di sekitar Puffy |

- **Palung**: lantai/atap hilang. Jatuh = kalah, jadi pindah sisi sebelum palung.
- Warna laut, terrain, dan musik (makin teredam) berubah mengikuti kedalaman.

![deep](docs/deep.png)

## Koleksi
- 🦪 **Mutiara**: mata uang untuk 7 skin Puffy di toko.
- 🫧 **Gelembung perisai**: kebal satu kali tabrakan/jatuh. Muncul jarang, atau dari rewarded ad "Mulai dengan perisai".
- 📖 **Ensiklopedia Laut**: 8 makhluk langka (2 per zona). Sentuh untuk menemukan dan membaca faktanya.

| Toko Skin | Ensiklopedia |
|---|---|
| ![shop](docs/shop.png) | ![dex](docs/dex.png) |

## Monetisasi
- Rewarded: lanjutkan setelah kalah, mulai dengan perisai, +25 mutiara di toko.
- Interstitial: tiap 3 kali main ulang, jarak minimal 60 detik.
- Suara & musik otomatis dibisukan selama iklan.

## Menjalankan
```bash
python3 -m http.server 8000 --bind 127.0.0.1
# buka http://localhost:8000/?platform=local
# uji zona dalam: http://localhost:8000/?start=1000
```
`?platform=` bisa `poki`, `crazygames`, `youtube`, `facebook`, atau `local` (iklan simulasi).

## Struktur
- `src/game.js`: alur game, fisika Puffy, perisai, penemuan, UI
- `src/world.js`: terrain, palung, zona, bahaya, pickup, semua rendering dunia
- `src/skins.js`: gambar Puffy + 7 skin
- `src/creatures.js`: makhluk Ensiklopedia Laut + faktanya
- `src/particles.js`: gelembung, kilau, ledakan
- `src/audio.js`: efek suara & musik sintetis (Web Audio API)
- `src/sdk/adapter.js`: satu antarmuka untuk semua platform

## Sebelum submit
- Facebook: isi `FB_INTERSTITIAL_ID` / `FB_REWARDED_ID` di `src/sdk/adapter.js` dan tambahkan `fbapp-config.json`.
- YouTube Playables: hanya iklan dari SDK YouTube, tanpa pembelian dalam game.
