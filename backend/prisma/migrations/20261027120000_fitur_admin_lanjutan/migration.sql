-- Tempat sampah 30 hari untuk akun mahasiswa.
ALTER TABLE `User`
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL,
    ADD COLUMN `deletionReason` TEXT NULL;

CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);

-- Layanan tiket: prioritas, SLA respons pertama, dan rating kepuasan.
ALTER TABLE `Ticket`
    ADD COLUMN `priority` ENUM('RENDAH', 'NORMAL', 'TINGGI', 'MENDESAK') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL,
    ADD COLUMN `resolvedAt` DATETIME(3) NULL,
    ADD COLUMN `rating` INTEGER NULL,
    ADD COLUMN `ratingComment` TEXT NULL,
    ADD COLUMN `ratedAt` DATETIME(3) NULL;

CREATE INDEX `Ticket_status_priority_createdAt_idx`
    ON `Ticket`(`status`, `priority`, `createdAt`);

-- Moderasi komunitas & tempat sampah pesan buku tamu.
ALTER TABLE `PublicComment`
    ADD COLUMN `isFlagged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `flagReason` TEXT NULL,
    ADD COLUMN `reportedCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastReportedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL;

CREATE INDEX `PublicComment_isFlagged_createdAt_idx`
    ON `PublicComment`(`isFlagged`, `createdAt`);
CREATE INDEX `PublicComment_deletedAt_idx`
    ON `PublicComment`(`deletedAt`);

-- Template balasan cepat untuk pengurus.
CREATE TABLE `TicketTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `content` TEXT NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TicketTemplate`
    ADD CONSTRAINT `TicketTemplate_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Pengumuman tersegmentasi dan hitungan pembaca.
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `content` TEXT NOT NULL,
    `audience` ENUM('SEMUA', 'ROLE', 'ANGKATAN', 'ORGANISASI') NOT NULL DEFAULT 'SEMUA',
    `audienceRole` ENUM('MAHASISWA', 'PENGURUS', 'PENGURUS_DPM', 'PENGURUS_BEM', 'PENGURUS_SISTEM_INFORMASI', 'PENGURUS_TEKNIK_MESIN', 'PENGURUS_TEKNIK_SIPIL', 'ADMIN', 'SUPERADMIN') NULL,
    `audienceAngkatan` INTEGER NULL,
    `audienceOrganizationId` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Announcement_isPublished_createdAt_idx`
    ON `Announcement`(`isPublished`, `createdAt`);

ALTER TABLE `Announcement`
    ADD CONSTRAINT `Announcement_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `AnnouncementRead` (
    `id` VARCHAR(191) NOT NULL,
    `announcementId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `AnnouncementRead_announcementId_userId_key`
    ON `AnnouncementRead`(`announcementId`, `userId`);
CREATE INDEX `AnnouncementRead_userId_readAt_idx`
    ON `AnnouncementRead`(`userId`, `readAt`);

ALTER TABLE `AnnouncementRead`
    ADD CONSTRAINT `AnnouncementRead_announcementId_fkey`
    FOREIGN KEY (`announcementId`) REFERENCES `Announcement`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AnnouncementRead_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Arsip surat & proposal.
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `number` VARCHAR(80) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `fileUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Document_type_number_key` ON `Document`(`type`, `number`);
CREATE INDEX `Document_status_createdAt_idx` ON `Document`(`status`, `createdAt`);

ALTER TABLE `Document`
    ADD CONSTRAINT `Document_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `Document_approvedById_fkey`
    FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Langganan Web Push per perangkat.
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `PushSubscription_endpoint_key` ON `PushSubscription`(`endpoint`);
CREATE INDEX `PushSubscription_userId_idx` ON `PushSubscription`(`userId`);

ALTER TABLE `PushSubscription`
    ADD CONSTRAINT `PushSubscription_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Kesalahan server untuk halaman pemantauan admin.
CREATE TABLE `ErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `stack` TEXT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `statusCode` INTEGER NOT NULL DEFAULT 500,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ErrorLog_resolvedAt_createdAt_idx`
    ON `ErrorLog`(`resolvedAt`, `createdAt`);
