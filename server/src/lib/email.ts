import { Resend } from 'resend';
import { env } from './env.js';

async function enviarConReintento(fn: () => Promise<unknown>, intentos = 3): Promise<unknown> {
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === intentos - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

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
    await enviarConReintento(() =>
      resend.emails.send({
        from: env.EMAIL_REMITENTE!,
        to: para,
        subject: asunto,
        html,
      }),
    );
    if (env.ENTORNO !== 'production') console.log('[Email] Enviado a:', para.split('@')[0] + '@***');
    return true;
  } catch (error) {
    console.error('[Email] Error al enviar (3 intentos fallidos)');
    return false;
  }
}