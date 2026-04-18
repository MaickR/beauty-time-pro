export function construirUrlArchivo(ruta: string | null | undefined): string | null {
  if (!ruta) return null;

  if (
    ruta.startsWith('http://') ||
    ruta.startsWith('https://') ||
    ruta.startsWith('blob:') ||
    ruta.startsWith('data:')
  ) {
    return ruta;
  }

  const baseApi = import.meta.env.VITE_URL_API.replace(/\/$/, '');
  const rutaNormalizada = ruta.startsWith('/') ? ruta : `/${ruta}`;

  return `${baseApi}${rutaNormalizada}`;
}

const MESES_ARCHIVO = [
  'ener',
  'febr',
  'marz',
  'abri',
  'mayo',
  'juni',
  'juli',
  'agos',
  'sept',
  'octu',
  'novi',
  'dici',
] as const;

export function normalizarSegmentoArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function formatearFechaArchivo(fecha: Date = new Date()): string {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = MESES_ARCHIVO[fecha.getMonth()] ?? MESES_ARCHIVO[0];
  const anio = fecha.getFullYear();
  return `${dia}_${mes}_${anio}`;
}

export function construirNombreArchivoExportacion(
  nombreBase: string,
  fecha: Date = new Date(),
  extension = 'xls',
): string {
  const baseNormalizada = normalizarSegmentoArchivo(nombreBase) || 'archivo';
  return `${baseNormalizada}_${formatearFechaArchivo(fecha)}.${extension}`;
}
