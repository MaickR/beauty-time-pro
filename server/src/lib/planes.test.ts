import { describe, expect, it } from 'vitest';
import {
  LIMITE_EMPLEADOS_STANDARD,
  LIMITE_MENSAJES_MASIVOS_BASE_ANUAL,
  obtenerDefinicionPlan,
  obtenerLimiteMensajesMasivosAnual,
  obtenerMensajeRestriccionPlan,
  planPermiteFuncion,
  validarCantidadEmpleadosActivosPlan,
  validarReglasSucursalesPorPlan,
} from './planes.js';

describe('lib/planes backend', () => {
  it('expone capacidades correctas por plan', () => {
    const planStandard = obtenerDefinicionPlan('STANDARD');
    const planPro = obtenerDefinicionPlan('PRO');

    expect(planStandard.fidelidad).toBe(false);
    expect(planStandard.productos).toBe(false);
    expect(planStandard.sucursales).toBe(false);
    expect(planPro.fidelidad).toBe(true);
    expect(planPro.productos).toBe(true);
    expect(planPro.sucursales).toBe(true);
  });

  it('resuelve permisos de funciones sin hardcode por endpoint', () => {
    expect(planPermiteFuncion({ plan: 'STANDARD', funcion: 'fidelidad' })).toBe(false);
    expect(planPermiteFuncion({ plan: 'STANDARD', funcion: 'productos' })).toBe(false);
    expect(planPermiteFuncion({ plan: 'PRO', funcion: 'mensajesMasivos' })).toBe(true);
  });

  it('calcula el límite anual de mensajes masivos con extras', () => {
    expect(
      obtenerLimiteMensajesMasivosAnual({
        plan: 'STANDARD',
        extrasAprobados: 10,
      }),
    ).toBe(10);

    expect(
      obtenerLimiteMensajesMasivosAnual({
        plan: 'PRO',
        extrasAprobados: 2,
      }),
    ).toBe(LIMITE_MENSAJES_MASIVOS_BASE_ANUAL + 2);
  });

  it('bloquea sucursales para standard y permite en pro', () => {
    expect(
      validarReglasSucursalesPorPlan({
        plan: 'STANDARD',
        estudioPrincipalId: 'estudio-principal-1',
        sucursales: [],
      }),
    ).toBe(obtenerMensajeRestriccionPlan('sucursales'));

    expect(
      validarReglasSucursalesPorPlan({
        plan: 'STANDARD',
        estudioPrincipalId: null,
        sucursales: ['Norte'],
      }),
    ).toBe(obtenerMensajeRestriccionPlan('sucursales'));

    expect(
      validarReglasSucursalesPorPlan({
        plan: 'PRO',
        estudioPrincipalId: 'estudio-principal-1',
        sucursales: ['Norte'],
      }),
    ).toBeNull();
  });

  it('aplica el límite de empleados activos por plan', () => {
    expect(
      validarCantidadEmpleadosActivosPlan({
        plan: 'STANDARD',
        cantidadNueva: LIMITE_EMPLEADOS_STANDARD,
      }),
    ).toBeNull();

    expect(
      validarCantidadEmpleadosActivosPlan({
        plan: 'STANDARD',
        cantidadNueva: LIMITE_EMPLEADOS_STANDARD + 1,
      }),
    ).toBe('Tu plan Standard permite máximo 5 empleados activos.');

    expect(
      validarCantidadEmpleadosActivosPlan({
        plan: 'STANDARD',
        cantidadActual: 8,
        cantidadNueva: 7,
      }),
    ).toBeNull();

    expect(
      validarCantidadEmpleadosActivosPlan({
        plan: 'PRO',
        cantidadNueva: 999,
      }),
    ).toBeNull();
  });
});
