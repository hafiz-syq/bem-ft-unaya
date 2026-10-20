# BEM-FT UNAYA — Portal BEM Fakultas Teknik

Aplikasi portal BEM-FT UNAYA: backend REST API (Express + Prisma) dan frontend React (Vite + Tailwind).

- `backend/` — API Express, Prisma ORM, job notifikasi, dan uji matriks akses rute.
- `frontend/` — SPA React (Vite, React Router, Tailwind).

## Prasyarat

- Node.js 18+ (disarankan 20+)
- Database sesuai konfigurasi Prisma di `backend/prisma` (lihat `backend/.env`)

## Menjalankan Backend

Semua perintah dijalankan dari folder `backend/`:

| Script | Perintah | Fungsi |
| --- | --- | --- |
| `dev` | `npm run dev` | Menjalankan server development (nodemon, port lihat `backend/.env`) |
| `migrate` | `npm run migrate` | Menjalankan migrasi Prisma (mode dev) |
| `seed` | `npm run seed` | Mengisi data awal (seed) |
| `superadmin` | `npm run superadmin` | Membuat/memperbarui akun SUPERADMIN |
| `test` | `npm test` | Menjalankan uji matriks akses rute (`src/tests/uji-akses-rute.ts`) — butuh server dev berjalan |
| `verifikasi:akses` | `npm run verifikasi:akses` | Memverifikasi pembatasan akses non-admin |
| `build` | `npm run build` | Kompilasi TypeScript ke `dist/` |
| `start` | `npm start` | Menjalankan hasil build produksi (`node dist/index.js`) |

Urutan pemakaian pertama kali:

```bash
cd backend
npm install
npm run migrate
npm run seed          # opsional
npm run superadmin    # buat akun SUPERADMIN
npm run dev           # nyalakan API
npm test              # di terminal lain, saat server dev berjalan
```

Catatan backend:

- Endpoint berprefix `/api` (contoh: `/api/auth`, `/api/dashboard`).
- Log akses & keamanan (CORS monitor, notifikasi perpanjangan) aktif otomatis saat server menyala.
- Notifikasi email perpanjangan akun mahasiswa dikirim paling banyak **sekali per hari** dalam **satu email gabungan** (akun 30 hari & 7 hari disatukan, diurutkan dari yang paling mendesak). Atur `ADMIN_EMAIL` dan kredensial SMTP di `backend/.env`.

## Menjalankan Frontend

Semua perintah dijalankan dari folder `frontend/`:

| Script | Perintah | Fungsi |
| --- | --- | --- |
| `dev` | `npm run dev` | Dev server Vite + HMR (buka URL yang tercetak, biasanya `http://localhost:5173`) |
| `build` | `npm run build` | Type-check (`tsc -b`) lalu build produksi ke `dist/` |
| `lint` | `npm run lint` | ESLint |
| `preview` | `npm run preview` | Menjalankan hasil build produksi secara lokal |

```bash
cd frontend
npm install
npm run dev
```

Frontend memanggil API backend; pastikan URL API di konfigurasi frontend (`.env` / `src/lib/axios`) menunjuk ke backend yang berjalan.

## Deploy

Panduan langkah demi langkah ada di [DEPLOY.md](DEPLOY.md): frontend ke Vercel, database ke Aiven for MySQL (paket gratis), dan API Express ke host yang mendukung proses tetap (disarankan VM Oracle Always Free). Ringkasnya:

- Vercel hanya membangun frontend; `vercel.json` di root repo mengatur build `frontend/dist` dan fallback SPA.
- API tidak dijalankan sebagai serverless function karena butuh disk unggahan dan job latar.
- Di server, setel `UPLOAD_DIR` ke folder persisten dan `COOKIE_SAME_SITE=none` bila frontend dan API berada di situs berbeda.

## Struktur Singkat

```
bem-ft-unaya/
├── backend/
│   ├── prisma/            # skema & migrasi database
│   └── src/
│       ├── app.ts         # definisi Express app (mount semua rute)
│       ├── index.ts       # bootstrap server + job terjadwal
│       ├── controllers/   # logika endpoint
│       ├── routes/        # definisi rute + penjaga peran
│       ├── services/      # bisnis logis (email, audit, notifikasi, dsb.)
│       └── tests/         # uji matriks akses rute
├── frontend/
│   └── src/               # halaman, komponen, konteks auth, axios client
└── README.md              # file ini
```

## Skalabilitas & Klaster Database

Kapasitas satu MySQL masih jauh lebih besar daripada beban portal ini (pembaca publik + belasan pengurus). Urutan peningkatan yang disarankan — jangan lompat ke klaster sebelum langkah murah terbukti kurang:

