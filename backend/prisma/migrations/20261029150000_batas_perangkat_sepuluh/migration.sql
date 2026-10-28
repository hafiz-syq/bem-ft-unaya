-- Batas perangkat dinaikkan dari 5 menjadi 10.
-- Akun lama yang masih memakai batas 1-5 ikut dinaikkan agar kebijakan baru
-- langsung berlaku tanpa admin harus mengubah satu per satu.
ALTER TABLE `User` ALTER COLUMN `maxDevices` SET DEFAULT 10;
UPDATE `User` SET `maxDevices` = 10 WHERE `maxDevices` < 10;
