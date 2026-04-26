import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import crearFastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  estudioFindFirst: vi.fn(),
  estudioUpdate: vi.fn(),
  usuarioFindMany: vi.fn(),
  usuarioFindUnique: vi.fn(),
  usuarioUpdate: vi.fn(),
  usuarioCount: vi.fn(),
  clienteAppFindUnique: vi.fn(),
  clienteAppUpdate: vi.fn(),
  empleadoAccesoFindUnique: vi.fn(),
  empleadoAccesoUpdate: vi.fn(),
  permisosMaestroFindUnique: vi.fn(),
  permisosSupervisorFindUnique: vi.fn(),
  crearSesionAutenticacion: vi.fn(),
  registrarAuditoria: vi.fn(),
  compararHashContrasena: vi.fn(),
  salonEstaDisponible: vi.fn(),
  obtenerErrorAccesoSalon: vi.fn(),
  asegurarSalonDemoVendedor: vi.fn(),
}));

vi.mock('../prismaCliente.js', () => ({
  prisma: {
    estudio: {
      findFirst: mocks.estudioFindFirst,
      update: mocks.estudioUpdate,
    },
    usuario: {
      findMany: mocks.usuarioFindMany,
      findUnique: mocks.usuarioFindUnique,
      update: mocks.usuarioUpdate,
      count: mocks.usuarioCount,
    },
    clienteApp: {
      findUnique: mocks.clienteAppFindUnique,
      update: mocks.clienteAppUpdate,
    },
    empleadoAcceso: {
      findUnique: mocks.empleadoAccesoFindUnique,
      update: mocks.empleadoAccesoUpdate,
    },
    permisosMaestro: {
      findUnique: mocks.permisosMaestroFindUnique,
    },
    permisosSupervisor: {
      findUnique: mocks.permisosSupervisorFindUnique,
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
  salonEstaDisponible: mocks.salonEstaDisponible,
  obtenerErrorAccesoSalon: mocks.obtenerErrorAccesoSalon,
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
  compararHashContrasena: mocks.compararHashContrasena,
  generarHashContrasena: vi.fn(),
}));

vi.mock('../lib/demoVendedor.js', () => ({
  asegurarSalonDemoVendedor: mocks.asegurarSalonDemoVendedor,
}));

vi.mock('../utils/generarSlug.js', () => ({
  generarSlugUnico: vi.fn(async () => 'slug-generado'),
}));

describe('rutasAuth', () => {
  let app: Awaited<ReturnType<typeof crearApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mocks.crearSesionAutenticacion.mockResolvedValue({
      sesionId: 'sesion-1',
      refreshTokenId: 'refresh-1',
      csrfToken: 'csrf-1',
      expiraEn: new Date('2099-01-01T00:00:00.000Z'),
    });
    mocks.registrarAuditoria.mockResolvedValue(undefined);
    mocks.salonEstaDisponible.mockReturnValue(true);
    mocks.obtenerErrorAccesoSalon.mockReturnValue({
      error: 'Salón no disponible',
      codigo: 'SALON_NO_DISPONIBLE',
    });
    mocks.compararHashContrasena.mockResolvedValue(false);
    mocks.estudioUpdate.mockResolvedValue(undefined);
    mocks.usuarioUpdate.mockResolvedValue(undefined);
    mocks.usuarioCount.mockResolvedValue(1);
    mocks.clienteAppUpdate.mockResolvedValue(undefined);
    mocks.empleadoAccesoUpdate.mockResolvedValue(undefined);
    mocks.permisosMaestroFindUnique.mockResolvedValue(null);
    mocks.permisosSupervisorFindUnique.mockResolvedValue(null);
    mocks.asegurarSalonDemoVendedor.mockResolvedValue({ id: 'demo-1', slug: 'demo-salon' });

    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('detecta una clave studio sin depender del endpoint público', async () => {
    mocks.estudioFindFirst.mockResolvedValueOnce({
      id: 'estudio-1',
      claveCliente: 'SALONVIP01',
      claveDueno: 'ADMSTUDIO001',
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/auth/detectar-clave-acceso',
      payload: { clave: 'admstudio001' },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ datos: { tipo: 'studio' } });
  });

  it('emite cookie refresh cuando el origen de login es permitido', async () => {
    mocks.estudioFindFirst.mockResolvedValueOnce({
      id: 'estudio-1',
      slug: 'demo-salon',
      activo: true,
      estado: 'aprobado',
      usuarios: [
        { id: 'usuario-1', nombre: 'Dueño Demo', email: 'dueno@salonpromaster.com', activo: true },
      ],
    });

    const respuesta = await inyectarInicioSesion(app, { clave: 'SALON1234' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().datos.csrfToken).toBe('csrf-1');
    expect(String(respuesta.headers['set-cookie'])).toContain('btp_refresh_token=');
    expect(String(respuesta.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(respuesta.headers['set-cookie'])).toContain('Secure');
    expect(String(respuesta.headers['set-cookie'])).toContain('SameSite=None');
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

  it('permite acceso directo de cliente por correo sin contraseña', async () => {
    mocks.clienteAppFindUnique.mockResolvedValueOnce({
      id: 'cliente-1',
      email: 'cliente@correo.com',
      telefono: '5512345678',
      hashContrasena: 'hash-cliente',
      activo: true,
      nombre: 'Ana',
      apellido: 'Cliente',
    });
    mocks.empleadoAccesoFindUnique.mockResolvedValueOnce(null);
    mocks.usuarioFindUnique.mockResolvedValueOnce(null);

    const respuesta = await inyectarInicioSesion(app, { identificador: 'cliente@correo.com' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().datos.rol).toBe('cliente');
    expect(respuesta.json().datos.email).toBe('cliente@correo.com');
    expect(mocks.clienteAppUpdate).toHaveBeenCalled();
  });

  it('devuelve CONTRASENA_REQUERIDA cuando un correo interno intenta entrar sin contraseña', async () => {
    mocks.clienteAppFindUnique.mockResolvedValueOnce(null);
    mocks.empleadoAccesoFindUnique.mockResolvedValueOnce(null);
    mocks.usuarioFindUnique.mockResolvedValueOnce({ id: 'usuario-1' });

    const respuesta = await inyectarInicioSesion(app, { identificador: 'admin@salon.com' });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({
      codigo: 'CONTRASENA_REQUERIDA',
    });
  });

  it('devuelve TELEFONO_NO_REGISTRADO cuando no existe cliente para ese teléfono', async () => {
    mocks.clienteAppFindUnique.mockResolvedValueOnce(null);

    const respuesta = await inyectarInicioSesion(app, { identificador: '+52 55 1234 5678' });

    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({
      codigo: 'TELEFONO_NO_REGISTRADO',
    });
  });

  it('permite acceso por contraseña única para supervisor', async () => {
    mocks.usuarioFindMany.mockResolvedValueOnce([
      {
        id: 'usuario-sup-1',
        email: 'supervisor@salon.com',
        hashContrasena: 'hash-supervisor',
        nombre: 'Supervisora Uno',
        rol: 'supervisor',
        activo: true,
        estudioId: null,
        estudio: null,
      },
    ]);
    mocks.compararHashContrasena.mockImplementation(async (contrasena, hash) => {
      return contrasena === 'ClaveDirecta!2026' && hash === 'hash-supervisor';
    });

    const respuesta = await inyectarInicioSesion(app, { contrasena: 'ClaveDirecta!2026' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().datos.rol).toBe('supervisor');
    expect(respuesta.json().datos.email).toBe('supervisor@salon.com');
  });

  it('pide identificador cuando una contraseña coincide con varios roles internos', async () => {
    mocks.usuarioFindMany.mockResolvedValueOnce([
      {
        id: 'usuario-sup-1',
        email: 'supervisor@salon.com',
        hashContrasena: 'hash-1',
        nombre: 'Supervisora Uno',
        rol: 'supervisor',
        activo: true,
        estudioId: null,
        estudio: null,
      },
      {
        id: 'usuario-mae-1',
        email: 'maestro@salon.com',
        hashContrasena: 'hash-2',
        nombre: 'Maestro Uno',
        rol: 'maestro',
        activo: true,
        estudioId: null,
        estudio: null,
      },
    ]);
    mocks.compararHashContrasena.mockResolvedValue(true);

    const respuesta = await inyectarInicioSesion(app, { contrasena: 'ClaveCompartida!2026' });

    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toMatchObject({
      codigo: 'IDENTIFICADOR_REQUERIDO',
    });
  });
});

async function crearApp() {
  const app = crearFastify();
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, { secret: '1234567890123456' });

  const { rutasAuth } = await import('./auth.js');
  await app.register(rutasAuth);

  return app;
}

async function inyectarInicioSesion(
  app: Awaited<ReturnType<typeof crearApp>>,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/auth/iniciar-sesion',
    headers: {
      origin: 'https://panel.salonpromaster.com',
    },
    payload,
  });
}
