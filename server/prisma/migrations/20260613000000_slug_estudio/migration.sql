-- AlterTable
ALTER TABLE `estudios` ADD COLUMN `slug` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `estudios_slug_key` ON `estudios`(`slug`);
