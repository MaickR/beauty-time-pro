import { env } from '../env.js';

interface DatosTemplateBienvenidaSalon {
  nombreDueno: string;
  nombreSalon: string;
  fechaVencimiento: string;
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function crearTemplateBienvenidaSalon(datos: DatosTemplateBienvenidaSalon): string {
  const enlace = `${env.FRONTEND_URL}/iniciar-sesion`;

  return `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2;">Tu salón fue aprobado</h1>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">Hola ${escaparHtml(datos.nombreDueno)}, tu solicitud para <strong>${escaparHtml(datos.nombreSalon)}</strong> ya fue aprobada.</p>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">Tu acceso ya está habilitado y tu fecha de vencimiento inicial es <strong>${escaparHtml(datos.fechaVencimiento)}</strong>.</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${enlace}" style="display:inline-block; padding:14px 24px; background:#C2185B; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:700;">Entrar a Beauty Time Pro</a>
          </div>
          <p style="margin:0; font-size:13px; color:#64748b;">Si tienes dudas, responde a este correo y te ayudamos.</p>
        </div>
      </div>
    </div>
  `;
}