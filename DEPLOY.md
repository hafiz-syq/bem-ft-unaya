# Deploy Produksi: Vercel (Services) + Aiven + Cloudinary

Arsitektur produksi aktif: **satu project Vercel dengan Vercel Services** —
frontend Vite dan backend Express dibangun bersama dalam satu deployment,
dengan satu domain. Database di Aiven MySQL, berkas yang harus hidup lintas
permintaan disimpan Cloudinary. (Panduan lama satu-paket Hostinger masih bisa
dibaca pada riwayat git bila perlu.)

```
https://<project>.vercel.app  /  domain sendiri
  ├── /               → service "frontend" (Vite + React, frontend/)
  ├── /api/*          → service "backend"  (Express + Prisma, backend/)
  └── /uploads/*      → service "backend"  (berkas lama; unggahan baru → Cloudinary)
```

Semuanya dideklarasikan di `vercel.json` root (`services` + `rewrites`).
Error `[MISSING_SERVICES]` berarti berkas itu hilang/ilegal saat framework
project sudah "services" — jangan menghapusnya.

## 1. Database Aiven

1. Buat layanan MySQL di Aiven, catat Service URI (password di-URL-encode:
   `@` → `%40`). Simpan di pengelola sandi, bukan di repo.
2. Jalankan migrasi dari mesin pribadi (CA Aiven sudah di repo, berkas
   `backend/prisma/aiven-ca.pem` diperlukan untuk Prisma CLI):

```bash
cd backend
npx prisma migrate deploy    # sampai "Database schema is up to date!"
npx prisma migrate status    # verifikasi
```

Runtime Prisma di Vercel menambahkan CA Aiven otomatis untuk host
`*.aivencloud.com` (lihat `backend/src/lib/prisma.ts`), jadi `DATABASE_URL`
untuk Vercel cukup:

```
mysql://<user>:<PASSWORD>@<host>:<port>/defaultdb?connection_limit=4&pool_timeout=20
```

`connection_limit` kecil itu penting: tiap instance serverless membuka pool
sendiri; tanpa pembatasan, traffic meledak `max_connections` plan Aiven.

## 2. Project Vercel (satu project, framework Services)

New Project → Import repo → **Root Directory: root repo** (kosong), biarkan
Vercel membaca `vercel.json`. Isi Environment Variables (Production + Preview):

| Variabel | Isi |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URI Aiven + `?connection_limit=4&pool_timeout=20` |
| `JWT_SECRET` | teks acak 32–64 karakter (**beda** dengan lokal) |
| `CRON_SECRET` | teks acak 64 karakter; sama dengan yang dipakai di `vercel.json` |
| `FRONTEND_URLS` | `https://domain-utama,https://www.domain-utama` (opsional di mode satu-origin) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | dari dashboard Cloudinary |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | App Password khusus produksi |
| `ALERT_EMAIL` | penerima email peringatan backup/galat |
| `ADMIN_EMAIL` | penerima laporan admin |
| `VAPID_*` (opsional) | kosong = server membuat & menyimpan kunci di tabel SiteSetting |

Tidak perlu `TRUST_PROXY` (otomatis saat `VERCEL` terdeteksi), tidak perlu
`VITE_API_URL` (frontend sudah memakai `/api`, satu origin dengan API), dan
tidak perlu `COOKIE_SAME_SITE=none` (one origin → cookie `lax` default aman).

### Cron harian

`vercel.json` root memuat `"crons"` yang memanggil
`/api/internal/cron/ISI_CRON_SECRET` pukul `21:00 UTC` (≈ 04:00 WIB) —
**ganti `ISI_CRON_SECRET` dengan nilai `CRON_SECRET` asli** di baris itu.
Vercel Cron tidak bisa mengirim header kustom, karena itu secret dibawa lewat
segmen path (didukung rute cron). Job berisi: siklus akun (nonaktif 5 tahun,
hapus 1 tahun), notifikasi perpanjangan bendahara, flush catatan CORS, purge
trash mahasiswa, dan pengingat laporan bulanan.

