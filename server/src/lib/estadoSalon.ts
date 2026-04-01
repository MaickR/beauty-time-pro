interface ParametrosEstadoSalon {
  activo?: boolean | null;
  estado?: string | null;
}

export function salonEstaDisponible(parametros: ParametrosEstadoSalon): boolean {
  return parametros.activo === true && parametros.estado === 'aprobado';
}

export function obtenerErrorAccesoSalon(parametros: ParametrosEstadoSalon): {
  error: string;
  codigo: string;
} {
  if (parametros.estado === 'suspendido') {
    return {
      error: 'Tu salón está suspendido',
      codigo: 'SALON_SUSPENDIDO',
    };
  }

  if (parametros.estado === 'pendiente') {
    return {
      error: 'Tu salón aún no está habilitado',
      codigo: 'SALON_PENDIENTE',
    };
  }

  if (parametros.activo !== true) {
    return {
      error: 'Tu salón no está disponible actualmente',
      codigo: 'SALON_INACTIVO',
    };
  }

  return {
    error: 'Tu salón no está disponible actualmente',
    codigo: 'SALON_NO_DISPONIBLE',
  };
}