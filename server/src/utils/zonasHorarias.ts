const ZONA_MEXICO = 'America/Mexico_City';
const ZONA_COLOMBIA = 'America/Bogota';

interface PartesFechaZona {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function extraerPartesFecha(fecha: Date, zonaHoraria: string): PartesFechaZona {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partes = Object.fromEntries(
    formateador
      .formatToParts(fecha)
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, Number(parte.value)]),
  );

  return {
    year: typeof partes.year === 'number' ? partes.year : fecha.getUTCFullYear(),
    month: typeof partes.month === 'number' ? partes.month : fecha.getUTCMonth() + 1,
    day: typeof partes.day === 'number' ? partes.day : fecha.getUTCDate(),
    hour: typeof partes.hour === 'number' ? partes.hour : fecha.getUTCHours(),
    minute: typeof partes.minute === 'number' ? partes.minute : fecha.getUTCMinutes(),
    second: typeof partes.second === 'number' ? partes.second : fecha.getUTCSeconds(),
  };
}

export function obtenerZonaHorariaPorPais(pais?: string | null): string {
  return pais === 'Colombia' ? ZONA_COLOMBIA : ZONA_MEXICO;
}

export function normalizarZonaHorariaEstudio(
  zonaHoraria?: string | null,
  pais?: string | null,
): string {
  const candidata = zonaHoraria?.trim();
  if (!candidata) {
    return obtenerZonaHorariaPorPais(pais);
  }

  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: candidata }).format(new Date());
    return candidata;
  } catch {
    return obtenerZonaHorariaPorPais(pais);
  }
}

export function obtenerFechaISOEnZona(
  fecha: Date,
  zonaHoraria?: string | null,
  pais?: string | null,
): string {
  const zona = normalizarZonaHorariaEstudio(zonaHoraria, pais);
  const partes = extraerPartesFecha(fecha, zona);
  return `${String(partes.year).padStart(4, '0')}-${String(partes.month).padStart(2, '0')}-${String(partes.day).padStart(2, '0')}`;
}

export function obtenerMinutosActualesEnZona(
  fecha: Date,
  zonaHoraria?: string | null,
  pais?: string | null,
): number {
  const zona = normalizarZonaHorariaEstudio(zonaHoraria, pais);
  const partes = extraerPartesFecha(fecha, zona);
  return partes.hour * 60 + partes.minute;
}

export function construirFechaHoraEnZona(
  fechaISO: string,
  hora: string,
  zonaHoraria?: string | null,
  pais?: string | null,
): Date {
  const zona = normalizarZonaHorariaEstudio(zonaHoraria, pais);
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const estimadaUtc = new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1, horas ?? 0, minutos ?? 0, 0));
  const partesEstimadas = extraerPartesFecha(estimadaUtc, zona);
  const marcaObjetivo = Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1, horas ?? 0, minutos ?? 0, 0);
  const marcaInterpretada = Date.UTC(
    partesEstimadas.year,
    (partesEstimadas.month ?? 1) - 1,
    partesEstimadas.day ?? 1,
    partesEstimadas.hour ?? 0,
    partesEstimadas.minute ?? 0,
    partesEstimadas.second ?? 0,
  );

  return new Date(estimadaUtc.getTime() + (marcaObjetivo - marcaInterpretada));
}

export function obtenerMinutosHastaFechaHoraEnZona(
  fechaISO: string,
  hora: string,
  zonaHoraria?: string | null,
  pais?: string | null,
  referencia: Date = new Date(),
): number {
  const fechaHora = construirFechaHoraEnZona(fechaISO, hora, zonaHoraria, pais);
  return Math.floor((fechaHora.getTime() - referencia.getTime()) / 60000);
}
