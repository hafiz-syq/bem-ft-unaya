-- AlterTable: tambah role SUPERADMIN (pengelola web) ke enum Role.
ALTER TABLE `User`
    MODIFY `role` ENUM(
        'MAHASISWA',
        'PENGURUS',
        'PENGURUS_DPM',
        'PENGURUS_BEM',
        'PENGURUS_SISTEM_INFORMASI',
        'PENGURUS_TEKNIK_MESIN',
        'PENGURUS_TEKNIK_SIPIL',
        'ADMIN',
        'SUPERADMIN'
    ) NOT NULL DEFAULT 'MAHASISWA';

-- AlterTable: email akun untuk semua role (dipakai lupa password & notifikasi).
ALTER TABLE `User` ADD COLUMN `email` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);

-- CreateTable
CREATE TABLE `GalleryComment` (
    `id` VARCHAR(191) NOT NULL,
    `galleryId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `moderatedById` VARCHAR(191) NULL,
    `moderatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `otp_hash` VARCHAR(191) NULL,
    `otp_expires_at` DATETIME(3) NULL,
    `token_hash` VARCHAR(191) NULL,
    `token_expires_at` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_sent_at` DATETIME(3) NULL,
    `used_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `GalleryComment_galleryId_status_createdAt_idx` ON `GalleryComment`(`galleryId`, `status`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `PasswordReset_userId_key` ON `PasswordReset`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `PasswordReset_token_hash_key` ON `PasswordReset`(`token_hash`);

-- AddForeignKey
ALTER TABLE `GalleryComment` ADD CONSTRAINT `GalleryComment_galleryId_fkey` FOREIGN KEY (`galleryId`) REFERENCES `Gallery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GalleryComment` ADD CONSTRAINT `GalleryComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GalleryComment` ADD CONSTRAINT `GalleryComment_moderatedById_fkey` FOREIGN KEY (`moderatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
