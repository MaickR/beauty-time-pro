import { prisma } from '../prismaCliente.js';
import { generarClavesSalonUnicas } from './clavesSalon.js';
import { generarSlugUnico } from '../utils/generarSlug.js';
import { obtenerFechaISOEnZona, obtenerZonaHorariaPorPais } from '../utils/zonasHorarias.js';

const PAIS_DEMO = 'Mexico';
const TELEFONO_DEMO = '5512345678';
const DESCRIPCION_DEMO =
  'Salon de demostracion para presentar Beauty Time Pro sin afectar informacion operativa.';

function crearHorarioDemo() {
  return {
    Lunes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Martes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Miercoles: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Jueves: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Viernes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Sabado: { isOpen: true, openTime: '09:00', closeTime: '15:00' },
    Domingo: { isOpen: false, openTime: '09:00', closeTime: '15:00' },
  };
}

function construirNombreSalonDemo(nombreUsuario: string) {
  const nombreBase = nombreUsuario.trim() || 'Vendedor';
  return `Demo ${nombreBase}`.slice(0, 120);
}

function obtenerFechasDemo() {
  const ahora = new Date();
  const zonaHoraria = obtenerZonaHorariaPorPais(PAIS_DEMO);
  const inicioSuscripcion = obtenerFechaISOEnZona(ahora, zonaHoraria, PAIS_DEMO);
  const vencimiento = new Date(ahora);
  vencimiento.setMonth(vencimiento.getMonth() + 1);

  return {
    inicioSuscripcion,
    fechaVencimiento: obtenerFechaISOEnZona(vencimiento, zonaHoraria, PAIS_DEMO),
    zonaHoraria,
  };
}

export async function asegurarSalonDemoVendedor(params: {
  usuarioId: string;
  nombre: string;
  email: string;
}) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: params.usuarioId },
    select: {
      id: true,
      estudioId: true,
      estudio: {
        select: {
          id: true,
          slug: true,
          nombre: true,
        },
      },
    },
  });

  if (usuario?.estudio) {
    return {
      id: usuario.estudio.id,
      slug: usuario.estudio.slug,
      nombre: usuario.estudio.nombre,
    };
  }

  const nombreSalon = construirNombreSalonDemo(params.nombre);
  const { claveDueno, claveCliente } = await generarClavesSalonUnicas(nombreSalon);
  const slug = await generarSlugUnico(nombreSalon);
  const { inicioSuscripcion, fechaVencimiento, zonaHoraria } = obtenerFechasDemo();

  const estudio = await prisma.estudio.create({
    data: {
      nombre: nombreSalon,
      propietario: params.nombre.trim() || 'Vendedor',
      telefono: TELEFONO_DEMO,
      pais: PAIS_DEMO,
      zonaHoraria,
      sucursales: [nombreSalon],
      claveDueno,
      claveCliente,
      slug,
      activo: true,
      plan: 'PRO',
      estado: 'aprobado',
      fechaAprobacion: new Date(),
      suscripcion: 'mensual',
      inicioSuscripcion,
      fechaVencimiento,
      horario: crearHorarioDemo(),
      servicios: [],
      serviciosCustom: [],
      festivos: [],
      descripcion: DESCRIPCION_DEMO,
      emailContacto: params.email,
      horarioApertura: '09:00',
      horarioCierre: '19:00',
      diasAtencion: 'lunes,martes,miercoles,jueves,viernes,sabado',
      numeroEspecialistas: 1,
      primeraVez: false,
    },
    select: {
      id: true,
      slug: true,
      nombre: true,
    },
  });

  await prisma.usuario.update({
    where: { id: params.usuarioId },
    data: { estudioId: estudio.id },
  });

  return estudio;
}

export async function obtenerSalonDemoVendedor(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      estudioId: true,
      estudio: {
        select: {
          id: true,
          slug: true,
          nombre: true,
          plan: true,
          estado: true,
          activo: true,
          fechaVencimiento: true,
          actualizadoEn: true,
          _count: {
            select: {
              reservas: true,
              pagos: true,
              clientes: true,
              personal: true,
              productos: true,
            },
          },
        },
      },
    },
  });

  return usuario?.estudio ?? null;
}

