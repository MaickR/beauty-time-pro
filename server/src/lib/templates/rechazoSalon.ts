import { env } from '../env.js';

interface DatosTemplateRechazoSalon {
  nombreDueno: string;
  nombreSalon: string;
  motivo: string;
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function crearTemplateRechazoSalon(datos: DatosTemplateRechazoSalon): string {
  const enlace = `${env.FRONTEND_URL}/iniciar-sesion`;

  return `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2;">Tu solicitud necesita ajustes</h1>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">Hola ${escaparHtml(datos.nombreDueno)}, revisamos la solicitud de <strong>${escaparHtml(datos.nombreSalon)}</strong> y por ahora no pudimos aprobarla.</p>
          <div style="margin:0 0 16px; padding:16px; border-radius:16px; background:#fef2f2; color:#991b1b;">
            <strong>Motivo:</strong> ${escaparHtml(datos.motivo)}
          </div>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">Cuando corrijas el punto indicado puedes volver a intentarlo.</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${enlace}" style="display:inline-block; padding:14px 24px; background:#0f172a; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:700;">Ir a Beauty Time Pro</a>
          </div>
        </div>
      </div>
    </div>
  `;
}