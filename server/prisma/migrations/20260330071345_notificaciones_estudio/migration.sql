-- CreateTable
CREATE TABLE `notificaciones_estudio` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificaciones_estudio_estudioId_leida_idx`(`estudioId`, `leida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notificaciones_estudio` ADD CONSTRAINT `notificaciones_estudio_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
