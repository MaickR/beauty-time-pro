-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `categorias` VARCHAR(191) NULL,
    ADD COLUMN `diasAtencion` VARCHAR(191) NULL DEFAULT 'lunes,martes,miercoles,jueves,viernes',
    ADD COLUMN `estado` ENUM('pendiente', 'aprobado', 'rechazado', 'suspendido') NOT NULL DEFAULT 'pendiente',
    ADD COLUMN `fechaAprobacion` DATETIME(3) NULL,
    ADD COLUMN `fechaSolicitud` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `horarioApertura` VARCHAR(191) NULL DEFAULT '09:00',
    ADD COLUMN `horarioCierre` VARCHAR(191) NULL DEFAULT '18:00',
    ADD COLUMN `motivoRechazo` VARCHAR(191) NULL,
    ADD COLUMN `numeroEspecialistas` INTEGER NULL DEFAULT 1,
    MODIFY `telefono` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `reservas` ADD COLUMN `clienteAppId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `clientes_app` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `hashContrasena` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `fechaNacimiento` DATETIME(3) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `emailVerificado` BOOLEAN NOT NULL DEFAULT false,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `ultimoAcceso` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clientes_app_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens_verificacion_app` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `clienteId` VARCHAR(191) NULL,
    `expiraEn` DATETIME(3) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tokens_verificacion_app_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_clienteAppId_fkey` FOREIGN KEY (`clienteAppId`) REFERENCES `clientes_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens_verificacion_app` ADD CONSTRAINT `tokens_verificacion_app_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens_verificacion_app` ADD CONSTRAINT `tokens_verificacion_app_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
