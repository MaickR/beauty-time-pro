import { useEffect } from 'react';
import { calcularOscuro } from '../utils/color';

const COLOR_DEFAULT = '#C6968C';

interface OpcionesTemaSalon {
  restaurarAlDesmontar?: boolean;
}

/**
 * Aplica el color primario del salón como variables CSS en :root.
 * Si no se proporciona colorPrimario, aplica el valor por defecto.
 */
export function usarTemaSalon(colorPrimario?: string | null, opciones?: OpcionesTemaSalon) {
  useEffect(() => {
    const colorAnterior =
      document.documentElement.style.getPropertyValue('--color-primario').trim() || COLOR_DEFAULT;
    const colorOscuroAnterior =
      document.documentElement.style.getPropertyValue('--color-primario-oscuro').trim() ||
      calcularOscuro(colorAnterior);

    const color = colorPrimario ?? COLOR_DEFAULT;
    document.documentElement.style.setProperty('--color-primario', color);
    document.documentElement.style.setProperty('--color-primario-oscuro', calcularOscuro(color));

    return () => {
      if (!opciones?.restaurarAlDesmontar) {
        return;
      }

      document.documentElement.style.setProperty('--color-primario', colorAnterior);
      document.documentElement.style.setProperty('--color-primario-oscuro', colorOscuroAnterior);
    };
  }, [colorPrimario, opciones?.restaurarAlDesmontar]);
}
