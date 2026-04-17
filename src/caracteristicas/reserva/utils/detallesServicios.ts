import type { Servicio } from '../../../tipos';

export interface CampoDetalleServicio {
  clave: string;
  etiqueta: string;
  placeholder: string;
  tipo: 'texto' | 'area';
  maximo: number;
}

export interface SeccionDetalleServicio {
  titulo: string;
  descripcion: string;
  campos: CampoDetalleServicio[];
}

interface PlantillaDetalleServicio extends SeccionDetalleServicio {
  palabrasClave: string[];
}

const MAXIMO_NOTA_SERVICIO = 180;

const plantillasDetalleServicio: PlantillaDetalleServicio[] = [
  {
    palabrasClave: [
      'tinte',
      'color',
      'balayage',
      'babylights',
      'canas',
      'ombre',
      'decoloracion',
      'rayitos',
      'mechas',
    ],
    titulo: 'Detalles opcionales de coloración',
    descripcion: 'Comparte referencias rápidas para que el salón prepare mejor tu servicio.',
    campos: [
      {
        clave: 'marca',
        etiqueta: 'Marca o línea preferida',
        placeholder: 'Ej: Wella, L’Oréal, Igora',
        tipo: 'texto',
        maximo: 40,
      },
      {
        clave: 'tono',
        etiqueta: 'Tono o referencia deseada',
        placeholder: 'Ej: 7.1, beige cenizo, miel',
        tipo: 'texto',
        maximo: 55,
      },
    ],
  },
  {
    palabrasClave: ['manicure', 'pedicure', 'unas', 'gelish', 'acrilico', 'rubber'],
    titulo: 'Detalles opcionales de uñas',
    descripcion: 'Indica la forma, largo o acabado que prefieres si ya lo tienes definido.',
    campos: [
      {
        clave: 'acabado',
        etiqueta: 'Forma, largo o acabado',
        placeholder: 'Ej: Almendra corta, francesa, natural',
        tipo: 'texto',
        maximo: 60,
      },
      {
        clave: 'diseno',
        etiqueta: 'Color o diseño deseado',
        placeholder: 'Ej: Nude con brillo, rojo clásico',
        tipo: 'texto',
        maximo: 60,
      },
    ],
  },
  {
    palabrasClave: ['corte', 'peinado', 'brushing', 'barba', 'cabello'],
    titulo: 'Detalles opcionales de estilo',
    descripcion: 'Cuéntale al especialista el resultado que esperas para ahorrar tiempo en la cita.',
    campos: [
      {
        clave: 'resultado',
        etiqueta: 'Resultado que buscas',
        placeholder: 'Ej: Despuntar, capas largas, fade bajo',
        tipo: 'texto',
        maximo: 70,
      },
      {
        clave: 'referencia',
        etiqueta: 'Referencia adicional',
        placeholder: 'Ej: Mantener volumen arriba, sin tocar fleco',
        tipo: 'texto',
        maximo: 70,
      },
    ],
  },
  {
    palabrasClave: ['facial', 'limpieza', 'piel', 'skincare', 'microdermoabrasion'],
    titulo: 'Detalles opcionales de cuidado facial',
    descripcion: 'Comparte sensibilidad, objetivo o productos que prefieres evitar.',
    campos: [
      {
        clave: 'objetivo',
        etiqueta: 'Objetivo o necesidad principal',
        placeholder: 'Ej: Hidratación, manchas, acné leve',
        tipo: 'texto',
        maximo: 70,
      },
      {
        clave: 'sensibilidad',
        etiqueta: 'Sensibilidad o alergia relevante',
        placeholder: 'Ej: Piel sensible al ácido glicólico',
        tipo: 'texto',
        maximo: 70,
      },
    ],
  },
  {
    palabrasClave: ['cejas', 'pestanas', 'pestañas', 'lifting', 'laminado', 'maquillaje'],
    titulo: 'Detalles opcionales del acabado',
    descripcion: 'Si ya tienes una idea clara del efecto final, compártela aquí.',
    campos: [
      {
        clave: 'efecto',
        etiqueta: 'Efecto o estilo deseado',
        placeholder: 'Ej: Natural, definido, volumen medio',
        tipo: 'texto',
        maximo: 70,
      },
      {
        clave: 'cuidado',
        etiqueta: 'Dato importante para el servicio',
        placeholder: 'Ej: Ojos sensibles, uso lentes de contacto',
        tipo: 'texto',
        maximo: 70,
      },
    ],
  },
  {
    palabrasClave: ['depilacion', 'depilación', 'wax', 'laser'],
    titulo: 'Detalles opcionales del cuidado previo',
    descripcion: 'Comparte sensibilidad o una indicación relevante antes de la cita.',
    campos: [
      {
        clave: 'cuidado',
        etiqueta: 'Sensibilidad o cuidado previo',
        placeholder: 'Ej: Piel sensible, última sesión reciente',
        tipo: 'texto',
        maximo: 80,
      },
    ],
  },
];

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function obtenerClaveServicioReserva(servicio: Pick<Servicio, 'name'> | string): string {
  const nombre = typeof servicio === 'string' ? servicio : servicio.name;
  return normalizarTexto(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function obtenerSeccionDetalleServicio(
  servicio: Pick<Servicio, 'name' | 'category'>,
): SeccionDetalleServicio {
  const referencia = `${servicio.name} ${servicio.category ?? ''}`;
  const referenciaNormalizada = normalizarTexto(referencia);
  const plantilla = plantillasDetalleServicio.find((opcion) =>
    opcion.palabrasClave.some((palabraClave) => referenciaNormalizada.includes(normalizarTexto(palabraClave))),
  );

  if (plantilla) {
    return {
      titulo: plantilla.titulo,
      descripcion: plantilla.descripcion,
      campos: plantilla.campos,
    };
  }

  return {
    titulo: `Detalles opcionales de ${servicio.name}`,
    descripcion: 'Si deseas dejar una indicación adicional para este servicio, puedes hacerlo aquí.',
    campos: [
      {
        clave: 'nota',
        etiqueta: 'Detalle opcional para este servicio',
        placeholder: `Ej: Preferencia o referencia para ${servicio.name}`,
        tipo: 'area',
        maximo: 120,
      },
    ],
  };
}

function limpiarValorDetalle(valor: string, maximo: number): string {
  return valor.replace(/\s+/g, ' ').trim().slice(0, maximo);
}

export function construirNotaServicio(
  servicio: Pick<Servicio, 'name' | 'category'>,
  valores: Record<string, string> | undefined,
): string | null {
  if (!valores) return null;

  const seccion = obtenerSeccionDetalleServicio(servicio);
  const segmentos = seccion.campos.flatMap((campo) => {
    const valor = limpiarValorDetalle(valores[campo.clave] ?? '', campo.maximo);
    if (!valor) return [];
    return [`${campo.etiqueta}: ${valor}`];
  });

  if (segmentos.length === 0) return null;

  let nota = '';
  for (const segmento of segmentos) {
    const siguiente = nota ? `${nota}. ${segmento}` : segmento;
    if (siguiente.length <= MAXIMO_NOTA_SERVICIO) {
      nota = siguiente;
      continue;
    }

    nota = siguiente.slice(0, MAXIMO_NOTA_SERVICIO).trim();
    break;
  }

  return nota || null;
}