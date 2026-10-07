# Gravity Hop

Prototipe game web hyper-casual satu tombol (HTML5 + Canvas, tanpa build step) dengan **adapter SDK** untuk Poki, CrazyGames, YouTube Playables, dan Facebook Instant Games.

![screenshot](docs/screenshot.png)

## Cara main
Tap / klik / Spasi untuk membalik gravitasi. Hindari duri, kumpulkan koin.

## Menjalankan
```bash
python3 -m http.server 8000
# buka http://localhost:8000/?platform=local
```
Ganti `?platform=` dengan `poki`, `crazygames`, `youtube`, atau `facebook` untuk memuat SDK platform tersebut. Kalau SDK gagal dimuat, game otomatis memakai mode `local` (iklan simulasi).

## Struktur
- `index.html`: halaman, UI menu/game over
- `src/game.js`: logika game (kanvas 16:9 1280x720)
- `src/sdk/adapter.js`: satu antarmuka untuk semua platform:
  `init`, `loadingFinished`, `gameplayStart/Stop`, `interstitial`, `rewarded`, `save/load`

## Monetisasi bawaan
- **Rewarded ad**: tombol "Lanjutkan" setelah game over (sekali per run).
- **Interstitial**: tiap 3 kali main ulang, minimal jarak 60 detik.
- Progres (skor terbaik, koin) disimpan lewat penyimpanan milik platform.

## Sebelum submit
- Facebook: isi `FB_INTERSTITIAL_ID` / `FB_REWARDED_ID` di `src/sdk/adapter.js` dan tambahkan `fbapp-config.json`.
- YouTube Playables: hanya iklan dari SDK YouTube, tanpa pembelian dalam game.
- Poki: ukuran unduhan awal < 8 MB (saat ini hanya beberapa KB).
