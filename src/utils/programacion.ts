import type { SlotTiempo, TurnoTrabajo } from '../tipos/index';

/** Convierte una cadena "HH:mm" a minutos desde medianoche. Devuelve null si la entrada es vacía. */
export function tiempoAMinutos(tiempo: string): number | null {
  if (!tiempo) return null;
  const [h, m] = tiempo.split(':').map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a cadena "HH:mm". */
export function minutosATiempo(minutos: number): string {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface MiembroHorario {
  shiftStart?: string | null;
  shiftEnd?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
}

interface ReservaMinima {
  time: string;
  totalDuration: number;
  status?: string;
}

interface ParametrosSlots {
  /** Horario del día para el estudio (apertura/cierre). */
  horarioDia: TurnoTrabajo;
  /** Información de turno y descanso del especialista. */
  miembro: MiembroHorario;
  /** Reservas existentes para ese especialista en esa fecha. */
  reservasExistentes: ReservaMinima[];
  /** Duración del bloque a calcular: 30 para vista admin, totalDuration para vista cliente. */
  duracionSlot: number;
  /** Fecha en formato "YYYY-MM-DD". Se usa para filtrar slots pasados si es hoy. */
  fechaStr: string;
  /** Activar para filtrar slots anteriores a la hora actual (vista de cliente). */
  filtrarPasados?: boolean;
  /** Activar para omitir slots con status TOO_SHORT del resultado (vista de cliente). */
  filtrarDemasiadoCortos?: boolean;
}

/**
 * Calcula los slots de tiempo disponibles para un especialista en una fecha dada.
 *
 * Unifica la lógica de vista de agenda (admin, duracionSlot=30) y reserva de citas
 * (cliente, duracionSlot=totalDuration de los servicios seleccionados).
 */
export function obtenerSlotsDisponibles({
  horarioDia,
  miembro,
  reservasExistentes,
  duracionSlot,
  fechaStr,
  filtrarPasados = false,
  filtrarDemasiadoCortos = false,
}: ParametrosSlots): SlotTiempo[] {
  // Día marcado como cerrado — sin slots disponibles
  if (!horarioDia.isOpen) return [];

  const inicioEstudio = tiempoAMinutos(horarioDia.openTime) ?? 0;
  const finEstudio = tiempoAMinutos(horarioDia.closeTime) ?? 0;
  const inicioTurno = miembro.shiftStart
    ? (tiempoAMinutos(miembro.shiftStart) ?? inicioEstudio)
    : inicioEstudio;
  const finTurno = miembro.shiftEnd ? (tiempoAMinutos(miembro.shiftEnd) ?? finEstudio) : finEstudio;

  const inicioEfectivo = Math.max(inicioEstudio, inicioTurno);
  const finEfectivo = Math.min(finEstudio, finTurno);

  const inicioDescanso = miembro.breakStart ? tiempoAMinutos(miembro.breakStart) : null;
  const finDescanso = miembro.breakEnd ? tiempoAMinutos(miembro.breakEnd) : null;
  const tieneDescanso =
    inicioDescanso !== null && finDescanso !== null && inicioDescanso < finDescanso;

  const reservasActivas = reservasExistentes.filter((r) => r.status !== 'cancelled');

  // Minutos actuales — solo relevante si es el día de hoy y filtrarPasados = true
  let minutosAhora = -1;
  if (filtrarPasados) {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    if (fechaStr === hoy) {
      minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    }
  }

  const slots: SlotTiempo[] = [];

  for (let tiempo = inicioEfectivo; tiempo < finEfectivo; tiempo += 30) {
    // Filtrar slots pasados para el día de hoy
    if (minutosAhora >= 0 && tiempo <= minutosAhora) continue;

    const finSlot = tiempo + duracionSlot;
    let estado: SlotTiempo['status'] = 'AVAILABLE';

    if (tieneDescanso) {
      const enDescanso = tiempo >= inicioDescanso! && tiempo < finDescanso!;
      const solapaDescanso = !enDescanso && tiempo < inicioDescanso! && finSlot > inicioDescanso!;

      if (enDescanso) {
        estado = 'BREAK_TIME';
      } else if (solapaDescanso) {
        // Vista cliente: marca como TOO_SHORT; vista admin: marca como BREAK_TIME
        estado = filtrarDemasiadoCortos ? 'TOO_SHORT' : 'BREAK_TIME';
      }
    }

    // Servicio no cabe antes del cierre del turno
    if (estado === 'AVAILABLE' && finSlot > finEfectivo) {
      estado = 'TOO_SHORT';
    }

    // Verificar colisión con reservas existentes
    if (estado === 'AVAILABLE') {
      for (const reserva of reservasActivas) {
        const inicioReserva = tiempoAMinutos(reserva.time) ?? 0;
        const finReserva = inicioReserva + reserva.totalDuration;
        if (tiempo < finReserva && finSlot > inicioReserva) {
          estado = 'OCCUPIED';
          break;
        }
      }
    }

    if (filtrarDemasiadoCortos && estado === 'TOO_SHORT') continue;

    slots.push({ time: minutosATiempo(tiempo), status: estado });
  }

  return slots;
}
