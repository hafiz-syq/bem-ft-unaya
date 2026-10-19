-- Satu akun hanya aktif di satu perangkat. Login dari perangkat lain ditolak
-- sampai ADMIN/SUPERADMIN membuka kuncinya dari halaman Perangkat & Sesi.
ALTER TABLE `User`
    ADD COLUMN `deviceId` VARCHAR(64) NULL,
    ADD COLUMN `deviceLabel` VARCHAR(160) NULL,
    ADD COLUMN `deviceBoundAt` DATETIME(3) NULL,
    ADD COLUMN `pendingDeviceId` VARCHAR(64) NULL,
    ADD COLUMN `pendingDeviceLabel` VARCHAR(160) NULL,
    ADD COLUMN `pendingDeviceAt` DATETIME(3) NULL,
    ADD COLUMN `sessionVersion` INT NOT NULL DEFAULT 0;

-- Mempercepat halaman admin saat mencari akun yang terikat ke sebuah perangkat.
CREATE INDEX `User_deviceId_idx` ON `User`(`deviceId`);
