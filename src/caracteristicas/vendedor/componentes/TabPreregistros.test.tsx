import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores } from '../../../test/renderConProveedores';
import { TabPreregistros } from './TabPreregistros';

const obtenerMisPreregistros = vi.fn();
const crearPreregistro = vi.fn();

vi.mock('../../../servicios/servicioVendedor', () => ({
  obtenerMisPreregistros: (...args: unknown[]) => obtenerMisPreregistros(...args),
  crearPreregistro: (...args: unknown[]) => crearPreregistro(...args),
}));

describe('TabPreregistros', () => {
  beforeEach(() => {
    obtenerMisPreregistros.mockReset();
    crearPreregistro.mockReset();

    obtenerMisPreregistros.mockResolvedValue({
      datos: [
        {
          id: 'pre-1',
          nombreSalon: 'Aura Salon',
          propietario: 'Ana Lopez',
          emailPropietario: 'ana@gmail.com',
          telefonoPropietario: '5512345678',
          pais: 'Mexico',
          direccion: 'CDMX',
          descripcion: null,
          categorias: 'Cabello',
          plan: 'STANDARD',
          estado: 'pendiente',
          motivoRechazo: null,
          estudioCreadoId: null,
          notas: null,
          creadoEn: '2026-04-01T10:00:00.000Z',
        },
      ],
      total: 1,
      pagina: 1,
      limite: 10,
    });

    crearPreregistro.mockResolvedValue({
      id: 'pre-2',
      nombreSalon: 'Nube Salon',
      estado: 'pendiente',
    });
  });

  it('usa formulario de pre-registro sin campo de contrasena ni modal de accesos', async () => {
    renderConProveedores(<TabPreregistros />);

    await screen.findByText('Aura Salon');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo pre-registro' }));

    expect(screen.getByText('Nuevo pre-registro de salon')).toBeInTheDocument();
    expect(screen.queryByLabelText(/contrasena/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contrasena inicial/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre del salon'), {
      target: { value: 'Nube Salon' },
    });
    fireEvent.change(screen.getByLabelText('Propietario'), {
      target: { value: 'Marta Ruiz' },
    });
    fireEvent.change(screen.getByLabelText('Email del propietario'), {
      target: { value: 'marta@gmail.com' },
    });
    fireEvent.change(screen.getByLabelText('Telefono'), {
      target: { value: '5524681357' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar pre-registro' }));

    await waitFor(() => {
      expect(crearPreregistro).toHaveBeenCalled();
    });

    const [payload] = crearPreregistro.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toEqual(
      expect.objectContaining({
        nombreSalon: 'Nube Salon',
        propietario: 'Marta Ruiz',
        emailPropietario: 'marta@gmail.com',
        telefonoPropietario: '5524681357',
      }),
    );

    expect(screen.queryByText('Nuevo pre-registro de salon')).not.toBeInTheDocument();
    expect(screen.queryByText(/Registro completado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contrasena inicial/i)).not.toBeInTheDocument();
  });
});
