import type {
  CitaDashboardSalon,
  EspecialistaActivoDashboardSalon,
  FilaIngresoDashboardSalon,
} from '../../../servicios/servicioEstudios';

export type PeriodoFinancieroDashboardSalon = 'dia' | 'semana' | 'mes';

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function obtenerEtiquetaEstadoReserva(estado: string): string {
  switch (estado) {
    case 'pending':
      return 'Pendiente';
    case 'confirmed':
      return 'Confirmada';
    case 'working':
      return 'Trabajando';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    case 'no_show':
      return 'No asistió';
    case 'rescheduled':
      return 'Reagendada';
    default:
      return estado;
  }
}

export function obtenerClaseEstadoReserva(estado: string): string {
  switch (estado) {
    case 'pending':
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-700';
    case 'working':
      return 'bg-sky-100 text-sky-700';
    case 'completed':
      return 'bg-slate-200 text-slate-700';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    case 'no_show':
      return 'bg-slate-200 text-slate-700';
    case 'rescheduled':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function filtrarCitasDashboard(
  citas: CitaDashboardSalon[],
  termino: string,
  estado: string,
) {
  const terminoNormalizado = normalizarTexto(termino);

  return citas.filter((cita) => {
    const coincideEstado = estado === 'todos' || cita.estado === estado;
    if (!coincideEstado) return false;
    if (!terminoNormalizado) return true;

    const textoBase = normalizarTexto(
      [
        cita.cliente,
        cita.telefonoCliente,
        cita.especialista,
        cita.servicioPrincipal,
        cita.servicios.join(' '),
        cita.sucursal,
        cita.hora,
      ].join(' '),
    );

    return textoBase.includes(terminoNormalizado);
  });
}

export function filtrarIngresosDashboard(
  filas: FilaIngresoDashboardSalon[],
  termino: string,
  tipo: 'todos' | 'servicio' | 'producto',
) {
  const terminoNormalizado = normalizarTexto(termino);

  return filas.filter((fila) => {
    const coincideTipo = tipo === 'todos' || fila.tipo === tipo;
    if (!coincideTipo) return false;
    if (!terminoNormalizado) return true;

    const textoBase = normalizarTexto(
      [fila.concepto, fila.cliente, fila.especialista, fila.sucursal, fila.fecha, fila.hora].join(
        ' ',
      ),
    );

    return textoBase.includes(terminoNormalizado);
  });
}

export function construirFilasAcumuladas(
  filas: FilaIngresoDashboardSalon[],
): Array<FilaIngresoDashboardSalon & { acumulado: number }> {
  let acumulado = 0;

  return filas.map((fila) => {
    acumulado += fila.total;
    return {
      ...fila,
      acumulado,
    };
  });
}

export function filtrarEspecialistasDashboard(
  especialistas: EspecialistaActivoDashboardSalon[],
  termino: string,
) {
  const terminoNormalizado = normalizarTexto(termino);
  if (!terminoNormalizado) return especialistas;

  return especialistas.filter((especialista) =>
    normalizarTexto(
      [
        especialista.nombre,
        especialista.jornada,
        especialista.descanso,
        especialista.proximaCita ?? '',
        especialista.servicios.join(' '),
      ].join(' '),
    ).includes(terminoNormalizado),
  );
}

export function obtenerSegmentoPeriodoFinancieroArchivo(
  periodo: PeriodoFinancieroDashboardSalon,
) {
  if (periodo === 'dia') return 'dia';
  if (periodo === 'semana') return 'semana';
  return 'mes';
}

export function obtenerEtiquetaPeriodoFinanciero(
  periodo: PeriodoFinancieroDashboardSalon,
) {
  if (periodo === 'dia') return 'Hoy';
  if (periodo === 'semana') return 'Semana';
  return 'Mes';
}