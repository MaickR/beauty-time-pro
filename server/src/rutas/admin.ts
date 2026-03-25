import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla } from '../lib/compatibilidadEsquema.js';
import { cacheSalonesPublicos } from '../lib/cache.js';
import { enviarEmailBienvenidaSalon, enviarEmailRechazoSalon, enviarEmailCancelacionProcesada, enviarEmailRecordatorioPagoSalon } from '../servicios/servicioEmail.js';
import { generarHashContrasena } from '../utils/contrasenas.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { emailSchema, fechaIsoSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';
import { normalizarPlanEstudio } from '../lib/planes.js';

const esquemaRechazoSolicitud = z.object({
  motivo: textoSchema('motivo', 500, 10),
});

const esquemaCrearSalonAdmin = z.object({
  nombreSalon: textoSchema('nombreSalon', 120, 2),
  nombreAdmin: textoSchema('nombreAdmin', 120, 2),
  email: emailSchema,
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono: telefonoSchema,
  pais: z.enum(['Mexico', 'Colombia']).optional().default('Mexico'),
  plan: z.enum(['STANDARD', 'PRO']).optional().default('STANDARD'),
  inicioSuscripcion: fechaIsoSchema.optional(),
  personal: z.array(z.object({
    nombre: textoSchema('nombre', 120, 2),
    especialidades: z.array(z.string().trim()).default([]),
    horaInicio: z.string().optional(),
    horaFin: z.string().optional(),
    descansoInicio: z.string().optional(),
    descansoFin: z.string().optional(),
  })).optional().default([]),
  depuracionHasta: z
    .enum(['antes_hash', 'despues_hash', 'despues_claves', 'despues_estudio', 'despues_usuario'])
    .optional(),
});

function generarContrasenaAleatoria(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  result += 'ABCDEFGH'[Math.floor(Math.random() * 8)];
  result += '23456789'[Math.floor(Math.random() * 8)];
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function obtenerFechaISOActual(): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy.toISOString().split('T')[0]!;
}

function crearFechaDesdeISO(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return new Date(anio!, (mes! - 1), dia!);
}

function formatearFechaISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0]!;
}

function formatearFechaHoraSQL(fecha: Date): string {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

function obtenerMonedaPorPais(pais?: string | null): 'MXN' | 'COP' {
  return pais === 'Colombia' ? 'COP' : 'MXN';
}

function obtenerMontoPlanPorPais(pais?: string | null): number {
  return obtenerMonedaPorPais(pais) === 'COP' ? 200000 : 1000;
}

function calcularNuevaFechaVencimiento(params: {
  fechaVencimiento?: string | null;
  inicioSuscripcion?: string | null;
  meses: number;
}): {
  fechaBase: string;
  nuevaFechaVencimiento: string;
  estrategia: 'desde_vencimiento_actual' | 'desde_hoy';
} {
  const hoy = obtenerFechaISOActual();
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
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';
  activo: boolean;
  duenoActivo?: boolean;
}): 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' {
  if (params.estado === 'rechazado' || params.estado === 'pendiente') {
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
    /(plan|pinCancelacionHash|fechaSolicitud|fechaAprobacion|motivoRechazo|primeraVez|cancelacionSolicitada|fechaSolicitudCancelacion|motivoCancelacion)/i.test(
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
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  suscripcion: true,
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
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
  estado: true,
  plan: true,
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
  propietario: true,
  telefono: true,
  pais: true,
  sucursales: true,
  activo: true,
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
): 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' {
  const dueno = obtenerDuenoSalon(estudio);
  const estado = estudio['estado'];

  if (
    estado === 'pendiente' ||
    estado === 'aprobado' ||
    estado === 'rechazado' ||
    estado === 'suspendido'
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

function serializarSalonCreado(estudio: Record<string, unknown>) {
  return {
    ...estudio,
    plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
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
    sucursales: [datos.nombreSalon],
    claveDueno: datos.claveDueno,
    claveCliente: datos.claveCliente,
    inicioSuscripcion: datos.fechaInicio,
    fechaVencimiento: datos.fechaVencimiento,
    horario: datos.horario,
    servicios: [],
    serviciosCustom: [],
    festivos: [],
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

function escaparIdentificadorSQL(nombre: string): string {
  return `\`${nombre.replace(/`/g, '')}\``;
}

function serializarValorSQL(valor: unknown): unknown {
  if (valor == null) return valor;
  if (typeof valor === 'object') {
    return JSON.stringify(valor);
  }

  return valor;
}

async function insertarRegistroCompat(tabla: string, datos: Record<string, unknown>) {
  const entradas = Object.entries(datos).filter(([, valor]) => valor !== undefined);
  if (entradas.length === 0) {
    throw new Error(`No hay datos para insertar en ${tabla}`);
  }

  const columnas = entradas.map(([columna]) => escaparIdentificadorSQL(columna)).join(', ');
  const marcadores = entradas.map(() => '?').join(', ');
  const valores = entradas.map(([, valor]) => serializarValorSQL(valor));

  await prisma.$executeRawUnsafe(
    `INSERT INTO ${escaparIdentificadorSQL(tabla)} (${columnas}) VALUES (${marcadores})`,
    ...valores,
  );
}

async function actualizarRegistroCompat(
  tabla: string,
  whereCampo: string,
  whereValor: unknown,
  datos: Record<string, unknown>,
) {
  const entradas = Object.entries(datos).filter(([, valor]) => valor !== undefined);
  if (entradas.length === 0) {
    return;
  }

  const asignaciones = entradas
    .map(([columna]) => `${escaparIdentificadorSQL(columna)} = ?`)
    .join(', ');
  const valores = entradas.map(([, valor]) => serializarValorSQL(valor));

  await prisma.$executeRawUnsafe(
    `UPDATE ${escaparIdentificadorSQL(tabla)} SET ${asignaciones} WHERE ${escaparIdentificadorSQL(whereCampo)} = ?`,
    ...valores,
    serializarValorSQL(whereValor),
  );
}

async function eliminarRegistrosCompat(tabla: string, whereCampo: string, whereValor: unknown) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM ${escaparIdentificadorSQL(tabla)} WHERE ${escaparIdentificadorSQL(whereCampo)} = ?`,
    serializarValorSQL(whereValor),
  );
}

async function buscarUsuarioPorEmailCompat(email: string) {
  const filas = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ${escaparIdentificadorSQL('id')} FROM ${escaparIdentificadorSQL('usuarios')} WHERE ${escaparIdentificadorSQL('email')} = ? LIMIT 1`,
    email,
  );

  return filas[0] ?? null;
}

function normalizarPrefijoClaveAdmin(nombreSalon: string): string {
  const base = nombreSalon
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

  return base || 'SALON';
}

