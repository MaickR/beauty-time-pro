import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { LimiteError } from '../componentes/ui/LimiteError';
import { ProveedorToast } from '../componentes/ui/ProveedorToast';
import { CapaPreloaderGlobal } from '../componentes/ui/PreloaderGlobal';
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

function ArbolProtegido({ children }: PropsWithChildren) {
  const ubicacion = useLocation();

  return <LimiteError key={ubicacion.pathname}>{children}</LimiteError>;
}

export function Proveedores({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={clienteConsulta}>
      <BrowserRouter>
        <ProveedorContextoApp>
          <AplicadorTema />
          <CapaPreloaderGlobal>
            <ArbolProtegido>
              <ProveedorToast>{children}</ProveedorToast>
            </ArbolProtegido>
          </CapaPreloaderGlobal>
        </ProveedorContextoApp>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
