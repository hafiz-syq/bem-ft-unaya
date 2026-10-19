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

## Keamanan Akses (ringkas)

- Autentikasi memakai JWT berbasis cookie.
- Pembatasan peran: `TAMU → MAHASISWA → PENGURUS (BEM/DPM) → ADMIN → SUPERADMIN`, ditentukan `requireRole` di route dan/atau `isAdminRole` di controller.
- Setiap perubahan rute penting pantau lewat `npm test` (matriks akses rute) agar tidak ada endpoint yang tanpa sengaja kehilangan penjaga peran.
