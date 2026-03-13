import React from 'react';
import ReactDOM from 'react-dom/client';
import { Enrutador } from './src/app/enrutador';
import { Proveedores } from './src/app/proveedores';
import { LimiteError } from './src/componentes/ui/LimiteError';
// Tailwind CSS v4 — debe importarse antes que styles.css
import './src/index.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LimiteError>
      <Proveedores>
        <Enrutador />
      </Proveedores>
    </LimiteError>
  </React.StrictMode>
);
