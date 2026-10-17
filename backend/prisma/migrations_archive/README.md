# Arsip riwayat migrasi lama

Isi folder ini **tidak lagi dijalankan** oleh Prisma. Prisma hanya membaca
`prisma/migrations`, jadi folder ini murni catatan sejarah.

## Kenapa diarsipkan

Riwayat migrasi lama tidak bisa dipakai untuk membangun database baru dari nol:

1. **Tabel hilang.** Migrasi `20261008123537_init` hanya membuat 13 tabel,
   sedangkan `schema.prisma` saat itu sudah punya 22 model. Empat tabel
   (`Agenda`, `Content`, `Notification`, `Gallery`) dibuat langsung ke database
   lewat `prisma db push`, sehingga tidak pernah tercatat sebagai migrasi.
2. **Urutan tidak bisa dijalankan.** Migrasi terakhir
   (`20261015223256_add_roles_...`) mengubah kolom pada tabel `agenda` dan
   membuat foreign key ke `Gallery`. Karena kedua tabel itu tidak pernah dibuat
   oleh migrasi mana pun, `prisma migrate deploy` di database kosong selalu
   berhenti dengan `P3018 ... Table 'agenda' doesn't exist`.
3. **Penulisan nama tabel tidak konsisten.** Migrasi awal memakai `` `User` ``
   sedangkan migrasi berikutnya memakai `user`/`agenda` huruf kecil. Di MySQL
   Windows ini tidak terasa (nama tabel tidak peka huruf besar/kecil), tapi di
   MySQL Linux (case-sensitive) kombinasi ini gagal.

Akibatnya: server baru atau anggota baru tidak bisa menyiapkan database sama
sekali, dan satu-satunya cara yang tersisa adalah menyalin database yang sudah ada.

## Penggantinya

Seluruh riwayat diganti oleh satu migrasi baseline:
`prisma/migrations/20261015230000_init/migration.sql`. Isinya dibuat otomatis
dari `schema.prisma` memakai

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20261015230000_init/migration.sql
```

sehingga dijamin identik dengan skema: 22 tabel, semua enum, index, dan foreign
key, dengan penulisan nama yang konsisten di seluruh berkas.

Database yang sudah berjalan (termasuk yang sedang dipakai sekarang) tidak
diubah isinya. Pembukuan lama di tabel `_prisma_migrations` disalin ke
`_prisma_migrations_backup.json`, lalu riwayat lama dinyatakan tergantikan
dengan menandai migrasi baseline sebagai *sudah diterapkan*:

```bash
npx prisma migrate resolve --applied 20261015230000_init
```

Tandai hal ini sebagai terapkan hanya karena database bersangkutan sudah
diperiksa tidak memiliki selisih dengan `schema.prisma`:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script   # harus kosong
```

## Menyiapkan database baru sekarang

```bash
cd backend
npx prisma migrate deploy   # membuat seluruh skema dari migrasi
npm run seed                # data awal (mahasiswa, organisasi, admin, dsb.)
```

Perubahan skema berikutnya: ubah `schema.prisma` lalu `npx prisma migrate dev --name nama_perubahan`.
Jangan pakai `prisma db push` lagi, karena perubahan seperti itu tidak akan
pernah masuk ke riwayat migrasi.
