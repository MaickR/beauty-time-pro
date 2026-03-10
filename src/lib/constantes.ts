/**
 * Constantes globales del dominio — Beauty Time Pro
 *
 * Fuente única de verdad para el catálogo de servicios y los días de la semana.
 * El código legacy en app.tsx mantiene sus propias copias durante la migración;
 * los módulos nuevos importan desde aquí.
 */

// ──────────────────────────────────────────
// Días de la semana (en orden, empezando por Domingo = índice 0)
// ──────────────────────────────────────────
export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

// ──────────────────────────────────────────
// Catálogo de servicios por categoría
// ──────────────────────────────────────────
export const CATALOGO_SERVICIOS: Record<string, readonly string[]> = {
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
} as const;

export type CategoriaServicio = keyof typeof CATALOGO_SERVICIOS;
