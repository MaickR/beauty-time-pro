/**
 * Convierte un color hex a componentes RGB.
 */
function hexArgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const num = parseInt(limpio, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Convierte componentes RGB a color hex.
 */
function rgbAHex(r: number, g: number, b: number): string {
  return (
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
  );
}

/**
 * Oscurece un color hex en un 20%.
 * Reduce la luminosidad HSL en 20 puntos porcentuales.
 */
export function calcularOscuro(hex: string): string {
  const [r, g, b] = hexArgb(hex);

  // RGB → HSL
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  // Reducir lightness un 20%
  l = Math.max(0, l - 0.2);

  // HSL → RGB
  const c2 = (1 - Math.abs(2 * l - 1)) * s;
  const x = c2 * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c2 / 2;

  let r2 = 0,
    g2 = 0,
    b2 = 0;
  if (h < 60) {
    r2 = c2;
    g2 = x;
  } else if (h < 120) {
    r2 = x;
    g2 = c2;
  } else if (h < 180) {
    g2 = c2;
    b2 = x;
  } else if (h < 240) {
    g2 = x;
    b2 = c2;
  } else if (h < 300) {
    r2 = x;
    b2 = c2;
  } else {
    r2 = c2;
    b2 = x;
  }

  return rgbAHex(
    Math.round((r2 + m) * 255),
    Math.round((g2 + m) * 255),
    Math.round((b2 + m) * 255),
  );
}

/**
 * Aclara un color hex mezclándolo con blanco para usarlo en gradientes.
 */
export function colorMasClaro(hex: string, intensidad = 0.24): string {
  const [r, g, b] = hexArgb(hex);
  const mezclar = (canal: number) => Math.round(canal + (255 - canal) * intensidad);
  return rgbAHex(mezclar(r), mezclar(g), mezclar(b));
}
