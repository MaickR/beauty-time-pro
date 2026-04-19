import { prisma } from '../prismaCliente.js';

const PRECIOS_BASE = [
  { plan: 'STANDARD', pais: 'Mexico', moneda: 'MXN', monto: 70000 },
  { plan: 'STANDARD', pais: 'Colombia', moneda: 'COP', monto: 15000000 },
  { plan: 'PRO', pais: 'Mexico', moneda: 'MXN', monto: 100000 },
  { plan: 'PRO', pais: 'Colombia', moneda: 'COP', monto: 20000000 },
] as const;

/**
 * Columnas opcionales que el servidor espera pero que pueden faltar si las
 * migraciones no se aplicaron completamente. Se agregan de forma idempotente.
 */
const COLUMNAS_REQUERIDAS: Array<{ tabla: string; columna: string; definicion: string }> = [
  { tabla: 'estudios', columna: 'metodosPagoReserva', definicion: 'JSON NULL' },
  { tabla: 'estudios', columna: 'excepcionesDisponibilidad', definicion: 'JSON NULL' },
  { tabla: 'estudios', columna: 'slug', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'pinCancelacionHash', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'permiteReservasPublicas', definicion: 'BOOLEAN NOT NULL DEFAULT true' },
  { tabla: 'estudios', columna: 'cancelacionSolicitada', definicion: 'BOOLEAN NOT NULL DEFAULT false' },
  { tabla: 'estudios', columna: 'fechaSolicitudCancelacion', definicion: 'DATETIME(3) NULL' },
  { tabla: 'estudios', columna: 'motivoCancelacion', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'precioPlanActualId', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'precioPlanProximoId', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'fechaAplicacionPrecioProximo', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'estudioPrincipalId', definicion: 'VARCHAR(191) NULL' },
  { tabla: 'estudios', columna: 'plan', definicion: "ENUM('STANDARD','PRO') NOT NULL DEFAULT 'STANDARD'" },
  { tabla: 'estudios', columna: 'primeraVez', definicion: 'BOOLEAN NOT NULL DEFAULT true' },
];

async function asegurarColumnasRequeridas(): Promise<void> {
  const filas = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'estudios'
  `;
  const existentes = new Set(filas.map((f) => f.COLUMN_NAME));

  for (const { tabla, columna, definicion } of COLUMNAS_REQUERIDAS) {
    if (existentes.has(columna)) continue;
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicion}`);
      console.log(`[columnas] Agregada columna ${tabla}.${columna}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/Duplicate column name|already exists/i.test(msg)) continue;
      console.warn(`[columnas] No se pudo agregar ${tabla}.${columna}:`, msg);
    }
  }
}

async function sembrarPreciosBase() {
  for (const precio of PRECIOS_BASE) {
    const ultimo = await prisma.precioPlan.findFirst({
      where: { plan: precio.plan, pais: precio.pais },
      orderBy: [{ version: 'desc' }],
    });

    if (!ultimo) {
      await prisma.precioPlan.create({
        data: {
          plan: precio.plan,
          pais: precio.pais,
          moneda: precio.moneda,
          monto: precio.monto,
          version: 1,
        },
      });
      console.log(`[precios] Creado precio base: ${precio.plan} / ${precio.pais} = ${precio.monto} ${precio.moneda}`);
    }
  }
}

async function backfillPrecioActualSalones() {
  const estudios = await prisma.estudio.findMany({
    where: { precioPlanActualId: null },
    select: { id: true, plan: true, pais: true },
  });

  if (estudios.length === 0) {
    console.log('[precios] Todos los salones ya tienen precio asignado');
    return;
  }

  let asignados = 0;
  for (const estudio of estudios) {
    const precio = await prisma.precioPlan.findFirst({
      where: { plan: estudio.plan, pais: estudio.pais },
      orderBy: [{ version: 'desc' }, { creadoEn: 'desc' }],
    });

    if (precio) {
      await prisma.estudio.update({
        where: { id: estudio.id },
        data: { precioPlanActualId: precio.id },
      });
      asignados++;
    }
  }

  console.log(`[precios] Backfill completado: ${asignados}/${estudios.length} salones actualizados`);
}

async function main() {
  console.log('[precios] Asegurando columnas, precios base y backfill de salones...');
  await asegurarColumnasRequeridas();
  await sembrarPreciosBase();
  await backfillPrecioActualSalones();
}

main()
  .catch((error) => {
    console.error('[precios] Error sembrando precios:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

