-- CreateTable
CREATE TABLE `reserva_servicios` (
    `id` VARCHAR(191) NOT NULL,
    `reservaId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `duracion` INTEGER NOT NULL,
    `precio` DOUBLE NOT NULL DEFAULT 0,
    `categoria` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reserva_servicios_reservaId_orden_idx`(`reservaId`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reserva_servicios` ADD CONSTRAINT `reserva_servicios_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reservas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
