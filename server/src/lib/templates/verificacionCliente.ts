interface DatosTemplateVerificacionCliente {
  nombreCliente: string;
  enlaceVerificacion: string;
}

export function crearTemplateVerificacionCliente({ nombreCliente, enlaceVerificacion }: DatosTemplateVerificacionCliente): string {
  return `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 24px; padding: 32px; border: 1px solid #e2e8f0;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.24em; color: #be185d; text-transform: uppercase;">Beauty Time Pro</p>
        <h1 style="margin: 12px 0 16px; font-size: 30px; line-height: 1.1;">Confirma tu correo</h1>
        <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">Hola ${nombreCliente}, tu cuenta ya fue creada. Solo falta confirmar tu correo para activar el acceso.</p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">Haz clic en el siguiente botón para verificar tu email:</p>
        <a href="${enlaceVerificacion}" style="display: inline-block; background: #be185d; color: white; text-decoration: none; padding: 14px 22px; border-radius: 16px; font-weight: 700;">Verificar correo</a>
        <p style="margin: 24px 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">Si el botón no funciona, copia este enlace en tu navegador:<br /><a href="${enlaceVerificacion}" style="color: #2563eb;">${enlaceVerificacion}</a></p>
      </div>
    </div>
  `;
}