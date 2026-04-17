import { describe, expect, it } from 'vitest';
import {
  construirNotaServicio,
  obtenerClaveServicioReserva,
  obtenerSeccionDetalleServicio,
} from './detallesServicios';

describe('detallesServicios', () => {
  it('construye una nota resumida para servicios de coloracion', () => {
    const servicio = { name: 'Balayage Premium', category: 'Color' };

    expect(
      construirNotaServicio(servicio, {
        marca: 'Wella',
        tono: 'Beige cenizo 7.1',
      }),
    ).toBe('Marca o línea preferida: Wella. Tono o referencia deseada: Beige cenizo 7.1');
  });

  it('devuelve una seccion generica y omite notas vacias cuando no hay datos', () => {
    const servicio = { name: 'Ritual capilar', category: 'Tratamiento' };
    const seccion = obtenerSeccionDetalleServicio(servicio);

    expect(seccion.campos).toHaveLength(1);
    expect(seccion.campos[0]?.clave).toBe('nota');
    expect(construirNotaServicio(servicio, { nota: '   ' })).toBeNull();
  });

  it('genera una clave estable por servicio para guardar sus detalles', () => {
    expect(obtenerClaveServicioReserva({ name: 'Laminado de Cejas Deluxe' })).toBe(
      'laminado-de-cejas-deluxe',
    );
  });
});