-- CreateTable
CREATE TABLE `estudios` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `propietario` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `sitioWeb` VARCHAR(191) NULL,
    `pais` VARCHAR(191) NOT NULL DEFAULT 'Mexico',
    `sucursales` JSON NOT NULL,
    `claveDueno` VARCHAR(191) NOT NULL,
    `claveCliente` VARCHAR(191) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `suscripcion` VARCHAR(191) NOT NULL DEFAULT 'mensual',
    `inicioSuscripcion` VARCHAR(191) NOT NULL,
    `fechaVencimiento` VARCHAR(191) NOT NULL,
    `horario` JSON NOT NULL,
    `servicios` JSON NOT NULL,
    `serviciosCustom` JSON NOT NULL,
    `festivos` JSON NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `estudios_claveDueno_key`(`claveDueno`),
    UNIQUE INDEX `estudios_claveCliente_key`(`claveCliente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personal` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `especialidades` JSON NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `horaInicio` VARCHAR(191) NULL,
    `horaFin` VARCHAR(191) NULL,
    `descansoInicio` VARCHAR(191) NULL,
    `descansoFin` VARCHAR(191) NULL,
    `diasTrabajo` JSON NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservas` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `personalId` VARCHAR(191) NOT NULL,
    `nombreCliente` VARCHAR(191) NOT NULL,
    `telefonoCliente` VARCHAR(191) NOT NULL,
    `fecha` VARCHAR(191) NOT NULL,
    `horaInicio` VARCHAR(191) NOT NULL,
    `duracion` INTEGER NOT NULL,
    `servicios` JSON NOT NULL,
    `precioTotal` DOUBLE NOT NULL DEFAULT 0,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `sucursal` VARCHAR(191) NOT NULL DEFAULT '',
    `marcaTinte` VARCHAR(191) NULL,
    `tonalidad` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `monto` DOUBLE NOT NULL,
    `moneda` VARCHAR(191) NOT NULL DEFAULT 'MXN',
    `concepto` VARCHAR(191) NOT NULL,
    `fecha` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'suscripcion',
    `referencia` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dias_festivos` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `fecha` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL DEFAULT '',
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `dias_festivos_estudioId_fecha_key`(`estudioId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `hashContrasena` VARCHAR(191) NOT NULL,
    `rol` VARCHAR(191) NOT NULL DEFAULT 'maestro',
    `estudioId` VARCHAR(191) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `personal` ADD CONSTRAINT `personal_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_personalId_fkey` FOREIGN KEY (`personalId`) REFERENCES `personal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dias_festivos` ADD CONSTRAINT `dias_festivos_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