export async function reiniciarSalonDemoVendedor(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nombre: true,
      email: true,
      estudioId: true,
    },
  });

  if (!usuario?.estudioId) {
    return null;
  }

  const estudioId = usuario.estudioId;

  const nombreSalon = construirNombreSalonDemo(usuario.nombre);
  const { inicioSuscripcion, fechaVencimiento, zonaHoraria } = obtenerFechasDemo();

  const personal = await prisma.personal.findMany({
    where: { estudioId },
    select: { id: true },
  });
  const reservas = await prisma.reserva.findMany({
    where: { estudioId },
    select: { id: true },
  });
  const usuariosAsociados = await prisma.usuario.findMany({
    where: { estudioId, id: { not: usuario.id } },
    select: { id: true },
  });

  const personalIds = personal.map((item) => item.id);
  const reservaIds = reservas.map((item) => item.id);
  const usuarioIds = usuariosAsociados.map((item) => item.id);

  await prisma.$transaction(async (transaccion) => {
    if (usuarioIds.length > 0) {
      await transaccion.suscripcionPush.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.tokenReset.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.permisosMaestro.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.permisosSupervisor.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
    }

    if (reservaIds.length > 0) {
      await transaccion.reservaServicio.deleteMany({ where: { reservaId: { in: reservaIds } } });
    }

    if (personalIds.length > 0) {
      await transaccion.empleadoAcceso.deleteMany({ where: { personalId: { in: personalIds } } });
    }

    await transaccion.notificacionEstudio.deleteMany({ where: { estudioId } });
    await transaccion.mensajeMasivo.deleteMany({ where: { estudioId } });
    await transaccion.producto.deleteMany({ where: { estudioId } });
    await transaccion.puntosFidelidad.deleteMany({ where: { estudioId } });
    await transaccion.configFidelidad.deleteMany({ where: { estudioId } });
    await transaccion.diaFestivo.deleteMany({ where: { estudioId } });
    await transaccion.cliente.deleteMany({ where: { estudioId } });
    await transaccion.personal.deleteMany({ where: { estudioId } });
    await transaccion.reserva.deleteMany({ where: { estudioId } });
    await transaccion.pago.deleteMany({ where: { estudioId } });

    if (usuarioIds.length > 0) {
      await transaccion.usuario.deleteMany({
        where: {
          estudioId,
          id: { in: usuarioIds },
        },
      });
    }

    await transaccion.estudio.update({
      where: { id: estudioId },
      data: {
        nombre: nombreSalon,
        propietario: usuario.nombre.trim() || 'Vendedor',
        telefono: TELEFONO_DEMO,
        pais: PAIS_DEMO,
        zonaHoraria,
        sucursales: [nombreSalon],
        activo: true,
        plan: 'PRO',
        estado: 'aprobado',
        motivoRechazo: null,
        motivoBloqueo: null,
        fechaAprobacion: new Date(),
        fechaSuspension: null,
        fechaBloqueo: null,
        suscripcion: 'mensual',
        inicioSuscripcion,
        fechaVencimiento,
        horario: crearHorarioDemo(),
        servicios: [],
        serviciosCustom: [],
        festivos: [],
        colorPrimario: '#C2185B',
        logoUrl: null,
        descripcion: DESCRIPCION_DEMO,
        direccion: null,
        emailContacto: usuario.email,
        horarioApertura: '09:00',
        horarioCierre: '19:00',
        diasAtencion: 'lunes,martes,miercoles,jueves,viernes,sabado',
        numeroEspecialistas: 1,
        categorias: null,
        primeraVez: false,
        cancelacionSolicitada: false,
        fechaSolicitudCancelacion: null,
        motivoCancelacion: null,
        mensajesMasivosUsados: 0,
        mensajesMasivosExtra: 0,
      },
    });
  });

  return obtenerSalonDemoVendedor(usuarioId);
}