import { DIAS_SEMANA } from '../../../lib/constantes';
import {
  combinarExcepcionesDisponibilidad,
  formatearAlcanceExcepcion,
  obtenerExcepcionDisponibilidadGlobal,
} from '../../../lib/disponibilidadExcepciones';
import { formatearFechaHumana, obtenerFechaLocalISO } from '../../../utils/formato';
import type { Estudio, Reserva, TurnoTrabajo } from '../../../tipos';

const ESTADOS_AGENDA_ACTIVA = new Set(['pending', 'confirmed', 'working']);

export function obtenerPestanaAgendaPorFecha(
  fechaSeleccionada: string,
  fechaActual: string,
): 'agenda' | 'historial' {
  return fechaSeleccionada < fechaActual ? 'historial' : 'agenda';
}

export interface EstadoCalendarioAgenda {
  fecha: string;
  tieneCitas: boolean;
  totalCitas: number;
  esCierre: boolean;
  esFestivo: boolean;
  tieneHorarioModificado: boolean;
  horarioDia: TurnoTrabajo | null;
  horarioReferencia: TurnoTrabajo | null;
  tituloDetalle: string | null;
  descripcionDetalle: string | null;
}

export function normalizarFechaReservaAgenda(fecha: string | Date | null | undefined): string {
  if (!fecha) {
    return '';
  }

  if (fecha instanceof Date) {
    return obtenerFechaLocalISO(fecha);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  const coincidenciaIso = fecha.match(/^\d{4}-\d{2}-\d{2}/);
  if (coincidenciaIso) {
    return coincidenciaIso[0];
  }

  const fechaParseada = new Date(fecha);
  if (!Number.isNaN(fechaParseada.getTime())) {
    return obtenerFechaLocalISO(fechaParseada);
  }

  return fecha;
}

export function obtenerReservasDelDiaAgenda(reservas: Reserva[], fechaIso: string): Reserva[] {
  return reservas.filter((reserva) => normalizarFechaReservaAgenda(reserva.date) === fechaIso);
}

export function obtenerReservasActivasDelDiaAgenda(
  reservas: Reserva[],
  fechaIso: string,
): Reserva[] {
  return obtenerReservasDelDiaAgenda(reservas, fechaIso).filter((reserva) =>
    ESTADOS_AGENDA_ACTIVA.has(reserva.status),
  );
}

export function obtenerReservasHistorialAgenda(params: {
  reservas: Reserva[];
  estudioId: string;
  modo: 'dia' | 'rango' | 'mes';
  fechaHistorial: string;
  rangoInicio: string;
  rangoFin: string;
  mesHistorial: string;
  fechaActual: string;
}): Reserva[] {
  const {
    reservas,
    estudioId,
    modo,
    fechaHistorial,
    rangoInicio,
    rangoFin,
    mesHistorial,
    fechaActual,
  } = params;
  const inicioRango = rangoInicio && rangoFin ? [rangoInicio, rangoFin].sort()[0]! : rangoInicio;
  const finRango = rangoInicio && rangoFin ? [rangoInicio, rangoFin].sort()[1]! : rangoFin;

  return reservas
    .filter((reserva) => {
      if (reserva.studioId !== estudioId) {
        return false;
      }

      const fechaReserva = normalizarFechaReservaAgenda(reserva.date);

      if (!fechaReserva || fechaReserva >= fechaActual) {
        return false;
      }

      if (modo === 'dia') {
        return fechaReserva === fechaHistorial;
      }

      if (modo === 'rango') {
        if (!inicioRango || !finRango) {
          return false;
        }

        return fechaReserva >= inicioRango && fechaReserva <= finRango;
      }

      return fechaReserva.startsWith(`${mesHistorial}-`);
    })
    .sort((a, b) => {
      const fechaA = normalizarFechaReservaAgenda(a.date);
      const fechaB = normalizarFechaReservaAgenda(b.date);

      return fechaB.localeCompare(fechaA) || a.time.localeCompare(b.time);
    });
}

function obtenerHorarioReferencia(estudio: Estudio): TurnoTrabajo | null {
  const conteo = new Map<string, { turno: TurnoTrabajo; cantidad: number }>();

  for (const turno of Object.values(estudio.schedule ?? {})) {
    if (!turno?.isOpen) {
      continue;
    }

    const clave = `${turno.openTime}-${turno.closeTime}`;
    const actual = conteo.get(clave);

    if (actual) {
      actual.cantidad += 1;
      continue;
    }

    conteo.set(clave, {
      turno: {
        isOpen: true,
        openTime: turno.openTime,
        closeTime: turno.closeTime,
      },
      cantidad: 1,
    });
  }

  const horarioMasComun = [...conteo.values()].sort((a, b) => b.cantidad - a.cantidad)[0];
  return horarioMasComun?.turno ?? null;
}

function formatearRangoHorario(turno: TurnoTrabajo | null): string {
  if (!turno?.isOpen) {
    return 'Cerrado';
  }

  return `${turno.openTime} – ${turno.closeTime}`;
}

export function obtenerEstadoCalendarioAgenda(params: {
  fecha: Date;
  estudio: Estudio;
  reservas?: Reserva[];
}): EstadoCalendarioAgenda {
  const { fecha, estudio, reservas = [] } = params;
  const fechaIso = obtenerFechaLocalISO(fecha);
  const claveDia = DIAS_SEMANA[fecha.getDay()] ?? '';
  const horarioProgramado = estudio.schedule?.[claveDia] ?? null;
  const horarioReferencia = obtenerHorarioReferencia(estudio);
  const excepcionesDisponibilidad = combinarExcepcionesDisponibilidad(
    estudio.holidays,
    estudio.availabilityExceptions,
  );
  const excepcionDia = obtenerExcepcionDisponibilidadGlobal(excepcionesDisponibilidad, fechaIso);
  const horarioDia =
    excepcionDia?.tipo === 'horario_modificado' && excepcionDia.horaInicio && excepcionDia.horaFin
      ? {
          isOpen: true,
          openTime: excepcionDia.horaInicio,
          closeTime: excepcionDia.horaFin,
        }
      : horarioProgramado;
  const esFestivo = Boolean(estudio.holidays?.includes(fechaIso));
  const esCierre = Boolean(excepcionDia?.tipo === 'cerrado' || esFestivo || !horarioProgramado?.isOpen);
  const totalCitas = obtenerReservasActivasDelDiaAgenda(reservas, fechaIso).length;
  const tieneCitas = totalCitas > 0;
  const tieneHorarioModificado = Boolean(
    !esCierre &&
      horarioDia &&
      ((excepcionDia?.tipo === 'horario_modificado') ||
        (horarioReferencia &&
          (horarioDia.openTime !== horarioReferencia.openTime ||
            horarioDia.closeTime !== horarioReferencia.closeTime))),
  );

  let tituloDetalle: string | null = null;
  let descripcionDetalle: string | null = null;

  if (esCierre) {
    tituloDetalle = 'Día cerrado';
    descripcionDetalle = excepcionDia?.tipo === 'cerrado'
      ? `${formatearAlcanceExcepcion(excepcionDia, estudio.name)} permanecerá cerrado el ${formatearFechaHumana(fechaIso)}.`
      : esFestivo
        ? `El salón marcó el ${formatearFechaHumana(fechaIso)} como día de cierre y no debe operar ningún servicio en esa fecha.`
        : `El salón no abre los ${claveDia.toLowerCase()}.`;
  } else if (tieneHorarioModificado) {
    tituloDetalle = 'Horario modificado';
    descripcionDetalle = excepcionDia?.tipo === 'horario_modificado'
      ? `${formatearAlcanceExcepcion(excepcionDia, estudio.name)} operará el ${formatearFechaHumana(fechaIso)} de ${formatearRangoHorario(horarioDia)}.`
      : `El ${formatearFechaHumana(fechaIso)} el salón operará de ${formatearRangoHorario(horarioDia)}. El horario regular es ${formatearRangoHorario(horarioReferencia)}.`;
  }

  return {
    fecha: fechaIso,
    tieneCitas,
    totalCitas,
    esCierre,
    esFestivo,
    tieneHorarioModificado,
    horarioDia,
    horarioReferencia,
    tituloDetalle,
    descripcionDetalle,
  };
}
