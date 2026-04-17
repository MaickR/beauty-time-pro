import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asegurarColumnaTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { prisma } from '../prismaCliente.js';

interface ReparacionMigracion {
  nombre: string;
  tablasBase: string[];
  reparar: () => Promise<boolean>;
}

const REPARACIONES_MIGRACION: ReparacionMigracion[] = [
  {
    nombre: '20260318171150_agregar_pin_motivo_servicio',
    tablasBase: ['estudios', 'reserva_servicios'],
    reparar: async () => {
      const [columnaPinOk, columnaMotivoOk] = await Promise.all([
        asegurarColumnaTabla('estudios', 'pinCancelacionHash', 'VARCHAR(191) NULL'),
        asegurarColumnaTabla('reserva_servicios', 'motivo', 'VARCHAR(191) NULL'),
      ]);

      return columnaPinOk && columnaMotivoOk;
    },
  },
  {
    nombre: '20260614000000_porcentaje_comision_usuario',
    tablasBase: ['usuarios'],
    reparar: () => asegurarColumnaTabla('usuarios', 'porcentajeComision', 'INT NOT NULL DEFAULT 10'),
  },
];

interface EstadoMigracion {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

function obtenerDirectorioServidor(): string {
  const archivoActual = fileURLToPath(import.meta.url);
  return resolve(dirname(archivoActual), '..', '..');
}

function ejecutarResolveMigracion(nombreMigracion: string): void {
  const comando = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const resultado = spawnSync(
    comando,
    ['prisma', 'migrate', 'resolve', '--applied', nombreMigracion],
    {
      cwd: obtenerDirectorioServidor(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (resultado.status !== 0) {
    throw new Error(`No se pudo resolver la migracion ${nombreMigracion}. Codigo: ${resultado.status ?? 'sin-codigo'}`);
  }
}

async function obtenerEstadosMigracion(nombreMigracion: string): Promise<EstadoMigracion[]> {
  return prisma.$queryRaw<EstadoMigracion[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    WHERE migration_name = ${nombreMigracion}
    ORDER BY started_at DESC
  `;
}

async function repararMigracionParcial(configuracion: ReparacionMigracion): Promise<void> {
  const estados = await obtenerEstadosMigracion(configuracion.nombre);
  const tieneFalloPendiente = estados.some((estado) => estado.finished_at === null && estado.rolled_back_at === null);

  if (!tieneFalloPendiente) {
    console.log(`[migracion] ${configuracion.nombre}: sin fallos pendientes`);
    return;
  }

  const tablasDisponibles = await obtenerTablasDisponibles();
  const faltantes = configuracion.tablasBase.filter((tabla) => !tablasDisponibles.has(tabla));
  if (faltantes.length > 0) {
    console.log(
      `[migracion] ${configuracion.nombre}: no se puede reparar automaticamente porque faltan tablas base (${faltantes.join(', ')})`,
    );
    return;
  }

  console.log(`[migracion] ${configuracion.nombre}: reparando estado parcial antes de prisma migrate deploy`);

  const reparacionCompleta = await configuracion.reparar();
  if (!reparacionCompleta) {
    throw new Error(`No fue posible completar las columnas requeridas para ${configuracion.nombre}`);
  }

  ejecutarResolveMigracion(configuracion.nombre);
}

async function repararMigracionesPendientes(): Promise<void> {
  for (const configuracion of REPARACIONES_MIGRACION) {
    await repararMigracionParcial(configuracion);
  }
}

repararMigracionesPendientes()
  .catch((error) => {
    console.error('[migracion] Error reparando migracion de produccion:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });