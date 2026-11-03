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
-- diberikan admin lewat UI. Bentuk itu tidak diulang di sini — penurunan
-- bawaan dikecualikan untuk akun yang memang pernah diberi izin, dan izin itu
-- dipulihkan dari AuditLog di bawah, bukan dari daftar id yang diketik tangan.
UPDATE `User` SET `maxDevices` = 3 WHERE `maxDevices` > 3;

-- Pulihkan batas yang pernah DIBERIKAN ADMIN secara eksplisit.
--
-- Sumber kebenaran: baris AuditLog action = 'DEVICE_LIMIT' paling baru per
-- akun. logActivity() menyimpan entityId apa adanya dan aturBatasPerangkat()
-- mengirim id penuh, jadi `entityId` = User.id dan angka batasnya adalah token
-- terakhir dari description ("... dari 2 menjadi 5"). Tidak ada id yang perlu
-- diketik tangan, jadi pemulihan ini tidak bisa diam-diam menjadi no-op.
--
-- Hanya nilai 4..10 yang dipulihkan: nilai di bawah 3 berarti keputusan admin
-- lama untuk MEMBATASI akun, dan akun itu memang tidak pernah diratakan oleh
-- migrasi mana pun, jadi tidak ada yang perlu diperbaiki.
--
-- Beda dengan daftar tangan yang diganti: kalau admin menaikkan batas SESUDAH
-- 20261029150000 (mis. menjadi 7), nilai itu ikut diratakan statement di atas
-- dan sekarang dipulihkan dari audit.
UPDATE `User` u
JOIN (
  SELECT p.`entityId` AS `eid`,
         CAST(SUBSTRING_INDEX(a.`description`, ' ', -1) AS UNSIGNED) AS `batas`
  FROM `AuditLog` a
  JOIN (
    SELECT `entityId`, MAX(`createdAt`) AS `pada`
    FROM `AuditLog`
    WHERE `action` = 'DEVICE_LIMIT' AND `entityId` IS NOT NULL
    GROUP BY `entityId`
  ) p
    ON p.`entityId` = a.`entityId`
   AND p.`pada` = a.`createdAt`
  WHERE a.`action` = 'DEVICE_LIMIT'
    -- Guard bentuk: hanya baris yang benar-benar diakhiri angka yang dibaca,
    -- supaya CAST tidak pernah menghasilkan 0 untuk description yang berubah.
    AND a.`description` LIKE '%menjadi %'
    AND SUBSTRING_INDEX(a.`description`, ' ', -1) REGEXP '^[0-9]+$'
) x ON x.`eid` = u.`id`
SET u.`maxDevices` = x.`batas`
WHERE x.`batas` BETWEEN 4 AND 10;
