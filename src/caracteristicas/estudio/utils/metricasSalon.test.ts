import { describe, expect, it } from 'vitest';
import {
  construirFilasAcumuladas,
  filtrarCitasDashboard,
  filtrarEspecialistasDashboard,
  filtrarIngresosDashboard,
  obtenerEtiquetaEstadoReserva,
  obtenerEtiquetaPeriodoFinanciero,
  obtenerSegmentoPeriodoFinancieroArchivo,
} from './metricasSalon';

describe('metricasSalon', () => {
  it('filtra citas por termino y estado', () => {
    const resultado = filtrarCitasDashboard(
      [
        {
          id: '1',
          fecha: '2026-04-12',
          hora: '10:00',
          horaFin: '11:00',
          cliente: 'Carla Ruiz',
          telefonoCliente: '5598765432',
          especialista: 'Andrea López',
          especialistaId: 'esp-1',
          servicioPrincipal: 'Balayage',
          servicios: ['Balayage'],
          sucursal: 'Polanco',
          precioEstimado: 350000,
          estado: 'pending',
          observaciones: null,
          creadoEn: '2026-04-12T10:00:00.000Z',
        },
        {
          id: '2',
          fecha: '2026-04-12',
          hora: '12:00',
          horaFin: '13:00',
          cliente: 'Lucía Fernández',
          telefonoCliente: '5544556677',
          especialista: 'Sofía Ramírez',
          especialistaId: 'esp-2',
          servicioPrincipal: 'Lash Lifting',
          servicios: ['Lash Lifting'],
          sucursal: 'Roma',
          precioEstimado: 95000,
          estado: 'confirmed',
          observaciones: null,
          creadoEn: '2026-04-12T12:00:00.000Z',
        },
      ],
      'andrea',
      'pending',
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.cliente).toBe('Carla Ruiz');
  });

  it('filtra ingresos por tipo y busqueda', () => {
    const resultado = filtrarIngresosDashboard(
      [
        {
          id: '1',
          fecha: '2026-04-12',
          hora: '10:00',
          concepto: 'Balayage',
          tipo: 'servicio',
          cliente: 'Carla Ruiz',
          especialista: 'Andrea López',
          especialistaId: 'esp-1',
          sucursal: 'Polanco',
          total: 350000,
        },
        {
          id: '2',
          fecha: '2026-04-12',
          hora: '15:00',
          concepto: 'Shampoo Matizante Pro',
          tipo: 'producto',
          cliente: 'Venta mostrador',
          especialista: 'Andrea López',
          especialistaId: 'esp-1',
          sucursal: 'Polanco',
          total: 42000,
        },
      ],
      'shampoo',
      'producto',
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.tipo).toBe('producto');
  });

  it('construye acumulados progresivos', () => {
    const resultado = construirFilasAcumuladas([
      {
        id: '1',
        fecha: '2026-04-12',
        hora: '10:00',
        concepto: 'Balayage',
        tipo: 'servicio',
        cliente: 'Carla Ruiz',
        especialista: 'Andrea López',
        especialistaId: 'esp-1',
        sucursal: 'Polanco',
        total: 100000,
      },
      {
        id: '2',
        fecha: '2026-04-12',
        hora: '12:00',
        concepto: 'Lash Lifting',
        tipo: 'servicio',
        cliente: 'Lucía Fernández',
        especialista: 'Sofía Ramírez',
        especialistaId: 'esp-2',
        sucursal: 'Roma',
        total: 50000,
      },
    ]);

    expect(resultado[0]?.acumulado).toBe(100000);
    expect(resultado[1]?.acumulado).toBe(150000);
  });

  it('filtra especialistas por nombre y servicio', () => {
    const resultado = filtrarEspecialistasDashboard(
      [
        {
          id: '1',
          nombre: 'Andrea López',
          servicios: ['Balayage', 'Tinte Global'],
          jornada: '10:00 - 20:00',
          descanso: '14:00 - 15:00',
          citasHoy: 3,
          proximaCita: '11:30',
        },
        {
          id: '2',
          nombre: 'Valeria Torres',
          servicios: ['Mani Spa'],
          jornada: '11:00 - 20:00',
          descanso: '15:00 - 16:00',
          citasHoy: 2,
          proximaCita: '13:00',
        },
      ],
      'balayage',
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.nombre).toBe('Andrea López');
  });

  it('traduce estados de reserva', () => {
    expect(obtenerEtiquetaEstadoReserva('pending')).toBe('Pendiente');
    expect(obtenerEtiquetaEstadoReserva('confirmed')).toBe('Confirmada');
    expect(obtenerEtiquetaEstadoReserva('no_show')).toBe('No asistió');
  });

  it('mapea correctamente los periodos financieros para etiqueta y exportación', () => {
    expect(obtenerEtiquetaPeriodoFinanciero('dia')).toBe('Hoy');
    expect(obtenerEtiquetaPeriodoFinanciero('semana')).toBe('Semana');
    expect(obtenerSegmentoPeriodoFinancieroArchivo('semana')).toBe('semana');
  });
});
