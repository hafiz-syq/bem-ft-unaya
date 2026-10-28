-- Tambahkan tipe organisasi untuk penjenjangan visibilitas arsip surat.
-- Tingkat: HIMPUNAN (1) < BEM (2) < DPM (3) — surat hanya menyebar ke atas.
ALTER TABLE `Organization` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'HIMPUNAN';

-- Isi otomatis dari nama organisasi yang sudah ada. Admin dapat mengoreksinya
-- lewat halaman Master Organisasi bila ada yang salah tertangkap.
UPDATE `Organization` SET `kind` = 'BEM' WHERE LOWER(TRIM(`name`)) LIKE 'bem%';
UPDATE `Organization` SET `kind` = 'DPM' WHERE LOWER(TRIM(`name`)) LIKE 'dpm%';
