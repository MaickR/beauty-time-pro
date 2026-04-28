import { prisma } from '../src/prismaCliente.js';

async function limpiarDatosLocales() {
  console.log('Limpiando datos locales...');

  // Desactivar FK checks temporalmente para simplificar el orden
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

  // Eliminar datos operativos
  const reservaServicios = await prisma.reservaServicio.deleteMany({});
  const pagos = await prisma.pago.deleteMany({});
  const reservas = await prisma.reserva.deleteMany({});
  const puntosFidelidad = await prisma.puntosFidelidad.deleteMany({});
  const tokenesVerificacion = await prisma.tokenVerificacionApp.deleteMany({});
  const clientesApp = await prisma.clienteApp.deleteMany({});
  const clientes = await prisma.cliente.deleteMany({});
  const preregistros = await prisma.preregistroSalon.deleteMany({});
  const empleadoAcceso = await prisma.empleadoAcceso.deleteMany({});
  const personal = await prisma.personal.deleteMany({});
  const productos = await prisma.producto.deleteMany({});
  const notificaciones = await prisma.notificacionEstudio.deleteMany({});
  const mensajes = await prisma.mensajeMasivo.deleteMany({});
  const diasFestivos = await prisma.diaFestivo.deleteMany({});
  const configFidelidad = await prisma.configFidelidad.deleteMany({});
  const estudios = await prisma.estudio.deleteMany({});

  // Re-activar FK checks
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

  console.log(JSON.stringify({
    reservaServicios: reservaServicios.count,
    pagos: pagos.count,
    reservas: reservas.count,
    puntosFidelidad: puntosFidelidad.count,
    tokenesVerificacion: tokenesVerificacion.count,
    clientesApp: clientesApp.count,
    clientes: clientes.count,
    preregistros: preregistros.count,
    empleadoAcceso: empleadoAcceso.count,
    personal: personal.count,
    productos: productos.count,
    notificaciones: notificaciones.count,
    mensajes: mensajes.count,
    diasFestivos: diasFestivos.count,
    configFidelidad: configFidelidad.count,
    estudios: estudios.count,
  }, null, 2));

  console.log('✅ Datos locales eliminados correctamente.');
}

limpiarDatosLocales()
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
