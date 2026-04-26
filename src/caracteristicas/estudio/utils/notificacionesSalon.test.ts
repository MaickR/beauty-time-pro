import { describe, expect, it } from 'vitest';
import {
  esTipoNotificacionSalonRelevante,
  filtrarNotificacionesSalonRelevantes,
} from './notificacionesSalon';

describe('notificacionesSalon', () => {
  it('acepta solo tipos relevantes para el panel del salón', () => {
    expect(esTipoNotificacionSalonRelevante('recordatorio_pago')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('cambio_precio_plan')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('reactivacion')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('nueva_reserva')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('reserva_cancelada')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('reserva_reagendada')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('actualizacion_horario')).toBe(true);
    expect(esTipoNotificacionSalonRelevante('promocion_marketing')).toBe(false);
  });

  it('filtra notificaciones no relevantes del payload', () => {
    const resultado = filtrarNotificacionesSalonRelevantes([
      {
        id: '1',
        estudioId: 'est-1',
        tipo: 'recordatorio_pago',
        titulo: 'Pago',
        mensaje: 'Tu corte vence pronto.',
        leida: false,
        creadoEn: '2026-04-01T10:00:00.000Z',
      },
      {
        id: '2',
        estudioId: 'est-1',
        tipo: 'nueva_reserva',
        titulo: 'Nueva cita',
        mensaje: 'Cliente nuevo para mañana.',
        leida: false,
        creadoEn: '2026-04-01T11:00:00.000Z',
      },
      {
        id: '3',
        estudioId: 'est-1',
        tipo: 'reserva_reagendada',
        titulo: 'Reagenda',
        mensaje: 'Cliente movió una cita.',
        leida: false,
        creadoEn: '2026-04-01T11:30:00.000Z',
      },
      {
        id: '4',
        estudioId: 'est-1',
        tipo: 'reactivacion',
        titulo: 'Cuenta reactivada',
        mensaje: 'Tu suscripción ya está activa nuevamente.',
        leida: false,
        creadoEn: '2026-04-01T11:45:00.000Z',
      },
      {
        id: '5',
        estudioId: 'est-1',
        tipo: 'promocion_marketing',
        titulo: 'Marketing',
        mensaje: 'Oferta genérica.',
        leida: false,
        creadoEn: '2026-04-01T12:00:00.000Z',
      },
    ]);

    expect(resultado).toHaveLength(4);
    expect(resultado[0]?.tipo).toBe('recordatorio_pago');
    expect(resultado[1]?.tipo).toBe('nueva_reserva');
    expect(resultado[2]?.tipo).toBe('reserva_reagendada');
    expect(resultado[3]?.tipo).toBe('reactivacion');
  });
});
