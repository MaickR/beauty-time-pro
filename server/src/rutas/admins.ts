import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import { esEmailAdminProtegido, verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import {
  resolverPorcentajesComisionVendedor,
} from '../lib/comisionVendedor.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { asegurarSalonDemoVendedor, obtenerCredencialesDemoVendedor } from '../lib/demoVendedor.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla } from '../lib/compatibilidadEsquema.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { esEmailColaboradorValido } from '../utils/validarEmail.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

const ROLES_COLABORADOR = ['maestro', 'supervisor', 'vendedor'] as const;
type RolColaborador = (typeof ROLES_COLABORADOR)[number];

function esRolColaboradorValido(valor: string): valor is RolColaborador {
  return (ROLES_COLABORADOR as readonly string[]).includes(valor);
}

function esAdminProtegido(admin: { email: string }): boolean {
  return esEmailAdminProtegido(admin.email);
}

function limpiarNombreColaborador(valor: string): string {
  return valor.normalize('NFC').replace(/[^\p{L}\p{M}\s'’-]/gu, '').replace(/\s+/g, ' ').trim();
}

function esNombreColaboradorValido(valor: string): boolean {
  return /^[\p{L}\p{M}\s'’-]{2,}$/u.test(limpiarNombreColaborador(valor));
}

function esPrismaErrorConCodigo(error: unknown, codigo: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === codigo
  );
}

const SOPORTA_PORCENTAJE_COMISION_PRO =
  'porcentajeComisionPro' in (Prisma.UsuarioScalarFieldEnum as Record<string, string>);

type ClientePrisma = Prisma.TransactionClient | typeof prisma;

const CAMPOS_PERMISOS_MAESTRO = [
  'aprobarSalones',
  'gestionarPagos',
  'crearAdmins',
  'verAuditLog',
  'verMetricas',
  'suspenderSalones',
  'esMaestroTotal',
] as const;

const CAMPOS_PERMISOS_SUPERVISOR = [
  'verTotalSalones',
  'verControlSalones',
  'verReservas',
  'verVentas',
  'verDirectorio',
  'editarDirectorio',
  'verControlCobros',
  'accionRecordatorio',
  'accionRegistroPago',
  'accionSuspension',
  'activarSalones',
  'verPreregistros',
] as const;

const PERMISOS_MAESTRO_TOTALES: {
  [K in (typeof CAMPOS_PERMISOS_MAESTRO)[number]]: boolean;
} = {
  aprobarSalones: true,
  gestionarPagos: true,
  crearAdmins: true,
  verAuditLog: true,
  verMetricas: true,
  suspenderSalones: true,
  esMaestroTotal: true,
};

const PERMISOS_SUPERVISOR_TOTALES: {
  [K in (typeof CAMPOS_PERMISOS_SUPERVISOR)[number]]: boolean;
} = {
  verTotalSalones: true,
  verControlSalones: true,
  verReservas: true,
  verVentas: true,
  verDirectorio: true,
  editarDirectorio: true,
  verControlCobros: true,
  accionRecordatorio: true,
  accionRegistroPago: true,
  accionSuspension: true,
  activarSalones: true,
  verPreregistros: true,
};

const CAMPOS_USUARIO_COLABORADOR = [
  'id',
  'email',
  'nombre',
  'rol',
  'porcentajeComision',
  'porcentajeComisionPro',
  'activo',
  'creadoEn',
  'ultimoAcceso',
] as const;

async function obtenerColaboradorObjetivo(id: string) {
  return prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, nombre: true, rol: true, activo: true },
  });
}

/** Genera una contraseña segura con crypto */
export function generarContrasenaSegura(longitud = 16): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = crypto.randomBytes(longitud);
  let resultado = '';
  for (let i = 0; i < longitud; i++) {
    resultado += caracteres[bytes[i]! % caracteres.length];
  }
  return resultado;
}

function normalizarPermisos(
  permisos: {
    aprobarSalones?: boolean;
    gestionarPagos?: boolean;
    crearAdmins?: boolean;
    verAuditLog?: boolean;
    verMetricas?: boolean;
    suspenderSalones?: boolean;
    esMaestroTotal?: boolean;
  } | undefined,
) {
  const permisosBase = {
    aprobarSalones: permisos?.aprobarSalones ?? false,
    gestionarPagos: permisos?.gestionarPagos ?? false,
    crearAdmins: permisos?.crearAdmins ?? false,
    verAuditLog: permisos?.verAuditLog ?? false,
    verMetricas: permisos?.verMetricas ?? false,
    suspenderSalones: permisos?.suspenderSalones ?? false,
    esMaestroTotal: permisos?.esMaestroTotal ?? false,
  };

  if (permisosBase.esMaestroTotal) {
    return {
      aprobarSalones: true,
      gestionarPagos: true,
      crearAdmins: true,
      verAuditLog: true,
      verMetricas: true,
      suspenderSalones: true,
      esMaestroTotal: true,
    };
  }

  return permisosBase;
}

