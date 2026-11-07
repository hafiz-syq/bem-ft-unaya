-- Konten (berita/artikel) dan agenda boleh ditandai unit pengunggahnya:
-- Sistem Informasi, Teknik Sipil, atau Teknik Mesin. Kolomnya NULL supaya
-- seluruh baris lama tetap tampil tanpa badge, sama seperti sebelumnya.
-- Bentuknya VARCHAR biasa, bukan ENUM, mengikuti `type` dan `status` di model
-- yang sama; nilai yang diterima divalidasi di cms.controller.ts.
ALTER TABLE `Content` ADD COLUMN `unit` VARCHAR(191) NULL;

ALTER TABLE `Agenda` ADD COLUMN `unit` VARCHAR(191) NULL;
