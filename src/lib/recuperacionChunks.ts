const CLAVE_REINTENTO_CHUNK = 'btp_recuperacion_chunk_v2';
const MAX_INTENTOS_POR_VENTANA = 2;
const VENTANA_INTENTOS_MS = 60_000;

function leerIntentosRecuperacion(): { intentos: number; ts: number } {
  if (typeof window === 'undefined') {
    return { intentos: 0, ts: 0 };
  }

  try {
    const bruto = window.sessionStorage.getItem(CLAVE_REINTENTO_CHUNK);
    if (!bruto) {
      return { intentos: 0, ts: 0 };
    }

    const parsed = JSON.parse(bruto) as { intentos?: number; ts?: number };
    return {
      intentos: Number.isFinite(parsed.intentos) ? (parsed.intentos as number) : 0,
      ts: Number.isFinite(parsed.ts) ? (parsed.ts as number) : 0,
    };
  } catch {
    return { intentos: 0, ts: 0 };
  }
}

function guardarIntentosRecuperacion(intentos: number, ts: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(CLAVE_REINTENTO_CHUNK, JSON.stringify({ intentos, ts }));
}

function esErrorRecuperable(mensaje: string): boolean {
  return (
    mensaje.includes('Failed to fetch dynamically imported module') ||
    mensaje.includes('Outdated Optimize Dep') ||
    mensaje.includes('ERR_CACHE_READ_FAILURE') ||
    mensaje.includes('Importing a module script failed')
  );
}

function recargarConLimite(origen: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const ahora = Date.now();
  const estado = leerIntentosRecuperacion();
  const dentroVentana = ahora - estado.ts <= VENTANA_INTENTOS_MS;
  const intentosActuales = dentroVentana ? estado.intentos : 0;

  if (intentosActuales >= MAX_INTENTOS_POR_VENTANA) {
    console.error(`[chunks] Fallo persistente tras reintentos de recarga (${origen})`);
    return;
  }

  guardarIntentosRecuperacion(intentosActuales + 1, ahora);
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
    recargarConLimite('vite:preloadError');
  });

  window.addEventListener('error', (evento) => {
    const mensaje = `${String(evento.message ?? '')} ${String(evento.error?.message ?? '')}`;
    if (esErrorRecuperable(mensaje)) {
      recargarConLimite('window:error');
    }
  });

  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason;
    const mensaje =
      motivo instanceof Error
        ? `${motivo.name}: ${motivo.message}`
        : typeof motivo === 'string'
          ? motivo
          : String(motivo ?? '');

    if (esErrorRecuperable(mensaje)) {
      evento.preventDefault();
      recargarConLimite('unhandledrejection');
    }
  });
}
