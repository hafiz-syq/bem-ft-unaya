# Insiden: Dump Database di Riwayat Git

## Ringkasan

Repo ini sempat **publik** di GitHub dan riwayat commit-nya memuat:

- `backups/bem_ft_unaya_*.sql` — dump database berisi 377 akun: NIM, nama, email,
  no. HP, hash password bcrypt, status verifikasi, dan ID perangkat.
- `backend/uploads/TICKET-*.jpeg|png|jpg` — lampiran tiket milik pengguna.
- `backups/backup.log` — path berkas backup.

Commit yang memuatnya: `36476d1` dan `b0caa64`. `.env`, kredensial database, dan
`JWT_SECRET` **tidak** pernah masuk repo, jadi kunci aplikasi tidak bocor lewat dump.

Riwayat lokal sudah dibersihkan dan sudah di-force-push ke `main` pada 21 Okt 2026.
Clone baru tidak lagi memuat berkas tersebut. **Tetapi force-push saja tidak menutup
eksposur:** URL mentah pada commit lama (`b05c716`) masih merespons 200 saat diperiksa,
dan repo masih publik. Artinya siapa pun yang tahu SHA lama masih bisa mengunduh dump.
Satu-satunya penutup langsung adalah **menjadikan repo privat**; setelah itu minta GitHub
membersihkan objek tak terjangkau/cache commit lama.

## 1. Tindakan segera

1. **Jadikan repo privat.** GitHub → repository → **Settings** → **General** →
   **Danger Zone** → **Change repository visibility** → **Make private**.
2. **Bersihkan riwayat di remote** (lihat bagian 3). Force-push wajib; tanpa itu
   GitHub masih menyimpan dump pada commit lama.
3. **Minta GitHub membersihkan cache.** Setelah force-push, commit lama masih bisa
   dibuka lewat SHA/cache untuk sementara. Hubungi GitHub Support dan minta
   *purge cached views / unreachable objects* untuk repo ini. Repo yang di-fork
   atau sudah di-clone orang lain tetap menyimpan salinannya.
4. **Anggap data pribadi sudah terekspos**: beri tahu pengurus/pengguna bahwa NIM,
   email, no. HP, dan lampiran tiket lama mungkin terlihat pihak lain.

## 2. Rotasi kredensial

| Kredensial | Tindakan | Alasan |
| --- | --- | --- |
| Password 377 akun | Wajibkan reset; prioritaskan ADMIN/SUPERADMIN | Hash bcrypt ikut bocor; password lemah bisa dipecahkan |
| Sesi login | Ganti `JWT_SECRET`, restart API | Membatalkan seluruh cookie yang mungkin sudah dicuri |
| `JWT_SECRET` | Buat nilai acak baru (minimal 48 byte) | Kunci lama harus dianggap tidak layak |
| SMTP (Gmail App Password) | Cabut lalu buat App Password baru | Berada di `.env`, tetapi rotasi murah dan aman |
| Token GitHub / kredensial push | Cabut token lama, buat baru dengan cakupan minimal | Token bisa tersimpan di mesin lain |
| MySQL lokal (root) | Ganti password, jangan pakai ulang di Hostinger | Dump membuka struktur & data, bukan credential, tetap higienis |
| MySQL Hostinger | Buat user/password baru saat provisioning | Jangan pakai password lama dari mesin lokal |
| `CRON_SECRET` Hostinger | Buat nilai acak baru | Kunci endpoint `/api/internal/cron` |
| Variabel Vercel (lama) | Periksa dan rotasi yang sensitif | `DATABASE_URL`, `JWT_SECRET`, `SMTP_PASS` ada di proyek lama |
| Variabel Hostinger | Isi ulang dengan nilai baru | Jangan menyalin `JWT_SECRET` lama |

Perintah membatalkan semua sesi (setelah `JWT_SECRET` diganti):

```sql
UPDATE `user` SET `sessionVersion` = `sessionVersion` + 1;
```

Reset password SUPERADMIN (interaktif, dari folder `backend`):

```bash
npm run superadmin
```

