-- CreateEnum
-- Convertir columna rol de VARCHAR a ENUM
ALTER TABLE `usuarios` MODIFY COLUMN `rol` ENUM('maestro', 'supervisor', 'vendedor', 'dueno', 'empleado') NOT NULL DEFAULT 'dueno';

-- CreateTable
CREATE TABLE `permisos_supervisor` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `verTotalSalones` BOOLEAN NOT NULL DEFAULT false,
    `verControlSalones` BOOLEAN NOT NULL DEFAULT false,
    `verReservas` BOOLEAN NOT NULL DEFAULT false,
    `verVentas` BOOLEAN NOT NULL DEFAULT false,
    `verDirectorio` BOOLEAN NOT NULL DEFAULT false,
    `editarDirectorio` BOOLEAN NOT NULL DEFAULT false,
    `verControlCobros` BOOLEAN NOT NULL DEFAULT false,
    `accionRecordatorio` BOOLEAN NOT NULL DEFAULT false,
    `accionRegistroPago` BOOLEAN NOT NULL DEFAULT false,
    `accionSuspension` BOOLEAN NOT NULL DEFAULT false,
    `activarSalones` BOOLEAN NOT NULL DEFAULT false,
    `verPreregistros` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permisos_supervisor_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permisos_supervisor` ADD CONSTRAINT `permisos_supervisor_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
