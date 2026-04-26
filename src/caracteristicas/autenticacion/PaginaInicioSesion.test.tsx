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

const { detectarClaveAccesoAPI } = vi.hoisted(() => ({
  detectarClaveAccesoAPI: vi.fn(),
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

vi.mock('../../servicios/servicioAuth', () => ({
  detectarClaveAccesoAPI,
}));

describe('PaginaInicioSesion', () => {
  const obtenerBotonLogin = () => screen.getByRole('button', { name: /login/i });

  it('prioriza el dashboard del vendedor sobre la ruta previa del demo', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    detectarClaveAccesoAPI.mockResolvedValue({ tipo: 'desconocida' });
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = { desde: '/estudio/demo-vendedora/agenda' };

    iniciarSesion.mockResolvedValue({
      exito: true,
      ruta: '/vendedor',
      estudioId: 'demo-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'qa.vendedor@salonpromaster.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'QaLogin2026!' },
    });

    fireEvent.click(obtenerBotonLogin());

    await waitFor(() => {
      expect(navegar).toHaveBeenCalledWith('/vendedor');
    });
  });

  it('resuelve la clave del salón y navega al enlace de reservas', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    detectarClaveAccesoAPI.mockResolvedValue({ tipo: 'cliente' });
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;
    iniciarSesionConClave.mockResolvedValue({
      exito: true,
      ruta: '/reservar/CLI1234567890ABCDEF1234',
      estudioId: 'estudio-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'cli1234567890abcdef1234' },
    });

    await waitFor(() => {
      expect(detectarClaveAccesoAPI).toHaveBeenCalledWith('CLI1234567890ABCDEF1234');
    });

    fireEvent.click(obtenerBotonLogin());

    await waitFor(() => {
      expect(iniciarSesionConClave).toHaveBeenCalledWith('CLI1234567890ABCDEF1234');
      expect(navegar).toHaveBeenCalledWith('/reservar/CLI1234567890ABCDEF1234');
    });
  });

  it('auto inicia el acceso demo del empleado cuando llega desde la pestaña demo del vendedor', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    detectarClaveAccesoAPI.mockResolvedValue({ tipo: 'desconocida' });
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

  it('cuando detecta clave studio solicita correo del salon y autentica con correo mas contrasena', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    detectarClaveAccesoAPI.mockResolvedValue({ tipo: 'studio' });
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;

    iniciarSesion.mockResolvedValue({
      exito: true,
      ruta: '/estudio/demo/agenda',
      estudioId: 'estudio-demo',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'DUE1234567890ABCDEF1234' },
    });

    const campoCorreoSalon = await screen.findByLabelText('Correo del salón');
    fireEvent.change(campoCorreoSalon, { target: { value: 'dueno@salon.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'SalonPro!123' },
    });

    fireEvent.click(obtenerBotonLogin());

    await waitFor(() => {
      expect(iniciarSesion).toHaveBeenCalledWith('dueno@salon.com', 'SalonPro!123');
      expect(iniciarSesionConClave).not.toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith('/estudio/demo/agenda');
    });
  });

  it('permite acceso directo de cliente por correo sin desplegar contrasena', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;

    iniciarSesion.mockResolvedValue({
      exito: true,
      ruta: '/reservar/CLI99999999999999999999',
      estudioId: 'estudio-1',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    expect(screen.getByLabelText('Contraseña')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'cliente@correo.com' },
    });

    fireEvent.click(obtenerBotonLogin());

    await waitFor(() => {
      expect(iniciarSesion).toHaveBeenCalledWith('cliente@correo.com', '');
      expect(navegar).toHaveBeenCalledWith('/reservar/CLI99999999999999999999');
    });
  });

  it('cuando el backend exige contrasena para un correo muestra el segundo paso', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;

    iniciarSesion.mockResolvedValueOnce({
      exito: false,
      codigo: 'CONTRASENA_REQUERIDA',
      mensaje: 'Confirma tu acceso con correo y contrasena.',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'admin@salon.com' },
    });

    fireEvent.click(obtenerBotonLogin());

    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByText('Confirma tu acceso con correo y contrasena.')).toBeInTheDocument();
  });

  it('si la contrasena directa no alcanza pide correo y conserva la contrasena', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;

    iniciarSesion.mockResolvedValueOnce({
      exito: false,
      codigo: 'IDENTIFICADOR_REQUERIDO',
      mensaje: 'Debes confirmar con tu correo.',
    });

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'QaLogin2026!' },
    });

    fireEvent.click(obtenerBotonLogin());

    expect(await screen.findByLabelText('Correo electronico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveValue('QaLogin2026!');
    expect(screen.getByText(/varias cuentas con esa contrasena/i)).toBeInTheDocument();
  });

  it('si la detección de clave falla por red no la degrada a studio ni continúa', async () => {
    iniciarSesion.mockReset();
    navegar.mockReset();
    iniciarSesionConClave.mockReset();
    detectarClaveAccesoAPI.mockReset();
    detectarClaveAccesoAPI.mockResolvedValue({
      tipo: 'indeterminada',
      mensaje: 'No pudimos validar la clave por conexión. Reintenta antes de continuar.',
    });
    ubicacion.pathname = '/iniciar-sesion';
    ubicacion.state = null;

    renderConProveedores(<PaginaInicioSesion />, { rutaInicial: '/iniciar-sesion' });

    fireEvent.change(screen.getByLabelText('Acceso universal'), {
      target: { value: 'ADMSTUDIO001' },
    });

    await screen.findByText(/no pudimos validar la clave por conexión/i);
    expect(screen.queryByLabelText('Correo del salón')).not.toBeInTheDocument();

    fireEvent.click(obtenerBotonLogin());

    expect(await screen.findByText(/problema de conexión/i)).toBeInTheDocument();
    expect(iniciarSesion).not.toHaveBeenCalled();
    expect(iniciarSesionConClave).not.toHaveBeenCalled();
  });
});
