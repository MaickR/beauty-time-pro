const CLAVE_REINTENTO_CHUNK = 'btp_recuperacion_chunk_v1';
function recargarUnaSolaVez(origen: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const ultimoIntento = sessionStorage.getItem(CLAVE_REINTENTO_CHUNK);
  if (ultimoIntento === '1') {
    console.error(`[chunks] Fallo persistente tras recarga automatica (${origen})`);
    return;
  }

  sessionStorage.setItem(CLAVE_REINTENTO_CHUNK, '1');
  console.warn(
    `[chunks] Detectado chunk desactualizado o incompleto (${origen}). Recargando la aplicacion.`,
  );
  window.location.reload();
}

export function instalarRecuperacionDeChunks(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('vite:preloadError', (evento) => {
    evento.preventDefault();
    recargarUnaSolaVez('vite:preloadError');
  });
}
