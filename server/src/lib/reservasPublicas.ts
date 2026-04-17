export interface ProductoSeleccionadoReservaPublica {
  productoId: string;
  cantidad: number;
}

export interface ProductoCatalogoReservaPublica {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
}

export interface ProductoAdicionalReservaPublica {
  id: string;
  nombre: string;
  categoria: string | null;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export function resolverSucursalReserva(
  nombreEstudio: string,
  sucursalSolicitada?: string | null,
): string {
  const sucursal = typeof sucursalSolicitada === 'string' ? sucursalSolicitada.trim() : '';
  return sucursal || nombreEstudio.trim();
}

export function obtenerIdsProductosReserva(
  productosSeleccionados: ProductoSeleccionadoReservaPublica[],
): string[] {
  return Array.from(
    new Set(productosSeleccionados.map((producto) => producto.productoId.trim()).filter(Boolean)),
  );
}

export function normalizarProductosAdicionalesReserva(params: {
  planEstudio: string;
  productosSeleccionados: ProductoSeleccionadoReservaPublica[];
  productosCatalogo: ProductoCatalogoReservaPublica[];
}): ProductoAdicionalReservaPublica[] {
  const { planEstudio, productosSeleccionados, productosCatalogo } = params;

  if (productosSeleccionados.length === 0) {
    return [];
  }

  if (planEstudio !== 'PRO') {
    throw new Error('PLAN_SIN_PRODUCTOS');
  }

  const mapaProductos = new Map(productosCatalogo.map((producto) => [producto.id, producto]));

  return productosSeleccionados.map((productoSeleccionado) => {
    const productoCatalogo = mapaProductos.get(productoSeleccionado.productoId.trim());
    if (!productoCatalogo) {
      throw new Error('PRODUCTO_NO_DISPONIBLE');
    }

    return {
      id: productoCatalogo.id,
      nombre: productoCatalogo.nombre,
      categoria: productoCatalogo.categoria,
      cantidad: productoSeleccionado.cantidad,
      precioUnitario: productoCatalogo.precio,
      total: productoCatalogo.precio * productoSeleccionado.cantidad,
    };
  });
}