# Deploy Produksi di Hostinger

Panduan ini menggantikan rencana sementara Vercel + Aiven + VM. Semua bagian
aplikasi berjalan di **satu paket Hostinger**:

```
https://domain-anda.com
  ├── /                 SPA React (hasil build Vite)
  ├── /api/*            API Express
  ├── /uploads/*        foto profil, cover CMS, lampiran tiket
  └── MySQL localhost   database Hostinger
```

Satu origin dipakai supaya cookie sesi tetap `SameSite=Lax` dan tidak ada CORS
silang situs. Tidak ada Vercel, Aiven, PM2, Caddy, atau Docker di jalur ini.

## Penting: cek dulu menu Node.js di hPanel

Panduan ini mengasumsikan paket Premium Anda benar-benar menampilkan
**Advanced → Node.js** (fitur Node.js lama/legacy). Hostinger sekarang
membedakan paket berdasarkan tanggal pembelian:

- Paket **v3** (dibeli sejak 17 Desember 2025) pada tabel resmi Hostinger
  menulis **Node.js websites: Not available** untuk Web Premium.
- Paket lama (v1/v2) masih dapat memiliki menu Node.js. Paket **Unlimited**
  (pengganti Business), Cloud, dan VPS mendukung Node.js.

Buka hPanel → **Advanced**. Bila **Node.js** ada, lanjutkan. Bila tidak ada,
jangan memaksa lewat SSH/PM2: hubungi Hostinger Support atau pilih paket yang
mendukung Node.js. Frontend tetap bisa dititipkan sebagai situs statis, tetapi
API tetap butuh runtime Node.

## Yang perlu disiapkan

- Domain yang sudah menunjuk ke Hostinger.
- SSL gratis Hostinger aktif (Status: Active).
- Node.js **22** di hPanel (minimal 20.9; sharp 0.35 tidak jalan di Node 18).
- Akses SSH (hPanel → Advanced → SSH Access) atau Terminal hPanel.
- Database MySQL kosong dari hPanel.
- Dump terbaru dari `backups/` (dump berisi 25 tabel + data, tanpa
  `_prisma_migrations`).

## 1. Buat database MySQL

1. hPanel → **Databases → MySQL Databases** → **Create database**.
2. Catat tiga nilai berikut (nama akan berawalan `uXXXXXX_`):
   - Database, mis. `u123456_bemft`
   - User, mis. `u123456_bemftadmin`
   - Password (simpan di pengelola sandi)
3. Host tetap `localhost`; port `3306`.
4. Di **Remote MySQL**, tidak perlu membuka akses dari internet. Aplikasi
   berjalan di server yang sama.

Batas Premium: 10 database, 50 koneksi per user. `connection_limit=5` sudah
cukup untuk satu proses API.

## 2. Letakkan kode di server

Struktur yang dipakai panduan ini:

```
/home/uXXXXXX/domains/domain-anda.com/
├── app/
│   ├── backend/       # package.json, server.js, dist/, prisma/
│   └── frontend/      # package.json, dist/
└── uploads/           # di luar app/, persisten
```

Pilih salah satu cara:

**A. Upload ZIP (paling sederhana)**

1. Di komputer, buat ZIP berisi folder `backend/` dan `frontend/` **tanpa**
   `node_modules`, `dist`, `.env`, dan `backend/uploads`.
2. hPanel → **Files → File Manager** → buat folder
   `domains/domain-anda.com/app`.
3. Upload ZIP ke folder itu, klik kanan → **Extract**.

**B. Clone dari Git**

```bash
cd ~/domains/domain-anda.com
mkdir -p app && cd app
git clone <URL-REPO> .
```

Repo ini masih publik dan riwayat lama masih dapat diunduh. Sebelum go-live,
jadikan repo privat (lihat [SECURITY.md](SECURITY.md)); setelah itu gunakan
deploy key atau upload ZIP, jangan menaruh token di URL.

## 3. Siapkan folder unggahan persisten

Jangan memakai `backend/uploads` untuk produksi: folder aplikasi bisa tertimpa
saat deploy ulang. Buat folder di luar `app/`:

```bash
mkdir -p ~/domains/domain-anda.com/uploads
chmod 755 ~/domains/domain-anda.com/uploads
```

Nanti isi `UPLOAD_DIR` dengan path absolut folder itu. Berkas lama (kalau ada)
disalin ke sini, bukan ke folder aplikasi.

