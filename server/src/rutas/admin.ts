import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requiereAccesoAdministrativo, requierePermiso } from '../middleware/verificarPermiso.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla } from '../lib/compatibilidadEsquema.js';
import { cacheSalonesPublicos } from '../lib/cache.js';
import { enviarEmailBienvenidaSalon, enviarEmailRechazoSalon, enviarEmailCancelacionProcesada, enviarEmailRecordatorioPagoSalon } from '../servicios/servicioEmail.js';
import { generarHashContrasena } from '../utils/contrasenas.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { emailSchema, fechaIsoSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';
import {
  normalizarPlanEstudio,
  validarCantidadEmpleadosActivosPlan,
  validarCantidadServiciosPlan,
} from '../lib/planes.js';
import { generarClavesSalonUnicas } from '../lib/clavesSalon.js';
import { asegurarPrecioActualSalon, obtenerPrecioPlanActual, obtenerResumenSuscripcionesActivas } from '../lib/preciosPlanes.js';
import { obtenerFechaISOEnZona, obtenerZonaHorariaPorPais } from '../utils/zonasHorarias.js';
import { generarSlugUnico } from '../utils/generarSlug.js';
import { esEmailValido } from '../utils/validarEmail.js';
import {
  esNombrePersonaRegistroValido,
  esNombreSalonRegistroValido,
  esTelefonoSalonRegistroValido,
  limpiarNombrePersonaRegistro,
  limpiarNombreSalonRegistro,
  normalizarTelefonoSalonRegistro,
} from '../utils/registroSalon.js';

const esquemaNombreSalonRegistro = z
  .string()
  .trim()
  .min(2, 'El nombre del salón debe tener al menos 2 caracteres')
  .max(120, 'El nombre del salón no puede superar 120 caracteres')
  .refine(esNombreSalonRegistroValido, 'El nombre del salón solo admite letras, números y espacios')
  .transform(limpiarNombreSalonRegistro);

const esquemaNombrePersonaRegistro = z
  .string()
  .trim()
  .min(2, 'El nombre completo debe tener al menos 2 caracteres')
  .max(120, 'El nombre completo no puede superar 120 caracteres')
  .refine(esNombrePersonaRegistroValido, 'El nombre completo solo admite letras y espacios')
  .transform(limpiarNombrePersonaRegistro);

const esquemaTelefonoSalonRegistro = telefonoSchema
  .refine(esTelefonoSalonRegistroValido, 'El teléfono del salón debe tener exactamente 10 dígitos')
  .transform(normalizarTelefonoSalonRegistro);

const esquemaRechazoSolicitud = z.object({
  motivo: textoSchema('motivo', 500, 10),
});

const esquemaCrearSalonAdmin = z.object({
  nombreSalon: esquemaNombreSalonRegistro,
  nombreAdmin: esquemaNombrePersonaRegistro,
  email: emailSchema.refine(esEmailValido, 'Solo se aceptan correos personales permitidos (@gmail, @hotmail, @outlook o @yahoo)'),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono: esquemaTelefonoSalonRegistro,
  pais: z.enum(['Mexico', 'Colombia']).optional().default('Mexico'),
  plan: z.enum(['STANDARD', 'PRO']).optional().default('STANDARD'),
  estudioPrincipalId: z.string().trim().min(1, 'Debes seleccionar un salón principal').nullable().optional(),
  permiteReservasPublicas: z.boolean().optional().default(true),
  inicioSuscripcion: fechaIsoSchema.optional(),
  direccion: z.string().trim().max(180, 'La dirección no puede superar 180 caracteres').optional(),
  sucursales: z.array(esquemaNombreSalonRegistro).max(10, 'No puedes registrar más de 10 sucursales').optional().default([]),
  servicios: z.array(z.object({
    name: textoSchema('name', 120, 1),
    duration: z.number().int().min(1).max(480),
    price: z.number().int().min(100).max(999_999_999),
    category: z.string().trim().min(1).max(80).optional(),
  })).optional().default([]),
  productos: z.array(z.object({
    nombre: textoSchema('nombre', 120, 1),
    categoria: textoSchema('categoria', 80, 1).optional(),
    precio: z.number().int().min(100).max(999_999_999),
  })).optional().default([]),
  serviciosCustom: z.array(z.object({
    name: textoSchema('name', 120, 1),
    category: textoSchema('category', 80, 1),
  })).optional().default([]),
  personal: z.array(z.object({
    nombre: esquemaNombrePersonaRegistro,
    especialidades: z.array(z.string().trim()).default([]),
    horaInicio: z.string().optional(),
    horaFin: z.string().optional(),
    descansoInicio: z.string().optional(),
    descansoFin: z.string().optional(),
  })).optional().default([]),
});

function generarContrasenaAleatoria(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  result += 'ABCDEFGH'[randomInt(8)]!;
  result += '23456789'[randomInt(8)]!;
  for (let i = 0; i < 8; i++) {
    result += chars[randomInt(chars.length)]!;
  }
  return result;
}

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function obtenerFechaISOActual(zonaHoraria?: string | null, pais?: string | null): string {
  return obtenerFechaISOEnZona(new Date(), zonaHoraria ?? obtenerZonaHorariaPorPais(pais), pais);
}

function crearFechaDesdeISO(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return new Date(anio!, (mes! - 1), dia!);
}

function formatearFechaISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0]!;
}

function esPrismaErrorConCodigo(error: unknown, codigo: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === codigo
  );
}

async function obtenerSujetosAutenticacionEstudio(estudioId: string) {
  const [usuarios, accesosEmpleados] = await Promise.all([
    prisma.usuario.findMany({
      where: { estudioId },
      select: { id: true },
    }),
    prisma.empleadoAcceso.findMany({
      where: { personal: { estudioId } },
      select: { id: true },
    }),
  ]);

  return {
    usuarioIds: usuarios.map((usuario) => usuario.id),
    accesoEmpleadoIds: accesosEmpleados.map((acceso) => acceso.id),
  };
}

async function revocarAccesosEstudio(estudioId: string, motivo: string) {
  const { usuarioIds, accesoEmpleadoIds } = await obtenerSujetosAutenticacionEstudio(estudioId);

  await Promise.all([
    ...usuarioIds.map((usuarioId) => revocarSesionesPorSujeto('usuario', usuarioId, motivo)),
    ...accesoEmpleadoIds.map((accesoId) =>
      revocarSesionesPorSujeto('empleado_acceso', accesoId, motivo)
    ),
  ]);
}

function formatearFechaHoraSQL(fecha: Date): Date {
  return fecha;
}

function fechaInicioEsValidaParaAlta(fechaInicioISO: string, pais?: string | null): boolean {
  const zonaHoraria = obtenerZonaHorariaPorPais(pais);
  const hoyISO = obtenerFechaISOActual(zonaHoraria, pais);

  const fechaMaxima = crearFechaDesdeISO(hoyISO);
  fechaMaxima.setFullYear(fechaMaxima.getFullYear() + 10);
  const fechaMaximaISO = formatearFechaISO(fechaMaxima);

  return fechaInicioISO >= hoyISO && fechaInicioISO <= fechaMaximaISO;
}

function obtenerMonedaPorPais(pais?: string | null): 'MXN' | 'COP' {
  return pais === 'Colombia' ? 'COP' : 'MXN';
}

function esAdministradorConPermisos(rol: string): boolean {
  return rol === 'maestro' || rol === 'supervisor';
}

function calcularNuevaFechaVencimiento(params: {
  fechaVencimiento?: string | null;
  inicioSuscripcion?: string | null;
  meses: number;
  zonaHoraria?: string | null;
  pais?: string | null;
}): {
  fechaBase: string;
  nuevaFechaVencimiento: string;
  estrategia: 'desde_vencimiento_actual' | 'desde_hoy';
} {
  const hoy = obtenerFechaISOActual(params.zonaHoraria, params.pais);
  const fechaReferencia = params.fechaVencimiento || params.inicioSuscripcion || hoy;
  const fechaBase = fechaReferencia >= hoy ? fechaReferencia : hoy;
  const fechaCalculada = crearFechaDesdeISO(fechaBase);
  fechaCalculada.setMonth(fechaCalculada.getMonth() + params.meses);

  return {
    fechaBase,
    nuevaFechaVencimiento: formatearFechaISO(fechaCalculada),
    estrategia: fechaReferencia >= hoy ? 'desde_vencimiento_actual' : 'desde_hoy',
  };
}

function clasificarEstadoSalon(params: {
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado';
  activo: boolean;
  duenoActivo?: boolean;
}): 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado' {
  if (params.estado === 'rechazado' || params.estado === 'pendiente' || params.estado === 'bloqueado') {
    return params.estado;
  }

  if (params.estado === 'suspendido' || !params.activo || params.duenoActivo === false) {
    return 'suspendido';
  }

  return 'aprobado';
}

function esErrorCompatibilidadAdmin(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2022' ||
    /Unknown column/i.test(mensaje) ||
    /(plan|pinCancelacionHash|fechaSolicitud|fechaAprobacion|motivoRechazo|primeraVez|cancelacionSolicitada|fechaSolicitudCancelacion|motivoCancelacion|estudioPrincipalId|permiteReservasPublicas)/i.test(
      mensaje,
    )
  );
}

function esErrorCompatibilidadPago(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return codigo === 'P2022' || /Unknown column/i.test(mensaje) || /(tipo|referencia)/i.test(mensaje);
}

const seleccionarDuenoAdmin = {
  id: true,
  email: true,
  nombre: true,
  ultimoAcceso: true,
  activo: true,
} satisfies Prisma.UsuarioSelect;

const seleccionarSalonAdminModerno = {
  id: true,
  nombre: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  estado: true,
  plan: true,
  motivoRechazo: true,
  fechaSolicitud: true,
  fechaAprobacion: true,
  suscripcion: true,
  permiteReservasPublicas: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  emailContacto: true,
  creadoEn: true,
  actualizadoEn: true,
  usuarios: {
    where: { rol: 'dueno' },
    select: seleccionarDuenoAdmin,
    take: 1,
  },
} satisfies Prisma.EstudioSelect;

const seleccionarSalonAdminCompat = {
  id: true,
  nombre: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  suscripcion: true,
  permiteReservasPublicas: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  emailContacto: true,
  creadoEn: true,
  actualizadoEn: true,
  usuarios: {
    where: { rol: 'dueno' },
    select: seleccionarDuenoAdmin,
    take: 1,
  },
} satisfies Prisma.EstudioSelect;

const seleccionarSalonCreadoModerno = {
  id: true,
  nombre: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  estado: true,
  plan: true,
  permiteReservasPublicas: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  emailContacto: true,
  creadoEn: true,
  actualizadoEn: true,
  claveDueno: true,
  claveCliente: true,
} satisfies Prisma.EstudioSelect;

const seleccionarSalonCreadoCompat = {
  id: true,
  nombre: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  permiteReservasPublicas: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  emailContacto: true,
  creadoEn: true,
  actualizadoEn: true,
  claveDueno: true,
  claveCliente: true,
} satisfies Prisma.EstudioSelect;

function convertirFecha(valor: unknown): Date | null {
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
}

function obtenerDuenoSalon(estudio: Record<string, unknown>) {
  const usuarios = estudio['usuarios'];
  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    return null;
  }

  return usuarios[0] as {
    id?: string;
    email?: string;
    nombre?: string;
    ultimoAcceso?: Date | null;
    activo?: boolean;
  };
}

function normalizarEstadoSalonDesdeRegistro(
  estudio: Record<string, unknown>,
): 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado' {
  const dueno = obtenerDuenoSalon(estudio);
  const estado = estudio['estado'];

  if (
    estado === 'pendiente' ||
    estado === 'aprobado' ||
    estado === 'rechazado' ||
    estado === 'suspendido' ||
    estado === 'bloqueado'
  ) {
    return clasificarEstadoSalon({
      estado,
      activo: Boolean(estudio['activo']),
      duenoActivo: typeof dueno?.activo === 'boolean' ? dueno.activo : undefined,
    });
  }

  return Boolean(estudio['activo']) && dueno?.activo !== false ? 'aprobado' : 'suspendido';
}

function obtenerFechaSolicitudRegistro(estudio: Record<string, unknown>): Date {
  return convertirFecha(estudio['fechaSolicitud']) ?? convertirFecha(estudio['creadoEn']) ?? new Date();
}

async function validarEstudioPrincipalParaAlta(estudioPrincipalId: string): Promise<string | null> {
  const estudioPrincipal = await prisma.estudio.findUnique({
    where: { id: estudioPrincipalId },
    select: {
      id: true,
      activo: true,
      estado: true,
      estudioPrincipalId: true,
    },
  });

  if (!estudioPrincipal) {
    return 'El salón principal seleccionado no existe';
  }

  if (estudioPrincipal.estudioPrincipalId) {
    return 'Solo puedes asociar sedes a un salón principal';
  }

  if (!estudioPrincipal.activo || estudioPrincipal.estado !== 'aprobado') {
    return 'El salón principal seleccionado no está disponible';
  }

  return null;
}

function serializarSalonCreado(estudio: Record<string, unknown>) {
  return {
    ...estudio,
    plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
    estudioPrincipalId: (estudio['estudioPrincipalId'] as string | null | undefined) ?? null,
    permiteReservasPublicas:
      (estudio['permiteReservasPublicas'] as boolean | undefined) ?? true,
    estado: normalizarEstadoSalonDesdeRegistro(estudio),
    fechaSolicitud: convertirFecha(estudio['fechaSolicitud'])?.toISOString() ?? null,
    fechaAprobacion: convertirFecha(estudio['fechaAprobacion'])?.toISOString() ?? null,
  };
}

