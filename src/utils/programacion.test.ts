import { describe, it, expect, vi, afterEach } from 'vitest';
import { obtenerSlotsDisponibles } from './programacion';
import type { TurnoTrabajo } from '../tipos/index';

const horarioBase: TurnoTrabajo = { isOpen: true, openTime: '09:00', closeTime: '17:00' };
const sinTurnoNiDescanso = {};
const conDescansoMediodia = { breakStart: '13:00', breakEnd: '14:00' };

describe('obtenerSlotsDisponibles', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna disponible cuando no hay reservas', () => {
    // filtrarDemasiadoCortos=true excluye los últimos slots que no caben (comportamiento real de cliente)
    const slots = obtenerSlotsDisponibles({
      horarioDia: horarioBase,
      miembro: sinTurnoNiDescanso,
      reservasExistentes: [],
      duracionSlot: 60,
      fechaStr: '2026-03-15',
      filtrarDemasiadoCortos: true,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.status === 'AVAILABLE')).toBe(true);
  });

  it('bloquea el slot cuando ya existe una reserva', () => {
    const slots = obtenerSlotsDisponibles({
      horarioDia: horarioBase,
      miembro: sinTurnoNiDescanso,
      reservasExistentes: [{ time: '10:00', totalDuration: 60, status: 'pending' }],
      duracionSlot: 60,
      fechaStr: '2026-03-15',
    });

    const slotDiezAM = slots.find((s) => s.time === '10:00');
    expect(slotDiezAM?.status).toBe('OCCUPIED');
  });

  it('retorna descanso cuando el slot cae en horario de descanso', () => {
    const slots = obtenerSlotsDisponibles({
      horarioDia: horarioBase,
      miembro: conDescansoMediodia,
      reservasExistentes: [],
      duracionSlot: 30,
      fechaStr: '2026-03-15',
    });

    const slotDescanso = slots.find((s) => s.time === '13:00');
    expect(slotDescanso?.status).toBe('BREAK_TIME');
  });

  it('retorna muy corto cuando el slot no cabe antes del cierre del turno', () => {
    // Ventana de solo 60 min (09:00-10:00), servicio de 90 min no cabe
    const slots = obtenerSlotsDisponibles({
      horarioDia: { isOpen: true, openTime: '09:00', closeTime: '10:00' },
      miembro: sinTurnoNiDescanso,
      reservasExistentes: [],
      duracionSlot: 90,
      fechaStr: '2026-03-15',
      filtrarDemasiadoCortos: false,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.status === 'TOO_SHORT')).toBe(true);
  });

  it('filtra slots pasados cuando es el día de hoy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00'));

    const slots = obtenerSlotsDisponibles({
      horarioDia: horarioBase,
      miembro: sinTurnoNiDescanso,
      reservasExistentes: [],
      duracionSlot: 30,
      fechaStr: '2026-03-10',
      filtrarPasados: true,
    });

    // Slots a las 09:00, 09:30 y 10:00 son iguales o anteriores a la hora actual (10:00 = 600 min)
    expect(slots.find((s) => s.time === '09:00')).toBeUndefined();
    expect(slots.find((s) => s.time === '09:30')).toBeUndefined();
    expect(slots.find((s) => s.time === '10:00')).toBeUndefined();

    // El slot a las 10:30 debe estar disponible
    expect(slots.find((s) => s.time === '10:30')).toBeDefined();
  });
});
