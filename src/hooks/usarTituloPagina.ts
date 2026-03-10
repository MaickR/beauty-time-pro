import { useEffect } from 'react';

/**
 * Establece el <title> del documento mientras el componente está montado.
 * Al desmontar restaura el título base de la aplicación.
 */
export function usarTituloPagina(titulo: string): void {
  useEffect(() => {
    document.title = `${titulo} | Beauty Time Pro`;
    return () => {
      document.title = 'Beauty Time Pro';
    };
  }, [titulo]);
}
