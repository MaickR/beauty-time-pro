const CLAVE_REINTENTO_CHUNK = 'btp_recuperacion_chunk_v1';
const MENSAJES_ERROR_CHUNK = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
];

function esErrorCargaChunk(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return MENSAJES_ERROR_CHUNK.some((mensaje) => error.message.includes(mensaje));
}

function recargarUnaSolaVez(origen: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const ultimoIntento = sessionStorage.getItem(CLAVE_REINTENTO_CHUNK);
  if (ultimoIntento === '1') {
    sessionStorage.removeItem(CLAVE_REINTENTO_CHUNK);
    console.error(`[chunks] Fallo persistente tras recarga automatica (${origen})`);
    return;
  }

  sessionStorage.setItem(CLAVE_REINTENTO_CHUNK, '1');
  console.warn(`[chunks] Detectado chunk desactualizado o incompleto (${origen}). Recargando la aplicacion.`);
  window.location.reload();
}

export function instalarRecuperacionDeChunks(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => {
    sessionStorage.removeItem(CLAVE_REINTENTO_CHUNK);
  }, 10000);

  window.addEventListener('vite:preloadError', (evento) => {
    evento.preventDefault();
    recargarUnaSolaVez('vite:preloadError');
  });

  window.addEventListener('error', (evento) => {
    const error = evento.error instanceof Error ? evento.error : null;
    if (esErrorCargaChunk(error)) {
      recargarUnaSolaVez('window.error');
    }
  });

  window.addEventListener('unhandledrejection', (evento) => {
    if (esErrorCargaChunk(evento.reason)) {
      evento.preventDefault();
      recargarUnaSolaVez('unhandledrejection');
    }
  });
}