Untuk 377 akun, jalur paling praktis: umumkan reset password massal, lalu gunakan
fitur **Lupa Password** (email) atau reset oleh admin. Jangan mengosongkan
`password_hash`; akun akan tidak bisa login sama sekali.

## 3. Membersihkan riwayat dan push ulang

Backup lengkap riwayat lama dibuat sebelum penulisan ulang:

```
D:\Coding Apis\bem-ft-unaya-backup-<tanggal>.bundle
```

Pulihkan bila perlu: `git clone <file>.bundle repo-lama`.

Setelah riwayat lokal bersih (sudah dilakukan), kirim ke GitHub:

```bash
git push --force-with-lease origin main
```

Lalu verifikasi bahwa berkas sensitif benar-benar hilang dari semua commit:

```bash
git log --all --name-only --pretty=format: | sort -u | grep -E '^backups/|^backend/uploads/'
# harus tidak menghasilkan apa pun

git rev-list --objects --all | grep -E 'backups/|backend/uploads/'
# harus tidak menghasilkan apa pun
```

Mitra yang masih memegang clone lama harus **menghapus clone itu dan clone ulang**;
`git pull` biasa akan mengembalikan commit lama.

## 4. Pencegahan

- `backups/` dan `backend/uploads/` sudah masuk `.gitignore`. Simpan dump di luar
  repo (disk eksternal/object storage) dan enkripsi bila memuat data pribadi.
- Aktifkan **Secret scanning** dan **Push protection** di GitHub.
- Jangan pernah `git add -A` tanpa memeriksa `git status`; periksa juga
  `git diff --cached --stat` sebelum commit.
- Untuk repo publik, perlakukan setiap commit sebagai publikasi permanen: riwayat
  tetap bisa dibaca meski berkasnya dihapus di commit berikutnya.
- Jalankan `git log --all --name-only --pretty=format: | sort -u` secara berkala
  untuk mencari `.env`, dump, atau unggahan yang tidak sengaja masuk.
- **Secret scanning GitHub tidak ikut pindah saat repo jadi privat.** GitHub
  menyediakan pemindaian rahasia gratis untuk repo publik saja; untuk repo privat
  ia termasuk GitHub Advanced Security (berbayar). Karena §1 menyuruh repo
  dibuat privat, poin itu tidak bisa lagi diandalkan — penutupnya adalah job
  `keamanan` di bawah.

## 5. Yang dijaga otomatis (job `keamanan`)

Sejak 14 Nov 2026 langkah §4 tidak lagi bergantung pada ingatan manusia.
`.github/workflows/uji-akses.yml` punya job `keamanan` yang berjalan pada setiap
push dan pull request.

| Gerbang | Isi | Hasil pada hari pertama |
| --- | --- | --- |
| Tripwire data pengguna | `backups/`, `backend/uploads/`, `*.sql` di luar `backend/prisma/migrations*`, dan berkas kunci penanda tangan (`*.keystore|jks|p12|pfx`) tidak boleh muncul dalam diff | hijau — dan `backups/` terukur 0 cocok di seluruh riwayat, jadi pembersihan §3 terbukti |
| Tripwire env | yang boleh terlacak hanya `.env.example` dan `frontend/.env.production`, dan isinya wajib kunci `VITE_*` | hijau |
| Gitleaks | menyapu seluruh riwayat dari kunci yang bocor | hijau — 7 pola (private key, hash bcrypt, connection string mengandung password, `JWT_SECRET`, `CLOUDINARY_API_SECRET`, `VAPID_PRIVATE_KEY`, app password Gmail) 0 cocok |
| `npm audit` | memblokir high/critical produksi; moderate hanya dilaporkan | hijau — 2 moderate tersisa: `uuid<11.1.1` lewat `exceljs` (GHSA-w5hq-g745-h8pq) |
| Tripwire header | `vercel.json` masih mendeklarasikan header keamanan frontend | hijau |

Tripwire data sengaja memeriksa **rentang yang dikirim**, bukan seluruh riwayat:
riwayat lama sudah dibersihkan, dan gate yang merah selamanya hanya akan
dimatikan orang.

