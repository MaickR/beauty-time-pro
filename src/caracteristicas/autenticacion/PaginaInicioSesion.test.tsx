import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaginaInicioSesion } from './PaginaInicioSesion';
import { renderConProveedores } from '../../test/renderConProveedores';

const { navegar, iniciarSesion, iniciarSesionConClave } = vi.hoisted(() => ({
  navegar: vi.fn(),
  iniciarSesion: vi.fn(),
  iniciarSesionConClave: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const moduloReal = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...moduloReal,
    useNavigate: () => navegar,
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
  it('resuelve la clave del salón y navega al enlace de reservas', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    iniciarSesionConClave.mockResolvedValue({
      exito: true,
      ruta: '/reservar/CLI1234567890ABCDEF1234',
      estudioId: 'estudio-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.click(screen.getByRole('tab', { name: 'Clave del salón' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Clave del salón' }), {
      target: { value: 'cli1234567890abcdef1234' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar con clave' }));

    await waitFor(() => {
      expect(iniciarSesionConClave).toHaveBeenCalledWith('CLI1234567890ABCDEF1234');
      expect(navegar).toHaveBeenCalledWith('/reservar/CLI1234567890ABCDEF1234');
    });
  });
});