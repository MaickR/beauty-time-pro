import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { obtenerAccesoPersonal } from '../../../servicios/servicioEmpleados';
import { ModalCrearAccesoEmpleado } from './ModalCrearAccesoEmpleado';
import { BotonIconoAccion } from '../../../componentes/ui/BotonIconoAccion.tsx';

interface PropsSeccionAccesoEmpleado {
  estudioId: string;
  personalId: string;
  nombreEmpleado: string;
  activoPersonal: boolean;
  desactivadoHasta?: string | null;
}

export function SeccionAccesoEmpleado({
  estudioId,
  personalId,
  nombreEmpleado,
  activoPersonal,
  desactivadoHasta = null,
}: PropsSeccionAccesoEmpleado) {
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data: acceso, isLoading } = useQuery({
    queryKey: ['acceso-empleado', personalId],
    queryFn: () => obtenerAccesoPersonal(estudioId, personalId),
    enabled: modalAbierto,
    staleTime: 1000 * 60,
  });

  return (
    <>
      <BotonIconoAccion
        descripcion="Acceso"
        tono={activoPersonal ? 'primario' : 'advertencia'}
        onClick={() => setModalAbierto(true)}
        icono={
          isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : acceso?.activo || activoPersonal ? (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
          )
        }
      />

      <ModalCrearAccesoEmpleado
        estudioId={estudioId}
        personalId={personalId}
        nombreEmpleado={nombreEmpleado}
        accesoExistente={acceso}
        activoPersonalInicial={activoPersonal}
        desactivadoHastaInicial={desactivadoHasta}
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
      />
    </>
  );
}
