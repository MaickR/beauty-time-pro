import { describe, expect, it } from 'vitest';
import { obtenerSlotsDisponiblesBackend } from './programacion';

describe('programacion', () => {
  it('no ofrece un slot que se solapa con una reserva activa del mismo especialista', () => {
    const slots = obtenerSlotsDisponiblesBackend({
      horario: {
        Sábado: {
          isOpen: true,
          openTime: '10:00',
          closeTime: '19:00',
        },
      },
      miembro: {
        horaInicio: '10:00',
        horaFin: '19:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: ['Sábado'],
      },
      fecha: '2026-04-25',
      duracionMin: 240,
      reservas: [
        {
          horaInicio: '15:00',
          duracion: 240,
          estado: 'confirmed',
        },
      ],
      zonaHoraria: 'America/Mexico_City',
    });

    expect(slots).toEqual([
      { hora: '10:00', disponible: true },
      { hora: '10:30', disponible: true },
      { hora: '11:00', disponible: true },
    ]);
  });

  it('bloquea por completo la disponibilidad cuando hay un cierre para la sucursal seleccionada', () => {
    const slots = obtenerSlotsDisponiblesBackend({
      horario: {
        Lunes: {
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
        },
      },
      miembro: {
        horaInicio: '09:00',
        horaFin: '18:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: ['Lunes'],
      },
      fecha: '2026-04-20',
      duracionMin: 60,
      reservas: [],
      sucursal: 'Sucursal Centro',
      excepcionesDisponibilidad: [
        {
          id: 'exc-1',
          fecha: '2026-04-20',
          tipo: 'cerrado',
          aplicaTodasLasSedes: false,
          sedes: ['Sucursal Centro'],
          activa: true,
        },
      ],
      zonaHoraria: 'America/Mexico_City',
    });

    expect(slots).toEqual([]);
  });

  it('ajusta la jornada con horario modificado para la sucursal seleccionada', () => {
    const slots = obtenerSlotsDisponiblesBackend({
      horario: {
        Martes: {
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
        },
      },
      miembro: {
        horaInicio: '09:00',
        horaFin: '18:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: ['Martes'],
      },
      fecha: '2026-04-21',
      duracionMin: 60,
      reservas: [],
      sucursal: 'Sucursal Norte',
      excepcionesDisponibilidad: [
        {
          id: 'exc-2',
          fecha: '2026-04-21',
          tipo: 'horario_modificado',
          horaInicio: '12:00',
          horaFin: '15:00',
          aplicaTodasLasSedes: false,
          sedes: ['Sucursal Norte'],
          activa: true,
        },
      ],
      zonaHoraria: 'America/Mexico_City',
    });

    expect(slots).toEqual([
      { hora: '12:00', disponible: true },
      { hora: '12:30', disponible: true },
      { hora: '13:00', disponible: true },
      { hora: '13:30', disponible: true },
      { hora: '14:00', disponible: true },
    ]);
  });

  it('no aplica una excepción de otra sucursal', () => {
    const slots = obtenerSlotsDisponiblesBackend({
      horario: {
        Miércoles: {
          isOpen: true,
          openTime: '10:00',
          closeTime: '13:00',
        },
      },
      miembro: {
        horaInicio: '10:00',
        horaFin: '13:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: ['Miércoles'],
      },
      fecha: '2026-04-22',
      duracionMin: 60,
      reservas: [],
      sucursal: 'Sucursal Sur',
      excepcionesDisponibilidad: [
        {
          id: 'exc-3',
          fecha: '2026-04-22',
          tipo: 'cerrado',
          aplicaTodasLasSedes: false,
          sedes: ['Sucursal Centro'],
          activa: true,
        },
      ],
      zonaHoraria: 'America/Mexico_City',
    });

    expect(slots).toEqual([
      { hora: '10:00', disponible: true },
      { hora: '10:30', disponible: true },
      { hora: '11:00', disponible: true },
      { hora: '11:30', disponible: true },
      { hora: '12:00', disponible: true },
    ]);
  });
});