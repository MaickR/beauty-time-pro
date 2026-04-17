/**
 * Servicio de estudios - llama al backend Fastify en lugar de Firebase.
 */
import type {
  ExcepcionDisponibilidad,
  Estudio,
  PlanEstudio,
  SedeEstudio,
  Servicio,
  ServicioPersonalizado,
} from '../tipos/index';
import { combinarExcepcionesDisponibilidad, normalizarExcepcionesDisponibilidad } from '../lib/disponibilidadExcepciones';
import { peticion } from '../lib/clienteHTTP';

type RespuestaEstudio = { datos: Estudio };
type EstudioBackend = Record<string, unknown>;

interface DatosCrearSalonAdmin {
  nombreSalon: string;
  nombreAdmin: string;
  emailDueno: string;
  contrasenaDueno: string;
  telefono: string;
  pais: Estudio['country'];
  plan: PlanEstudio;
  estudioPrincipalId?: string | null;
  permiteReservasPublicas?: boolean;
  inicioSuscripcion: string;
  direccion?: string;
  sucursales?: string[];
  servicios: Servicio[];
  productos?: Array<{
    nombre: string;
    categoria?: string;
    precio: number;
  }>;
  serviciosCustom: ServicioPersonalizado[];
  personal: Array<{
    nombre: string;
    especialidades: string[];
    horaInicio?: string;
    horaFin?: string;
    descansoInicio?: string;
    descansoFin?: string;
  }>;
}

interface ResultadoCrearSalonAdmin {
  estudio: Estudio;
  acceso: {
    emailDueno: string;
    claveDueno: string;
    claveClientes: string;
  };
}

type RespuestaCrearSalonAdmin = {
  datos: {
    estudio: EstudioBackend;
    acceso: ResultadoCrearSalonAdmin['acceso'];
  };
};

