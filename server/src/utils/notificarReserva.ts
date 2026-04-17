import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import {
  incluirReservaConRelaciones,
  obtenerServiciosNormalizados,
} from '../lib/serializacionReservas.js';
import {
  enviarNotificacionPush,
  type CargaNotificacionPush,
} from '../servicios/notificacionesPush.js';

export interface ReservaConRelaciones {
  id?: string;
  estudioId: string;
  nombreCliente: string;
  horaInicio: string;
  fecha: string;
  duracion?: number;
  precioTotal?: number;
  tokenCancelacion?: string;
  notasMenorEdad?: string | null;
  clienteAppId?: string | null;
  servicios: unknown;
  serviciosDetalle?: unknown[];
  estudio?: {
    nombre: string;
    colorPrimario?: string | null;
    logoUrl?: string | null;
    direccion?: string | null;
    telefono?: string;
    claveCliente?: string;
  };
  cliente?: {
    email?: string | null;
  };
  empleado?: {
    nombre: string;
  };
}

function esErrorCompatibilidadReserva(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2021' ||
    codigo === 'P2022' ||
    /reserva_servicios/i.test(mensaje) ||
    /(clienteAppId|tokenCancelacion|recordatorioEnviado|notasMenorEdad)/i.test(mensaje) ||
    /Unknown column/i.test(mensaje) ||
    /doesn'?t exist/i.test(mensaje)
  );
}

const seleccionarReservaNotificacionCompat = {
  estudioId: true,
  nombreCliente: true,
  horaInicio: true,
  fecha: true,
  servicios: true,
  estudio: {
    select: {
      nombre: true,
    },
  },
} satisfies Prisma.ReservaSelect;

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
  try {
    return await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: incluirReservaConRelaciones,
    });
  } catch (error) {
    if (!esErrorCompatibilidadReserva(error)) {
      throw error;
    }

    return prisma.reserva.findUnique({
      where: { id: reservaId },
      select: seleccionarReservaNotificacionCompat,
    }) as Promise<ReservaConRelaciones | null>;
  }
}

export async function notificarNuevaCita(reserva: ReservaConRelaciones) {
  await prisma.notificacionEstudio.create({
    data: {
      estudioId: reserva.estudioId,
      tipo: 'nueva_reserva',
      titulo: 'Nueva cita asignada',
      mensaje: `${reserva.nombreCliente} reservó ${obtenerServiciosTexto(reserva)} para ${reserva.fecha} a las ${reserva.horaInicio}.`,
    },
  });

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
  const nombreEstudio = reserva.estudio?.nombre ?? 'tu estudio';

  await enviarMultiplesSuscripciones(suscripciones, {
    titulo: 'Recordatorio de cita',
    cuerpo: `Tu cita en ${nombreEstudio} es a las ${reserva.horaInicio}.`,
    url: '/mi-perfil#reservas',
  });
}
