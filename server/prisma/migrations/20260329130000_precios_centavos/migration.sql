-- Multiplica importes históricos antes de convertir las columnas a enteros.
UPDATE `reservas`
SET `precioTotal` = ROUND(`precioTotal` * 100);

UPDATE `reserva_servicios`
SET `precio` = ROUND(`precio` * 100);

UPDATE `pagos`
SET `monto` = ROUND(`monto` * 100);

-- AlterTable
ALTER TABLE `reservas` MODIFY `precioTotal` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `reserva_servicios` MODIFY `precio` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `pagos` MODIFY `monto` INTEGER NOT NULL;
