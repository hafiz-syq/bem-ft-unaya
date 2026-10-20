# Deploy Produksi

Susunan yang dipakai panduan ini:

```
Browser
  ├── https://<proyek>.vercel.app      frontend statis (Vite)  → Vercel
  └── https://api.domain-anda.com/api  API Express + uploads   → VM (Oracle Always Free)
                     │
                     └── MySQL terkelola (TLS)                 → Aiven for MySQL Free
```

## Aiven itu database, bukan tempat backend

Aiven menjual **layanan data terkelola** (MySQL, PostgreSQL, Kafka, Redis, dst.). Aiven
tidak menjalankan kode Node.js/Express, tidak menyimpan folder `uploads`, dan tidak
menjalankan job terjadwal aplikasi. Jadi rencana "frontend ke Vercel, backend ke Aiven"
perlu satu bagian lagi: **host untuk proses API**. Aiven tetap dipakai untuk databasenya.

Aplikasi ini juga tidak cocok dijadikan serverless function (Vercel Functions): ia menulis
berkas unggahan ke disk, menjalankan job siklus hidup akun dan notifikasi harian lewat
`setInterval`, dan memakai koneksi MySQL persisten. Karena itu `vercel.json` di repo ini
kini hanya membangun frontend.

## Pilihan host backend (per Oktober 2026)

| Host | Gratis? | Proses 24/7 | Disk untuk `uploads` | Catatan |
| --- | --- | --- | --- | --- |
| **Oracle Cloud Always Free** | Ya | Ya | **200 GB volume** | VM yang harus dirawat sendiri; resource bisa direbut bila idle 7 hari |
| Render Free | Ya | Tidak (tidur 15 menit) | Tidak (ephemeral) | Paling mudah, tetapi foto hilang setiap deploy/restart |
| Koyeb Free | Ya | Tidak (scale to zero 1 jam) | Tidak | 512 MB RAM, tanpa volume |
| Railway Free | Kredit US$1/bulan | Bisa | 0,5 GB | Kredit cepat habis untuk service selalu hidup |
| Fly.io | Tidak (trial) | Ya | Volume US$0,15/GB/bulan | Mesin terkecil ±US$2,19/bulan |

**Rekomendasi gratis yang benar: Oracle Cloud Always Free** untuk API, karena hanya host
gratis yang memberi disk persisten + proses 24/7 tanpa mengubah kode. Kalau tidak mau
mengurus VM, Render Free boleh dipakai untuk demo — dengan konsekuensi berkas unggahan
hilang dan API tidur (permintaan pertama bisa lambat ±1 menit).

## 1. Siapkan MySQL di Aiven

1. Daftar di <https://aiven.io> (tidak perlu kartu kredit), buat service **MySQL** dengan
   plan **Free**, region terdekat (Singapore). Satu organisasi hanya boleh punya satu
   service gratis per jenis.
2. Di tab **Databases**, buat database bernama `bem_ft_unaya` (jangan memakai `defaultdb`).
3. Unduh **CA certificate** dari halaman service, simpan di server sebagai
   `/etc/bem-ft/aiven-ca.pem` (sertifikat publik, bukan rahasia).
4. Susun `DATABASE_URL` (satu baris, dibungkus tanda kutip di `.env`):

   ```env
   DATABASE_URL="mysql://avnadmin:PASSWORD@HOST:PORT/bem_ft_unaya?sslcert=/etc/bem-ft/aiven-ca.pem&sslaccept=strict&connection_limit=5&pool_timeout=20"
   ```

   `sslaccept=strict` + `sslcert` adalah cara Prisma 5 memverifikasi sertifikat MySQL.
   Bila URI dari konsol Aiven memuat `?ssl-mode=REQUIRED`, **buang parameter itu** untuk
   Prisma dan ganti dengan `sslaccept`/`sslcert` di atas.

   Paket gratis dibatasi **1 CPU, 1 GB RAM, 1 GB disk, 76 koneksi**, sudah termasuk backup,
   dan layanan bisa dimatikan Aiven bila lama tidak ada aktivitas (ada notifikasi lebih
   dulu; bisa dinyalakan lagi).

5. Jalankan migrasi dari folder `backend` (butuh akses jaringan ke Aiven):

   ```bash
   DATABASE_URL="mysql://..." npx prisma migrate deploy
   ```

6. Pindahkan data dari MySQL lokal. Urutannya **migrasi dulu, baru data**, dan jangan
   menyalin tabel `_prisma_migrations`:

   ```bash
   mysqldump -u root --single-transaction --no-create-info \
     --ignore-table=bem_ft_unaya._prisma_migrations \
     --default-character-set=utf8mb4 bem_ft_unaya > data.sql

   mysql --ssl-mode=VERIFY_CA --ssl-ca=/etc/bem-ft/aiven-ca.pem \
     -h HOST -P PORT -u avnadmin -p bem_ft_unaya < data.sql
   ```

   Berkas unggahan lama (kalau ada) tidak ikut: salin isi `backend/uploads/` ke
   `UPLOAD_DIR` di server dengan `scp`.

## 2. Jalankan API di VM

Contoh Ubuntu 22.04/24.04 di Oracle Cloud (Ampere A1, Always Free). Buka port 22, 80, 443
di Security List Oracle **dan** firewall OS.

```bash
sudo apt update && sudo apt install -y git curl caddy
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo mkdir -p /opt/bem-ft-unaya
sudo chown "$USER":"$USER" /opt/bem-ft-unaya
git clone <URL-REPO> /opt/bem-ft-unaya
cd /opt/bem-ft-unaya/backend
npm ci
npx prisma generate
npm run build
```

