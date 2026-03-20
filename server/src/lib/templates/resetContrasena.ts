import { env } from '../env.js';

interface DatosTemplateReset {
  token: string;
}

export function crearTemplateResetContrasena({ token }: DatosTemplateReset): string {
  const enlace = `${env.FRONTEND_URL}/reset-contrasena?token=${encodeURIComponent(token)}`;
  return `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2;">Restablece tu contraseña — Beauty Time Pro</h1>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#475569;">Recibimos una solicitud para restablecer tu contraseña. Este enlace expira en 1 hora.</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${enlace}" style="display:inline-block; padding:14px 24px; background:#C2185B; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:700;">Restablecer contraseña</a>
          </div>
          <p style="margin:0; font-size:13px; color:#64748b;">Si no solicitaste esto, ignora este mensaje.</p>
        </div>
      </div>
    </div>
  `;
}
