import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { ProveedorToast } from '../componentes/ui/ProveedorToast';
import { ProveedorContextoApp, usarContextoApp } from '../contextos/ContextoApp';
import { clienteConsulta } from '../lib/clienteConsulta';
import { usarTiendaAuth } from '../tienda/tiendaAuth';
import { usarTemaSalon } from '../hooks/usarTemaSalon';

function AplicadorTema() {
  const { estudios } = usarContextoApp();
  const estudioActual = usarTiendaAuth((s) => s.estudioActual);
  const estudio = estudios.find((e) => e.id === estudioActual);
  usarTemaSalon(estudio?.colorPrimario);
  return null;
}

export function Proveedores({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={clienteConsulta}>
      <BrowserRouter>
        <ProveedorContextoApp>
          <AplicadorTema />
          <ProveedorToast>{children}</ProveedorToast>
        </ProveedorContextoApp>
      </BrowserRouter>
    </QueryClientProvider>
  );
}