async function generarClavesSalonCompat(nombreSalon: string) {
  const prefijo = normalizarPrefijoClaveAdmin(nombreSalon);

  for (let intento = 0; intento < 20; intento += 1) {
    const sufijo = randomBytes(3).toString('hex').toUpperCase();
    const claveDueno = `${prefijo}${sufijo}`;
    const claveCliente = `${prefijo}CLI${sufijo}`;
    const filas = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT ${escaparIdentificadorSQL('id')} FROM ${escaparIdentificadorSQL('estudios')} WHERE ${escaparIdentificadorSQL('claveDueno')} = ? OR ${escaparIdentificadorSQL('claveCliente')} = ? LIMIT 1`,
      claveDueno,
      claveCliente,
    );

    if (filas.length === 0) {
      return { claveDueno, claveCliente };
    }
  }

  throw new Error('No se pudieron generar claves únicas para el salón');
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

  const seleccion = columnas.map((columna) => escaparIdentificadorSQL(columna)).join(', ');
  const filas = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${seleccion} FROM ${escaparIdentificadorSQL('estudios')} WHERE ${escaparIdentificadorSQL('id')} = ? LIMIT 1`,
    id,
  );
  const estudio = filas[0];

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
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { estado, pagina: paginaStr, limite: limiteStr } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '50', 10)));
      const saltar = (pagina - 1) * limite;

      const estadosValidos = ['pendiente', 'aprobado', 'rechazado', 'suspendido'];
      const estadoSolicitado =
        estado && estadosValidos.includes(estado)
          ? (estado as 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido')
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
            aprobadoPorNombre: aprobacion?.usuario.nombre ?? null,
            aprobadoPorEmail: aprobacion?.usuario.email ?? null,
            renovadoPorNombre: renovacion?.usuario.nombre ?? null,
            renovadoPorEmail: renovacion?.usuario.email ?? null,
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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
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
        if (payload.rol !== 'maestro') {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

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
          inicioSuscripcion,
          personal,
          depuracionHasta,
        } = resultado.data;

        const emailNorm = email.trim().toLowerCase();
        const existente = await buscarUsuarioPorEmailCompat(emailNorm);
        if (existente) {
          return respuesta.code(409).send({ error: 'Ya existe un usuario con ese email' });
        }
        if (depuracionHasta === 'antes_hash') {
          return respuesta.send({ datos: { paso: 'antes_hash' } });
        }

        const hashContrasena = await generarHashContrasena(contrasena);
        if (depuracionHasta === 'despues_hash') {
          return respuesta.send({ datos: { paso: 'despues_hash' } });
        }

        const { claveDueno, claveCliente } = await generarClavesSalonCompat(nombreSalon);
        if (depuracionHasta === 'despues_claves') {
          return respuesta.send({ datos: { paso: 'despues_claves', claveDueno, claveCliente } });
        }

        const fechaInicio = inicioSuscripcion ? crearFechaDesdeISO(inicioSuscripcion) : new Date();
        fechaInicio.setHours(0, 0, 0, 0);
        const vencimiento = new Date(fechaInicio);
        vencimiento.setMonth(vencimiento.getMonth() + 1);

        const formatearFecha = (d: Date) => d.toISOString().split('T')[0]!;

        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const horario = Object.fromEntries(
          diasSemana.map((dia) => [dia, { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '19:00' }]),
        );

        const monedaInicial = obtenerMonedaPorPais(pais);
        const montoInicial = obtenerMontoPlanPorPais(pais);
        const usuarioCreadoId = randomUUID();
        const estudioCreadoId = randomUUID();

        let estudio: Record<string, unknown> | null = null;

        try {
          await insertarRegistroCompat('estudios', {
            id: estudioCreadoId,
            nombre: nombreSalon,
            propietario: nombreAdmin,
            telefono,
            sitioWeb: null,
            pais,
            sucursales: [nombreSalon],
            claveDueno,
            claveCliente,
            activo: true,
            suscripcion: 'mensual',
            inicioSuscripcion: formatearFecha(fechaInicio),
            fechaVencimiento: formatearFecha(vencimiento),
            horario,
            servicios: [],
            serviciosCustom: [],
            festivos: [],
            actualizadoEn: formatearFechaHoraSQL(new Date()),
          });
          if (depuracionHasta === 'despues_estudio') {
            await eliminarRegistrosCompat('estudios', 'id', estudioCreadoId).catch(() => undefined);
            return respuesta.send({ datos: { paso: 'despues_estudio', estudioCreadoId } });
          }

          await insertarRegistroCompat('usuarios', {
            id: usuarioCreadoId,
            email: emailNorm,
            hashContrasena,
            rol: 'dueno',
            estudioId: estudioCreadoId,
          });
          if (depuracionHasta === 'despues_usuario') {
            await eliminarRegistrosCompat('usuarios', 'id', usuarioCreadoId).catch(() => undefined);
            await eliminarRegistrosCompat('estudios', 'id', estudioCreadoId).catch(() => undefined);
            return respuesta.send({ datos: { paso: 'despues_usuario', usuarioCreadoId, estudioCreadoId } });
          }

          estudio = await obtenerEstudioCreadoCompat(
            estudioCreadoId,
            new Set([
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
            ]),
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
                activo: true,
                horaInicio: persona.horaInicio ?? null,
                horaFin: persona.horaFin ?? null,
                descansoInicio: persona.descansoInicio ?? null,
                descansoFin: persona.descansoFin ?? null,
              });
            }
          }

          try {
            await insertarRegistroCompat('pagos', {
              id: randomUUID(),
              estudioId: estudioCreadoId,
              monto: montoInicial,
              moneda: monedaInicial,
              concepto: `Suscripción mensual Beauty Time Pro (${monedaInicial})`,
              fecha: formatearFecha(fechaInicio),
              tipo: 'suscripcion',
              referencia: 'alta_inicial',
            });
          } catch (error) {
            solicitud.log.warn({ err: error, estudioId: estudioCreadoId }, 'No se pudo registrar el pago inicial del salon');
          }
        } catch (error) {
          await eliminarRegistrosCompat('personal', 'estudioId', estudioCreadoId).catch(() => undefined);
          await eliminarRegistrosCompat('pagos', 'estudioId', estudioCreadoId).catch(() => undefined);
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
            },
          },
        });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al crear salon desde admin');
        return respuesta.code(500).send({
          error: 'No se pudo crear el salon',
          detalle: error instanceof Error ? error.message : 'Error desconocido',
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
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

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

      const estaActivo = usuario?.activo ?? estudio.activo;
      const nuevoActivo = !estaActivo;
      const nuevoEstado = nuevoActivo ? 'aprobado' : 'suspendido';

      await prisma.$transaction(async (tx) => {
        await tx.estudio.update({
          where: { id },
          data: { activo: nuevoActivo, estado: nuevoEstado },
        });

        if (usuario) {
          await tx.usuario.update({
            where: { id: usuario.id },
            data: { activo: nuevoActivo, estudioId: id },
          });
        }
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: nuevoActivo ? 'activar_salon' : 'suspender_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: { activo: nuevoActivo, mensaje: nuevoActivo ? 'Cuenta activada' : 'Cuenta suspendida' },
      });
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
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { fechaVencimiento, meses } = solicitud.body;

      if (!fechaVencimiento && !meses) {
        return respuesta.code(400).send({ error: 'fechaVencimiento o meses es requerido' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const renovacion = meses && meses > 0
        ? calcularNuevaFechaVencimiento({
            fechaVencimiento: estudio.fechaVencimiento,
            inicioSuscripcion: estudio.inicioSuscripcion,
            meses,
          })
        : null;

      const fechaFinal = renovacion?.nuevaFechaVencimiento ?? fechaVencimiento!;

      const actualizado = await prisma.estudio.update({
        where: { id },
        data: { fechaVencimiento: fechaFinal },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'renovar_suscripcion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: {
          nombre: estudio.nombre,
          fechaBase: renovacion?.fechaBase ?? estudio.fechaVencimiento,
          fechaVencimientoAnterior: estudio.fechaVencimiento,
          fechaVencimientoNueva: fechaFinal,
          estrategia: renovacion?.estrategia ?? 'manual',
          meses: meses ?? null,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: {
          fechaVencimiento: actualizado.fechaVencimiento,
          fechaBaseRenovacion: renovacion?.fechaBase ?? estudio.fechaVencimiento,
          estrategiaRenovacion: renovacion?.estrategia ?? 'manual',
          mensaje: renovacion
            ? 'Suscripción extendida correctamente'
            : 'Suscripción renovada correctamente',
        },
      });
    },
  );

  servidor.post<{ Params: { id: string } }>(
    '/admin/salones/:id/recordatorio-pago',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id: solicitud.params.id },
        include: {
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

      const dueno = estudio.usuarios[0];
      if (!dueno?.email) {
        return respuesta.code(400).send({ error: 'El salón no tiene correo de contacto del dueño' });
      }

      await enviarEmailRecordatorioPagoSalon({
        email: dueno.email,
        nombreDueno: dueno.nombre || 'equipo del salón',
        nombreSalon: estudio.nombre,
        fechaVencimiento: estudio.fechaVencimiento,
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'recordatorio_pago_salon',
        entidadTipo: 'estudio',
        entidadId: estudio.id,
        detalles: {
          nombre: estudio.nombre,
          fechaVencimiento: estudio.fechaVencimiento,
          emailDestino: dueno.email,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Recordatorio enviado correctamente' } });
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
      if (payload.rol !== 'maestro') {
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

      const inicioMesActual = new Date();
      inicioMesActual.setDate(1);
      const inicioMesActualStr = inicioMesActual.toISOString().split('T')[0]!;

      const inicioMesAnterior = new Date(inicioMesActual);
      inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
      const inicioMesAnteriorStr = inicioMesAnterior.toISOString().split('T')[0]!;

      const finMesAnterior = new Date(inicioMesActual);
      finMesAnterior.setDate(0);
      const finMesAnteriorStr = finMesAnterior.toISOString().split('T')[0]!;

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
        ingresosMesActual,
        ingresosMesAnterior,
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
        prisma.pago.groupBy({
          by: ['moneda'],
          where: { fecha: { gte: inicioMesActualStr, lte: hoy } },
          _sum: { monto: true },
        }),
        prisma.pago.groupBy({
          by: ['moneda'],
          where: { fecha: { gte: inicioMesAnteriorStr, lte: finMesAnteriorStr } },
          _sum: { monto: true },
        }),
      ]);

      const promedioReservasPorSalonActivo =
        salonesActivos > 0 ? Number((reservasUltimos30Dias / salonesActivos).toFixed(1)) : 0;
      const tasaAprobacionUltimos30Dias =
        solicitudesCreadasUltimos30Dias > 0
          ? Number(
              ((salonesAprobadosUltimos30Dias / solicitudesCreadasUltimos30Dias) * 100).toFixed(1),
            )
          : 0;

      const ingresosAnteriorPorMoneda = new Map(
        ingresosMesAnterior.map((registro) => [registro.moneda, registro._sum.monto ?? 0]),
      );
      const ingresosPorMoneda = Array.from(
        new Set([
          ...ingresosMesActual.map((registro) => registro.moneda),
          ...ingresosMesAnterior.map((registro) => registro.moneda),
        ]),
      ).map((moneda) => {
        const actual = ingresosMesActual.find((registro) => registro.moneda === moneda)?._sum.monto ?? 0;
        const anterior = ingresosAnteriorPorMoneda.get(moneda) ?? 0;
        const variacion =
          anterior > 0 ? Number((((actual - anterior) / anterior) * 100).toFixed(1)) : actual > 0 ? 100 : 0;

        return {
          moneda,
          actual,
          anterior,
          variacion,
        };
      });

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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
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
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { salonId, pais, servicioFrecuente, buscar } = solicitud.query;
      const clientes = await construirBaseClientes({ salonId, pais, servicioFrecuente, buscar });

      return respuesta.send({ clientes: clientes.slice(0, 10_000) });
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

  // Traer clientes con sus reservas completadas y datos del salón
  const clientes = await prisma.cliente.findMany({
    where: {
      ...(salonId ? { estudioId: salonId } : {}),
      ...(pais ? { estudio: { pais: pais as 'Mexico' | 'Colombia' } } : {}),
      activo: true,
    },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      email: true,
      estudioId: true,
      estudio: { select: { nombre: true, pais: true } },
      reservas: {
        where: { estado: 'completed' },
        select: {
          fecha: true,
          precioTotal: true,
          serviciosDetalle: {
            where: { estado: 'completed' },
            select: { nombre: true },
          },
        },
        orderBy: { fecha: 'desc' },
      },
    },
    orderBy: { creadoEn: 'desc' },
    take: 15_000,
  });

  // Construir estadísticas por cliente
  const resultado = clientes.map((c) => {
    const reservasCompletadas = c.reservas;
    const totalVisitas = reservasCompletadas.length;
    const totalGastado = reservasCompletadas.reduce((acc, r) => acc + r.precioTotal, 0);
    const ultimaVisita = reservasCompletadas[0]?.fecha ?? null;

    // Servicios únicos realizados + servicio más frecuente
    const frecuencia = new Map<string, number>();
    for (const r of reservasCompletadas) {
      for (const s of r.serviciosDetalle) {
        frecuencia.set(s.nombre, (frecuencia.get(s.nombre) ?? 0) + 1);
      }
    }
    const serviciosRealizados = Array.from(frecuencia.keys());
    let servicioMasFrecuente = '';
    let maxFreq = 0;
    for (const [nombre, freq] of frecuencia) {
      if (freq > maxFreq) { maxFreq = freq; servicioMasFrecuente = nombre; }
    }

    return {
      nombre: c.nombre,
      telefono: c.telefono,
      correo: c.email,
      estudioId: c.estudioId,
      nombreEstudio: c.estudio.nombre,
      paisEstudio: c.estudio.pais,
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
