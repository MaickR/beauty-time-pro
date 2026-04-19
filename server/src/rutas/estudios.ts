import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { parsearExcepcionesDisponibilidad } from '../lib/disponibilidadExcepciones.js';
import { asegurarColumnaTabla, construirSelectDesdeColumnas, obtenerColumnasTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { env } from '../lib/env.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import { METODOS_PAGO_RESERVA, normalizarMetodosPagoReserva } from '../lib/metodosPagoReserva.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import { enviarEmailSolicitudCancelacion } from '../servicios/servicioEmail.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { normalizarServiciosEntrada } from '../lib/serializacionReservas.js';
import { colorHexSchema, emailOpcionalONuloSchema, fechaIsoSchema, horaOpcionalONulaSchema, horaSchema, obtenerMensajeValidacion, telefonoSchema, textoOpcionalONuloSchema, textoSchema, urlOpcionalSchema } from '../lib/validacion.js';
import { esClaveSalonSegura, sanitizarClaveSalon } from '../lib/clavesSalon.js';
import {
  normalizarPlanEstudio,
  obtenerDefinicionPlan,
  validarCantidadEmpleadosActivosPlan,
  validarCantidadServiciosPlan,
  validarReglasSucursalesPorPlan,
} from '../lib/planes.js';
import { asegurarPrecioActualSalon, obtenerPrecioPlanActual, resolverPrecioRenovacion } from '../lib/preciosPlanes.js';
import { obtenerNombresSucursales, obtenerSedesRelacionadas } from '../lib/sedes.js';
import {
  construirFechaHoraEnZona,
  obtenerFechaISOEnZona,
  obtenerMinutosActualesEnZona,
  obtenerZonaHorariaPorPais,
  normalizarZonaHorariaEstudio,
} from '../utils/zonasHorarias.js';
import { generarSlugUnico } from '../utils/generarSlug.js';

const esquemaHorario = z.record(
  z.string(),
  z.object({
    isOpen: z.boolean(),
    openTime: horaSchema,
    closeTime: horaSchema,
  }),
);

const esquemaServicio = z.object({
  name: textoSchema('servicio', 80),
  duration: z.number().int().min(5, 'La duración mínima es 5 minutos').max(720, 'La duración máxima es 720 minutos'),
  price: z.number().int().min(100, 'El precio debe ser mayor a 0').max(1000000000, 'El precio excede el máximo permitido'),
  category: textoOpcionalONuloSchema('categoria', 80).transform((valor) => valor ?? undefined),
});

const esquemaServicioPersonalizado = z.object({
  name: textoSchema('servicioPersonalizado', 80),
  category: textoSchema('categoria', 80),
});

const esquemaExcepcionDisponibilidad = z.object({
  id: z.string().trim().min(1, 'El identificador es obligatorio').optional(),
  fecha: fechaIsoSchema,
  tipo: z.enum(['cerrado', 'horario_modificado']),
  horaInicio: horaOpcionalONulaSchema.optional(),
  horaFin: horaOpcionalONulaSchema.optional(),
  aplicaTodasLasSedes: z.boolean().optional(),
  sedes: z.array(textoSchema('sede', 120)).max(50, 'No puedes asociar más de 50 sedes').optional(),
  motivo: textoOpcionalONuloSchema('motivo', 160),
  activa: z.boolean().optional(),
  creadoEn: z.string().trim().optional(),
  actualizadoEn: z.string().trim().optional(),
}).superRefine((datos, contexto) => {
  if (datos.tipo === 'horario_modificado') {
    if (!datos.horaInicio) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'La hora de apertura es obligatoria', path: ['horaInicio'] });
    }
    if (!datos.horaFin) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'La hora de cierre es obligatoria', path: ['horaFin'] });
    }
    if (datos.horaInicio && datos.horaFin && datos.horaInicio >= datos.horaFin) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'La hora de cierre debe ser posterior a la de apertura', path: ['horaFin'] });
    }
  }

  if (!datos.aplicaTodasLasSedes && (!Array.isArray(datos.sedes) || datos.sedes.length === 0)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona al menos una sede o aplica a todas', path: ['sedes'] });
  }
});

const claveSalonSchema = (campo: 'claveDueno' | 'claveCliente') =>
  textoSchema(campo, 32).transform((valor) => sanitizarClaveSalon(valor)).refine(
    (valor) =>
      esClaveSalonSegura(valor, campo === 'claveDueno' ? 'dueno' : 'cliente'),
    campo === 'claveDueno'
      ? 'La clave de dueño debe usar el formato seguro vigente'
      : 'La clave de cliente debe ser válida y terminar en dos dígitos',
  );

const esquemaEmailContactoOpcional = emailOpcionalONuloSchema('emailContacto');

const esquemaCamposEstudio = {
  nombre: textoSchema('nombre', 120).optional(),
  propietario: textoSchema('propietario', 120).optional(),
  telefono: telefonoSchema.optional(),
  sitioWeb: urlOpcionalSchema,
  pais: textoSchema('pais', 50).optional(),
  plan: z.enum(['STANDARD', 'PRO']).optional(),
  estudioPrincipalId: z.string().trim().min(1, 'Debes seleccionar un salón principal').nullable().optional(),
  permiteReservasPublicas: z.boolean().optional(),
  metodosPagoReserva: z.array(z.enum(METODOS_PAGO_RESERVA)).min(1, 'Selecciona al menos un método de pago').optional(),
  sucursales: z.array(textoSchema('sucursal', 80)).max(20, 'No puedes registrar más de 20 sucursales').optional(),
  horario: esquemaHorario.optional(),
  servicios: z.array(esquemaServicio).max(100, 'No puedes registrar más de 100 servicios').optional(),
  serviciosCustom: z.array(esquemaServicioPersonalizado).max(100, 'No puedes registrar más de 100 servicios personalizados').optional(),
  festivos: z.array(fechaIsoSchema).max(366, 'No puedes registrar más de 366 festivos').optional(),
  excepcionesDisponibilidad: z.array(esquemaExcepcionDisponibilidad).max(500, 'No puedes registrar más de 500 excepciones').optional(),
  colorPrimario: colorHexSchema.optional(),
  descripcion: textoOpcionalONuloSchema('descripcion', 500),
  direccion: textoOpcionalONuloSchema('direccion', 180),
  emailContacto: esquemaEmailContactoOpcional,
  horarioApertura: horaOpcionalONulaSchema,
  horarioCierre: horaOpcionalONulaSchema,
  diasAtencion: textoOpcionalONuloSchema('diasAtencion', 120),
  categorias: textoOpcionalONuloSchema('categorias', 160),
  primeraVez: z.boolean().optional(),
};

const esquemaCrearEstudio = z.object({
  nombre: textoSchema('nombre', 120),
  propietario: textoSchema('propietario', 120).optional(),
  telefono: telefonoSchema,
  sitioWeb: urlOpcionalSchema,
  pais: textoSchema('pais', 50).optional(),
  plan: z.enum(['STANDARD', 'PRO']).optional(),
  estudioPrincipalId: z.string().trim().min(1, 'Debes seleccionar un salón principal').nullable().optional(),
  permiteReservasPublicas: z.boolean().optional(),
  metodosPagoReserva: z.array(z.enum(METODOS_PAGO_RESERVA)).min(1, 'Selecciona al menos un método de pago').optional(),
  sucursales: z.array(textoSchema('sucursal', 80)).max(20).optional(),
  claveDueno: claveSalonSchema('claveDueno'),
  claveCliente: claveSalonSchema('claveCliente'),
  suscripcion: textoSchema('suscripcion', 30).optional(),
  inicioSuscripcion: fechaIsoSchema.optional(),
  fechaVencimiento: fechaIsoSchema.optional(),
  horario: esquemaHorario.optional(),
  servicios: z.array(esquemaServicio).max(100).optional(),
  serviciosCustom: z.array(esquemaServicioPersonalizado).max(100).optional(),
  festivos: z.array(fechaIsoSchema).max(366).optional(),
  excepcionesDisponibilidad: z.array(esquemaExcepcionDisponibilidad).max(500).optional(),
  colorPrimario: colorHexSchema.optional(),
  descripcion: textoOpcionalONuloSchema('descripcion', 500),
  direccion: textoOpcionalONuloSchema('direccion', 180),
  emailContacto: esquemaEmailContactoOpcional,
  horarioApertura: horaOpcionalONulaSchema,
  horarioCierre: horaOpcionalONulaSchema,
  diasAtencion: textoOpcionalONuloSchema('diasAtencion', 120),
  categorias: textoOpcionalONuloSchema('categorias', 160),
  primeraVez: z.boolean().optional(),
}).strict();

const esquemaActualizarEstudio = z.object(esquemaCamposEstudio).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

function obtenerFiltroDemo() {
  return env.ENTORNO === 'development' || !env.DEMO_CLAVE_DUENO
    ? {}
    : { claveDueno: { not: env.DEMO_CLAVE_DUENO } };
}