function combinarPermisosMaestroEntrada(
  permisos:
    | {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  if (!usarTotalPorDefecto) {
    return normalizarPermisos(permisos);
  }

  return normalizarPermisos({
    ...PERMISOS_MAESTRO_TOTALES,
    ...permisos,
    esMaestroTotal: permisos?.esMaestroTotal ?? true,
  });
}

function normalizarPermisosSupervisor(
  permisosSupervisor:
    | {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      }
    | undefined,
) {
  return {
    verTotalSalones: permisosSupervisor?.verTotalSalones ?? false,
    verControlSalones: permisosSupervisor?.verControlSalones ?? false,
    verReservas: permisosSupervisor?.verReservas ?? false,
    verVentas: permisosSupervisor?.verVentas ?? false,
    verDirectorio: permisosSupervisor?.verDirectorio ?? false,
    editarDirectorio: permisosSupervisor?.editarDirectorio ?? false,
    verControlCobros: permisosSupervisor?.verControlCobros ?? false,
    accionRecordatorio: permisosSupervisor?.accionRecordatorio ?? false,
    accionRegistroPago: permisosSupervisor?.accionRegistroPago ?? false,
    accionSuspension: permisosSupervisor?.accionSuspension ?? false,
    activarSalones: permisosSupervisor?.activarSalones ?? false,
    verPreregistros: permisosSupervisor?.verPreregistros ?? false,
  };
}

function combinarPermisosSupervisorEntrada(
  permisosSupervisor:
    | {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  if (!usarTotalPorDefecto) {
    return normalizarPermisosSupervisor(permisosSupervisor);
  }

  return normalizarPermisosSupervisor({
    ...PERMISOS_SUPERVISOR_TOTALES,
    ...permisosSupervisor,
  });
}

function filtrarDatosPorColumnas(
  datos: Record<string, unknown>,
  columnasDisponibles: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(datos).filter(([llave, valor]) => columnasDisponibles.has(llave) && valor !== undefined),
  );
}

function construirSelectUsuariosCompat(columnasDisponibles: Set<string>) {
  const camposSeleccionables = SOPORTA_PORCENTAJE_COMISION_PRO
    ? [...CAMPOS_USUARIO_COLABORADOR]
    : CAMPOS_USUARIO_COLABORADOR.filter((campo) => campo !== 'porcentajeComisionPro');

  return construirSelectDesdeColumnas(columnasDisponibles, camposSeleccionables);
}

async function listarColaboradoresCompat() {
  const columnasUsuarios = await obtenerColumnasTabla('usuarios');
  const selectUsuarios = construirSelectUsuariosCompat(columnasUsuarios);

  const colaboradores = await prisma.usuario.findMany({
    where: { rol: { in: ['maestro', 'supervisor', 'vendedor'] } },
    select: {
      ...(selectUsuarios as Prisma.UsuarioSelect),
      permisos: {
        select: {
          aprobarSalones: true,
          gestionarPagos: true,
          crearAdmins: true,
          verAuditLog: true,
          verMetricas: true,
          suspenderSalones: true,
          esMaestroTotal: true,
        },
      },
      permisosSupervisor: {
        select: {
          verTotalSalones: true,
          verControlSalones: true,
          verReservas: true,
          verVentas: true,
          verDirectorio: true,
          editarDirectorio: true,
          verControlCobros: true,
          accionRecordatorio: true,
          accionRegistroPago: true,
          accionSuspension: true,
          activarSalones: true,
          verPreregistros: true,
        },
      },
    },
    orderBy: [{ activo: 'desc' }, { creadoEn: 'asc' }],
  });

  return colaboradores.map((colaborador) => {
    const datos = colaborador as Record<string, unknown>;
    const porcentajeComisionBase =
      typeof datos['porcentajeComision'] === 'number' ? (datos['porcentajeComision'] as number) : 0;
    const porcentajeComisionPro =
      typeof datos['porcentajeComisionPro'] === 'number'
        ? (datos['porcentajeComisionPro'] as number)
        : null;
    const porcentajesComision = resolverPorcentajesComisionVendedor({
      porcentajeComision: porcentajeComisionBase,
      porcentajeComisionPro,
    });

    return {
      ...colaborador,
      porcentajeComision: datos['rol'] === 'vendedor' ? porcentajesComision.standard : 0,
      porcentajeComisionPro: datos['rol'] === 'vendedor' ? porcentajesComision.pro : 0,
    };
  });
}

async function crearUsuarioCompat(
  _cliente: ClientePrisma,
  datos: {
    id: string;
    email: string;
    nombre: string;
    hashContrasena: string;
    rol: string;
    porcentajeComision: number;
    porcentajeComisionPro?: number;
    activo: boolean;
    emailVerificado: boolean;
  },
) {
  const columnasUsuarios = await obtenerColumnasTabla('usuarios');
  const marcaTiempoActual = new Date();
  const datosInsertables = filtrarDatosPorColumnas(
    {
      ...datos,
      ...(columnasUsuarios.has('creadoEn') ? { creadoEn: marcaTiempoActual } : {}),
      ...(columnasUsuarios.has('actualizadoEn') ? { actualizadoEn: marcaTiempoActual } : {}),
    },
    columnasUsuarios,
  );

  if (!Object.prototype.hasOwnProperty.call(datosInsertables, 'id')) {
    throw new Error('La tabla usuarios no contiene la columna id');
  }

  const entradasInsertables = Object.entries(datosInsertables);
  const columnasSql = entradasInsertables.map(([columna]) => `\`${columna}\``).join(', ');
  const placeholders = entradasInsertables.map(() => '?').join(', ');
  const valores = entradasInsertables.map(([, valor]) => valor);

  await prisma.$executeRawUnsafe(
    `INSERT INTO usuarios (${columnasSql}) VALUES (${placeholders})`,
    ...valores,
  );
}

async function actualizarUsuarioCompat(
  cliente: ClientePrisma,
  id: string,
  datos: Record<string, unknown>,
) {
  const columnasUsuarios = await obtenerColumnasTabla('usuarios');
  const datosActualizables = filtrarDatosPorColumnas(datos, columnasUsuarios);

  if (Object.keys(datosActualizables).length === 0) {
    return;
  }

  await cliente.usuario.updateMany({
    where: { id },
    data: datosActualizables as Prisma.UsuarioUpdateManyMutationInput,
  });
}

async function crearPermisosMaestroCompat(
  cliente: ClientePrisma,
  usuarioId: string,
  permisos:
    | {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  const columnas = await obtenerColumnasTabla('permisos_maestro');
  const datos = filtrarDatosPorColumnas(
    {
      usuarioId,
      ...combinarPermisosMaestroEntrada(permisos, usarTotalPorDefecto),
    },
    columnas,
  );

  if (!Object.prototype.hasOwnProperty.call(datos, 'usuarioId')) {
    throw new Error('La tabla permisos_maestro no contiene la columna usuarioId');
  }

  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_MAESTRO,
    'creadoEn',
    'actualizadoEn',
  ]);

  return cliente.permisosMaestro.create({
    data: datos as Prisma.PermisosMaestroUncheckedCreateInput,
    select: select as Prisma.PermisosMaestroSelect,
  });
}

