-- Status online pengguna & forum ruang diskusi.

CREATE TABLE `UserPresence` (
    `userId` VARCHAR(191) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `UserPresence_lastSeenAt_idx` ON `UserPresence`(`lastSeenAt`);

ALTER TABLE `UserPresence`
    ADD CONSTRAINT `UserPresence_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `ChatRoom` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isOpen` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ChatRoom_isOpen_createdAt_idx` ON `ChatRoom`(`isOpen`, `createdAt`);

CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ChatMessage_roomId_createdAt_idx` ON `ChatMessage`(`roomId`, `createdAt`);

ALTER TABLE `ChatMessage`
    ADD CONSTRAINT `ChatMessage_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ChatRoom`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ChatMessage_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
