/**
 * Sanitización de texto libre para prevenir XSS antes de guardar en BD.
 * Además normaliza Unicode y corrige los casos más comunes de texto mal codificado.
 */
const PATRONES_MOJIBAKE: Array<[RegExp, string]> = [
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ã­/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã/g, 'Á'],
  [/Ã‰/g, 'É'],
  [/Ã/g, 'Í'],
  [/Ã“/g, 'Ó'],
  [/Ãš/g, 'Ú'],
  [/Ã±/g, 'ñ'],
  [/Ã‘/g, 'Ñ'],
  [/Ã¼/g, 'ü'],
  [/Ãœ/g, 'Ü'],
  [/â/g, '’'],
  [/â/g, '“'],
  [/â/g, '”'],
  [/â/g, '–'],
  [/â/g, '—'],
  [/Â/g, ''],
];

function contarIndicadoresRotos(texto: string): number {
  return (texto.match(/[ÃÂâ�]/g) ?? []).length;
}

function repararTextoMojibake(texto: string): string {
  let reparado = texto;

  for (const [patron, reemplazo] of PATRONES_MOJIBAKE) {
    reparado = reparado.replace(patron, reemplazo);
  }

  if (/[ÃÂâ]/.test(reparado)) {
    try {
      const decodificado = Buffer.from(reparado, 'latin1').toString('utf8');
      if (contarIndicadoresRotos(decodificado) < contarIndicadoresRotos(reparado)) {
        reparado = decodificado;
      }
    } catch {
      // Si no puede decodificarse, se conserva el valor actual.
    }
  }

  return reparado.replace(/\uFFFD/g, '');
}

export function sanitizarTexto(texto: string): string {
  return repararTextoMojibake(texto)
    .replace(/<[^>]*>/g, '')
    .normalize('NFC')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
