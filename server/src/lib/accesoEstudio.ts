export interface PayloadAccesoEstudio {
  rol: string;
  estudioId?: string | null;
}

export function tieneAccesoAdministrativoEstudio(
  payload: PayloadAccesoEstudio,
  estudioId: string,
): boolean {
  return (
    payload.rol === 'maestro' ||
    ((payload.rol === 'dueno' || payload.rol === 'vendedor') && payload.estudioId === estudioId)
  );
}

export function tieneAccesoPropietarioDemo(
  payload: PayloadAccesoEstudio,
  estudioId: string,
): boolean {
  return (payload.rol === 'dueno' || payload.rol === 'vendedor') && payload.estudioId === estudioId;
}