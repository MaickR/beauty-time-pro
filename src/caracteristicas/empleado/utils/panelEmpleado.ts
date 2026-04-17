import { normalizarFechaReservaAgenda } from '../../estudio/utils/estadoCalendarioAgenda';
import type { ReservaEmpleado } from '../../../tipos';

export type PeriodoMetricaEmpleado = 'hoy' | 'semana' | 'mes';
export type ModoHistorialEmpleado = 'dia' | 'semana' | 'mes';

export function obtenerFechaAltaEmpleado(creadoEn?: string | null): string {
  return normalizarFechaReservaAgenda(creadoEn ?? '');
}

export function normalizarMesDesdeFecha(fechaIso: string): string {
  return fechaIso.slice(0, 7);
}

export function obtenerMesAnterior(mesIso: string): string {
  const [anio, mes] = mesIso.split('-').map(Number);
  const fecha = new Date((anio ?? 0), (mes ?? 1) - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function obtenerMesSiguiente(mesIso: string): string {
  const [anio, mes] = mesIso.split('-').map(Number);
  const fecha = new Date((anio ?? 0), mes ?? 1, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function combinarReservasEmpleado(...listas: Array<ReservaEmpleado[] | undefined>): ReservaEmpleado[] {
  const mapa = new Map<string, ReservaEmpleado>();

  for (const lista of listas) {
    for (const reserva of lista ?? []) {
      mapa.set(reserva.id, reserva);
    }
  }

  return [...mapa.values()].sort((a, b) => {
    const fechaA = normalizarFechaReservaAgenda(a.fecha);
    const fechaB = normalizarFechaReservaAgenda(b.fecha);
    return fechaA.localeCompare(fechaB) || a.horaInicio.localeCompare(b.horaInicio);
  });
}

export function obtenerInicioSemanaIso(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
  const diaSemana = fecha.getDay();
  fecha.setDate(fecha.getDate() - diaSemana);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate(),
  ).padStart(2, '0')}`;
}

export function obtenerFinSemanaIso(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
  const diaSemana = fecha.getDay();
  fecha.setDate(fecha.getDate() + (6 - diaSemana));
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate(),
  ).padStart(2, '0')}`;
}

export function filtrarReservasDesdeAlta(
  reservas: ReservaEmpleado[],
  fechaAltaEmpleado: string,
): ReservaEmpleado[] {
  if (!fechaAltaEmpleado) {
    return reservas;
  }

  return reservas.filter(
    (reserva) => normalizarFechaReservaAgenda(reserva.fecha) >= fechaAltaEmpleado,
  );
}

export function obtenerReservasPeriodoEmpleado(params: {
  reservas: ReservaEmpleado[];
  periodo: PeriodoMetricaEmpleado;
  fechaReferencia: string;
  fechaAltaEmpleado: string;
}): ReservaEmpleado[] {
  const { reservas, periodo, fechaReferencia, fechaAltaEmpleado } = params;
  const reservasVisibles = filtrarReservasDesdeAlta(reservas, fechaAltaEmpleado).filter(
    (reserva) => reserva.estado !== 'cancelled',
  );

  if (periodo === 'hoy') {
    return reservasVisibles.filter(
      (reserva) => normalizarFechaReservaAgenda(reserva.fecha) === fechaReferencia,
    );
  }

  if (periodo === 'semana') {
    const inicioSemana = obtenerInicioSemanaIso(fechaReferencia);
    const finSemana = obtenerFinSemanaIso(fechaReferencia);
    return reservasVisibles.filter((reserva) => {
      const fecha = normalizarFechaReservaAgenda(reserva.fecha);
      return fecha >= inicioSemana && fecha <= finSemana;
    });
  }

  const mes = normalizarMesDesdeFecha(fechaReferencia);
  return reservasVisibles.filter((reserva) =>
    normalizarFechaReservaAgenda(reserva.fecha).startsWith(`${mes}-`),
  );
}

export function obtenerReservasHistorialEmpleado(params: {
  reservas: ReservaEmpleado[];
  modo: ModoHistorialEmpleado;
  fechaBase: string;
  fechaActual: string;
  fechaAltaEmpleado: string;
}): ReservaEmpleado[] {
  const { reservas, modo, fechaBase, fechaActual, fechaAltaEmpleado } = params;
  const visibles = filtrarReservasDesdeAlta(reservas, fechaAltaEmpleado).filter((reserva) => {
    const fecha = normalizarFechaReservaAgenda(reserva.fecha);
    return fecha < fechaActual;
  });

  const inicioSemana = obtenerInicioSemanaIso(fechaBase);
  const finSemana = obtenerFinSemanaIso(fechaBase);
  const mesBase = normalizarMesDesdeFecha(fechaBase);

  return visibles
    .filter((reserva) => {
      const fecha = normalizarFechaReservaAgenda(reserva.fecha);

      if (modo === 'dia') {
        return fecha === fechaBase;
      }

      if (modo === 'semana') {
        return fecha >= inicioSemana && fecha <= finSemana;
      }

      return fecha.startsWith(`${mesBase}-`);
    })
    .sort((a, b) => {
      const fechaA = normalizarFechaReservaAgenda(a.fecha);
      const fechaB = normalizarFechaReservaAgenda(b.fecha);
      return fechaB.localeCompare(fechaA) || b.horaInicio.localeCompare(a.horaInicio);
    });
}

export function limitarFechaSeleccionEmpleado(fechaIso: string, fechaMinima: string): string {
  if (!fechaMinima) {
    return fechaIso;
  }

  return fechaIso < fechaMinima ? fechaMinima : fechaIso;
}