async function upsertPermisosMaestroCompat(
  cliente: ClientePrisma,
  usuarioId: string,
  permisos:
    | {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  const columnas = await obtenerColumnasTabla('permisos_maestro');
  const datosCreate = filtrarDatosPorColumnas(
    {
      usuarioId,
      ...combinarPermisosMaestroEntrada(permisos, usarTotalPorDefecto),
    },
    columnas,
  );

  if (!Object.prototype.hasOwnProperty.call(datosCreate, 'usuarioId')) {
    throw new Error('La tabla permisos_maestro no contiene la columna usuarioId');
  }

  const { usuarioId: _omitUsuarioId, ...datosUpdate } = datosCreate;
  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_MAESTRO,
    'creadoEn',
    'actualizadoEn',
  ]);

  if (Object.keys(datosUpdate).length === 0) {
    const existente = await cliente.permisosMaestro.findUnique({
      where: { usuarioId },
      select: select as Prisma.PermisosMaestroSelect,
    });

    if (existente) {
      return existente;
    }

    return cliente.permisosMaestro.create({
      data: datosCreate as Prisma.PermisosMaestroUncheckedCreateInput,
      select: select as Prisma.PermisosMaestroSelect,
    });
  }

  return cliente.permisosMaestro.upsert({
    where: { usuarioId },
    create: datosCreate as Prisma.PermisosMaestroUncheckedCreateInput,
    update: datosUpdate as Prisma.PermisosMaestroUncheckedUpdateInput,
    select: select as Prisma.PermisosMaestroSelect,
  });
}

