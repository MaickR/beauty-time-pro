import { describe, expect, it } from 'vitest';
import {
  normalizarProductosAdicionalesReserva,
  obtenerIdsProductosReserva,
  resolverSucursalReserva,
} from './reservasPublicas';

describe('reservasPublicas', () => {
  it('fija la sucursal al nombre del salon actual', () => {
    expect(resolverSucursalReserva('  Salon Roma Norte  ')).toBe('Salon Roma Norte');
  });

  it('deduplica ids de productos seleccionados', () => {
    expect(
      obtenerIdsProductosReserva([
        { productoId: 'prod-1', cantidad: 1 },
        { productoId: ' prod-1 ', cantidad: 2 },
        { productoId: 'prod-2', cantidad: 1 },
      ]),
    ).toEqual(['prod-1', 'prod-2']);
  });

  it('normaliza productos adicionales cuando el salon es PRO', () => {
    expect(
      normalizarProductosAdicionalesReserva({
        planEstudio: 'PRO',
        productosSeleccionados: [
          { productoId: 'prod-1', cantidad: 2 },
          { productoId: 'prod-2', cantidad: 1 },
        ],
        productosCatalogo: [
          { id: 'prod-1', nombre: 'Ampolleta', categoria: 'Tratamiento', precio: 1500 },
          { id: 'prod-2', nombre: 'Shampoo', categoria: 'Retail', precio: 2200 },
        ],
      }),
    ).toEqual([
      {
        id: 'prod-1',
        nombre: 'Ampolleta',
        categoria: 'Tratamiento',
        cantidad: 2,
        precioUnitario: 1500,
        total: 3000,
      },
      {
        id: 'prod-2',
        nombre: 'Shampoo',
        categoria: 'Retail',
        cantidad: 1,
        precioUnitario: 2200,
        total: 2200,
      },
    ]);
  });

  it('rechaza productos adicionales si el plan no es PRO', () => {
    expect(() =>
      normalizarProductosAdicionalesReserva({
        planEstudio: 'STARTER',
        productosSeleccionados: [{ productoId: 'prod-1', cantidad: 1 }],
        productosCatalogo: [{ id: 'prod-1', nombre: 'Ampolleta', categoria: null, precio: 1500 }],
      }),
    ).toThrowError('PLAN_SIN_PRODUCTOS');
  });

  it('rechaza productos que ya no existen en catalogo', () => {
    expect(() =>
      normalizarProductosAdicionalesReserva({
        planEstudio: 'PRO',
        productosSeleccionados: [{ productoId: 'prod-faltante', cantidad: 1 }],
        productosCatalogo: [],
      }),
    ).toThrowError('PRODUCTO_NO_DISPONIBLE');
  });
});