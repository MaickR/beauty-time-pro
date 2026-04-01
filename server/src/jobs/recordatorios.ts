import { prisma } from '../prismaCliente.js';
import { programarEmailRecordatorioReserva } from '../servicios/servicioEmail.js';
import { notificarRecordatorio, obtenerReservaConRelacionesPorId } from '../utils/notificarReserva.js';
import {
  obtenerFechaISOEnZona,
  obtenerMinutosHastaFechaHoraEnZona,
  normalizarZonaHorariaEstudio,
} from '../utils/zonasHorarias.js';

let intervaloRecordatorios: NodeJS.Timeout | null = null;

async function ejecutarRecordatorios(): Promise<void> {
  const reservas = await prisma.reserva.findMany({
    where: {
      estado: 'confirmed',
      recordatorioEnviado: false,
      estudio: {
        activo: true,
        estado: 'aprobado',
      },
    },
    select: {
      id: true,
      fecha: true,
      horaInicio: true,
      estudio: {
        select: {
          pais: true,
          zonaHoraria: true,
          fechaVencimiento: true,
        },
      },
    },
  });

  for (const reserva of reservas) {
    const zonaHoraria = normalizarZonaHorariaEstudio(
      reserva.estudio.zonaHoraria,
      reserva.estudio.pais,
    );
    const ahora = new Date();
    const hoyZona = obtenerFechaISOEnZona(ahora, zonaHoraria, reserva.estudio.pais);
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    const mananaZona = obtenerFechaISOEnZona(manana, zonaHoraria, reserva.estudio.pais);

    if (reserva.estudio.fechaVencimiento < hoyZona) {
      continue;
    }

    if (reserva.fecha !== hoyZona && reserva.fecha !== mananaZona) {
      continue;
    }

    const minutosHastaReserva = obtenerMinutosHastaFechaHoraEnZona(
      reserva.fecha,
      reserva.horaInicio,
      zonaHoraria,
      reserva.estudio.pais,
    );
    if (minutosHastaReserva < 0 || minutosHastaReserva > 120) {
      continue;
    }

    const [resultadoCola, reservaCompleta] = await Promise.all([
      programarEmailRecordatorioReserva(reserva.id),
      obtenerReservaConRelacionesPorId(reserva.id),
    ]);

    if (reservaCompleta && resultadoCola && resultadoCola !== 'existente') {
      await notificarRecordatorio(reservaCompleta);
    }
  }
}

export function iniciarJobRecordatorios(): void {
  if (intervaloRecordatorios) return;

  void ejecutarRecordatorios().catch((error) => {
    console.error('Error ejecutando recordatorios iniciales:', error);
  });

  intervaloRecordatorios = setInterval(() => {
    void ejecutarRecordatorios().catch((error) => {
      console.error('Error ejecutando recordatorios:', error);
    });
  }, 60 * 60 * 1000);
}
