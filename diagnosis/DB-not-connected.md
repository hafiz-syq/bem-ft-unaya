# Koneksi Database — Status Saat Ini

**TANGGAL**: 2026-10-20
**LAMPIRAN**: BEM-FT UNAYA — backend

## Masalah

`npx prisma migrate status` dan Prisma Client **tidak terhubung** ke database lokal (MySQL `localhost:3306`). Semua perintah yang butuh koneksi Laravel, Prisma, atau migrasi mengalami kegagalan atau timeout.

## Tahapan yang sudah dicoba

1.  **Cek file `.env`**
    -   Tersedia di `backend/.env` (tidak di-commit, di-flag sebagai terblokir).
    -   Di dalamnya ada `DATABASE_URL="mysql://root:@localhost:3306/bem_ft_unaya"` dan `JWT_SECRET`, `SMTP_*`.
    -   Tidak ada error syntax yang terlihat.

2.  **Cek ketersediaan MySQL**
    -   `netstat -an` menunjukkan port 3306 **LISTENING** → server MySQL berjalan.
    -   Tetapi perintah `mysql -u root -e "..."` gagal → klien `mysql` CLI tidak terinstal/ditemukan di PATH host, bukan berarti MySQL mati.

3.  **Cek koneksi Prisma**
    -   `prisma migrate status` → tidak sampai ke tahap “database schema up-to-date” atau error koneksi; konteks menunjukkan root belum terhubung (tidak ada response / koneksi TIMEOUT / access denied).
    -   `npx prisma db execute --file prisma/schema.prisma` → langsung error sintaks (karena Prisma membaca file `.prisma` bukan `.sql`, tapi perintah ini juga tidak sampai ke database).
    -   `npx prisma db pull` → **error P1012 “Field `updatedAt` is already defined”** → ini tanda **database yang ada tidak cocok** dengan skema lokal yang semestinya (bisa karena migrasi belum dijalankan, atau basis data tidak kosong tapi schema tidak sinkron).

4.  **Cek migrasi**
    -   `prisma migrate status` menunjukkan migrasi yang harus dijalankan (belum di-apply).
    -   `prisma migrate deploy` → **error P3018** karena ada migrasi yang “gagal apply sebelumnya” (duplicate column, dll.).
    -   Seharusnya kita bisa resolve satu per satu dengan `prisma migrate resolve --applied <nama migrasi>` bila kolom yang “duplicate” sudah ada di database secara manual.

## Kemungkinan penyebab utama

1.  **Database belum dijalankan / service MySQL berhenti**
    -   Namun `netstat` mengindikasikan port 3306 aktif. Kemungkinan besar MySQL jalan, tapi:
        -   user `root` tanpa password ** ditolak aksesnya** oleh konfigurasi MySQL modern (auth plugin `auth_socket` / `caching_sha2_password` / policy).
        -   database `bem_ft_unaya` **tidak ada** dan root tidak punya `CREATE DATABASE`.
        -   ada konflik nama, SSL, atau firewall lokal.

2.  **Root tidak bisa login tanpa password via TCP**
    -   `DATABASE_URL` pakai `mysql://root:@localhost:3306/...` (tanpa password).
    -   MySQL mungkin mengharuskan password atau auth via `auth_socket` (hanya CLI `mysql -u root` di host yang sama yang lolos).
    -   Solusi: pastikan user `root` punya akses TCP dari aplikasi, atau siapkan user khusus di `.env`.

3.  **Database ada tapi schema tidak cocok / migrasi macet**
    -   Error P3018 (gagal apply) biasanya karena kolom/index sudah ada lebih dulu (bisa dari import manual / dump tidak lengkap) dan migrasi mencoba create lagi.
    -   Error P1012 (`updatedAt` duplikat) juga menandakan schema lokal vs database tidak sinkron.
    -   Cara aman: **jangan force**; verifikasi manual kolom apa yang ada, lalu resolve migrasi satu per satu.

4.  **Penyebab lain: environment/prisma versi, ketersediaan node_modules**
    -   `prisma generate` berhasil (dll Query Engine bisa dibuat).
    -   Tapi ada kemungkinan lokasi/privilege file engine karena proses lain memegang `query_engine-windows.dll.node` → file `.node` gagal rename saat `prisma generate`.

## Yang perlu diselesaikan sekarang

### Langkah 1 — pastikan root bisa konek via TCP
-   Coba koneksi eksplisit dengan CLI mysql ke host dan user yang sama:
    ```bash
    cd backend
    # Tes pakai NPX (bisa lewat prisma), atau langsung mysql CLI kalau ada.
    npx prisma db execute --stdin <<< "SELECT 1 AS t;"
    ```
-   Jika access denied: buat user MySQL khusus untuk aplikasi (mis. `bemuser`) lalu update `.env`.

### Langkah 2 — pastikan database `bem_ft_unaya` ada
-   Jika tidak ada, buat manual (asumsi akses root):
    ```sql
    CREATE DATABASE IF NOT EXISTS bem_ft_unaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```

### Langkah 3 — atasi state migrasi yang macet (jika ada kolom ganda)
-   Lihat DDL database saat ini vs migrasi. Untuk error “Duplicate column name”, mark migrasi yang bermasalah sebagai applied:
    ```bash
    npx prisma migrate resolve --applied 20261016090000_komentar_publik_dan_perpanjangan_akun
    # dst, satu per satu, sesuai error migrate deploy
    ```
-   **Hati-hati**: jangan mark applied bila kolom belum benar-benar ada; bisa membuat selisih schema.

### Langkah 4 — kalau database kosong (roji), reset state
Jika ini lingkungan development dan data tidak penting:
-   Drop database lalu jalankan ulang migrasi dari awal:
    ```bash
    mysql -u root -e "DROP DATABASE IF EXISTS bem_ft_unaya; CREATE DATABASE bem_ft_unaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    npx prisma migrate deploy
    npx prisma generate
    ```
-   Lalu siapin ulang seed/superadmin jika perlu.

### Langkah 5 — kalau engine DLL macet (Windows)
-   Matikan semua proses Node yang memegang file `.node` (`taskkill //F //IM node.exe`), tunggu, lalu `prisma generate` lagi.

## Verifikasi setelah perbaikan

Setelah koneksi hidup dan migrasi deploy berhasil:
1.  `npx prisma migrate status` → “Database schema is up to date”
2.  `npx prisma generate` → sukses (tanpa error rename)
3.  `npm run build` → lolos (0 error)
4.  Jalankan server (`npm run dev` / start) dan tes endpoint `GET /api/health` → 200 OK
5.  (Opsional) `pgrep`/cek proses Node sudah listen di port 3000
6.  Frontend `npm run build` jika backend API URL benar

## Catatan khusus untuk lanjutan

-   File `.env` tidak boleh dikirim / dikomit karena berisi rahasia.
-   Kalau ini pakai Docker / environment lain, sesuaikan `DATABASE_URL` (host, port, user, password, dbname).
-   Jika MySQL butuh auth plugin khusus atau binding di 127.0.0.1, sesuaikan `DATABASE_URL` menjadi `mysql://root:password@127.0.0.1:3306/bem_ft_unaya` (hati-hati security).
-   Hindari `prisma db push` di lingkungan yang sudah ada data; prefer `migrate` dengan resolve yang benar.
