import crypto from 'node:crypto';
import { prisma } from '../prismaCliente.js';
import { env } from './env.js';

export type TipoSujetoSesion = 'usuario' | 'cliente_app' | 'empleado_acceso';

interface MetadatosSesion {
  ip?: string;
  userAgent?: string;
}

interface TokensSesionRotada {
  sesionId: string;
  refreshTokenId: string;
  csrfToken: string;
  expiraEn: Date;
}

function convertirDuracionAMilisegundos(valor: string): number {
  const coincidencia = valor.trim().match(/^(\d+)([smhd])$/i);
  if (!coincidencia) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const cantidad = Number(coincidencia[1]);
  const unidad = (coincidencia[2] ?? 'd').toLowerCase();

  switch (unidad) {
    case 's':
      return cantidad * 1000;
    case 'm':
      return cantidad * 60 * 1000;
    case 'h':
      return cantidad * 60 * 60 * 1000;
    case 'd':
      return cantidad * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function generarSecretoSeguro(longitud = 32): string {
  return crypto.randomBytes(longitud).toString('hex');
}

export function hashValorSesion(valor: string): string {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

function obtenerExpiracionRefresh(): Date {
  return new Date(Date.now() + convertirDuracionAMilisegundos(env.JWT_REFRESH_EXPIRA_EN));
}

export async function crearSesionAutenticacion(
  sujetoTipo: TipoSujetoSesion,
  sujetoId: string,
  metadatos?: MetadatosSesion,
): Promise<TokensSesionRotada> {
  const refreshTokenId = generarSecretoSeguro();
  const csrfToken = generarSecretoSeguro();
  const expiraEn = obtenerExpiracionRefresh();

  const sesion = await prisma.sesionAutenticacion.create({
    data: {
      sujetoTipo,
      sujetoId,
      refreshTokenHash: hashValorSesion(refreshTokenId),
      csrfTokenHash: hashValorSesion(csrfToken),
      ip: metadatos?.ip ?? null,
      userAgent: metadatos?.userAgent ?? null,
      expiraEn,
    },
    select: { id: true },
  });

  return {
    sesionId: sesion.id,
    refreshTokenId,
    csrfToken,
    expiraEn,
  };
}

export async function obtenerSesionActiva(sesionId: string) {
  const sesion = await prisma.sesionAutenticacion.findUnique({
    where: { id: sesionId },
  });

  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= new Date()) {
    return null;
  }

  return sesion;
}

export async function validarRefreshSesion(params: {
  sesionId: string;
  refreshTokenId: string;
  csrfToken: string;
}): Promise<boolean> {
  const sesion = await obtenerSesionActiva(params.sesionId);
  if (!sesion) {
    return false;
  }

  return (
    sesion.refreshTokenHash === hashValorSesion(params.refreshTokenId) &&
    sesion.csrfTokenHash === hashValorSesion(params.csrfToken)
  );
}

export async function rotarSesionAutenticacion(
  sesionId: string,
  refreshTokenIdActual: string,
  csrfTokenActual: string,
  metadatos?: MetadatosSesion,
): Promise<TokensSesionRotada | null> {
  const sesion = await obtenerSesionActiva(sesionId);
  if (!sesion) {
    return null;
  }

  if (
    sesion.refreshTokenHash !== hashValorSesion(refreshTokenIdActual) ||
    sesion.csrfTokenHash !== hashValorSesion(csrfTokenActual)
  ) {
    return null;
  }

  const refreshTokenId = generarSecretoSeguro();
  const csrfToken = generarSecretoSeguro();
  const expiraEn = obtenerExpiracionRefresh();

  await prisma.sesionAutenticacion.update({
    where: { id: sesionId },
    data: {
      refreshTokenHash: hashValorSesion(refreshTokenId),
      csrfTokenHash: hashValorSesion(csrfToken),
      expiraEn,
      ultimoUsoEn: new Date(),
      ip: metadatos?.ip ?? sesion.ip,
      userAgent: metadatos?.userAgent ?? sesion.userAgent,
    },
  });

  return {
    sesionId,
    refreshTokenId,
    csrfToken,
    expiraEn,
  };
}

export async function revocarSesionAutenticacion(
  sesionId: string,
  motivoRevocacion: string,
): Promise<void> {
  await prisma.sesionAutenticacion.updateMany({
    where: { id: sesionId, revocadaEn: null },
    data: { revocadaEn: new Date(), motivoRevocacion },
  });
}

export async function revocarSesionesPorSujeto(
  sujetoTipo: TipoSujetoSesion,
  sujetoId: string,
  motivoRevocacion: string,
): Promise<void> {
  await prisma.sesionAutenticacion.updateMany({
    where: {
      sujetoTipo,
      sujetoId,
      revocadaEn: null,
    },
    data: {
      revocadaEn: new Date(),
      motivoRevocacion,
    },
  });
}

export async function registrarUsoSesion(sesionId: string): Promise<void> {
  await prisma.sesionAutenticacion.updateMany({
    where: { id: sesionId, revocadaEn: null },
    data: { ultimoUsoEn: new Date() },
  });
}

export function generarCodigoAlfanumerico(longitud = 4): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';

  for (let indice = 0; indice < longitud; indice += 1) {
    const posicion = crypto.randomInt(0, caracteres.length);
    codigo += caracteres[posicion];
  }

  return codigo;
}
