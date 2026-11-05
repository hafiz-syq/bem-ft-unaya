# Strategi Update Aplikasi: PWA dan Cangkang APK

Untuk siapa pun yang menyentuh `frontend/` atau `android/`. Prinsipnya satu
kalimat: **yang di-update itu situs, bukan aplikasinya.** APK hanyalah peluncur
yang menunjuk satu URL.

## Dua jalur pasang, dua perilaku

| Dipasang lewat | Yang ada di HP user | Update konten | Update cangkang |
| --- | --- | --- | --- |
| Tombol pasang / Add to Home Screen (Chrome, Safari, Edge) | PWA murni | otomatis | tidak ada cangkang |
| `bem-ft-unaya-<versi>.apk` | cangkang TWA + situs | otomatis | manual |

## 1. Yang otomatis: situs dan PWA

- `frontend/public/sw.js` memanggil `skipWaiting()` saat install dan
  `clients.claim()` saat activate, jadi Service Worker baru mengambil alih tanpa
  satu pun klik dari user.
- Nama cache mengandung versi (`bem-ft-shell-${VERSI}`, `bem-ft-data-`,
  `bem-ft-gambar-`); cache versi lama dibuang pada `activate`.
- Konsekuensinya penting untuk support: **setiap deploy Vercel sampai ke semua
  user, termasuk yang membuka portal lewat APK.**

## 2. Yang manual: cangkang APK

`android/app/src/main/res/values/strings.xml` mengunci
`launchUrl = https://bem-ft-unaya.vercel.app/`. Cangkang tidak punya mekanisme
cek versi dan tidak berada di Play Store, jadi ia diam selamanya — dan itu benar
selama yang berubah hanya konten.

Buat versi APK baru **hanya** jika salah satu ini berubah:

- `hostName` / `launchUrl` (pindah domain)
- `appName` / `launcherName` / ikon (`mipmap-*`) / `colorPrimary` dan
  `colorPrimaryDark` di `res/values/colors.xml` (splash dan status bar)
- `assetStatements` atau sidik jari pada
  `frontend/public/.well-known/assetlinks.json` (rotasi keystore)
- versi `androidbrowserhelper` atau komponen manifest yang dituntutnya
- `minSdk` / `targetSdk`

## 3. Aturan pasang timpa (untuk jawaban ke pengguna)

- User cukup mengunduh APK baru lalu memasangnya **menimpa** yang lama: tidak
  perlu mencopot. Cangkang kita tidak menyimpan data apa pun — login, cache, dan
  antrean tulisan luring semuanya milik situs di profil peramban — jadi
  menimpa cangkang tidak menghapusnya. Terbukti di SM-A217F: 1.0.1 terpasang
  menimpa 1.0.0 tanpa pencopotan.
- Dua syarat mutlak: `versionCode` harus naik, dan keystore penanda tangan harus
  sama. Beda kunci = Android menolak pemasangan = user terpaksa copot dulu dan
  data lokalnya hilang.
- APK yang langsung crash juga cukup ditimpa, bukan dicopot.

## 4. Langkah rilis APK versi baru

1. Sunting `android/app/build.gradle`: `versionCode` +1 dan `versionName` baru.
2. Sunting pemicunya (`strings.xml`, `colors.xml`, ikon, atau
   `AndroidManifest.xml`) sesuai daftar bagian 2.
3. Commit. **Push tetap hak pemilik** — push ke `main` adalah deploy produksi
   otomatis.
4. GitHub Actions → workflow **APK Android** → *Run workflow*. Workflow ini
   sengaja `workflow_dispatch`, bukan terpicu push, karena menyentuh keystore dan
   menerbitkan Release publik.
5. Ambil URL unduhan yang dicetak langkah terakhir. Polanya selalu
   `.../releases/download/apk-v<versionName>/bem-ft-unaya-<versionName>.apk`.
6. Tempel URL itu ke `URL_APK` di `frontend/src/pages/PasangAplikasi.tsx`, lalu
   deploy frontend seperti biasa. Kalau `URL_APK` kosong, baris unduhan memang
   tidak dirender, jadi jangan tinggalkan URL basi.

CI punya gerbang yang tidak bisa dilewati: sidik jari keystore harus cocok
dengan `assetlinks.json`. Kalau gerbang itu merah, yang salah adalah keystore
atau berkas assetlinks-nya — bukan kodenya.

## 5. Batas yang jujur

- Tidak ada auto-update cangkang. Yang bisa kita otomatiskan hanya
  **pengumuman**: `URL_APK` tampil di halaman `/pasang-aplikasi`, dan halaman itu
  ikut dirender di dalam cangkang, jadi menggeser satu konstanta sudah membuat
  semua pengguna melihat tautan versi terbaru.
- Situs tidak dapat membaca versi APK yang terpasang di HP user. Pesannya
  "versi terbaru X", bukan "HP Anda ketinggalan X".
- Auto-update sungguhan menuntut Google Play (biaya, berkas AAB, peninjauan
  ulang). Belum dipakai dan belum direncanakan.

## 6. Satu risiko yang berdiri di atas satu berkas

Seluruh skema ini bergantung pada keystore yang sama selama bertahun-tahun.
Hilang atau dirotasi berarti semua pengguna lama wajib copot-pasang ulang dan
`assetlinks.json` harus diterbitkan ulang sampai verifikasi Digital Asset Links
hijau lagi. Cadangkan keystore di luar laptop kerja.

## Rujukan

- `.github/workflows/android-apk.yml` — gerbang sidik jari, rakit, terbitkan Release
- `android/app/src/main/AndroidManifest.xml` — komentar pada
  `ManageDataLauncherActivity` menjelaskan kenapa satu deklarasi yang hilang bisa
  membuat cangkang mati total sebelum menampilkan apa pun
- `DEPLOY.md` — deploy sisi server (Vercel + Aiven + Cloudinary)
