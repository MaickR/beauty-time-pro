import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GestorFestivos } from './GestorFestivos';
import { renderConProveedores } from '../../../test/renderConProveedores';
import type { Estudio } from '../../../tipos';

const { actualizarExcepcionesDisponibilidad, recargar } = vi.hoisted(() => ({
  actualizarExcepcionesDisponibilidad: vi.fn().mockResolvedValue(undefined),
  recargar: vi.fn(),
}));

vi.mock('../../../servicios/servicioEstudios', () => ({
  actualizarExcepcionesDisponibilidad,
}));

vi.mock('../../../contextos/ContextoApp', () => ({
  usarContextoApp: () => ({
    recargar,
  }),
}));

function crearEstudioPrueba(): Estudio {
  return {
    id: 'estudio-1',
    slug: 'sala-principal',
    name: 'Sala Principal',
    owner: 'Ana Gómez',
    phone: '5511223344',
    country: 'Mexico',
    plan: 'PRO',
    branches: ['Sala Principal', 'Sucursal Norte'],
    assignedKey: 'ABC123',
    clientKey: 'CLIENTE123',
    subscriptionStart: '2026-01-01',
    paidUntil: '2026-12-31',
    holidays: [],
    availabilityExceptions: [
      {
        id: 'exc-cierre',
        fecha: '2026-05-10',
        tipo: 'cerrado',
        horaInicio: null,
        horaFin: null,
        aplicaTodasLasSedes: false,
        sedes: ['Sala Principal'],
        motivo: 'Mantenimiento',
        activa: true,
        creadoEn: '2026-04-16T10:00:00.000Z',
        actualizadoEn: '2026-04-16T10:00:00.000Z',
      },
      {
        id: 'exc-modificada',
        fecha: '2026-05-11',
        tipo: 'horario_modificado',
        horaInicio: '10:00',
        horaFin: '16:00',
        aplicaTodasLasSedes: false,
        sedes: ['Sucursal Norte'],
        motivo: 'Evento interno',
        activa: true,
        creadoEn: '2026-04-16T10:00:00.000Z',
        actualizadoEn: '2026-04-16T10:00:00.000Z',
      },
    ],
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
    staff: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('GestorFestivos', () => {
  it('elimina un ajuste y conserva el resto de excepciones activas', async () => {
    actualizarExcepcionesDisponibilidad.mockClear();
    recargar.mockClear();

    renderConProveedores(<GestorFestivos estudio={crearEstudioPrueba()} />);

    const botonesEliminar = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(botonesEliminar[0]);

    await waitFor(() => {
      expect(actualizarExcepcionesDisponibilidad).toHaveBeenCalledWith('estudio-1', [
        expect.objectContaining({ id: 'exc-modificada' }),
      ]);
    });
  });

  it('permite revertir una excepción histórica sin eliminarla', async () => {
    actualizarExcepcionesDisponibilidad.mockClear();
    recargar.mockClear();

    renderConProveedores(
      <GestorFestivos
        estudio={{
          ...crearEstudioPrueba(),
          availabilityExceptions: [
            {
              id: 'exc-historica',
              fecha: '2026-04-10',
              tipo: 'cerrado',
              horaInicio: null,
              horaFin: null,
              aplicaTodasLasSedes: true,
              sedes: [],
              motivo: 'Cierre histórico',
              activa: true,
              creadoEn: '2026-04-01T10:00:00.000Z',
              actualizadoEn: '2026-04-01T10:00:00.000Z',
            },
          ],
        }}
      />, 
    );

    fireEvent.click(screen.getByRole('button', { name: /revertir/i }));

    await waitFor(() => {
      expect(actualizarExcepcionesDisponibilidad).toHaveBeenCalledWith('estudio-1', [
        expect.objectContaining({
          id: 'exc-historica',
          fecha: '2026-04-10',
          activa: false,
        }),
      ]);
    });
  });
});