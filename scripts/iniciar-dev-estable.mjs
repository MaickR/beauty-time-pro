import { execSync, spawn } from 'node:child_process';

const PUERTOS_DESARROLLO = [3000, 5173, 5174];

function obtenerPidsPuertoWindows(puerto) {
  try {
    const salida = execSync(`netstat -ano -p tcp | findstr :${puerto}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });

    return [
      ...new Set(
        salida
          .split(/\r?\n/)
          .map((linea) => linea.trim())
          .filter(Boolean)
          .map((linea) => linea.split(/\s+/))
          .filter((columnas) => columnas.length >= 5)
          .filter((columnas) => {
            const direccionLocal = columnas[1] ?? '';
            const estado = (columnas[3] ?? '').toUpperCase();
            return direccionLocal.endsWith(`:${puerto}`) && estado === 'LISTENING';
          })
          .map((columnas) => columnas.at(-1))
          .filter((pid) => pid && /^\d+$/.test(pid))
          .map((pid) => Number(pid)),
      ),
    ];
  } catch {
    return [];
  }
}

function obtenerPidsPuertoUnix(puerto) {
  try {
    const salida = execSync(`lsof -ti tcp:${puerto}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    });

    return [...new Set(
      salida
        .split(/\r?\n/)
        .map((valor) => valor.trim())
        .filter((valor) => /^\d+$/.test(valor))
        .map((valor) => Number(valor)),
    )];
  } catch {
    return [];
  }
}

function obtenerPidsPorPuerto(puerto) {
  return process.platform === 'win32'
    ? obtenerPidsPuertoWindows(puerto)
    : obtenerPidsPuertoUnix(puerto);
}

function cerrarProcesosPrevios() {
  const pids = new Set();

  for (const puerto of PUERTOS_DESARROLLO) {
    for (const pid of obtenerPidsPorPuerto(puerto)) {
      if (pid && pid !== process.pid) {
        pids.add(pid);
      }
    }
  }

  if (pids.size === 0) {
    console.log('Entorno local limpio.');
    return;
  }

  console.log(`Liberando puertos de desarrollo: ${[...pids].join(', ')}`);

  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          // continuar con fallback específico de Windows
        }

        try {
          execSync(`taskkill /PID ${pid} /T /F`, {
            stdio: ['ignore', 'ignore', 'ignore'],
          });
        } catch {
          execSync(
            `powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
            {
              stdio: ['ignore', 'ignore', 'ignore'],
            },
          );
        }
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch {
      // ignorar procesos ya cerrados
    }
  }
}

function iniciarEntorno() {
  const comando = [
    'npx',
    'concurrently',
    '--names',
    'REDIRECT,FRONTEND,BACKEND',
    '--prefix-colors',
    'yellow,magenta,cyan',
    '--restart-tries',
    '-1',
    '--restart-after',
    '1500',
    '"node scripts/redirigir-dev-legacy.mjs"',
    '"npm run dev:frontend"',
    '"npm run dev:backend"',
  ].join(' ');

  const hijo = spawn(comando, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  const cerrar = (signal) => {
    if (!hijo.killed) {
      hijo.kill(signal);
    }
  };

  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));

  hijo.on('exit', (codigo) => {
    process.exit(codigo ?? 0);
  });
}

cerrarProcesosPrevios();
iniciarEntorno();
