const baseUrl = 'http://localhost:3000';
const usuarios = [
  { rol: 'maestro', email: 'qa.maestro@salonpromaster.com' },
  { rol: 'supervisor', email: 'qa.supervisor@salonpromaster.com' },
  { rol: 'vendedor', email: 'qa.vendedor@salonpromaster.com' },
  { rol: 'dueno', email: 'qa.dueno@salonpromaster.com' },
  { rol: 'empleado', email: 'qa.empleado@salonpromaster.com' },
  { rol: 'cliente', email: 'qa.cliente@salonpromaster.com' },
];
const contrasena = 'QaLogin2026!';

async function login(email, contrasena) {
  const res = await fetch(`${baseUrl}/auth/iniciar-sesion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, contrasena }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  const resultados = [];
  for (const usuario of usuarios) {
    const r = await login(usuario.email, contrasena);
    resultados.push({
      esperado: usuario.rol,
      status: r.status,
      rolRecibido: r.body?.datos?.rol ?? null,
      estudioId: r.body?.datos?.estudioId ?? null,
      mensajeError: r.body?.error ?? null,
      codigo: r.body?.codigo ?? null,
      ok: r.status === 200 && r.body?.datos?.rol === usuario.rol,
    });
  }
  console.log(JSON.stringify(resultados, null, 2));
})();
