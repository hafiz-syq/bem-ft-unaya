# Insiden: Dump Database di Riwayat Git

## Ringkasan

Repo ini sempat **publik** di GitHub dan riwayat commit-nya memuat:

- `backups/bem_ft_unaya_*.sql` — dump database berisi 377 akun: NIM, nama, email,
  no. HP, hash password bcrypt, status verifikasi, dan ID perangkat.
- `backend/uploads/TICKET-*.jpeg|png|jpg` — lampiran tiket milik pengguna.
- `backups/backup.log` — path berkas backup.

Commit yang memuatnya: `36476d1` dan `b0caa64`. `.env`, kredensial database, dan
`JWT_SECRET` **tidak** pernah masuk repo, jadi kunci aplikasi tidak bocor lewat dump.

Riwayat lokal sudah dibersihkan (lihat bagian Verifikasi). Selama repo masih publik
atau riwayat lama belum di-force-push, anggap data tersebut **sudah bocor**.

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
| MySQL lokal (root) | Ganti password, jangan pakai ulang di Aiven | Dump membuka struktur & data, bukan credential, tetap higienis |
| Aiven MySQL | Buat kredensial baru saat provisioning | Jangan pakai password lama dari mesin lokal |
| Variabel Vercel | Periksa dan rotasi yang sensitif | `DATABASE_URL`, `JWT_SECRET`, `SMTP_PASS` ada di proyek lama |

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
