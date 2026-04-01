function obtenerCryptoSeguro(): Crypto {
  if (!globalThis.crypto) {
    throw new Error('Crypto seguro no disponible en este entorno');
  }

  return globalThis.crypto;
}

function obtenerEnteroAleatorioSeguro(maximoExclusivo: number): number {
  if (!Number.isInteger(maximoExclusivo) || maximoExclusivo <= 0) {
    throw new Error('maximoExclusivo debe ser un entero positivo');
  }

  const cryptoSeguro = obtenerCryptoSeguro();
  const arreglo = new Uint32Array(1);
  const limite = Math.floor(0x100000000 / maximoExclusivo) * maximoExclusivo;

  do {
    cryptoSeguro.getRandomValues(arreglo);
  } while (arreglo[0]! >= limite);

  return arreglo[0]! % maximoExclusivo;
}

function mezclarArregloSeguro<T>(valores: T[]): T[] {
  const copia = [...valores];

  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const destino = obtenerEnteroAleatorioSeguro(indice + 1);
    [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
  }

  return copia;
}

export function generarContrasenaSegura(longitud: number = 12): string {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%&*';
  const mezcla = `${mayusculas}${minusculas}${numeros}${especiales}`;

  const base = [
    mayusculas[obtenerEnteroAleatorioSeguro(mayusculas.length)]!,
    minusculas[obtenerEnteroAleatorioSeguro(minusculas.length)]!,
    numeros[obtenerEnteroAleatorioSeguro(numeros.length)]!,
    especiales[obtenerEnteroAleatorioSeguro(especiales.length)]!,
  ];

  while (base.length < longitud) {
    base.push(mezcla[obtenerEnteroAleatorioSeguro(mezcla.length)]!);
  }

  return mezclarArregloSeguro(base).join('');
}

export function generarIdSeguro(): string {
  const cryptoSeguro = obtenerCryptoSeguro();
  return typeof cryptoSeguro.randomUUID === 'function'
    ? cryptoSeguro.randomUUID()
    : Array.from(cryptoSeguro.getRandomValues(new Uint8Array(16)))
        .map((valor) => valor.toString(16).padStart(2, '0'))
        .join('');
}
