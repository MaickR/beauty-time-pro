import crypto from 'crypto';
import type { Prisma } from '../generated/prisma/client.js';
import type { ExcepcionDisponibilidad, TipoExcepcionDisponibilidad } from './disponibilidadExcepciones.js';

interface ExcepcionDisponibilidadEntrada {
  id?: string;
  fecha: string;
  tipo: TipoExcepcionDisponibilidad;
  horaInicio?: string | null;
  horaFin?: string | null;
  aplicaTodasLasSedes?: boolean;
  sedes?: string[];
  motivo?: string | null;
  activa?: boolean;
  creadoEn?: string | null;
}

interface ParamsNormalizarExcepcionesDisponibilidadEntrada {
  excepciones: ExcepcionDisponibilidadEntrada[];
  excepcionesExistentes?: ExcepcionDisponibilidad[];
  fechaMinima: string;
  horaActual: string;
  sedesDisponibles: string[];
}

function normalizarTextoComparacion(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizarExcepcionesDisponibilidadEntrada(
  params: ParamsNormalizarExcepcionesDisponibilidadEntrada,
): Prisma.InputJsonValue {
  const { excepciones, excepcionesExistentes = [], fechaMinima, horaActual, sedesDisponibles } = params;
  const sedesValidas = new Map(
    sedesDisponibles.map((sede) => [normalizarTextoComparacion(sede), sede]),
  );
  const idsExistentes = new Set(
    excepcionesExistentes
      .map((excepcion) => excepcion.id.trim())
      .filter((idExcepcion) => idExcepcion.length > 0),
  );
  const llavesActivas = new Set<string>();

  return excepciones.map((excepcion) => {
    const idNormalizado = excepcion.id?.trim() || '';
    const yaPersistida = idNormalizado.length > 0 && idsExistentes.has(idNormalizado);

    if (!yaPersistida && excepcion.fecha < fechaMinima) {
      throw new Error('No puedes registrar excepciones en fechas pasadas');
    }

    if (
      !yaPersistida &&
      excepcion.tipo === 'horario_modificado' &&
      excepcion.fecha === fechaMinima &&
      excepcion.horaFin !== undefined &&
      excepcion.horaFin !== null &&
      excepcion.horaFin <= horaActual
    ) {
      throw new Error('El horario modificado debe terminar después de la hora actual');
    }

    const aplicaTodasLasSedes = excepcion.aplicaTodasLasSedes ?? false;
    const sedesNormalizadas = aplicaTodasLasSedes
      ? []
      : Array.from(
          new Set(
            (excepcion.sedes ?? []).map((sede) => {
              const sedeNormalizada = normalizarTextoComparacion(sede);
              const sedeReal = sedesValidas.get(sedeNormalizada);
              if (!sedeReal) {
                throw new Error(`La sede ${sede} no pertenece a este salón`);
              }
              return sedeReal;
            }),
          ),
        );

    const llave = aplicaTodasLasSedes
      ? `${excepcion.fecha}|todas`
      : `${excepcion.fecha}|${sedesNormalizadas.map(normalizarTextoComparacion).sort().join(',')}`;
    const activa = excepcion.activa ?? true;

    if (activa) {
      if (llavesActivas.has(llave)) {
        throw new Error('No puedes registrar dos excepciones activas para la misma fecha y sedes');
      }
      llavesActivas.add(llave);
    }

    const marcaTiempo = new Date().toISOString();

    return {
      id: idNormalizado || crypto.randomUUID(),
      fecha: excepcion.fecha,
      tipo: excepcion.tipo,
      horaInicio: excepcion.tipo === 'horario_modificado' ? excepcion.horaInicio ?? null : null,
      horaFin: excepcion.tipo === 'horario_modificado' ? excepcion.horaFin ?? null : null,
      aplicaTodasLasSedes,
      sedes: sedesNormalizadas,
      motivo: excepcion.motivo ?? null,
      activa,
      creadoEn: excepcion.creadoEn?.trim() || marcaTiempo,
      actualizadoEn: marcaTiempo,
    };
  }) as Prisma.InputJsonValue;
}