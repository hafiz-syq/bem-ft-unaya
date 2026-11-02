# Deploy Produksi: Vercel + Aiven + Cloudinary

Arsitektur produksi saat ini (menggantikan rencana lama satu-paket Hostinger —
panduan Hostinger masih bisa dibaca pada riwayat git jika perlu):

```
Frontend (Vercel, project "frontend", Vite + React)
        │  VITE_API_URL=https://<nama>-backend.vercel.app/api
        ▼
Backend Express/Prisma (Vercel, project "backend", root folder backend/)
        │  DATABASE_URL → Aiven MySQL (TLS penuh, CA proyek)
        │  CLOUDINARY_* → Cloudinary (foto profil, galeri, lampiran, dokumen)
        ▼
Aiven MySQL "defaultdb" + Cloudinary
```

Catatan arsitektur ini penting:

- **Frontend dan backend adalah dua project Vercel terpisah**, sehingga
  frontend memanggil API lintas-situs → cookie sesi wajib
  `COOKIE_SAME_SITE=none` (lihat §4).
- **Filesystem serverless Vercel bersifat sementara.** Semua berkas yang
  digunakan lintasa permintaan (foto profil, galeri, cover, lampiran tiket,
  arsip dokumen) disimpan ke Cloudinary; database hanya menyimpan URL-nya.
  Berkas `/uploads/...` di disk hanya ada pada pengembangan lokal.
- Semua rute backend diarahkan `vercel.json` → `api/index.js` (CommonJS yang
  mengekspor app Express dari `dist/app.js`).

## 1. Database Aiven

1. Buat layanan MySQL di Aiven (free plan melebihi kebutuhan awal), catat
   Service URI. Password harus di-URL-encode saat dipakai manual (`@`→`%40`).
2. Simpan URI di pengelola sandi, bukan di repo.
3. Jalankan migrasi dari mesin pribadi (CA Aiven sudah tersedia):
   isi `DATABASE_URL` di `backend/.env` — runtime menambahkan CA otomatis
   (host `*.aivencloud`), dan untuk Prisma CLI tambahkan
   `&sslcert=backend/prisma/aiven-ca.pem`:

```bash
cd backend
npx prisma migrate deploy    # sampai "Database schema is up to date!"
```

Verifikasi `npx prisma migrate status` lalu jalankan seed/superadmin bila
database masih kosong (`npm run seed`, `npm run superadmin`).

Sisipkan parameter pool ke `DATABASE_URL` untuk Vercel:
`?connection_limit=4&pool_timeout=20` — melakukan serving paras serverless
dengan banyak instance tanpa meledak hits nilai `max_connections` Aiven.

## 2. Project backend di Vercel

New Project → Import repo → **Root Directory: `backend`**, Framework: Other.
Config build diambil dari `backend/vercel.json`:

- Build: `npm ci --include=dev && npx prisma generate && npm run build`
- Semua route via `rewrites` jusqu'à `api/index.js`.
- Cron harian: `/api/internal/cron/ISI_CRON_SECRET` pukul `21:00 UTC`
  (≈ 04:00 WIB). **Ganti `ISI_CRON_SECRET` di baris `"crons"` dengan nilai
  `CRON_SECRET` yang sebenarnya** — Vercel Cron tidak dapat menyetel header
  kustom, sehingga secret dibawa lewat segmen path (`/api/internal/cron/<SECRET>`).

Environment Variables (dashboard → Settings → Environment Variables, target
Production + Preview):

| Variabel | Isi |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://...aivencloud.../defaultdb?connection_limit=4&pool_timeout=20` |
| `JWT_SECRET` | teks acak 32–64 karakter (**beda** dengan lokal) |
| `CRON_SECRET` | teks acak 64 karakter; harus sama dengan yang dipakai di `vercel.json` |
| `FRONTEND_URLS` | `https://<nama>-frontend.vercel.app,https://www.domain-utama` (list, dipisah koma) |
| `COOKIE_SAME_SITE` | `none` (wajib bila frontend & API domain berbeda) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | dari dashboard Cloudinary |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | App Password khusus produksi |
| `ALERT_EMAIL` | penerima email peringatan backup/galat |
| `ADMIN_EMAIL` | penerima laporan admin |
| `VAPID_*` (opsional) | kosong = server membuat & menyimpan kunci di tabel SiteSetting |

