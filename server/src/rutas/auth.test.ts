import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  estudioFindFirst: vi.fn(),
  crearSesionAutenticacion: vi.fn(),
  registrarAuditoria: vi.fn(),
}));

vi.mock('../prismaCliente.js', () => ({
  prisma: {
    estudio: {
      findFirst: mocks.estudioFindFirst,
    },
  },
}));

vi.mock('../lib/env.js', () => ({
  env: {
    ENTORNO: 'production',
    JWT_REFRESH_EXPIRA_EN: '7d',
    JWT_EXPIRA_EN: '15m',
    JWT_SECRETO: '1234567890123456',
    FRONTEND_URL: 'https://panel.salonpromaster.com',
    FRONTEND_ORIGENES_PERMITIDOS: 'https://panel.salonpromaster.com',
  },
}));

vi.mock('../servicios/servicioEmail.js', () => ({
  enviarEmailResetContrasena: vi.fn(),
  enviarEmailVerificacionCliente: vi.fn(),
}));

vi.mock('../middleware/autenticacion.js', () => ({
  verificarJWT: vi.fn(),
}));

vi.mock('../lib/estadoSalon.js', () => ({
  salonEstaDisponible: vi.fn(() => true),
  obtenerErrorAccesoSalon: vi.fn(() => ({ error: 'Salón no disponible', codigo: 'SALON_NO_DISPONIBLE' })),
}));

vi.mock('../lib/sesionesAuth.js', () => ({
  crearSesionAutenticacion: mocks.crearSesionAutenticacion,
  registrarUsoSesion: vi.fn(),
  revocarSesionAutenticacion: vi.fn(),
  revocarSesionesPorSujeto: vi.fn(),
  rotarSesionAutenticacion: vi.fn(),
  validarRefreshSesion: vi.fn(),
}));

vi.mock('../utils/auditoria.js', () => ({
  registrarAuditoria: mocks.registrarAuditoria,
}));

vi.mock('../utils/contrasenas.js', () => ({
  compararHashContrasena: vi.fn(),
  generarHashContrasena: vi.fn(),
}));

vi.mock('../lib/demoVendedor.js', () => ({
  asegurarSalonDemoVendedor: vi.fn(),
}));

vi.mock('../utils/generarSlug.js', () => ({
  generarSlugUnico: vi.fn(),
}));

describe('rutasAuth', () => {
  let app: Awaited<ReturnType<typeof crearApp>>;

  beforeEach(async () => {
    vi.resetModules();
    mocks.estudioFindFirst.mockReset();
    mocks.crearSesionAutenticacion.mockReset();
    mocks.registrarAuditoria.mockReset();

    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('emite cookie refresh cuando el origen de login es permitido', async () => {
    mocks.estudioFindFirst.mockResolvedValueOnce({
      id: 'estudio-1',
      slug: 'demo-salon',
      activo: true,
      estado: 'aprobado',
      usuarios: [{ id: 'usuario-1', nombre: 'Dueño Demo', email: 'dueno@salonpromaster.com', activo: true }],
    });
    mocks.crearSesionAutenticacion.mockResolvedValue({
      sesionId: 'sesion-1',
      refreshTokenId: 'refresh-1',
      csrfToken: 'csrf-1',
      expiraEn: new Date('2099-01-01T00:00:00.000Z'),
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/auth/iniciar-sesion',
      headers: {
        origin: 'https://salonpromaster.com',
      },
      payload: {
        clave: 'SALON1234',
      },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().datos.csrfToken).toBe('csrf-1');
    const cookieRefresh = respuesta.headers['set-cookie'];
    expect(cookieRefresh).toBeDefined();
    expect(String(cookieRefresh)).toContain('btp_refresh_token=');
    expect(String(cookieRefresh)).toContain('HttpOnly');
    expect(String(cookieRefresh)).toContain('Secure');
    expect(String(cookieRefresh)).toContain('SameSite=None');
  });

  it('rechaza login con cookie cuando el origen no es permitido', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/auth/iniciar-sesion',
      headers: {
        origin: 'https://malicioso.example.com',
      },
      payload: {
        clave: 'SALON1234',
      },
    });

    expect(respuesta.statusCode).toBe(403);
    expect(respuesta.json()).toEqual({ error: 'Origen no permitido' });
    expect(respuesta.headers['set-cookie']).toBeUndefined();
    expect(mocks.estudioFindFirst).not.toHaveBeenCalled();
  });
});

async function crearApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: '1234567890123456' });

  const { rutasAuth } = await import('./auth.js');
  await app.register(rutasAuth);

  return app;
}