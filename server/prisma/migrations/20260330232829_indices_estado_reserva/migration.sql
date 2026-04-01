-- CreateIndex
CREATE INDEX `reservas_personalId_fecha_estado_idx` ON `reservas`(`personalId`, `fecha`, `estado`);

-- CreateIndex
CREATE INDEX `reservas_estudioId_fecha_estado_idx` ON `reservas`(`estudioId`, `fecha`, `estado`);
