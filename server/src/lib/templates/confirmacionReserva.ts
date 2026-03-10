import { env } from '../env.js';

interface DatosTemplateConfirmacion {
  reservaId: string;
  tokenCancelacion: string;
  salon: {
    nombre: string;
    colorPrimario: string | null;
    logoUrl: string | null;
    direccion: string | null;
    telefono: string;
  };
  cliente: { nombre: string };
  especialista: string;
  servicios: string[];
  fecha: string;
  hora: string;
  duracionTotal: number;
  precioTotal: number;
  esMenorDeEdad: boolean;
  recompensaAplicada?: string | null;
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function crearTemplateConfirmacionReserva(datos: DatosTemplateConfirmacion): string {
  const color = datos.salon.colorPrimario ?? '#C2185B';
  const enlaceCancelacion = `${env.FRONTEND_URL}/cancelar-reserva/${datos.reservaId}/${datos.tokenCancelacion}`;
  const serviciosHtml = datos.servicios.map((servicio) => `<li style="margin-bottom:4px;">${escaparHtml(servicio)}</li>`).join('');
  const logoHtml = datos.salon.logoUrl
    ? `<img src="${datos.salon.logoUrl}" alt="Logo ${escaparHtml(datos.salon.nombre)}" style="max-height:56px; max-width:180px; display:block; margin:0 auto 12px;" />`
    : `<div style="font-size:28px; font-weight:800; color:${color}; margin-bottom:12px;">${escaparHtml(datos.salon.nombre)}</div>`;

  return `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid #e2e8f0;">
          ${logoHtml}
          <div style="font-size:14px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700; color:${color};">Confirmación de cita</div>
        </div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2;">¡Hola ${escaparHtml(datos.cliente.nombre)}! Tu cita ha sido confirmada.</h1>
          <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#475569;">Estos son los detalles de tu reservación:</p>
          <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:14px;">
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700; width:180px;">Salón</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.salon.nombre)}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Especialista</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.especialista)}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700; vertical-align:top;">Servicio(s)</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;"><ul style="padding-left:18px; margin:0;">${serviciosHtml}</ul></td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Fecha</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.fecha)}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Hora</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.hora)}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Duración total</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${datos.duracionTotal} min</td></tr>
            <tr><td style="padding:10px 0; font-weight:700;">Precio total</td><td style="padding:10px 0;">$${datos.precioTotal.toFixed(2)}</td></tr>
          </table>
          ${datos.esMenorDeEdad ? `<div style="margin-bottom:16px; padding:16px; border-radius:16px; background:#fef3c7; color:#92400e;"><strong>Recuerda venir acompañado de un adulto</strong></div>` : ''}
          ${datos.recompensaAplicada ? `<div style="margin-bottom:16px; padding:16px; border-radius:16px; background:#dcfce7; color:#166534;"><strong>🎁 Recompensa aplicada:</strong> ${escaparHtml(datos.recompensaAplicada)}</div>` : ''}
          <div style="text-align:center; margin:28px 0;">
            <a href="${enlaceCancelacion}" style="display:inline-block; padding:14px 24px; background:${color}; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:700;">Cancelar mi cita</a>
          </div>
          <div style="padding-top:20px; border-top:1px solid #e2e8f0; font-size:13px; color:#64748b; line-height:1.6;">
            <strong>${escaparHtml(datos.salon.nombre)}</strong><br />
            ${datos.salon.direccion ? `${escaparHtml(datos.salon.direccion)}<br />` : ''}
            ${escaparHtml(datos.salon.telefono)}
          </div>
        </div>
      </div>
    </div>
  `;
}