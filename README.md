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