Siapkan folder unggahan persisten dan berkas environment:

```bash
sudo mkdir -p /var/lib/bem-ft/uploads /etc/bem-ft
sudo chown -R $USER:$USER /var/lib/bem-ft/uploads
cp .env.example .env && nano .env
chmod 600 .env
```

Isi `.env` produksi (contoh):

```env
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
UPLOAD_DIR=/var/lib/bem-ft/uploads
FRONTEND_URL=https://<proyek>.vercel.app
# Hanya perlu bila frontend dan API berbeda situs (lihat bagian 4):
COOKIE_SAME_SITE=none
DATABASE_URL="mysql://..."
JWT_SECRET=<teks-acak-panjang>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=BEM-FT UNAYA
```

Jalankan dengan PM2 (konfigurasi ada di [`deploy/ecosystem.config.cjs`](deploy/ecosystem.config.cjs)):

```bash
sudo npm install -g pm2
pm2 start /opt/bem-ft-unaya/deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # jalankan perintah yang dicetak agar hidup lagi setelah reboot
```

Pasang HTTPS dengan Caddy ([`deploy/Caddyfile`](deploy/Caddyfile)):

```bash
sudo cp /opt/bem-ft-unaya/deploy/Caddyfile /etc/caddy/Caddyfile   # ganti domainnya dulu
sudo systemctl reload caddy
curl https://api.domain-anda.com/api/health
```

Arahkan DNS `A api.domain-anda.com` ke IP publik VM. Caddy meneruskan
`X-Forwarded-Proto`, jadi cookie tetap ditandai `Secure` di belakang proxy.

## 3. Deploy frontend ke Vercel

1. Import repo di Vercel. **Root Directory biarkan kosong** — [`vercel.json`](vercel.json)
   sudah mengatur install/build/output dari root repo (`frontend/dist`).
2. Tambahkan Environment Variable **Production**: `VITE_API_URL=https://api.domain-anda.com/api`
   (harus berakhir `/api`; nilainya ikut dipanggang saat build, jadi set sebelum deploy
   dan redeploy setelah mengubahnya).
3. Deploy, lalu buka `/login` dan halaman lain langsung (mis. `/agenda`) untuk memastikan
   fallback SPA bekerja.

## 4. Menyatukan frontend dan API

- `FRONTEND_URL` di backend harus **persis** origin frontend (`https://...`, tanpa garis
  miring di akhir). Beberapa origin dipisah koma atau lewat `FRONTEND_URLS`.
- Cookie sesi:
  - Frontend `app.domain.com` + API `api.domain.com` → masih **satu situs**, biarkan
    `COOKIE_SAME_SITE=lax` (lebih aman terhadap CSRF).
  - Frontend `*.vercel.app` + API domain lain → **beda situs**, wajib
    `COOKIE_SAME_SITE=none`; tanpa itu browser tidak mengirim cookie dan login seolah
    berhasil tetapi langsung kembali ke halaman login.
- Setelah mengubah `.env`, jalankan `pm2 restart bem-ft-api`.

### Daftar periksa setelah deploy

- [ ] `GET https://api.../api/health` → 200
- [ ] Login, lalu **muat ulang halaman** — sesi harus bertahan
- [ ] Unggah foto profil, muat ulang, lalu hapus foto
- [ ] Buka dashboard dan satu halaman publik; tidak ada error CORS di console
- [ ] Berkas unggahan muncul di `UPLOAD_DIR` dan tetap ada setelah `pm2 restart`
- [ ] `pm2 logs bem-ft-api` bersih dari galat koneksi database

## Alternatif tanpa VM

Kalau memilih **Render Free** (atau Koyeb Free), dua hal ini wajib diselesaikan lebih
dulu karena bukan sekadar soal harga:

1. **Upload hilang.** Keduanya memakai filesystem sementara. Pindahkan penyimpanan ke
   object storage (Cloudflare R2 punya 10 GB gratis) atau terima bahwa foto profil/cover
   CMS hilang setiap deploy dan restart.
2. **Proses tidur.** API berhenti setelah idle, sehingga job siklus hidup akun dan
   notifikasi hanya berjalan saat ada trafik. Untuk portal kecil ini biasanya dapat
   diterima; jangan mengandalkannya untuk pengingat tepat waktu.

Pakai **Render** dengan setelan:

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Environment: sama seperti `.env` di atas (`UPLOAD_DIR` dihilangkan bila tanpa volume)
- Jalankan `npx prisma migrate deploy` sekali dari mesin lokal yang bisa mengakses Aiven.

Aiven tetap dipakai di semua opsi; yang berubah hanya tempat menjalankan API.

## Catatan keamanan

- Jangan commit `.env`, `aiven-ca.pem` boleh disimpan di server (publik), tetapi kredensial
  Aiven dan `JWT_SECRET` tidak.
- `COOKIE_SAME_SITE=none` mempermudah CSRF karena cookie ikut dikirim lintas situs. Lebih
  baik memakai domain sendiri (`app.` dan `api.` di domain yang sama) agar tetap `lax`.
- Vercel Hobby gratis untuk proyek non-komersial; portal organisasi kampus umumnya masuk,
  tetapi pastikan tidak dipakai untuk transaksi komersial.
- Backup database tetap rutin: `scripts/backup-database.bat` hanya untuk MySQL lokal;
  untuk Aiven gunakan fitur backup/`mysqldump` terjadwal ke object storage.
