import { prisma } from '../prismaCliente.js';

const PRECIOS_BASE = [
  { plan: 'STANDARD', pais: 'Mexico', moneda: 'MXN', monto: 70000 },
  { plan: 'STANDARD', pais: 'Colombia', moneda: 'COP', monto: 15000000 },
  { plan: 'PRO', pais: 'Mexico', moneda: 'MXN', monto: 100000 },
  { plan: 'PRO', pais: 'Colombia', moneda: 'COP', monto: 20000000 },
] as const;

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
  console.log('[precios] Asegurando precios base y backfill de salones...');
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
