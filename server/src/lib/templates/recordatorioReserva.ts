import { env } from '../env.js';

interface DatosTemplateRecordatorio {
  reservaId: string;
  tokenCancelacion: string;
  salon: {
    nombre: string;
    colorPrimario: string | null;
    logoUrl: string | null;
    direccion: string | null;
    claveCliente: string;
  };
  cliente: { nombre: string };
  especialista: string;
  servicios: string[];
  fecha: string;
  hora: string;
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function crearTemplateRecordatorioReserva(datos: DatosTemplateRecordatorio): string {
  const color = datos.salon.colorPrimario ?? '#C2185B';
  const enlaceCancelar = `${env.FRONTEND_URL}/cancelar-reserva?id=${datos.reservaId}&t=${datos.tokenCancelacion}`;
  const enlaceDetalles = `${env.FRONTEND_URL}/cancelar-reserva?id=${datos.reservaId}&t=${datos.tokenCancelacion}`;
  const enlaceReagendar = `${env.FRONTEND_URL}/reservar/${datos.salon.claveCliente}`;
  const logoHtml = datos.salon.logoUrl
    ? `<img src="${datos.salon.logoUrl}" alt="Logo ${escaparHtml(datos.salon.nombre)}" style="max-height:56px; max-width:180px; display:block; margin:0 auto 12px;" />`
    : `<div style="font-size:28px; font-weight:800; color:${color}; margin-bottom:12px;">${escaparHtml(datos.salon.nombre)}</div>`;

  return `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid #e2e8f0;">
          ${logoHtml}
          <div style="font-size:14px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700; color:${color};">⏰ Recordatorio: tu cita es mañana</div>
        </div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px; font-size:28px; line-height:1.2;">Hola ${escaparHtml(datos.cliente.nombre)}, te esperamos mañana.</h1>
          <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:14px;">
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700; width:180px;">Especialista</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.especialista)}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Servicio</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.servicios.join(', '))}</td></tr>
            <tr><td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:700;">Hora</td><td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">${escaparHtml(datos.hora)}</td></tr>
            <tr><td style="padding:10px 0; font-weight:700;">Dirección</td><td style="padding:10px 0;">${escaparHtml(datos.salon.direccion ?? 'Dirección no disponible')}</td></tr>
          </table>
          <div style="text-align:center; margin:28px 0 16px;">
            <a href="${enlaceDetalles}" style="display:inline-block; margin-right:12px; padding:14px 24px; background:${color}; color:#ffffff; text-decoration:none; border-radius:999px; font-weight:700;">Ver detalles</a>
            <a href="${enlaceCancelar}" style="display:inline-block; padding:14px 24px; background:#ffffff; color:${color}; text-decoration:none; border-radius:999px; font-weight:700; border:2px solid ${color};">Cancelar cita</a>
            <a href="${enlaceReagendar}" style="display:inline-block; margin-left:12px; padding:14px 24px; background:#f8fafc; color:${color}; text-decoration:none; border-radius:999px; font-weight:700; border:2px solid #e2e8f0;">Reagendar</a>
          </div>
          <p style="margin:0; font-size:13px; color:#64748b;">Fecha: ${escaparHtml(datos.fecha)}</p>
        </div>
      </div>
    </div>
  `;
}