function mapearEstudioBackend(estudio: EstudioBackend): Estudio {
  const personal = Array.isArray(estudio['personal'])
    ? (estudio['personal'] as Record<string, unknown>[])
    : [];
  const sedes = Array.isArray(estudio['sedes'])
    ? (estudio['sedes'] as Record<string, unknown>[])
    : [];

  return {
    id: (estudio['id'] as string) ?? '',
    slug: (estudio['slug'] as string) ?? '',
    name: (estudio['nombre'] as string) ?? '',
    owner: (estudio['propietario'] as string) ?? '',
    phone: (estudio['telefono'] as string) ?? '',
    website: (estudio['sitioWeb'] as string | undefined) ?? '',
    country: ((estudio['pais'] as string) ?? 'Mexico') as Estudio['country'],
    plan: ((estudio['plan'] as string) ?? 'STANDARD') as PlanEstudio,
    branches: (estudio['sucursales'] as string[]) ?? [],
    assignedKey: (estudio['claveDueno'] as string) ?? '',
    clientKey: (estudio['claveCliente'] as string) ?? '',
    subscriptionStart: (estudio['inicioSuscripcion'] as string) ?? '',
    paidUntil: (estudio['fechaVencimiento'] as string) ?? '',
    holidays: (estudio['festivos'] as string[]) ?? [],
    availabilityExceptions: combinarExcepcionesDisponibilidad(
      (estudio['festivos'] as string[]) ?? [],
      normalizarExcepcionesDisponibilidad(estudio['excepcionesDisponibilidad']),
    ),
    schedule: (estudio['horario'] as Estudio['schedule']) ?? {},
    selectedServices: (estudio['servicios'] as Estudio['selectedServices']) ?? [],
    customServices: (estudio['serviciosCustom'] as Estudio['customServices']) ?? [],
    staff: personal.map((persona) => ({
      id: (persona['id'] as string) ?? '',
      name: (persona['nombre'] as string) ?? '',
      avatarUrl: (persona['avatarUrl'] as string | null | undefined) ?? null,
      specialties: (persona['especialidades'] as string[]) ?? [],
      active: (persona['activo'] as boolean | undefined) ?? true,
      shiftStart: (persona['horaInicio'] as string | null | undefined) ?? null,
      shiftEnd: (persona['horaFin'] as string | null | undefined) ?? null,
      breakStart: (persona['descansoInicio'] as string | null | undefined) ?? null,
      breakEnd: (persona['descansoFin'] as string | null | undefined) ?? null,
      workingDays: (persona['diasTrabajo'] as number[] | null | undefined) ?? null,
    })),
    colorPrimario: (estudio['colorPrimario'] as string | null | undefined) ?? null,
    logoUrl: (estudio['logoUrl'] as string | null | undefined) ?? null,
    descripcion: (estudio['descripcion'] as string | null | undefined) ?? null,
    direccion: (estudio['direccion'] as string | null | undefined) ?? null,
    emailContacto: (estudio['emailContacto'] as string | null | undefined) ?? null,
    estado: (estudio['estado'] as string | null | undefined) ?? null,
    estudioPrincipalId: (estudio['estudioPrincipalId'] as string | null | undefined) ?? null,
    estudioPrincipal:
      (estudio['estudioPrincipal'] as
        | { id: string; nombre: string; slug: string | null }
        | null
        | undefined) ?? null,
    esSede: (estudio['esSede'] as boolean | undefined) ?? false,
    permiteReservasPublicas: (estudio['permiteReservasPublicas'] as boolean | undefined) ?? true,
    sedes: sedes.map(
      (sede): SedeEstudio => ({
        id: (sede['id'] as string) ?? '',
        nombre: (sede['nombre'] as string) ?? '',
        slug: (sede['slug'] as string | null | undefined) ?? null,
        plan: ((sede['plan'] as string) ?? 'STANDARD') as PlanEstudio,
        estado: (sede['estado'] as string) ?? 'aprobado',
        activo: (sede['activo'] as boolean | undefined) ?? true,
        fechaVencimiento: (sede['fechaVencimiento'] as string) ?? '',
        propietario: (sede['propietario'] as string | null | undefined) ?? null,
        telefono: (sede['telefono'] as string | null | undefined) ?? null,
        direccion: (sede['direccion'] as string | null | undefined) ?? null,
        emailContacto: (sede['emailContacto'] as string | null | undefined) ?? null,
        estudioPrincipalId: (sede['estudioPrincipalId'] as string | null | undefined) ?? null,
        permiteReservasPublicas: (sede['permiteReservasPublicas'] as boolean | undefined) ?? true,
        precioSuscripcionActual:
          (sede['precioSuscripcionActual'] as number | null | undefined) ?? null,
        monedaSuscripcion: (sede['monedaSuscripcion'] as SedeEstudio['monedaSuscripcion']) ?? null,
      }),
    ),
    primeraVez: (estudio['primeraVez'] as boolean | undefined) ?? true,
    cancelacionSolicitada: (estudio['cancelacionSolicitada'] as boolean | undefined) ?? false,
    fechaSolicitudCancelacion:
      (estudio['fechaSolicitudCancelacion'] as string | null | undefined) ?? null,
    motivoCancelacion: (estudio['motivoCancelacion'] as string | null | undefined) ?? null,
    precioSuscripcionActual:
      (estudio['precioSuscripcionActual'] as number | null | undefined) ?? null,
    monedaSuscripcion: (estudio['monedaSuscripcion'] as Estudio['monedaSuscripcion']) ?? null,
    precioSuscripcionProximo:
      (estudio['precioSuscripcionProximo'] as number | null | undefined) ?? null,
    fechaAplicacionPrecioProximo:
      (estudio['fechaAplicacionPrecioProximo'] as string | null | undefined) ?? null,
    precioRenovacion: (estudio['precioRenovacion'] as number | null | undefined) ?? null,
    createdAt:
      (estudio['createdAt'] as string | undefined) ?? (estudio['creadoEn'] as string) ?? '',
    updatedAt:
      (estudio['updatedAt'] as string | undefined) ?? (estudio['actualizadoEn'] as string) ?? '',
  };
}

