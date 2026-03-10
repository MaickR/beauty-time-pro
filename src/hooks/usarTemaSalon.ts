import { useEffect } from 'react';
import { calcularOscuro } from '../utils/color';

const COLOR_DEFAULT = '#C2185B';

/**
 * Aplica el color primario del salón como variables CSS en :root.
 * Si no se proporciona colorPrimario, aplica el valor por defecto.
 */
export function usarTemaSalon(colorPrimario?: string | null) {
  useEffect(() => {
    const color = colorPrimario ?? COLOR_DEFAULT;
    document.documentElement.style.setProperty('--color-primario', color);
    document.documentElement.style.setProperty('--color-primario-oscuro', calcularOscuro(color));
  }, [colorPrimario]);
}
