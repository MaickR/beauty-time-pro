-- AlterTable: agregar vendedorId a estudios
ALTER TABLE `estudios` ADD COLUMN `vendedorId` VARCHAR(191) NULL;
CREATE INDEX `estudios_vendedorId_idx` ON `estudios`(`vendedorId`);
ALTER TABLE `estudios` ADD CONSTRAINT `estudios_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: preregistros_salon
CREATE TABLE `preregistros_salon` (
    `id` VARCHAR(191) NOT NULL,
    `vendedorId` VARCHAR(191) NOT NULL,
    `nombreSalon` VARCHAR(191) NOT NULL,
    `propietario` VARCHAR(191) NOT NULL,
    `emailPropietario` VARCHAR(191) NOT NULL,
    `telefonoPropietario` VARCHAR(191) NOT NULL,
    `pais` VARCHAR(191) NOT NULL DEFAULT 'Mexico',
    `direccion` VARCHAR(191) NULL,
    `descripcion` TEXT NULL,
    `categorias` VARCHAR(191) NULL,
    `plan` ENUM('STANDARD', 'PRO') NOT NULL DEFAULT 'STANDARD',
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `motivoRechazo` TEXT NULL,
    `estudioCreadoId` VARCHAR(191) NULL,
    `notas` TEXT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `preregistros_salon_vendedorId_idx` ON `preregistros_salon`(`vendedorId`);
CREATE INDEX `preregistros_salon_estado_idx` ON `preregistros_salon`(`estado`);
ALTER TABLE `preregistros_salon` ADD CONSTRAINT `preregistros_salon_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
