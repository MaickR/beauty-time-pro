import { obtenerFechaISOEnZona, obtenerMinutosActualesEnZona } from '../utils/zonasHorarias.js';

/** Convierte "HH:mm" a minutos desde medianoche. Devuelve null si la entrada está vacía. */
function tiempoAMinutos(tiempo: string | null | undefined): number | null {
  if (!tiempo) return null;
  const partes = tiempo.split(':');
  const h = Number(partes[0]);
  const m = Number(partes[1]);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:mm". */
function minutosATiempo(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function obtenerHorarioDia(horario: Record<string, TurnoEstudio>, diaSemana: string): TurnoEstudio | undefined {
  if (horario[diaSemana]) return horario[diaSemana];

  const diaNormalizado = normalizarTexto(diaSemana);
  return Object.entries(horario).find(([dia]) => normalizarTexto(dia) === diaNormalizado)?.[1];
}

function miembroTrabajaEseDia(diasTrabajo: unknown, indiceDia: number, diaSemana: string): boolean {
  if (!Array.isArray(diasTrabajo) || diasTrabajo.length === 0) {
    return true;
  }

  const diaNormalizado = normalizarTexto(diaSemana);
  const coincide = diasTrabajo.some((dia) => {
    if (typeof dia === 'number') {
      return dia === indiceDia;
    }

    if (typeof dia === 'string') {
      return normalizarTexto(dia) === diaNormalizado;
    }

    return false;
  });

  return coincide;
}

interface MiembroHorario {
  horaInicio: string | null;
  horaFin: string | null;
  descansoInicio: string | null;
  descansoFin: string | null;
  diasTrabajo: unknown;
}

interface ReservaBreve {
  horaInicio: string;
  duracion: number;
}

interface TurnoEstudio {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface ParametrosSlotsBackend {
  horario: Record<string, TurnoEstudio>;
  miembro: MiembroHorario;
  fecha: string; // "YYYY-MM-DD"
  duracionMin: number;
  reservas: ReservaBreve[];
  zonaHoraria?: string | null;
}

export interface SlotDisponible {
  hora: string;
  disponible: boolean;
}

export function obtenerSlotsDisponiblesBackend({
  horario,
  miembro,
  fecha,
  duracionMin,
  reservas,
  zonaHoraria,
}: ParametrosSlotsBackend): SlotDisponible[] {
  const fechaObj = new Date(`${fecha}T12:00:00`);
  const indiceDia = fechaObj.getDay();
  const diaSemana = DIAS_SEMANA[indiceDia];
  const horarioDia = obtenerHorarioDia(horario, diaSemana ?? '');

  if (!horarioDia?.isOpen) return [];
  if (!miembroTrabajaEseDia(miembro.diasTrabajo, indiceDia, diaSemana ?? '')) return [];

  const inicioEstudio = tiempoAMinutos(horarioDia.openTime) ?? 0;
  const finEstudio = tiempoAMinutos(horarioDia.closeTime) ?? 0;

  const inicioTurno = tiempoAMinutos(miembro.horaInicio) ?? inicioEstudio;
  const finTurno = tiempoAMinutos(miembro.horaFin) ?? finEstudio;

  const inicioEfectivo = Math.max(inicioEstudio, inicioTurno);
  const finEfectivo = Math.min(finEstudio, finTurno);

  const inicioDescanso = tiempoAMinutos(miembro.descansoInicio);
  const finDescanso = tiempoAMinutos(miembro.descansoFin);
  const tieneDescanso = inicioDescanso !== null && finDescanso !== null && inicioDescanso < finDescanso;

  // Filtrar slots pasados si es hoy
  const ahora = new Date();
  const hoy = obtenerFechaISOEnZona(ahora, zonaHoraria);
  const minutosAhora = fecha === hoy ? obtenerMinutosActualesEnZona(ahora, zonaHoraria) : -1;

  const slots: SlotDisponible[] = [];

  for (let tiempo = inicioEfectivo; tiempo < finEfectivo; tiempo += 30) {
    if (minutosAhora >= 0 && tiempo <= minutosAhora) continue;

    const finSlot = tiempo + duracionMin;
    if (finSlot > finEfectivo) continue;

    // Verificar descanso
    if (tieneDescanso) {
      const enDescanso = tiempo >= inicioDescanso! && tiempo < finDescanso!;
      const solapaDescanso = !enDescanso && tiempo < inicioDescanso! && finSlot > inicioDescanso!;
      if (enDescanso || solapaDescanso) continue;
    }

    // Verificar colisión con reservas existentes
    let ocupado = false;
    for (const r of reservas) {
      const inicioR = tiempoAMinutos(r.horaInicio) ?? 0;
      const finR = inicioR + r.duracion;
      if (tiempo < finR && finSlot > inicioR) {
        ocupado = true;
        break;
      }
    }
    if (ocupado) continue;

    slots.push({ hora: minutosATiempo(tiempo), disponible: true });
  }

  return slots;
}