async function crearPermisosSupervisorCompat(
  cliente: ClientePrisma,
  usuarioId: string,
  permisosSupervisor:
    | {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  const columnas = await obtenerColumnasTabla('permisos_supervisor');
  const datos = filtrarDatosPorColumnas(
    {
      usuarioId,
      ...combinarPermisosSupervisorEntrada(permisosSupervisor, usarTotalPorDefecto),
    },
    columnas,
  );

  if (!Object.prototype.hasOwnProperty.call(datos, 'usuarioId')) {
    throw new Error('La tabla permisos_supervisor no contiene la columna usuarioId');
  }

  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_SUPERVISOR,
    'creadoEn',
    'actualizadoEn',
  ]);

  return cliente.permisosSupervisor.create({
    data: datos as Prisma.PermisosSupervisorUncheckedCreateInput,
    select: select as Prisma.PermisosSupervisorSelect,
  });
}

async function upsertPermisosSupervisorCompat(
  cliente: ClientePrisma,
  usuarioId: string,
  permisosSupervisor:
    | {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      }
    | undefined,
  usarTotalPorDefecto: boolean,
) {
  const columnas = await obtenerColumnasTabla('permisos_supervisor');
  const datosCreate = filtrarDatosPorColumnas(
    {
      usuarioId,
      ...combinarPermisosSupervisorEntrada(permisosSupervisor, usarTotalPorDefecto),
    },
    columnas,
  );

  if (!Object.prototype.hasOwnProperty.call(datosCreate, 'usuarioId')) {
    throw new Error('La tabla permisos_supervisor no contiene la columna usuarioId');
  }

  const { usuarioId: _omitUsuarioId, ...datosUpdate } = datosCreate;
  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_SUPERVISOR,
    'creadoEn',
    'actualizadoEn',
  ]);

  if (Object.keys(datosUpdate).length === 0) {
    const existente = await cliente.permisosSupervisor.findUnique({
      where: { usuarioId },
      select: select as Prisma.PermisosSupervisorSelect,
    });

    if (existente) {
      return existente;
    }

    return cliente.permisosSupervisor.create({
      data: datosCreate as Prisma.PermisosSupervisorUncheckedCreateInput,
      select: select as Prisma.PermisosSupervisorSelect,
    });
  }

  return cliente.permisosSupervisor.upsert({
    where: { usuarioId },
    create: datosCreate as Prisma.PermisosSupervisorUncheckedCreateInput,
    update: datosUpdate as Prisma.PermisosSupervisorUncheckedUpdateInput,
    select: select as Prisma.PermisosSupervisorSelect,
  });
}

async function obtenerPermisosMaestroCompat(usuarioId: string) {
  const columnas = await obtenerColumnasTabla('permisos_maestro');
  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_MAESTRO,
    'creadoEn',
    'actualizadoEn',
  ]);

  const registro = await prisma.permisosMaestro.findUnique({
    where: { usuarioId },
    select: select as Prisma.PermisosMaestroSelect,
  });

  if (!registro) {
    return null;
  }

  const datos = registro as Record<string, unknown>;
  return {
    aprobarSalones: Boolean(datos['aprobarSalones']),
    gestionarPagos: Boolean(datos['gestionarPagos']),
    crearAdmins: Boolean(datos['crearAdmins']),
    verAuditLog: Boolean(datos['verAuditLog']),
    verMetricas: Boolean(datos['verMetricas']),
    suspenderSalones: Boolean(datos['suspenderSalones']),
    esMaestroTotal: Boolean(datos['esMaestroTotal']),
  };
}

