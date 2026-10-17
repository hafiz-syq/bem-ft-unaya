-- AlterTable
ALTER TABLE `studentprofile` ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `email_verify_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `email_verify_code_hash` VARCHAR(191) NULL,
    ADD COLUMN `email_verify_expires_at` DATETIME(3) NULL,
    ADD COLUMN `email_verify_last_sent_at` DATETIME(3) NULL;

