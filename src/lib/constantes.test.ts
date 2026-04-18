import { describe, expect, it } from 'vitest';
import { CATALOGO_SERVICIOS, obtenerEtiquetaServicioCatalogo } from './constantes';

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

  it('mantiene completo el catálogo base de creación de salón', () => {
    expect(CATALOGO_SERVICIOS).toEqual({
      Cabello: [
        'Babylights',
        'Tono base',
        'Matiz / Baño de Color',
        'Tinte Global',
        'Retoque de Canas',
        'Balayage',
        'Corte Dama / Niña',
        'Curly / Alaciado Express',
        'Ombré',
        'Falso Crecimiento',
        'Corte Caballero / Niño',
      ],
      'Pestañas y Cejas': [
        'Retoque de Extensiones',
        'Retiro de Extensiones',
        'Brow lamination',
        'Laminado de Ceja',
        'Diseño de Ceja',
        'Lash Lifting',
      ],
      Depilación: ['Depilación'],
      Micropigmentación: [
        'Retoque de Microshading',
        'Retoque de Microblading',
        'Punteado de Pestañas',
        'Microshading',
        'Microblading',
        'Delineado de Párpados',
        'Baby Lips',
      ],
      'Maquillaje y Peinado': ['Maquillaje de Fiesta', 'Maquillaje Casual', 'Peinado'],
      'Manos y Pies': [
        'Pedi Spa',
        'Pedi Express',
        'Mani Spa',
        'Mani Express',
        'Gel Semi Permanente',
        'Babyboomer',
        'Uñas Esculturales',
        'Uñas Acrílicas',
        'Retoque de Acrílico',
        'Retiro de Gel',
        'Retiro de Acrílico',
        'Baño de Acrílico o poligel',
      ],
      Otros: [],
    });
  });
});
