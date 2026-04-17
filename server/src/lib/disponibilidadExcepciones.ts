interface ExcepcionDisponibilidadPlano {
  id?: unknown;
  fecha?: unknown;
  tipo?: unknown;
  horaInicio?: unknown;
  horaFin?: unknown;
  aplicaTodasLasSedes?: unknown;
  sedes?: unknown;
  motivo?: unknown;
  activa?: unknown;
  creadoEn?: unknown;
  actualizadoEn?: unknown;
}

export type TipoExcepcionDisponibilidad = 'cerrado' | 'horario_modificado';

export interface ExcepcionDisponibilidad {
  id: string;
  fecha: string;
  tipo: TipoExcepcionDisponibilidad;
  horaInicio: string | null;
  horaFin: string | null;
  aplicaTodasLasSedes: boolean;
  sedes: string[];
  motivo: string | null;
  activa: boolean;
  creadoEn: string | null;
  actualizadoEn: string | null;
}

export interface ExcepcionDisponibilidadAplicada {
  fecha: string;
  tipo: TipoExcepcionDisponibilidad;
  horaInicio: string | null;
  horaFin: string | null;
  sedes: string[];
  aplicaTodasLasSedes: boolean;
  motivo: string | null;
}

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarHora(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const hora = valor.trim();
  return REGEX_HORA.test(hora) ? hora : null;
}

function normalizarTextoOpcional(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

function normalizarSedes(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];

  return Array.from(
    new Set(
      valor
        .filter((sede): sede is string => typeof sede === 'string')
        .map((sede) => sede.trim())
        .filter(Boolean),
    ),
  );
}

export function parsearExcepcionesDisponibilidad(valor: unknown): ExcepcionDisponibilidad[] {
  if (!Array.isArray(valor)) return [];

  return valor.flatMap((entrada, indice) => {
    if (typeof entrada !== 'object' || entrada === null) {
      return [];
    }

    const plano = entrada as ExcepcionDisponibilidadPlano;
    const fecha = typeof plano.fecha === 'string' ? plano.fecha.trim() : '';
    const tipo = plano.tipo === 'cerrado' || plano.tipo === 'horario_modificado' ? plano.tipo : null;

    if (!REGEX_FECHA_ISO.test(fecha) || !tipo) {
      return [];
    }

    const horaInicio = normalizarHora(plano.horaInicio);
    const horaFin = normalizarHora(plano.horaFin);

    if (tipo === 'horario_modificado' && (!horaInicio || !horaFin || horaInicio >= horaFin)) {
      return [];
    }

    return [{
      id: typeof plano.id === 'string' && plano.id.trim().length > 0 ? plano.id.trim() : `excepcion-${indice}`,
      fecha,
      tipo,
      horaInicio,
      horaFin,
      aplicaTodasLasSedes: Boolean(plano.aplicaTodasLasSedes),
      sedes: normalizarSedes(plano.sedes),
      motivo: normalizarTextoOpcional(plano.motivo),
      activa: plano.activa === undefined ? true : Boolean(plano.activa),
      creadoEn: normalizarTextoOpcional(plano.creadoEn),
      actualizadoEn: normalizarTextoOpcional(plano.actualizadoEn),
    } satisfies ExcepcionDisponibilidad];
  });
}

function coincideSede(excepcion: ExcepcionDisponibilidad, sucursal: string | null | undefined): boolean {
  if (!excepcion.activa) return false;
  if (excepcion.aplicaTodasLasSedes) return true;
  if (!sucursal) return false;

  const sucursalNormalizada = normalizarTexto(sucursal);
  return excepcion.sedes.some((sede) => normalizarTexto(sede) === sucursalNormalizada);
}

export function obtenerExcepcionDisponibilidadAplicada(params: {
  excepciones: unknown;
  fecha: string;
  sucursal?: string | null;
}): ExcepcionDisponibilidadAplicada | null {
  const { excepciones, fecha, sucursal } = params;
  const coincidencias = parsearExcepcionesDisponibilidad(excepciones)
    .filter((excepcion) => excepcion.fecha === fecha)
    .filter((excepcion) => coincideSede(excepcion, sucursal));

  const excepcion = coincidencias[coincidencias.length - 1];
  if (!excepcion) return null;

  return {
    fecha: excepcion.fecha,
    tipo: excepcion.tipo,
    horaInicio: excepcion.horaInicio,
    horaFin: excepcion.horaFin,
    sedes: excepcion.sedes,
    aplicaTodasLasSedes: excepcion.aplicaTodasLasSedes,
    motivo: excepcion.motivo,
  };
}

export function tieneExcepcionDisponibilidadEnFecha(params: {
  excepciones: unknown;
  fecha: string;
  sucursal?: string | null;
}): boolean {
  return obtenerExcepcionDisponibilidadAplicada(params) !== null;
}