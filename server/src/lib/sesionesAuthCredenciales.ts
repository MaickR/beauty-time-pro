import crypto from 'node:crypto';

export type SesionConCredencialesHash = {
  refreshTokenHash: string;
  csrfTokenHash: string;
};

export type ResultadoValidacionCredencialesSesion =
  | 'valida'
  | 'refresh_invalido'
  | 'csrf_invalido';

export function hashValorSesion(valor: string): string {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

export function validarCredencialesSesion(
  sesion: SesionConCredencialesHash,
  refreshTokenId: string,
  csrfToken: string,
): ResultadoValidacionCredencialesSesion {
  if (sesion.refreshTokenHash !== hashValorSesion(refreshTokenId)) {
    return 'refresh_invalido';
  }

  if (sesion.csrfTokenHash !== hashValorSesion(csrfToken)) {
    return 'csrf_invalido';
  }

  return 'valida';
}