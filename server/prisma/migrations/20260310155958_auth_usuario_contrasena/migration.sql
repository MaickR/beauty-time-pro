/*
  Warnings:

  - Added the required column `actualizadoEn` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `actualizadoEn` DATETIME(3) NOT NULL,
    ADD COLUMN `nombre` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `ultimoAcceso` DATETIME(3) NULL,
    ALTER COLUMN `rol` DROP DEFAULT;

-- CreateTable
CREATE TABLE `tokens_reset` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tokens_reset_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens_reset` ADD CONSTRAINT `tokens_reset_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
