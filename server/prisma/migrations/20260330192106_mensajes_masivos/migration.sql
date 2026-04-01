-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `mensajesMasivosExtra` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `mensajesMasivosUsados` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `mensajes_masivos` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(200) NOT NULL,
    `imagenUrl` VARCHAR(191) NULL,
    `fechaEnvio` DATETIME(3) NOT NULL,
    `enviado` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mensajes_masivos_estudioId_idx`(`estudioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mensajes_masivos` ADD CONSTRAINT `mensajes_masivos_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