## 4. Install dan build dari SSH

```bash
cd ~/domains/domain-anda.com/app/backend
node -v                 # harus v20.9+; idealnya v22.x
npm ci --include=dev    # devDependencies dibutuhkan untuk tsc & Prisma CLI
npx prisma generate
npm run build

cd ../frontend
npm ci
npm run build
```

Yang dihasilkan:

- `backend/dist/` — hasil kompilasi TypeScript.
- `frontend/dist/` — SPA siap saji, termasuk `index.html` dan `/assets/*`.

`frontend/.env.production` sudah berisi `VITE_API_URL=/api`, jadi build
memanggil API di origin yang sama. Kalau nilai itu diubah, build ulang
frontend.

Catatan Node: bila `node -v` di SSH berbeda dari versi yang dipilih di hPanel,
samakan dulu. `bcrypt` berisi modul native; memasang dependensi dengan ABI Node
yang berbeda dari runtime Passenger bisa menghasilkan
`invalid ELF header`/`NODE_MODULE_VERSION` saat aplikasi start.

## 5. Buat aplikasi Node.js di hPanel

hPanel → **Advanced → Node.js → Create application**:

| Isian | Nilai |
| --- | --- |
| Node.js version | **22** (atau versi tertinggi yang tersedia, minimal 20.9) |
| Application root | `domains/domain-anda.com/app/backend` (relatif terhadap home; cocokkan dengan File Manager) |
| Application URL | `domain-anda.com` (dan `www` bila dipakai) |
| Application startup file | `server.js` |
| Environment | production |

`server.js` adalah entry point baru. Ia membaca `.env` (bila ada), memeriksa
`dist/index.js`, lalu menjalankan server. Aplikasi mendengarkan
`process.env.PORT`, jadi jangan hardcode port dan **jangan set `PORT` di
hPanel** — Hostinger menyuntikkan nilainya sendiri. Bila hPanel meminta
**Start command** alih-alih startup file, isi `npm start`; isinya sama-sama
menjalankan `server.js`.

Setelah aplikasi dibuat:

1. Klik **Run NPM Install** (kalau tersedia) atau gunakan `npm ci` di SSH.
2. Klik **Restart Application**.

## 6. Isi environment variables

hPanel → Node.js → **Environment Variables** (atau file `backend/.env` lewat
File Manager; jangan pakai keduanya sekaligus).

Wajib:

| Variabel | Nilai contoh | Catatan |
| --- | --- | --- |
| `NODE_ENV` | `production` | Mengaktifkan penyajian SPA otomatis |
| `TRUST_PROXY` | `1` | Agar IP asli & HTTPS dikenali di balik LiteSpeed |
| `SERVE_FRONTEND` | `1` | Backend menyajikan `frontend/dist` |
| `UPLOAD_DIR` | `/home/uXXXXXX/domains/domain-anda.com/uploads` | Folder persisten |
| `FRONTEND_URL` | `https://domain-anda.com` | Origin CORS (tanpa garis miring akhir) |
| `DATABASE_URL` | lihat di bawah | MySQL Hostinger |
| `JWT_SECRET` | teks acak 64+ karakter | Jangan pakai nilai lama |
| `RUN_STARTUP_JOBS` | `0` | Job dijalankan cron, bukan cold start |
| `CRON_SECRET` | teks acak 64 karakter | Kunci endpoint cron |
| `ADMIN_EMAIL` | `admin@domain-anda.com` | Penerima ringkasan perpanjangan |
| `SMTP_HOST` | `smtp.gmail.com` | Atau `smtp.hostinger.com` |
| `SMTP_PORT` | `587` | Hostinger: `465` dengan `SMTP_SECURE=true` |
| `SMTP_SECURE` | `false` | `true` untuk port 465 |
| `SMTP_USER` / `SMTP_PASS` | akun email | Gmail memakai App Password |
| `SMTP_FROM` | `BEM-FT UNAYA` | Nama pengirim |

`DATABASE_URL` (satu baris):

```env
DATABASE_URL="mysql://uXXXXXX_bemft:PASSWORD@localhost:3306/uXXXXXX_bemft?connection_limit=5&pool_timeout=20"
```

Buat dua rahasia:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Jalankan dua kali: satu untuk `JWT_SECRET`, satu untuk `CRON_SECRET`.

