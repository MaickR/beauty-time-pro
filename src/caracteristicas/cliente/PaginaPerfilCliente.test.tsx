import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores } from '../../test/renderConProveedores';
import { PaginaPerfilCliente } from './PaginaPerfilCliente';
import { PanelReservasCliente } from './componentes/PanelReservasCliente';
import type { PerfilClienteApp, ReservaCliente, SalonDetalle } from '../../tipos';

const mocksServicioClienteApp = vi.hoisted(() => ({
  obtenerMiPerfil: vi.fn(),
  obtenerMisReservas: vi.fn(),
  obtenerReservasProximas: vi.fn(),
  actualizarMiPerfil: vi.fn(),
  actualizarMiEmail: vi.fn(),
  cambiarContrasena: vi.fn(),
  obtenerSalonPublico: vi.fn(),
  cancelarMiReserva: vi.fn(),
  reagendarMiReserva: vi.fn(),
}));

vi.mock('../../componentes/diseno/NavegacionCliente', () => ({
  NavegacionCliente: () => <div>navegacion cliente</div>,
}));

vi.mock('../../hooks/usarNotificacionesPush', () => ({
  usarNotificacionesPush: () => ({
    soportado: false,
    notificacionesActivas: false,
    activar: vi.fn(),
    desactivar: vi.fn(),
  }),
}));

vi.mock('../../tienda/tiendaAuth', () => ({
  usarTiendaAuth: () => ({
    usuario: {
      rol: 'cliente',
      nombre: 'Ana Cliente',
      email: 'ana@cliente.com',
    },
    iniciando: false,
  }),
}));

vi.mock('../../servicios/servicioClienteApp', () => mocksServicioClienteApp);

