import type { Pais } from '../../../tipos';

const WHATSAPP_SOPORTE_MEXICO = '5255641341516';
const WHATSAPP_SOPORTE_COLOMBIA = '573006934216';

function obtenerPrimerNombre(nombreCompleto?: string | null): string {
  const primerNombre = nombreCompleto?.trim().split(/\s+/)[0];
  return primerNombre && primerNombre.length > 0 ? primerNombre : 'Hola';
}

export function obtenerNumeroSoporteWhatsApp(pais: Pais): string {
  return pais === 'Colombia' ? WHATSAPP_SOPORTE_COLOMBIA : WHATSAPP_SOPORTE_MEXICO;
}

export function construirEnlaceSoporteWhatsApp(params: {
  pais: Pais;
  nombreSalon: string;
  nombreResponsable?: string | null;
}): string {
  const mensaje = [
    `Hola, soy ${obtenerPrimerNombre(params.nombreResponsable)} del salón ${params.nombreSalon}.`,
    'Necesito ayuda con la configuración o soporte operativo en Beauty Time Pro.',
  ].join(' ');

  return `https://wa.me/${obtenerNumeroSoporteWhatsApp(params.pais)}?text=${encodeURIComponent(mensaje)}`;
}