async function listarSalonesAdmin() {
  try {
    return await prisma.estudio.findMany({
      select: seleccionarSalonAdminModerno,
      orderBy: { creadoEn: 'asc' },
    });
  } catch (error) {
    if (!esErrorCompatibilidadAdmin(error)) {
      throw error;
    }

    return prisma.estudio.findMany({
      select: seleccionarSalonAdminCompat,
      orderBy: { creadoEn: 'asc' },
    });
  }
}

async function obtenerSalonAdminPorId(id: string) {
  try {
    return await prisma.estudio.findUnique({
      where: { id },
      select: seleccionarSalonAdminModerno,
    });
  } catch (error) {
    if (!esErrorCompatibilidadAdmin(error)) {
      throw error;
    }

    return prisma.estudio.findUnique({
      where: { id },
      select: seleccionarSalonAdminCompat,
    });
  }
}

async function crearSalonAdminCompat(
  cliente: Prisma.TransactionClient | typeof prisma,
  datos: {
    nombreSalon: string;
    nombreAdmin: string;
    telefono: string;
    pais: 'Mexico' | 'Colombia';
    estudioPrincipalId?: string | null;
    permiteReservasPublicas: boolean;
    claveDueno: string;
    claveCliente: string;
    emailNorm: string;
    fechaInicio: string;
    fechaVencimiento: string;
    horario: Record<string, { isOpen: boolean; openTime: string; closeTime: string }>;
    columnasEstudios: Set<string>;
  },
) {
  const data: Record<string, unknown> = {
    nombre: datos.nombreSalon,
    propietario: datos.nombreAdmin,
    telefono: datos.telefono,
    pais: datos.pais,
    estudioPrincipalId: datos.estudioPrincipalId ?? null,
    permiteReservasPublicas: datos.permiteReservasPublicas,
    sucursales: [],
    claveDueno: datos.claveDueno,
    claveCliente: datos.claveCliente,
    inicioSuscripcion: datos.fechaInicio,
    fechaVencimiento: datos.fechaVencimiento,
    horario: datos.horario,
    servicios: [],
    serviciosCustom: [],
    festivos: [],
    estado: 'aprobado',
    fechaAprobacion: new Date(),
  };

  if (datos.columnasEstudios.has('emailContacto')) {
    data['emailContacto'] = datos.emailNorm;
  }

  const select = construirSelectDesdeColumnas(datos.columnasEstudios, [
    'id',
    'nombre',
    'propietario',
    'telefono',
    'pais',
    'sucursales',
    'activo',
    'inicioSuscripcion',
    'fechaVencimiento',
    'creadoEn',
    'actualizadoEn',
    'claveDueno',
    'claveCliente',
    'estado',
    'plan',
    'emailContacto',
  ]);

  return cliente.estudio.create({
    data: data as Prisma.EstudioUncheckedCreateInput,
    select: select as Prisma.EstudioSelect,
  });
}

async function crearPagoAdminCompat(
  cliente: Prisma.TransactionClient | typeof prisma,
  datos: {
    estudioId: string;
    monto: number;
    moneda: 'MXN' | 'COP';
    concepto: string;
    fecha: string;
    columnasPago: Set<string>;
  },
) {
  const select = construirSelectDesdeColumnas(datos.columnasPago, [
    'id',
    'estudioId',
    'monto',
    'moneda',
    'concepto',
    'fecha',
    'tipo',
    'referencia',
    'creadoEn',
  ]);

  try {
    return await cliente.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
        tipo: 'suscripcion',
        referencia: 'alta_inicial',
      },
      select: select as Prisma.PagoSelect,
    });
  } catch (error) {
    if (!esErrorCompatibilidadPago(error)) {
      throw error;
    }

    return cliente.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
      },
      select: select as Prisma.PagoSelect,
    });
  }
}

async function insertarRegistroCompat(
  tabla: string,
  datos: Record<string, unknown>,
  columnasDisponibles?: Set<string>,
) {
  const datosLimpios = Object.fromEntries(
    Object.entries(datos).filter(([, valor]) => valor !== undefined),
  );
  if (Object.keys(datosLimpios).length === 0) {
    throw new Error(`No hay datos para insertar en ${tabla}`);
  }

  switch (tabla) {
    case 'estudios':
      await prisma.estudio.create({
        data: datosLimpios as Prisma.EstudioCreateInput,
        ...(columnasDisponibles
          ? {
              select: construirSelectDesdeColumnas(columnasDisponibles, [
                'id',
                'nombre',
                'propietario',
                'telefono',
                'pais',
                'estado',
                'activo',
                'plan',
                'emailContacto',
                'fechaVencimiento',
                'creadoEn',
              ]) as Prisma.EstudioSelect,
            }
          : {}),
      });
      return;
    case 'usuarios':
      await prisma.usuario.create({
        data: datosLimpios as Prisma.UsuarioCreateInput,
        ...(columnasDisponibles
          ? {
              select: construirSelectDesdeColumnas(columnasDisponibles, [
                'id',
                'email',
                'rol',
                'activo',
                'estudioId',
                'creadoEn',
              ]) as Prisma.UsuarioSelect,
            }
          : {}),
      });
      return;
    case 'personal':
      await prisma.personal.create({
        data: datosLimpios as Prisma.PersonalCreateInput,
        ...(columnasDisponibles
          ? {
              select: construirSelectDesdeColumnas(columnasDisponibles, [
                'id',
                'estudioId',
                'nombre',
                'activo',
              ]) as Prisma.PersonalSelect,
            }
          : {}),
      });
      return;
    case 'pagos':
      await prisma.pago.create({
        data: datosLimpios as Prisma.PagoCreateInput,
        ...(columnasDisponibles
          ? {
              select: construirSelectDesdeColumnas(columnasDisponibles, [
                'id',
                'estudioId',
                'monto',
                'moneda',
                'concepto',
                'fecha',
              ]) as Prisma.PagoSelect,
            }
          : {}),
      });
      return;
    default:
      throw new Error(`Tabla no soportada en inserción compat: ${tabla}`);
  }
}

async function actualizarRegistroCompat(
  tabla: string,
  whereCampo: string,
  whereValor: unknown,
  datos: Record<string, unknown>,
) {
  const datosLimpios = Object.fromEntries(
    Object.entries(datos).filter(([, valor]) => valor !== undefined),
  );
  if (Object.keys(datosLimpios).length === 0) {
    return;
  }

  switch (tabla) {
    case 'estudios':
      if (whereCampo !== 'id' || typeof whereValor !== 'string') break;
      await prisma.estudio.update({
        where: { id: whereValor },
        data: datosLimpios as Prisma.EstudioUpdateInput,
      });
      return;
    case 'usuarios':
      if (whereCampo !== 'id' || typeof whereValor !== 'string') break;
      await prisma.usuario.update({
        where: { id: whereValor },
        data: datosLimpios as Prisma.UsuarioUpdateInput,
      });
      return;
    default:
      break;
  }

  throw new Error(`Actualización compat no soportada: ${tabla}.${whereCampo}`);
}

async function eliminarRegistrosCompat(tabla: string, whereCampo: string, whereValor: unknown) {
  switch (tabla) {
    case 'personal':
      if (whereCampo !== 'estudioId' || typeof whereValor !== 'string') break;
      await prisma.personal.updateMany({
        where: { estudioId: whereValor },
        data: {
          activo: false,
          eliminadoEn: new Date(),
        },
      });
      return;
    case 'estudios':
      if (whereCampo !== 'id' || typeof whereValor !== 'string') break;
      await prisma.estudio.updateMany({
        where: { id: whereValor },
        data: {
          activo: false,
          estado: 'bloqueado',
          motivoBloqueo: 'alta_fallida_rollback',
          fechaBloqueo: new Date(),
        },
      });
      return;
    case 'usuarios':
      if (whereCampo !== 'id' || typeof whereValor !== 'string') break;
      await prisma.usuario.updateMany({
        where: { id: whereValor },
        data: { activo: false },
      });
      return;
    default:
      break;
  }

  throw new Error(`Eliminación compat no soportada: ${tabla}.${whereCampo}`);
}

async function buscarUsuarioPorEmailCompat(email: string) {
  return prisma.usuario.findFirst({
    where: { email },
    select: { id: true },
  });
}

async function buscarDuenoSalonCompat(estudioId: string, emailContacto?: string | null) {
  const columnasUsuarios = await obtenerColumnasTabla('usuarios');
  const columnasBase = ['id', 'email', 'nombre', 'activo', 'estudioId', 'rol'].filter((columna) =>
    columnasUsuarios.has(columna),
  );

  if (columnasBase.length === 0) {
    return null;
  }

  const seleccion = construirSelectDesdeColumnas(columnasUsuarios, columnasBase);

  const porEstudio = await prisma.usuario.findFirst({
    where: {
      estudioId,
      ...(columnasUsuarios.has('rol') ? { rol: 'dueno' } : {}),
    },
    select: seleccion as Prisma.UsuarioSelect,
  });

  if (porEstudio) {
    return porEstudio as Record<string, unknown>;
  }

  if (!emailContacto || !columnasUsuarios.has('email')) {
    return null;
  }

  const porEmail = await prisma.usuario.findFirst({
    where: {
      email: emailContacto,
      ...(columnasUsuarios.has('rol') ? { rol: 'dueno' } : {}),
    },
    select: seleccion as Prisma.UsuarioSelect,
  });

  return (porEmail as Record<string, unknown> | null) ?? null;
}

