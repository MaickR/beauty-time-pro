import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaginaInicioSesion } from './PaginaInicioSesion';
import { renderConProveedores } from '../../test/renderConProveedores';

const { navegar, iniciarSesion, iniciarSesionConClave, ubicacion } = vi.hoisted(() => ({
  navegar: vi.fn(),
  iniciarSesion: vi.fn(),
  iniciarSesionConClave: vi.fn(),
  ubicacion: {
    pathname: '/iniciar-sesion',
    state: null as {
      desde?: string;
      demo?: {
        identificador: string;
        contrasena: string;
        autoIniciar?: boolean;
      };
    } | null,
  },
}));

vi.mock('react-router-dom', async () => {
  const moduloReal = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...moduloReal,
    useNavigate: () => navegar,
    useLocation: () => ubicacion,
  };
});

vi.mock('../../tienda/tiendaAuth', () => ({
  consumirAvisoInicioSesion: () => null,
  usarTiendaAuth: () => ({
    iniciarSesion,
    iniciarSesionConClave,
  }),
}));

vi.mock('../../hooks/usarTituloPagina', () => ({
  usarTituloPagina: vi.fn(),
}));

describe('PaginaInicioSesion', () => {
  it('prioriza el dashboard del vendedor sobre la ruta previa del demo', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = { desde: '/estudio/demo-vendedora/agenda' };

    iniciarSesion.mockResolvedValue({
      exito: true,
      ruta: '/vendedor',
      estudioId: 'demo-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Clave de acceso'), {
      target: { value: 'qa.vendedor@salonpromaster.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'QaLogin2026!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));

    await waitFor(() => {
      expect(navegar).toHaveBeenCalledWith('/vendedor');
    });
  });

  it('resuelve la clave del salón y navega al enlace de reservas', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;
    iniciarSesionConClave.mockResolvedValue({
      exito: true,
      ruta: '/reservar/CLI1234567890ABCDEF1234',
      estudioId: 'estudio-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Clave de acceso'), {
      target: { value: 'cli1234567890abcdef1234' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));

    await waitFor(() => {
      expect(iniciarSesionConClave).toHaveBeenCalledWith('CLI1234567890ABCDEF1234');
      expect(navegar).toHaveBeenCalledWith('/reservar/CLI1234567890ABCDEF1234');
    });
  });

  it('auto inicia el acceso demo del empleado cuando llega desde la pestaña demo del vendedor', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = {
      desde: '/empleado/agenda',
      demo: {
        identificador: 'maria-emp@salonpromaster.com',
        contrasena: 'SalonPro!A1B2C3',
        autoIniciar: true,
      },
    };

    iniciarSesion.mockResolvedValue({
      exito: true,
      ruta: '/empleado/agenda',
      estudioId: 'demo-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    await waitFor(() => {
      expect(iniciarSesion).toHaveBeenCalledWith('maria-emp@salonpromaster.com', 'SalonPro!A1B2C3');
      expect(navegar).toHaveBeenCalledWith('/empleado/agenda');
    });
  });
});