1. **Indeks & query.** Agenda sudah berindeks pada kolom `date`; komentar galeri berindeks pada `(galleryId, status, createdAt)` dan `(guestIp, createdAt)`. Halaman publik hanya membaca data yang dibutuhkan (komentar tayang, agenda terurut).
2. **Connection pool.** Batasi koneksi per proses lewat `connection_limit` pada `DATABASE_URL` (contoh di `backend/.env.example`). Terlalu banyak koneksi justru memperlambat MySQL.
3. **Cache & kompresi di depan API.** Nginx/Cloudflare dengan gzip/brotli, cache aset statis (`/assets`, `/uploads`) dan `Cache-Control` panjang; API tetap dinamis. Ini biasanya menaikkan kapasitas lebih besar daripada menambah replika database.
4. **Klaster database (bila perlu).** Pola umum MySQL: satu **primary** untuk tulis + satu/lebih **replica** untuk baca, dengan **ProxySQL** atau **MySQL Router** di depan. `DATABASE_URL` diarahkan ke proxy, bukan ke replica langsung. Catatan penting: Prisma tidak otomatis memisahkan baca/tulis. Agar replica benar-benar meringankan primary, endpoint baca berat (landing, agenda, galeri) perlu koneksi Prisma terpisah ke replica, dan Anda harus siap dengan *replication lag* (data yang baru ditulis bisa belum terlihat di replica). Untuk kebutuhan saat ini, langkah ini belum diperlukan.
5. **Multi-instance API.** Bila API dijalankan lebih dari satu proses/server, pembatas komentar tamu yang disimpan di memori (5 komentar/10 menit per IP) berlaku per instance. Pindahkan penghitung itu ke Redis agar batasnya berlaku menyeluruh, dan aktifkan `TRUST_PROXY=1` supaya IP pengunjung terbaca benar di balik proxy.

Backup rutin dan pemantauan query lambat (`slow_query_log`) lebih mendesak daripada clustering. Lakukan keduanya sebelum menambah replika.

## Backup & Pemulihan Database

Backup harian dijalankan Windows Task Scheduler setiap **03:00** lewat [scripts/backup-database.bat](scripts/backup-database.bat).

- **Hasil:** satu berkas `backups/bem_ft_unaya_<tgl>_<jam>.zip` berisi `bem_ft_unaya_<tgl>_<jam>.sql`. Setelah arsip dipastikan berisi datanya, berkas `.sql` dihapus supaya folder `backups/` tidak cepat penuh (dump ±200 KB menjadi ±62 KB). Bila kompresi gagal, `.sql` sengaja dibiarkan agar backup tidak hilang.
- **Jadwal terlewat:** opsi *Run task as soon as possible after a scheduled start is missed* (`StartWhenAvailable`) aktif. Bila PC mati pada 03:00, backup dijalankan begitu PC menyala. Tugas memakai `InteractiveToken`, jadi harus ada sesi pengguna yang login.
- **Baterai:** `DisallowStartIfOnBatteries` dan `StopIfGoingOnBatteries` dimatikan, supaya laptop yang menyala tanpa charger tidak melewatkan backup.
- **Rotasi:** arsip lebih tua dari 14 hari dihapus (`HARI_SIMPAN` di skrip).
- **Gagal?** Lihat `backups/backup.log`; bila SMTP di `backend/.env` lengkap, email peringatan dikirim lewat [backend/scripts/peringatan-backup.cjs](backend/scripts/peringatan-backup.cjs).
- **Mendaftarkan ulang tugas** (setelah instal ulang Windows/pindah PC):

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\daftarkan-tugas-backup.ps1
  ```

  Skrip itu menerapkan 03:00 harian, `StartWhenAvailable`, izin saat memakai baterai, dan `IgnoreNew` (tidak ada dua dump bersamaan).

### Memulihkan ke database uji

Jangan menimpa `bem_ft_unaya` selama aplikasi dipakai; pulihkan ke database terpisah lalu bandingkan.

```bash
# 1. ekstrak arsip
unzip backups/bem_ft_unaya_20261020_021725.zip -d /tmp/pulih

# 2. buat database uji kosong
mysql -u root -e "DROP DATABASE IF EXISTS bem_ft_unaya_uji_pulih; CREATE DATABASE bem_ft_unaya_uji_pulih CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. impor (klien MySQL 8 butuh plugin caching_sha2_password; sesuaikan --plugin-dir)
mysql --plugin-dir="C:/laragon/bin/heidisql/plugins" -u root --default-character-set=utf8mb4 \
  bem_ft_unaya_uji_pulih < /tmp/pulih/bem_ft_unaya_20261020_021725.sql

