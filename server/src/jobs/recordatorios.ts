import { prisma } from '../prismaCliente.js';
import { enviarEmailRecordatorio } from '../servicios/servicioEmail.js';
import { notificarRecordatorio, obtenerReservaConRelacionesPorId } from '../utils/notificarReserva.js';

let intervaloRecordatorios: NodeJS.Timeout | null = null;

function obtenerFechaLocalISO(fecha: Date): string {
  const compensacion = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;
}

function obtenerFechasObjetivo(): string[] {
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  return [obtenerFechaLocalISO(ahora), obtenerFechaLocalISO(manana)];
}

function obtenerMinutosHastaReserva(fecha: string, horaInicio: string): number {
  const inicioReserva = new Date(`${fecha}T${horaInicio}:00`);
  return Math.floor((inicioReserva.getTime() - Date.now()) / 60000);
}

async function ejecutarRecordatorios(): Promise<void> {
  const fechasObjetivo = obtenerFechasObjetivo();
  const hoy = obtenerFechaLocalISO(new Date());
  const reservas = await prisma.reserva.findMany({
    where: {
      fecha: { in: fechasObjetivo },
      estado: 'confirmed',
      recordatorioEnviado: false,
      estudio: {
        activo: true,
        estado: 'aprobado',
        fechaVencimiento: { gte: hoy },
      },
    },
    select: { id: true, fecha: true, horaInicio: true },
  });

  for (const reserva of reservas) {
    const minutosHastaReserva = obtenerMinutosHastaReserva(reserva.fecha, reserva.horaInicio);
    if (minutosHastaReserva < 0 || minutosHastaReserva > 120) {
      continue;
    }

    const [enviado, reservaCompleta] = await Promise.all([
      enviarEmailRecordatorio(reserva.id),
      obtenerReservaConRelacionesPorId(reserva.id),
    ]);

    if (reservaCompleta) {
      await notificarRecordatorio(reservaCompleta);
    }

    if (enviado || reservaCompleta) {
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { recordatorioEnviado: true },
      });
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
