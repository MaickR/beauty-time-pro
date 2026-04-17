import { ejecutarPrisma } from '../lib/prismaCli.js';

ejecutarPrisma(['migrate', 'deploy'])
  .catch((error) => {
    console.error('[migracion] Error ejecutando prisma migrate deploy:', error);
    process.exitCode = 1;
  });