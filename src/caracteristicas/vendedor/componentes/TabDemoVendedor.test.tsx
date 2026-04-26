import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores } from '../../../test/renderConProveedores';
import { TabDemoVendedor } from './TabDemoVendedor';

const obtenerSalonDemoVendedor = vi.fn();
const reiniciarSalonDemoVendedor = vi.fn();
const actualizarPlanSalonDemoVendedor = vi.fn();

vi.mock('../../../servicios/servicioVendedor', () => ({
  obtenerSalonDemoVendedor: (...args: unknown[]) => obtenerSalonDemoVendedor(...args),
  reiniciarSalonDemoVendedor: (...args: unknown[]) => reiniciarSalonDemoVendedor(...args),
  actualizarPlanSalonDemoVendedor: (...args: unknown[]) => actualizarPlanSalonDemoVendedor(...args),
}));

describe('TabDemoVendedor', () => {
  beforeEach(() => {
    obtenerSalonDemoVendedor.mockReset();
    reiniciarSalonDemoVendedor.mockReset();
    actualizarPlanSalonDemoVendedor.mockReset();

    obtenerSalonDemoVendedor.mockResolvedValue({
      id: 'demo-1',
      slug: 'demo-vendedora',
      nombre: 'Demo Vendedora',
      plan: 'PRO',
      estado: 'aprobado',
      activo: true,
      fechaVencimiento: '2026-05-17',
      actualizadoEn: '2026-04-17T16:00:00.000Z',
      totales: {
        reservas: 8,
        pagos: 1,
        clientes: 5,
        personal: 2,
        productos: 4,
      },
      credencialesDemo: {
        adminEmail: 'qa-salon@salonpromaster.com',
        adminContrasena: 'SalonPro!A1B2C3',
        empleadoEmail: 'qa-emp@salonpromaster.com',
        empleadoContrasena: 'SalonPro!A1B2C3',
        contrasenaCompartida: 'SalonPro!A1B2C3',
      },
    });

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('muestra credenciales completas y permite copiar el acceso admin demo', async () => {
    renderConProveedores(<TabDemoVendedor />);

    expect(
      await screen.findByText('Credenciales listas para copiar y presentar ambos roles.'),
    ).toBeInTheDocument();
    expect(screen.getByText('qa-salon@salonpromaster.com')).toBeInTheDocument();
    expect(screen.getAllByText('SalonPro!A1B2C3').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Abrir dashboard empleado' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar acceso' })[0]!);

    await waitFor(() => {
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Email: qa-salon@salonpromaster.com\nContrasena: SalonPro!A1B2C3',
      );
    });
  });
});
