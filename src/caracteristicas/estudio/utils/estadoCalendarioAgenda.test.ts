import { describe, expect, it } from 'vitest';
import {
  normalizarFechaReservaAgenda,
  obtenerPestanaAgendaPorFecha,
  obtenerEstadoCalendarioAgenda,
  obtenerReservasActivasDelDiaAgenda,
  obtenerReservasDelDiaAgenda,
  obtenerReservasHistorialAgenda,
} from './estadoCalendarioAgenda';
import type { Estudio, Reserva } from '../../../tipos';

const estudioBase: Estudio = {
  id: 'est-1',
  slug: 'salon-prueba',
  name: 'Salon Prueba',
  owner: 'Dueño',
  phone: '5512345678',
  country: 'Mexico',
  plan: 'STANDARD',
  branches: ['Principal'],
  assignedKey: 'ADM123',
  clientKey: 'CLI123',
  subscriptionStart: '2026-01-01',
  paidUntil: '2026-12-31',
  holidays: ['2026-04-21'],
  schedule: {
    Domingo: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
    Lunes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    Martes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    Miércoles: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    Jueves: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    Viernes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    Sábado: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
  },
  selectedServices: [],
  customServices: [],
  staff: [
    {
      id: 'per-1',
      name: 'Andrea',
      specialties: ['Balayage'],
      active: true,
      shiftStart: '09:00',
      shiftEnd: '18:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      workingDays: [1, 3, 5],
    },
  ],
  availabilityExceptions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const reservasBase: Reserva[] = [
  {
    id: 'res-1',
    studioId: 'est-1',
    studioName: 'Salon Prueba',
    clientName: 'Cliente Uno',
    clientPhone: '5511111111',
    services: [{ name: 'Balayage', duration: 120, price: 350000 }],
    totalDuration: 120,
    totalPrice: 350000,
    status: 'confirmed',
    branch: 'Principal',
    staffId: 'per-1',
    staffName: 'Andrea',
    date: '2026-04-22',
    time: '10:00',
    colorBrand: null,
    colorNumber: null,
    createdAt: '2026-04-15T10:00:00.000Z',
  },
];

describe('estadoCalendarioAgenda', () => {
  it('cambia a historial solo para fechas anteriores a hoy y vuelve a agenda en fechas vigentes', () => {
    expect(obtenerPestanaAgendaPorFecha('2026-04-14', '2026-04-15')).toBe('historial');
    expect(obtenerPestanaAgendaPorFecha('2026-04-15', '2026-04-15')).toBe('agenda');
    expect(obtenerPestanaAgendaPorFecha('2026-04-16', '2026-04-15')).toBe('agenda');
  });

  it('normaliza fechas ISO completas sin perder el dia operativo', () => {
    expect(normalizarFechaReservaAgenda('2026-04-22T18:30:00.000Z')).toBe('2026-04-22');
  });

  it('obtiene las reservas del dia aunque lleguen con formato datetime', () => {
    const reservas = [
      ...reservasBase,
      {
        ...reservasBase[0],
        id: 'res-2',
        date: '2026-04-22T15:45:00.000Z',
      },
    ];

    expect(obtenerReservasDelDiaAgenda(reservas, '2026-04-22')).toHaveLength(2);
  });

  it('marca citas solo con reservas activas visibles en agenda', () => {
    const reservas: Reserva[] = [
      {
        ...reservasBase[0],
        id: 'res-cancelada',
        status: 'cancelled',
        date: '2026-04-23',
      },
      {
        ...reservasBase[0],
        id: 'res-completada',
        status: 'completed',
        date: '2026-04-23',
      },
    ];

    expect(obtenerReservasActivasDelDiaAgenda(reservas, '2026-04-23')).toHaveLength(0);
  });

  it('calcula historial por rango con citas reales y ordenadas por fecha', () => {
    const reservas: Reserva[] = [
      {
        ...reservasBase[0],
        id: 'res-enero',
        date: '2026-01-06',
        status: 'completed',
      },
      {
        ...reservasBase[0],
        id: 'res-abril',
        date: '2026-04-15',
        status: 'pending',
      },
      {
        ...reservasBase[0],
        id: 'res-fuera-rango',
        date: '2026-04-16',
        status: 'confirmed',
      },
    ];

    const historial = obtenerReservasHistorialAgenda({
      reservas,
      estudioId: 'est-1',
      modo: 'rango',
      fechaHistorial: '2026-04-15',
      rangoInicio: '2026-01-06',
      rangoFin: '2026-04-15',
      mesHistorial: '2026-04',
      fechaActual: '2026-04-16',
    });

    expect(historial.map((reserva) => reserva.id)).toEqual(['res-abril', 'res-enero']);
  });

  it('excluye fechas de hoy o futuras del historial por rango', () => {
    const reservas: Reserva[] = [
      {
        ...reservasBase[0],
        id: 'res-pasada',
        date: '2026-04-14',
        status: 'completed',
      },
      {
        ...reservasBase[0],
        id: 'res-hoy',
        date: '2026-04-15',
        status: 'completed',
      },
      {
        ...reservasBase[0],
        id: 'res-futura',
        date: '2026-04-16',
        status: 'confirmed',
      },
    ];

    const historial = obtenerReservasHistorialAgenda({
      reservas,
      estudioId: 'est-1',
      modo: 'rango',
      fechaHistorial: '2026-04-14',
      rangoInicio: '2026-04-01',
      rangoFin: '2026-04-30',
      mesHistorial: '2026-04',
      fechaActual: '2026-04-15',
    });

    expect(historial.map((reserva) => reserva.id)).toEqual(['res-pasada']);
  });

  it('filtra mes completo solo dentro del mes seleccionado', () => {
    const reservas: Reserva[] = [
      {
        ...reservasBase[0],
        id: 'res-marzo',
        date: '2026-03-20',
        status: 'completed',
      },
      {
        ...reservasBase[0],
        id: 'res-abril',
        date: '2026-04-10',
        status: 'completed',
      },
    ];

    const historial = obtenerReservasHistorialAgenda({
      reservas,
      estudioId: 'est-1',
      modo: 'mes',
      fechaHistorial: '2026-03-20',
      rangoInicio: '',
      rangoFin: '',
      mesHistorial: '2026-03',
      fechaActual: '2026-04-15',
    });

    expect(historial.map((reserva) => reserva.id)).toEqual(['res-marzo']);
  });

  it('marca citas solo cuando realmente existen reservas en la fecha', () => {
    const estado = obtenerEstadoCalendarioAgenda({
      fecha: new Date('2026-04-22T12:00:00'),
      estudio: estudioBase,
      reservas: [
        ...reservasBase,
        {
          ...reservasBase[0],
          id: 'res-3',
          status: 'cancelled',
          date: '2026-04-22T09:00:00.000Z',
        },
      ],
    });

    expect(estado.tieneCitas).toBe(true);
    expect(estado.totalCitas).toBe(1);
    expect(estado.esCierre).toBe(false);
    expect(estado.tieneHorarioModificado).toBe(false);
  });

  it('marca cierre solo en festivos o dias realmente cerrados', () => {
    const estado = obtenerEstadoCalendarioAgenda({
      fecha: new Date('2026-04-21T12:00:00'),
      estudio: estudioBase,
      reservas: reservasBase,
    });

    expect(estado.esCierre).toBe(true);
    expect(estado.esFestivo).toBe(true);
    expect(estado.tieneHorarioModificado).toBe(false);
    expect(estado.tituloDetalle).toBe('Día cerrado');
  });

  it('marca horario modificado solo cuando el horario del salon cambia de verdad', () => {
    const estado = obtenerEstadoCalendarioAgenda({
      fecha: new Date('2026-04-25T12:00:00'),
      estudio: estudioBase,
      reservas: reservasBase,
    });

    expect(estado.esCierre).toBe(false);
    expect(estado.tieneHorarioModificado).toBe(true);
    expect(estado.tituloDetalle).toBe('Horario modificado');
  });

  it('no marca horario modificado por diferencias normales de dias del personal', () => {
    const estado = obtenerEstadoCalendarioAgenda({
      fecha: new Date('2026-04-14T12:00:00'),
      estudio: estudioBase,
      reservas: reservasBase,
    });

    expect(estado.esCierre).toBe(false);
    expect(estado.tieneHorarioModificado).toBe(false);
  });

  it('marca cierre cuando existe una excepción activa del día', () => {
    const estado = obtenerEstadoCalendarioAgenda({
      fecha: new Date('2026-04-24T12:00:00'),
      estudio: {
        ...estudioBase,
        availabilityExceptions: [
          {
            id: 'exc-cierre',
            fecha: '2026-04-24',
            tipo: 'cerrado',
            horaInicio: null,
            horaFin: null,
            aplicaTodasLasSedes: true,
            sedes: [],
            motivo: 'Mantenimiento general',
            activa: true,
            creadoEn: null,
            actualizadoEn: null,
          },
        ],
      },
      reservas: reservasBase,
    });

    expect(estado.esCierre).toBe(true);
    expect(estado.tieneHorarioModificado).toBe(false);
    expect(estado.descripcionDetalle).toMatch(/permanecerá cerrado/i);
  });
});
