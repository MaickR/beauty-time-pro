-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `colorPrimario` VARCHAR(191) NULL DEFAULT '#C2185B',
    ADD COLUMN `descripcion` VARCHAR(191) NULL,
    ADD COLUMN `direccion` VARCHAR(191) NULL,
    ADD COLUMN `emailContacto` VARCHAR(191) NULL,
    ADD COLUMN `logoUrl` VARCHAR(191) NULL;
