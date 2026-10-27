-- Arsip surat: organisasi yang diberi surat dan arah surat (masuk/keluar).
-- Kedua kolom bersifat menambah; data lama tetap utuh dan otomatis dianggap
-- surat keluar sampai admin memilahnya.

ALTER TABLE `Document`
    ADD COLUMN `organizationId` VARCHAR(191) NULL,
    ADD COLUMN `direction` VARCHAR(10) NOT NULL DEFAULT 'KELUAR';

CREATE INDEX `Document_organizationId_direction_idx` ON `Document`(`organizationId`, `direction`);

ALTER TABLE `Document`
    ADD CONSTRAINT `Document_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
