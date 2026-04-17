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

export interface RegistrarVentaProductoPayload {
  productoId: string;
  cantidad: number;
  empleadoId?: string;
  clienteNombre?: string;
  sucursal?: string;
  fecha?: string;
  hora?: string;
  observaciones?: string;
}

export interface VentaProductoRegistrada {
  id: string;
  estudioId: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  total: number;
  moneda: string;
  fecha: string;
  hora: string;
  empleadoId: string | null;
  empleadoNombre: string | null;
  clienteNombre: string;
  sucursal: string;
  observaciones: string | null;
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

export async function registrarVentaProducto(
  estudioId: string,
  datos: RegistrarVentaProductoPayload,
): Promise<VentaProductoRegistrada> {
  const respuesta = await peticion<{ datos: VentaProductoRegistrada }>(
    `/estudio/${estudioId}/productos/ventas`,
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );
  return respuesta.datos;
}
