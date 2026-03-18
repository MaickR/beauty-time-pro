import { prisma } from '../prismaCliente.js';
import {
  incluirReservaConRelaciones,
  obtenerServiciosNormalizados,
} from '../lib/serializacionReservas.js';
import {
  enviarNotificacionPush,
  type CargaNotificacionPush,
} from '../servicios/notificacionesPush.js';

export type ReservaConRelaciones = NonNullable<
  Awaited<ReturnType<typeof obtenerReservaConRelacionesPorId>>
>;

async function enviarMultiplesSuscripciones(
  suscripciones: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: CargaNotificacionPush,
) {
  const expiradas: string[] = [];

  for (const suscripcion of suscripciones) {
    const resultado = await enviarNotificacionPush(
      {
        endpoint: suscripcion.endpoint,
        keys: {
          p256dh: suscripcion.p256dh,
          auth: suscripcion.auth,
        },
      },
      payload,
    );

    if (resultado.expirada) {
      expiradas.push(suscripcion.endpoint);
    }
  }

  if (expiradas.length > 0) {
    await prisma.suscripcionPush.updateMany({
      where: { endpoint: { in: expiradas } },
      data: { activa: false },
    });
  }
}

async function obtenerSuscripcionesDueno(estudioId: string) {
  return prisma.suscripcionPush.findMany({
    where: {
      activa: true,
      tipo: 'dueno',
      usuario: {
        estudioId,
        rol: 'dueno',
      },
    },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}

async function obtenerSuscripcionesCliente(clienteId: string | null | undefined) {
  if (!clienteId) return [];

  return prisma.suscripcionPush.findMany({
    where: {
      activa: true,
      tipo: 'cliente',
      clienteId,
    },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}

function obtenerServiciosTexto(reserva: { servicios: unknown; serviciosDetalle?: unknown[] }): string {
  const nombres = obtenerServiciosNormalizados(reserva)
    .map((servicio) => servicio.name)
    .filter(Boolean);

  return nombres.length > 0 ? nombres.join(', ') : 'tu cita';
}

export async function obtenerReservaConRelacionesPorId(reservaId: string) {
  return prisma.reserva.findUnique({
    where: { id: reservaId },
    include: incluirReservaConRelaciones,
  });
}

export async function notificarNuevaCita(reserva: ReservaConRelaciones) {
  const suscripciones = await obtenerSuscripcionesDueno(reserva.estudioId);
  if (suscripciones.length === 0) return;

  await enviarMultiplesSuscripciones(suscripciones, {
    titulo: 'Nueva cita reservada',
    cuerpo: `Nueva cita: ${reserva.nombreCliente} a las ${reserva.horaInicio}`,
    url: `/estudio/${reserva.estudioId}/agenda`,
  });
}

export async function notificarCitaConfirmada(reserva: ReservaConRelaciones) {
  const suscripciones = await obtenerSuscripcionesCliente(reserva.clienteAppId);
  if (suscripciones.length === 0) return;

  await enviarMultiplesSuscripciones(suscripciones, {
    titulo: 'Tu cita fue confirmada',
    cuerpo: `Tu cita fue confirmada para ${reserva.fecha} a las ${reserva.horaInicio}`,
    url: '/mi-perfil#reservas',
  });
}

export async function notificarCitaCancelada(reserva: ReservaConRelaciones) {
  const [suscripcionesCliente, suscripcionesDueno] = await Promise.all([
    obtenerSuscripcionesCliente(reserva.clienteAppId),
    obtenerSuscripcionesDueno(reserva.estudioId),
  ]);

  if (suscripcionesCliente.length > 0) {
    await enviarMultiplesSuscripciones(suscripcionesCliente, {
      titulo: 'Tu cita fue cancelada',
      cuerpo: `La cita de ${obtenerServiciosTexto(reserva)} para ${reserva.fecha} fue cancelada.`,
      url: '/mi-perfil#reservas',
    });
  }

  if (suscripcionesDueno.length > 0) {
    await enviarMultiplesSuscripciones(suscripcionesDueno, {
      titulo: 'Cita cancelada',
      cuerpo: `${reserva.nombreCliente} canceló su cita de las ${reserva.horaInicio}.`,
      url: `/estudio/${reserva.estudioId}/agenda`,
    });
  }
}

export async function notificarRecordatorio(reserva: ReservaConRelaciones) {
  const suscripciones = await obtenerSuscripcionesCliente(reserva.clienteAppId);
  if (suscripciones.length === 0) return;

  await enviarMultiplesSuscripciones(suscripciones, {
    titulo: 'Recordatorio de cita',
    cuerpo: `Tu cita en ${reserva.estudio.nombre} es a las ${reserva.horaInicio}.`,
    url: '/mi-perfil#reservas',
  });
}