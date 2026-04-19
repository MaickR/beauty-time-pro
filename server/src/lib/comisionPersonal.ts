import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import { asegurarColumnaTabla } from './compatibilidadEsquema.js';

const PORCENTAJE_COMISION_MINIMO = 0;
const PORCENTAJE_COMISION_MAXIMO = 100;
const PORCENTAJE_COMISION_BASE_PREDETERMINADO = 0;

export interface ConfiguracionComisionPersonal {
  porcentajeComisionBase: number;
  comisionServicios: Record<string, number>;
}

export interface ServicioComisionable {
  name: string;
  price: number;
  status?: string | null;
}

export interface DetalleComisionServicio {
  servicio: string;
  porcentajeComision: number;
  montoServicio: number;
  montoComision: number;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

export function normalizarPorcentajeComisionPersonal(
  valor: unknown,
  predeterminado = PORCENTAJE_COMISION_BASE_PREDETERMINADO,
): number {
  if (valor === null || valor === undefined || valor === '') {
    return predeterminado;
  }

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) {
    return predeterminado;
  }

  return Math.min(
    PORCENTAJE_COMISION_MAXIMO,
    Math.max(PORCENTAJE_COMISION_MINIMO, Math.round(numero)),
  );
}

export function normalizarClaveServicioComision(servicio: string): string {
  return servicio
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizarComisionServicios(valor: unknown): Record<string, number> {
  const origen = (() => {
    if (!valor) return null;
    if (typeof valor === 'string') {
      try {
        const parseado = JSON.parse(valor);
        return esRegistro(parseado) ? parseado : null;
      } catch {
        return null;
      }
    }
    return esRegistro(valor) ? valor : null;
  })();

  if (!origen) return {};

  const resultado: Record<string, number> = {};
  for (const [servicio, porcentaje] of Object.entries(origen)) {
    const nombreLimpio = servicio.trim();
    if (!nombreLimpio) continue;
    resultado[nombreLimpio] = normalizarPorcentajeComisionPersonal(
      porcentaje,
      PORCENTAJE_COMISION_BASE_PREDETERMINADO,
    );
  }

  return resultado;
}

export async function asegurarCamposComisionPersonal(): Promise<{
  porcentajeComisionBase: boolean;
  comisionPorServicio: boolean;
}> {
  const [porcentajeComisionBase, comisionPorServicio] = await Promise.all([
    asegurarColumnaTabla('personal', 'porcentajeComisionBase', 'INT NOT NULL DEFAULT 0'),
    asegurarColumnaTabla('personal', 'comisionPorServicio', 'JSON NULL'),
  ]);

  return { porcentajeComisionBase, comisionPorServicio };
}

type FilaComisionPersonal = {
  id: string;
  porcentajeComisionBase: number | null;
  comisionPorServicio: Prisma.JsonValue | string | null;
};

export async function obtenerConfiguracionesComisionPersonal(
  personalIds: string[],
): Promise<Map<string, ConfiguracionComisionPersonal>> {
  const configuraciones = new Map<string, ConfiguracionComisionPersonal>();
  if (personalIds.length === 0) return configuraciones;

  const columnas = await asegurarCamposComisionPersonal().catch(() => ({
    porcentajeComisionBase: false,
    comisionPorServicio: false,
  }));

  if (!columnas.porcentajeComisionBase && !columnas.comisionPorServicio) {
    for (const personalId of personalIds) {
      configuraciones.set(personalId, {
        porcentajeComisionBase: PORCENTAJE_COMISION_BASE_PREDETERMINADO,
        comisionServicios: {},
      });
    }
    return configuraciones;
  }

  const idsConsulta = Prisma.join(personalIds);
  const consulta = columnas.porcentajeComisionBase && columnas.comisionPorServicio
    ? Prisma.sql`
      SELECT id, porcentajeComisionBase, comisionPorServicio
      FROM personal
      WHERE id IN (${idsConsulta})
    `
    : columnas.porcentajeComisionBase
      ? Prisma.sql`
        SELECT id, porcentajeComisionBase, NULL as comisionPorServicio
        FROM personal
        WHERE id IN (${idsConsulta})
      `
      : Prisma.sql`
        SELECT id, 0 as porcentajeComisionBase, comisionPorServicio
        FROM personal
        WHERE id IN (${idsConsulta})
      `;

  const filas = await prisma.$queryRaw<FilaComisionPersonal[]>(consulta);

  for (const fila of filas) {
    configuraciones.set(fila.id, {
      porcentajeComisionBase: normalizarPorcentajeComisionPersonal(
        columnas.porcentajeComisionBase
          ? fila.porcentajeComisionBase
          : PORCENTAJE_COMISION_BASE_PREDETERMINADO,
        PORCENTAJE_COMISION_BASE_PREDETERMINADO,
      ),
      comisionServicios: columnas.comisionPorServicio
        ? normalizarComisionServicios(fila.comisionPorServicio)
        : {},
    });
  }

  for (const personalId of personalIds) {
    if (!configuraciones.has(personalId)) {
      configuraciones.set(personalId, {
        porcentajeComisionBase: PORCENTAJE_COMISION_BASE_PREDETERMINADO,
        comisionServicios: {},
      });
    }
  }

  return configuraciones;
}

export async function guardarConfiguracionComisionPersonal(
  personalId: string,
  configuracion: ConfiguracionComisionPersonal,
): Promise<void> {
  const columnas = await asegurarCamposComisionPersonal().catch(() => ({
    porcentajeComisionBase: false,
    comisionPorServicio: false,
  }));

  if (!columnas.porcentajeComisionBase && !columnas.comisionPorServicio) {
    return;
  }

  const porcentajeComisionBase = normalizarPorcentajeComisionPersonal(
    configuracion.porcentajeComisionBase,
    PORCENTAJE_COMISION_BASE_PREDETERMINADO,
  );
  const comisionServicios = normalizarComisionServicios(configuracion.comisionServicios);

  if (columnas.porcentajeComisionBase && columnas.comisionPorServicio) {
    await prisma.$executeRaw`
      UPDATE personal
      SET porcentajeComisionBase = ${porcentajeComisionBase},
          comisionPorServicio = ${JSON.stringify(comisionServicios)}
      WHERE id = ${personalId}
    `;
    return;
  }

  if (columnas.porcentajeComisionBase) {
    await prisma.$executeRaw`
      UPDATE personal
      SET porcentajeComisionBase = ${porcentajeComisionBase}
      WHERE id = ${personalId}
    `;
  }

  if (columnas.comisionPorServicio) {
    await prisma.$executeRaw`
      UPDATE personal
      SET comisionPorServicio = ${JSON.stringify(comisionServicios)}
      WHERE id = ${personalId}
    `;
  }
}

export function resolverPorcentajeComisionServicio(
  nombreServicio: string,
  configuracion: ConfiguracionComisionPersonal,
): number {
  const porcentajeBase = normalizarPorcentajeComisionPersonal(
    configuracion.porcentajeComisionBase,
    PORCENTAJE_COMISION_BASE_PREDETERMINADO,
  );

  const claveServicio = normalizarClaveServicioComision(nombreServicio);
  if (!claveServicio) return porcentajeBase;

  const porcentajePorServicio = Object.entries(configuracion.comisionServicios).find(
    ([servicio]) => normalizarClaveServicioComision(servicio) === claveServicio,
  )?.[1];

  if (porcentajePorServicio === undefined) {
    return porcentajeBase;
  }

  return normalizarPorcentajeComisionPersonal(porcentajePorServicio, porcentajeBase);
}

export function calcularComisionServiciosReserva(
  servicios: ServicioComisionable[],
  configuracion: ConfiguracionComisionPersonal,
): { comisionTotal: number; detalle: DetalleComisionServicio[] } {
  const detalle = servicios
    .filter((servicio) => !['cancelled', 'no_show'].includes(servicio.status ?? ''))
    .filter((servicio) => servicio.price > 0)
    .map((servicio) => {
      const porcentajeComision = resolverPorcentajeComisionServicio(servicio.name, configuracion);
      const montoComision = Math.round((servicio.price * porcentajeComision) / 100);

      return {
        servicio: servicio.name,
        porcentajeComision,
        montoServicio: servicio.price,
        montoComision,
      } satisfies DetalleComisionServicio;
    });

  return {
    comisionTotal: detalle.reduce((acumulado, item) => acumulado + item.montoComision, 0),
    detalle,
  };
}
