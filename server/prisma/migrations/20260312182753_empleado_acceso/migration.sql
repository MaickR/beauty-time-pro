-- CreateTable
CREATE TABLE `empleados_acceso` (
    `id` VARCHAR(191) NOT NULL,
    `personalId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `hashContrasena` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `ultimoAcceso` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empleados_acceso_personalId_key`(`personalId`),
    UNIQUE INDEX `empleados_acceso_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `empleados_acceso` ADD CONSTRAINT `empleados_acceso_personalId_fkey` FOREIGN KEY (`personalId`) REFERENCES `personal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
