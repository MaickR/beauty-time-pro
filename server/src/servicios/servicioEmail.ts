import { env } from '../lib/env.js';
import { encolarCorreo, type ResultadoEncoladoCorreo } from '../lib/colaEmails.js';
import { crearTemplateBienvenidaSalon } from '../lib/templates/bienvenidaSalon.js';
import { obtenerConfigFidelidad } from '../lib/fidelidad.js';
import { crearTemplateConfirmacionReserva } from '../lib/templates/confirmacionReserva.js';
import { crearTemplateRechazoSalon } from '../lib/templates/rechazoSalon.js';
import { crearTemplateRecordatorioReserva } from '../lib/templates/recordatorioReserva.js';
import { crearTemplateResetContrasena } from '../lib/templates/resetContrasena.js';
import { crearTemplateVerificacionCliente } from '../lib/templates/verificacionCliente.js';
import {
  incluirReservaConRelaciones,
  obtenerServiciosNormalizados,
} from '../lib/serializacionReservas.js';
import { prisma } from '../prismaCliente.js';

const TIPO_RECORDATORIO_RESERVA = 'recordatorio_reserva';

async function encolarEmailRenderizado(params: {
  destinatario: string;
  asunto: string;
  html: string;
  tipoEvento?: string;
  referenciaId?: string;
  claveUnica?: string;
}): Promise<ResultadoEncoladoCorreo> {
  return encolarCorreo({
    destinatario: params.destinatario,
    asunto: params.asunto,
    html: params.html,
    tipoEvento: params.tipoEvento,
    referenciaId: params.referenciaId,
    claveUnica: params.claveUnica,
  });
}

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
    include: incluirReservaConRelaciones,
  });
}

function obtenerServicios(reserva: { servicios: unknown; serviciosDetalle?: unknown[] }): string[] {
  return obtenerServiciosNormalizados(reserva).map((servicio) => servicio.name || 'Servicio');
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
      claveCliente: reserva.estudio.claveCliente,
    },
    cliente: { nombre: reserva.nombreCliente },
    especialista: reserva.empleado.nombre,
    servicios: obtenerServicios(reserva),
    fecha: reserva.fecha,
    hora: reserva.horaInicio,
    duracionTotal: reserva.duracion,
    precioTotal: reserva.precioTotal,
    esMenorDeEdad: Boolean(reserva.notasMenorEdad),
    recompensaAplicada: opciones?.recompensaAplicada ? (opciones.descripcionRecompensa ?? undefined) : undefined,
  });

  await encolarEmailRenderizado({
    destinatario: reserva.cliente.email,
    asunto: `Confirmación de cita — ${reserva.estudio.nombre}`,
    html,
    claveUnica: `confirmacion_reserva:${reserva.id}`,
  });

  return true;
}

export async function programarEmailRecordatorioReserva(
  reservaId: string,
): Promise<ResultadoEncoladoCorreo | false> {
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
      claveCliente: reserva.estudio.claveCliente,
    },
    cliente: { nombre: reserva.nombreCliente },
    especialista: reserva.empleado.nombre,
    servicios: obtenerServicios(reserva),
    fecha: reserva.fecha,
    hora: reserva.horaInicio,
  });

  return encolarEmailRenderizado({
    destinatario: reserva.cliente.email,
    asunto: '⏰ Recordatorio: tu cita es mañana',
    html,
    tipoEvento: TIPO_RECORDATORIO_RESERVA,
    referenciaId: reserva.id,
    claveUnica: `recordatorio_reserva:${reserva.id}`,
  });
}

export async function enviarEmailRecordatorio(reservaId: string): Promise<boolean> {
  return Boolean(await programarEmailRecordatorioReserva(reservaId));
}

export async function enviarEmailResetContrasena(emailDestino: string, token: string): Promise<void> {
  const html = crearTemplateResetContrasena({ token });
  await encolarEmailRenderizado({
    destinatario: emailDestino,
    asunto: 'Restablece tu contraseña — Beauty Time Pro',
    html,
    claveUnica: `reset_contrasena:${token}`,
  });
}

export async function enviarEmailVerificacionCliente(datos: {
  emailDestino: string;
  nombreCliente: string;
  enlaceVerificacion?: string;
  codigoVerificacion?: string;
  titulo?: string;
  mensajePrincipal?: string;
  mensajeSecundario?: string;
  asunto?: string;
}): Promise<void> {
  const html = crearTemplateVerificacionCliente(datos);
  await encolarEmailRenderizado({
    destinatario: datos.emailDestino,
    asunto: datos.asunto ?? 'Verifica tu correo — Beauty Time Pro',
    html,
  });
}

export async function enviarEmailBienvenidaSalon(datos: {
  emailDestino: string;
  nombreDueno: string;
  nombreSalon: string;
  fechaVencimiento: string;
}): Promise<void> {
  const html = crearTemplateBienvenidaSalon(datos);
  await encolarEmailRenderizado({
    destinatario: datos.emailDestino,
    asunto: `Tu salón ${datos.nombreSalon} fue aprobado`,
    html,
  });
}

