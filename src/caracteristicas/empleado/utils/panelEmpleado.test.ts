import { describe, expect, it } from 'vitest';
import {
  combinarReservasEmpleado,
  filtrarReservasDesdeAlta,
  limitarFechaSeleccionEmpleado,
  obtenerFechaAltaEmpleado,
  obtenerReservasHistorialEmpleado,
  obtenerReservasPeriodoEmpleado,
} from './panelEmpleado';
import type { ReservaEmpleado } from '../../../tipos';

const reservasBase: ReservaEmpleado[] = [
  {
    id: 'res-1',
    fecha: '2026-04-01',
    horaInicio: '09:00',
    duracion: 60,
    estado: 'confirmed',
    servicios: [{ name: 'Corte', duration: 60, price: 50000 }],
    precioTotal: 50000,
    nombreCliente: 'Ana',
    telefonoCliente: '3000000000',
    clienteAppId: null,
    sucursal: 'Sala 1',
  },
  {
    id: 'res-2',
    fecha: '2026-04-17',
    horaInicio: '10:00',
    duracion: 60,
    estado: 'confirmed',
    servicios: [{ name: 'Color', duration: 60, price: 80000 }],
    precioTotal: 80000,
    nombreCliente: 'Bea',
    telefonoCliente: '3000000001',
    clienteAppId: null,
    sucursal: 'Sala 1',
  },
  {
    id: 'res-3',
    fecha: '2026-04-20',
    horaInicio: '15:00',
    duracion: 30,
    estado: 'working',
    servicios: [{ name: 'Ceja', duration: 30, price: 40000 }],
    precioTotal: 40000,
    nombreCliente: 'Cata',
    telefonoCliente: '3000000002',
    clienteAppId: null,
    sucursal: 'Sala 1',
  },
  {
    id: 'res-4',
    fecha: '2026-04-21',
    horaInicio: '11:00',
    duracion: 30,
    estado: 'cancelled',
    servicios: [{ name: 'Spa', duration: 30, price: 20000 }],
    precioTotal: 20000,
    nombreCliente: 'Dani',
    telefonoCliente: '3000000003',
    clienteAppId: null,
    sucursal: 'Sala 1',
  },
];

describe('panelEmpleado', () => {
  it('normaliza la fecha de alta del empleado', () => {
    expect(obtenerFechaAltaEmpleado('2026-04-16T19:53:54.996Z')).toBe('2026-04-16');
  });

  it('filtra reservas anteriores a la fecha de alta', () => {
    expect(filtrarReservasDesdeAlta(reservasBase, '2026-04-16').map((reserva) => reserva.id)).toEqual([
      'res-2',
      'res-3',
      'res-4',
    ]);
  });

  it('calcula reservas por periodo ignorando canceladas y previas al alta', () => {
    expect(
      obtenerReservasPeriodoEmpleado({
        reservas: reservasBase,
        periodo: 'semana',
        fechaReferencia: '2026-04-20',
        fechaAltaEmpleado: '2026-04-16',
      }).map((reserva) => reserva.id),
    ).toEqual(['res-3']);
  });

  it('calcula historial diario, semanal y mensual del empleado', () => {
    expect(
      obtenerReservasHistorialEmpleado({
        reservas: reservasBase,
        modo: 'dia',
        fechaBase: '2026-04-17',
        fechaActual: '2026-04-21',
        fechaAltaEmpleado: '2026-04-16',
      }).map((reserva) => reserva.id),
    ).toEqual(['res-2']);

    expect(
      obtenerReservasHistorialEmpleado({
        reservas: reservasBase,
        modo: 'mes',
        fechaBase: '2026-04-20',
        fechaActual: '2026-04-21',
        fechaAltaEmpleado: '2026-04-16',
      }).map((reserva) => reserva.id),
    ).toEqual(['res-3', 'res-2']);
  });

  it('combina reservas sin duplicados y limita la fecha seleccionada', () => {
    expect(
      combinarReservasEmpleado(reservasBase.slice(0, 2), reservasBase.slice(1, 3)).map(
        (reserva) => reserva.id,
      ),
    ).toEqual(['res-1', 'res-2', 'res-3']);
    expect(limitarFechaSeleccionEmpleado('2026-04-01', '2026-04-16')).toBe('2026-04-16');
  });
});