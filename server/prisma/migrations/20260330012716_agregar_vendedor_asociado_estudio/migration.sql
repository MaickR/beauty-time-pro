-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `vendedorAsociado` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `estudios_vendedorAsociado_idx` ON `estudios`(`vendedorAsociado`);