/** Crea un estudio nuevo. */
export async function guardarEstudio(_id: string, datos: Omit<Estudio, 'id'>): Promise<Estudio> {
  const respuesta = await peticion<RespuestaEstudio>('/estudios', {
    method: 'POST',
    body: JSON.stringify({
      nombre: datos.name,
      propietario: datos.owner,
      telefono: datos.phone,
      sitioWeb: datos.website,
      pais: datos.country,
      plan: datos.plan,
      sucursales: datos.branches,
      claveDueno: datos.assignedKey,
      claveCliente: datos.clientKey,
      inicioSuscripcion: datos.subscriptionStart,
      fechaVencimiento: datos.paidUntil,
      horario: datos.schedule,
      servicios: datos.selectedServices,
      serviciosCustom: datos.customServices,
      festivos: datos.holidays,
    }),
  });
  return respuesta.datos;
}

export async function crearSalonAdmin(
  datos: DatosCrearSalonAdmin,
): Promise<ResultadoCrearSalonAdmin> {
  const respuesta = await peticion<RespuestaCrearSalonAdmin>('/admin/salones', {
    method: 'POST',
    body: JSON.stringify({
      nombreSalon: datos.nombreSalon,
      nombreAdmin: datos.nombreAdmin,
      email: datos.emailDueno,
      contrasena: datos.contrasenaDueno,
      telefono: datos.telefono,
      pais: datos.pais,
      plan: datos.plan,
      estudioPrincipalId: datos.estudioPrincipalId,
      permiteReservasPublicas: datos.permiteReservasPublicas,
      inicioSuscripcion: datos.inicioSuscripcion,
      direccion: datos.direccion,
      sucursales: datos.sucursales,
      servicios: datos.servicios,
      productos: datos.productos,
      serviciosCustom: datos.serviciosCustom,
      personal: datos.personal,
    }),
  });

  return {
    estudio: mapearEstudioBackend(respuesta.datos.estudio),
    acceso: respuesta.datos.acceso,
  };
}

/** Actualiza campos parciales de un estudio. */
export async function actualizarEstudio(id: string, campos: Partial<Estudio>): Promise<void> {
  const cuerpo: Record<string, unknown> = {};
  if (campos.name !== undefined) cuerpo['nombre'] = campos.name;
  if (campos.owner !== undefined) cuerpo['propietario'] = campos.owner;
  if (campos.phone !== undefined) cuerpo['telefono'] = campos.phone;
  if (campos.website !== undefined) cuerpo['sitioWeb'] = campos.website;
  if (campos.country !== undefined) cuerpo['pais'] = campos.country;
  if (campos.plan !== undefined) cuerpo['plan'] = campos.plan;
  if (campos.estudioPrincipalId !== undefined)
    cuerpo['estudioPrincipalId'] = campos.estudioPrincipalId;
  if (campos.permiteReservasPublicas !== undefined)
    cuerpo['permiteReservasPublicas'] = campos.permiteReservasPublicas;
  if (campos.branches !== undefined) cuerpo['sucursales'] = campos.branches;
  if (campos.schedule !== undefined) cuerpo['horario'] = campos.schedule;
  if (campos.selectedServices !== undefined) cuerpo['servicios'] = campos.selectedServices;
  if (campos.customServices !== undefined) cuerpo['serviciosCustom'] = campos.customServices;
  if (campos.holidays !== undefined) cuerpo['festivos'] = campos.holidays;
  if (campos.availabilityExceptions !== undefined) {
    cuerpo['excepcionesDisponibilidad'] = campos.availabilityExceptions;
  }
  if (campos.primeraVez !== undefined) cuerpo['primeraVez'] = campos.primeraVez;
  await peticion<RespuestaEstudio>(`/estudios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(cuerpo),
  });
}

/** Elimina un estudio por id. */
export async function eliminarEstudio(id: string): Promise<void> {
  await peticion(`/estudios/${id}`, { method: 'DELETE' });
}

/** Actualiza los días festivos/bloqueados de un estudio. */
export async function actualizarFestivos(id: string, festivos: string[]): Promise<void> {
  await peticion(`/estudios/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ festivos }),
  });
}

