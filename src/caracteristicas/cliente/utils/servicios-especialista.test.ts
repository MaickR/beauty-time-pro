import { describe, expect, it } from 'vitest';
import { obtenerServiciosPorEspecialista } from './servicios-especialista';
import type { SalonDetalle } from '../../../tipos';

function crearSalonDetalle(): SalonDetalle {
  return {
    id: 'salon-1',
    nombre: 'Atelier Norte',
    descripcion: null,
    slug: 'atelier-norte',
    direccion: 'Calle 10',
    telefono: '5511111111',
    emailContacto: 'hola@atelier.com',
    horarioApertura: '09:00',
    horarioCierre: '19:00',
    diasAtencion: 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado',
    colorPrimario: '#0f172a',
    logoUrl: null,
    estado: 'activo',
    pais: 'Mexico',
    plan: 'PRO',
    claveCliente: 'ATELIER-1',
    metodosPagoReserva: ['cash'],
    personal: [
      {
        id: 'esp-1',
        nombre: 'Laura',
        especialidades: ['Corte', 'Peinado'],
        horaInicio: '09:00',
        horaFin: '18:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: [1, 2, 3, 4, 5],
      },
      {
        id: 'esp-2',
        nombre: 'Mara',
        especialidades: ['Color'],
        horaInicio: '10:00',
        horaFin: '19:00',
        descansoInicio: null,
        descansoFin: null,
        diasTrabajo: [2, 3, 4, 5, 6],
      },
    ],
    servicios: [
      { name: 'Corte', duration: 60, price: 500, category: 'Cabello' },
      { name: 'Peinado', duration: 45, price: 350, category: 'Cabello' },
      { name: 'Color', duration: 90, price: 1200, category: 'Color' },
    ],
    productos: [],
    festivos: [],
    horario: {
      Domingo: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
      Lunes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Martes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Miércoles: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Jueves: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Viernes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Sábado: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    },
    categorias: null,
  } as SalonDetalle;
}

describe('obtenerServiciosPorEspecialista', () => {
  it('devuelve solo los servicios asociados al especialista seleccionado', () => {
    const salon = crearSalonDetalle();

    expect(
      obtenerServiciosPorEspecialista(salon, 'esp-1').map((servicio) => servicio.name),
    ).toEqual(['Corte', 'Peinado']);
    expect(
      obtenerServiciosPorEspecialista(salon, 'esp-2').map((servicio) => servicio.name),
    ).toEqual(['Color']);
  });

  it('mantiene el catálogo completo cuando todavía no hay especialista seleccionado', () => {
    const salon = crearSalonDetalle();

    expect(obtenerServiciosPorEspecialista(salon).map((servicio) => servicio.name)).toEqual([
      'Corte',
      'Peinado',
      'Color',
    ]);
  });
});
