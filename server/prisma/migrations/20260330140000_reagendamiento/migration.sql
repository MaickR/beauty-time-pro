-- AlterTable
ALTER TABLE eservas ADD COLUMN eagendada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE eservas ADD COLUMN eservaOriginalId VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE eservas ADD CONSTRAINT eservas_reservaOriginalId_fkey FOREIGN KEY (eservaOriginalId) REFERENCES eservas(id) ON DELETE SET NULL ON UPDATE CASCADE;
