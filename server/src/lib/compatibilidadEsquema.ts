import { prisma } from '../prismaCliente.js';

const cacheColumnas = new Map<string, Set<string>>();
let cacheTablas: Set<string> | null = null;

export async function obtenerColumnasTabla(tabla: string): Promise<Set<string>> {
  const nombreTabla = tabla.trim();
  const enCache = cacheColumnas.get(nombreTabla);
  if (enCache) {
    return enCache;
  }

  const filas = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${nombreTabla}
  `;

  const columnas = new Set(filas.map((fila) => fila.COLUMN_NAME));
  cacheColumnas.set(nombreTabla, columnas);
  return columnas;
}

export async function obtenerTablasDisponibles(): Promise<Set<string>> {
  if (cacheTablas) {
    return cacheTablas;
  }

  const filas = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
  `;

  cacheTablas = new Set(filas.map((fila) => fila.TABLE_NAME));
  return cacheTablas;
}

export function construirSelectDesdeColumnas(
  columnasDisponibles: Set<string>,
  columnasDeseadas: string[],
): Record<string, true> {
  return Object.fromEntries(
    columnasDeseadas.filter((columna) => columnasDisponibles.has(columna)).map((columna) => [columna, true]),
  );
}

export function limpiarCacheCompatibilidadEsquema(): void {
  cacheColumnas.clear();
  cacheTablas = null;
}
