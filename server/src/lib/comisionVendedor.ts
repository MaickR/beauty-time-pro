import { asegurarColumnaTabla, obtenerColumnasTabla } from './compatibilidadEsquema.js';
export {
  calcularComisionVendedor,
  PORCENTAJE_COMISION_BASE,
  resolverPorcentajeComisionVendedor,
  resolverPorcentajesComisionVendedor,
  resolverPorcentajeComisionSegunPlan,
  estudioTienePagoPendiente,
  normalizarPorcentajeComision,
} from './comisionVendedorReglas.js';
import { normalizarPorcentajeComision } from './comisionVendedorReglas.js';

export async function asegurarCampoPorcentajeComisionUsuario(): Promise<boolean> {
  return asegurarColumnaTabla('usuarios', 'porcentajeComision', 'INT NOT NULL DEFAULT 10');
}

export async function asegurarCampoPorcentajeComisionProUsuario(): Promise<boolean> {
  return asegurarColumnaTabla('usuarios', 'porcentajeComisionPro', 'INT NOT NULL DEFAULT 10');
}

export async function asegurarCamposComisionVendedorUsuario(): Promise<{
  porcentajeComision: boolean;
  porcentajeComisionPro: boolean;
}> {
  const columnasIniciales = await obtenerColumnasTabla('usuarios');

  if (!columnasIniciales.has('porcentajeComision')) {
    await asegurarCampoPorcentajeComisionUsuario().catch((error) => {
      console.warn('[comisionVendedor] No se pudo asegurar columna porcentajeComision:', error);
      return false;
    });
  }

  if (!columnasIniciales.has('porcentajeComisionPro')) {
    await asegurarCampoPorcentajeComisionProUsuario().catch((error) => {
      console.warn('[comisionVendedor] No se pudo asegurar columna porcentajeComisionPro:', error);
      return false;
    });
  }

  const columnasFinales = await obtenerColumnasTabla('usuarios');
  const porcentajeComision = columnasFinales.has('porcentajeComision');
  const porcentajeComisionPro = columnasFinales.has('porcentajeComisionPro');

  return {
    porcentajeComision,
    porcentajeComisionPro,
  };
}