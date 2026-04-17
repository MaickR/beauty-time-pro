import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asegurarColumnaTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { prisma } from '../prismaCliente.js';

const NOMBRE_MIGRACION = '20260318171150_agregar_pin_motivo_servicio';

interface EstadoMigracion {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

function obtenerDirectorioServidor(): string {
  const archivoActual = fileURLToPath(import.meta.url);
  return resolve(dirname(archivoActual), '..', '..');
}

function ejecutarResolveMigracion(): void {
  const comando = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const resultado = spawnSync(
    comando,
    ['prisma', 'migrate', 'resolve', '--applied', NOMBRE_MIGRACION],
    {
      cwd: obtenerDirectorioServidor(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (resultado.status !== 0) {
    throw new Error(`No se pudo resolver la migracion ${NOMBRE_MIGRACION}. Codigo: ${resultado.status ?? 'sin-codigo'}`);
  }
}

async function obtenerEstadosMigracion(): Promise<EstadoMigracion[]> {
  return prisma.$queryRaw<EstadoMigracion[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    WHERE migration_name = ${NOMBRE_MIGRACION}
    ORDER BY started_at DESC
  `;
}

async function repararMigracionParcial(): Promise<void> {
  const estados = await obtenerEstadosMigracion();
  const tieneFalloPendiente = estados.some(
    (estado) => estado.finished_at === null && estado.rolled_back_at === null,
  );

  if (!tieneFalloPendiente) {
    console.log(`[migracion] ${NOMBRE_MIGRACION}: sin fallos pendientes`);
    return;
  }

  const tablasDisponibles = await obtenerTablasDisponibles();
  if (!tablasDisponibles.has('estudios') || !tablasDisponibles.has('reserva_servicios')) {
    console.log(`[migracion] ${NOMBRE_MIGRACION}: no se puede reparar automaticamente porque faltan tablas base`);
    return;
  }

  console.log(`[migracion] ${NOMBRE_MIGRACION}: reparando estado parcial antes de prisma migrate deploy`);

  const [columnaPinOk, columnaMotivoOk] = await Promise.all([
    asegurarColumnaTabla('estudios', 'pinCancelacionHash', 'VARCHAR(191) NULL'),
    asegurarColumnaTabla('reserva_servicios', 'motivo', 'VARCHAR(191) NULL'),
  ]);

  if (!columnaPinOk || !columnaMotivoOk) {
    throw new Error(`No fue posible completar las columnas requeridas para ${NOMBRE_MIGRACION}`);
  }

  ejecutarResolveMigracion();
}

repararMigracionParcial()
  .catch((error) => {
    console.error('[migracion] Error reparando migracion de produccion:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });