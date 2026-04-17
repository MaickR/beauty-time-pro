import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormularioNuevoPersonal } from './FormularioNuevoPersonal';
import { renderConProveedores } from '../../../test/renderConProveedores';

const { crearPersonal, crearAccesoEmpleado, recargar } = vi.hoisted(() => ({
  crearPersonal: vi.fn().mockResolvedValue({ id: 'personal-1' }),
  crearAccesoEmpleado: vi.fn().mockResolvedValue({ id: 'acceso-1' }),
  recargar: vi.fn(),
}));

vi.mock('../../../servicios/servicioPersonal', () => ({
  crearPersonal,
}));

vi.mock('../../../servicios/servicioEmpleados', () => ({
  crearAccesoEmpleado,
}));

vi.mock('../../../contextos/ContextoApp', () => ({
  usarContextoApp: () => ({
    recargar,
  }),
}));

describe('FormularioNuevoPersonal', () => {
  it('crea el acceso con el correo y la contraseña definidos por el salón', async () => {
    crearPersonal.mockClear();
    crearAccesoEmpleado.mockClear();
    recargar.mockClear();

    renderConProveedores(
      <FormularioNuevoPersonal
        estudioId="estudio-1"
        serviciosDisponibles={[{ name: 'Corte', duration: 45, price: 35000 }]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Andrea López' },
    });
    fireEvent.change(screen.getByLabelText('Correo de acceso'), {
      target: { value: 'andrea@beautytime.pro' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña de acceso'), {
      target: { value: 'Andrea!24' },
    });

    fireEvent.click(screen.getByRole('button', { name: /agregar especialista/i }));

    await waitFor(() => {
      expect(crearPersonal).toHaveBeenCalledWith('estudio-1', expect.objectContaining({
        name: 'Andrea López',
      }));
      expect(crearAccesoEmpleado).toHaveBeenCalledWith('estudio-1', 'personal-1', {
        email: 'andrea@beautytime.pro',
        contrasena: 'Andrea!24',
        forzarCambioContrasena: false,
      });
    });
  });
});