async function obtenerPermisosSupervisorCompat(usuarioId: string) {
  const columnas = await obtenerColumnasTabla('permisos_supervisor');
  const select = construirSelectDesdeColumnas(columnas, [
    'id',
    'usuarioId',
    ...CAMPOS_PERMISOS_SUPERVISOR,
    'creadoEn',
    'actualizadoEn',
  ]);

  const registro = await prisma.permisosSupervisor.findUnique({
    where: { usuarioId },
    select: select as Prisma.PermisosSupervisorSelect,
  });

  if (!registro) {
    return null;
  }

  const datos = registro as Record<string, unknown>;
  return {
    verTotalSalones: Boolean(datos['verTotalSalones']),
    verControlSalones: Boolean(datos['verControlSalones']),
    verReservas: Boolean(datos['verReservas']),
    verVentas: Boolean(datos['verVentas']),
    verDirectorio: Boolean(datos['verDirectorio']),
    editarDirectorio: Boolean(datos['editarDirectorio']),
    verControlCobros: Boolean(datos['verControlCobros']),
    accionRecordatorio: Boolean(datos['accionRecordatorio']),
    accionRegistroPago: Boolean(datos['accionRegistroPago']),
    accionSuspension: Boolean(datos['accionSuspension']),
    activarSalones: Boolean(datos['activarSalones']),
    verPreregistros: Boolean(datos['verPreregistros']),
  };
}

async function registrarAuditoriaNoBloqueante(
  solicitud: FastifyRequest,
  params: Parameters<typeof registrarAuditoria>[0],
  contexto: string,
): Promise<void> {
  try {
    await registrarAuditoria(params);
  } catch (error) {
    solicitud.log.warn({ err: error, contexto, entidadId: params.entidadId }, 'No se pudo registrar auditoría');
  }
}

