import { Resend } from 'resend';
import { env } from './env.js';

export async function enviarEmail(para: string, asunto: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY no configurada — email no enviado');
    return false;
  }

  if (!env.EMAIL_REMITENTE) {
    console.warn('[Email] EMAIL_REMITENTE no configurado — email no enviado');
    return false;
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.EMAIL_REMITENTE,
      to: para,
      subject: asunto,
      html,
    });
    console.log('[Email] Enviado a:', para);
    return true;
  } catch (error) {
    console.error('[Email] Error al enviar:', error);
    return false;
  }
}