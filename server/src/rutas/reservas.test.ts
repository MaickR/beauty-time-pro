import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reservaFindUnique: vi.fn(),
  reservaFindMany: vi.fn(),
  reservaUpdate: vi.fn(),
  reservaServicioUpdateMany: vi.fn(),
  registrarAuditoria: vi.fn(),
  obtenerReservaConRelacionesPorId: vi.fn(),
  notificarCitaCancelada: vi.fn(),
}));

vi.mock('../prismaCliente.js', () => ({
  prisma: {
    reserva: {
      findUnique: mocks.reservaFindUnique,
      findMany: mocks.reservaFindMany,
      update: mocks.reservaUpdate,
    },
    reservaServicio: {
      updateMany: mocks.reservaServicioUpdateMany,
    },
  },
}));

vi.mock('../middleware/autenticacion.js', () => ({
  verificarJWT: vi.fn(),
  verificarJWTOpcional: vi.fn(),
}));

vi.mock('../utils/auditoria.js', () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

vi.mock('../utils/notificarReserva.js', () => ({
  notificarCitaCancelada: mocks.notificarCitaCancelada,
  notificarCitaConfirmada: vi.fn(),
  notificarNuevaCita: vi.fn(),
  obtenerReservaConRelacionesPorId: mocks.obtenerReservaConRelacionesPorId,
}));

vi.mock('../lib/serializacionReservas.js', () => ({
  calcularResumenServicios: vi.fn(() => ({
    serviciosActivos: [],
    duracionTotal: 60,
    precioTotal: 1200,
  })),
  incluirReservaConRelaciones: {},
  incluirServiciosDetalleReserva: {},
  normalizarServiciosEntrada: vi.fn(),
  recalcularServiciosContraCatalogo: vi.fn(),
  obtenerDuracionTotalServicios: vi.fn(),
  obtenerPrecioTotalServicios: vi.fn(),
  obtenerServiciosNormalizados: vi.fn(() => [
    { status: 'cancelled', duration: 60, price: 1200, name: 'Corte' },
  ]),
  serializarReservaApi: vi.fn(),
}));

vi.mock('../lib/reservasPublicas.js', () => ({
  normalizarProductosAdicionalesReserva: vi.fn(),
  obtenerIdsProductosReserva: vi.fn(() => []),
  resolverSucursalReserva: vi.fn(),
}));

vi.mock('../lib/disponibilidadExcepciones.js', () => ({
  obtenerExcepcionDisponibilidadAplicada: vi.fn(),
}));

vi.mock('../lib/accesoEstudio.js', () => ({
  tieneAccesoAdministrativoEstudio: vi.fn(() => true),
}));

vi.mock('../lib/metodosPagoReserva.js', () => ({
  validarMetodoPagoReservaDisponible: vi.fn(() => true),
}));

vi.mock('../servicios/servicioEmail.js', () => ({
  enviarEmailConfirmacion: vi.fn(),
}));

vi.mock('../utils/sanitizar.js', () => ({
  sanitizarTexto: vi.fn((valor: string) => valor),
}));

vi.mock('../utils/validarEmail.js', () => ({
  esEmailValido: vi.fn(() => true),
}));

vi.mock('../lib/sedes.js', () => ({
  obtenerNombresSucursales: vi.fn(() => []),
}));

describe('rutasReservas', () => {
  let app: Awaited<ReturnType<typeof crearApp>>;

  beforeEach(async () => {
    vi.resetModules();
    mocks.reservaFindUnique.mockReset();
    mocks.reservaFindMany.mockReset();
    mocks.reservaUpdate.mockReset();
    mocks.reservaServicioUpdateMany.mockReset();
    mocks.registrarAuditoria.mockReset();
    mocks.obtenerReservaConRelacionesPorId.mockReset();
    mocks.notificarCitaCancelada.mockReset();

    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('cancela una reserva publica valida y deja auditoria correlada', async () => {
    mocks.reservaFindUnique.mockResolvedValueOnce({
      id: 'reserva-1',
      fecha: '2099-01-20',
      horaInicio: '15:00',
      estado: 'confirmed',
      tokenCancelacion: 'token-publico',
      nombreCliente: 'Cliente Demo',
      servicios: [],
      serviciosDetalle: [],
      empleado: { nombre: 'Especialista Demo', activo: true },
      estudio: { nombre: 'Salon Demo', zonaHoraria: 'America/Mexico_City', pais: 'Mexico' },
    });
    mocks.reservaUpdate.mockResolvedValueOnce({ id: 'reserva-1', estado: 'cancelled' });
    mocks.reservaFindMany.mockResolvedValueOnce([
      {
        id: 'reserva-1',
        estado: 'cancelled',
        servicios: [],
        productosAdicionales: [],
      },
    ]);
    mocks.reservaUpdate.mockResolvedValueOnce({ id: 'reserva-1', estado: 'cancelled' });
    mocks.obtenerReservaConRelacionesPorId.mockResolvedValue({ id: 'reserva-1', estado: 'cancelled' });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/reservas/cancelar/token-publico',
    });

    expect(respuesta.statusCode).toBe(200);
    expect(mocks.reservaServicioUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'reserva_cancelada_publica',
        entidadTipo: 'reserva',
        entidadId: 'reserva-1',
        detalles: expect.objectContaining({
          requestId: expect.any(String),
          actor: { rol: 'publico' },
          despues: { estado: 'cancelled' },
        }),
      }),
    );
  });
});

async function crearApp() {
  const app = Fastify();
  const { rutasReservas } = await import('./reservas.js');
  await app.register(rutasReservas);
  return app;
}