import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';

const REGEX_IDENTIFICADOR_SQL = /^[A-Za-z0-9_]+$/;
const REGEX_DEFINICION_COLUMNA = /^[A-Za-z0-9_(),.'`\s-]+$/;

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

export async function asegurarColumnaTabla(
  tabla: string,
  columna: string,
  definicionSql: string,
): Promise<boolean> {
  const columnas = await obtenerColumnasTabla(tabla);
  if (columnas.has(columna)) {
    return true;
  }

  try {
    if (!REGEX_IDENTIFICADOR_SQL.test(tabla) || !REGEX_IDENTIFICADOR_SQL.test(columna)) {
      throw new Error('Identificador SQL inválido');
    }

    if (!REGEX_DEFINICION_COLUMNA.test(definicionSql)) {
      throw new Error('Definición SQL inválida');
    }

    await prisma.$executeRaw(
      Prisma.raw(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicionSql}`),
    );
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : '';
    if (!/Duplicate column name|already exists/i.test(mensaje)) {
      throw error;
    }
  }

  limpiarCacheCompatibilidadEsquema();
  const columnasActualizadas = await obtenerColumnasTabla(tabla);
  return columnasActualizadas.has(columna);
}

export function limpiarCacheCompatibilidadEsquema(): void {
  cacheColumnas.clear();
  cacheTablas = null;
}
