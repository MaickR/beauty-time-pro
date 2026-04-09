interface DatosTemplateVerificacionCliente {
  nombreCliente: string;
  enlaceVerificacion?: string;
  codigoVerificacion?: string;
  titulo?: string;
  mensajePrincipal?: string;
  mensajeSecundario?: string;
}

export function crearTemplateVerificacionCliente({
  nombreCliente,
  enlaceVerificacion,
  codigoVerificacion,
  titulo = 'Verifica tu correo',
  mensajePrincipal,
  mensajeSecundario,
}: DatosTemplateVerificacionCliente): string {
  const bloqueCodigo = codigoVerificacion
    ? `
      <div style="margin: 28px 0; padding: 24px; border-radius: 24px; background: linear-gradient(135deg, #111827 0%, #1f2937 100%); text-align: center;">
        <p style="margin: 0 0 10px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,255,255,0.68);">Código de verificación</p>
        <p style="margin: 0; font-size: 38px; line-height: 1; letter-spacing: 0.28em; font-weight: 700; color: #f8fafc;">${codigoVerificacion}</p>
      </div>
    `
    : '';

  const bloqueEnlace = enlaceVerificacion
    ? `
      <div style="margin-top: 28px;">
        <a href="${enlaceVerificacion}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 999px; font-weight: 700;">Confirmar correo</a>
        <p style="margin: 18px 0 0; font-size: 13px; line-height: 1.7; color: #64748b;">Si el botón no abre, pega este enlace en tu navegador:<br /><a href="${enlaceVerificacion}" style="color: #0f172a; word-break: break-all;">${enlaceVerificacion}</a></p>
      </div>
    `
    : '';

  const textoPrincipal = mensajePrincipal ?? (codigoVerificacion
    ? `Hola ${nombreCliente}, usa este código para terminar de activar tu cuenta de Beauty Time Pro.`
    : `Hola ${nombreCliente}, confirma tu correo para mantener protegido tu acceso a Beauty Time Pro.`);

  const textoSecundario = mensajeSecundario ?? (codigoVerificacion
    ? 'Este código vence en 15 minutos. Si solicitas uno nuevo, el anterior deja de funcionar de inmediato.'
    : 'Por seguridad, solo la solicitud de verificación más reciente se mantiene válida.');

  return `
    <div style="margin:0; padding:32px 16px; background:#f4efe8; color:#111827; font-family: Georgia, 'Times New Roman', serif;">
      <div style="max-width:600px; margin:0 auto; background:#fffdf9; border:1px solid #eadfce; border-radius:32px; overflow:hidden; box-shadow:0 20px 60px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px 18px; background:linear-gradient(135deg, #f3e8d7 0%, #fdf8f0 65%, #fffdf9 100%); border-bottom:1px solid #eadfce;">
          <p style="margin:0; font-size:12px; letter-spacing:0.3em; text-transform:uppercase; font-weight:700; color:#8a5a44;">Beauty Time Pro</p>
          <h1 style="margin:16px 0 0; font-size:34px; line-height:1.05; font-weight:700; color:#111827;">${titulo}</h1>
        </div>
        <div style="padding:32px; font-family: 'Segoe UI', Arial, sans-serif;">
          <p style="margin:0 0 14px; font-size:16px; line-height:1.75; color:#1f2937;">${textoPrincipal}</p>
          <p style="margin:0; font-size:14px; line-height:1.75; color:#6b7280;">${textoSecundario}</p>
          ${bloqueCodigo}
          ${bloqueEnlace}
          <div style="margin-top:28px; padding:18px 20px; border-radius:20px; background:#f8f5ef; border:1px solid #ede3d6;">
            <p style="margin:0; font-size:13px; line-height:1.7; color:#6b7280;">Si no solicitaste esta acción, puedes ignorar este correo. Tu cuenta seguirá igual hasta que completes la verificación.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
