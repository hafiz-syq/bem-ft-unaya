-- Batas perangkat bawaan diturunkan dari 10 menjadi 3.
--
-- Bentuknya ALTER COLUMN ... SET DEFAULT, bukan MODIFY: yang berubah hanya nilai
-- bawaan kolom, jadi tidak ada penulisan ulang baris. Tabel ditulis `User` dengan
-- huruf besar karena MySQL produksi berjalan dengan lower_case_table_names = 0.
ALTER TABLE `User` ALTER COLUMN `maxDevices` SET DEFAULT 3;

-- Backfill sadar untuk akun yang sudah ada.
--
-- Migrasi 20261029150000_batas_perangkat_sepuluh berisi
--   UPDATE `User` SET `maxDevices` = 10 WHERE `maxDevices` < 10;
-- dan bentuk "ratakan semua yang di bawah N" itu ternyata menimpa izin yang
-- diberikan admin lewat UI: tiga kenaikan yang tercatat di AuditLog
-- (action = DEVICE_LIMIT) diratakan ke 10. Bentuk itu tidak diulang di sini —
-- penurunan bawaan dikecualikan untuk akun yang memang pernah diberi izin.
UPDATE `User` SET `maxDevices` = 3 WHERE `maxDevices` > 3;

-- Tiga izin eksplisit superadmin (aktor 772afd2d) yang dikembalikan. Id penuh
-- tidak ikut tercatat di catatan yang dipakai untuk menulis migrasi ini, jadi
-- tiap pernyataan dikunci pada awalan id-nya; SELECT penanda di laporan menguji
-- bahwa setiap awalan tepat mengenai satu baris.
-- Sumber: AuditLog DEVICE_LIMIT, akun "superadmin", 2 -> 5.
UPDATE `User` SET `maxDevices` = 5 WHERE `id` LIKE '772afd2d-%';
-- Sumber: AuditLog DEVICE_LIMIT, akun "Admin 1", 3 -> 4.
UPDATE `User` SET `maxDevices` = 4 WHERE `id` LIKE '3c80bb4f-%';
-- Sumber: AuditLog DEVICE_LIMIT, akun "HAFIZ SYAUQI", 2 -> 4.
UPDATE `User` SET `maxDevices` = 4 WHERE `id` LIKE '8e34de7e-%';