Jangan menyalin `JWT_SECRET` lama dari `.env` lokal: dump database lama pernah
bocor, dan token lama harus dianggap tidak sah.

## 7. Migrasi dan impor data

> **Penting:** environment variables yang diisi di hPanel hanya disuntikkan ke
> proses aplikasi, belum tentu tersedia di sesi SSH. Sebelum perintah Prisma,
> pastikan `DATABASE_URL` terbaca. Cara termudah: buat `backend/.env` berisi
> hanya baris `DATABASE_URL=...` lalu `chmod 600 .env` (nilai hPanel tetap
> menang saat aplikasi berjalan). Jangan menempel password ke riwayat shell.

### A. Database baru tanpa data lama

```bash
cd ~/domains/domain-anda.com/app/backend
npx prisma migrate deploy
npm run superadmin     # buat akun SUPERADMIN pertama
```

### B. Membawa data dari dump lokal

Dump di `backups/*.zip` berisi **struktur tabel + data**, bukan tabel
`_prisma_migrations`. Jangan langsung menjalankan `migrate deploy` setelah
impor karena tabelnya sudah ada.

1. Ekstrak ZIP, ambil file `.sql` (sekitar 200 KB).
2. hPanel → **Databases → phpMyAdmin** → pilih database kosong → **Import** →
   unggah `.sql` → **Go**.
   - Jangan impor ke database yang sudah berisi tabel.
   - Batas impor Premium 200 MB; dump ini jauh di bawahnya.
3. Tandai semua migrasi sebagai sudah diterapkan, lalu verifikasi:

```bash
cd ~/domains/domain-anda.com/app/backend
for d in prisma/migrations/*/; do
  npx prisma migrate resolve --applied "$(basename "$d")"
done
npx prisma migrate deploy   # harus "No pending migrations"
```

4. Cocokkan jumlah akun dengan data lokal:

```sql
SELECT COUNT(*) FROM user;
```

Dump 21 Oktober 2026 berisi 377 akun. Kalau angkanya berbeda, hentikan dan
periksa log impor sebelum membuka situs.

### C. Berkas unggahan lama

Salin isi `backend/uploads` dari komputer ke folder `uploads` di server:

```bash
scp -r backend/uploads/* uXXXXXX@HOST:~/domains/domain-anda.com/uploads/
```

Jangan letakkan folder ini di dalam `app/backend`; deploy ulang bisa
menimpanya.

## 8. Nyalakan dan uji

1. hPanel → Node.js → **Restart Application**.
2. Buka **Logs** (Passenger log). Cari baris
   `BEM-FT UNAYA API Server Started` dan pastikan tidak ada error Prisma.
3. Uji berurutan:

```text
GET  https://domain-anda.com/api/health        -> 200 JSON
GET  https://domain-anda.com/                  -> 200 halaman landing
GET  https://domain-anda.com/login             -> 200 form login
GET  https://domain-anda.com/agenda            -> 200 kalender
GET  https://domain-anda.com/api/tidak-ada     -> 404 JSON (bukan HTML)
```

Lalu di browser:

- Login dengan akun nyata, **muat ulang halaman** — sesi harus bertahan.
- Buka dashboard, unggah foto profil, muat ulang, lalu hapus foto.
- Buka satu halaman publik dan cek Console tidak ada error CORS/404 aset.
- Pastikan cookie `token` punya `HttpOnly`, `Secure`, dan `SameSite=Lax`.

Kalau `/login` 404 padahal berkas ada, periksa `SERVE_FRONTEND=1` dan
`frontend/dist/index.html`; jangan menambahkan `.htaccess` rewrite sendiri
kecuali Hostinger Support memintanya.

## 9. Jadwalkan cron

Karena `RUN_STARTUP_JOBS=0`, job tidak berjalan saat aplikasi dibangunkan.
hPanel → **Advanced → Cron Jobs** → buat satu job, **sekali sehari**:

```bash
/usr/bin/curl -fsS -X POST \
  -H "X-Cron-Secret: ISI_CRON_SECRET" \
  https://domain-anda.com/api/internal/cron >/dev/null 2>&1
```

Jadwal: `0 2 * * *` (02:00 setiap hari). Satu kali sehari cukup dan mencegah
email peringatan per mahasiswa terkirim dua kali.

Endpoint ini:

