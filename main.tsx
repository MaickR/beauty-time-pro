import React from 'react';
import ReactDOM from 'react-dom/client';
import { Enrutador } from './src/app/enrutador';
import { Proveedores } from './src/app/proveedores';
// Tailwind CSS v4 — debe importarse antes que styles.css
import './src/index.css';
import './styles.css';

declare global {
  interface Window {
    __ocultarPreloader?: () => void;
  }
}

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
