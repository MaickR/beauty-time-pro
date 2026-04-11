type RegistroPlano = Record<string, unknown>;

export interface SedeRelacionada {
  id: string;
  nombre: string;
  slug: string | null;
  plan: string;
  estado: string;
  activo: boolean;
  fechaVencimiento: string;
  propietario: string | null;
  telefono: string | null;
  direccion: string | null;
  emailContacto: string | null;
  estudioPrincipalId: string | null;
  permiteReservasPublicas: boolean;
  precioSuscripcionActual: number | null;
  monedaSuscripcion: string | null;
}

function serializarSedePlano(sede: RegistroPlano): SedeRelacionada {
  const precioPlanActual =
    (sede['precioPlanActual'] as RegistroPlano | null | undefined) ?? null;

  return {
    id: (sede['id'] as string) ?? '',
    nombre: (sede['nombre'] as string) ?? '',
    slug: (sede['slug'] as string | null | undefined) ?? null,
    plan: (sede['plan'] as string | undefined) ?? 'STANDARD',
    estado: (sede['estado'] as string | undefined) ?? 'pendiente',
    activo: (sede['activo'] as boolean | undefined) ?? true,
    fechaVencimiento: (sede['fechaVencimiento'] as string | undefined) ?? '',
    propietario: (sede['propietario'] as string | null | undefined) ?? null,
    telefono: (sede['telefono'] as string | null | undefined) ?? null,
    direccion: (sede['direccion'] as string | null | undefined) ?? null,
    emailContacto: (sede['emailContacto'] as string | null | undefined) ?? null,
    estudioPrincipalId: (sede['estudioPrincipalId'] as string | null | undefined) ?? null,
    permiteReservasPublicas:
      (sede['permiteReservasPublicas'] as boolean | undefined) ?? true,
    precioSuscripcionActual:
      (precioPlanActual?.['monto'] as number | undefined) ?? null,
    monedaSuscripcion: (precioPlanActual?.['moneda'] as string | undefined) ?? null,
  };
}

export function obtenerSedesRelacionadas(
  estudio: RegistroPlano,
  sucursalesLegacy: string[] = [],
): SedeRelacionada[] {
  const sedes = Array.isArray(estudio['sedes'])
    ? (estudio['sedes'] as RegistroPlano[]).map(serializarSedePlano)
    : [];

  if (sedes.length > 0) {
    return sedes;
  }

  return sucursalesLegacy
    .filter((sucursal) => sucursal.trim().length > 0)
    .map((sucursal, indice) => ({
      id: `legacy-${indice}`,
      nombre: sucursal,
      slug: null,
      plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
      estado: (estudio['estado'] as string | undefined) ?? 'aprobado',
      activo: (estudio['activo'] as boolean | undefined) ?? true,
      fechaVencimiento: (estudio['fechaVencimiento'] as string | undefined) ?? '',
      propietario: (estudio['propietario'] as string | null | undefined) ?? null,
      telefono: (estudio['telefono'] as string | null | undefined) ?? null,
      direccion: (estudio['direccion'] as string | null | undefined) ?? null,
      emailContacto: (estudio['emailContacto'] as string | null | undefined) ?? null,
      estudioPrincipalId: (estudio['id'] as string | undefined) ?? null,
      permiteReservasPublicas: true,
      precioSuscripcionActual: null,
      monedaSuscripcion: null,
    }));
}

export function obtenerNombresSucursales(
  estudio: RegistroPlano,
  sucursalesLegacy: string[] = [],
): string[] {
  const sedes = obtenerSedesRelacionadas(estudio, sucursalesLegacy);
  if (sedes.length > 0) {
    return sedes.map((sede) => sede.nombre);
  }

  return sucursalesLegacy;
}

export function construirSedesReservables(estudio: RegistroPlano): SedeRelacionada[] {
  const sucursalesLegacy = Array.isArray(estudio['sucursales'])
    ? (estudio['sucursales'] as string[])
    : [];
  const sedes = obtenerSedesRelacionadas(estudio, sucursalesLegacy).filter(
    (sede) => sede.activo && sede.estado === 'aprobado' && sede.permiteReservasPublicas,
  );

  const principal: SedeRelacionada = {
    id: (estudio['id'] as string) ?? '',
    nombre: (estudio['nombre'] as string) ?? '',
    slug: (estudio['slug'] as string | null | undefined) ?? null,
    plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
    estado: (estudio['estado'] as string | undefined) ?? 'aprobado',
    activo: (estudio['activo'] as boolean | undefined) ?? true,
    fechaVencimiento: (estudio['fechaVencimiento'] as string | undefined) ?? '',
    propietario: (estudio['propietario'] as string | null | undefined) ?? null,
    telefono: (estudio['telefono'] as string | null | undefined) ?? null,
    direccion: (estudio['direccion'] as string | null | undefined) ?? null,
    emailContacto: (estudio['emailContacto'] as string | null | undefined) ?? null,
    estudioPrincipalId: (estudio['estudioPrincipalId'] as string | null | undefined) ?? null,
    permiteReservasPublicas:
      (estudio['permiteReservasPublicas'] as boolean | undefined) ?? true,
    precioSuscripcionActual: null,
    monedaSuscripcion: null,
  };

  if (!principal.permiteReservasPublicas || !principal.activo || principal.estado !== 'aprobado') {
    return sedes;
  }

  return [principal, ...sedes];
}
