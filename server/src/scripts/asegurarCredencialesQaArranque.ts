import { asegurarCredencialesQaLogin } from '../lib/credencialesQaLogin.js';
import { prisma } from '../prismaCliente.js';

function debeAsegurarCredencialesQaArranque(): boolean {
  const valor = process.env.HABILITAR_CREDENCIALES_QA_ARRANQUE?.trim().toLowerCase();
  return valor === '1' || valor === 'true' || valor === 'si' || valor === 'yes';
}

async function main() {
  if (!debeAsegurarCredencialesQaArranque()) {
    console.log('[qa-login] Bootstrap QA deshabilitado en arranque');
    return;
  }

  const resultado = await asegurarCredencialesQaLogin();
  console.log('[qa-login] Credenciales QA aseguradas para:', resultado.estudioQa.nombre);
}

main()
  .catch((error) => {
    console.error('[qa-login] Error asegurando credenciales QA en arranque:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });