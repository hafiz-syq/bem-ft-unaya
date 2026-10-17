-- AlterTable
ALTER TABLE `user` ADD COLUMN `perpanjanganHingga` DATETIME(3) NULL,
    ADD COLUMN `tenggatHapus` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PublicCommentReply` (
    `id` VARCHAR(191) NOT NULL,
    `commentId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PublicComment_status_createdAt_idx` ON `PublicComment`(`status`, `createdAt`);

-- AddForeignKey
ALTER TABLE `PublicCommentReply` ADD CONSTRAINT `PublicCommentReply_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `PublicComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PublicCommentReply` ADD CONSTRAINT `PublicCommentReply_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
