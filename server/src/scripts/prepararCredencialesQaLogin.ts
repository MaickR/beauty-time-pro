import { asegurarCredencialesQaLogin } from '../lib/credencialesQaLogin.js';
import { prisma } from '../prismaCliente.js';

async function main() {
  const resultado = await asegurarCredencialesQaLogin();
  console.log(JSON.stringify(resultado, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });