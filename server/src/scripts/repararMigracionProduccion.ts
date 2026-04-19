import { asegurarColumnaTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { ejecutarPrisma } from '../lib/prismaCli.js';
import { prisma } from '../prismaCliente.js';

interface ReparacionMigracion {
  nombre: string;
  tablasBase: string[];
  reparar: () => Promise<boolean>;
}

async function asegurarEnumEstadoSalon(): Promise<boolean> {
  try {
    // Verificar si el enum ya tiene los valores correctos
    const columnas = await prisma.$queryRaw<Array<{ COLUMN_TYPE: string }>>`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'estudios'
        AND COLUMN_NAME = 'estado'
    `;

    const tipo = columnas[0]?.COLUMN_TYPE ?? '';
    if (tipo.includes('suspendido') && tipo.includes('bloqueado')) {
      return true;
    }

    // Ampliar el enum para incluir suspendido y bloqueado
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`estudios\` MODIFY COLUMN \`estado\` ENUM('pendiente','aprobado','rechazado','suspendido','bloqueado') NOT NULL DEFAULT 'pendiente'`,
    );
    console.log('[migracion] ENUM estado ampliado con suspendido y bloqueado');
    return true;
  } catch (error) {
    console.error('[migracion] Error ampliando ENUM estado:', error);
    return false;
  }
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
    nombre: '20260330004244_estados_estudio',
    tablasBase: ['estudios'],
    reparar: async () => {
      const [enumOk, colSuspensionOk, colBloqueoOk, colMotivoBloqueoOk] = await Promise.all([
        asegurarEnumEstadoSalon(),
        asegurarColumnaTabla('estudios', 'fechaSuspension', 'DATETIME(3) NULL'),
        asegurarColumnaTabla('estudios', 'fechaBloqueo', 'DATETIME(3) NULL'),
        asegurarColumnaTabla('estudios', 'motivoBloqueo', 'VARCHAR(191) NULL'),
      ]);

      return enumOk && colSuspensionOk && colBloqueoOk && colMotivoBloqueoOk;
    },
  },
  {
    nombre: '20260614000000_porcentaje_comision_usuario',
    tablasBase: ['usuarios'],
    reparar: () => asegurarColumnaTabla('usuarios', 'porcentajeComision', 'INT NOT NULL DEFAULT 10'),
  },
  {
    nombre: '20260615000000_agregar_porcentaje_comision_pro',
    tablasBase: ['usuarios'],
    reparar: () => asegurarColumnaTabla('usuarios', 'porcentajeComisionPro', 'INT NOT NULL DEFAULT 10'),
  },
];

interface EstadoMigracion {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

async function ejecutarResolveMigracion(nombreMigracion: string): Promise<void> {
  await ejecutarPrisma(['migrate', 'resolve', '--applied', nombreMigracion]);
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

  await ejecutarResolveMigracion(configuracion.nombre);
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