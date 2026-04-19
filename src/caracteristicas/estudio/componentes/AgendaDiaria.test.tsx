import '@testing-library/jest-dom/vitest';
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaDiaria } from './AgendaDiaria';
import { renderConProveedores } from '../../../test/renderConProveedores';
import type { Estudio, Reserva } from '../../../tipos';

vi.mock('../../../contextos/ContextoApp', () => ({
  usarContextoApp: () => ({
    recargar: vi.fn(),
    estudios: [],
    reservas: [],
    pagos: [],
    cargando: false,
  }),
}));

vi.mock('../../../servicios/servicioReservas', () => ({
  actualizarEstadoReserva: vi.fn(),
  actualizarEstadoServicioReserva: vi.fn(),
  agregarServicioAReserva: vi.fn(),
  agregarProductoAReserva: vi.fn(),
}));

vi.mock('../../../servicios/servicioProductos', () => ({
  obtenerProductos: vi.fn().mockResolvedValue([]),
}));

function crearEstudioPrueba(): Estudio {
  return {
    id: 'estudio-1',
    slug: 'mikelov-studio',
    name: 'MIKELOV STUDIO',
    owner: 'Miguel',
    phone: '5512345678',
    country: 'Mexico',
    plan: 'PRO',
    branches: ['Principal'],
    assignedKey: 'MIKELOV123',
    clientKey: 'MIKELOVSTUDIO',
    subscriptionStart: '2026-01-01',
    paidUntil: '2026-12-31',
    holidays: [],
    schedule: {
      Domingo: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
      Lunes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Martes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Miércoles: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Jueves: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Viernes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Sábado: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    },
    selectedServices: [{ name: 'Balayage', duration: 90, price: 180000 }],
    customServices: [],
    staff: [
      {
        id: 'staff-1',
        name: 'Andrea López',
        specialties: ['Balayage'],
        active: true,
        shiftStart: '09:00',
        shiftEnd: '18:00',
        breakStart: '14:00',
        breakEnd: '15:00',
        workingDays: [1, 2, 3, 4, 5, 6],
        commissionBasePercentage: 0,
        serviceCommissionPercentages: {},
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function crearReservaPrueba(fecha: string): Reserva {
  return {
    id: `reserva-${fecha}`,
    studioId: 'estudio-1',
    studioName: 'MIKELOV STUDIO',
    clientName: 'Carla Ruiz',
    clientPhone: '5511223344',
    services: [{ name: 'Balayage', duration: 90, price: 180000 }],
    totalDuration: 90,
    totalPrice: 180000,
    status: 'confirmed',
    branch: 'Principal',
    staffId: 'staff-1',
    staffName: 'Andrea López',
    date: fecha,
    time: '10:00',
    colorBrand: null,
    colorNumber: null,
    createdAt: `${fecha}T09:00:00.000Z`,
  };
}

describe('AgendaDiaria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cambia a historial en fechas pasadas y vuelve a agenda en fechas vigentes', async () => {
    const estudio = crearEstudioPrueba();
    const { rerender } = renderConProveedores(
      <AgendaDiaria
        estudio={estudio}
        reservas={[crearReservaPrueba('2026-04-14'), crearReservaPrueba('2026-04-15')]}
        fechaVista={new Date(2026, 3, 14)}
        onCrearCitaManual={() => undefined}
      />,
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('Selecciona una fecha pasada')).toBeInTheDocument();
    expect(screen.queryByText('Crear cita manual')).not.toBeInTheDocument();

    rerender(
      <AgendaDiaria
        estudio={estudio}
        reservas={[crearReservaPrueba('2026-04-14'), crearReservaPrueba('2026-04-15')]}
        fechaVista={new Date(2026, 3, 15)}
        onCrearCitaManual={() => undefined}
      />,
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('Crear cita manual')).toBeInTheDocument();
    expect(screen.queryByText('Selecciona una fecha pasada')).not.toBeInTheDocument();
  });
});