export async function enviarEmailBienvenidaEmpleado(params: {
  email: string;
  nombreEmpleado: string;
  nombreSalon: string;
  contrasenaTemp: string;
  urlLogin: string;
  forzarCambioContrasena?: boolean;
}): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:#C2185B;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Panel de empleados</p>
        </div>
        <div style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">¡Hola, ${params.nombreEmpleado}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            El salón <strong>${params.nombreSalon}</strong> te ha dado acceso a tu panel de empleado en Beauty Time Pro.
            Desde aquí podrás ver tu agenda del día y gestionar tus citas.
          </p>
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Tus credenciales de acceso</p>
            <p style="margin:0 0 4px;font-size:14px;color:#0f172a;"><strong>Usuario (email):</strong> ${params.email}</p>
            <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Contraseña temporal:</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-family:monospace;">${params.contrasenaTemp}</code></p>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">
            ${params.forzarCambioContrasena
              ? 'Tu acceso está configurado para pedir cambio de contraseña en el primer ingreso.'
              : 'Te recomendamos cambiar tu contraseña en cuanto entres al sistema por primera vez.'}
          </p>
          <a href="${params.urlLogin}" style="display:inline-block;background:#C2185B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">Entrar a mi panel</a>
        </div>
        <div style="padding:24px 40px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Beauty Time Pro — Panel de empleados</p>
        </div>
      </div>
    </body>
    </html>
  `;
  await encolarEmailRenderizado({
    destinatario: params.email,
    asunto: `Acceso a Beauty Time Pro — ${params.nombreSalon}`,
    html,
  });

  return true;
}

export async function enviarEmailRecordatorioPagoSalon(params: {
  email: string;
  nombreDueno: string;
  nombreSalon: string;
  fechaVencimiento: string;
  diasRestantes?: number;
}): Promise<void> {
  const diasTexto = params.diasRestantes != null && params.diasRestantes >= 0
    ? `vence en ${params.diasRestantes} día${params.diasRestantes !== 1 ? 's' : ''}`
    : 'requiere revisión de pago';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:#f59e0b;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Recordatorio de pago</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola ${params.nombreDueno}, tu suscripción de Beauty Time Pro ${diasTexto}. Realiza tu pago para continuar disfrutando del servicio.
          </p>
          <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#9a3412;font-weight:700;">Resumen de vigencia</p>
            <p style="margin:0;font-size:15px;color:#0f172a;"><strong>Fecha de corte:</strong> ${params.fechaVencimiento}</p>
          </div>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0;">
            Si ya realizaste el pago puedes ignorar este correo. Si todavía está pendiente, contacta al equipo administrador para mantener tu salón activo.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await encolarEmailRenderizado({
    destinatario: params.email,
    asunto: `Recordatorio de pago — ${params.nombreSalon}`,
    html,
  });
}

export async function enviarEmailPagoConfirmado(params: {
  email: string;
  nombreDueno: string;
  nombreSalon: string;
  nuevaFechaVencimiento: string;
}): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:#16a34a;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Confirmación de pago</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola ${params.nombreDueno}, tu pago fue confirmado. Tu suscripción de Beauty Time Pro está activa hasta el <strong>${params.nuevaFechaVencimiento}</strong>.
          </p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:700;">Detalle de suscripción</p>
            <p style="margin:0;font-size:15px;color:#0f172a;"><strong>Salón:</strong> ${params.nombreSalon}</p>
            <p style="margin:8px 0 0;font-size:15px;color:#0f172a;"><strong>Activa hasta:</strong> ${params.nuevaFechaVencimiento}</p>
          </div>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0;">
            Gracias por confiar en Beauty Time Pro. Si tienes dudas, contacta al equipo administrador.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await encolarEmailRenderizado({
    destinatario: params.email,
    asunto: `Pago confirmado — ${params.nombreSalon}`,
    html,
  });
}

export async function enviarEmailCambioPrecioPlan(params: {
  email: string;
  nombreDueno: string;
  nombreSalon: string;
  plan: 'STANDARD' | 'PRO';
  moneda: 'MXN' | 'COP';
  precioAnterior: number;
  precioNuevo: number;
  fechaEntradaVigor: string;
}): Promise<void> {
  const locale = params.moneda === 'COP' ? 'es-CO' : 'es-MX';
  const precioAnterior = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: params.moneda,
    minimumFractionDigits: params.moneda === 'COP' ? 0 : 2,
    maximumFractionDigits: params.moneda === 'COP' ? 0 : 2,
  }).format(params.precioAnterior / 100);
  const precioNuevo = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: params.moneda,
    minimumFractionDigits: params.moneda === 'COP' ? 0 : 2,
    maximumFractionDigits: params.moneda === 'COP' ? 0 : 2,
  }).format(params.precioNuevo / 100);
  const nombrePlan = params.plan === 'PRO' ? 'Pro' : 'Standard';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:#C2185B;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Actualización de precio del plan</p>
        </div>
        <div style="padding:40px;">
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Hola ${params.nombreDueno}, el precio de tu plan <strong>${nombrePlan}</strong> para <strong>${params.nombreSalon}</strong> cambiará en tu próximo corte.
          </p>
          <div style="background:#fff1f2;border:1px solid #fbcfe8;border-radius:14px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#9d174d;font-weight:700;">Resumen del cambio</p>
            <p style="margin:0 0 6px;font-size:15px;color:#0f172a;"><strong>Precio actual:</strong> ${precioAnterior}</p>
            <p style="margin:0 0 6px;font-size:15px;color:#0f172a;"><strong>Nuevo precio:</strong> ${precioNuevo}</p>
            <p style="margin:0;font-size:15px;color:#0f172a;"><strong>Entrada en vigor:</strong> ${params.fechaEntradaVigor}</p>
          </div>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0;">
            Tu suscripción mantendrá el precio anterior hasta esa fecha. A partir del siguiente período se aplicará el nuevo monto automáticamente.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await encolarEmailRenderizado({
    destinatario: params.email,
    asunto: `Cambio de precio programado — ${params.nombreSalon}`,
    html,
  });
}

export async function enviarEmailRechazoSalon(datos: {
  emailDestino: string;
  nombreDueno: string;
  nombreSalon: string;
  motivo: string;
}): Promise<void> {
  const html = crearTemplateRechazoSalon(datos);
  await encolarEmailRenderizado({
    destinatario: datos.emailDestino,
    asunto: `Actualización sobre ${datos.nombreSalon}`,
    html,
  });
}

export async function obtenerDescripcionRecompensa(estudioId: string): Promise<string> {
  const config = await obtenerConfigFidelidad(estudioId);
  return config.descripcionRecompensa;
}

export async function enviarEmailSolicitudCancelacion(params: {
  nombreSalon: string;
  motivo?: string;
  fechaSolicitud: string;
}): Promise<void> {
  const emailAdmin = env.EMAIL_REMITENTE;
  if (!emailAdmin) return;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:#ef4444;padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Solicitud de cancelación</p>
        </div>
        <div style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Nueva solicitud de cancelación</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            El salón <strong>${params.nombreSalon}</strong> ha solicitado la cancelación de su suscripción.
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#991b1b;font-weight:700;">Detalles</p>
            <p style="margin:0 0 4px;font-size:14px;color:#0f172a;"><strong>Salón:</strong> ${params.nombreSalon}</p>
            <p style="margin:0 0 4px;font-size:14px;color:#0f172a;"><strong>Fecha de solicitud:</strong> ${params.fechaSolicitud}</p>
            ${params.motivo ? `<p style="margin:0;font-size:14px;color:#0f172a;"><strong>Motivo:</strong> ${params.motivo}</p>` : '<p style="margin:0;font-size:14px;color:#64748b;font-style:italic;">Sin motivo especificado</p>'}
          </div>
          <p style="color:#64748b;font-size:14px;">
            Accede al panel de administración para aprobar o rechazar esta solicitud.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  await encolarEmailRenderizado({
    destinatario: emailAdmin,
    asunto: `Solicitud de cancelación — ${params.nombreSalon}`,
    html,
  });
}

export async function enviarEmailCancelacionProcesada(params: {
  email: string;
  nombreSalon: string;
  aprobada: boolean;
  respuesta?: string;
}): Promise<void> {
  const asunto = params.aprobada
    ? `Cancelación de suscripción confirmada — ${params.nombreSalon}`
    : `Tu solicitud de cancelación fue rechazada — ${params.nombreSalon}`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:${params.aprobada ? '#16a34a' : '#2563eb'};padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Beauty Time Pro</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">
            ${params.aprobada ? 'Cancelación procesada' : 'Solicitud revisada'}
          </p>
        </div>
        <div style="padding:40px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">
            ${params.aprobada ? 'Tu suscripción fue cancelada' : 'Tu solicitud fue rechazada'}
          </h2>
          ${params.aprobada
            ? `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Tu salón <strong>${params.nombreSalon}</strong> ha sido dado de baja del sistema.
                Si tienes preguntas, responde a este correo.
              </p>`
            : `<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Revisamos tu solicitud de cancelación para <strong>${params.nombreSalon}</strong> y decidimos no procesarla.
                Tu suscripción sigue activa.
              </p>`
          }
          ${params.respuesta
            ? `<div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:700;">Respuesta del equipo</p>
                <p style="margin:0;font-size:14px;color:#0f172a;">${params.respuesta}</p>
              </div>`
            : ''}
        </div>
        <div style="padding:24px 40px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Beauty Time Pro — Equipo de soporte</p>
        </div>
      </div>
    </body>
    </html>
  `;
  await encolarEmailRenderizado({
    destinatario: params.email,
    asunto,
    html,
  });
}
