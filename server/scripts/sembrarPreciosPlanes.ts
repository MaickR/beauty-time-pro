import { prisma } from '../src/prismaCliente.js';

async function sembrarPreciosBase() {
  const base = [
    { plan: 'STANDARD', pais: 'Mexico', moneda: 'MXN', monto: 70000 },
    { plan: 'STANDARD', pais: 'Colombia', moneda: 'COP', monto: 15000000 },
    { plan: 'PRO', pais: 'Mexico', moneda: 'MXN', monto: 100000 },
    { plan: 'PRO', pais: 'Colombia', moneda: 'COP', monto: 20000000 },
  ] as const;

  for (const precio of base) {
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
    }
  }
}

async function backfillPrecioActualSalones() {
  const estudios = await prisma.estudio.findMany({
    select: {
      id: true,
      plan: true,
      pais: true,
      precioPlanActualId: true,
    },
  });

  for (const estudio of estudios) {
    if (estudio.precioPlanActualId) {
      continue;
    }

    const precio = await prisma.precioPlan.findFirst({
      where: {
        plan: estudio.plan,
        pais: estudio.pais,
      },
      orderBy: [{ version: 'desc' }, { creadoEn: 'desc' }],
    });

    if (precio) {
      await prisma.estudio.update({
        where: { id: estudio.id },
        data: {
          precioPlanActualId: precio.id,
        },
      });
    }
  }
}

async function main() {
  await sembrarPreciosBase();
  await backfillPrecioActualSalones();

  const precios = await prisma.precioPlan.findMany({
    orderBy: [{ plan: 'asc' }, { pais: 'asc' }, { version: 'asc' }],
    select: {
      plan: true,
      pais: true,
      moneda: true,
      monto: true,
      version: true,
    },
  });

  console.log(JSON.stringify(precios, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
