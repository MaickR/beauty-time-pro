ALTER TABLE `reservas` ADD COLUMN `reagendada` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `reservas` ADD COLUMN `reservaOriginalId` VARCHAR(191) NULL;
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_reservaOriginalId_fkey` FOREIGN KEY (`reservaOriginalId`) REFERENCES `reservas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
