import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import { asegurarColumnaTabla } from './compatibilidadEsquema.js';

const NOMBRE_TABLA_PERSONAL = 'personal';
const NOMBRE_COLUMNA_REACTIVACION = 'reactivarEn';

function formatearFechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function parsearFechaBaseDatos(valor: unknown): Date | null {
  if (!valor) {
    return null;
  }

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor === 'string') {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

function calcularFechaReactivacion(desactivarHasta: string): Date {
  const [anio, mes, dia] = desactivarHasta.split('-').map(Number);
  return new Date(anio!, mes! - 1, dia! + 1, 0, 0, 0, 0);
}

function obtenerFechaVisibleDesactivacion(fechaReactivacion: Date): string {
  const fechaVisible = new Date(fechaReactivacion);
  fechaVisible.setDate(fechaVisible.getDate() - 1);
  return formatearFechaIso(fechaVisible);
}

export async function asegurarColumnaReactivacionPersonal(): Promise<boolean> {
  return asegurarColumnaTabla(NOMBRE_TABLA_PERSONAL, NOMBRE_COLUMNA_REACTIVACION, 'DATETIME NULL');
}

export async function obtenerDesactivadoHastaPersonal(personalId: string): Promise<string | null> {
  const columnaDisponible = await asegurarColumnaReactivacionPersonal();
  if (!columnaDisponible) {
    return null;
  }

  const filas = await prisma.$queryRaw<Array<{ reactivarEn: Date | string | null }>>`
    SELECT reactivarEn
    FROM personal
    WHERE id = ${personalId}
    LIMIT 1
  `;

  const fechaReactivacion = parsearFechaBaseDatos(filas[0]?.reactivarEn ?? null);
  if (!fechaReactivacion) {
    return null;
  }

  return obtenerFechaVisibleDesactivacion(fechaReactivacion);
}

export async function obtenerDesactivacionesProgramadasPersonal(
  personalIds: string[],
): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();

  if (personalIds.length === 0) {
    return mapa;
  }

  const columnaDisponible = await asegurarColumnaReactivacionPersonal();
  if (!columnaDisponible) {
    return mapa;
  }

  const idsUnicos = [...new Set(personalIds)];
  const filas = await prisma.$queryRaw<Array<{ id: string; reactivarEn: Date | string | null }>>(
    Prisma.sql`
      SELECT id, reactivarEn
      FROM personal
      WHERE id IN (${Prisma.join(idsUnicos)})
    `,
  );

  for (const fila of filas) {
    const fechaReactivacion = parsearFechaBaseDatos(fila.reactivarEn);
    mapa.set(
      fila.id,
      fechaReactivacion ? obtenerFechaVisibleDesactivacion(fechaReactivacion) : null,
    );
  }

  return mapa;
}

export async function sincronizarReactivacionesProgramadasPersonal(): Promise<void> {
  const columnaDisponible = await asegurarColumnaReactivacionPersonal();
  if (!columnaDisponible) {
    return;
  }

  const filas = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM personal
    WHERE activo = 0
      AND reactivarEn IS NOT NULL
      AND reactivarEn <= ${new Date()}
  `;

  if (filas.length === 0) {
    return;
  }

  const personalIds = filas.map((fila) => fila.id);

  await prisma.$transaction(async (tx) => {
    await tx.personal.updateMany({
      where: { id: { in: personalIds } },
      data: {
        activo: true,
        eliminadoEn: null,
      },
    });

    await tx.empleadoAcceso.updateMany({
      where: { personalId: { in: personalIds } },
      data: { activo: true },
    });
  });

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE personal
      SET reactivarEn = NULL
      WHERE id IN (${Prisma.join(personalIds)})
    `,
  );
}

export async function actualizarEstadoProgramadoPersonal(params: {
  personalId: string;
  activo: boolean;
  desactivarHasta?: string | null;
}): Promise<void> {
  const { personalId, activo, desactivarHasta } = params;

  const columnaDisponible = await asegurarColumnaReactivacionPersonal();
  const reactivarEn = !activo && desactivarHasta ? calcularFechaReactivacion(desactivarHasta) : null;

  await prisma.$transaction(async (tx) => {
    await tx.personal.update({
      where: { id: personalId },
      data: {
        activo,
        eliminadoEn: activo ? null : new Date(),
      },
    });

    await tx.empleadoAcceso.updateMany({
      where: { personalId },
      data: { activo },
    });
  });

  if (!columnaDisponible) {
    return;
  }

  await prisma.$executeRaw`
    UPDATE personal
    SET reactivarEn = ${reactivarEn}
    WHERE id = ${personalId}
  `;
}