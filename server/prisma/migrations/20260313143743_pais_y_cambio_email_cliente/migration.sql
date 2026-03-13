-- AlterTable
ALTER TABLE `clientes_app` ADD COLUMN `emailPendiente` VARCHAR(191) NULL,
    ADD COLUMN `pais` VARCHAR(191) NOT NULL DEFAULT 'Mexico';
