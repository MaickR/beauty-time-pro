import React from 'react';
import ReactDOM from 'react-dom/client';
import { Enrutador } from './src/app/enrutador';
import { Proveedores } from './src/app/proveedores';
import { instalarRecuperacionDeChunks } from './src/lib/recuperacionChunks';
// Tailwind CSS v4 — debe importarse antes que styles.css
import './src/index.css';
import './styles.css';

declare global {
  interface Window {
    __ocultarPreloader?: () => void;
  }
}

async function limpiarCachesDesarrollo() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((registro) => registro.unregister()));
    }

    if ('caches' in window) {
      const llaves = await window.caches.keys();
      await Promise.all(llaves.map((llave) => window.caches.delete(llave)));
    }
  } catch {
    // En desarrollo no bloqueamos el render por errores de limpieza de cache.
  }
}

instalarRecuperacionDeChunks();
void limpiarCachesDesarrollo();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Proveedores>
      <Enrutador />
    </Proveedores>
  </React.StrictMode>
);

window.requestAnimationFrame(() => {
  window.__ocultarPreloader?.();
});
