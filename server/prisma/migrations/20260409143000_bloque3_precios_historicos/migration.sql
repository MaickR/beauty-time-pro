-- BLOQUE 3: Precios configurables con vigencia histórica por salón.

CREATE TABLE `precios_plan` (
  `id` VARCHAR(191) NOT NULL,
  `plan` ENUM('STANDARD', 'PRO') NOT NULL,
  `pais` VARCHAR(191) NOT NULL,
  `moneda` VARCHAR(191) NOT NULL,
  `monto` INTEGER NOT NULL,
  `version` INTEGER NOT NULL,
  `vigenteDesde` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actualizadoEn` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `precios_plan_plan_pais_version_key` (`plan`, `pais`, `version`),
  INDEX `precios_plan_plan_pais_vigenteDesde_idx` (`plan`, `pais`, `vigenteDesde`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `estudios`
  ADD COLUMN `precioPlanActualId` VARCHAR(191) NULL,
  ADD COLUMN `precioPlanProximoId` VARCHAR(191) NULL,
  ADD COLUMN `fechaAplicacionPrecioProximo` VARCHAR(191) NULL;

CREATE INDEX `estudios_precioPlanActualId_idx` ON `estudios`(`precioPlanActualId`);
CREATE INDEX `estudios_precioPlanProximoId_idx` ON `estudios`(`precioPlanProximoId`);

ALTER TABLE `estudios`
  ADD CONSTRAINT `estudios_precioPlanActualId_fkey`
    FOREIGN KEY (`precioPlanActualId`) REFERENCES `precios_plan`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `estudios_precioPlanProximoId_fkey`
    FOREIGN KEY (`precioPlanProximoId`) REFERENCES `precios_plan`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Semilla inicial obligatoria de precios (centavos) según negocio.
INSERT INTO `precios_plan` (`id`, `plan`, `pais`, `moneda`, `monto`, `version`, `vigenteDesde`, `creadoEn`, `actualizadoEn`)
SELECT UUID(), 'STANDARD', 'Mexico', 'MXN', 70000, 1, NOW(3), NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `precios_plan` WHERE `plan` = 'STANDARD' AND `pais` = 'Mexico'
);

INSERT INTO `precios_plan` (`id`, `plan`, `pais`, `moneda`, `monto`, `version`, `vigenteDesde`, `creadoEn`, `actualizadoEn`)
SELECT UUID(), 'STANDARD', 'Colombia', 'COP', 15000000, 1, NOW(3), NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `precios_plan` WHERE `plan` = 'STANDARD' AND `pais` = 'Colombia'
);

INSERT INTO `precios_plan` (`id`, `plan`, `pais`, `moneda`, `monto`, `version`, `vigenteDesde`, `creadoEn`, `actualizadoEn`)
SELECT UUID(), 'PRO', 'Mexico', 'MXN', 100000, 1, NOW(3), NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `precios_plan` WHERE `plan` = 'PRO' AND `pais` = 'Mexico'
);

INSERT INTO `precios_plan` (`id`, `plan`, `pais`, `moneda`, `monto`, `version`, `vigenteDesde`, `creadoEn`, `actualizadoEn`)
SELECT UUID(), 'PRO', 'Colombia', 'COP', 20000000, 1, NOW(3), NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `precios_plan` WHERE `plan` = 'PRO' AND `pais` = 'Colombia'
);

-- Backfill: asignar precio actual a salones existentes que aun no lo tienen.
UPDATE `estudios` e
JOIN (
  SELECT p1.`id`, p1.`plan`, p1.`pais`
  FROM `precios_plan` p1
  JOIN (
    SELECT `plan`, `pais`, MAX(`version`) AS `version`
    FROM `precios_plan`
    GROUP BY `plan`, `pais`
  ) ult ON ult.`plan` = p1.`plan` AND ult.`pais` = p1.`pais` AND ult.`version` = p1.`version`
) precio_actual
ON precio_actual.`plan` = e.`plan` AND precio_actual.`pais` = e.`pais`
SET e.`precioPlanActualId` = precio_actual.`id`
WHERE e.`precioPlanActualId` IS NULL;
