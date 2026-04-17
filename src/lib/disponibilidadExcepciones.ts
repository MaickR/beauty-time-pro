import type { ExcepcionDisponibilidad } from '../tipos';

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarExcepcion(valor: unknown, indice: number): ExcepcionDisponibilidad | null {
  if (typeof valor !== 'object' || valor === null) return null;

  const registro = valor as Record<string, unknown>;
  const fecha = typeof registro['fecha'] === 'string' ? registro['fecha'].trim() : '';
  const tipo = registro['tipo'] === 'cerrado' || registro['tipo'] === 'horario_modificado'
    ? registro['tipo']
    : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !tipo) {
    return null;
  }

  return {
    id:
      typeof registro['id'] === 'string' && registro['id'].trim().length > 0
        ? registro['id'].trim()
        : `excepcion-${indice}`,
    fecha,
    tipo,
    horaInicio: typeof registro['horaInicio'] === 'string' ? registro['horaInicio'] : null,
    horaFin: typeof registro['horaFin'] === 'string' ? registro['horaFin'] : null,
    aplicaTodasLasSedes: Boolean(registro['aplicaTodasLasSedes']),
    sedes: Array.isArray(registro['sedes'])
      ? Array.from(
          new Set(
            registro['sedes']
              .filter((sede): sede is string => typeof sede === 'string')
              .map((sede) => sede.trim())
              .filter(Boolean),
          ),
        )
      : [],
    motivo: typeof registro['motivo'] === 'string' && registro['motivo'].trim().length > 0
      ? registro['motivo'].trim()
      : null,
    activa: registro['activa'] === undefined ? true : Boolean(registro['activa']),
    creadoEn: typeof registro['creadoEn'] === 'string' ? registro['creadoEn'] : null,
    actualizadoEn: typeof registro['actualizadoEn'] === 'string' ? registro['actualizadoEn'] : null,
  };
}

export function normalizarExcepcionesDisponibilidad(valor: unknown): ExcepcionDisponibilidad[] {
  if (!Array.isArray(valor)) return [];

  return valor
    .map((entrada, indice) => normalizarExcepcion(entrada, indice))
    .filter((excepcion): excepcion is ExcepcionDisponibilidad => excepcion !== null);
}

export function combinarExcepcionesDisponibilidad(
  festivos: string[] | undefined,
  excepciones: ExcepcionDisponibilidad[] | undefined,
): ExcepcionDisponibilidad[] {
  const mapa = new Map<string, ExcepcionDisponibilidad>();

  for (const fecha of festivos ?? []) {
    const clave = `${fecha}|cerrado|todas`;
    mapa.set(clave, {
      id: `legado-${fecha}`,
      fecha,
      tipo: 'cerrado',
      horaInicio: null,
      horaFin: null,
      aplicaTodasLasSedes: true,
      sedes: [],
      motivo: null,
      activa: true,
      creadoEn: null,
      actualizadoEn: null,
    });
  }

  for (const excepcion of excepciones ?? []) {
    const clave = excepcion.aplicaTodasLasSedes
      ? `${excepcion.fecha}|${excepcion.tipo}|todas`
      : `${excepcion.fecha}|${excepcion.tipo}|${[...excepcion.sedes].sort().join(',')}`;
    mapa.set(clave, excepcion);
  }

  return [...mapa.values()];
}

export function obtenerExcepcionesDisponibilidadActivas(
  excepciones: ExcepcionDisponibilidad[] | undefined,
): ExcepcionDisponibilidad[] {
  return (excepciones ?? []).filter((excepcion) => excepcion.activa);
}

export function obtenerExcepcionDisponibilidadAplicada(params: {
  excepciones: ExcepcionDisponibilidad[] | undefined;
  fecha: string;
  sucursal?: string | null;
}): ExcepcionDisponibilidad | null {
  const { excepciones, fecha, sucursal } = params;
  const sucursalNormalizada = sucursal ? normalizarTexto(sucursal) : null;

  const coincidencias = obtenerExcepcionesDisponibilidadActivas(excepciones)
    .filter((excepcion) => excepcion.fecha === fecha)
    .filter((excepcion) => {
      if (excepcion.aplicaTodasLasSedes) return true;
      if (!sucursalNormalizada) return false;
      return excepcion.sedes.some((sede) => normalizarTexto(sede) === sucursalNormalizada);
    });

  return coincidencias[coincidencias.length - 1] ?? null;
}

export function obtenerExcepcionDisponibilidadGlobal(
  excepciones: ExcepcionDisponibilidad[] | undefined,
  fecha: string,
): ExcepcionDisponibilidad | null {
  const coincidencias = obtenerExcepcionesDisponibilidadActivas(excepciones).filter(
    (excepcion) => excepcion.fecha === fecha,
  );

  if (coincidencias.length === 0) return null;

  const cierre = [...coincidencias].reverse().find((excepcion) => excepcion.tipo === 'cerrado');
  return cierre ?? coincidencias[coincidencias.length - 1] ?? null;
}

export function ordenarExcepcionesDisponibilidad(
  excepciones: ExcepcionDisponibilidad[] | undefined,
): ExcepcionDisponibilidad[] {
  return [...(excepciones ?? [])].sort((a, b) => {
    if (a.activa !== b.activa) {
      return Number(b.activa) - Number(a.activa);
    }

    return a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id);
  });
}

export function formatearAlcanceExcepcion(
  excepcion: ExcepcionDisponibilidad,
  nombrePrincipal: string,
): string {
  if (excepcion.aplicaTodasLasSedes) {
    return 'All branches';
  }

  if (excepcion.sedes.length === 0) {
    return nombrePrincipal;
  }

  return excepcion.sedes.join(', ');
}