// Tipos de dominio para Beauty Time Pro
// Todas las fechas son strings ISO 8601: "YYYY-MM-DD" para fechas, "HH:mm" para horas

export interface TurnoTrabajo {
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

/** Fecha bloqueada para reservas. Formato "YYYY-MM-DD" */
export type DiaFestivo = string;

export type Moneda = 'MXN' | 'COP';
export type Pais = 'Mexico' | 'Colombia';
export type PlanEstudio = 'STANDARD' | 'PRO';
export type EstadoReserva = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type EstadoSlot = 'AVAILABLE' | 'OCCUPIED' | 'BREAK_TIME' | 'TOO_SHORT';

export interface SlotTiempo {
  time: string; // "HH:mm"
  status: EstadoSlot;
}

export interface Servicio {
  name: string;
  duration: number; // minutos
  price: number; // centavos
  category?: string;
}

export interface DetalleServicioReserva extends Servicio {
  id?: string;
  status: string;
  order: number;
}

export interface ServicioPersonalizado {
  name: string;
  category: string;
}

export interface Personal {
  id: string;
  name: string;
  avatarUrl?: string | null;
  specialties: string[];
  active: boolean;
  shiftStart: string | null; // "HH:mm"
  shiftEnd: string | null; // "HH:mm"
  breakStart: string | null; // "HH:mm"
  breakEnd: string | null; // "HH:mm"
  workingDays: number[] | null;
}

export interface Estudio {
  id: string;
  slug: string;
  name: string;
  owner: string;
  phone: string;
  website?: string;
  country: Pais;
  plan: PlanEstudio;
  branches: string[];
  assignedKey: string;
  clientKey: string;
  subscriptionStart: string; // "YYYY-MM-DD"
  paidUntil: string; // "YYYY-MM-DD"
  holidays: DiaFestivo[];
  schedule: Record<string, TurnoTrabajo>;
  selectedServices: Servicio[];
  customServices: ServicioPersonalizado[];
  staff: Personal[];
  colorPrimario?: string | null;
  logoUrl?: string | null;
  descripcion?: string | null;
  direccion?: string | null;
  emailContacto?: string | null;
  estado?: string | null;
  primeraVez?: boolean;
  cancelacionSolicitada?: boolean;
  fechaSolicitudCancelacion?: string | null;
  motivoCancelacion?: string | null;
  pinCancelacionConfigurado?: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export type EstadoSalon = 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' | 'bloqueado';

/** Solicitud de alta de salón con datos del dueño */
export interface SolicitudSalon {
  id: string;
  nombre: string;
  descripcion?: string | null;
  direccion?: string | null;
  telefono: string;
  categorias?: string | null;
  colorPrimario?: string | null;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  diasAtencion?: string | null;
  numeroEspecialistas?: number | null;
  estado: EstadoSalon;
  motivoRechazo?: string | null;
  fechaSolicitud: string;
  fechaAprobacion?: string | null;
  fechaVencimiento: string;
  diasDesdeRegistro: number;
  dueno: {
    id: string;
    email: string;
    nombre: string;
  } | null;
}

/** Solicitud de cancelación de suscripción pendiente de resolución */
export interface SolicitudCancelacion {
  id: string;
  nombre: string;
  fechaVencimiento: string;
  cancelacionSolicitada: boolean;
  fechaSolicitudCancelacion: string;
  motivoCancelacion: string | null;
  dueno: {
    id: string;
    email: string;
    nombre: string;
  } | null;
}

export interface Reserva {
  id: string;
  studioId: string;
  studioName: string;
  clientName: string;
  clientPhone: string;
  services: Servicio[];
  serviceDetails?: DetalleServicioReserva[];
  totalDuration: number; // minutos
  totalPrice: number; // centavos
  status: EstadoReserva;
  branch: string;
  staffId: string;
  staffName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  colorBrand: string | null;
  colorNumber: string | null;
  observaciones?: string | null;
  createdAt: string; // ISO datetime
}

// ─── Tipos del dashboard de cliente final ───────────────────────────────────

export interface SalonPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  pais: Pais;
  telefono: string;
  emailContacto: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  horarioApertura: string | null;
  horarioCierre: string | null;
  diasAtencion: string | null;
  categorias: string | null;
}

export interface EspecialistaPublico {
  id: string;
  nombre: string;
  especialidades: string[];
  horaInicio: string | null;
  horaFin: string | null;
  descansoInicio: string | null;
  descansoFin: string | null;
  diasTrabajo: unknown;
}

export interface SalonDetalle extends SalonPublico {
  servicios: Servicio[];
  horario: Record<string, TurnoTrabajo>;
  festivos: string[];
  personal: EspecialistaPublico[];
}

export interface DisponibilidadEspecialista {
  id: string;
  nombre: string;
  foto: string | null;
  especialidades: string[];
  slotsLibres: string[]; // ['09:00', '10:00']
  slotsOcupados: string[]; // ['09:30', '12:00']
}

export interface ClienteAdmin {
  id: string;
  nombre: string;
  telefono: string;
  correo: string | null;
  estudioId: string;
  nombreEstudio: string;
  paisEstudio: string;
  serviciosRealizados: string[];
  servicioMasFrecuente: string;
  ultimaVisita: string | null;
  totalVisitas: number;
  totalGastado: number; // centavos
}

export interface RespuestaBaseClientes {
  clientes: ClienteAdmin[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface FidelidadSalon {
  estudioId: string;
  nombreSalon: string;
  colorPrimario: string | null;
  logoUrl: string | null;
  visitasAcumuladas: number;
  visitasUsadas: number;
  recompensasGanadas: number;
  recompensasUsadas: number;
  visitasRequeridas: number;
  descripcionRecompensa: string;
  activo: boolean;
}

export interface ReservaCliente {
  id: string;
  fecha: string;
  horaInicio: string;
  duracion: number;
  estado: EstadoReserva;
  servicios: Servicio[];
  serviciosDetalle?: DetalleServicioReserva[];
  precioTotal: number; // centavos
  tokenCancelacion: string;
  reagendada: boolean;
  reservaOriginalId: string | null;
  salon: { id: string; nombre: string; colorPrimario: string | null; logoUrl: string | null };
  especialista: { id: string; nombre: string; eliminado: boolean };
}

export interface PerfilClienteApp {
  id: string;
  email: string;
  emailPendiente: string | null;
  nombre: string;
  apellido: string;
  pais: Pais;
  telefono: string | null;
  fechaNacimiento: string | null;
  ciudad: string | null;
  avatarUrl: string | null;
  creadoEn: string;
  mensajeFidelidad: string | null;
  reservas: ReservaCliente[];
  fidelidad: FidelidadSalon[];
}

export interface Pago {
  id: string;
  studioId: string;
  studioName: string;
  amount: number; // centavos
  currency: Moneda;
  country?: Pais;
  date: string; // "YYYY-MM-DD"
  createdAt: string; // ISO datetime
  concepto?: string;
  referencia?: string | null;
  registradoPorNombre?: string | null;
  registradoPorEmail?: string | null;
  fechaBaseRenovacion?: string | null;
  nuevaFechaVencimiento?: string | null;
  estrategiaRenovacion?: 'desde_vencimiento_actual' | 'desde_hoy' | 'manual' | null;
}

export interface EstadoSuscripcion {
  cutDay: number;
  dueDateStr: string;
  daysRemaining: number;
  status: 'ACTIVE' | 'WARNING' | 'OVERDUE';
}

// ─── Tipos de empleados ──────────────────────────────────────────────────────

export interface EmpleadoAccesoInfo {
  id: string;
  personalId: string;
  email: string;
  forzarCambioContrasena: boolean;
  activo: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface ReservaEmpleado {
  id: string;
  fecha: string;
  horaInicio: string;
  duracion: number;
  estado: EstadoReserva;
  servicios: Servicio[];
  serviciosDetalle?: DetalleServicioReserva[];
  precioTotal: number; // centavos
  nombreCliente: string;
  telefonoCliente: string;
  clienteAppId: string | null;
  sucursal: string;
}

export interface PerfilEmpleado {
  id: string;
  nombre: string;
  email: string;
  avatarUrl?: string | null;
  especialidades: string[];
  activo: boolean;
  horaInicio: string | null;
  horaFin: string | null;
  descansoInicio: string | null;
  descansoFin: string | null;
  diasTrabajo: number[] | null;
  estudio: {
    id: string;
    nombre: string;
    colorPrimario: string | null;
    logoUrl: string | null;
    direccion: string | null;
    telefono: string;
    horarioApertura: string | null;
    horarioCierre: string | null;
    diasAtencion: string | null;
    estado: string | null;
    pais: string | null;
    claveCliente: string;
    servicios: Servicio[];
  };
}
