-- Komentar galeri kini boleh dikirim pengunjung tanpa akun.
-- Penulis akun menjadi opsional; tamu menyimpan namanya di guestName.
ALTER TABLE `GalleryComment` ADD COLUMN `guestName` VARCHAR(191) NULL,
    MODIFY `authorId` VARCHAR(191) NULL;
