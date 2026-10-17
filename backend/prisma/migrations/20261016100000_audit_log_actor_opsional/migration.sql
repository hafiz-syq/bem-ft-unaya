-- DropForeignKey
-- Catatan: nama tabel diseragamkan menjadi `AuditLog` mengikuti model di
-- schema.prisma. Hasil `migrate diff` di Windows menulisnya huruf kecil karena
-- menyesuaikan nama tabel di database lokal, dan itu akan gagal di MySQL Linux
-- yang peka huruf besar/kecil.
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_actorId_fkey`;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `actorId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_action_createdAt_idx` ON `AuditLog`(`action`, `createdAt`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

