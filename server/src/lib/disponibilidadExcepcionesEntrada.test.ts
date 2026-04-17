import { describe, expect, it } from 'vitest';
import { normalizarExcepcionesDisponibilidadEntrada } from './disponibilidadExcepcionesEntrada';

describe('normalizarExcepcionesDisponibilidadEntrada', () => {
  it('permite desactivar una excepción histórica ya persistida', () => {
    const resultado = normalizarExcepcionesDisponibilidadEntrada({
      excepciones: [
        {
          id: 'exc-historica',
          fecha: '2026-04-10',
          tipo: 'cerrado',
          aplicaTodasLasSedes: true,
          sedes: [],
          activa: false,
          creadoEn: '2026-04-01T10:00:00.000Z',
        },
      ],
      excepcionesExistentes: [
        {
          id: 'exc-historica',
          fecha: '2026-04-10',
          tipo: 'cerrado',
          horaInicio: null,
          horaFin: null,
          aplicaTodasLasSedes: true,
          sedes: [],
          motivo: 'Cierre anterior',
          activa: true,
          creadoEn: '2026-04-01T10:00:00.000Z',
          actualizadoEn: '2026-04-01T10:00:00.000Z',
        },
      ],
      fechaMinima: '2026-04-16',
      horaActual: '12:00',
      sedesDisponibles: ['Sala Principal'],
    });

    expect(resultado).toEqual([
      expect.objectContaining({
        id: 'exc-historica',
        fecha: '2026-04-10',
        activa: false,
      }),
    ]);
  });

  it('rechaza crear una excepción nueva en una fecha pasada', () => {
    expect(() =>
      normalizarExcepcionesDisponibilidadEntrada({
        excepciones: [
          {
            id: 'exc-nueva',
            fecha: '2026-04-10',
            tipo: 'cerrado',
            aplicaTodasLasSedes: true,
            sedes: [],
            activa: true,
          },
        ],
        excepcionesExistentes: [],
        fechaMinima: '2026-04-16',
        horaActual: '12:00',
        sedesDisponibles: ['Sala Principal'],
      }),
    ).toThrow('No puedes registrar excepciones en fechas pasadas');
  });
});