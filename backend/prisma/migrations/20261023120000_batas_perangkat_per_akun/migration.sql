-- Batas jumlah perangkat yang boleh aktif bersamaan per akun.
-- Nilai bawaan 1 mempertahankan perilaku lama (satu akun satu perangkat).
ALTER TABLE `User`
    ADD COLUMN `maxDevices` INTEGER NOT NULL DEFAULT 1;

-- Perangkat ke-2 dan seterusnya. Perangkat utama tetap di kolom User.deviceId,
-- jadi akun-akun lama tidak perlu diisi ulang ke tabel ini.
CREATE TABLE `UserDevice` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(64) NOT NULL,
    `label` VARCHAR(160) NULL,
    `boundAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserDevice_userId_deviceId_key`(`userId`, `deviceId`),
    INDEX `UserDevice_deviceId_idx`(`deviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserDevice`
    ADD CONSTRAINT `UserDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