### Batas yang perlu diperhatikan

- **Body maksimum Vercel 4,5 MB** — ditolak oleh platform sebelum masuk
  Express. Lampiran 5 MB / impor PDF 10 MB bisa gagal 413 di produksi;
  anggap batas efektif 4,5 MB.
- `maxDuration` service 20 detik (di `backend/vercel.json`, dipakai bila
  project dibangun terpisah); ekspor Excel besar & analisis PDF diukur di
  deployment nyata.

## 3. Alternatif: dua project terpisah

Bila suatu saat backend dan frontend perlu deploy/rollback terpisah:

1. Project backend: Root Directory `backend`. Berkas `backend/vercel.json`
   sengaja dihapus karena di mode services default ia justru mengganggu
   (rewrites service-local yang menurut perintah ke fungsi yang tidak pernah
   dibuat → `FUNCTION_INVOCATION_FAILED`). Bila benar-benar memakai mode ini,
   tambahkan vercel.json di project backend berisi: build
   `npm ci --include=dev && npx prisma generate && npm run build`, upelan
   `rewrites` `/(.*)` → `/api/index` (masuk `backend/api/index.js`), serta
   `functions` (maxDuration & `includeFiles` engine Prisma) — apt hanya pada
   project backend yang berdiri sendiri.
2. Project frontend: Root Directory `frontend`; Environment Variable
   `VITE_API_URL=https://<backend>.vercel.app/api`.
3. Backend di project terpisah: `FRONTEND_URLS` wajib memuat origin frontend,
   dan **wajib** `COOKIE_SAME_SITE=none` (frontend & API jadi situs berbeda;
   cookie `lax` tidak terkirim lintas situs → pengguna macet di halaman login).

## 4. Rantai cookie & CORS

- Mode satu project (aktif): frontend dan API satu origin → sesi cookie
  `SameSite=Lax` bekerja tanpa penyetelan tambahan. Isi `FRONTEND_URLS`
  tetap disarankan (origin lain tetap diblok dan dicatat di audit log).
- Mode dua project: lihat item 3 di atas — pengaturan meleset di sini adalah
  penyebab klasik "login macet di halaman login".

## 5. Verifikasi pasca deploy

- `GET /api/health` (di domain yang sama) → JSON `status: OK`.
- Login dari frontend → cookie `token` (httpOnly) muncul; refresh halaman,
  sesi tidak putus.
- Akun mahasiswa baru (`first_login: true`, password awal = NIM) otomatis
  diarahkan ke halaman *Pengaturan pertama*; sampai password diganti, seluruh
  endpoint lain menolak 403 `FIRST_LOGIN` (by design, lihat auth middleware).
- Unggah foto profil / galeri / lampiran tiket → URL `res.cloudinary.com`
  tersimpan, dan berkinya tetap hidup setelah instance dingin.
- Log Vercel: tidak ada P1011/P1012 (DB), tidak ada galat Cloudinary 401.

## 6. Backup (berjalan di mesin pribadi)

Backup harian Aiven diatur di README bagian *Backup & Pemulihan Database*
lewat `scripts/backup-database.bat` + `scripts/dump-aiven.ps1` (Task
Scheduler jam 03:00 lokal; dump TLS dengan CA proyek). Job ini menuntut PC
menyala; bila PC tidak lagi andal, pindahkan ke Vercel Cron + endpoint
internal atau GitHub Actions.

## 7. Daftar periksa go-live

- [ ] Repo sudah privat (SECURITY.md); rotasi kredensial yang sempat bocor.
- [ ] `JWT_SECRET` & `CRON_SECRET` produksi kuat dan berbeda dari lokal.
- [ ] `ISI_CRON_SECRET` di `vercel.json` sudah diganti nilai sebenarnya.
- [ ] Superadmin produksi tidak memakai password seed; SMTP pakai App Password.
- [ ] Uji unggahan lampiran (magic bytes kini diverifikasi server).
