/*
  Warnings:

  - Made the column `telefono` on table `estudios` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `tokens_verificacion_app` DROP FOREIGN KEY `tokens_verificacion_app_clienteId_fkey`;

-- DropForeignKey
ALTER TABLE `tokens_verificacion_app` DROP FOREIGN KEY `tokens_verificacion_app_usuarioId_fkey`;

-- DropIndex
DROP INDEX `tokens_verificacion_app_clienteId_fkey` ON `tokens_verificacion_app`;

-- DropIndex
DROP INDEX `tokens_verificacion_app_usuarioId_fkey` ON `tokens_verificacion_app`;

-- AlterTable
ALTER TABLE `estudios` MODIFY `telefono` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `tokens_verificacion_app` ADD CONSTRAINT `tokens_verificacion_app_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
