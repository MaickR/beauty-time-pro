-- AlterTable
ALTER TABLE `estudios`
ADD COLUMN `zonaHoraria` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City';

UPDATE `estudios`
SET `zonaHoraria` = CASE
  WHEN `pais` = 'Colombia' THEN 'America/Bogota'
  ELSE 'America/Mexico_City'
END;
