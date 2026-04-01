import { peticion } from '../lib/clienteHTTP';

export interface Producto {
  id: string;
  estudioId: string;
  nombre: string;
  categoria: string;
  precio: number; // centavos
  activo: boolean;
  creadoEn: string;
}

export interface CrearProductoPayload {
  nombre: string;
  categoria?: string;
  precio: number; // centavos
}

export interface EditarProductoPayload {
  nombre?: string;
  categoria?: string;
  precio?: number;
  activo?: boolean;
}

export async function obtenerProductos(estudioId: string): Promise<Producto[]> {
  const respuesta = await peticion<{ datos: Producto[] }>(`/estudio/${estudioId}/productos`);
  return respuesta.datos;
}

export async function crearProducto(
  estudioId: string,
  datos: CrearProductoPayload,
): Promise<Producto> {
  const respuesta = await peticion<{ datos: Producto }>(`/estudio/${estudioId}/productos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return respuesta.datos;
}

export async function editarProducto(
  estudioId: string,
  productoId: string,
  datos: EditarProductoPayload,
): Promise<Producto> {
  const respuesta = await peticion<{ datos: Producto }>(
    `/estudio/${estudioId}/productos/${productoId}`,
    { method: 'PUT', body: JSON.stringify(datos) },
  );
  return respuesta.datos;
}

export async function eliminarProducto(estudioId: string, productoId: string): Promise<void> {
  await peticion(`/estudio/${estudioId}/productos/${productoId}`, {
    method: 'DELETE',
  });
}
