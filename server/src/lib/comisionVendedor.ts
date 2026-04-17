import { asegurarColumnaTabla } from './compatibilidadEsquema.js';
export {
  calcularComisionVendedor,
  PORCENTAJE_COMISION_BASE,
  resolverPorcentajeComisionVendedor,
  estudioTienePagoPendiente,
  normalizarPorcentajeComision,
} from './comisionVendedorReglas.js';
import { normalizarPorcentajeComision } from './comisionVendedorReglas.js';

export async function asegurarCampoPorcentajeComisionUsuario(): Promise<boolean> {
  return asegurarColumnaTabla('usuarios', 'porcentajeComision', 'INT NOT NULL DEFAULT 10');
}