function obtenerFechaRelativa(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function crearReservaCliente(overrides: Partial<ReservaCliente> = {}): ReservaCliente {
  return {
    id: 'reserva-1',
    fecha: obtenerFechaRelativa(1),
    horaInicio: '10:00',
    duracion: 90,
    estado: 'confirmed',
    sucursal: 'Principal',
    servicios: [{ name: 'Color premium', duration: 90, price: 180000, category: 'Color' }],
    precioTotal: 180000,
    metodoPago: 'card',
    observaciones: 'Usar fórmula suave.',
    tokenCancelacion: 'token-1',
    reagendada: false,
    reservaOriginalId: null,
    salon: {
      id: 'salon-1',
      nombre: 'Salón Norte',
      colorPrimario: '#db2777',
      logoUrl: null,
      direccion: 'Calle 10',
      pais: 'Mexico',
      slug: 'salon-norte',
    },
    especialista: { id: 'esp-1', nombre: 'Andrea López', eliminado: false },
    ...overrides,
  };
}

function crearPerfilCliente(reservas: ReservaCliente[] = []): PerfilClienteApp {
  return {
    id: 'cliente-1',
    email: 'ana@cliente.com',
    emailPendiente: null,
    nombre: 'Ana',
    apellido: 'Cliente',
    pais: 'Mexico',
    telefono: '5511223344',
    fechaNacimiento: '1992-08-20',
    ciudad: 'CDMX',
    avatarUrl: null,
    creadoEn: '2026-04-17T09:00:00.000Z',
    mensajeFidelidad: null,
    reservas,
    fidelidad: [],
  };
}

function crearSalonDetalle(): SalonDetalle {
  return {
    id: 'salon-1',
    nombre: 'Salón Norte',
    descripcion: null,
    direccion: 'Calle 10',
    pais: 'Mexico',
    telefono: '5511223344',
    emailContacto: 'salon@cliente.com',
    logoUrl: null,
    colorPrimario: '#db2777',
    horarioApertura: '09:00',
    horarioCierre: '18:00',
    diasAtencion: 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado',
    slug: 'salon-norte',
    plan: 'PRO',
    estudioPrincipalId: null,
    permiteReservasPublicas: true,
    sucursales: ['Principal'],
    sedesReservables: [],
    servicios: [{ name: 'Color premium', duration: 90, price: 180000, category: 'Color' }],
    productos: [],
    horario: {
      Domingo: { isOpen: false, openTime: '09:00', closeTime: '18:00' },
      Lunes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Martes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Miércoles: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Jueves: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Viernes: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
      Sábado: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    },
    festivos: [],
    availabilityExceptions: [],
    personal: [],
    categorias: null,
  };
}

describe('cliente perfil y reservas', () => {
  beforeEach(() => {
    const reservas = [crearReservaCliente()];

    mocksServicioClienteApp.obtenerMiPerfil.mockResolvedValue(crearPerfilCliente(reservas));
    mocksServicioClienteApp.obtenerMisReservas.mockResolvedValue(reservas);
    mocksServicioClienteApp.obtenerReservasProximas.mockResolvedValue(reservas);
    mocksServicioClienteApp.actualizarMiPerfil.mockResolvedValue(crearPerfilCliente(reservas));
    mocksServicioClienteApp.actualizarMiEmail.mockResolvedValue({
      mensaje: 'Verificación enviada',
      emailPendiente: 'nuevo@cliente.com',
    });
    mocksServicioClienteApp.cambiarContrasena.mockResolvedValue(undefined);
    mocksServicioClienteApp.obtenerSalonPublico.mockResolvedValue(crearSalonDetalle());
    mocksServicioClienteApp.cancelarMiReserva.mockResolvedValue({ cancelada: true });
    mocksServicioClienteApp.reagendarMiReserva.mockResolvedValue({
      id: 'reserva-1',
      fecha: obtenerFechaRelativa(2),
      horaInicio: '11:00',
      reagendada: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('oculta cualquier accion para cambiar la foto de perfil del cliente', async () => {
    renderConProveedores(<PaginaPerfilCliente />, { rutaInicial: '/cliente/perfil' });

    expect(await screen.findByText('Mis datos')).toBeInTheDocument();
    expect(screen.getByText('Ana Cliente')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cambiar foto de perfil/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/editar foto/i)).not.toBeInTheDocument();
  });

  it('elimina el encabezado auxiliar de la vista reservas del cliente', async () => {
    renderConProveedores(<PaginaPerfilCliente />, {
      rutaInicial: '/cliente/perfil?vista=reservas',
    });

    expect(await screen.findByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument();
    expect(screen.queryByText('Vista activa')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendario e historial de reservas')).not.toBeInTheDocument();
  });

  it('filtra por la fecha seleccionada en el calendario del cliente', async () => {
    const fechaPasada = obtenerFechaRelativa(-1);
    const fechaFutura = obtenerFechaRelativa(1);
    const reservas = [
      crearReservaCliente({
        id: 'reserva-pasada',
        fecha: fechaPasada,
        estado: 'completed',
        servicios: [{ name: 'Corte clásico', duration: 60, price: 90000, category: 'Corte' }],
        precioTotal: 90000,
      }),
      crearReservaCliente({
        id: 'reserva-futura',
        fecha: fechaFutura,
        estado: 'confirmed',
        servicios: [{ name: 'Color premium', duration: 90, price: 180000, category: 'Color' }],
        precioTotal: 180000,
      }),
    ];

    renderConProveedores(<PanelReservasCliente reservas={reservas} paisCliente="Mexico" />);

    expect((await screen.findAllByText('Color premium')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Corte clásico')).toHaveLength(0);

    fireEvent.click(await screen.findByRole('button', { name: fechaPasada }));

    await waitFor(() => expect(screen.getAllByText('Corte clásico').length).toBeGreaterThan(0));
    expect(screen.queryAllByText('Color premium')).toHaveLength(0);
  });

  it('muestra el detalle completo en cards dentro del aside y elimina la tabla inferior', async () => {
    const fechaReserva = obtenerFechaRelativa(2);
    const reservas = [
      crearReservaCliente({
        fecha: fechaReserva,
        horaInicio: '11:00',
        duracion: 120,
        sucursal: 'Av. Presidente Masaryk 123, Polanco, CDMX',
        metodoPago: 'digital_transfer',
        observaciones: 'Cliente prefiere atención silenciosa.',
      }),
    ];

    renderConProveedores(<PanelReservasCliente reservas={reservas} paisCliente="Mexico" />);

    expect(await screen.findByText('Agendamientos del día')).toBeInTheDocument();
    expect(screen.getByText('Transferencia digital')).toBeInTheDocument();
    expect(screen.getByText('Cliente prefiere atención silenciosa.')).toBeInTheDocument();
    expect(screen.queryByText('Detalle del agendamiento')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('permite cambiar entre salones y actualiza el contexto del calendario del cliente', async () => {
    const fechaSalonAlpha = obtenerFechaRelativa(3);
    const fechaSalonZen = obtenerFechaRelativa(6);
    const reservas = [
      crearReservaCliente({
        id: 'reserva-alpha',
        fecha: fechaSalonAlpha,
        servicios: [{ name: 'Corte editorial', duration: 60, price: 90000, category: 'Corte' }],
        precioTotal: 90000,
        salon: {
          id: 'salon-alpha',
          nombre: 'Alpha Studio',
          colorPrimario: '#0f172a',
          logoUrl: null,
          direccion: 'Calle Alpha',
          pais: 'Mexico',
          slug: 'alpha-studio',
        },
      }),
      crearReservaCliente({
        id: 'reserva-zen',
        fecha: fechaSalonZen,
        servicios: [{ name: 'Ritual facial', duration: 75, price: 150000, category: 'Spa' }],
        precioTotal: 150000,
        salon: {
          id: 'salon-zen',
          nombre: 'Zen House',
          colorPrimario: '#166534',
          logoUrl: null,
          direccion: 'Calle Zen',
          pais: 'Mexico',
          slug: 'zen-house',
        },
      }),
    ];

    mocksServicioClienteApp.obtenerSalonPublico.mockImplementation(async (salonId: string) => ({
      ...crearSalonDetalle(),
      id: salonId,
      nombre: salonId === 'salon-alpha' ? 'Alpha Studio' : 'Zen House',
      slug: salonId === 'salon-alpha' ? 'alpha-studio' : 'zen-house',
      direccion: salonId === 'salon-alpha' ? 'Calle Alpha' : 'Calle Zen',
      colorPrimario: salonId === 'salon-alpha' ? '#0f172a' : '#166534',
      servicios:
        salonId === 'salon-alpha'
          ? [{ name: 'Corte editorial', duration: 60, price: 90000, category: 'Corte' }]
          : [{ name: 'Ritual facial', duration: 75, price: 150000, category: 'Spa' }],
    }));

    renderConProveedores(<PanelReservasCliente reservas={reservas} paisCliente="Mexico" />);

    expect(await screen.findByRole('button', { name: /Alpha Studio/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findAllByText('Corte editorial')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Zen House/i }));

    await waitFor(() => expect(screen.getByText('Salón activo')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Zen House').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText('Ritual facial').length).toBeGreaterThan(0));
    expect(screen.queryAllByText('Corte editorial')).toHaveLength(0);
  });
});
