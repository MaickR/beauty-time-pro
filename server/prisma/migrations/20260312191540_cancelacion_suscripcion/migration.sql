-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `cancelacionSolicitada` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `fechaSolicitudCancelacion` DATETIME(3) NULL,
    ADD COLUMN `motivoCancelacion` VARCHAR(191) NULL;
