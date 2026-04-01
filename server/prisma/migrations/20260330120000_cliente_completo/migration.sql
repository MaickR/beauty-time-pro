-- AlterTable: hacer fechaNacimiento opcional
ALTER TABLE `clientes_app` MODIFY `fechaNacimiento` DATETIME NULL;

-- AlterTable: agregar campo ciudad
ALTER TABLE `clientes_app` ADD COLUMN `ciudad` VARCHAR(191) NULL;

-- CreateIndex: telefono unico
CREATE UNIQUE INDEX `clientes_app_telefono_key` ON `clientes_app`(`telefono`);
