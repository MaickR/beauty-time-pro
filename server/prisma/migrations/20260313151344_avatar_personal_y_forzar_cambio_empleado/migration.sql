-- AlterTable
ALTER TABLE `empleados_acceso` ADD COLUMN `forzarCambioContrasena` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `personal` ADD COLUMN `avatarUrl` VARCHAR(191) NULL;
