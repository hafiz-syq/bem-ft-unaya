-- Agenda boleh berlangsung beberapa hari (endDate inklusif) dan punya warna
-- penanda sendiri di kalender dashboard.
ALTER TABLE `Agenda`
    ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `color` VARCHAR(191) NOT NULL DEFAULT '#F59E0B';

-- Daftar agenda publik & kalender selalu diurutkan/filter berdasarkan tanggal.
CREATE INDEX `Agenda_date_idx` ON `Agenda`(`date`);

-- Asal pengirim komentar tamu, hanya untuk halaman moderasi.
ALTER TABLE `GalleryComment`
    ADD COLUMN `guestIp` VARCHAR(191) NULL,
    ADD COLUMN `guestUserAgent` VARCHAR(255) NULL;

CREATE INDEX `GalleryComment_guestIp_createdAt_idx` ON `GalleryComment`(`guestIp`, `createdAt`);
