-- AlterTable
ALTER TABLE `correos_pendientes` ALTER COLUMN `actualizadoEn` DROP DEFAULT;

-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `fechaBloqueo` DATETIME(3) NULL,
    ADD COLUMN `fechaSuspension` DATETIME(3) NULL,
    ADD COLUMN `motivoBloqueo` VARCHAR(191) NULL,
    MODIFY `estado` ENUM('pendiente', 'aprobado', 'rechazado', 'suspendido', 'bloqueado') NOT NULL DEFAULT 'pendiente';
