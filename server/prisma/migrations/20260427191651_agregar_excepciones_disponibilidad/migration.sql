-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `excepcionesDisponibilidad` JSON NULL;

-- AlterTable
ALTER TABLE `reservas` ADD COLUMN `metodoPago` VARCHAR(191) NULL,
    ADD COLUMN `motivoCancelacion` VARCHAR(191) NULL,
    ADD COLUMN `productosAdicionales` JSON NULL;
