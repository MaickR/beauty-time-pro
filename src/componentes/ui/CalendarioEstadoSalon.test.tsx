import '@testing-library/jest-dom/vitest';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarioEstadoSalon } from './CalendarioEstadoSalon';
import { renderConProveedores } from '../../test/renderConProveedores';
import type { Estudio } from '../../tipos';

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
    holidays: ['2026-04-18'],
    schedule: {
      Domingo: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
      Lunes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Martes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Miércoles: { isOpen: true, openTime: '11:00', closeTime: '16:00' },
      Jueves: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Viernes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Sábado: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    },
    selectedServices: [],
    customServices: [],
    staff: [],
    availabilityExceptions: [
      {
        id: 'exc-cierre',
        fecha: '2026-04-17',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('CalendarioEstadoSalon', () => {
  it('muestra la leyenda de citas y abre el detalle de un cierre real', () => {
    renderConProveedores(
      <CalendarioEstadoSalon
        estudio={crearEstudioPrueba()}
        fechaSeleccionada={new Date(2026, 3, 15)}
        alCambiarFecha={() => undefined}
        fechasConCitas={['2026-04-16']}
        etiquetaCitas="Mis citas"
      />,
    );

    expect(screen.getByText('Mis citas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-04-18' }));

    expect(screen.getByText('Día cerrado')).toBeInTheDocument();
    expect(screen.getByText(/permanecerá cerrado|día de cierre/i)).toBeInTheDocument();
  });

  it('abre el detalle cuando el día tiene horario modificado', () => {
    renderConProveedores(
      <CalendarioEstadoSalon
        estudio={crearEstudioPrueba()}
        fechaSeleccionada={new Date(2026, 3, 15)}
        alCambiarFecha={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2026-04-15' }));

    expect(screen.getByRole('heading', { name: 'Horario modificado' })).toBeInTheDocument();
    expect(screen.getByText(/operará de 11:00 – 16:00/i)).toBeInTheDocument();
  });

  it('oculta la leyenda de citas cuando el rol no debe verlas', () => {
    renderConProveedores(
      <CalendarioEstadoSalon
        estudio={crearEstudioPrueba()}
        fechaSeleccionada={new Date(2026, 3, 15)}
        alCambiarFecha={() => undefined}
        mostrarCitas={false}
        fechasConCitas={['2026-04-16']}
      />,
    );

    expect(screen.queryByText('Citas')).not.toBeInTheDocument();
    expect(screen.getByText('Cierres')).toBeInTheDocument();
    expect(screen.getByText('Horario modificado')).toBeInTheDocument();
  });

  it('abre el detalle de un cierre especial aunque no venga solo por festivos', () => {
    renderConProveedores(
      <CalendarioEstadoSalon
        estudio={crearEstudioPrueba()}
        fechaSeleccionada={new Date(2026, 3, 15)}
        alCambiarFecha={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2026-04-17' }));

    expect(screen.getByText('Día cerrado')).toBeInTheDocument();
    expect(screen.getByText(/permanecerá cerrado/i)).toBeInTheDocument();
  });
});