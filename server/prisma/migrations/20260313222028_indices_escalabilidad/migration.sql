-- CreateIndex
CREATE INDEX `audit_log_entidadId_creadoEn_idx` ON `audit_log`(`entidadId`, `creadoEn`);

-- CreateIndex
CREATE INDEX `clientes_app_pais_idx` ON `clientes_app`(`pais`);

-- CreateIndex
CREATE INDEX `estudios_estado_activo_idx` ON `estudios`(`estado`, `activo`);

-- CreateIndex
CREATE INDEX `estudios_pais_estado_idx` ON `estudios`(`pais`, `estado`);

-- CreateIndex
CREATE INDEX `estudios_fechaVencimiento_idx` ON `estudios`(`fechaVencimiento`);

-- CreateIndex
CREATE INDEX `personal_estudioId_activo_idx` ON `personal`(`estudioId`, `activo`);

-- RenameIndex
ALTER TABLE `audit_log` RENAME INDEX `audit_log_usuarioId_fkey` TO `audit_log_usuarioId_idx`;

-- RenameIndex
ALTER TABLE `suscripciones_push` RENAME INDEX `suscripciones_push_clienteId_fkey` TO `suscripciones_push_clienteId_idx`;

-- RenameIndex
ALTER TABLE `suscripciones_push` RENAME INDEX `suscripciones_push_usuarioId_fkey` TO `suscripciones_push_usuarioId_idx`;
