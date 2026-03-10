import { Resend } from 'resend';
import { env } from './env.js';

const resend = new Resend(env.RESEND_API_KEY);

export async function enviarEmail(para: string, asunto: string, html: string): Promise<void> {
  try {
    await resend.emails.send({
      from: env.EMAIL_REMITENTE,
      to: para,
      subject: asunto,
      html,
    });
  } catch (error) {
    console.error('Error enviando email:', error);
  }
}