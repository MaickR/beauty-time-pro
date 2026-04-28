import { peticion } from '../lib/clienteHTTP';

export interface MensajeMasivo {
  id: string;
  estudioId: string;
  titulo: string;
  texto: string;
  imagenUrl: string | null;
  fechaEnvio: string;
  enviado: boolean;
  creadoEn: string;
}

export interface DatosMensajesMasivos {
  mensajes: MensajeMasivo[];
  usados: number;
  limite: number;
  extra: number;
}

export interface CrearMensajeMasivoPayload {
  titulo: string;
  texto: string;
  imagenUrl?: string;
  segmento?: 'todos' | 'activos' | 'inactivos';
  incluirEmpleados?: boolean;
  correosExtra?: string[];
}

export async function subirImagenMensajeMasivo(estudioId: string, archivo: File): Promise<string> {
  const datos = new FormData();
  datos.append('archivo', archivo);

  const respuesta = await peticion<{ datos: { imagenUrl: string } }>(
    `/estudio/${estudioId}/mensajes-masivos/imagen`,
    {
      method: 'POST',
      body: datos,
    },
  );

  return respuesta.datos.imagenUrl;
}

export async function obtenerMensajesMasivos(estudioId: string): Promise<DatosMensajesMasivos> {
  const respuesta = await peticion<{ datos: DatosMensajesMasivos }>(
    `/estudio/${estudioId}/mensajes-masivos`,
  );
  return respuesta.datos;
}

export async function enviarMensajeMasivo(
  estudioId: string,
  datos: CrearMensajeMasivoPayload,
): Promise<{ mensaje: string; destinatarios: number; id: string }> {
  const respuesta = await peticion<{
    datos: { mensaje: string; destinatarios: number; id: string };
  }>(`/estudio/${estudioId}/mensajes-masivos`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return respuesta.datos;
}