async function verificarAccesoDuenoAEstudio(usuarioId: string, estudioId: string): Promise<boolean> {
  const estudio = await prisma.estudio.findFirst({
    where: {
      id: estudioId,
      usuarios: {
        some: {
          id: usuarioId,
          rol: 'dueno',
        },
      },
    },
    select: { id: true },
  });

  return Boolean(estudio);
}

async function validarEstudioPrincipal(
  estudioPrincipalId: string,
  estudioActualId?: string,
): Promise<string | null> {
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

  if (estudioActualId && estudioPrincipal.id === estudioActualId) {
    return 'Un salón no puede ser sede de sí mismo';
  }

  if (estudioPrincipal.estudioPrincipalId) {
    return 'Solo puedes asociar sedes a un salón principal';
  }

  if (!estudioPrincipal.activo || estudioPrincipal.estado !== 'aprobado') {
    return 'El salón principal seleccionado no está disponible';
  }

  return null;
}

async function asegurarColumnaPinCancelacion(): Promise<boolean> {
  return asegurarColumnaTabla('estudios', 'pinCancelacionHash', 'VARCHAR(191) NULL');
}

async function asegurarColumnaExcepcionesDisponibilidad(): Promise<boolean> {
  return asegurarColumnaTabla('estudios', 'excepcionesDisponibilidad', 'JSON NULL');
}

async function asegurarColumnaMetodosPagoReserva(): Promise<boolean> {
  return asegurarColumnaTabla('estudios', 'metodosPagoReserva', 'JSON NULL');
}

