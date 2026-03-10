-- CreateTable
CREATE TABLE `config_fidelidad` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT false,
    `visitasRequeridas` INTEGER NOT NULL DEFAULT 5,
    `tipoRecompensa` VARCHAR(191) NOT NULL DEFAULT 'descuento',
    `porcentajeDescuento` INTEGER NULL DEFAULT 100,
    `descripcionRecompensa` VARCHAR(191) NOT NULL DEFAULT 'Servicio gratis en tu próxima visita',
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `config_fidelidad_estudioId_key`(`estudioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `puntos_fidelidad` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `visitasAcumuladas` INTEGER NOT NULL DEFAULT 0,
    `visitasUsadas` INTEGER NOT NULL DEFAULT 0,
    `recompensasGanadas` INTEGER NOT NULL DEFAULT 0,
    `recompensasUsadas` INTEGER NOT NULL DEFAULT 0,
    `ultimaVisita` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `puntos_fidelidad_clienteId_estudioId_key`(`clienteId`, `estudioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `config_fidelidad` ADD CONSTRAINT `config_fidelidad_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `puntos_fidelidad` ADD CONSTRAINT `puntos_fidelidad_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `puntos_fidelidad` ADD CONSTRAINT `puntos_fidelidad_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
