function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extraerNombresServicios(servicios: unknown): string[] {
  if (!Array.isArray(servicios)) return [];

  return servicios.flatMap((servicio) => {
    if (typeof servicio === 'string') return [servicio];

    if (typeof servicio === 'object' && servicio !== null) {
      const nombre = 'name' in servicio && typeof servicio.name === 'string' ? servicio.name : null;
      const categoria = 'category' in servicio && typeof servicio.category === 'string' ? servicio.category : null;
      return [categoria, nombre].filter((valor): valor is string => Boolean(valor));
    }

    return [];
  });
}

function aCategoriaCanonica(valor: string): string | null {
  const texto = normalizarTexto(valor);
  if (!texto) return null;

  const mapaCategorias = [
    { etiqueta: 'Corte', palabras: ['corte', 'caballero', 'nino', 'niño', 'barber', 'barba', 'peinado'] },
    { etiqueta: 'Color', palabras: ['color', 'tinte', 'balayage', 'babylights', 'canas', 'cañas', 'ombre', 'mechas', 'decolor', 'matiz'] },
    { etiqueta: 'Tratamiento', palabras: ['tratamiento', 'keratina', 'hidrat', 'botox', 'reconstru', 'curly', 'alaciado'] },
    { etiqueta: 'Uñas', palabras: ['unas', 'uñas', 'mani', 'pedi', 'gel', 'acril', 'poligel', 'manos y pies'] },
    { etiqueta: 'Maquillaje', palabras: ['maquillaje', 'makeup', 'cejas', 'pestanas', 'pestañas', 'microblading', 'microshading', 'lashes', 'brow'] },
    { etiqueta: 'Depilación', palabras: ['depil', 'cera', 'laser'] },
  ];

  for (const categoria of mapaCategorias) {
    if (categoria.palabras.some((palabra) => texto.includes(normalizarTexto(palabra)))) {
      return categoria.etiqueta;
    }
  }

  return null;
}

function extraerCategoriasTexto(categorias: string | null | undefined): string[] {
  if (!categorias) return [];

  return categorias
    .split(',')
    .map((categoria) => aCategoriaCanonica(categoria) ?? categoria.trim())
    .filter(Boolean);
}

export function resolverCategoriasSalon({
  categorias,
  servicios,
  serviciosCustom,
}: {
  categorias?: string | null;
  servicios?: unknown;
  serviciosCustom?: unknown;
}): string | null {
  const categoriasDetectadas = [
    ...extraerCategoriasTexto(categorias),
    ...extraerNombresServicios(servicios).map((valor) => aCategoriaCanonica(valor)).filter((valor): valor is string => Boolean(valor)),
    ...extraerNombresServicios(serviciosCustom).map((valor) => aCategoriaCanonica(valor)).filter((valor): valor is string => Boolean(valor)),
  ];

  const categoriasUnicas = Array.from(new Set(categoriasDetectadas.filter((categoria) => categoria !== 'Otro')));
  return categoriasUnicas.length > 0 ? categoriasUnicas.join(', ') : null;
}