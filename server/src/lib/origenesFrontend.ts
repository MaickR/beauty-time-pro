function escaparExpresionRegular(valor: string): string {
  return valor.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function normalizarListaPatrones(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((entrada) => entrada.trim())
    .filter(Boolean);
}

function normalizarPatronExacto(patron: string): string | null {
  try {
    return new URL(patron).origin;
  } catch {
    return null;
  }
}

interface PatronComodin {
  protocolo: string;
  host: string;
}

function obtenerPatronComodin(patron: string): PatronComodin | null {
  const coincidencia = patron.match(/^(https?):\/\/([^/]+)$/i);
  if (!coincidencia) {
    return null;
  }

  return {
    protocolo: `${(coincidencia[1] ?? '').toLowerCase()}:`,
    host: (coincidencia[2] ?? '').toLowerCase(),
  };
}

export function extraerOrigenDesdeUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function esPatronOrigenFrontendValido(patron: string): boolean {
  if (!patron.includes('*')) {
    return normalizarPatronExacto(patron) !== null;
  }

  return obtenerPatronComodin(patron) !== null;
}

export function obtenerPatronesOrigenFrontend(
  frontendUrl: string,
  origenesAdicionales?: string,
): string[] {
  const patrones = [frontendUrl, ...normalizarListaPatrones(origenesAdicionales)].map((patron) =>
    patron.includes('*') ? patron.trim() : normalizarPatronExacto(patron) ?? patron.trim(),
  );

  return Array.from(new Set(patrones.filter(Boolean)));
}

export function coincideOrigenConPatron(origen: string, patron: string): boolean {
  const origenNormalizado = extraerOrigenDesdeUrl(origen);
  if (!origenNormalizado) {
    return false;
  }

  if (!patron.includes('*')) {
    return origenNormalizado === (normalizarPatronExacto(patron) ?? patron);
  }

  const patronComodin = obtenerPatronComodin(patron);
  if (!patronComodin) {
    return false;
  }

  const origenUrl = new URL(origenNormalizado);
  if (origenUrl.protocol !== patronComodin.protocolo) {
    return false;
  }

  const expresionHost = new RegExp(
    `^${escaparExpresionRegular(patronComodin.host).replace(/\*/g, '.*')}$`,
    'i',
  );

  return expresionHost.test(origenUrl.host.toLowerCase());
}

export function tieneOrigenFrontendPermitido(
  origen: string | undefined,
  patrones: string[],
): boolean {
  if (!origen) {
    return false;
  }

  return patrones.some((patron) => coincideOrigenConPatron(origen, patron));
}