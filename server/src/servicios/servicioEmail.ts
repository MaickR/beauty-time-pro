import { env } from '../lib/env.js';
import { enviarEmail } from '../lib/email.js';
import { crearTemplateBienvenidaSalon } from '../lib/templates/bienvenidaSalon.js';
import { obtenerConfigFidelidad } from '../lib/fidelidad.js';
import { crearTemplateConfirmacionReserva } from '../lib/templates/confirmacionReserva.js';
import { crearTemplateRechazoSalon } from '../lib/templates/rechazoSalon.js';
import { crearTemplateRecordatorioReserva } from '../lib/templates/recordatorioReserva.js';
import { crearTemplateResetContrasena } from '../lib/templates/resetContrasena.js';
import { crearTemplateVerificacionCliente } from '../lib/templates/verificacionCliente.js';
import { prisma } from '../prismaCliente.js';

function obtenerOrigenBackend(): string {
  const url = new URL(env.FRONTEND_URL);
  if (url.port === '5173' || url.port === '4173' || url.port === '5174') {
    url.port = '3000';
  }
  return url.origin;
}

function normalizarLogo(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }
  return `${obtenerOrigenBackend()}${logoUrl}`;
}

async function obtenerReservaCompleta(reservaId: string) {
  return prisma.reserva.findUnique({
    where: { id: reservaId },
    include: {
      cliente: true,
      empleado: true,
      estudio: true,
    },
  });
}

function obtenerServicios(servicios: unknown): string[] {
  if (!Array.isArray(servicios)) return [];
  return servicios.map((servicio) => {
    if (typeof servicio === 'string') return servicio;
    if (servicio && typeof servicio === 'object' && 'name' in servicio) {
      return String((servicio as { name: unknown }).name);
    }
    return 'Servicio';
  });
}

export async function enviarEmailConfirmacion(
  reservaId: string,
  opciones?: { recompensaAplicada?: boolean; descripcionRecompensa?: string | null },
) : Promise<boolean> {
  const reserva = await obtenerReservaCompleta(reservaId);
  if (!reserva?.cliente.email) return false;

  const html = crearTemplateConfirmacionReserva({
    reservaId: reserva.id,
    tokenCancelacion: reserva.tokenCancelacion,
    salon: {
      nombre: reserva.estudio.nombre,
      colorPrimario: reserva.estudio.colorPrimario,
      logoUrl: normalizarLogo(reserva.estudio.logoUrl),
      direccion: reserva.estudio.direccion,
      telefono: reserva.estudio.telefono,
    },
    cliente: { nombre: reserva.nombreCliente },
    especialista: reserva.empleado.nombre,
    servicios: obtenerServicios(reserva.servicios),
    fecha: reserva.fecha,
    hora: reserva.horaInicio,
    duracionTotal: reserva.duracion,
    precioTotal: reserva.precioTotal,
    esMenorDeEdad: Boolean(reserva.notasMenorEdad),
    recompensaAplicada: opciones?.recompensaAplicada ? (opciones.descripcionRecompensa ?? undefined) : undefined,
  });

  return enviarEmail(reserva.cliente.email, `Confirmación de cita — ${reserva.estudio.nombre}`, html);
}

export async function enviarEmailRecordatorio(reservaId: string): Promise<boolean> {
  const reserva = await obtenerReservaCompleta(reservaId);
  if (!reserva?.cliente.email) return false;

  const html = crearTemplateRecordatorioReserva({
    reservaId: reserva.id,
    tokenCancelacion: reserva.tokenCancelacion,
    salon: {
      nombre: reserva.estudio.nombre,
      colorPrimario: reserva.estudio.colorPrimario,
      logoUrl: normalizarLogo(reserva.estudio.logoUrl),
      direccion: reserva.estudio.direccion,
    },
    cliente: { nombre: reserva.nombreCliente },
    especialista: reserva.empleado.nombre,
    servicios: obtenerServicios(reserva.servicios),
    fecha: reserva.fecha,
    hora: reserva.horaInicio,
  });

  return enviarEmail(reserva.cliente.email, '⏰ Recordatorio: tu cita es mañana', html);
}

export async function enviarEmailResetContrasena(emailDestino: string, token: string): Promise<void> {
  const html = crearTemplateResetContrasena({ token });
  await enviarEmail(emailDestino, 'Restablece tu contraseña — Beauty Time Pro', html);
}

export async function enviarEmailVerificacionCliente(datos: {
  emailDestino: string;
  nombreCliente: string;
  enlaceVerificacion: string;
}): Promise<void> {
  const html = crearTemplateVerificacionCliente(datos);
  await enviarEmail(datos.emailDestino, 'Verifica tu correo — Beauty Time Pro', html);
}

export async function enviarEmailBienvenidaSalon(datos: {
  emailDestino: string;
  nombreDueno: string;
  nombreSalon: string;
  fechaVencimiento: string;
}): Promise<void> {
  const html = crearTemplateBienvenidaSalon(datos);
  await enviarEmail(datos.emailDestino, `Tu salón ${datos.nombreSalon} fue aprobado`, html);
}

export async function enviarEmailRechazoSalon(datos: {
  emailDestino: string;
  nombreDueno: string;
  nombreSalon: string;
  motivo: string;
}): Promise<void> {
  const html = crearTemplateRechazoSalon(datos);
  await enviarEmail(datos.emailDestino, `Actualización sobre ${datos.nombreSalon}`, html);
}

export async function obtenerDescripcionRecompensa(estudioId: string): Promise<string> {
  const config = await obtenerConfigFidelidad(estudioId);
  return config.descripcionRecompensa;
}