Kelas kunci penanda tangan ikut dijaga meski `android/.gitignore` sudah memuat
`*.keystore`: ignore menahan `git add -A`, bukan `git add -f`. Terukur 15 Nov
2026, `android/bem-ft-unaya.keystore` ada di disk, tidak terlacak, dan 0 cocok di
seluruh riwayat — jadi kunci APK belum pernah bocor dan tidak perlu dirotasi.

### Dependabot

`.github/dependabot.yml` membuka PR kecil setiap minggu (±02:00 WIB) untuk npm
`backend`, npm `frontend`, gradle `android`, dan `github-actions`. Cara
mengaktifkannya cukup mengirim berkas itu — tidak ada tombol yang harus ditekan,
dan Dependabot versi pembaruan tidak bergantung pada visibilitas repo atau plan
berbayar
([Configuring Dependabot version updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates),
diakses 15 Nov 2026).

Ini yang membedakan job `keamanan` dari §4: gerbang di atas dan Dependabot
tetap bekerja setelah repo jadi privat, sedangkan pemindai rahasia GitHub
tidak.

## 6. Header keamanan pada origin publik

Terukur 14 Nov 2026 pada `https://bem-ft-unaya.vercel.app`:

- `GET /api/health` sudah lengkap karena helmet — `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, COOP, CORP,
  HSTS.
- `GET /` — HTML portal — tidak membawa satu pun dari itu. Yang tiba hanyalah
  `Strict-Transport-Security` milik platform Vercel. Halaman yang bisa
  di-iframe siapa pun adalah celah clickjacking, jadi keempat header sekarang
  dideklarasikan di `services.frontend.headers` pada `vercel.json`. Letaknya di
  dalam service (bukan level atas) supaya tidak dobel dengan helmet pada `/api`.

Verifikasi setelah deploy — header ini hanya bisa dibuktikan dari respons nyata:

```bash
curl -sSI https://bem-ft-unaya.vercel.app/ | grep -iE "x-frame|x-content|referrer|permissions"
```

### CSP sengaja belum dipasang

Ada dua alasan, dan keduanya hasil pengukuran, bukan kebiasaan:

1. **Report-Only tanpa `report-to` tidak melakukan apa pun.** MDN (diakses
   14 Nov 2026): direktif `report-to` "must be specified for reports to be sent:
   if not, the operation won't have any effect". Memasang header tanpa endpoint
   pelaporan hanya menambah rasa aman palsu, jadi tidak dipasang. Gerbang header
   di atas sudah menolak CSP yang ditambahkan tanpa `report-to`.
2. **Mode memaksa akan langsung memecah portal.** `frontend/index.html` memuat
   dua skrip inline — pemuat Google Tag (baris 18–44) dan anti-kilatan tema
   gelap (baris 82–105) — dan hasil `vite build` menambah satu lagi. Tanpa
   `unsafe-inline` ketiganya ditolak: analytics mati dan tema berkedip.

Jalur upgrade yang dipilih, berurutan:

1. Pindahkan kedua skrip inline `index.html` ke berkas sendiri
   (`/src/bootstrap-tema.ts` dan `/src/bootstrap-gtag.ts`) sehingga tidak ada
   lagi `<script>` inline di HTML. Ini satu-satunya langkah yang tidak butuh
   infrastruktur baru.
2. Pasang `Content-Security-Policy` mode memaksa dengan `script-src 'self'
   https://www.googletagmanager.com https://va.vercel-scripts.com`,
   `img-src 'self' blob: data: https://res.cloudinary.com`, `worker-src 'self'`,
   `manifest-src 'self'`, `form-action 'self'`, `base-uri 'self'`,
   `frame-ancestors 'self'`, `object-src 'none'`.
3. `build.cspNonce` Vite **bukan** jalannya di sini: komentar tipe-nya (Vite
   8.3.4) sendiri mewajibkan nilai itu "replaced with a unique value for each
   request by the server", sementara frontend ini disajikan statis oleh Vercel.
   Kalau nanti butuh nonce sungguhan, itu berarti Routing Middleware Vercel —
   keputusan terpisah, bukan penghapusan tiga baris.
4. Uji di deployment preview sebelum produksi: portal ini dipakai 377 akun,
   dan CSP yang salah tulis membuat halaman putih, bukan pesan galat yang jelas.

