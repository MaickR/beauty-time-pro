ALTER TABLE `reservas`
  ADD COLUMN `tokenCancelacion` VARCHAR(191) NULL;

UPDATE `reservas`
SET `tokenCancelacion` = UUID()
WHERE `tokenCancelacion` IS NULL;

ALTER TABLE `reservas`
  MODIFY `tokenCancelacion` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `reservas_tokenCancelacion_key` ON `reservas`(`tokenCancelacion`);
