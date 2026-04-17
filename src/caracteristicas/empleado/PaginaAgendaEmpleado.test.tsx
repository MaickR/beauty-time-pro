import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores } from '../../test/renderConProveedores';
import { PaginaAgendaEmpleado } from './PaginaAgendaEmpleado';
import type { PerfilEmpleado, ProductoAdicionalReserva, ReservaEmpleado } from '../../tipos';

const calendarioEmpleadoMock = vi.hoisted(() => vi.fn());

const mocksServicioEmpleados = vi.hoisted(() => ({
  obtenerMiAgenda: vi.fn(),
  obtenerMiAgendaMes: vi.fn(),
  obtenerMiPerfilEmpleado: vi.fn(),
  obtenerMisMetricas: vi.fn(),
  actualizarEstadoReservaEmpleado: vi.fn(),
}));

const mocksServicioReservas = vi.hoisted(() => ({
  agregarServicioAReserva: vi.fn(),
  agregarProductoAReserva: vi.fn(),
}));

const mocksServicioProductos = vi.hoisted(() => ({
  obtenerProductos: vi.fn(),
}));

const mockToDataURL = vi.hoisted(() => vi.fn());

vi.mock('../../componentes/diseno/NavegacionEmpleado', () => ({
  NavegacionEmpleado: () => <div>navegacion empleado</div>,
}));

vi.mock('../../componentes/ui/CalendarioEstadoSalon', () => ({
  CalendarioEstadoSalon: (props: { variante?: 'regular' | 'compacta' }) => {
    calendarioEmpleadoMock(props);
    return <div>calendario empleado</div>;
  },
}));

vi.mock('../estudio/componentes/ModalSuspension', () => ({
  ModalSuspension: () => null,
}));

vi.mock('../estudio/componentes/ModalCrearReservaManual', () => ({
  ModalCrearReservaManual: () => null,
}));

vi.mock('./componentes/ModalMetricasEmpleado', () => ({
  ModalMetricasEmpleado: () => null,
}));

vi.mock('../../tienda/tiendaAuth', () => ({
  usarTiendaAuth: () => ({
    usuario: { rol: 'empleado' },
    iniciando: false,
  }),
}));

vi.mock('../../servicios/servicioEmpleados', () => mocksServicioEmpleados);
vi.mock('../../servicios/servicioReservas', () => mocksServicioReservas);
vi.mock('../../servicios/servicioProductos', () => mocksServicioProductos);
vi.mock('qrcode', () => ({
  default: {
    toDataURL: mockToDataURL,
  },
}));

function formatearFechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function crearFechaIsoDiasAntes(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(10, 0, 0, 0);
  return fecha.toISOString();
}

function crearPerfilEmpleado(plan: 'STANDARD' | 'PRO' = 'PRO'): PerfilEmpleado {
  return {
    id: 'empleado-1',
    nombre: 'Andrea López',
    email: 'andrea@salon.com',
    creadoEn: crearFechaIsoDiasAntes(7),
    avatarUrl: null,
    especialidades: ['Balayage'],
    activo: true,
    horaInicio: '09:00',
    horaFin: '18:00',
    descansoInicio: '14:00',
    descansoFin: '15:00',
    diasTrabajo: [1, 2, 3, 4, 5, 6],
    estudio: {
      id: 'estudio-1',
      nombre: 'Salón Norte',
      plan,
      colorPrimario: '#111827',
      logoUrl: null,
      direccion: 'Calle 123',
      telefono: '5512345678',
      emailContacto: 'hola@salon.com',
      horarioApertura: '09:00',
      horarioCierre: '18:00',
      diasAtencion: 'Lunes,Martes,Miércoles,Jueves,Viernes,Sábado',
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
      estado: 'activo',
      pais: 'Mexico',
      claveCliente: 'SALON-123',
      slug: 'salon-norte',
      servicios: [{ name: 'Balayage', duration: 90, price: 180000, category: 'Color' }],
    },
  };
}

function crearReservaEmpleado(
  productosAdicionales: ProductoAdicionalReserva[] = [],
  overrides: Partial<ReservaEmpleado> = {},
): ReservaEmpleado {
  const fechaHoy = formatearFechaLocal(new Date());
  return {
    id: 'reserva-1',
    estudioId: 'estudio-1',
    personalId: 'empleado-1',
    fecha: fechaHoy,
    horaInicio: '10:00',
    duracion: 90,
    estado: 'confirmed',
    servicios: [{ name: 'Balayage', duration: 90, price: 180000, category: 'Color' }],
    precioTotal:
      180000 + productosAdicionales.reduce((total, producto) => total + producto.total, 0),
    nombreCliente: 'Carla Ruiz',
    telefonoCliente: '5511223344',
    clienteAppId: null,
    sucursal: 'Principal',
    productosAdicionales,
    creadoEn: crearFechaIsoDiasAntes(0),
    ...overrides,
  };
}

