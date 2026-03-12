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