function normalizarTextoComparacion(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarExcepcionesDisponibilidadEntrada(params: {
  excepciones: z.infer<typeof esquemaExcepcionDisponibilidad>[];
  fechaMinima: string;
  horaActual: string;
  sedesDisponibles: string[];
}): Prisma.InputJsonValue {
  const { excepciones, fechaMinima, horaActual, sedesDisponibles } = params;
  const sedesValidas = new Map(sedesDisponibles.map((sede) => [normalizarTextoComparacion(sede), sede]));
  const llavesActivas = new Set<string>();

  return excepciones.map((excepcion) => {
    if (excepcion.fecha < fechaMinima) {
      throw new Error('No puedes registrar excepciones en fechas pasadas');
    }

    if (
      excepcion.tipo === 'horario_modificado' &&
      excepcion.fecha === fechaMinima &&
      excepcion.horaFin !== undefined &&
      excepcion.horaFin !== null &&
      excepcion.horaFin <= horaActual
    ) {
      throw new Error('El horario modificado debe terminar después de la hora actual');
    }

    const sedesNormalizadas = excepcion.aplicaTodasLasSedes
      ? []
      : Array.from(
          new Set(
            (excepcion.sedes ?? []).map((sede) => {
              const sedeNormalizada = normalizarTextoComparacion(sede);
              const sedeReal = sedesValidas.get(sedeNormalizada);
              if (!sedeReal) {
                throw new Error(`La sede ${sede} no pertenece a este salón`);
              }
              return sedeReal;
            }),
          ),
        );

    const llave = excepcion.aplicaTodasLasSedes
      ? `${excepcion.fecha}|todas`
      : `${excepcion.fecha}|${sedesNormalizadas.map(normalizarTextoComparacion).sort().join(',')}`;
    const activa = excepcion.activa ?? true;

    if (activa) {
      if (llavesActivas.has(llave)) {
        throw new Error('No puedes registrar dos excepciones activas para la misma fecha y sedes');
      }
      llavesActivas.add(llave);
    }

    const marcaTiempo = new Date().toISOString();

    return {
      id: excepcion.id?.trim() || crypto.randomUUID(),
      fecha: excepcion.fecha,
      tipo: excepcion.tipo,
      horaInicio: excepcion.tipo === 'horario_modificado' ? excepcion.horaInicio ?? null : null,
      horaFin: excepcion.tipo === 'horario_modificado' ? excepcion.horaFin ?? null : null,
      aplicaTodasLasSedes: excepcion.aplicaTodasLasSedes ?? false,
      sedes: sedesNormalizadas,
      motivo: excepcion.motivo ?? null,
      activa,
      creadoEn: excepcion.creadoEn?.trim() || marcaTiempo,
      actualizadoEn: marcaTiempo,
    };
  }) as Prisma.InputJsonValue;
}

function formatearHoraDesdeMinutos(totalMinutos: number): string {
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function esErrorCompatibilidadEstudio(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2022' ||
    /Unknown column/i.test(mensaje) ||
    /(pinCancelacionHash|plan|primeraVez|cancelacionSolicitada|fechaSolicitudCancelacion|motivoCancelacion|precioPlanActualId|precioPlanProximoId|fechaAplicacionPrecioProximo|estudioPrincipalId|permiteReservasPublicas|excepcionesDisponibilidad)/i.test(
      mensaje,
    )
  );
}

const seleccionarPersonalEstudio = {
  id: true,
  estudioId: true,
  nombre: true,
  avatarUrl: true,
  especialidades: true,
  activo: true,
  horaInicio: true,
  horaFin: true,
  descansoInicio: true,
  descansoFin: true,
  diasTrabajo: true,
  creadoEn: true,
} satisfies Prisma.PersonalSelect;

const seleccionarEstudioPanelModerno = {
  id: true,
  nombre: true,
  slug: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  sitioWeb: true,
  pais: true,
  sucursales: true,
  claveDueno: true,
  claveCliente: true,
  activo: true,
  plan: true,
  pinCancelacionHash: true,
  estado: true,
  suscripcion: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  precioPlanActualId: true,
  precioPlanProximoId: true,
  fechaAplicacionPrecioProximo: true,
  horario: true,
  servicios: true,
  serviciosCustom: true,
  festivos: true,
  excepcionesDisponibilidad: true,
  metodosPagoReserva: true,
  colorPrimario: true,
  logoUrl: true,
  descripcion: true,
  direccion: true,
  emailContacto: true,
  horarioApertura: true,
  horarioCierre: true,
  diasAtencion: true,
  categorias: true,
  primeraVez: true,
  permiteReservasPublicas: true,
  cancelacionSolicitada: true,
  fechaSolicitudCancelacion: true,
  motivoCancelacion: true,
  creadoEn: true,
  actualizadoEn: true,
  estudioPrincipal: {
    select: {
      id: true,
      nombre: true,
      slug: true,
    },
  },
  sedes: {
    orderBy: { creadoEn: 'asc' },
    select: {
      id: true,
      nombre: true,
      slug: true,
      plan: true,
      estado: true,
      activo: true,
      fechaVencimiento: true,
      propietario: true,
      telefono: true,
      direccion: true,
      emailContacto: true,
      estudioPrincipalId: true,
      permiteReservasPublicas: true,
      precioPlanActual: {
        select: {
          monto: true,
          moneda: true,
        },
      },
    },
  },
  precioPlanActual: {
    select: {
      id: true,
      plan: true,
      pais: true,
      moneda: true,
      monto: true,
      version: true,
      vigenteDesde: true,
    },
  },
  precioPlanProximo: {
    select: {
      id: true,
      plan: true,
      pais: true,
      moneda: true,
      monto: true,
      version: true,
      vigenteDesde: true,
    },
  },
  personal: {
    where: { activo: true },
    orderBy: { creadoEn: 'asc' },
    select: seleccionarPersonalEstudio,
  },
} satisfies Prisma.EstudioSelect;

const seleccionarEstudioPanelCompat = {
  id: true,
  nombre: true,
  slug: true,
  estudioPrincipalId: true,
  propietario: true,
  telefono: true,
  sitioWeb: true,
  pais: true,
  sucursales: true,
  claveDueno: true,
  claveCliente: true,
  activo: true,
  estado: true,
  suscripcion: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  horario: true,
  servicios: true,
  serviciosCustom: true,
  festivos: true,
  excepcionesDisponibilidad: true,
  colorPrimario: true,
  logoUrl: true,
  descripcion: true,
  direccion: true,
  emailContacto: true,
  horarioApertura: true,
  horarioCierre: true,
  diasAtencion: true,
  categorias: true,
  permiteReservasPublicas: true,
  creadoEn: true,
  actualizadoEn: true,
  personal: {
    where: { activo: true },
    orderBy: { creadoEn: 'asc' },
    select: seleccionarPersonalEstudio,
  },
} satisfies Prisma.EstudioSelect;

function serializarEstudioPanel(estudio: Record<string, unknown>) {
  const { pinCancelacionHash, ...resto } = estudio;
  const precioActual = (estudio['precioPlanActual'] as Record<string, unknown> | null | undefined) ?? null;
  const precioProximo = (estudio['precioPlanProximo'] as Record<string, unknown> | null | undefined) ?? null;
  const sucursalesLegacy = Array.isArray(estudio['sucursales']) ? (estudio['sucursales'] as string[]) : [];
  const sedes = obtenerSedesRelacionadas(estudio, sucursalesLegacy);
  const estudioPrincipal =
    (estudio['estudioPrincipal'] as Record<string, unknown> | null | undefined) ?? null;
  const precioRenovacion = resolverPrecioRenovacion({
    fechaVencimiento: (estudio['fechaVencimiento'] as string) ?? '',
    fechaAplicacionPrecioProximo: (estudio['fechaAplicacionPrecioProximo'] as string | null | undefined) ?? null,
    precioPlanActual: precioActual
      ? {
          id: (precioActual['id'] as string) ?? '',
          plan: ((precioActual['plan'] as string) ?? 'STANDARD') as 'STANDARD' | 'PRO',
          pais: (precioActual['pais'] as string) ?? 'Mexico',
          moneda: (precioActual['moneda'] as string) ?? 'MXN',
          monto: (precioActual['monto'] as number) ?? 0,
          version: (precioActual['version'] as number) ?? 1,
          vigenteDesde: new Date((precioActual['vigenteDesde'] as string | Date | undefined) ?? new Date()),
        }
      : null,
    precioPlanProximo: precioProximo
      ? {
          id: (precioProximo['id'] as string) ?? '',
          plan: ((precioProximo['plan'] as string) ?? 'STANDARD') as 'STANDARD' | 'PRO',
          pais: (precioProximo['pais'] as string) ?? 'Mexico',
          moneda: (precioProximo['moneda'] as string) ?? 'MXN',
          monto: (precioProximo['monto'] as number) ?? 0,
          version: (precioProximo['version'] as number) ?? 1,
          vigenteDesde: new Date((precioProximo['vigenteDesde'] as string | Date | undefined) ?? new Date()),
        }
      : null,
  }, (estudio['fechaVencimiento'] as string) ?? '');

  return {
    ...resto,
    plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
    estudioPrincipalId: (estudio['estudioPrincipalId'] as string | null | undefined) ?? null,
    estudioPrincipal: estudioPrincipal
      ? {
          id: (estudioPrincipal['id'] as string) ?? '',
          nombre: (estudioPrincipal['nombre'] as string) ?? '',
          slug: (estudioPrincipal['slug'] as string | null | undefined) ?? null,
        }
      : null,
    esSede: Boolean((estudio['estudioPrincipalId'] as string | null | undefined) ?? null),
    permiteReservasPublicas:
      (estudio['permiteReservasPublicas'] as boolean | undefined) ?? true,
    metodosPagoReserva: normalizarMetodosPagoReserva(estudio['metodosPagoReserva']),
    excepcionesDisponibilidad: parsearExcepcionesDisponibilidad(estudio['excepcionesDisponibilidad']),
    sedes,
    sucursales: obtenerNombresSucursales(estudio, sucursalesLegacy),
    primeraVez: (estudio['primeraVez'] as boolean | undefined) ?? true,
    cancelacionSolicitada: (estudio['cancelacionSolicitada'] as boolean | undefined) ?? false,
    fechaSolicitudCancelacion:
      (estudio['fechaSolicitudCancelacion'] as Date | string | null | undefined) ?? null,
    motivoCancelacion: (estudio['motivoCancelacion'] as string | null | undefined) ?? null,
    precioSuscripcionActual: (precioActual?.['monto'] as number | undefined) ?? null,
    monedaSuscripcion: (precioActual?.['moneda'] as string | undefined) ?? null,
    precioSuscripcionProximo: (precioProximo?.['monto'] as number | undefined) ?? null,
    fechaAplicacionPrecioProximo:
      (estudio['fechaAplicacionPrecioProximo'] as string | null | undefined) ?? null,
    precioRenovacion: precioRenovacion.precioAplicado?.monto ?? (precioActual?.['monto'] as number | undefined) ?? null,
    pinCancelacionConfigurado:
      typeof pinCancelacionHash === 'string' && pinCancelacionHash.trim().length > 0,
  };
}

function obtenerInicioSemanaISO(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
  const diaSemana = fecha.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setDate(fecha.getDate() + ajuste);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function obtenerInicioMesISO(fechaISO: string): string {
  const [anio, mes] = fechaISO.split('-').map(Number);
  return `${String(anio ?? 0).padStart(4, '0')}-${String(mes ?? 1).padStart(2, '0')}-01`;
}

function obtenerMenorFechaISO(...fechas: string[]): string {
  return [...fechas].sort((a, b) => a.localeCompare(b))[0] ?? fechas[0] ?? '';
}

function construirHoraFin(horaInicio: string, duracion: number): string {
  const [horas, minutos] = horaInicio.split(':').map(Number);
  const totalMinutos = (horas ?? 0) * 60 + (minutos ?? 0) + duracion;
  const horaFinal = Math.floor(totalMinutos / 60) % 24;
  const minutoFinal = totalMinutos % 60;
  return `${String(horaFinal).padStart(2, '0')}:${String(minutoFinal).padStart(2, '0')}`;
}

function construirJornadaTexto(personal: {
  horaInicio: string | null;
  horaFin: string | null;
}): string {
  if (!personal.horaInicio || !personal.horaFin) {
    return 'Horario general del salón';
  }

  return `${personal.horaInicio} - ${personal.horaFin}`;
}

function construirDescansoTexto(personal: {
  descansoInicio: string | null;
  descansoFin: string | null;
}): string {
  if (!personal.descansoInicio || !personal.descansoFin) {
    return 'Sin descanso configurado';
  }

  return `${personal.descansoInicio} - ${personal.descansoFin}`;
}

function construirCuentaRegresivaCorte(params: {
  fechaCorte: string;
  zonaHoraria?: string | null;
  pais?: string | null;
  ahora?: Date;
}) {
  const fechaObjetivo = construirFechaHoraEnZona(
    params.fechaCorte,
    '23:59',
    params.zonaHoraria,
    params.pais,
  );
  const referencia = params.ahora ?? new Date();
  const diferenciaMs = fechaObjetivo.getTime() - referencia.getTime();
  const totalMinutos = Math.max(0, Math.floor(diferenciaMs / 60000));

  return {
    fecha: params.fechaCorte,
    fechaHoraObjetivo: fechaObjetivo.toISOString(),
    dias: Math.floor(totalMinutos / (60 * 24)),
    horas: Math.floor((totalMinutos % (60 * 24)) / 60),
    minutos: totalMinutos % 60,
    totalMinutos,
    vencido: diferenciaMs <= 0,
  };
}

function construirEnlaceWhatsAppSoporte(params: {
  pais?: string | null;
  nombreSalon: string;
  plan: string;
  fechaCorte: string;
  moneda: string;
}) {
  const numero = params.pais === 'Colombia' ? '573006934216' : '5255641341516';
  const mensaje = [
    'Hola, equipo Beauty Time Pro.',
    `Necesito apoyo con el plan ${params.plan} de mi salón ${params.nombreSalon}.`,
    `Mi próxima fecha de corte es ${params.fechaCorte} y mi moneda es ${params.moneda}.`,
    '¿Me ayudan por favor?',
  ].join(' ');

  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

interface PagoVentaProductoMetrica {
  id: string;
  fecha: string;
  monto: number;
  concepto: string;
  tipo: string | null;
  referencia: string | null;
  creadoEn: Date;
}

function esErrorCompatibilidadPagoMetrica(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return codigo === 'P2022' || /Unknown column/i.test(mensaje) || /(tipo|referencia)/i.test(mensaje);
}

function esPagoVentaProducto(tipo: string | null | undefined, concepto: string): boolean {
  return tipo === 'venta_producto' || concepto.startsWith('Venta producto:');
}

function extraerHoraEnZona(fecha: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zonaHoraria,
  }).format(fecha);
}

function parsearReferenciaVentaProducto(referencia: string | null): {
  productoNombre: string | null;
  empleadoId: string | null;
  empleadoNombre: string | null;
  clienteNombre: string | null;
  sucursal: string | null;
  hora: string | null;
} | null {
  if (!referencia) return null;

  try {
    const datos = JSON.parse(referencia) as Record<string, unknown>;
    return {
      productoNombre: typeof datos['pn'] === 'string' ? datos['pn'] : null,
      empleadoId: typeof datos['e'] === 'string' ? datos['e'] : null,
      empleadoNombre: typeof datos['en'] === 'string' ? datos['en'] : null,
      clienteNombre: typeof datos['c'] === 'string' ? datos['c'] : null,
      sucursal: typeof datos['s'] === 'string' ? datos['s'] : null,
      hora: typeof datos['h'] === 'string' ? datos['h'] : null,
    };
  } catch {
    return null;
  }
}

async function obtenerPagosVentaProductoMetricas(params: {
  estudioId: string;
  fechaInicio: string;
  fechaFin: string;
}): Promise<PagoVentaProductoMetrica[]> {
  try {
    return await prisma.pago.findMany({
      where: {
        estudioId: params.estudioId,
        fecha: { gte: params.fechaInicio, lte: params.fechaFin },
        OR: [{ tipo: 'venta_producto' }, { concepto: { startsWith: 'Venta producto:' } }],
      },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        fecha: true,
        monto: true,
        concepto: true,
        tipo: true,
        referencia: true,
        creadoEn: true,
      },
    });
  } catch (error) {
    if (!esErrorCompatibilidadPagoMetrica(error)) {
      throw error;
    }

    const pagosCompat = await prisma.pago.findMany({
      where: {
        estudioId: params.estudioId,
        fecha: { gte: params.fechaInicio, lte: params.fechaFin },
        concepto: { startsWith: 'Venta producto:' },
      },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        fecha: true,
        monto: true,
        concepto: true,
        creadoEn: true,
      },
    });

    return pagosCompat.map((pago) => ({
      ...pago,
      tipo: null,
      referencia: null,
    }));
  }
}

