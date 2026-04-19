import { asegurarColumnaTabla } from './compatibilidadEsquema.js';
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
  const [porcentajeComision, porcentajeComisionPro] = await Promise.all([
    asegurarCampoPorcentajeComisionUsuario(),
    asegurarCampoPorcentajeComisionProUsuario(),
  ]);

  return {
    porcentajeComision,
    porcentajeComisionPro,
  };
}