import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MENSAJES_PRISMA_SILENCIADOS = new Set([
  'Loaded Prisma config from prisma.config.ts.',
  'Prisma schema loaded from prisma/schema.prisma.',
]);

function obtenerDirectorioServidor(): string {
  const archivoActual = fileURLToPath(import.meta.url);
  return resolve(dirname(archivoActual), '..', '..');
}

function escribirSalidaFiltrada(texto: string, escribir: (contenido: string) => void): void {
  const lineas = texto.split(/\r?\n/);

  for (const linea of lineas) {
    const normalizada = linea.trim();
    if (normalizada.length === 0 || MENSAJES_PRISMA_SILENCIADOS.has(normalizada)) {
      continue;
    }

    escribir(`${linea}\n`);
  }
}

export async function ejecutarPrisma(args: string[]): Promise<void> {
  const comando = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const proceso = spawn(comando, ['prisma', ...args], {
      cwd: obtenerDirectorioServidor(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let bufferStdout = '';
    let bufferStderr = '';

    proceso.stdout.on('data', (chunk: Buffer | string) => {
      bufferStdout += chunk.toString();
      const partes = bufferStdout.split(/\r?\n/);
      bufferStdout = partes.pop() ?? '';
      escribirSalidaFiltrada(partes.join('\n'), (contenido) => process.stdout.write(contenido));
    });

    proceso.stderr.on('data', (chunk: Buffer | string) => {
      bufferStderr += chunk.toString();
      const partes = bufferStderr.split(/\r?\n/);
      bufferStderr = partes.pop() ?? '';
      escribirSalidaFiltrada(partes.join('\n'), (contenido) => process.stderr.write(contenido));
    });

    proceso.on('error', (error) => {
      rejectPromise(error);
    });

    proceso.on('close', (codigo) => {
      if (bufferStdout.length > 0) {
        escribirSalidaFiltrada(bufferStdout, (contenido) => process.stdout.write(contenido));
      }

      if (bufferStderr.length > 0) {
        escribirSalidaFiltrada(bufferStderr, (contenido) => process.stderr.write(contenido));
      }

      if (codigo !== 0) {
        rejectPromise(
          new Error(`El comando prisma ${args.join(' ')} termino con codigo ${codigo ?? 'sin-codigo'}`),
        );
        return;
      }

      resolvePromise();
    });
  });
}