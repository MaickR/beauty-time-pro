import { prisma } from '../prismaCliente.js';
import { enviarEmailRecordatorio } from '../servicios/servicioEmail.js';

let intervaloRecordatorios: NodeJS.Timeout | null = null;

function obtenerFechaManana(): string {
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const compensacion = manana.getTimezoneOffset();
  return new Date(manana.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;
}

async function ejecutarRecordatorios(): Promise<void> {
  const fechaObjetivo = obtenerFechaManana();
  const reservas = await prisma.reserva.findMany({
    where: {
      fecha: fechaObjetivo,
      estado: 'confirmed',
      recordatorioEnviado: false,
    },
    select: { id: true },
  });

  for (const reserva of reservas) {
    await enviarEmailRecordatorio(reserva.id);
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { recordatorioEnviado: true },
    });
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