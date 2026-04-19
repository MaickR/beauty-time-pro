import { describe, expect, it } from 'vitest';
import {
  calcularComisionVendedor,
  resolverPorcentajeComisionVendedor,
  resolverPorcentajesComisionVendedor,
  resolverPorcentajeComisionSegunPlan,
  estudioTienePagoPendiente,
  normalizarPorcentajeComision,
} from './comisionVendedorReglas.js';

describe('reglas de comision de vendedor', () => {
  it('usa 10% como base cuando no se informa un porcentaje', () => {
    expect(normalizarPorcentajeComision(undefined)).toBe(10);
    expect(normalizarPorcentajeComision(null)).toBe(10);
    expect(normalizarPorcentajeComision('')).toBe(10);
    expect(normalizarPorcentajeComision('abc')).toBe(10);
  });

  it('usa 10% como valor operativo cuando el dato legado llega en 0', () => {
    expect(resolverPorcentajeComisionVendedor(0)).toBe(10);
    expect(resolverPorcentajeComisionVendedor(undefined)).toBe(10);
    expect(resolverPorcentajeComisionVendedor(15)).toBe(15);
  });

  it('resuelve porcentajes por plan y aplica fallback correcto en PRO', () => {
    expect(
      resolverPorcentajesComisionVendedor({
        porcentajeComision: 12,
        porcentajeComisionPro: 18,
      }),
    ).toEqual({ standard: 12, pro: 18 });

    expect(
      resolverPorcentajesComisionVendedor({
        porcentajeComision: 14,
        porcentajeComisionPro: 0,
      }),
    ).toEqual({ standard: 14, pro: 14 });
  });

  it('elige el porcentaje según el plan del salón', () => {
    const porcentajes = { standard: 11, pro: 19 };
    expect(resolverPorcentajeComisionSegunPlan('STANDARD', porcentajes)).toBe(11);
    expect(resolverPorcentajeComisionSegunPlan('PRO', porcentajes)).toBe(19);
  });

  it('normaliza el porcentaje dentro del rango permitido', () => {
    expect(normalizarPorcentajeComision(-20)).toBe(0);
    expect(normalizarPorcentajeComision(12.6)).toBe(13);
    expect(normalizarPorcentajeComision(150)).toBe(100);
  });

  it('calcula la comision en centavos sin usar flotantes', () => {
    expect(calcularComisionVendedor(259900, 12)).toBe(31188);
    expect(calcularComisionVendedor(0, 15)).toBe(0);
  });

  it('detecta salones con pago pendiente segun fecha y estado operativo', () => {
    expect(
      estudioTienePagoPendiente({
        activo: true,
        estado: 'aprobado',
        fechaVencimiento: '2026-04-10',
        hoy: '2026-04-17',
      }),
    ).toBe(true);

    expect(
      estudioTienePagoPendiente({
        activo: true,
        estado: 'pendiente',
        fechaVencimiento: '2026-04-10',
        hoy: '2026-04-17',
      }),
    ).toBe(false);
  });
});