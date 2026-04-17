import http from 'node:http';

const PUERTO_ORIGEN = 5174;
const PUERTO_DESTINO = 5173;

const servidor = http.createServer((solicitud, respuesta) => {
  const ruta = solicitud.url ?? '/';
  const destino = `http://localhost:${PUERTO_DESTINO}${ruta}`;

  respuesta.statusCode = 307;
  respuesta.setHeader('Location', destino);
  respuesta.setHeader('Cache-Control', 'no-store');
  respuesta.end();
});

servidor.listen(PUERTO_ORIGEN, '0.0.0.0', () => {
  console.log(
    `Redirección dev activa: http://localhost:${PUERTO_ORIGEN}/ -> http://localhost:${PUERTO_DESTINO}/`,
  );
});

const cerrar = () => {
  servidor.close(() => process.exit(0));
};

process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
