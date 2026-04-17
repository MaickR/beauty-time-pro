import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderConProveedores } from '../../../test/renderConProveedores';
import { TabVentasVendedor } from './TabVentasVendedor';

const obtenerVentasVendedor = vi.fn();

vi.mock('../../../servicios/servicioVendedor', () => ({
  obtenerVentasVendedor: (...args: unknown[]) => obtenerVentasVendedor(...args),
}));

describe('TabVentasVendedor', () => {
  beforeEach(() => {
    obtenerVentasVendedor.mockReset();
    obtenerVentasVendedor.mockImplementation((params?: { soloPendientesPago?: boolean }) => {
      const ventas = [
        {
          id: 'venta-1',
          fecha: '2026-04-17',
          monto: 259900,
          moneda: 'MXN',
          concepto: 'Suscripción Beauty Time Pro',
          referencia: 'suscripcion',
          salonId: 'salon-1',
          salonNombre: 'Studio Aura',
          adminSalonNombre: 'Ana Demo',
          adminSalonEmail: 'ana@demo.com',
          plan: 'PRO' as const,
          tipoSuscripcion: 'mensual',
          valorSuscripcion: 259900,
          pais: 'Mexico',
          fechaVencimiento: '2026-04-10',
          pendientePago: true,
          comision: 25990,
        },
        {
          id: 'venta-2',
          fecha: '2026-04-16',
          monto: 129900,
          moneda: 'MXN',
          concepto: 'Suscripción Beauty Time Pro',
          referencia: 'renovacion',
          salonId: 'salon-2',
          salonNombre: 'Studio Nube',
          adminSalonNombre: 'Marta Demo',
          adminSalonEmail: 'marta@demo.com',
          plan: 'STANDARD' as const,
          tipoSuscripcion: 'mensual',
          valorSuscripcion: 129900,
          pais: 'Mexico',
          fechaVencimiento: '2026-05-16',
          pendientePago: false,
          comision: 12990,
        },
      ];

      return Promise.resolve(
        params?.soloPendientesPago ? ventas.filter((venta) => venta.pendientePago) : ventas,
      );
    });
  });

  it('muestra resumen comercial y reaplica consulta al filtrar pendientes de pago', async () => {
    renderConProveedores(<TabVentasVendedor />);

    expect((await screen.findAllByText('Studio Aura')).length).toBeGreaterThan(0);
    expect(screen.getByText('2 ventas visibles')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pendientes de pago' }));

    await waitFor(() => {
      expect(obtenerVentasVendedor).toHaveBeenLastCalledWith(
        expect.objectContaining({ soloPendientesPago: true }),
      );
    });

    expect(screen.queryByText('Studio Nube')).not.toBeInTheDocument();
  });
});