async function listarEstudiosPanel(where: Prisma.EstudioWhereInput = {}) {
  await asegurarColumnaExcepcionesDisponibilidad();

  try {
    return await prisma.estudio.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      select: seleccionarEstudioPanelModerno,
    });
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }

    return prisma.estudio.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      select: seleccionarEstudioPanelCompat,
    });
  }
}

async function obtenerEstudioPanel(where: Prisma.EstudioWhereInput) {
  await asegurarColumnaExcepcionesDisponibilidad();

  try {
    return await prisma.estudio.findFirst({
      where,
      select: seleccionarEstudioPanelModerno,
    });
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }

    return prisma.estudio.findFirst({
      where,
      select: seleccionarEstudioPanelCompat,
    });
  }
}

export async function rutasEstudios(servidor: FastifyInstance): Promise<void> {
  // GET /estudios — solo rol maestro
  servidor.get('/estudios', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
    const filtroDemo = obtenerFiltroDemo();
    const estudios = await listarEstudiosPanel(filtroDemo);
    return respuesta.send({
      datos: estudios.map((estudio) =>
        serializarEstudioPanel(estudio as unknown as Record<string, unknown>),
      ),
    });
  });

  // GET /estudios/:id — dueno o maestro
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const filtroDemo = obtenerFiltroDemo();
      const estudioBase = await prisma.estudio.findFirst({
        where: { id, ...filtroDemo },
        select: {
          id: true,
          plan: true,
          pais: true,
          precioPlanActualId: true,
        },
      });
      if (!estudioBase) return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      if (!estudioBase.precioPlanActualId) {
        await asegurarPrecioActualSalon({
          estudioId: estudioBase.id,
          plan: normalizarPlanEstudio(estudioBase.plan),
          pais: estudioBase.pais,
        });
      }
      const estudio = await obtenerEstudioPanel({ id, ...filtroDemo });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      return respuesta.send({
        datos: serializarEstudioPanel(estudio as unknown as Record<string, unknown>),
      });
    },
  );

  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id/metricas-dashboard',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'dueno') {
        const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
        if (!tieneAcceso) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          plan: true,
          pais: true,
          zonaHoraria: true,
          inicioSuscripcion: true,
          fechaVencimiento: true,
          precioPlanActual: {
            select: {
              monto: true,
              moneda: true,
            },
          },
          personal: {
            where: { activo: true },
            orderBy: { nombre: 'asc' },
            select: {
              id: true,
              nombre: true,
              especialidades: true,
              horaInicio: true,
              horaFin: true,
              descansoInicio: true,
              descansoFin: true,
            },
          },
          productos: {
            select: {
              id: true,
            },
            where: { activo: true },
            take: 1,
          },
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      const zonaHoraria = normalizarZonaHorariaEstudio(estudio.zonaHoraria, estudio.pais);
      const fechaActual = obtenerFechaISOEnZona(new Date(), zonaHoraria, estudio.pais);
      const inicioSemana = obtenerInicioSemanaISO(fechaActual);
      const inicioMes = obtenerInicioMesISO(fechaActual);
      const inicioConsulta = obtenerMenorFechaISO(inicioSemana, inicioMes);

      const [reservasHoy, reservasIngresos, pagosVentaProducto] = await Promise.all([
        prisma.reserva.findMany({
          where: {
            estudioId: id,
            fecha: fechaActual,
            estado: { not: 'cancelled' },
          },
          orderBy: [{ horaInicio: 'asc' }, { creadoEn: 'asc' }],
          include: {
            empleado: {
              select: {
                id: true,
                nombre: true,
              },
            },
            serviciosDetalle: {
              select: {
                id: true,
                nombre: true,
                precio: true,
                duracion: true,
                estado: true,
                orden: true,
              },
              orderBy: { orden: 'asc' },
            },
          },
        }),
        prisma.reserva.findMany({
          where: {
            estudioId: id,
            fecha: { gte: inicioConsulta, lte: fechaActual },
            estado: 'completed',
          },
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }, { creadoEn: 'desc' }],
          include: {
            empleado: {
              select: {
                id: true,
                nombre: true,
              },
            },
            serviciosDetalle: {
              select: {
                id: true,
                nombre: true,
                precio: true,
                duracion: true,
                estado: true,
                orden: true,
              },
              orderBy: { orden: 'asc' },
            },
          },
        }),
        obtenerPagosVentaProductoMetricas({
          estudioId: id,
          fechaInicio: inicioConsulta,
          fechaFin: fechaActual,
        }),
      ]);

      const citasHoy = reservasHoy.map((reserva) => {
        const servicios =
          reserva.serviciosDetalle.length > 0
            ? reserva.serviciosDetalle.map((servicio) => servicio.nombre)
            : normalizarServiciosEntrada(reserva.servicios).map((servicio) => servicio.name);

        return {
          id: reserva.id,
          fecha: reserva.fecha,
          hora: reserva.horaInicio,
          horaFin: construirHoraFin(reserva.horaInicio, reserva.duracion),
          cliente: reserva.nombreCliente,
          telefonoCliente: reserva.telefonoCliente,
          especialista: reserva.empleado?.nombre ?? '',
          especialistaId: reserva.empleado?.id ?? '',
          servicioPrincipal: servicios[0] ?? 'Servicio',
          servicios,
          sucursal: reserva.sucursal,
          precioEstimado: reserva.precioTotal,
          estado: reserva.estado,
          observaciones: reserva.observaciones ?? null,
          creadoEn: reserva.creadoEn,
        };
      });

      const filasIngresosServicios = reservasIngresos
        .flatMap((reserva) => {
          const servicios =
            reserva.serviciosDetalle.length > 0
              ? reserva.serviciosDetalle
              : normalizarServiciosEntrada(reserva.servicios).map((servicio, indice) => ({
                  id: servicio.id ?? `${reserva.id}-${indice}`,
                  nombre: servicio.name,
                  precio: servicio.price,
                  duracion: servicio.duration,
                  estado: servicio.status ?? reserva.estado,
                  orden: servicio.order ?? indice,
                }));

          return servicios
            .filter((servicio) => servicio.estado === 'completed')
            .map((servicio, indice) => ({
              id: `${reserva.id}-${servicio.id ?? indice}`,
              fecha: reserva.fecha,
              hora: reserva.horaInicio,
              concepto: servicio.nombre,
              tipo: 'servicio' as const,
              cliente: reserva.nombreCliente,
              especialista: reserva.empleado?.nombre ?? '',
              especialistaId: reserva.empleado?.id ?? '',
              sucursal: reserva.sucursal,
              total: servicio.precio,
            }));
        })
        .sort((a, b) => {
          const comparacionFecha = b.fecha.localeCompare(a.fecha);
          if (comparacionFecha !== 0) return comparacionFecha;
          return b.hora.localeCompare(a.hora);
        });

      const filasIngresosProductos = pagosVentaProducto
        .filter((pago) => esPagoVentaProducto(pago.tipo, pago.concepto))
        .map((pago) => {
          const referencia = parsearReferenciaVentaProducto(pago.referencia);
          const conceptoLimpio = pago.concepto.replace(/^Venta producto:\s*/i, '').trim();

          return {
            id: `producto-${pago.id}`,
            fecha: pago.fecha,
            hora: referencia?.hora ?? extraerHoraEnZona(pago.creadoEn, zonaHoraria),
            concepto: referencia?.productoNombre ?? conceptoLimpio ?? 'Producto',
            tipo: 'producto' as const,
            cliente: referencia?.clienteNombre ?? 'Venta mostrador',
            especialista: referencia?.empleadoNombre ?? '',
            especialistaId: referencia?.empleadoId ?? '',
            sucursal: referencia?.sucursal ?? 'Principal',
            total: pago.monto,
          };
        });

      const filasIngresos = [...filasIngresosServicios, ...filasIngresosProductos]
        .sort((a, b) => {
          const comparacionFecha = b.fecha.localeCompare(a.fecha);
          if (comparacionFecha !== 0) return comparacionFecha;
          return b.hora.localeCompare(a.hora);
        });

      const ingresosDia = filasIngresos.filter((fila) => fila.fecha === fechaActual);
      const ingresosSemana = filasIngresos.filter((fila) => fila.fecha >= inicioSemana);
      const ingresosMes = filasIngresos.filter((fila) => fila.fecha >= inicioMes);
      const resumenCitasPorEspecialista = new Map<string, number>();

      citasHoy.forEach((cita) => {
        resumenCitasPorEspecialista.set(
          cita.especialistaId,
          (resumenCitasPorEspecialista.get(cita.especialistaId) ?? 0) + 1,
        );
      });

      const especialistasActivos = estudio.personal.map((persona) => {
        const proximaCita =
          citasHoy.find((cita) => cita.especialistaId === persona.id)?.hora ?? null;

        return {
          id: persona.id,
          nombre: persona.nombre,
          servicios: persona.especialidades,
          jornada: construirJornadaTexto(persona),
          descanso: construirDescansoTexto(persona),
          citasHoy: resumenCitasPorEspecialista.get(persona.id) ?? 0,
          proximaCita,
        };
      });

      const moneda = (estudio.precioPlanActual?.moneda as string | undefined) ?? (estudio.pais === 'Colombia' ? 'COP' : 'MXN');
      const nombrePlan = obtenerDefinicionPlan(estudio.plan).nombre;
      const cuentaRegresiva = construirCuentaRegresivaCorte({
        fechaCorte: estudio.fechaVencimiento,
        zonaHoraria,
        pais: estudio.pais,
      });
      const hayCatalogoProductos = estudio.productos.length > 0;
      const ventasProductosRegistradas = filasIngresosProductos.length > 0;

      return respuesta.send({
        datos: {
          actualizadoEn: new Date().toISOString(),
          fechaActual,
          zonaHoraria,
          resumen: {
            citasAgendadasHoy: citasHoy.length,
            totalGanadoMes: ingresosMes.reduce((acumulado, fila) => acumulado + fila.total, 0),
            especialistasActivos: especialistasActivos.length,
            planActual: estudio.plan,
            diasParaCorte: cuentaRegresiva.dias,
          },
          citasHoy,
          ingresos: {
            dia: {
              total: ingresosDia.reduce((acumulado, fila) => acumulado + fila.total, 0),
              filas: ingresosDia,
            },
            semana: {
              total: ingresosSemana.reduce((acumulado, fila) => acumulado + fila.total, 0),
              filas: ingresosSemana,
            },
            mes: {
              total: ingresosMes.reduce((acumulado, fila) => acumulado + fila.total, 0),
              filas: ingresosMes,
            },
          },
          especialistasActivos,
          plan: {
            actual: estudio.plan,
            nombre: nombrePlan,
            fechaAdquisicion: estudio.inicioSuscripcion,
            proximoCorte: estudio.fechaVencimiento,
            precioActual: estudio.precioPlanActual?.monto ?? null,
            moneda,
            pais: estudio.pais,
            whatsapp: construirEnlaceWhatsAppSoporte({
              pais: estudio.pais,
              nombreSalon: estudio.nombre,
              plan: nombrePlan,
              fechaCorte: estudio.fechaVencimiento,
              moneda,
            }),
          },
          corte: cuentaRegresiva,
          soporte: {
            whatsapp: construirEnlaceWhatsAppSoporte({
              pais: estudio.pais,
              nombreSalon: estudio.nombre,
              plan: nombrePlan,
              fechaCorte: estudio.fechaVencimiento,
              moneda,
            }),
          },
          contextoProductos: {
            planPermiteProductos: estudio.plan === 'PRO',
            ventasRegistradas: ventasProductosRegistradas,
            catalogoConfigurado: hayCatalogoProductos,
            mensaje:
              estudio.plan === 'PRO'
                ? ventasProductosRegistradas
                  ? 'Las ventas de productos registradas ya se integran en el balance financiero de este salón.'
                  : 'Tu plan PRO ya permite ventas de productos. Registra la primera venta para verla reflejada en este balance.'
                : 'Las ventas de productos se habilitan en el plan Pro.',
          },
        },
      });
    },
  );

  // POST /estudios — solo maestro
  servidor.post<{ Body: Record<string, unknown> }>(
    '/estudios',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const resultado = esquemaCrearEstudio.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const datos = resultado.data;
      await asegurarColumnaExcepcionesDisponibilidad();
      await asegurarColumnaMetodosPagoReserva();
      if (datos.estudioPrincipalId) {
        const errorEstudioPrincipal = await validarEstudioPrincipal(datos.estudioPrincipalId);
        if (errorEstudioPrincipal) {
          return respuesta.code(400).send({ error: errorEstudioPrincipal });
        }
      }
      const categorias = resolverCategoriasSalon({
        categorias: datos.categorias,
        servicios: datos.servicios,
        serviciosCustom: datos.serviciosCustom,
      });
      const planNormalizado = normalizarPlanEstudio(datos.plan);
      const paisNormalizado = datos.pais ?? 'Mexico';
      const precioPlanActual = await obtenerPrecioPlanActual(planNormalizado, paisNormalizado);
      if (!precioPlanActual) {
        return respuesta.code(500).send({
          error: `No existe un precio configurado para el plan ${planNormalizado} en ${paisNormalizado}`,
        });
      }
      const cantidadServicios = Array.isArray(datos.servicios) ? datos.servicios.length : 0;
      const errorServiciosPlan = validarCantidadServiciosPlan({
        plan: planNormalizado,
        cantidadNueva: cantidadServicios,
      });
      if (errorServiciosPlan) {
        return respuesta.code(400).send({ error: errorServiciosPlan, codigo: 'LIMITE_PLAN' });
      }

      const errorSucursalesPlan = validarReglasSucursalesPorPlan({
        plan: planNormalizado,
        estudioPrincipalId: datos.estudioPrincipalId ?? null,
        sucursales: datos.sucursales,
      });
      if (errorSucursalesPlan) {
        return respuesta.code(400).send({ error: errorSucursalesPlan, codigo: 'LIMITE_PLAN' });
      }

      const estudio = await prisma.estudio.create({
        data: {
          nombre: datos.nombre,
          slug: await generarSlugUnico(datos.nombre),
          propietario: datos.propietario ?? '',
          telefono: datos.telefono,
          sitioWeb: datos.sitioWeb,
          pais: paisNormalizado,
          zonaHoraria: obtenerZonaHorariaPorPais(paisNormalizado),
          plan: planNormalizado,
          estudioPrincipalId: datos.estudioPrincipalId ?? null,
          permiteReservasPublicas: datos.permiteReservasPublicas ?? true,
          sucursales: datos.estudioPrincipalId ? [] : (datos.sucursales ?? []),
          claveDueno: datos.claveDueno.toUpperCase(),
          claveCliente: datos.claveCliente.toUpperCase(),
          suscripcion: datos.suscripcion ?? 'mensual',
          inicioSuscripcion:
            datos.inicioSuscripcion ??
            obtenerFechaISOEnZona(
              new Date(),
              obtenerZonaHorariaPorPais(paisNormalizado),
              paisNormalizado,
            ),
          fechaVencimiento: datos.fechaVencimiento ?? '',
          precioPlanActualId: precioPlanActual.id,
          horario: datos.horario ?? {},
          servicios: (datos.servicios ?? []) as Prisma.InputJsonValue,
          serviciosCustom: (datos.serviciosCustom ?? []) as Prisma.InputJsonValue,
          festivos: datos.festivos ?? [],
          excepcionesDisponibilidad: (datos.excepcionesDisponibilidad ?? []) as Prisma.InputJsonValue,
          metodosPagoReserva: normalizarMetodosPagoReserva(datos.metodosPagoReserva) as Prisma.InputJsonValue,
          ...(datos.colorPrimario !== undefined && { colorPrimario: datos.colorPrimario }),
          ...(datos.descripcion !== undefined && { descripcion: sanitizarTexto(datos.descripcion ?? '') }),
          ...(datos.direccion !== undefined && { direccion: sanitizarTexto(datos.direccion ?? '') }),
          ...(datos.emailContacto !== undefined && { emailContacto: datos.emailContacto }),
          ...(datos.horarioApertura !== undefined && { horarioApertura: datos.horarioApertura }),
          ...(datos.horarioCierre !== undefined && { horarioCierre: datos.horarioCierre }),
          ...(datos.diasAtencion !== undefined && { diasAtencion: datos.diasAtencion }),
          ...(datos.primeraVez !== undefined && { primeraVez: datos.primeraVez }),
          categorias,
        },
      });
      return respuesta.code(201).send({ datos: estudio });
    },
  );

  // PUT /estudios/:id — maestro o dueno del propio estudio
  servidor.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
        const { id } = solicitud.params;
        if (!tieneAccesoAdministrativoEstudio(payload, id)) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }
        if (payload.rol === 'dueno') {
          const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
          if (!tieneAcceso) {
            return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
          }
        }
        const resultado = esquemaActualizarEstudio.safeParse(solicitud.body);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
        }

        const datos = resultado.data;
        await asegurarColumnaExcepcionesDisponibilidad();
        await asegurarColumnaMetodosPagoReserva();
        if (datos.estudioPrincipalId) {
          const errorEstudioPrincipal = await validarEstudioPrincipal(datos.estudioPrincipalId, id);
          if (errorEstudioPrincipal) {
            return respuesta.code(400).send({ error: errorEstudioPrincipal });
          }
        }
        const [columnasEstudios, tablasDisponibles] = await Promise.all([
          obtenerColumnasTabla('estudios'),
          obtenerTablasDisponibles(),
        ]);
        const columnaPrimeraVezDisponible = columnasEstudios.has('primeraVez');
        let estudioExistente: {
          categorias: unknown;
          servicios: unknown;
          serviciosCustom: unknown;
          plan?: string;
          pais?: string;
          primeraVez?: boolean | null;
        } | null;
        try {
          estudioExistente = await prisma.estudio.findUnique({
            where: { id },
            select: {
              categorias: true,
              servicios: true,
              serviciosCustom: true,
              plan: true,
              pais: true,
              ...(columnaPrimeraVezDisponible ? { primeraVez: true } : {}),
            },
          });
        } catch (error) {
          if (!esErrorCompatibilidadEstudio(error)) {
            throw error;
          }
          estudioExistente = await prisma.estudio.findUnique({
            where: { id },
            select: {
              categorias: true,
              servicios: true,
              serviciosCustom: true,
              pais: true,
              ...(columnaPrimeraVezDisponible ? { primeraVez: true } : {}),
            },
          });
        }

        if (!estudioExistente) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        const estudioAccesible = await prisma.estudio.findUnique({
          where: { id },
          select: { nombre: true, sucursales: true, sedes: { select: { nombre: true }, where: { activo: true } }, zonaHoraria: true, pais: true },
        });

        if (!estudioAccesible) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        const zonaHorariaSalon = normalizarZonaHorariaEstudio(estudioAccesible.zonaHoraria, estudioAccesible.pais);
        const horaActualSalon = formatearHoraDesdeMinutos(
          obtenerMinutosActualesEnZona(new Date(), zonaHorariaSalon, estudioAccesible.pais),
        );
        const sedesDisponibles = [
          estudioAccesible.nombre,
          ...obtenerNombresSucursales(
            {
              id,
              nombre: estudioAccesible.nombre,
              sedes: estudioAccesible.sedes,
            } as Record<string, unknown>,
            Array.isArray(estudioAccesible.sucursales) ? (estudioAccesible.sucursales as string[]) : [],
          ),
        ];

        if (payload.rol !== 'maestro' && datos.plan !== undefined) {
          return respuesta.code(403).send({ error: 'Solo el panel maestro puede cambiar el plan del salón' });
        }

        const planSiguiente = normalizarPlanEstudio(datos.plan ?? estudioExistente.plan);
        const estudioPrincipalSiguiente =
          datos.estudioPrincipalId !== undefined
            ? datos.estudioPrincipalId
            : ('estudioPrincipalId' in estudioExistente
                ? ((estudioExistente as { estudioPrincipalId?: string | null }).estudioPrincipalId ?? null)
                : null);
        const sucursalesSiguientes =
          datos.sucursales !== undefined
            ? datos.sucursales
            : (Array.isArray((estudioAccesible as { sucursales?: unknown }).sucursales)
                ? ((estudioAccesible as { sucursales?: string[] }).sucursales ?? [])
                : []);
        const serviciosActuales = Array.isArray(estudioExistente.servicios)
          ? estudioExistente.servicios.length
          : 0;
        const serviciosNuevos = Array.isArray(datos.servicios)
          ? datos.servicios.length
          : serviciosActuales;
        const errorServicios = validarCantidadServiciosPlan({
          plan: planSiguiente,
          cantidadNueva: serviciosNuevos,
          cantidadActual: serviciosActuales,
        });
        if (errorServicios) {
          return respuesta.code(400).send({ error: errorServicios, codigo: 'LIMITE_PLAN' });
        }

        const errorSucursalesPlan = validarReglasSucursalesPorPlan({
          plan: planSiguiente,
          estudioPrincipalId: estudioPrincipalSiguiente,
          sucursales: sucursalesSiguientes,
        });
        if (errorSucursalesPlan) {
          return respuesta.code(400).send({ error: errorSucursalesPlan, codigo: 'LIMITE_PLAN' });
        }

        if (datos.plan !== undefined && planSiguiente === 'STANDARD') {
          const totalPersonalActivo = await prisma.personal.count({
            where: { estudioId: id, activo: true },
          });

          const errorPersonalPlan = validarCantidadEmpleadosActivosPlan({
            plan: planSiguiente,
            cantidadActual: totalPersonalActivo,
            cantidadNueva: totalPersonalActivo,
          });

          if (errorPersonalPlan) {
            return respuesta.code(400).send({ error: errorPersonalPlan, codigo: 'LIMITE_PLAN' });
          }
        }

        const limiteServiciosStandard = obtenerDefinicionPlan('STANDARD').maxServicios;

        if (
          datos.plan !== undefined &&
          normalizarPlanEstudio(datos.plan) === 'STANDARD' &&
          serviciosNuevos > limiteServiciosStandard
        ) {
          return respuesta.code(400).send({
            error:
              `Antes de cambiar a Standard debes dejar el catálogo con un máximo de ${limiteServiciosStandard} servicios activos.`,
            codigo: 'LIMITE_PLAN',
          });
        }
        const categorias = resolverCategoriasSalon({
          categorias:
            datos.categorias ??
            (typeof estudioExistente?.categorias === 'string' ? estudioExistente.categorias : null),
          servicios: datos.servicios ?? estudioExistente?.servicios,
          serviciosCustom: datos.serviciosCustom ?? estudioExistente?.serviciosCustom,
        });

        const dataActualizacion: Record<string, unknown> = {
          ...(datos.nombre !== undefined && columnasEstudios.has('nombre') && { nombre: datos.nombre }),
          ...(datos.propietario !== undefined && columnasEstudios.has('propietario') && { propietario: datos.propietario }),
          ...(datos.telefono !== undefined && columnasEstudios.has('telefono') && { telefono: datos.telefono }),
          ...(datos.sitioWeb !== undefined && columnasEstudios.has('sitioWeb') && { sitioWeb: datos.sitioWeb }),
          ...(datos.pais !== undefined && columnasEstudios.has('pais') && { pais: datos.pais }),
          ...(datos.pais !== undefined && columnasEstudios.has('zonaHoraria') && { zonaHoraria: obtenerZonaHorariaPorPais(datos.pais) }),
          ...(datos.plan !== undefined && columnasEstudios.has('plan') && { plan: normalizarPlanEstudio(datos.plan) }),
          ...(datos.estudioPrincipalId !== undefined && columnasEstudios.has('estudioPrincipalId') && { estudioPrincipalId: datos.estudioPrincipalId }),
          ...(datos.permiteReservasPublicas !== undefined && columnasEstudios.has('permiteReservasPublicas') && { permiteReservasPublicas: datos.permiteReservasPublicas }),
          ...(datos.metodosPagoReserva !== undefined && columnasEstudios.has('metodosPagoReserva') && {
            metodosPagoReserva: normalizarMetodosPagoReserva(datos.metodosPagoReserva) as Prisma.InputJsonValue,
          }),
          ...(datos.sucursales !== undefined && columnasEstudios.has('sucursales') && { sucursales: datos.sucursales }),
          ...(datos.horario !== undefined && columnasEstudios.has('horario') && { horario: datos.horario }),
          ...(datos.servicios !== undefined && columnasEstudios.has('servicios') && { servicios: datos.servicios as Prisma.InputJsonValue }),
          ...(datos.serviciosCustom !== undefined && columnasEstudios.has('serviciosCustom') && { serviciosCustom: datos.serviciosCustom as Prisma.InputJsonValue }),
          ...(datos.festivos !== undefined && columnasEstudios.has('festivos') && { festivos: datos.festivos }),
          ...(datos.excepcionesDisponibilidad !== undefined && columnasEstudios.has('excepcionesDisponibilidad') && {
            excepcionesDisponibilidad: normalizarExcepcionesDisponibilidadEntrada({
              excepciones: datos.excepcionesDisponibilidad,
              fechaMinima: obtenerFechaISOEnZona(new Date(), zonaHorariaSalon, estudioAccesible.pais),
                horaActual: horaActualSalon,
              sedesDisponibles,
            }),
          }),
          ...(datos.colorPrimario !== undefined && columnasEstudios.has('colorPrimario') && { colorPrimario: datos.colorPrimario }),
          ...(datos.descripcion !== undefined && columnasEstudios.has('descripcion') && { descripcion: sanitizarTexto(datos.descripcion ?? '') }),
          ...(datos.direccion !== undefined && columnasEstudios.has('direccion') && { direccion: sanitizarTexto(datos.direccion ?? '') }),
          ...(datos.emailContacto !== undefined && columnasEstudios.has('emailContacto') && { emailContacto: datos.emailContacto }),
          ...(datos.horarioApertura !== undefined && columnasEstudios.has('horarioApertura') && { horarioApertura: datos.horarioApertura }),
          ...(datos.horarioCierre !== undefined && columnasEstudios.has('horarioCierre') && { horarioCierre: datos.horarioCierre }),
          ...(datos.diasAtencion !== undefined && columnasEstudios.has('diasAtencion') && { diasAtencion: datos.diasAtencion }),
            ...(datos.primeraVez !== undefined && columnasEstudios.has('primeraVez') && { primeraVez: datos.primeraVez }),
          ...(columnasEstudios.has('categorias') && { categorias }),
        };

        const primeraVezAnterior = columnaPrimeraVezDisponible
          ? (estudioExistente.primeraVez ?? true)
          : null;

        const selectActualizacion = construirSelectDesdeColumnas(columnasEstudios, ['id']);

        await prisma.estudio.update({
          where: { id },
          data: dataActualizacion as Prisma.EstudioUncheckedUpdateInput,
          select: selectActualizacion as Prisma.EstudioSelect,
        });

        const cambiosOperativos: string[] = [];
        if (datos.horario !== undefined || datos.horarioApertura !== undefined || datos.horarioCierre !== undefined) {
          cambiosOperativos.push('horarios de operación');
        }
        if (datos.festivos !== undefined || datos.excepcionesDisponibilidad !== undefined) {
          cambiosOperativos.push('cierres y disponibilidad especial');
        }
        if (
          datos.nombre !== undefined ||
          datos.telefono !== undefined ||
          datos.direccion !== undefined ||
          datos.emailContacto !== undefined ||
          datos.colorPrimario !== undefined ||
          datos.descripcion !== undefined
        ) {
          cambiosOperativos.push('datos visibles del salón');
        }

        if (cambiosOperativos.length > 0) {
          await prisma.notificacionEstudio.create({
            data: {
              estudioId: id,
              tipo: 'actualizacion_salon',
              titulo: 'Actualización del salón',
              mensaje: `El salón actualizó ${cambiosOperativos.join(', ')}. Revisa tu agenda y datos operativos para trabajar con la información vigente.`,
            },
          });
        }

        const debeNotificarPrimerEspecialista =
          columnaPrimeraVezDisponible &&
          datos.primeraVez === false &&
          primeraVezAnterior !== false;

        if (debeNotificarPrimerEspecialista) {
          const totalEspecialistasActivos = await prisma.personal.count({
            where: { estudioId: id, activo: true },
          });

          if (totalEspecialistasActivos === 0) {
            await prisma.notificacionEstudio.create({
              data: {
                estudioId: id,
                tipo: 'actualizacion_salon',
                titulo: 'Completa la configuración inicial',
                mensaje:
                  'Aún no tienes especialistas activos. Crea tu primer especialista para empezar a gestionar reservas sin bloqueos operativos.',
              },
            });
          }
        }

        if (datos.plan !== undefined || datos.pais !== undefined) {
          await asegurarPrecioActualSalon({
            estudioId: id,
            plan: planSiguiente,
            pais: datos.pais ?? estudioExistente.pais,
          });
        }

        if (
          datos.plan !== undefined &&
          normalizarPlanEstudio(datos.plan) === 'STANDARD' &&
          tablasDisponibles.has('config_fidelidad')
        ) {
          await prisma.configFidelidad.updateMany({
            where: { estudioId: id },
            data: { activo: false },
          });
        }

        return respuesta.send({ datos: { id, actualizado: true } });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al actualizar estudio');
        return respuesta.code(500).send({
          error: 'No se pudo actualizar el estudio',
        });
      }
    },
  );

  servidor.put<{ Params: { id: string }; Body: { excepcionesDisponibilidad: z.infer<typeof esquemaExcepcionDisponibilidad>[] } }>(
    '/estudios/:id/disponibilidad-excepciones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
        const { id } = solicitud.params;

        if (!(payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === id))) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        if (payload.rol === 'dueno') {
          const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
          if (!tieneAcceso) {
            return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
          }
        }

        const resultado = z.object({
          excepcionesDisponibilidad: z.array(esquemaExcepcionDisponibilidad).max(500, 'No puedes registrar más de 500 excepciones'),
        }).safeParse(solicitud.body);

        if (!resultado.success) {
          return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
        }

        const columnaDisponible = await asegurarColumnaExcepcionesDisponibilidad();
        if (!columnaDisponible) {
          return respuesta.code(503).send({ error: 'No se pudo habilitar la disponibilidad avanzada en este momento' });
        }

        const estudio = await prisma.estudio.findUnique({
          where: { id },
          select: {
            id: true,
            nombre: true,
            sucursales: true,
            zonaHoraria: true,
            pais: true,
            sedes: { where: { activo: true }, select: { nombre: true } },
            excepcionesDisponibilidad: true,
          },
        });

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        const zonaHorariaSalon = normalizarZonaHorariaEstudio(estudio.zonaHoraria, estudio.pais);
        const sedesDisponibles = [
          estudio.nombre,
          ...obtenerNombresSucursales(
            estudio as unknown as Record<string, unknown>,
            Array.isArray(estudio.sucursales) ? (estudio.sucursales as string[]) : [],
          ),
        ];
        const excepcionesNormalizadas = normalizarExcepcionesDisponibilidadEntrada({
          excepciones: resultado.data.excepcionesDisponibilidad,
          fechaMinima: obtenerFechaISOEnZona(new Date(), zonaHorariaSalon, estudio.pais),
          horaActual: formatearHoraDesdeMinutos(
            obtenerMinutosActualesEnZona(new Date(), zonaHorariaSalon, estudio.pais),
          ),
          sedesDisponibles,
        });

        await prisma.estudio.update({
          where: { id },
          data: { excepcionesDisponibilidad: excepcionesNormalizadas },
        });

        await prisma.notificacionEstudio.create({
          data: {
            estudioId: id,
            tipo: 'actualizacion_horario',
            titulo: 'Cambio de horario o cierre',
            mensaje: 'El salón ajustó cierres u horarios especiales. Revisa el calendario antes de confirmar tu siguiente jornada.',
          },
        });

        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'actualizar_disponibilidad_excepciones',
          entidadTipo: 'estudio',
          entidadId: id,
          detalles: {
            antes: parsearExcepcionesDisponibilidad(estudio.excepcionesDisponibilidad),
            despues: parsearExcepcionesDisponibilidad(excepcionesNormalizadas),
          },
          ip: solicitud.ip,
        });

        return respuesta.send({ datos: { actualizado: true } });
      } catch (error) {
        if (error instanceof Error) {
          solicitud.log.warn(
            { err: error, estudioId: solicitud.params.id, requestId: solicitud.id },
            'Error controlado al actualizar excepciones de disponibilidad',
          );
          return respuesta.code(400).send({ error: 'No se pudo validar la disponibilidad especial solicitada' });
        }

        solicitud.log.error({ err: error }, 'Fallo al actualizar excepciones de disponibilidad');
        return respuesta.code(500).send({ error: 'No se pudo actualizar la disponibilidad especial' });
      }
    },
  );

  servidor.get<{
    Params: { id: string };
    Querystring: { personalId: string; fecha: string; duracion: string };
  }>(
    '/estudios/:id/disponibilidad',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      const { personalId, fecha, duracion } = solicitud.query;

      if (!(payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === id))) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (!personalId || !fecha || !duracion) {
        return respuesta.code(400).send({ error: 'personalId, fecha y duracion son requeridos' });
      }

      const duracionMin = Number(duracion);
      if (isNaN(duracionMin) || duracionMin <= 0) {
        return respuesta.code(400).send({ error: 'duracion debe ser un número positivo' });
      }

      const [salon, miembro, reservasExistentes] = await Promise.all([
        prisma.estudio.findUnique({
          where: { id },
          select: { nombre: true, horario: true, festivos: true, excepcionesDisponibilidad: true, zonaHoraria: true, pais: true },
        }),
        prisma.personal.findFirst({
          where: { id: personalId, estudioId: id, activo: true },
          select: {
            id: true,
            horaInicio: true,
            horaFin: true,
            descansoInicio: true,
            descansoFin: true,
            diasTrabajo: true,
          },
        }),
        prisma.reserva.findMany({
          where: {
            estudioId: id,
            personalId,
            fecha,
            estado: { not: 'cancelled' },
          },
          select: { horaInicio: true, duracion: true, estado: true },
        }),
      ]);

      if (!salon || !miembro) {
        return respuesta.code(404).send({ error: 'Salón o especialista no encontrado' });
      }

      const festivos = salon.festivos as string[];
      if (festivos.includes(fecha)) {
        return respuesta.send({ datos: [] });
      }

      const slots = obtenerSlotsDisponiblesBackend({
        horario: salon.horario as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
        miembro,
        fecha,
        duracionMin,
        reservas: reservasExistentes,
        sucursal: salon.nombre,
        excepcionesDisponibilidad: salon.excepcionesDisponibilidad,
        zonaHoraria: normalizarZonaHorariaEstudio(salon.zonaHoraria, salon.pais),
      });

      return respuesta.send({ datos: slots });
    },
  );

  // DELETE /estudios/:id — cierre seguro solo maestro
  servidor.delete<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { rol: string; sub: string };
        if (payload.rol !== 'maestro') {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        const { id } = solicitud.params;
        const estudio = await prisma.estudio.findUnique({
          where: { id },
          select: {
            id: true,
            nombre: true,
            activo: true,
            estado: true,
            usuarios: {
              select: { id: true },
            },
            personal: {
              select: {
                id: true,
                acceso: {
                  select: { id: true },
                },
              },
            },
          },
        });

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        if (!estudio.activo && estudio.estado === 'suspendido') {
          return respuesta.send({
            datos: {
              eliminado: false,
              cierreSeguro: true,
              mensaje: 'El estudio ya se encuentra suspendido y fuera de operación',
            },
          });
        }

        const usuarioIds = estudio.usuarios.map((usuario) => usuario.id);
        const personalIds = estudio.personal.map((persona) => persona.id);
        const accesoEmpleadoIds = estudio.personal
          .map((persona) => persona.acceso?.id ?? null)
          .filter((valor): valor is string => Boolean(valor));
        const fechaCierre = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.estudio.update({
            where: { id },
            data: {
              activo: false,
              estado: 'suspendido',
              permiteReservasPublicas: false,
              cancelacionSolicitada: false,
              fechaSolicitudCancelacion: null,
              fechaSuspension: fechaCierre,
              motivoCancelacion: 'Cierre administrativo ejecutado por maestro',
            },
          });

          if (usuarioIds.length > 0) {
            await tx.usuario.updateMany({
              where: { id: { in: usuarioIds } },
              data: { activo: false },
            });
          }

          if (personalIds.length > 0) {
            await tx.personal.updateMany({
              where: { id: { in: personalIds } },
              data: { activo: false, eliminadoEn: fechaCierre },
            });
          }

          if (accesoEmpleadoIds.length > 0) {
            await tx.empleadoAcceso.updateMany({
              where: { id: { in: accesoEmpleadoIds } },
              data: { activo: false },
            });
          }
        });

        await Promise.all([
          ...usuarioIds.map((usuarioId) =>
            revocarSesionesPorSujeto('usuario', usuarioId, 'estudio_suspendido_por_maestro')
          ),
          ...accesoEmpleadoIds.map((accesoId) =>
            revocarSesionesPorSujeto('empleado_acceso', accesoId, 'estudio_suspendido_por_maestro')
          ),
        ]);

        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'cerrar_estudio_seguro',
          entidadTipo: 'estudio',
          entidadId: id,
          detalles: {
            nombre: estudio.nombre,
            requestId: solicitud.id,
            antes: {
              activo: estudio.activo,
              estado: estudio.estado,
            },
            despues: {
              activo: false,
              estado: 'suspendido',
              permiteReservasPublicas: false,
            },
            usuariosDesactivados: usuarioIds.length,
            personalDesactivado: personalIds.length,
            accesosEmpleadoRevocados: accesoEmpleadoIds.length,
          },
          ip: solicitud.ip,
        });

        return respuesta.code(200).send({
          datos: {
            eliminado: false,
            cierreSeguro: true,
            mensaje: 'El estudio fue suspendido y desactivado sin borrar historial',
          },
        });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al cerrar estudio de forma segura');
        return respuesta.code(500).send({
          error: 'No se pudo desactivar el estudio',
        });
      }
    },
  );

  // PUT /estudios/:id/pin-cancelacion — set PIN de cancelación (dueno o maestro)
  servidor.put<{ Params: { id: string }; Body: { pin: string; confirmacion: string } }>(
    '/estudios/:id/pin-cancelacion',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!(payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === id))) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno') {
        const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
        if (!tieneAcceso) return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }

      const { pin, confirmacion } = solicitud.body;
      if (!pin || !confirmacion) {
        return respuesta.code(400).send({ error: 'PIN y confirmación son obligatorios' });
      }
      if (!/^\d{4,6}$/.test(pin)) {
        return respuesta.code(400).send({ error: 'El PIN debe tener entre 4 y 6 dígitos numéricos' });
      }
      if (pin !== confirmacion) {
        return respuesta.code(400).send({ error: 'El PIN y la confirmación no coinciden' });
      }

      const columnaDisponible = await asegurarColumnaPinCancelacion();
      if (!columnaDisponible) {
        return respuesta.code(503).send({ error: 'No se pudo habilitar el PIN de cancelación en este momento' });
      }

      const pinCancelacionHash = await bcrypt.hash(pin, 12);
      await prisma.estudio.update({ where: { id }, data: { pinCancelacionHash } });

      return respuesta.send({ datos: { pinCancelacionConfigurado: true } });
    },
  );

  // POST /estudios/:id/solicitar-cancelacion — dueno de su propio estudio
  servidor.post<{ Params: { id: string }; Body: { motivo?: string } }>(
    '/estudios/:id/solicitar-cancelacion',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null; sub: string };
      const { id } = solicitud.params;

      if (payload.rol !== 'dueno' || payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
      if (!tieneAcceso) {
        return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      if (estudio.cancelacionSolicitada) {
        return respuesta.code(400).send({ error: 'Ya tienes una solicitud de cancelación pendiente' });
      }

      const motivoRaw = (solicitud.body as { motivo?: string }).motivo;
      const motivo = typeof motivoRaw === 'string' ? motivoRaw.trim().slice(0, 300) : undefined;
      const ahora = new Date();

      await prisma.estudio.update({
        where: { id },
        data: {
          cancelacionSolicitada: true,
          fechaSolicitudCancelacion: ahora,
          motivoCancelacion: motivo ?? null,
        },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'solicitar_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, motivo: motivo ?? null },
        ip: solicitud.ip,
      });

      void enviarEmailSolicitudCancelacion({
        nombreSalon: estudio.nombre,
        motivo,
        fechaSolicitud: ahora.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      });

      return respuesta.send({
        datos: { mensaje: 'Tu solicitud fue recibida. Te contactaremos en máximo 48 horas.' },
      });
    },
  );

  // DELETE /estudios/:id/cancelar-solicitud — dueno retira su solicitud
  servidor.delete<{ Params: { id: string } }>(
    '/estudios/:id/cancelar-solicitud',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null; sub: string };
      const { id } = solicitud.params;

      if (payload.rol !== 'dueno' || payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: {
          cancelacionSolicitada: false,
          fechaSolicitudCancelacion: null,
          motivoCancelacion: null,
        },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'retirar_solicitud_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Solicitud de cancelación retirada' } });
    },
  );

  // ─── Notificaciones del estudio ──────────────────────────────────────────

  /**
   * GET /estudios/:id/notificaciones — notificaciones no leídas del estudio
   */
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id/notificaciones',
    { preHandler: [verificarJWT] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string; estudioId?: string };
      const { id } = solicitud.params;

      // Solo el dueño de ese estudio o un maestro pueden ver las notificaciones
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol !== 'maestro' && payload.rol !== 'dueno' && payload.rol !== 'empleado' && payload.rol !== 'vendedor') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const notificaciones = await prisma.notificacionEstudio.findMany({
        where: { estudioId: id, leida: false },
        orderBy: { creadoEn: 'desc' },
        take: 20,
      });

      return respuesta.send({ datos: notificaciones });
    },
  );

  /**
   * PUT /estudios/:id/notificaciones/:notifId/leer — marca una notificación como leída
   */
  servidor.put<{ Params: { id: string; notifId: string } }>(
    '/estudios/:id/notificaciones/:notifId/leer',
    { preHandler: [verificarJWT] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId?: string };
      const { id, notifId } = solicitud.params;

      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol !== 'maestro' && payload.rol !== 'dueno' && payload.rol !== 'empleado' && payload.rol !== 'vendedor') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      await prisma.notificacionEstudio.updateMany({
        where: { id: notifId, estudioId: id },
        data: { leida: true },
      });

      return respuesta.send({ datos: { mensaje: 'Notificación marcada como leída' } });
    },
  );
}
