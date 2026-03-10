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
export type EstadoReserva = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type EstadoSlot = 'AVAILABLE' | 'OCCUPIED' | 'BREAK_TIME' | 'TOO_SHORT';

export interface SlotTiempo {
  time: string; // "HH:mm"
  status: EstadoSlot;
}

export interface Servicio {
  name: string;
  duration: number; // minutos
  price: number;
  category?: string;
}

export interface ServicioPersonalizado {
  name: string;
  category: string;
}

export interface Personal {
  id: string;
  name: string;
  specialties: string[];
  active: boolean;
  shiftStart: string | null; // "HH:mm"
  shiftEnd: string | null; // "HH:mm"
  breakStart: string | null; // "HH:mm"
  breakEnd: string | null; // "HH:mm"
}

export interface Estudio {
  id: string;
  name: string;
  owner: string;
  phone: string;
  website?: string;
  country: Pais;
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
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface Reserva {
  id: string;
  studioId: string;
  studioName: string;
  clientName: string;
  clientPhone: string;
  services: Servicio[];
  totalDuration: number; // minutos
  totalPrice: number;
  status: EstadoReserva;
  branch: string;
  staffId: string;
  staffName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  colorBrand: string | null;
  colorNumber: string | null;
  createdAt: string; // ISO datetime
}

export interface Pago {
  id: string;
  studioId: string;
  studioName: string;
  amount: number;
  currency: Moneda;
  date: string; // "YYYY-MM-DD"
  createdAt: string; // ISO datetime
}

export interface EstadoSuscripcion {
  cutDay: number;
  dueDateStr: string;
  daysRemaining: number;
  status: 'ACTIVE' | 'WARNING' | 'OVERDUE';
}
