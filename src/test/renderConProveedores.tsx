import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PropsWithChildren, ReactElement } from 'react';
import { ProveedorToast } from '../componentes/ui/ProveedorToast';

function crearClientePruebas() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface PropsRenderConProveedores extends Omit<RenderOptions, 'wrapper'> {
  rutaInicial?: string;
}

export function renderConProveedores(
  interfaz: ReactElement,
  opciones: PropsRenderConProveedores = {},
) {
  const { rutaInicial = '/', ...resto } = opciones;
  const cliente = crearClientePruebas();

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={[rutaInicial]}>
          <ProveedorToast>{children}</ProveedorToast>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    cliente,
    ...render(interfaz, { wrapper: Wrapper, ...resto }),
  };
}