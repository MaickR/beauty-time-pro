import webpush from 'web-push';
import { env } from '../lib/env.js';

export interface CargaNotificacionPush {
  titulo: string;
  cuerpo: string;
  url?: string;
  icono?: string;
}

function extraerEmailRemitente(valor: string | undefined): string {
  if (!valor) return 'no-reply@beautytimepro.com';
  const coincidencia = valor.match(/<([^>]+)>/);
  return coincidencia?.[1] ?? valor;
}

webpush.setVapidDetails(
  `mailto:${extraerEmailRemitente(env.EMAIL_REMITENTE)}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export async function enviarNotificacionPush(
  suscripcion: webpush.PushSubscription,
  payload: CargaNotificacionPush,
) {
  try {
    await webpush.sendNotification(suscripcion, JSON.stringify(payload));
    return { enviada: true, expirada: false };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 410
    ) {
      return { enviada: false, expirada: true };
    }

    if (error instanceof Error) {
      console.error('[Push] Error enviando notificación:', error.message);
    }

    return { enviada: false, expirada: false };
  }
}