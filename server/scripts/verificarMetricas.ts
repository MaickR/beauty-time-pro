import { prisma } from '../src/prismaCliente.js';

async function main() {
  const hoy = new Date().toISOString().split('T')[0]!;
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const [
    activos,
    suspendidos,
    bloqueados,
    pendientes,
    total,
    reservasHoy,
    reservas30d,
    pagosMXN,
    pagosCOP,
  ] = await Promise.all([
    prisma.estudio.count({ where: { estado: 'aprobado', activo: true } }),
    prisma.estudio.count({ where: { estado: 'suspendido' } }),
    prisma.estudio.count({ where: { estado: 'bloqueado' } }),
    prisma.estudio.count({ where: { estado: 'pendiente' } }),
    prisma.estudio.count(),
    prisma.reserva.count({ where: { fecha: hoy } }),
    prisma.reserva.count({ where: { fecha: { gte: hace30 } } }),
    prisma.pago.aggregate({ where: { moneda: 'MXN' }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { moneda: 'COP' }, _sum: { monto: true } }),
  ]);

  // Desglose ventas por plan
  const estudios = await prisma.estudio.findMany({
    select: { id: true, plan: true, pais: true },
  });

  const idsMxPro = estudios.filter((e) => e.pais === 'Mexico' && e.plan === 'PRO').map((e) => e.id);
  const idsMxStd = estudios.filter((e) => e.pais === 'Mexico' && e.plan === 'STANDARD').map((e) => e.id);
  const idsColPro = estudios.filter((e) => e.pais === 'Colombia' && e.plan === 'PRO').map((e) => e.id);
  const idsColStd = estudios.filter((e) => e.pais === 'Colombia' && e.plan === 'STANDARD').map((e) => e.id);

  const [vMxPro, vMxStd, vColPro, vColStd] = await Promise.all([
    idsMxPro.length ? prisma.pago.aggregate({ where: { estudioId: { in: idsMxPro } }, _sum: { monto: true } }) : { _sum: { monto: 0 } },
    idsMxStd.length ? prisma.pago.aggregate({ where: { estudioId: { in: idsMxStd } }, _sum: { monto: true } }) : { _sum: { monto: 0 } },
    idsColPro.length ? prisma.pago.aggregate({ where: { estudioId: { in: idsColPro } }, _sum: { monto: true } }) : { _sum: { monto: 0 } },
    idsColStd.length ? prisma.pago.aggregate({ where: { estudioId: { in: idsColStd } }, _sum: { monto: true } }) : { _sum: { monto: 0 } },
  ]);

  console.log('=== MÉTRICAS DIRECTAS DE BASE DE DATOS ===');
  console.log(JSON.stringify({
    total, activos, suspendidos, bloqueados, pendientes,
    'tarjeta_total_salones (activos+suspendidos)': activos + suspendidos,
    reservasHoy,
    reservas30d,
    'ventas_MXN_centavos': pagosMXN._sum.monto ?? 0,
    'ventas_COP_centavos': pagosCOP._sum.monto ?? 0,
    'ventas_MXN_pesos': (pagosMXN._sum.monto ?? 0) / 100,
    'ventas_COP_pesos': (pagosCOP._sum.monto ?? 0) / 100,
    desglose: {
      mexico: {
        pro: { salones: idsMxPro.length, monto_centavos: vMxPro._sum.monto ?? 0 },
        standard: { salones: idsMxStd.length, monto_centavos: vMxStd._sum.monto ?? 0 },
      },
      colombia: {
        pro: { salones: idsColPro.length, monto_centavos: vColPro._sum.monto ?? 0 },
        standard: { salones: idsColStd.length, monto_centavos: vColStd._sum.monto ?? 0 },
      },
    },
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
