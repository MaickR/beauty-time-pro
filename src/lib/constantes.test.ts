import { describe, expect, it } from 'vitest';
import { obtenerEtiquetaServicioCatalogo } from './constantes';

describe('constantes del catálogo', () => {
  it('traduce al español los servicios base que aún estaban visibles en inglés', () => {
    expect(obtenerEtiquetaServicioCatalogo('Brow lamination')).toBe('Laminado de cejas');
    expect(obtenerEtiquetaServicioCatalogo('Lash Lifting')).toBe('Lifting de pestañas');
    expect(obtenerEtiquetaServicioCatalogo('Pedi Express')).toBe('Pedicure exprés');
  });

  it('mantiene intactos los nombres que ya estaban correctos para el catálogo interno', () => {
    expect(obtenerEtiquetaServicioCatalogo('Balayage')).toBe('Balayage');
    expect(obtenerEtiquetaServicioCatalogo('Retoque de Canas')).toBe('Retoque de Canas');
  });
});