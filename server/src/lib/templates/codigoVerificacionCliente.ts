interface DatosTemplateCodigoVerificacionCliente {
  nombreCliente: string;
  codigo: string;
  minutosExpiracion: number;
}

export function crearTemplateCodigoVerificacionCliente({
  nombreCliente,
  codigo,
  minutosExpiracion,
}: DatosTemplateCodigoVerificacionCliente): string {
  return `
    <div style="margin:0; padding:32px 20px; background:#f7f1f5; font-family:Arial, Helvetica, sans-serif; color:#1f1722;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:28px; overflow:hidden; border:1px solid #ead9e2; box-shadow:0 18px 40px rgba(99, 36, 72, 0.08);">
        <div style="padding:20px 28px; background:linear-gradient(135deg, #31111d 0%, #7b1e52 55%, #d64b8b 100%); color:#ffffff;">
          <p style="margin:0; font-size:11px; letter-spacing:0.28em; text-transform:uppercase; opacity:0.82;">Beauty Time Pro</p>
          <h1 style="margin:10px 0 0; font-size:28px; line-height:1.1; font-weight:800;">Verify Your Access Code</h1>
        </div>
        <div style="padding:32px 28px 30px;">
          <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#4b3241;">Hola ${nombreCliente}, usa este código para activar tu cuenta de cliente.</p>
          <div style="margin:24px 0; padding:18px; border-radius:22px; background:linear-gradient(180deg, #fff5fa 0%, #fff 100%); border:1px solid #f4c6db; text-align:center;">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:#8f5170; font-weight:700;">Verification Code</p>
            <p style="margin:0; font-size:34px; line-height:1; letter-spacing:0.4em; font-weight:900; color:#8b1858;">${codigo}</p>
          </div>
          <p style="margin:0 0 12px; font-size:14px; line-height:1.7; color:#5b4251;">El código vence en ${minutosExpiracion} minutos. Si solicitas uno nuevo, este dejará de funcionar automáticamente.</p>
          <p style="margin:0; font-size:13px; line-height:1.7; color:#7a6673;">Si no reconoces este registro, ignora este correo. Nadie del equipo te pedirá este código.</p>
        </div>
      </div>
    </div>
  `;
}