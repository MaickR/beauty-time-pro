import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores } from '../../../test/renderConProveedores';
import { ModalCrearReservaManual } from './ModalCrearReservaManual';
import type { Estudio, Reserva, SlotTiempo } from '../../../tipos';

interface ResultadoCrearReservaPrueba {
  datos: Reserva;
  recompensaGanada: boolean;
  descripcion: string | null;
  recompensaUsada: boolean;
}

const mocksServicioReservas = vi.hoisted(() => ({
  crearReserva: vi.fn(),
  obtenerDisponibilidadEstudio: vi.fn(),
}));

vi.mock('../../../servicios/servicioReservas', () => mocksServicioReservas);

interface PropsSelectorFechaMock {
  etiqueta: string;
  valor: string;
  error?: string;
  alCambiar: (valor: string) => void;
}

vi.mock('../../../componentes/ui/SelectorFecha', () => ({
  SelectorFecha: ({ etiqueta, valor, error, alCambiar }: PropsSelectorFechaMock) => (
    <label>
      <span>{etiqueta}</span>
      <input
        aria-label={etiqueta}
        type="date"
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

function crearEstudioPrueba(): Estudio {
  return {
    id: 'estudio-1',
    slug: 'mikelov-studio',
    name: 'MIKELOV STUDIO',
    owner: 'QA Dueño',
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
    selectedServices: [
      { name: 'Corte Dama / Niña', duration: 60, price: 800, category: 'Cabello' },
      { name: 'Diseño de Ceja', duration: 30, price: 400, category: 'Cejas' },
    ],
    customServices: [],
    staff: [
      {
        id: 'qa-personal',
        name: 'QA Especialista',
        specialties: ['Corte Dama / Niña', 'Diseño de Ceja'],
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

function crearReservaPrueba(): Reserva {
  return {
    id: 'reserva-qa',
    studioId: 'estudio-1',
    studioName: 'MIKELOV STUDIO',
    clientName: 'Cliente Flujo QA',
    clientPhone: '5510002233',
    services: [{ name: 'Corte Dama / Niña', duration: 60, price: 800, category: 'Cabello' }],
    totalDuration: 60,
    totalPrice: 800,
    status: 'confirmed',
    branch: 'MIKELOV STUDIO',
    staffId: 'qa-personal',
    staffName: 'QA Especialista',
    date: '2026-04-17',
    time: '13:30',
    colorBrand: null,
    colorNumber: null,
    createdAt: '2026-04-16T12:00:00.000Z',
  };
}

describe('ModalCrearReservaManual', () => {
  const disponibilidad: SlotTiempo[] = [
    { time: '13:30', status: 'AVAILABLE' },
    { time: '15:00', status: 'AVAILABLE' },
  ];

  beforeEach(() => {
    mocksServicioReservas.obtenerDisponibilidadEstudio.mockResolvedValue(disponibilidad);
    const resultado: ResultadoCrearReservaPrueba = {
      datos: crearReservaPrueba(),
      recompensaGanada: false,
      descripcion: null,
      recompensaUsada: false,
    };
    mocksServicioReservas.crearReserva.mockResolvedValue(resultado);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('crea una cita manual asignada al especialista seleccionado', async () => {
    const onCerrar = vi.fn();
    const onReservaCreada = vi.fn();

    renderConProveedores(
      <ModalCrearReservaManual
        abierto
        estudio={crearEstudioPrueba()}
        fechaVista={new Date('2026-04-17T12:00:00.000Z')}
        onCerrar={onCerrar}
        onReservaCreada={onReservaCreada}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Especialista/i), {
      target: { value: 'qa-personal' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Corte Dama \/ Niña/i }));
    fireEvent.click(await screen.findByRole('button', { name: '13:30' }));
    fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), {
      target: { value: 'Cliente Flujo QA' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono/i), {
      target: { value: '5510002233' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de cumpleaños/i), {
      target: { value: '2026-04-16' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'cliente.qa@gmail.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() =>
      expect(mocksServicioReservas.crearReserva).toHaveBeenCalledWith(
        expect.objectContaining({
          studioId: 'estudio-1',
          studioName: 'MIKELOV STUDIO',
          clientName: 'Cliente Flujo QA',
          clientPhone: '5510002233',
          fechaNacimiento: '2026-04-16',
          email: 'cliente.qa@gmail.com',
          staffId: 'qa-personal',
          staffName: 'QA Especialista',
          date: '2026-04-17',
          time: '13:30',
          totalDuration: 60,
          totalPrice: 800,
          status: 'confirmed',
          services: [
            expect.objectContaining({
              name: 'Corte Dama / Niña',
              duration: 60,
              price: 800,
            }),
          ],
        }),
      ),
    );

    await waitFor(() => expect(onReservaCreada).toHaveBeenCalledTimes(1));
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(mocksServicioReservas.obtenerDisponibilidadEstudio).toHaveBeenCalledWith(
      'estudio-1',
      'qa-personal',
      '2026-04-17',
      60,
    );
  });
});
