-- CreateTable
CREATE TABLE `permisos_maestro` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `aprobarSalones` BOOLEAN NOT NULL DEFAULT false,
    `gestionarPagos` BOOLEAN NOT NULL DEFAULT false,
    `crearAdmins` BOOLEAN NOT NULL DEFAULT false,
    `verAuditLog` BOOLEAN NOT NULL DEFAULT false,
    `verMetricas` BOOLEAN NOT NULL DEFAULT false,
    `suspenderSalones` BOOLEAN NOT NULL DEFAULT false,
    `esMaestroTotal` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permisos_maestro_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `accion` VARCHAR(191) NOT NULL,
    `entidadTipo` VARCHAR(191) NOT NULL,
    `entidadId` VARCHAR(191) NOT NULL,
    `detalles` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permisos_maestro` ADD CONSTRAINT `permisos_maestro_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