describe('PaginaAgendaEmpleado', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mockToDataURL.mockResolvedValue('data:image/png;base64,qr');
    mocksServicioEmpleados.obtenerMiAgenda.mockResolvedValue([crearReservaEmpleado()]);
    mocksServicioEmpleados.obtenerMiAgendaMes.mockResolvedValue([crearReservaEmpleado()]);
    mocksServicioEmpleados.obtenerMiPerfilEmpleado.mockResolvedValue(crearPerfilEmpleado('PRO'));
    mocksServicioEmpleados.obtenerMisMetricas.mockResolvedValue({
      citasHoy: 1,
      citasSemana: 1,
      citasMes: 1,
    });
    mocksServicioEmpleados.actualizarEstadoReservaEmpleado.mockResolvedValue(
      crearReservaEmpleado(),
    );
    mocksServicioReservas.agregarServicioAReserva.mockResolvedValue(crearReservaEmpleado());
    mocksServicioReservas.agregarProductoAReserva.mockResolvedValue(crearReservaEmpleado());
    mocksServicioProductos.obtenerProductos.mockResolvedValue([
      {
        id: 'prod-1',
        estudioId: 'estudio-1',
        nombre: 'Ampolleta nutritiva',
        categoria: 'Tratamiento',
        precio: 25000,
        activo: true,
        creadoEn: '2026-04-10T08:00:00.000Z',
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('usa la variante compacta del calendario en la agenda del empleado', async () => {
    renderConProveedores(<PaginaAgendaEmpleado />, { rutaInicial: '/empleado/agenda' });

    await screen.findByText('calendario empleado');

    expect(calendarioEmpleadoMock).toHaveBeenCalledWith(
      expect.objectContaining({ variante: 'compacta' }),
    );
  });

  it('permite copiar la clave del salón y agregar productos en plan PRO', async () => {
    renderConProveedores(<PaginaAgendaEmpleado />, { rutaInicial: '/empleado/agenda' });

    expect(await screen.findByText('Clave pública verificada')).toBeInTheDocument();
    expect(screen.getByText('SALON-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar enlace de reservas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir link de reservas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar link por WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar código QR' })).toBeInTheDocument();
    expect(screen.getByText('1 agendada(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar clave' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('SALON-123'));

    fireEvent.click(await screen.findByRole('button', { name: 'Extra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Producto' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ampolleta nutritiva/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }));

    await waitFor(() =>
      expect(mocksServicioReservas.agregarProductoAReserva).toHaveBeenCalledWith(
        'reserva-1',
        'prod-1',
        2,
      ),
    );
  });

  it('bloquea la pestaña de productos cuando el salón no es PRO', async () => {
    mocksServicioEmpleados.obtenerMiPerfilEmpleado.mockResolvedValue(
      crearPerfilEmpleado('STANDARD'),
    );

    renderConProveedores(<PaginaAgendaEmpleado />, { rutaInicial: '/empleado/agenda' });

    fireEvent.click(await screen.findByRole('button', { name: 'Extra' }));

    expect(await screen.findByRole('button', { name: /Producto · PRO/i })).toBeDisabled();
  });

  it('muestra los productos ya asociados a la cita del empleado', async () => {
    const productos = [
      {
        id: 'prod-2',
        nombre: 'Shampoo reparador',
        categoria: 'Retail',
        cantidad: 2,
        precioUnitario: 18000,
        total: 36000,
      },
    ] satisfies ProductoAdicionalReserva[];

    mocksServicioEmpleados.obtenerMiAgenda.mockResolvedValue([crearReservaEmpleado(productos)]);
    mocksServicioEmpleados.obtenerMiAgendaMes.mockResolvedValue([crearReservaEmpleado(productos)]);

    renderConProveedores(<PaginaAgendaEmpleado />, { rutaInicial: '/empleado/agenda' });

    expect(await screen.findByText(/Shampoo reparador/i)).toBeInTheDocument();
    expect(screen.getByText('1 agendada(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));

    expect(await screen.findByText('Productos adicionales')).toBeInTheDocument();
    expect(screen.getAllByText(/Shampoo reparador/i).length).toBeGreaterThan(0);
  });

  it('pagina los agendamientos de cuatro en cuatro', async () => {
    const reservas = Array.from({ length: 5 }, (_, indice) =>
      crearReservaEmpleado([], {
        id: `reserva-${indice + 1}`,
        nombreCliente: `Cliente ${indice + 1}`,
        horaInicio: `${String(9 + indice).padStart(2, '0')}:00`,
      }),
    );

    mocksServicioEmpleados.obtenerMiAgenda.mockResolvedValue(reservas);
    mocksServicioEmpleados.obtenerMiAgendaMes.mockResolvedValue(reservas);

    renderConProveedores(<PaginaAgendaEmpleado />, { rutaInicial: '/empleado/agenda' });

    expect(await screen.findByText('Mostrando 1-4 de 5 cita(s).')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Detalle' })).toHaveLength(4);
    expect(screen.queryByText('Cliente 5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Mostrando 5-5 de 5 cita(s).')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Detalle' })).toHaveLength(1);
    expect(screen.getByText('Cliente 5')).toBeInTheDocument();
  });
});
