/*
  Warnings:

  - Added the required column `clienteId` to the `reservas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable (debe ir antes de ALTER TABLE para que la FK sea válida)
CREATE TABLE `clientes` (
    `id` VARCHAR(191) NOT NULL,
    `estudioId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `fechaNacimiento` DATETIME(3) NOT NULL,
    `email` VARCHAR(191) NULL,
    `notas` TEXT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `clientes_estudioId_telefono_key`(`estudioId`, `telefono`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey para clientes → estudios
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_estudioId_fkey` FOREIGN KEY (`estudioId`) REFERENCES `estudios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Crear un cliente "MIGRADO" por cada estudio que ya tenga reservas
INSERT INTO `clientes` (`id`, `estudioId`, `nombre`, `telefono`, `fechaNacimiento`, `notas`, `activo`, `creadoEn`, `actualizadoEn`)
SELECT
  UUID(),
  r.`estudioId`,
  'Cliente Migrado',
  CONCAT('000-', r.`estudioId`),
  '1990-01-01',
  'Creado automáticamente durante migración',
  TRUE,
  NOW(),
  NOW()
FROM (SELECT DISTINCT `estudioId` FROM `reservas`) AS r
ON DUPLICATE KEY UPDATE `nombre` = `nombre`;

-- AlterTable: agregar clienteId NULLABLE primero
ALTER TABLE `reservas`
    ADD COLUMN `clienteId` VARCHAR(191) NULL,
    ADD COLUMN `notasMenorEdad` VARCHAR(191) NULL;

-- Asignar el cliente de migración a todas las reservas existentes
UPDATE `reservas` r
JOIN `clientes` c ON c.`estudioId` = r.`estudioId` AND c.`telefono` = CONCAT('000-', r.`estudioId`)
SET r.`clienteId` = c.`id`
WHERE r.`clienteId` IS NULL;

-- Ahora que todas las filas tienen valor, aplicar NOT NULL
ALTER TABLE `reservas` MODIFY COLUMN `clienteId` VARCHAR(191) NOT NULL;

-- AddForeignKey reservas → clientes
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
