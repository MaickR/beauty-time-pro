import { prisma } from '../src/prismaCliente.js';
import { asegurarCredencialesQaLogin } from '../src/lib/credencialesQaLogin.js';

async function main() {
  const resultado = await asegurarCredencialesQaLogin();
  console.log(JSON.stringify(resultado, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
