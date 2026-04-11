-- DropForeignKey
ALTER TABLE `audit_log` DROP FOREIGN KEY `audit_log_usuarioId_fkey`;

-- AlterTable
ALTER TABLE `audit_log` MODIFY `usuarioId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `clientes_app` MODIFY `fechaNacimiento` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `estudioPrincipalId` VARCHAR(191) NULL,
    ADD COLUMN `permiteReservasPublicas` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `tokens_verificacion_app` ADD COLUMN `codigoHash` VARCHAR(191) NULL,
    ADD COLUMN `intentosFallidos` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `ultimoEnvioEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `sesiones_autenticacion` (
    `id` VARCHAR(191) NOT NULL,
    `sujetoTipo` VARCHAR(191) NOT NULL,
    `sujetoId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NOT NULL,
    `csrfTokenHash` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `ultimoUsoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revocadaEn` DATETIME(3) NULL,
    `motivoRevocacion` VARCHAR(191) NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadaEn` DATETIME(3) NOT NULL,

    INDEX `sesiones_autenticacion_sujetoTipo_sujetoId_revocadaEn_idx`(`sujetoTipo`, `sujetoId`, `revocadaEn`),
    INDEX `sesiones_autenticacion_expiraEn_idx`(`expiraEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `estudios_estudioPrincipalId_idx` ON `estudios`(`estudioPrincipalId`);

-- CreateIndex
CREATE INDEX `estudios_estudioPrincipalId_estado_activo_idx` ON `estudios`(`estudioPrincipalId`, `estado`, `activo`);

-- CreateIndex
CREATE INDEX `tokens_verificacion_app_clienteId_tipo_usado_expiraEn_idx` ON `tokens_verificacion_app`(`clienteId`, `tipo`, `usado`, `expiraEn`);

-- AddForeignKey
ALTER TABLE `estudios` ADD CONSTRAINT `estudios_estudioPrincipalId_fkey` FOREIGN KEY (`estudioPrincipalId`) REFERENCES `estudios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