export async function rutasAdmins(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/admins — Lista todos los colaboradores (admins, supervisores, vendedores)
   */
  servidor.get(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (_solicitud, respuesta) => {
      const colaboradores = await listarColaboradoresCompat();

      return respuesta.send({
        datos: colaboradores.map((col) => {
          const porcentajeComisionPro = (col as { porcentajeComisionPro?: number | null }).porcentajeComisionPro ?? null;
          const porcentajesComision = resolverPorcentajesComisionVendedor({
            porcentajeComision: col.porcentajeComision,
            porcentajeComisionPro,
          });

          return {
            ...col,
            porcentajeComision: col.rol === 'vendedor' ? porcentajesComision.standard : 0,
            porcentajeComisionPro: col.rol === 'vendedor' ? porcentajesComision.pro : 0,
            protegido: esAdminProtegido(col),
          };
        }),
      });
    },
  );

  /**
   * POST /admin/admins — Crear nuevo colaborador (admin, supervisor o vendedor)
   */
  servidor.post<{
    Body: {
      email: string;
      nombre: string;
      contrasena: string;
      cargo: string;
      porcentajeComision?: number;
      porcentajeComisionPro?: number;
      permisos?: {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      };
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const {
        email,
        nombre,
        contrasena,
        cargo,
        permisos,
        permisosSupervisor,
        porcentajeComision,
        porcentajeComisionPro,
      } = solicitud.body;

      if (!email || !nombre || !contrasena) {
        return respuesta.code(400).send({ error: 'email, nombre y contrasena son requeridos' });
      }

      if (!esNombreColaboradorValido(nombre)) {
        return respuesta.code(400).send({ error: 'El nombre solo admite letras y espacios' });
      }

      if (!esEmailColaboradorValido(email)) {
        return respuesta.code(400).send({ error: 'El correo no es válido o pertenece a un dominio temporal' });
      }

      if (!cargo || !esRolColaboradorValido(cargo)) {
        return respuesta.code(400).send({ error: 'El cargo debe ser: maestro, supervisor o vendedor' });
      }

      try {
        const existente = await prisma.usuario.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: { id: true },
        });

        if (existente) {
          return respuesta.code(409).send({ error: 'El correo ya está registrado' });
        }

        const hashContrasena = await generarHashContrasena(contrasena);
        const porcentajesComisionNormalizados =
          cargo === 'vendedor'
            ? resolverPorcentajesComisionVendedor({
                porcentajeComision,
                porcentajeComisionPro,
              })
            : { standard: 0, pro: 0 };

        const nuevoColaboradorId = crypto.randomUUID();

        await crearUsuarioCompat(prisma, {
          id: nuevoColaboradorId,
          email: email.trim().toLowerCase(),
          nombre: limpiarNombreColaborador(nombre),
          hashContrasena,
          rol: cargo,
          porcentajeComision: porcentajesComisionNormalizados.standard,
          ...(SOPORTA_PORCENTAJE_COMISION_PRO
            ? { porcentajeComisionPro: porcentajesComisionNormalizados.pro }
            : {}),
          activo: true,
          emailVerificado: true,
        });

        const nuevoColaborador = {
          id: nuevoColaboradorId,
          email: email.trim().toLowerCase(),
          nombre: limpiarNombreColaborador(nombre),
          rol: cargo,
        };

        // Crear permisos según el cargo, tolerando columnas faltantes en entornos legacy.
        if (cargo === 'maestro') {
          await crearPermisosMaestroCompat(prisma, nuevoColaborador.id, permisos, true);
        } else if (cargo === 'supervisor') {
          await crearPermisosSupervisorCompat(prisma, nuevoColaborador.id, permisosSupervisor, true);
        }
        // Vendedor no tiene permisos granulares

        const salonDemoVendedor =
          cargo === 'vendedor'
            ? await asegurarSalonDemoVendedor({
                usuarioId: nuevoColaborador.id,
                nombre: nuevoColaborador.nombre,
                email: nuevoColaborador.email,
              })
            : null;

        const claveReservasDemo = salonDemoVendedor?.claveCliente ?? null;
        const urlReservasDemo = claveReservasDemo ? `/reservar/${claveReservasDemo}` : null;

        const credencialesDemo =
          cargo === 'vendedor'
            ? obtenerCredencialesDemoVendedor({
                usuarioId: nuevoColaborador.id,
                emailBase: nuevoColaborador.email,
                nombreBase: nuevoColaborador.nombre,
                claveReservas: claveReservasDemo,
                urlReservas: urlReservasDemo,
              })
            : null;

        await registrarAuditoriaNoBloqueante(
          solicitud,
          {
            usuarioId: payload.sub,
            accion: 'crear_colaborador',
            entidadTipo: 'usuario',
            entidadId: nuevoColaborador.id,
            detalles: {
              email: nuevoColaborador.email,
              nombre: nuevoColaborador.nombre,
              cargo,
              porcentajeComision: porcentajesComisionNormalizados.standard,
              porcentajeComisionPro: porcentajesComisionNormalizados.pro,
            },
            ip: solicitud.ip,
            requestId: solicitud.id,
          },
          'crear_colaborador',
        );

        return respuesta.code(201).send({
          datos: {
            mensaje: 'Colaborador creado correctamente',
            id: nuevoColaborador.id,
            ...(credencialesDemo ? { demoVendedor: credencialesDemo } : {}),
          },
        });
      } catch (error) {
        solicitud.log.error(
          { err: error, email, cargo },
          'Error al crear colaborador',
        );

        if (esPrismaErrorConCodigo(error, 'P2002')) {
          return respuesta.code(409).send({ error: 'El correo ya está registrado' });
        }

        if (esPrismaErrorConCodigo(error, 'P2022')) {
          return respuesta
            .code(500)
            .send({ error: 'Configuración incompleta de base de datos para crear colaboradores.' });
        }

        return respuesta.code(500).send({ error: 'No se pudo crear el colaborador. Intenta de nuevo.' });
      }
    },
  );

  servidor.put<{
    Params: { id: string };
    Body: {
      email?: string;
      nombre?: string;
      contrasena?: string;
      cargo?: string;
      porcentajeComision?: number;
      porcentajeComisionPro?: number;
      permisos?: {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      };
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins/:id',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;
      const {
        email,
        nombre,
        contrasena,
        cargo,
        permisos,
        permisosSupervisor,
        porcentajeComision,
        porcentajeComisionPro,
      } = solicitud.body;

      const colaborador = await prisma.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          activo: true,
        },
      });

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      const emailNormalizado = email?.trim().toLowerCase();
      const cargoNormalizado = cargo?.trim();
      const siguienteCargo =
        cargoNormalizado && esRolColaboradorValido(cargoNormalizado)
          ? cargoNormalizado
          : colaborador.rol;
      const porcentajesComisionNormalizados =
        siguienteCargo === 'vendedor'
          ? resolverPorcentajesComisionVendedor({
              porcentajeComision,
              porcentajeComisionPro,
            })
          : { standard: 0, pro: 0 };

      if (cargoNormalizado && !esRolColaboradorValido(cargoNormalizado)) {
        return respuesta.code(400).send({ error: 'El cargo debe ser: maestro, supervisor o vendedor' });
      }

      if (emailNormalizado && emailNormalizado !== colaborador.email) {
        if (!esEmailColaboradorValido(emailNormalizado)) {
          return respuesta.code(400).send({ error: 'El correo no es válido o pertenece a un dominio temporal' });
        }

        const existente = await prisma.usuario.findUnique({
          where: { email: emailNormalizado },
          select: { id: true },
        });

        if (existente && existente.id !== colaborador.id) {
          return respuesta.code(409).send({ error: 'El correo ya está registrado' });
        }
      }

      if (contrasena && contrasena.length < 8) {
        return respuesta.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      const actualizacionUsuario: Record<string, unknown> = {};
      if (typeof nombre === 'string' && nombre.trim()) {
        if (!esNombreColaboradorValido(nombre)) {
          return respuesta.code(400).send({ error: 'El nombre solo admite letras y espacios' });
        }

        actualizacionUsuario['nombre'] = limpiarNombreColaborador(nombre);
      }
      if (emailNormalizado) {
        actualizacionUsuario['email'] = emailNormalizado;
      }
      if (cargoNormalizado && cargoNormalizado !== colaborador.rol) {
        actualizacionUsuario['rol'] = cargoNormalizado;
      }
      actualizacionUsuario['porcentajeComision'] = porcentajesComisionNormalizados.standard;
      if (SOPORTA_PORCENTAJE_COMISION_PRO) {
        actualizacionUsuario['porcentajeComisionPro'] = porcentajesComisionNormalizados.pro;
      }
      if (contrasena) {
        actualizacionUsuario['hashContrasena'] = await generarHashContrasena(contrasena);
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(actualizacionUsuario).length > 0) {
          await actualizarUsuarioCompat(tx, id, actualizacionUsuario);
        }

        if (siguienteCargo === 'maestro') {
          if (colaborador.rol !== 'maestro' || permisos !== undefined) {
            await upsertPermisosMaestroCompat(
              tx,
              id,
              permisos,
              colaborador.rol !== 'maestro' && permisos === undefined,
            );
          }
          await tx.permisosSupervisor.deleteMany({ where: { usuarioId: id } });
        } else if (siguienteCargo === 'supervisor') {
          if (colaborador.rol !== 'supervisor' || permisosSupervisor !== undefined) {
            await upsertPermisosSupervisorCompat(
              tx,
              id,
              permisosSupervisor,
              colaborador.rol !== 'supervisor' && permisosSupervisor === undefined,
            );
          }
          await tx.permisosMaestro.deleteMany({ where: { usuarioId: id } });
        } else {
          await tx.permisosMaestro.deleteMany({ where: { usuarioId: id } });
          await tx.permisosSupervisor.deleteMany({ where: { usuarioId: id } });
        }
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_actualizado');

      if (siguienteCargo === 'vendedor') {
        const nombreFinal = (actualizacionUsuario['nombre'] as string | undefined) ?? colaborador.nombre;
        const emailFinal = (actualizacionUsuario['email'] as string | undefined) ?? colaborador.email;

        await asegurarSalonDemoVendedor({
          usuarioId: id,
          nombre: nombreFinal,
          email: emailFinal,
        });
      }

      await registrarAuditoriaNoBloqueante(
        solicitud,
        {
          usuarioId: payload.sub,
          accion: 'actualizar_colaborador',
          entidadTipo: 'usuario',
          entidadId: id,
          detalles: {
            antes: {
              email: colaborador.email,
              nombre: colaborador.nombre,
              rol: colaborador.rol,
            },
            despues: {
              email: emailNormalizado ?? colaborador.email,
              nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : colaborador.nombre,
              rol: siguienteCargo,
              porcentajeComision: porcentajesComisionNormalizados.standard,
              porcentajeComisionPro: porcentajesComisionNormalizados.pro,
            },
            sesionRevocada: true,
          },
          ip: solicitud.ip,
          requestId: solicitud.id,
        },
        'actualizar_colaborador',
      );

      return respuesta.send({ datos: { mensaje: 'Colaborador actualizado correctamente' } });
    },
  );

  /**
   * PUT /admin/admins/:id/permisos — Actualizar permisos de un colaborador
   */
  servidor.put<{
    Params: { id: string };
    Body: {
      aprobarSalones?: boolean;
      gestionarPagos?: boolean;
      crearAdmins?: boolean;
      verAuditLog?: boolean;
      verMetricas?: boolean;
      suspenderSalones?: boolean;
      esMaestroTotal?: boolean;
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins/:id/permisos',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      if (colaborador.rol === 'maestro') {
        const permisosAnteriores = await obtenerPermisosMaestroCompat(id);
        const permisosNormalizados = normalizarPermisos(solicitud.body);

        const permisosActualizados = await upsertPermisosMaestroCompat(
          prisma,
          id,
          permisosNormalizados,
          false,
        );

        await registrarAuditoriaNoBloqueante(
          solicitud,
          {
            usuarioId: payload.sub,
            accion: 'actualizar_permisos',
            entidadTipo: 'usuario',
            entidadId: id,
            detalles: {
              requestId: solicitud.id,
              rolObjetivo: colaborador.rol,
              antes: permisosAnteriores,
              despues: permisosNormalizados,
            },
            ip: solicitud.ip,
            requestId: solicitud.id,
          },
          'actualizar_permisos_maestro',
        );

        await revocarSesionesPorSujeto('usuario', id, 'permisos_actualizados');

        return respuesta.send({ datos: permisosActualizados });
      }

      if (colaborador.rol === 'supervisor' && solicitud.body.permisosSupervisor) {
        const ps = solicitud.body.permisosSupervisor;
        const permisosAnteriores = await obtenerPermisosSupervisorCompat(id);
        const permisosNormalizados = normalizarPermisosSupervisor(ps);

        const permisosActualizados = await upsertPermisosSupervisorCompat(
          prisma,
          id,
          permisosNormalizados,
          false,
        );

        await registrarAuditoriaNoBloqueante(
          solicitud,
          {
            usuarioId: payload.sub,
            accion: 'actualizar_permisos',
            entidadTipo: 'usuario',
            entidadId: id,
            detalles: {
              requestId: solicitud.id,
              rolObjetivo: colaborador.rol,
              antes: permisosAnteriores,
              despues: permisosNormalizados,
            },
            ip: solicitud.ip,
            requestId: solicitud.id,
          },
          'actualizar_permisos_supervisor',
        );

        await revocarSesionesPorSujeto('usuario', id, 'permisos_actualizados');

        return respuesta.send({ datos: permisosActualizados });
      }

      return respuesta.send({ datos: { mensaje: 'Sin cambios de permisos para este cargo' } });
    },
  );

  /**
   * PUT /admin/admins/:id/desactivar — Desactivar un admin
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/admins/:id/desactivar',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_desactivado');

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'desactivar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: { cargo: colaborador.rol },
        ip: solicitud.ip,
        requestId: solicitud.id,
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador desactivado correctamente' } });
    },
  );

  servidor.put<{ Params: { id: string } }>(
    '/admin/admins/:id/activar',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: true },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'activar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: { cargo: colaborador.rol },
        ip: solicitud.ip,
        requestId: solicitud.id,
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador activado correctamente' } });
    },
  );

  servidor.delete<{ Params: { id: string } }>(
    '/admin/admins/:id',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'eliminar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: {
          email: colaborador.email,
          nombre: colaborador.nombre,
          cargo: colaborador.rol,
          requestId: solicitud.id,
        },
        ip: solicitud.ip,
        requestId: solicitud.id,
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_eliminado_desde_panel');

      await prisma.$transaction(async (tx) => {
        await tx.permisosMaestro.deleteMany({ where: { usuarioId: id } });
        await tx.permisosSupervisor.deleteMany({ where: { usuarioId: id } });
        await tx.tokenReset.deleteMany({ where: { usuarioId: id } });
        await tx.suscripcionPush.deleteMany({ where: { usuarioId: id } });
        await tx.auditLog.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } });
        await tx.usuario.delete({ where: { id } });
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador eliminado definitivamente' } });
    },
  );

  /**
   * GET /admin/admins/historial — Log de auditoría global
   */
  servidor.get<{ Querystring: { pagina?: string; limite?: string } }>(
    '/admin/admins/historial',
    { preHandler: [verificarJWT, requierePermiso('verAuditLog')] },
    async (solicitud, respuesta) => {
      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1'));
      const limite = Math.min(50, parseInt(solicitud.query.limite ?? '20'));
      const saltar = (pagina - 1) * limite;

      const [registros, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip: saltar,
          take: limite,
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            accion: true,
            entidadTipo: true,
            entidadId: true,
            detalles: true,
            ip: true,
            creadoEn: true,
            usuario: { select: { nombre: true, email: true } },
          },
        }),
        prisma.auditLog.count(),
      ]);

      return respuesta.send({ datos: { registros, total, pagina, limite } });
    },
  );
}