TRUST_PROXY tidak perlu diisi: kode otomatis memercayai proxy saat `VERCEL`
terdeteksi. `uploads` tidak perlu `UPLOAD_DIR` di Vercel (semuanya Cloudinary).

### Batas yang perlu diperhatikan

- **Body maksimum Vercel 4,5 MB.** Lapisan Vercel menolak permintaan lebih
  besar sebelum masuk Express; karena itu batas unggahan efektif di produksi
  = 4,5 MB walaupun kode membolehkan 5–10 MB (import PDF/dokumen).
- `maxDuration` function disetel 20 detik di vercel.json; ekspor Excel besar
  dan analisis PDF tetap diukur di deployment nyata — naikkan bila perlu
  (paket berbayar membatasi nilai maksimum lebih tinggi).

## 3. Project frontend di Vercel

New Project → repo yang sama → **Root Directory: `frontend`**, Framework: Vite.
Frontend punya `frontend/vercel.json` (SPA fallback) dan tidak perlu build
khusus. Supply satu Environment Variable:

```
VITE_API_URL=https://<nama>-backend.vercel.app/api
```

`frontend/.env.production` masih memuat `VITE_API_URL=/api` untuk scenario
satu-domain lokal; environment variable Vercel menimpanya.

## 4. Rantai cookie, CORS, dan domain (wajib rapi)

Bila frontend & API **domain berbeda** (situasi baku dua project Vercel):

1. `COOKIE_SAME_SITE=none` di backend → cookie `SameSite=None; Secure`
   sehingga browser mengiriminya pada permintaan lintas situs.
2. `FRONTEND_URLS` di backend memuat origin frontend persis termasuk port &
   tanpa garis miring di akhir — origin lain diblok CORS (dan penolakannya
   dicatat pada audit log).
3. Gunakan domain utama di kedua project bila sudah punya (Fair, seperti
   `app.domain.com` & `api.domain.com`); catatan: cookie tetap butuh
   `COOKIE_SAME_SITE=none` karena subdomain berbeda itu *situs berbeda*.
4. Setiap perubahan domain → daftar `FRONTEND_URLS` harus diperbarui.

## 5. Verifikasi pasca deploy

- `GET https://<backend>.vercel.app/api/health` → JSON `status: OK`.
- Login dari frontend: cookie `token` muncul dengan `SameSite=None; Secure`;
  refresh halaman — sesi tidak putus (“pengguna tak berjengkel halaman login”).
- Unggah foto profil, galeri, lampiran tiket → URL `res.cloudinary.com`
  tersimpan; muat ulang halaman setelah instance dingin — berkas tetap ada.
- Arsip dokumen (DOCX/XLSX) diunggah dan diunduh kembali dengan nama asli.
- Lihat logs Vercel: tidak ada `P1011/P1012` (DB), tidak ada galat
  Cloudinary 401 (env Cloudinary).
- Tunggu cron harian (atau cek log `POST /api/internal/cron/...`) — harus
  mengembalikan angka dan tidak boleh 401.

## 6. Backup (tetap berjalan di mesin pribadi)

Backup harian Aiven diatur di `README.md` bagian *Backup & Pemulihan
Database* lewat `scripts/backup-database.bat` + `scripts/dump-aiven.ps1`
(Task Scheduler jam 03:00 lokal). Karena job ini berjalan di PC, pastikan PC
menyala minimal sesekali, atau pindahkan ke Vercel Cron + endpoint internal,
GitHub Actions, dipikirkan bila PC tidak lagi andal.

## 7. Daftar periksa keberangkatan (go-live)

- [ ] Repo sudah privat (lihat SECURITY.md) — riwayat publik lama tetap
      memuat rahasia lama bila ada; rotasi kredensial yang sempat terlewat.
- [ ] JWT_SECRET & CRON_SECRET produksi kuat & tak dipakai lintas lingkungan.
- [ ] `FRONTEND_URLS` hanya origin sah; `/uploads` tidak lagi menulis disk.
- [ ] Superadmin produksi tidak memakai password seed.
- [ ] Email SMTP dengan App Password, bukan password utama.