function normalizarCampoJSON(valor: unknown): unknown {
  if (typeof valor !== 'string') {
    return valor;
  }

  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

async function obtenerEstudioCreadoCompat(id: string, columnasEstudios: Set<string>) {
  const columnas = [
    'id',
    'nombre',
    'propietario',
    'telefono',
    'pais',
    'sucursales',
    'activo',
    'inicioSuscripcion',
    'fechaVencimiento',
    'creadoEn',
    'actualizadoEn',
    'claveDueno',
    'claveCliente',
    'estado',
    'plan',
    'emailContacto',
    'fechaSolicitud',
    'fechaAprobacion',
  ].filter((columna) => columnasEstudios.has(columna));

  if (columnas.length === 0) {
    return { id };
  }

  const seleccion = construirSelectDesdeColumnas(columnasEstudios, columnas);
  const estudio = (await prisma.estudio.findUnique({
    where: { id },
    select: seleccion as Prisma.EstudioSelect,
  })) as Record<string, unknown> | null;

  if (!estudio) {
    return null;
  }

  for (const campo of ['sucursales', 'horario', 'servicios', 'serviciosCustom', 'festivos']) {
    if (campo in estudio) {
      estudio[campo] = normalizarCampoJSON(estudio[campo]);
    }
  }

  return estudio;
}

export async function rutasAdmin(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/salones — lista todos los estudios con su usuario y último acceso
   * Soporta ?estado=pendiente|aprobado|rechazado|suspendido&pagina=1&limite=20
   */
  servidor.get<{ Querystring: { estado?: string; pagina?: string; limite?: string } }>(
    '/admin/salones',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { estado, pagina: paginaStr, limite: limiteStr } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '50', 10)));
      const saltar = (pagina - 1) * limite;

      const estadosValidos = ['pendiente', 'aprobado', 'rechazado', 'suspendido', 'bloqueado'];
      const estadoSolicitado =
        estado && estadosValidos.includes(estado)
          ? (estado as 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado')
          : null;

      const estudios = await listarSalonesAdmin();

      const auditorias = await prisma.auditLog.findMany({
        where: {
          entidadTipo: 'estudio',
          entidadId: { in: estudios.map((estudio) => estudio.id) },
          accion: { in: ['aprobar_salon', 'renovar_suscripcion'] },
        },
        include: {
          usuario: { select: { nombre: true, email: true } },
        },
        orderBy: { creadoEn: 'desc' },
      });

      const aprobacionesPorEstudio = new Map<string, (typeof auditorias)[number]>();
      const renovacionesPorEstudio = new Map<string, (typeof auditorias)[number]>();

      auditorias.forEach((auditoria) => {
        if (auditoria.accion === 'aprobar_salon' && !aprobacionesPorEstudio.has(auditoria.entidadId)) {
          aprobacionesPorEstudio.set(auditoria.entidadId, auditoria);
        }

        if (auditoria.accion === 'renovar_suscripcion' && !renovacionesPorEstudio.has(auditoria.entidadId)) {
          renovacionesPorEstudio.set(auditoria.entidadId, auditoria);
        }
      });

      const estudiosNormalizados = estudios
        .map((estudio) => {
          const estudioNormalizado = estudio as unknown as Record<string, unknown>;
          const dueno = obtenerDuenoSalon(estudioNormalizado);
          const estadoNormalizado = normalizarEstadoSalonDesdeRegistro(estudioNormalizado);
          const aprobacion = aprobacionesPorEstudio.get(estudio.id);
          const renovacion = renovacionesPorEstudio.get(estudio.id);

          return {
            ...estudio,
            estado: estadoNormalizado,
            plan: (estudioNormalizado['plan'] as string | undefined) ?? 'STANDARD',
            fechaSolicitud: convertirFecha(estudioNormalizado['fechaSolicitud'])?.toISOString() ?? null,
            fechaAprobacion: convertirFecha(estudioNormalizado['fechaAprobacion'])?.toISOString() ?? null,
            motivoRechazo: (estudioNormalizado['motivoRechazo'] as string | null | undefined) ?? null,
            aprobadoPorNombre: aprobacion?.usuario?.nombre ?? null,
            aprobadoPorEmail: aprobacion?.usuario?.email ?? null,
            renovadoPorNombre: renovacion?.usuario?.nombre ?? null,
            renovadoPorEmail: renovacion?.usuario?.email ?? null,
          };
        })
        .filter((estudio) => (estadoSolicitado ? estudio.estado === estadoSolicitado : true));

      const total = estudiosNormalizados.length;
      const items = estudiosNormalizados.slice(saltar, saltar + limite);
      return respuesta.send({ datos: items, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/solicitudes — estudios con estado pendiente ordenados por fechaSolicitud
   * Soporta ?pagina=1&limite=20
   */
  servidor.get<{ Querystring: { pagina?: string; limite?: string } }>(
    '/admin/solicitudes',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '50', 10)));
      const saltar = (pagina - 1) * limite;

      const solicitudesCompatibles = (await listarSalonesAdmin())
        .map((estudio) => {
          const estudioNormalizado = estudio as unknown as Record<string, unknown>;
          const estadoNormalizado = normalizarEstadoSalonDesdeRegistro(estudioNormalizado);

          return {
            ...estudio,
            estado: estadoNormalizado,
            fechaSolicitudCompat: obtenerFechaSolicitudRegistro(estudioNormalizado),
            dueno: obtenerDuenoSalon(estudioNormalizado),
            motivoRechazo: (estudioNormalizado['motivoRechazo'] as string | null | undefined) ?? null,
            plan: (estudioNormalizado['plan'] as string | undefined) ?? 'STANDARD',
          };
        })
        .filter((estudio) => estudio.estado === 'pendiente')
        .sort((a, b) => a.fechaSolicitudCompat.getTime() - b.fechaSolicitudCompat.getTime());

      const total = solicitudesCompatibles.length;
      const solicitudes = solicitudesCompatibles.slice(saltar, saltar + limite);

      const datos = solicitudes.map((s) => ({
        ...s,
        fechaSolicitud: s.fechaSolicitudCompat.toISOString(),
        diasDesdeRegistro: diasDesde(s.fechaSolicitudCompat),
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/solicitudes/:id — detalle completo de una solicitud
   */
  servidor.get<{ Params: { id: string } }>(
    '/admin/solicitudes/:id',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const estudio = await obtenerSalonAdminPorId(id);

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Solicitud no encontrada' });
      }

      const estudioNormalizado = estudio as unknown as Record<string, unknown>;

      const categorias = estudioNormalizado['categorias'];
      const categoriasFormateadas = typeof categorias === 'string'
        ? categorias.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      return respuesta.send({
        datos: {
          ...estudio,
          estado: normalizarEstadoSalonDesdeRegistro(estudioNormalizado),
          plan: (estudioNormalizado['plan'] as string | undefined) ?? 'STANDARD',
          motivoRechazo: (estudioNormalizado['motivoRechazo'] as string | null | undefined) ?? null,
          fechaSolicitud: obtenerFechaSolicitudRegistro(estudioNormalizado).toISOString(),
          fechaAprobacion: convertirFecha(estudioNormalizado['fechaAprobacion'])?.toISOString() ?? null,
          categoriasFormateadas,
          dueno: obtenerDuenoSalon(estudioNormalizado),
          diasDesdeRegistro: diasDesde(obtenerFechaSolicitudRegistro(estudioNormalizado)),
        },
      });
    },
  );

  /**
   * POST /admin/solicitudes/:id/aprobar — aprueba un salón
   */
  servidor.post<{ Params: { id: string }; Body?: { fechaVencimiento?: string } }>(
    '/admin/solicitudes/:id/aprobar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const fechaVencimiento = solicitud.body?.fechaVencimiento ?? (() => {
        const porDefecto = new Date();
        porDefecto.setDate(porDefecto.getDate() + 30);
        return porDefecto.toISOString().split('T')[0]!;
      })();

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      let usuario = estudio.usuarios[0] ?? null;
      if (!usuario && estudio.emailContacto) {
        usuario = await prisma.usuario.findFirst({
          where: { rol: 'dueno', email: estudio.emailContacto },
        });
      }

      if (!usuario) {
        return respuesta.code(400).send({ error: 'El salón no tiene usuario dueño' });
      }

      const [estudioActualizado] = await prisma.$transaction([
        prisma.estudio.update({
          where: { id },
          data: {
            estado: 'aprobado',
            activo: true,
            fechaAprobacion: new Date(),
            fechaVencimiento,
            categorias: resolverCategoriasSalon({
              categorias: estudio.categorias,
              servicios: estudio.servicios,
              serviciosCustom: estudio.serviciosCustom,
            }),
          },
        }),
        prisma.usuario.update({
          where: { id: usuario.id },
          data: { activo: true, estudioId: id },
        }),
      ]);

      console.log('[Admin] Salón aprobado:', estudio.nombre);
      cacheSalonesPublicos.flushAll(); // invalidar caché de salones públicos

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'aprobar_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, fechaVencimiento },
        ip: solicitud.ip,
      });

      void enviarEmailBienvenidaSalon({
        emailDestino: usuario.email,
        nombreDueno: usuario.nombre || estudio.propietario,
        nombreSalon: estudio.nombre,
        fechaVencimiento,
      });

      return respuesta.send({
        datos: {
          ...estudioActualizado,
          mensaje: 'Salón aprobado correctamente',
        },
      });
    },
  );

  /**
   * POST /admin/solicitudes/:id/rechazar — rechaza un salón con motivo
   */
  servidor.post<{ Params: { id: string }; Body: { motivo: string } }>(
    '/admin/solicitudes/:id/rechazar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const resultado = esquemaRechazoSolicitud.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { motivo } = resultado.data;

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: { estado: 'rechazado', motivoRechazo: motivo.trim() },
      });

      console.log('[Admin] Salón rechazado:', estudio.nombre);
      cacheSalonesPublicos.flushAll(); // invalidar caché de salones públicos

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'rechazar_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, motivo: motivo.trim() },
        ip: solicitud.ip,
      });

      const dueno = estudio.usuarios[0] ?? null;
      if (dueno?.email) {
        void enviarEmailRechazoSalon({
          emailDestino: dueno.email,
          nombreDueno: dueno.nombre || estudio.propietario,
          nombreSalon: estudio.nombre,
          motivo: motivo.trim(),
        });
      }

      return respuesta.send({ datos: { mensaje: 'Solicitud rechazada' } });
    },
  );

  /**
   * POST /admin/solicitudes/:id/reactivar — vuelve un salón rechazado a pendiente
   */
  servidor.post<{ Params: { id: string } }>(
    '/admin/solicitudes/:id/reactivar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: { estado: 'pendiente', motivoRechazo: null, fechaSolicitud: new Date() },
      });

      return respuesta.send({ datos: { mensaje: 'Solicitud reactivada' } });
    },
  );

  /**
   * POST /admin/salones — crea estudio + usuario dueño + personal inicial en transacción
   */
  servidor.post<{
    Body: {
      nombreSalon: string;
      nombreAdmin: string;
      email: string;
      contrasena: string;
      telefono?: string;
      pais?: string;
      plan?: 'STANDARD' | 'PRO';
      inicioSuscripcion?: string;
      servicios?: Array<{
        name: string;
        duration: number;
        price: number;
        category?: string;
      }>;
      serviciosCustom?: Array<{
        name: string;
        category: string;
      }>;
      personal?: Array<{
        nombre: string;
        especialidades: string[];
        horaInicio?: string;
        horaFin?: string;
        descansoInicio?: string;
        descansoFin?: string;
      }>;
    };
  }>(
    '/admin/salones',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { rol: string };
        if (!esAdministradorConPermisos(payload.rol)) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        const mostrarModalConfirmacion = payload.rol === 'maestro' || payload.rol === 'supervisor';

        const resultado = esquemaCrearSalonAdmin.safeParse(solicitud.body);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
        }

        const {
          nombreSalon,
          nombreAdmin,
          email,
          contrasena,
          telefono,
          pais,
          plan,
          estudioPrincipalId,
          permiteReservasPublicas,
          inicioSuscripcion,
          direccion,
          sucursales,
          servicios,
          productos,
          serviciosCustom,
          personal,
        } = resultado.data;
        const planNormalizado = normalizarPlanEstudio(plan);
        if (estudioPrincipalId) {
          const errorEstudioPrincipal = await validarEstudioPrincipalParaAlta(estudioPrincipalId);
          if (errorEstudioPrincipal) {
            return respuesta.code(400).send({ error: errorEstudioPrincipal });
          }
        }
        if (planNormalizado === 'STANDARD' && sucursales.length > 0) {
          return respuesta.code(400).send({
            error: 'Las sucursales adicionales solo están disponibles para el plan Pro',
          });
        }

        if (planNormalizado === 'STANDARD' && productos.length > 0) {
          return respuesta.code(400).send({
            error: 'Los productos solo están disponibles para el plan Pro',
          });
        }

        const errorServiciosPlan = validarCantidadServiciosPlan({
          plan: planNormalizado,
          cantidadNueva: servicios.length,
        });
        if (errorServiciosPlan) {
          return respuesta.code(400).send({ error: errorServiciosPlan, codigo: 'LIMITE_PLAN' });
        }

        const errorPersonalPlan = validarCantidadEmpleadosActivosPlan({
          plan: planNormalizado,
          cantidadNueva: personal.length,
        });
        if (errorPersonalPlan) {
          return respuesta.code(400).send({ error: errorPersonalPlan, codigo: 'LIMITE_PLAN' });
        }

        const emailNorm = email.trim().toLowerCase();
        const existente = await buscarUsuarioPorEmailCompat(emailNorm);
        if (existente) {
          return respuesta.code(409).send({ error: 'Ya existe un usuario con ese email' });
        }

        const hashContrasena = await generarHashContrasena(contrasena);

        const { claveDueno, claveCliente } = await generarClavesSalonUnicas(nombreSalon);
        const slugEstudio = await generarSlugUnico(nombreSalon);
        const sucursalesNormalizadas =
          planNormalizado === 'PRO'
            ? Array.from(
                new Set(
                  sucursales
                    .map((sucursal) => limpiarNombreSalonRegistro(sucursal))
                    .filter(Boolean),
                ),
              )
            : [];

        const zonaHorariaPais = obtenerZonaHorariaPorPais(pais);
        const fechaInicioISO = inicioSuscripcion ?? obtenerFechaISOActual(zonaHorariaPais, pais);

        if (!fechaInicioEsValidaParaAlta(fechaInicioISO, pais)) {
          return respuesta.code(400).send({
            error: 'La fecha de inicio de operaciones no es válida. Debe ser hoy o una fecha futura.',
          });
        }

        const fechaInicio = crearFechaDesdeISO(fechaInicioISO);
        fechaInicio.setHours(0, 0, 0, 0);

        const vencimiento = new Date(fechaInicio);
        vencimiento.setMonth(vencimiento.getMonth() + 1);

        const formatearFecha = (d: Date) =>
          obtenerFechaISOEnZona(d, zonaHorariaPais, pais);

        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const horario = Object.fromEntries(
          diasSemana.map((dia) => [dia, { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '19:00' }]),
        );

        const precioPlanActual = await obtenerPrecioPlanActual(planNormalizado, pais);
        if (!precioPlanActual) {
          return respuesta.code(500).send({
            error: `No existe un precio configurado para el plan ${planNormalizado} en ${pais}`,
          });
        }

        const monedaInicial = obtenerMonedaPorPais(pais);
        const montoInicial = precioPlanActual.monto;
        const [columnasEstudios, columnasUsuarios, columnasPersonal, columnasPagos] = await Promise.all([
          obtenerColumnasTabla('estudios'),
          obtenerColumnasTabla('usuarios'),
          obtenerColumnasTabla('personal'),
          obtenerColumnasTabla('pagos'),
        ]);
        const usuarioCreadoId = randomUUID();
        const estudioCreadoId = randomUUID();
        const marcaTiempoActual = formatearFechaHoraSQL(new Date());

        let estudio: Record<string, unknown> | null = null;

        try {
          await insertarRegistroCompat('estudios', {
            id: estudioCreadoId,
            nombre: nombreSalon,
            slug: slugEstudio,
            propietario: nombreAdmin,
            telefono,
            sitioWeb: null,
            ...(columnasEstudios.has('estudioPrincipalId') && {
              estudioPrincipalId: estudioPrincipalId ?? null,
            }),
            pais,
            ...(columnasEstudios.has('zonaHoraria') && { zonaHoraria: obtenerZonaHorariaPorPais(pais) }),
            ...(columnasEstudios.has('permiteReservasPublicas') && {
              permiteReservasPublicas,
            }),
            sucursales: estudioPrincipalId ? [] : sucursalesNormalizadas,
            claveDueno,
            claveCliente,
            activo: true,
            suscripcion: 'mensual',
            inicioSuscripcion: formatearFecha(fechaInicio),
            fechaVencimiento: formatearFecha(vencimiento),
            ...(columnasEstudios.has('precioPlanActualId') && { precioPlanActualId: precioPlanActual.id }),
            ...(columnasEstudios.has('precioPlanProximoId') && { precioPlanProximoId: null }),
            ...(columnasEstudios.has('fechaAplicacionPrecioProximo') && { fechaAplicacionPrecioProximo: null }),
            horario,
            servicios,
            serviciosCustom,
            festivos: [],
            ...(columnasEstudios.has('plan') && { plan: planNormalizado }),
            ...(columnasEstudios.has('estado') && { estado: 'aprobado' }),
            ...(columnasEstudios.has('emailContacto') && { emailContacto: emailNorm }),
            ...(columnasEstudios.has('direccion') && { direccion: direccion?.trim() || null }),
            ...(columnasEstudios.has('fechaSolicitud') && { fechaSolicitud: marcaTiempoActual }),
            ...(columnasEstudios.has('fechaAprobacion') && { fechaAprobacion: marcaTiempoActual }),
            ...(columnasEstudios.has('actualizadoEn') && { actualizadoEn: marcaTiempoActual }),
          }, columnasEstudios);

          await insertarRegistroCompat('usuarios', {
            id: usuarioCreadoId,
            email: emailNorm,
            hashContrasena,
            rol: 'dueno',
            estudioId: estudioCreadoId,
            ...(columnasUsuarios.has('nombre') && { nombre: nombreAdmin }),
            ...(columnasUsuarios.has('activo') && { activo: true }),
            ...(columnasUsuarios.has('emailVerificado') && { emailVerificado: true }),
            ...(columnasUsuarios.has('actualizadoEn') && { actualizadoEn: marcaTiempoActual }),
          }, columnasUsuarios);

          estudio = await obtenerEstudioCreadoCompat(
            estudioCreadoId,
            columnasEstudios,
          );
          if (!estudio) {
            throw new Error('No se pudo recuperar el salon recien creado');
          }

          if (personal.length > 0) {
            for (const persona of personal) {
              await insertarRegistroCompat('personal', {
                id: randomUUID(),
                estudioId: estudioCreadoId,
                nombre: persona.nombre,
                especialidades: persona.especialidades,
                ...(columnasPersonal.has('activo') && { activo: true }),
                ...(columnasPersonal.has('horaInicio') && { horaInicio: persona.horaInicio ?? null }),
                ...(columnasPersonal.has('horaFin') && { horaFin: persona.horaFin ?? null }),
                ...(columnasPersonal.has('descansoInicio') && {
                  descansoInicio: persona.descansoInicio ?? null,
                }),
                ...(columnasPersonal.has('descansoFin') && {
                  descansoFin: persona.descansoFin ?? null,
                }),
              }, columnasPersonal);
            }
          }

          if (productos.length > 0) {
            await prisma.producto.createMany({
              data: productos.map((producto) => ({
                estudioId: estudioCreadoId,
                nombre: producto.nombre.trim(),
                categoria: producto.categoria?.trim() || 'General',
                precio: producto.precio,
                activo: true,
              })),
            });
          }

          try {
            await insertarRegistroCompat('pagos', {
              id: randomUUID(),
              estudioId: estudioCreadoId,
              monto: montoInicial,
              moneda: monedaInicial,
              concepto: `Suscripción mensual Beauty Time Pro (${monedaInicial})`,
              fecha: formatearFecha(fechaInicio),
              ...(columnasPagos.has('tipo') && { tipo: 'suscripcion' }),
              ...(columnasPagos.has('referencia') && { referencia: 'alta_inicial' }),
            }, columnasPagos);
          } catch (error) {
            solicitud.log.warn({ err: error, estudioId: estudioCreadoId }, 'No se pudo registrar el pago inicial del salon');
          }
        } catch (error) {
          await eliminarRegistrosCompat('personal', 'estudioId', estudioCreadoId).catch(() => undefined);
          await eliminarRegistrosCompat('estudios', 'id', estudioCreadoId).catch(() => undefined);
          await eliminarRegistrosCompat('usuarios', 'id', usuarioCreadoId).catch(() => undefined);

          throw error;
        }

        return respuesta.code(201).send({
          datos: {
            estudio: serializarSalonCreado(estudio as unknown as Record<string, unknown>),
            acceso: {
              emailDueno: emailNorm,
              claveDueno,
              claveClientes: claveCliente,
              mostrarModalConfirmacion,
            },
          },
        });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al crear salon desde admin');
        return respuesta.code(500).send({
          error: 'No se pudo crear el salon',
        });
      }
    },
  );

  /**
   * PUT /admin/salones/:id/suspender — activa o desactiva el acceso
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/suspender',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      try {
        const columnasEstudios = await obtenerColumnasTabla('estudios');
        const columnasUsuarios = await obtenerColumnasTabla('usuarios');
        const estudio = await obtenerEstudioCreadoCompat(id, columnasEstudios);

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Salón no encontrado' });
        }

        const emailContacto =
          typeof estudio['emailContacto'] === 'string' ? estudio['emailContacto'] : null;
        const usuario = await buscarDuenoSalonCompat(id, emailContacto);
        const estaActivo =
          typeof usuario?.['activo'] === 'boolean'
            ? Boolean(usuario['activo'])
            : Boolean(estudio['activo']);
        const nuevoActivo = !estaActivo;
        const nuevoEstado = nuevoActivo ? 'aprobado' : 'suspendido';

        await actualizarRegistroCompat('estudios', 'id', id, {
          activo: nuevoActivo,
          ...(columnasEstudios.has('estado') && { estado: nuevoEstado }),
          ...(columnasEstudios.has('fechaSuspension') && !nuevoActivo && { fechaSuspension: new Date() }),
          ...(columnasEstudios.has('fechaSuspension') && nuevoActivo && { fechaSuspension: null }),
          ...(columnasEstudios.has('actualizadoEn') && { actualizadoEn: formatearFechaHoraSQL(new Date()) }),
        });

        if (usuario && typeof usuario['id'] === 'string') {
          await actualizarRegistroCompat('usuarios', 'id', usuario['id'], {
            ...(columnasUsuarios.has('activo') && { activo: nuevoActivo }),
            ...(columnasUsuarios.has('estudioId') && { estudioId: id }),
            ...(columnasUsuarios.has('actualizadoEn') && { actualizadoEn: formatearFechaHoraSQL(new Date()) }),
          });
        }

        if (!nuevoActivo) {
          await revocarAccesosEstudio(id, 'salon_suspendido_desde_admin');
        }

        try {
          await registrarAuditoria({
            usuarioId: payload.sub,
            accion: nuevoActivo ? 'activar_salon' : 'suspender_salon',
            entidadTipo: 'estudio',
            entidadId: id,
            ip: solicitud.ip,
          });
        } catch (error) {
          solicitud.log.warn(
            { err: error, estudioId: id, accion: nuevoActivo ? 'activar_salon' : 'suspender_salon' },
            'No se pudo registrar la auditoría del cambio de estado del salón',
          );
        }

        return respuesta.send({
          datos: { activo: nuevoActivo, mensaje: nuevoActivo ? 'Cuenta activada' : 'Cuenta suspendida' },
        });
      } catch (error) {
        solicitud.log.error({ err: error, estudioId: id }, 'Error al suspender/reactivar salón');
        return respuesta.code(500).send({ error: 'No se pudo cambiar el estado del salón' });
      }
    },
  );

  /**
   * PUT /admin/salones/:id/reset-contrasena — genera contraseña temporal y la devuelve
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/reset-contrasena',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      const usuario = await prisma.usuario.findFirst({
        where: { estudioId: id, rol: 'dueno' },
      });

      if (!usuario) {
        return respuesta.code(404).send({ error: 'Usuario dueño no encontrado para este salón' });
      }

      const contrasenaTemporal = generarContrasenaAleatoria();
      const nuevoHash = await generarHashContrasena(contrasenaTemporal);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { hashContrasena: nuevoHash },
      });

      // Se devuelve la contraseña en texto plano UNA sola vez — el frontend la muestra y no la almacena
      return respuesta.send({
        datos: { contrasenaTemporal, email: usuario.email },
      });
    },
  );

  servidor.put<{
    Params: { id: string };
    Body: { fechaVencimiento?: string; meses?: number };
  }>(
    '/admin/salones/:id',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { fechaVencimiento, meses } = solicitud.body;

      if (!fechaVencimiento && !meses) {
        return respuesta.code(400).send({ error: 'fechaVencimiento o meses es requerido' });
      }

      const columnasEstudios = await obtenerColumnasTabla('estudios');
      const estudio = await obtenerEstudioCreadoCompat(id, columnasEstudios);
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const fechaVencimientoActual =
        typeof estudio['fechaVencimiento'] === 'string' ? estudio['fechaVencimiento'] : null;
      const inicioSuscripcionActual =
        typeof estudio['inicioSuscripcion'] === 'string' ? estudio['inicioSuscripcion'] : null;
      const nombreSalon = typeof estudio['nombre'] === 'string' ? estudio['nombre'] : id;
      const paisSalon = typeof estudio['pais'] === 'string' ? estudio['pais'] : null;
      const zonaHorariaSalon = typeof estudio['zonaHoraria'] === 'string' ? estudio['zonaHoraria'] : null;

      const renovacion = meses && meses > 0
        ? calcularNuevaFechaVencimiento({
            fechaVencimiento: fechaVencimientoActual,
            inicioSuscripcion: inicioSuscripcionActual,
            meses,
            zonaHoraria: zonaHorariaSalon,
            pais: paisSalon,
          })
        : null;

      const fechaFinal = renovacion?.nuevaFechaVencimiento ?? fechaVencimiento!;

      await actualizarRegistroCompat('estudios', 'id', id, {
        fechaVencimiento: fechaFinal,
        ...(columnasEstudios.has('actualizadoEn') && { actualizadoEn: formatearFechaHoraSQL(new Date()) }),
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'renovar_suscripcion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: {
          nombre: nombreSalon,
          fechaBase: renovacion?.fechaBase ?? fechaVencimientoActual,
          fechaVencimientoAnterior: fechaVencimientoActual,
          fechaVencimientoNueva: fechaFinal,
          estrategia: renovacion?.estrategia ?? 'manual',
          meses: meses ?? null,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: {
          fechaVencimiento: fechaFinal,
          fechaBaseRenovacion: renovacion?.fechaBase ?? fechaVencimientoActual,
          estrategiaRenovacion: renovacion?.estrategia ?? 'manual',
          mensaje: renovacion
            ? 'Suscripción extendida correctamente'
            : 'Suscripción renovada correctamente',
        },
      });
    },
  );

  /**
   * POST /admin/salones/:id/recordatorio — envía recordatorio de pago (≤10 días)
   */
  servidor.post<{ Params: { id: string } }>(
    '/admin/salones/:id/recordatorio',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { rol: string; sub: string };
        if (!esAdministradorConPermisos(payload.rol)) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        const estudio = await prisma.estudio.findUnique({
          where: { id: solicitud.params.id },
          select: {
            id: true,
            nombre: true,
            fechaVencimiento: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { email: true, nombre: true },
            },
          },
        });

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Salón no encontrado' });
        }

        if (!estudio.fechaVencimiento) {
          return respuesta.code(400).send({ error: 'El salón no tiene fecha de vencimiento configurada' });
        }

        // Calcular días restantes
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const partesFecha = estudio.fechaVencimiento.split('-').map(Number);
        const fechaVencimiento = new Date(partesFecha[0]!, partesFecha[1]! - 1, partesFecha[2]!);
        const diasRestantes = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        const dentroVentanaRecordatorio = diasRestantes <= 10;

        const dueno = estudio.usuarios[0];
        if (dentroVentanaRecordatorio && !dueno?.email) {
          return respuesta.code(400).send({ error: 'El salón no tiene correo de contacto del dueño' });
        }

        if (dentroVentanaRecordatorio) {
          await enviarEmailRecordatorioPagoSalon({
            email: dueno!.email,
            nombreDueno: dueno?.nombre || 'equipo del salón',
            nombreSalon: estudio.nombre,
            fechaVencimiento: estudio.fechaVencimiento,
            diasRestantes: Math.max(0, diasRestantes),
          });

          // Crear notificación interna para el dashboard del salón.
          try {
            await prisma.notificacionEstudio.create({
              data: {
                estudioId: estudio.id,
                tipo: 'recordatorio_pago',
                titulo: 'Tu suscripción está por vencer',
                mensaje: `Quedan ${Math.max(0, diasRestantes)} día${diasRestantes !== 1 ? 's' : ''}. Comunícate con nosotros para renovar.`,
              },
            });
          } catch (errorNotificacion) {
            solicitud.log.warn(
              { err: errorNotificacion, estudioId: estudio.id },
              'No se pudo crear la notificación interna del recordatorio',
            );
          }
        }

        try {
          await registrarAuditoria({
            usuarioId: payload.sub,
            accion: 'recordatorio_pago_salon',
            entidadTipo: 'estudio',
            entidadId: estudio.id,
            detalles: {
              nombre: estudio.nombre,
              fechaVencimiento: estudio.fechaVencimiento,
              diasRestantes,
              emailDestino: dueno?.email ?? null,
              dentroVentanaRecordatorio,
            },
            ip: solicitud.ip,
          });
        } catch (errorAuditoria) {
          solicitud.log.warn(
            { err: errorAuditoria, estudioId: estudio.id },
            'No se pudo registrar auditoría del recordatorio',
          );
        }

        if (dentroVentanaRecordatorio) {
          return respuesta.send({ datos: { mensaje: 'Recordatorio enviado correctamente' } });
        }

        return respuesta.send({
          datos: {
            mensaje:
              'Recordatorio registrado. El sistema enviará notificación y correo automáticamente cuando falten 10 días o menos.',
          },
        });
      } catch (error) {
        solicitud.log.error(
          { err: error, estudioId: solicitud.params.id },
          'Error al enviar recordatorio de pago',
        );
        return respuesta.code(500).send({ error: 'No se pudo enviar el recordatorio' });
      }
    },
  );

  /**
   * POST /admin/salones/:id/aviso-suspension — suspende el salón y notifica al dueño
   */
  servidor.post<{ Params: { id: string } }>(
    '/admin/salones/:id/aviso-suspension',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { rol: string; sub: string };
        if (!esAdministradorConPermisos(payload.rol)) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        const { id } = solicitud.params;

        const estudio = await prisma.estudio.findUnique({
          where: { id },
          select: {
            id: true,
            nombre: true,
            estado: true,
            fechaVencimiento: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { id: true, email: true, nombre: true },
            },
          },
        });

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Salón no encontrado' });
        }

        if (estudio.estado === 'suspendido') {
          return respuesta.send({ datos: { mensaje: `El salón "${estudio.nombre}" ya se encuentra suspendido` } });
        }

        // Suspender el salón y su usuario dueño.
        try {
          await prisma.estudio.update({
            where: { id },
            data: {
              estado: 'suspendido',
              activo: false,
              fechaSuspension: new Date(),
            },
          });
        } catch (errorActualizacion) {
          solicitud.log.warn(
            { err: errorActualizacion, estudioId: id },
            'Fallo al guardar fecha de suspensión; reintentando sin fechaSuspension',
          );

          await prisma.estudio.update({
            where: { id },
            data: {
              estado: 'suspendido',
              activo: false,
            },
          });
        }

        const dueno = estudio.usuarios[0];
        if (dueno) {
          await prisma.usuario.update({
            where: { id: dueno.id },
            data: { activo: false },
          });
        }

        await revocarAccesosEstudio(id, 'salon_suspendido_por_falta_pago');

        // Crear notificación interna de suspensión (no bloqueante).
        try {
          await prisma.notificacionEstudio.create({
            data: {
              estudioId: id,
              tipo: 'suspension',
              titulo: 'Tu cuenta ha sido suspendida',
              mensaje: 'Tu suscripción fue suspendida por falta de pago. Contacta al equipo de Beauty Time Pro para reactivar tu cuenta.',
            },
          });
        } catch (errorNotificacion) {
          solicitud.log.warn(
            { err: errorNotificacion, estudioId: id },
            'No se pudo crear la notificación interna de suspensión',
          );
        }

        // Enviar email de suspensión al dueño (no bloqueante).
        if (dueno?.email) {
          try {
            await enviarEmailRecordatorioPagoSalon({
              email: dueno.email,
              nombreDueno: dueno.nombre || 'equipo del salón',
              nombreSalon: estudio.nombre,
              fechaVencimiento: estudio.fechaVencimiento,
            });
          } catch (errEmail) {
            solicitud.log.warn({ err: errEmail, estudioId: id }, 'No se pudo enviar email de suspensión');
          }
        }

        try {
          await registrarAuditoria({
            usuarioId: payload.sub,
            accion: 'suspender_salon',
            entidadTipo: 'estudio',
            entidadId: id,
            detalles: {
              nombre: estudio.nombre,
              motivo: 'falta_de_pago',
              fechaVencimiento: estudio.fechaVencimiento,
            },
            ip: solicitud.ip,
          });
        } catch (errorAuditoria) {
          solicitud.log.warn(
            { err: errorAuditoria, estudioId: id },
            'No se pudo registrar auditoría de suspensión',
          );
        }

        return respuesta.send({ datos: { mensaje: `Salón "${estudio.nombre}" suspendido correctamente` } });
      } catch (error) {
        solicitud.log.error(
          { err: error, estudioId: solicitud.params.id },
          'Error al suspender salón por falta de pago',
        );
        return respuesta.code(500).send({ error: 'No se pudo suspender el salón' });
      }
    },
  );

  /**
   * GET /admin/metricas — estadísticas globales de la plataforma
   */
  servidor.get(
    '/admin/metricas',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      const hace30DiasStr = hace30Dias.toISOString().split('T')[0]!;

      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() + 7);
      const hace7DiasStr = hace7Dias.toISOString().split('T')[0]!;

      const hace30DiasLimite = new Date();
      hace30DiasLimite.setDate(hace30DiasLimite.getDate() + 30);
      const hace30DiasLimiteStr = hace30DiasLimite.toISOString().split('T')[0]!;

      const hoy = new Date().toISOString().split('T')[0]!;

      const [
        totalSalones,
        salonesActivos,
        salonesPendientes,
        salonesSuspendidos,
        salonesVencidos,
        salonesPorVencer7Dias,
        salonesPorVencer30Dias,
        totalAdmins,
        totalAuditLogs,
        reservasHoy,
        reservasUltimos30Dias,
        ticketPromedioUltimos30Dias,
        salonesNuevosUltimos30Dias,
        solicitudesCreadasUltimos30Dias,
        salonesAprobadosUltimos30Dias,
        cancelacionesPendientes,
        resumenSuscripcionesActivas,
      ] = await Promise.all([
        prisma.estudio.count(),
        prisma.estudio.count({ where: { estado: 'aprobado', activo: true } }),
        prisma.estudio.count({ where: { estado: 'pendiente' } }),
        prisma.estudio.count({ where: { estado: 'suspendido' } }),
        prisma.estudio.count({
          where: { estado: 'aprobado', activo: true, fechaVencimiento: { lt: hoy } },
        }),
        prisma.estudio.count({
          where: {
            estado: 'aprobado',
            activo: true,
            fechaVencimiento: { gte: hoy, lte: hace7DiasStr },
          },
        }),
        prisma.estudio.count({
          where: {
            estado: 'aprobado',
            activo: true,
            fechaVencimiento: { gte: hoy, lte: hace30DiasLimiteStr },
          },
        }),
        prisma.usuario.count({ where: { rol: 'maestro', activo: true } }),
        prisma.auditLog.count(),
        prisma.reserva.count({ where: { fecha: hoy } }),
        prisma.reserva.count({
          where: { fecha: { gte: hace30DiasStr } },
        }),
        prisma.reserva.aggregate({
          where: {
            fecha: { gte: hace30DiasStr },
            estado: { not: 'cancelled' },
          },
          _avg: { precioTotal: true },
        }),
        prisma.estudio.count({
          where: { creadoEn: { gte: hace30Dias } },
        }),
        prisma.estudio.count({
          where: { fechaSolicitud: { gte: hace30Dias } },
        }),
        prisma.estudio.count({
          where: { fechaAprobacion: { gte: hace30Dias } },
        }),
        prisma.estudio.count({ where: { cancelacionSolicitada: true } }),
        obtenerResumenSuscripcionesActivas(),
      ]);

      const promedioReservasPorSalonActivo =
        salonesActivos > 0 ? Number((reservasUltimos30Dias / salonesActivos).toFixed(1)) : 0;
      const tasaAprobacionUltimos30Dias =
        solicitudesCreadasUltimos30Dias > 0
          ? Number(
              ((salonesAprobadosUltimos30Dias / solicitudesCreadasUltimos30Dias) * 100).toFixed(1),
            )
          : 0;

      const ingresosPorMoneda = [
        {
          moneda: 'MXN',
          actual: resumenSuscripcionesActivas.porPais.Mexico.total,
          anterior: resumenSuscripcionesActivas.porPais.Mexico.total,
          variacion: 0,
        },
        {
          moneda: 'COP',
          actual: resumenSuscripcionesActivas.porPais.Colombia.total,
          anterior: resumenSuscripcionesActivas.porPais.Colombia.total,
          variacion: 0,
        },
      ];

      return respuesta.send({
        datos: {
          totalSalones,
          salonesActivos,
          salonesPendientes,
          salonesSuspendidos,
          salonesVencidos,
          salonesPorVencer7Dias,
          salonesPorVencer30Dias,
          totalAdmins,
          totalAuditLogs,
          reservasHoy,
          reservasUltimos30Dias,
          ticketPromedioUltimos30Dias: ticketPromedioUltimos30Dias._avg.precioTotal ?? 0,
          promedioReservasPorSalonActivo,
          salonesNuevosUltimos30Dias,
          tasaAprobacionUltimos30Dias,
          cancelacionesPendientes,
          ingresosPorMoneda,
        },
      });
    },
  );

  /**
   * GET /admin/cancelaciones — salones con solicitud de cancelación pendiente
   */
  servidor.get(
    '/admin/cancelaciones',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const salones = await prisma.estudio.findMany({
        where: { cancelacionSolicitada: true },
        select: {
          id: true,
          nombre: true,
          fechaVencimiento: true,
          cancelacionSolicitada: true,
          fechaSolicitudCancelacion: true,
          motivoCancelacion: true,
          usuarios: {
            where: { rol: 'dueno' },
            take: 1,
            select: { id: true, email: true, nombre: true },
          },
        },
        orderBy: { fechaSolicitudCancelacion: 'asc' },
      });

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        fechaVencimiento: s.fechaVencimiento,
        cancelacionSolicitada: s.cancelacionSolicitada,
        fechaSolicitudCancelacion: s.fechaSolicitudCancelacion?.toISOString() ?? null,
        motivoCancelacion: s.motivoCancelacion,
        dueno: s.usuarios[0] ?? null,
      }));

      return respuesta.send({ datos });
    },
  );

  /**
   * POST /admin/salones/:id/procesar-cancelacion — aprueba o rechaza la solicitud
   */
  servidor.post<{ Params: { id: string }; Body: { accion: 'aprobar' | 'rechazar'; respuesta?: string } }>(
    '/admin/salones/:id/procesar-cancelacion',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { accion, respuesta: respuestaMaestro } = solicitud.body;

      if (accion !== 'aprobar' && accion !== 'rechazar') {
        return respuesta.code(400).send({ error: 'accion debe ser "aprobar" o "rechazar"' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      if (!estudio.cancelacionSolicitada) {
        return respuesta.code(400).send({ error: 'Este salón no tiene una solicitud de cancelación pendiente' });
      }

      if (accion === 'aprobar') {
        await prisma.$transaction(async (tx) => {
          await tx.estudio.update({
            where: { id },
            data: {
              activo: false,
              estado: 'suspendido',
              cancelacionSolicitada: false,
              fechaSolicitudCancelacion: null,
              motivoCancelacion: null,
            },
          });

          const dueno = estudio.usuarios[0];
          if (dueno) {
            await tx.usuario.update({
              where: { id: dueno.id },
              data: { activo: false },
            });
          }
        });

        await revocarAccesosEstudio(id, 'cancelacion_aprobada_por_admin');
      } else {
        await prisma.estudio.update({
          where: { id },
          data: {
            cancelacionSolicitada: false,
            fechaSolicitudCancelacion: null,
            motivoCancelacion: null,
          },
        });
      }

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: accion === 'aprobar' ? 'aprobar_cancelacion' : 'rechazar_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, accion, respuesta: respuestaMaestro ?? null },
        ip: solicitud.ip,
      });

      const dueno = estudio.usuarios[0];
      if (dueno?.email) {
        void enviarEmailCancelacionProcesada({
          email: dueno.email,
          nombreSalon: estudio.nombre,
          aprobada: accion === 'aprobar',
          respuesta: respuestaMaestro,
        });
      }

      return respuesta.send({
        datos: {
          mensaje: accion === 'aprobar' ? 'Cancelación aprobada. El salón ha sido suspendido.' : 'Solicitud rechazada.',
        },
      });
    },
  );

  // ── GET /admin/preregistros ───────────────────────────────────────────────
  // Lista todos los preregistros de vendedores. Filtrable por estado.
  servidor.get<{
    Querystring: { estado?: string; pagina?: string; limite?: string };
  }>(
    '/admin/preregistros',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const { estado, pagina = '1', limite = '20' } = solicitud.query;
      const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
      const limiteNum = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));

      const where: Prisma.PreregistroSalonWhereInput = {};
      if (estado && ['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
        where.estado = estado;
      }

      const [preregistros, total] = await Promise.all([
        prisma.preregistroSalon.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          skip: (paginaNum - 1) * limiteNum,
          take: limiteNum,
          include: {
            vendedor: { select: { id: true, nombre: true, email: true } },
          },
        }),
        prisma.preregistroSalon.count({ where }),
      ]);

      return respuesta.send({
        datos: preregistros.map((pr) => ({
          id: pr.id,
          nombreSalon: pr.nombreSalon,
          propietario: pr.propietario,
          emailPropietario: pr.emailPropietario,
          telefonoPropietario: pr.telefonoPropietario,
          pais: pr.pais,
          direccion: pr.direccion,
          descripcion: pr.descripcion,
          categorias: pr.categorias,
          plan: pr.plan,
          estado: pr.estado,
          motivoRechazo: pr.motivoRechazo,
          estudioCreadoId: pr.estudioCreadoId,
          notas: pr.notas,
          vendedor: pr.vendedor,
          creadoEn: pr.creadoEn,
          actualizadoEn: pr.actualizadoEn,
        })),
        total,
        pagina: paginaNum,
        limite: limiteNum,
      });
    },
  );

  // ── POST /admin/preregistros/:id/aprobar ─────────────────────────────────
  // Aprueba un preregistro de vendedor → crea estudio + usuario dueño
  servidor.post<{ Params: { id: string }; Body: { contrasena?: string; inicioSuscripcion?: string } }>(
    '/admin/preregistros/:id/aprobar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      const { id } = solicitud.params;
      const { contrasena: contrasenaManual, inicioSuscripcion } = solicitud.body ?? {};

      const preregistro = await prisma.preregistroSalon.findUnique({ where: { id } });
      if (!preregistro) {
        return respuesta.code(404).send({ error: 'Preregistro no encontrado' });
      }
      if (preregistro.estado !== 'pendiente') {
        return respuesta.code(400).send({ error: 'Solo se pueden aprobar preregistros pendientes' });
      }

      // Verificar que el email no exista ya como usuario
      const emailNorm = preregistro.emailPropietario.trim().toLowerCase();
      const existente = await buscarUsuarioPorEmailCompat(emailNorm);
      if (existente) {
        return respuesta.code(409).send({ error: 'Ya existe un usuario con ese email' });
      }

      const contrasenaFinal = contrasenaManual && contrasenaManual.length >= 8
        ? contrasenaManual
        : generarContrasenaAleatoria();
      const hashContrasena = await generarHashContrasena(contrasenaFinal);
      const { claveDueno, claveCliente } = await generarClavesSalonUnicas(preregistro.nombreSalon);
      const slugEstudio = await generarSlugUnico(preregistro.nombreSalon);

      const zonaHorariaPais = obtenerZonaHorariaPorPais(preregistro.pais);
      const fechaInicioISO =
        inicioSuscripcion ?? obtenerFechaISOActual(zonaHorariaPais, preregistro.pais);

      if (!fechaInicioEsValidaParaAlta(fechaInicioISO, preregistro.pais)) {
        return respuesta.code(400).send({
          error: 'La fecha de inicio de operaciones no es válida. Debe ser hoy o una fecha futura.',
        });
      }

      const fechaInicio = crearFechaDesdeISO(fechaInicioISO);
      fechaInicio.setHours(0, 0, 0, 0);
      const vencimiento = new Date(fechaInicio);
      vencimiento.setMonth(vencimiento.getMonth() + 1);

      const formatearFecha = (d: Date) =>
        obtenerFechaISOEnZona(d, zonaHorariaPais, preregistro.pais);

      const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const horario = Object.fromEntries(
        diasSemana.map((dia) => [dia, { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '19:00' }]),
      );

      const planNormalizado = normalizarPlanEstudio(preregistro.plan);
      const precioPlanActual = await obtenerPrecioPlanActual(planNormalizado, preregistro.pais);
      if (!precioPlanActual) {
        return respuesta.code(500).send({
          error: `No existe un precio configurado para el plan ${planNormalizado} en ${preregistro.pais}`,
        });
      }

      const monedaInicial = obtenerMonedaPorPais(preregistro.pais);
      const montoInicial = precioPlanActual.monto;
      const [columnasEstudios, columnasUsuarios, columnasPagos] = await Promise.all([
        obtenerColumnasTabla('estudios'),
        obtenerColumnasTabla('usuarios'),
        obtenerColumnasTabla('pagos'),
      ]);

      const estudioCreadoId = randomUUID();
      const usuarioCreadoId = randomUUID();
      const marcaTiempoActual = formatearFechaHoraSQL(new Date());

      try {
        await insertarRegistroCompat('estudios', {
          id: estudioCreadoId,
          nombre: preregistro.nombreSalon,
          slug: slugEstudio,
          propietario: preregistro.propietario,
          telefono: preregistro.telefonoPropietario,
          sitioWeb: null,
          pais: preregistro.pais,
          ...(columnasEstudios.has('zonaHoraria') && { zonaHoraria: obtenerZonaHorariaPorPais(preregistro.pais) }),
          sucursales: [preregistro.nombreSalon],
          claveDueno,
          claveCliente,
          activo: true,
          suscripcion: 'mensual',
          inicioSuscripcion: formatearFecha(fechaInicio),
          fechaVencimiento: formatearFecha(vencimiento),
          ...(columnasEstudios.has('precioPlanActualId') && { precioPlanActualId: precioPlanActual.id }),
          ...(columnasEstudios.has('precioPlanProximoId') && { precioPlanProximoId: null }),
          ...(columnasEstudios.has('fechaAplicacionPrecioProximo') && { fechaAplicacionPrecioProximo: null }),
          horario,
          servicios: [],
          serviciosCustom: [],
          festivos: [],
          ...(columnasEstudios.has('plan') && { plan: planNormalizado }),
          ...(columnasEstudios.has('estado') && { estado: 'aprobado' }),
          ...(columnasEstudios.has('emailContacto') && { emailContacto: emailNorm }),
          ...(columnasEstudios.has('fechaSolicitud') && { fechaSolicitud: marcaTiempoActual }),
          ...(columnasEstudios.has('fechaAprobacion') && { fechaAprobacion: marcaTiempoActual }),
          ...(columnasEstudios.has('actualizadoEn') && { actualizadoEn: marcaTiempoActual }),
          ...(columnasEstudios.has('vendedorId') && { vendedorId: preregistro.vendedorId }),
        }, columnasEstudios);

        await insertarRegistroCompat('usuarios', {
          id: usuarioCreadoId,
          email: emailNorm,
          hashContrasena,
          rol: 'dueno',
          estudioId: estudioCreadoId,
          ...(columnasUsuarios.has('nombre') && { nombre: preregistro.propietario }),
          ...(columnasUsuarios.has('activo') && { activo: true }),
          ...(columnasUsuarios.has('emailVerificado') && { emailVerificado: true }),
          ...(columnasUsuarios.has('actualizadoEn') && { actualizadoEn: marcaTiempoActual }),
        }, columnasUsuarios);

        try {
          await insertarRegistroCompat('pagos', {
            id: randomUUID(),
            estudioId: estudioCreadoId,
            monto: montoInicial,
            moneda: monedaInicial,
            concepto: `Suscripción mensual Beauty Time Pro (${monedaInicial})`,
            fecha: formatearFecha(fechaInicio),
            ...(columnasPagos.has('tipo') && { tipo: 'suscripcion' }),
            ...(columnasPagos.has('referencia') && { referencia: 'alta_inicial' }),
          }, columnasPagos);
        } catch (error) {
          solicitud.log.warn({ err: error, estudioId: estudioCreadoId }, 'No se pudo registrar pago inicial del preregistro');
        }

        // Actualizar preregistro como aprobado
        await prisma.preregistroSalon.update({
          where: { id },
          data: { estado: 'aprobado', estudioCreadoId },
        });

        cacheSalonesPublicos.flushAll();

        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'aprobar_preregistro',
          entidadTipo: 'PreregistroSalon',
          entidadId: id,
          detalles: { estudioCreadoId, vendedorId: preregistro.vendedorId, nombreSalon: preregistro.nombreSalon },
        });

        return respuesta.code(201).send({
          datos: {
            mensaje: 'Preregistro aprobado. Salón creado exitosamente.',
            estudioId: estudioCreadoId,
            acceso: {
              emailDueno: emailNorm,
              contrasena: contrasenaFinal,
              claveDueno,
              claveClientes: claveCliente,
              mostrarModalConfirmacion:
                payload.rol === 'maestro' || payload.rol === 'supervisor',
            },
          },
        });
      } catch (error) {
        // Rollback manual
        await eliminarRegistrosCompat('estudios', 'id', estudioCreadoId).catch(() => undefined);
        await eliminarRegistrosCompat('usuarios', 'id', usuarioCreadoId).catch(() => undefined);

        solicitud.log.error({ err: error }, 'Fallo al aprobar preregistro');
        return respuesta.code(500).send({ error: 'No se pudo completar la aprobación' });
      }
    },
  );

  // ── POST /admin/preregistros/:id/rechazar ────────────────────────────────
  // Rechaza un preregistro con motivo obligatorio.
  servidor.post<{ Params: { id: string }; Body: { motivo: string } }>(
    '/admin/preregistros/:id/rechazar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      const { id } = solicitud.params;

      const resultado = esquemaRechazoSolicitud.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({
          error: obtenerMensajeValidacion(resultado.error),
        });
      }

      const preregistro = await prisma.preregistroSalon.findUnique({ where: { id } });
      if (!preregistro) {
        return respuesta.code(404).send({ error: 'Preregistro no encontrado' });
      }
      if (preregistro.estado !== 'pendiente') {
        return respuesta.code(400).send({ error: 'Solo se pueden rechazar preregistros pendientes' });
      }

      await prisma.preregistroSalon.update({
        where: { id },
        data: { estado: 'rechazado', motivoRechazo: resultado.data.motivo },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'rechazar_preregistro',
        entidadTipo: 'PreregistroSalon',
        entidadId: id,
        detalles: { motivoRechazo: resultado.data.motivo, vendedorId: preregistro.vendedorId, nombreSalon: preregistro.nombreSalon },
      });

      return respuesta.send({
        datos: { mensaje: 'Preregistro rechazado correctamente.' },
      });
    },
  );

  // ── GET /admin/clientes/todos ─────────────────────────────────────────────
  // Solo maestro con permiso verMetricas. Devuelve clientes de todos los salones
  // con estadísticas de visitas calculadas a partir de reservas completadas.
  servidor.get<{
    Querystring: {
      pagina?: string;
      limite?: string;
      buscar?: string;
      salonId?: string;
      pais?: string;
      servicioFrecuente?: string;
    };
  }>(
    '/admin/clientes/todos',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { pagina: paginaStr, limite: limiteStr, buscar, salonId, pais, servicioFrecuente } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '50', 10)));

      try {
        const clientes = await construirBaseClientes({ salonId, pais, servicioFrecuente, buscar });
        const total = clientes.length;
        const saltar = (pagina - 1) * limite;
        const items = clientes.slice(saltar, saltar + limite);
        return respuesta.send({
          clientes: items,
          total,
          pagina,
          totalPaginas: Math.ceil(total / limite) || 1,
        });
      } catch (error) {
        servidor.log.error({ error }, 'Error al construir base de clientes');
        return respuesta.code(500).send({ error: 'Error al cargar la base de clientes' });
      }
    },
  );

  // ── GET /admin/clientes/exportar ──────────────────────────────────────────
  // Devuelve todos los registros (máximo 10,000) para exportación Excel desde el frontend.
  servidor.get<{
    Querystring: { salonId?: string; pais?: string; servicioFrecuente?: string; buscar?: string };
  }>(
    '/admin/clientes/exportar',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!['maestro', 'supervisor'].includes(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { salonId, pais, servicioFrecuente, buscar } = solicitud.query;
      try {
        const clientes = await construirBaseClientes({ salonId, pais, servicioFrecuente, buscar });
        return respuesta.send({ clientes: clientes.slice(0, 10_000) });
      } catch (error) {
        servidor.log.error({ error }, 'Error al exportar base de clientes');
        return respuesta.code(500).send({ error: 'Error al exportar la base de clientes' });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1 — Endpoints de métricas y control de salones
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /admin/metricas/total-salones — lista paginada de todos los salones
   */
  servidor.get<{
    Querystring: {
      buscar?: string;
      plan?: string;
      pais?: string;
      vendedor?: string;
      pagina?: string;
      limite?: string;
    };
  }>(
    '/admin/metricas/total-salones',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { buscar, plan, pais, vendedor, pagina: paginaStr, limite: limiteStr } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const where: Prisma.EstudioWhereInput = {};

      if (plan) {
        const planes = plan.split(',').filter((p) => p === 'STANDARD' || p === 'PRO');
        if (planes.length > 0) where.plan = { in: planes as ('STANDARD' | 'PRO')[] };
      }
      if (pais) {
        const paises = pais.split(',').filter((p) => p === 'Mexico' || p === 'Colombia');
        if (paises.length > 0) where.pais = { in: paises };
      }
      if (vendedor) {
        where.vendedorAsociado = { contains: vendedor };
      }

      // Búsqueda por nombre o propietario directamente en la DB
      if (buscar) {
        const buscNorm = buscar.trim();
        where.OR = [
          { nombre: { contains: buscNorm } },
          { propietario: { contains: buscNorm } },
        ];
      }

      const [total, salones] = await Promise.all([
        prisma.estudio.count({ where }),
        prisma.estudio.findMany({
          where,
          select: {
            id: true,
            nombre: true,
            creadoEn: true,
            plan: true,
            pais: true,
            propietario: true,
            vendedorAsociado: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { nombre: true, email: true },
            },
          },
          orderBy: { creadoEn: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        fechaCreacion: s.creadoEn.toISOString(),
        plan: s.plan,
        pais: s.pais,
        dueno: s.usuarios[0]?.nombre ?? s.propietario,
        vendedor: s.vendedorAsociado ?? null,
      }));

      return respuesta.send({
        datos,
        total,
        pagina,
        totalPaginas: Math.ceil(total / limite),
      });
    },
  );

  /**
   * GET /admin/salones/activos — salones con estado aprobado y activos
   */
  servidor.get<{
    Querystring: { pagina?: string; limite?: string };
  }>(
    '/admin/salones/activos',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verControlSalones', 'accionSuspension', 'activarSalones'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const where: Prisma.EstudioWhereInput = { estado: 'aprobado', activo: true };

      const [total, salones] = await Promise.all([
        prisma.estudio.count({ where }),
        prisma.estudio.findMany({
          where,
          select: {
            id: true,
            nombre: true,
            propietario: true,
            plan: true,
            claveDueno: true,
            inicioSuscripcion: true,
            fechaVencimiento: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { id: true, nombre: true, email: true, hashContrasena: false },
            },
          },
          orderBy: { creadoEn: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = salones.map((s) => {
        const dueno = s.usuarios[0];
        return {
          id: s.id,
          nombre: s.nombre,
          dueno: dueno?.nombre ?? s.propietario,
          correo: dueno?.email ?? null,
          periodo: { inicio: s.inicioSuscripcion, fin: s.fechaVencimiento },
          plan: s.plan,
          claveDueno: s.claveDueno,
        };
      });

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/salones/suspendidos — salones con estado suspendido
   */
  servidor.get<{
    Querystring: { pagina?: string; limite?: string };
  }>(
    '/admin/salones/suspendidos',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verControlSalones', 'accionSuspension', 'activarSalones'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const where: Prisma.EstudioWhereInput = { estado: 'suspendido' };

      const [total, salones] = await Promise.all([
        prisma.estudio.count({ where }),
        prisma.estudio.findMany({
          where,
          select: {
            id: true,
            nombre: true,
            plan: true,
            claveDueno: true,
            fechaSuspension: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { email: true },
            },
          },
          orderBy: { fechaSuspension: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        correo: s.usuarios[0]?.email ?? null,
        fechaSuspension: s.fechaSuspension?.toISOString() ?? null,
        plan: s.plan,
        claveDueno: s.claveDueno,
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/salones/bloqueados — salones con estado bloqueado
   */
  servidor.get<{
    Querystring: { pagina?: string; limite?: string };
  }>(
    '/admin/salones/bloqueados',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verControlSalones', 'accionSuspension', 'activarSalones'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const where: Prisma.EstudioWhereInput = { estado: 'bloqueado' };

      const [total, salones] = await Promise.all([
        prisma.estudio.count({ where }),
        prisma.estudio.findMany({
          where,
          select: {
            id: true,
            nombre: true,
            claveDueno: true,
            motivoBloqueo: true,
            fechaBloqueo: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { email: true },
            },
          },
          orderBy: { fechaBloqueo: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        correo: s.usuarios[0]?.email ?? null,
        fechaBloqueo: s.fechaBloqueo?.toISOString() ?? null,
        motivoBloqueo: s.motivoBloqueo,
        claveDueno: s.claveDueno,
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * PUT /admin/salones/:id/bloquear — bloquear un salón con motivo
   */
  servidor.put<{ Params: { id: string }; Body: { motivo: string } }>(
    '/admin/salones/:id/bloquear',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { motivo } = solicitud.body;

      const motivosValidos = [
        'Se cierra el salón',
        'Incumple normas',
        'Ya no desea usar la app',
      ];

      if (!motivo || !motivosValidos.includes(motivo)) {
        return respuesta.code(400).send({ error: 'Motivo de bloqueo inválido', campos: { motivo: 'Seleccione un motivo válido' } });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.estudio.update({
          where: { id },
          data: {
            estado: 'bloqueado',
            activo: false,
            motivoBloqueo: motivo,
            fechaBloqueo: new Date(),
          },
        });

        await tx.usuario.updateMany({
          where: { estudioId: id, rol: 'dueno' },
          data: { activo: false },
        });
      });

      await revocarAccesosEstudio(id, 'salon_bloqueado_desde_admin');

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'bloquear_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, motivo },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Salón bloqueado correctamente' } });
    },
  );

  /**
   * PUT /admin/salones/:id/activar — reactivar un salón suspendido o bloqueado
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/activar',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['suspenderSalones'],
          supervisor: ['activarSalones', 'accionSuspension'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: { id: true, nombre: true, estado: true },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      if (estudio.estado !== 'suspendido' && estudio.estado !== 'bloqueado') {
        return respuesta.code(400).send({ error: 'Solo se pueden activar salones suspendidos o bloqueados' });
      }

      const estadoAnterior = estudio.estado;

      await prisma.$transaction(async (tx) => {
        await tx.estudio.update({
          where: { id },
          data: {
            estado: 'aprobado',
            activo: true,
            motivoBloqueo: null,
            fechaSuspension: null,
            fechaBloqueo: null,
          },
        });

        await tx.usuario.updateMany({
          where: { estudioId: id, rol: 'dueno' },
          data: { activo: true },
        });
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'activar_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, estadoAnterior },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Salón activado correctamente' } });
    },
  );

  /**
   * PUT /admin/salones/:id/editar-suscripcion — editar fechas, plan y contraseña
   */
  servidor.put<{
    Params: { id: string };
    Body: {
      inicioSuscripcion?: string;
      fechaVencimiento?: string;
      plan?: 'STANDARD' | 'PRO';
      contrasena?: string;
      mensajesMasivosExtra?: number;
    };
  }>(
    '/admin/salones/:id/editar-suscripcion',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { inicioSuscripcion, fechaVencimiento, plan, contrasena, mensajesMasivosExtra } = solicitud.body;

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: { id: true, nombre: true, pais: true, plan: true, inicioSuscripcion: true, fechaVencimiento: true, mensajesMasivosExtra: true },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const actualizacion: Prisma.EstudioUpdateInput = {};
      const detallesAudit: Record<string, unknown> = { nombre: estudio.nombre };

      if (inicioSuscripcion) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioSuscripcion)) {
          return respuesta.code(400).send({ error: 'Formato de fecha inválido para inicioSuscripcion' });
        }
        detallesAudit.inicioSuscripcionAnterior = estudio.inicioSuscripcion;
        actualizacion.inicioSuscripcion = inicioSuscripcion;
      }

      if (fechaVencimiento) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)) {
          return respuesta.code(400).send({ error: 'Formato de fecha inválido para fechaVencimiento' });
        }
        detallesAudit.fechaVencimientoAnterior = estudio.fechaVencimiento;
        actualizacion.fechaVencimiento = fechaVencimiento;
      }

      if (plan && (plan === 'STANDARD' || plan === 'PRO')) {
        if (plan === 'STANDARD') {
          const totalPersonalActivo = await prisma.personal.count({
            where: { estudioId: id, activo: true },
          });

          const errorPersonalPlan = validarCantidadEmpleadosActivosPlan({
            plan,
            cantidadActual: totalPersonalActivo,
            cantidadNueva: totalPersonalActivo,
          });

          if (errorPersonalPlan) {
            return respuesta.code(400).send({ error: errorPersonalPlan, codigo: 'LIMITE_PLAN' });
          }
        }

        detallesAudit.planAnterior = estudio.plan;
        actualizacion.plan = plan;
      }

      if (typeof mensajesMasivosExtra === 'number' && mensajesMasivosExtra >= 0 && Number.isInteger(mensajesMasivosExtra)) {
        detallesAudit.mensajesMasivosExtraAnterior = estudio.mensajesMasivosExtra;
        actualizacion.mensajesMasivosExtra = mensajesMasivosExtra;
      }

      if (Object.keys(actualizacion).length > 0) {
        await prisma.estudio.update({ where: { id }, data: actualizacion });
      }

      if (plan && (plan === 'STANDARD' || plan === 'PRO')) {
        await asegurarPrecioActualSalon({
          estudioId: id,
          plan,
          pais: estudio.pais,
        });
      }

      if (contrasena && contrasena.length >= 8) {
        const dueno = await prisma.usuario.findFirst({ where: { estudioId: id, rol: 'dueno' } });
        if (dueno) {
          const nuevoHash = await generarHashContrasena(contrasena);
          await prisma.usuario.update({
            where: { id: dueno.id },
            data: { hashContrasena: nuevoHash },
          });
          detallesAudit.contrasenaModificada = true;
        }
      }

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'editar_suscripcion_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: detallesAudit,
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Suscripción actualizada correctamente' } });
    },
  );

  /**
   * GET /admin/metricas/reservas — reservas en un rango de fechas con filtros
   */
  servidor.get<{
    Querystring: {
      fechaInicio?: string;
      fechaFin?: string;
      estado?: string;
      pais?: string;
      pagina?: string;
      limite?: string;
    };
  }>(
    '/admin/metricas/reservas',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { fechaInicio, fechaFin, estado, pais, pagina: paginaStr, limite: limiteStr } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const hoy = new Date().toISOString().split('T')[0]!;
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      const hace30DiasStr = hace30Dias.toISOString().split('T')[0]!;

      const inicio = fechaInicio ?? hace30DiasStr;
      const fin = fechaFin ?? hoy;

      const whereReserva: Prisma.ReservaWhereInput = {
        fecha: { gte: inicio, lte: fin },
      };

      if (estado) {
        const estados = estado.split(',').filter(Boolean);
        if (estados.length > 0) whereReserva.estado = { in: estados };
      }

      if (pais) {
        const paises = pais.split(',').filter((p) => p === 'Mexico' || p === 'Colombia');
        if (paises.length > 0) whereReserva.estudio = { pais: { in: paises } };
      }

      const [totalReservas, reservas] = await Promise.all([
        prisma.reserva.count({ where: whereReserva }),
        prisma.reserva.findMany({
          where: whereReserva,
          select: {
            id: true,
            fecha: true,
            estado: true,
            estudio: { select: { nombre: true, pais: true } },
          },
          orderBy: { fecha: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      // Total sin filtro de estado para el contador general
      const totalSinFiltroEstado = await prisma.reserva.count({
        where: {
          fecha: { gte: inicio, lte: fin },
          ...(pais
            ? {
                estudio: {
                  pais: { in: pais.split(',').filter((p) => p === 'Mexico' || p === 'Colombia') },
                },
              }
            : {}),
        },
      });

      const datos = reservas.map((r) => ({
        id: r.id,
        salon: r.estudio.nombre,
        fecha: r.fecha,
        estado: r.estado,
        pais: r.estudio.pais,
      }));

      return respuesta.send({
        datos,
        totalReservas: totalSinFiltroEstado,
        total: totalReservas,
        pagina,
        totalPaginas: Math.ceil(totalReservas / limite),
      });
    },
  );

  /**
   * GET /admin/metricas/ventas — ventas agrupadas por país y plan
   */
  servidor.get(
    '/admin/metricas/ventas',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resumen = await obtenerResumenSuscripcionesActivas();

      return respuesta.send({
        datos: {
          mexico: {
            total: resumen.porPais.Mexico.total,
            moneda: 'MXN',
            desglose: {
              pro: resumen.porPais.Mexico.desglose.pro,
              standard: resumen.porPais.Mexico.desglose.standard,
            },
          },
          colombia: {
            total: resumen.porPais.Colombia.total,
            moneda: 'COP',
            desglose: {
              pro: resumen.porPais.Colombia.desglose.pro,
              standard: resumen.porPais.Colombia.desglose.standard,
            },
          },
        },
      });
    },
  );

  /**
   * GET /admin/directorio — directorio de acceso con búsqueda
   */
  servidor.get<{
    Querystring: {
      buscar?: string;
      pagina?: string;
      limite?: string;
      pais?: string;
      estado?: string;
      plan?: string;
    };
  }>(
    '/admin/directorio',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verDirectorio', 'editarDirectorio', 'verControlSalones', 'accionSuspension'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { buscar, pagina: paginaStr, limite: limiteStr, pais, estado, plan } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const where: Prisma.EstudioWhereInput = {};
      if (buscar) {
        const buscNorm = buscar.trim();
        where.OR = [
          { nombre: { contains: buscNorm } },
          { propietario: { contains: buscNorm } },
        ];
      }
      if (pais === 'Mexico' || pais === 'Colombia') {
        where.pais = pais;
      }
      if (
        estado &&
        ['pendiente', 'aprobado', 'rechazado', 'suspendido', 'bloqueado'].includes(estado)
      ) {
        where.estado = estado as 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado';
      }
      if (plan && ['STANDARD', 'PRO'].includes(plan)) {
        where.plan = plan as 'STANDARD' | 'PRO';
      }

      const [total, salones] = await Promise.all([
        prisma.estudio.count({ where }),
        prisma.estudio.findMany({
          where,
          select: {
            id: true,
            nombre: true,
            propietario: true,
            pais: true,
            plan: true,
            estado: true,
            activo: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { nombre: true, email: true, activo: true, ultimoAcceso: true },
            },
          },
          orderBy: { creadoEn: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        dueno: s.usuarios[0]?.nombre ?? s.propietario,
        correo: s.usuarios[0]?.email ?? null,
        pais: s.pais,
        plan: s.plan,
        estado: s.estado,
        activo: s.activo,
        duenoActivo: s.usuarios[0]?.activo ?? false,
        ultimoAccesoDueno: s.usuarios[0]?.ultimoAcceso?.toISOString() ?? null,
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/directorio/:id — detalle completo de un salón para el modal
   */
  servidor.get<{ Params: { id: string } }>(
    '/admin/directorio/:id',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verDirectorio', 'editarDirectorio', 'verControlSalones', 'accionSuspension'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      let estudio:
        | {
            id: string;
            nombre: string;
            propietario?: string | null;
            telefono?: string | null;
            pais?: string | null;
            plan?: string | null;
            estado?: string | null;
            activo?: boolean | null;
            inicioSuscripcion?: string | null;
            fechaVencimiento?: string | null;
            emailContacto?: string | null;
            direccion?: string | null;
            descripcion?: string | null;
            colorPrimario?: string | null;
            logoUrl?: string | null;
            claveCliente?: string | null;
            creadoEn?: Date | null;
            usuarios: Array<{ nombre: string | null; email: string | null }>;
          }
        | null;

      try {
        estudio = await prisma.estudio.findUnique({
          where: { id },
          select: {
            id: true,
            nombre: true,
            propietario: true,
            telefono: true,
            pais: true,
            plan: true,
            estado: true,
            activo: true,
            inicioSuscripcion: true,
            fechaVencimiento: true,
            emailContacto: true,
            direccion: true,
            descripcion: true,
            colorPrimario: true,
            logoUrl: true,
            claveCliente: true,
            creadoEn: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { nombre: true, email: true },
            },
          },
        });
      } catch (error) {
        if (!esErrorCompatibilidadAdmin(error)) {
          throw error;
        }

        estudio = await prisma.estudio.findUnique({
          where: { id },
          select: {
            id: true,
            nombre: true,
            propietario: true,
            telefono: true,
            pais: true,
            activo: true,
            inicioSuscripcion: true,
            fechaVencimiento: true,
            emailContacto: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: { nombre: true, email: true },
            },
          },
        });
      }

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      return respuesta.send({
        datos: {
          ...estudio,
          plan: estudio.plan ?? 'STANDARD',
          estado: estudio.estado ?? null,
          direccion: estudio.direccion ?? null,
          descripcion: estudio.descripcion ?? null,
          colorPrimario: estudio.colorPrimario ?? null,
          logoUrl: estudio.logoUrl ?? null,
          claveCliente: estudio.claveCliente ?? null,
          creadoEn: estudio.creadoEn ?? null,
        },
      });
    },
  );

  /**
   * PUT /admin/directorio/:id — actualizar datos del salón desde directorio de acceso
   */
  servidor.put<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>(
    '/admin/directorio/:id',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['suspenderSalones'],
          supervisor: ['editarDirectorio'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const body = solicitud.body;

      const columnasEstudios = await obtenerColumnasTabla('estudios').catch(() => null);

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          emailContacto: true,
          usuarios: {
            where: { rol: 'dueno' },
            take: 1,
            select: { id: true, email: true },
          },
        },
      });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const camposPermitidos = [
        'nombre', 'propietario', 'telefono', 'emailContacto', 'direccion',
        'descripcion', 'colorPrimario', 'plan', 'inicioSuscripcion', 'fechaVencimiento',
      ] as const;

      const actualizacion: Record<string, unknown> = {};
      for (const campo of camposPermitidos) {
        const columnaDisponible = columnasEstudios ? columnasEstudios.has(campo) : true;
        if (!columnaDisponible) {
          continue;
        }

        if (campo in body && body[campo] !== undefined) {
          actualizacion[campo] = body[campo];
        }
      }

      const actualizacionDueno: Record<string, unknown> = {};
      const emailDueno = typeof body['emailDueno'] === 'string' ? body['emailDueno'].trim().toLowerCase() : null;
      const contrasenaDueno = typeof body['contrasenaDueno'] === 'string' ? body['contrasenaDueno'].trim() : null;

      if (actualizacion.nombre !== undefined) {
        const resultado = esquemaNombreSalonRegistro.safeParse(actualizacion.nombre);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Nombre de salón inválido' });
        }
        actualizacion.nombre = resultado.data;
      }

      if (actualizacion.propietario !== undefined) {
        const resultado = esquemaNombrePersonaRegistro.safeParse(actualizacion.propietario);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Nombre del dueño inválido' });
        }
        actualizacion.propietario = resultado.data;
      }

      if (actualizacion.telefono !== undefined) {
        const resultado = esquemaTelefonoSalonRegistro.safeParse(actualizacion.telefono);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Teléfono inválido' });
        }
        actualizacion.telefono = resultado.data;
      }

      if (actualizacion.emailContacto !== undefined) {
        if (typeof actualizacion.emailContacto !== 'string' || !esEmailValido(actualizacion.emailContacto)) {
          return respuesta.code(400).send({ error: 'Solo se aceptan correos personales permitidos (@gmail, @hotmail, @outlook o @yahoo)' });
        }
        actualizacion.emailContacto = actualizacion.emailContacto.trim().toLowerCase();
      }

      if (emailDueno) {
        if (!esEmailValido(emailDueno)) {
          return respuesta.code(400).send({ error: 'El correo del dueño no es válido' });
        }
        actualizacionDueno['email'] = emailDueno;
        if (actualizacion.emailContacto === undefined) {
          actualizacion.emailContacto = emailDueno;
        }
      }

      if (contrasenaDueno) {
        if (contrasenaDueno.length < 8) {
          return respuesta.code(400).send({ error: 'La contraseña del dueño debe tener al menos 8 caracteres' });
        }
        actualizacionDueno['hashContrasena'] = await generarHashContrasena(contrasenaDueno);
      }

      if (actualizacion.plan !== undefined && actualizacion.plan !== 'STANDARD' && actualizacion.plan !== 'PRO') {
        return respuesta.code(400).send({ error: 'Plan inválido' });
      }

      if (actualizacion.plan === 'STANDARD') {
        const totalPersonalActivo = await prisma.personal.count({
          where: { estudioId: id, activo: true },
        });

        const errorPersonalPlan = validarCantidadEmpleadosActivosPlan({
          plan: actualizacion.plan,
          cantidadActual: totalPersonalActivo,
          cantidadNueva: totalPersonalActivo,
        });

        if (errorPersonalPlan) {
          return respuesta.code(400).send({ error: errorPersonalPlan, codigo: 'LIMITE_PLAN' });
        }
      }

      if (actualizacion.inicioSuscripcion !== undefined) {
        const resultado = fechaIsoSchema.safeParse(actualizacion.inicioSuscripcion);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: 'La fecha de inicio de suscripción no es válida' });
        }
      }

      if (actualizacion.fechaVencimiento !== undefined) {
        const resultado = fechaIsoSchema.safeParse(actualizacion.fechaVencimiento);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: 'La fecha de vencimiento no es válida' });
        }
      }

      if (Object.keys(actualizacion).length === 0 && Object.keys(actualizacionDueno).length === 0) {
        return respuesta.code(400).send({ error: 'No se proporcionaron campos para actualizar' });
      }

      try {
        await prisma.$transaction(async (tx) => {
          if (Object.keys(actualizacion).length > 0) {
            await tx.estudio.update({
              where: { id },
              data: actualizacion as Prisma.EstudioUpdateInput,
            });
          }

          if (Object.keys(actualizacionDueno).length > 0 && estudio.usuarios[0]?.id) {
            await tx.usuario.update({
              where: { id: estudio.usuarios[0].id },
              data: actualizacionDueno as Prisma.UsuarioUpdateInput,
            });
          }
        });

        if (Object.keys(actualizacionDueno).length > 0 && estudio.usuarios[0]?.id) {
          await revocarSesionesPorSujeto('usuario', estudio.usuarios[0].id, 'credenciales_salon_actualizadas');
        }

        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'editar_salon_directorio',
          entidadTipo: 'estudio',
          entidadId: id,
          detalles: {
            nombre: estudio.nombre,
            campos: Object.keys(actualizacion),
            credencialesActualizadas: Object.keys(actualizacionDueno),
            emailDuenoAnterior: estudio.usuarios[0]?.email ?? null,
            emailContactoAnterior: estudio.emailContacto ?? null,
          },
          ip: solicitud.ip,
        });

        return respuesta.send({ datos: { mensaje: 'Salón actualizado correctamente' } });
      } catch (error) {
        solicitud.log.error(
          {
            err: error,
            estudioId: id,
            camposEstudio: Object.keys(actualizacion),
            camposDueno: Object.keys(actualizacionDueno),
          },
          'Error al actualizar salón en directorio',
        );

        if (esPrismaErrorConCodigo(error, 'P2002')) {
          return respuesta.code(409).send({
            error:
              'No se pudo guardar porque alguno de los datos ya existe en otro registro (correo o clave única).',
          });
        }

        if (esPrismaErrorConCodigo(error, 'P2025')) {
          return respuesta.code(404).send({ error: 'No se encontró el salón o usuario a actualizar' });
        }

        if (esPrismaErrorConCodigo(error, 'P2022')) {
          return respuesta.code(400).send({
            error:
              'No se pudo aplicar la actualización por compatibilidad temporal de esquema. Intenta nuevamente en unos segundos.',
          });
        }

        return respuesta.code(500).send({
          error: 'Ocurrió un error interno al actualizar el salón. Intenta nuevamente.',
        });
      }
    },
  );

  /**
   * GET /admin/directorio/:id/historial — historial de pagos del salón
   */
  servidor.get<{
    Params: { id: string };
    Querystring: { pagina?: string; limite?: string };
  }>(
    '/admin/directorio/:id/historial',
    {
      preHandler: [
        verificarJWT,
        requiereAccesoAdministrativo({
          maestro: ['aprobarSalones', 'suspenderSalones'],
          supervisor: ['verDirectorio', 'editarDirectorio', 'verControlSalones', 'accionSuspension'],
        }),
      ],
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '10', 10)));
      const saltar = (pagina - 1) * limite;

      const [total, pagos] = await Promise.all([
        prisma.pago.count({ where: { estudioId: id } }),
        prisma.pago.findMany({
          where: { estudioId: id },
          select: {
            id: true,
            fecha: true,
            monto: true,
            moneda: true,
            concepto: true,
            creadoEn: true,
            estudio: { select: { plan: true, creadoEn: true } },
          },
          orderBy: { creadoEn: 'desc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = pagos.map((p) => ({
        id: p.id,
        fechaPago: p.fecha,
        fechaCreacionSalon: p.estudio.creadoEn.toISOString(),
        plan: p.estudio.plan,
        monto: p.monto,
        moneda: p.moneda,
        concepto: p.concepto,
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );
}

// ─── Helper: construye la lista de clientes con estadísticas ──────────────────
async function construirBaseClientes(filtros: {
  salonId?: string;
  pais?: string;
  servicioFrecuente?: string;
  buscar?: string;
}) {
  const { salonId, pais, servicioFrecuente, buscar } = filtros;

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(salonId ? { estudioId: salonId } : {}),
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      email: true,
      estudioId: true,
    },
    orderBy: { creadoEn: 'desc' },
    take: 15_000,
  });

  const estudiosIds = Array.from(new Set(clientes.map((cliente) => cliente.estudioId)));
  const estudios = estudiosIds.length
    ? await prisma.estudio.findMany({
        where: {
          id: { in: estudiosIds },
          ...(pais ? { pais: pais as 'Mexico' | 'Colombia' } : {}),
        },
        select: { id: true, nombre: true, pais: true },
      })
    : [];

  const estudiosPorId = new Map(estudios.map((estudio) => [estudio.id, estudio]));
  const clientesFiltradosPorEstudio = clientes.filter((cliente) => estudiosPorId.has(cliente.estudioId));
  const clientesIds = clientesFiltradosPorEstudio.map((cliente) => cliente.id);

  const reservas = clientesIds.length
    ? await prisma.reserva.findMany({
        where: {
          clienteId: { in: clientesIds },
          estado: 'completed',
        },
        select: {
          id: true,
          clienteId: true,
          fecha: true,
          precioTotal: true,
        },
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      })
    : [];

  const reservasIds = reservas.map((reserva) => reserva.id);
  const serviciosDetalle = reservasIds.length
    ? await prisma.reservaServicio.findMany({
        where: {
          reservaId: { in: reservasIds },
          estado: 'completed',
        },
        select: { reservaId: true, nombre: true },
      })
    : [];

  const reservasPorCliente = new Map<string, Array<(typeof reservas)[number]>>();
  reservas.forEach((reserva) => {
    const lista = reservasPorCliente.get(reserva.clienteId) ?? [];
    lista.push(reserva);
    reservasPorCliente.set(reserva.clienteId, lista);
  });

  const serviciosPorReserva = new Map<string, string[]>();
  serviciosDetalle.forEach((servicio) => {
    const lista = serviciosPorReserva.get(servicio.reservaId) ?? [];
    lista.push(servicio.nombre);
    serviciosPorReserva.set(servicio.reservaId, lista);
  });

  const resultado = clientesFiltradosPorEstudio.map((cliente) => {
    const estudio = estudiosPorId.get(cliente.estudioId);
    const reservasCompletadas = reservasPorCliente.get(cliente.id) ?? [];
    const totalVisitas = reservasCompletadas.length;
    const totalGastado = reservasCompletadas.reduce((acc, r) => acc + r.precioTotal, 0);
    const ultimaVisita = reservasCompletadas[0]?.fecha ?? null;

    const frecuencia = new Map<string, number>();
    for (const reserva of reservasCompletadas) {
      for (const nombreServicio of serviciosPorReserva.get(reserva.id) ?? []) {
        frecuencia.set(nombreServicio, (frecuencia.get(nombreServicio) ?? 0) + 1);
      }
    }

    const serviciosRealizados = Array.from(frecuencia.keys());
    let servicioMasFrecuente = '';
    let maxFreq = 0;
    for (const [nombre, freq] of frecuencia) {
      if (freq > maxFreq) {
        maxFreq = freq;
        servicioMasFrecuente = nombre;
      }
    }

    return {
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      correo: cliente.email,
      estudioId: cliente.estudioId,
      nombreEstudio: estudio?.nombre ?? 'Salón sin referencia',
      paisEstudio: estudio?.pais ?? '',
      serviciosRealizados,
      servicioMasFrecuente,
      ultimaVisita,
      totalVisitas,
      totalGastado,
    };
  });

  // Filtro de búsqueda
  const buscNorm = buscar?.toLowerCase().trim();
  const filtrado = buscNorm
    ? resultado.filter(
        (c) =>
          c.nombre.toLowerCase().includes(buscNorm) ||
          c.telefono.includes(buscNorm) ||
          (c.correo ?? '').toLowerCase().includes(buscNorm),
      )
    : resultado;

  // Filtro por servicio frecuente
  const filtradoFinal = servicioFrecuente
    ? filtrado.filter((c) => c.servicioMasFrecuente.toLowerCase().includes(servicioFrecuente.toLowerCase()))
    : filtrado;

  return filtradoFinal;
}
