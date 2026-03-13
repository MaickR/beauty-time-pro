-- CreateIndex
CREATE INDEX `reservas_personalId_fecha_idx` ON `reservas`(`personalId`, `fecha`);

-- CreateIndex
CREATE INDEX `reservas_estudioId_fecha_idx` ON `reservas`(`estudioId`, `fecha`);

-- RenameIndex
ALTER TABLE `reservas` RENAME INDEX `reservas_clienteAppId_fkey` TO `reservas_clienteAppId_idx`;