export async function actualizarExcepcionesDisponibilidad(
  id: string,
  excepcionesDisponibilidad: ExcepcionDisponibilidad[],
): Promise<void> {
  await peticion(`/estudios/${id}/disponibilidad-excepciones`, {
    method: 'PUT',
    body: JSON.stringify({ excepcionesDisponibilidad }),
  });
}

/** Actualiza la lista de servicios con precios de un estudio. */
export async function actualizarPreciosServicios(id: string, servicios: Servicio[]): Promise<void> {
  await peticion<RespuestaEstudio>(`/estudios/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ servicios }),
  });
}

export async function actualizarPinCancelacion(
  estudioId: string,
  pin: string,
  confirmacion: string,
): Promise<void> {
  await peticion(`/estudios/${estudioId}/pin-cancelacion`, {
    method: 'PUT',
    body: JSON.stringify({ pin, confirmacion }),
  });
}

export interface CitaDashboardSalon {
  id: string;
  fecha: string;
  hora: string;
  horaFin: string;
  cliente: string;
  telefonoCliente: string;
  especialista: string;
  especialistaId: string;
  servicioPrincipal: string;
  servicios: string[];
  sucursal: string;
  precioEstimado: number;
  estado: string;
  observaciones: string | null;
  creadoEn: string;
}

export interface FilaIngresoDashboardSalon {
  id: string;
  fecha: string;
  hora: string;
  concepto: string;
  tipo: 'servicio' | 'producto';
  cliente: string;
  especialista: string;
  especialistaId: string;
  sucursal: string;
  total: number;
}

export interface ResumenIngresosDashboardSalon {
  total: number;
  filas: FilaIngresoDashboardSalon[];
}

export interface EspecialistaActivoDashboardSalon {
  id: string;
  nombre: string;
  servicios: string[];
  jornada: string;
  descanso: string;
  citasHoy: number;
  proximaCita: string | null;
}

export interface PlanDashboardSalon {
  actual: 'STANDARD' | 'PRO';
  nombre: string;
  fechaAdquisicion: string;
  proximoCorte: string;
  precioActual: number | null;
  moneda: 'MXN' | 'COP';
  pais: string;
  whatsapp: string;
}

export interface CorteDashboardSalon {
  fecha: string;
  fechaHoraObjetivo: string;
  dias: number;
  horas: number;
  minutos: number;
  totalMinutos: number;
  vencido: boolean;
}

export interface ContextoProductosDashboardSalon {
  planPermiteProductos: boolean;
  ventasRegistradas: boolean;
  catalogoConfigurado: boolean;
  mensaje: string;
}

export interface MetricasDashboardSalon {
  actualizadoEn: string;
  fechaActual: string;
  zonaHoraria: string;
  resumen: {
    citasAgendadasHoy: number;
    totalGanadoMes: number;
    especialistasActivos: number;
    planActual: 'STANDARD' | 'PRO';
    diasParaCorte: number;
  };
  citasHoy: CitaDashboardSalon[];
  ingresos: {
    dia: ResumenIngresosDashboardSalon;
    semana: ResumenIngresosDashboardSalon;
    mes: ResumenIngresosDashboardSalon;
  };
  especialistasActivos: EspecialistaActivoDashboardSalon[];
  plan: PlanDashboardSalon;
  corte: CorteDashboardSalon;
  soporte: {
    whatsapp: string;
  };
  contextoProductos: ContextoProductosDashboardSalon;
}

export async function obtenerMetricasDashboard(
  estudioId: string,
): Promise<MetricasDashboardSalon> {
  const respuesta = await peticion<{ datos: MetricasDashboardSalon }>(
    `/estudios/${estudioId}/metricas-dashboard`,
  );
  return respuesta.datos;
}