- 401 bila `CRON_SECRET` kosong atau header `X-Cron-Secret` salah,
- menjalankan siklus akun, notifikasi perpanjangan, dan penulisan catatan CORS
  hanya bila secret cocok.

Uji manual tanpa menunggu jadwal:

```bash
curl -i -X POST https://domain-anda.com/api/internal/cron
# harus 401 tanpa header

curl -i -X POST -H "X-Cron-Secret: ISI_CRON_SECRET" \
  https://domain-anda.com/api/internal/cron
# harus 200 {"ok":true,...}
```

Jangan menaruh `CRON_SECRET` di repository atau screenshot.

## 10. SSL, email, dan backup

- **SSL:** hPanel → Security → SSL → pastikan Active dan **Force HTTPS**
  menyala. Tanpa HTTPS, cookie `Secure` tidak dikirim dan login akan gagal.
- **Email:** uji dari server sebelum mengubah kode:
  ```bash
  openssl s_client -starttls smtp -connect smtp.gmail.com:587
  ```
  Hostinger membuka port 465/587 (port 25 diblokir). Bila Gmail menolak,
  gunakan mailbox Hostinger: `smtp.hostinger.com`, port `465`,
  `SMTP_SECURE=true`.
- **Backup:** aktifkan backup Hostinger di hPanel, dan tetap simpan dump
  berkala ke komputer. `scripts/backup-database.bat` hanya untuk MySQL lokal
  Windows; jangan dijalankan di server Hostinger.

## 11. Daftar periksa go-live

- [ ] Repo GitHub sudah privat; riwayat dump sudah dibersihkan.
- [ ] Password 377 akun (prioritaskan admin) sudah direset.
- [ ] `JWT_SECRET` baru; sesi lama dibatalkan
      (`UPDATE user SET sessionVersion = sessionVersion + 1;`).
- [ ] App Password SMTP baru; token GitHub lama dicabut.
- [ ] `api/health`, `/`, `/login`, `/agenda` merespons benar.
- [ ] Login + reload berhasil; cookie `Secure` + `HttpOnly` + `Lax`.
- [ ] Unggah/hapus foto profil berhasil dan berkas ada di `UPLOAD_DIR`.
- [ ] Cron harian berjalan (lihat audit log / email admin).
- [ ] `frontend/dist` dan `backend/dist` tidak di-commit; build dilakukan di server.
- [ ] `.env` tidak dapat diakses lewat `https://domain-anda.com/.env`.

## Troubleshooting

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| 503 / Application could not be started | Startup file salah, `dist` belum dibuild, atau OOM | Baca Passenger log; jalankan build; pilih Node 22; kurangi proses lain |
| `Cannot find module 'express'` | `npm ci` belum jalan / app root salah | Pastikan app root menunjuk folder berisi `package.json` backend |
| `Prisma Client could not locate Query Engine` | `prisma generate` dibuat di OS lain | Jalankan `npx prisma generate` di server, lalu restart |
| `libssl.so` / `GLIBC` error saat Prisma | Target engine tidak cocok | Hapus `node_modules`, install ulang di server, generate ulang |
| sharp: `Could not load the "sharp" module` | Dependensi diinstal di Windows | Hapus `node_modules`, `npm ci` di server Linux |
| 404 di `/login` | SPA tidak disajikan | `SERVE_FRONTEND=1`, build frontend, restart |
| Login berhasil lalu kembali ke login | Cookie tidak terkirim | HTTPS aktif, `TRUST_PROXY=1`, `FRONTEND_URL` sama persis dengan origin |
| Email tidak terkirim | Port/SMTP diblokir atau App Password salah | Uji `openssl s_client`; coba SMTP Hostinger 465 |
| Cron 401 | `CRON_SECRET` kosong atau header tidak sama | Isi variabel, restart, salin ulang nilainya tanpa spasi |

## Catatan keamanan

- Jangan commit `.env`, dump, atau `uploads/`.
- Repo masih publik dan commit lama masih dapat diunduh lewat URL mentah.
  Langkah menutupnya ada di [SECURITY.md](SECURITY.md); lakukan **sebelum**
  membuka situs ke publik.
- `CRON_SECRET` adalah kredensial; perlakukan seperti password.
- Setelah pindah domain, perbarui `FRONTEND_URL` dan link di aplikasi yang
  menyebut domain lama.
