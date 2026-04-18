import { describe, expect, it } from 'vitest';
import { obtenerDefinicionPlan } from './planes';

describe('lib/planes frontend', () => {
  it('mantiene restricciones comerciales del plan standard sin contradecir backend', () => {
    const standard = obtenerDefinicionPlan('STANDARD');

    expect(standard.fidelidad).toBe(false);
    expect(standard.productos).toBe(false);
    expect(standard.ventasProductos).toBe(false);
    expect(standard.sucursales).toBe(false);
    expect(standard.mensajesMasivos).toBe(false);
    expect(
      standard.restricciones.some((texto) =>
        texto.includes('Máximo de 5 empleados activos por salón.'),
      ),
    ).toBe(true);
  });

  it('expone capacidades completas del plan pro con límite anual de mensajes', () => {
    const pro = obtenerDefinicionPlan('PRO');

    expect(pro.fidelidad).toBe(true);
    expect(pro.productos).toBe(true);
    expect(pro.ventasProductos).toBe(true);
    expect(pro.sucursales).toBe(true);
    expect(pro.mensajesMasivos).toBe(true);
    expect(pro.limiteMensajesMasivosAnualBase).toBe(3);
    expect(
      pro.capacidades.some((texto) =>
        texto.includes('Mensajes masivos (3 por año + extras aprobados).'),
      ),
    ).toBe(true);
  });
});