# 4. bandingkan jumlah akun
mysql -u root -N -e "SELECT COUNT(*) FROM user;" bem_ft_unaya
mysql -u root -N -e "SELECT COUNT(*) FROM user;" bem_ft_unaya_uji_pulih
```

Uji pemulihan 21 Okt 2026 memakai dump `20261020_021725` (skema 25 tabel, tanpa `CREATE DATABASE`, jadi aman diimpor ke database uji): impor selesai dalam ±1 detik dan tabel `user` berisi **377 baris di kedua database**. Dari 377 akun, 373 baris identik pada kolom inti (`id`, `nim`, `password_hash`, `role`, `email`); 4 baris berbeda karena memang diubah setelah backup diambil. Tabel `agenda`, `auditlog`, dan `position` juga lebih banyak di database asli — data yang bertambah setelah 02:17, bukan akibat restore. Hapus database uji dengan `DROP DATABASE bem_ft_unaya_uji_pulih;` bila sudah selesai.

## Kunci Satu Perangkat

Setiap akun hanya boleh aktif di **satu perangkat** pada satu waktu.

- Login pertama (setelah migrasi ini dipasang) otomatis mengikat akun ke browser/perangkat yang dipakai. ID perangkat dibuat acak oleh frontend dan disimpan di `localStorage`, lalu dikirim lewat header `X-Device-Id`.
- Login dari perangkat lain ditolak dengan kode `PERANGKAT_TERKUNCI`, dan percobaannya dicatat (`pendingDevice`) agar admin melihat perangkat mana yang ingin dipakai.
- **ADMIN** dan **SUPERADMIN** membuka menu **Perangkat & Sesi** untuk:
  - **Izinkan perangkat baru** — memindahkan akun ke perangkat yang terakhir mencoba login. Perangkat lama langsung keluar.
  - **Tolak percobaan** — mengabaikan percobaan tanpa mengganggu perangkat lama.
  - **Lepas kunci** — membebaskan akun; perangkat pertama yang dipakai setelahnya akan mengunci lagi. Cocok bila perangkat lama dijual/rusak dan pengguna belum mencoba login dari perangkat baru.
- Setiap izinkan/lepas menaikkan `sessionVersion`, sehingga cookie lama langsung tidak sah tanpa menunggu token kedaluwarsa.
- ADMIN tidak dapat mengelola perangkat akun ADMIN/SUPERADMIN lain; aturan ini hanya untuk SUPERADMIN (sejalan dengan aturan pengelolaan akun yang sudah ada).

Catatan: ini penguncian praktis, bukan attestation perangkat. Menyalin nilai `bem-ft-id-perangkat` dari `localStorage` ke browser lain secara teknis bisa memindahkan "identitas perangkat"; menghapus data situs juga membuat perangkat dianggap baru. Karena itu admin tetap punya jalur izinkan/lepas.

## Konversi Gambar ke WebP

Saat ini **semua unggahan gambar** diproses di server sebelum disimpan:

- Berlaku untuk foto profil, cover konten CMS, foto galeri (banyak sekaligus), foto demisioner, dan lampiran gambar tiket.
- Format selain WebP (JPG, PNG, HEIC/HEIF bila didukung sharp, GIF, AVIF, TIFF, dsb.) diubah menjadi WebP kualitas 82 dan orientasi EXIF dirapikan. Gambar yang sudah WebP tidak dikompresi ulang.
- PDF tetap disimpan sebagai PDF (lampiran tiket). SVG ditolak karena bisa memuat skrip.
- Batas ukuran unggahan **tidak berubah**: foto profil 2 MB dan lampiran/CMS 5 MB, dihitung dari berkas asli sebelum konversi. Bila ingin menerima foto kamera HP yang lebih besar, naikkan `UPLOAD_LIMITS` di `backend/src/middlewares/upload.middleware.ts` sekaligus teks batas di frontend.
- `sharp` sudah tercantum di `backend/package.json`; jalankan `npm install` di `backend/` setelah menarik perubahan ini.

## Keamanan Akses (ringkas)

- Autentikasi memakai JWT berbasis cookie.
- Pembatasan peran: `TAMU → MAHASISWA → PENGURUS (BEM/DPM) → ADMIN → SUPERADMIN`, ditentukan `requireRole` di route dan/atau `isAdminRole` di controller.
- Setiap perubahan rute penting pantau lewat `npm test` (matriks akses rute) agar tidak ada endpoint yang tanpa sengaja kehilangan penjaga peran.
- Kunci perangkat diperiksa di `requireAuth`/`optionalAuth` pada setiap permintaan, bukan hanya saat login. Rute baru otomatis ikut terlindungi selama memakai middleware tersebut.
- Uji matriks akses kini mencakup `GET /api/devices` dan `POST /api/devices/:id/reset`.
