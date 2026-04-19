const config = {
  localApi: process.env.BTP_LOCAL_API ?? 'http://127.0.0.1:3000',
  prodApi: process.env.BTP_PROD_API ?? '',
  email: process.env.BTP_QA_VENDOR_EMAIL ?? 'qa.vendedor@salonpromaster.com',
  password: process.env.BTP_QA_VENDOR_PASSWORD ?? 'QaLogin2026!',
  timeoutMs: Number(process.env.BTP_QA_TIMEOUT_MS ?? 15000),
};

const endpoints = [
  { key: 'resumen', path: '/vendedor/resumen' },
  { key: 'preregistros', path: '/vendedor/mis-preregistros?pagina=1&limite=20' },
  { key: 'salones', path: '/vendedor/mis-salones' },
  { key: 'ventas', path: '/vendedor/ventas' },
  { key: 'notificaciones', path: '/vendedor/notificaciones' },
];

function crearTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function solicitarJson(url, opciones = {}) {
  const { controller, timer } = crearTimeout(config.timeoutMs);
  try {
    const respuesta = await fetch(url, {
      ...opciones,
      signal: controller.signal,
    });

    const texto = await respuesta.text();
    let body = null;
    try {
      body = texto ? JSON.parse(texto) : null;
    } catch {
      body = texto;
    }

    return { status: respuesta.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function keys(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj).sort() : [];
}

function contieneClaves(obj, requeridas) {
  const faltantes = requeridas.filter((clave) => !(obj && Object.prototype.hasOwnProperty.call(obj, clave)));
  return { ok: faltantes.length === 0, faltantes };
}

async function login(baseUrl) {
  return solicitarJson(`${baseUrl}/auth/iniciar-sesion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, contrasena: config.password }),
  });
}

function validarContrato(endpointKey, body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Respuesta vacia o invalida' };
  }

  if (endpointKey === 'resumen') {
    const datos = body.datos;
    const requeridas = [
      'totalPreregistros',
      'pendientes',
      'aprobados',
      'rechazados',
      'salonesActivos',
      'salonesPendientesPago',
      'ventasRegistradas',
      'ingresosGenerados',
      'comisionGenerada',
      'porcentajeComision',
      'porcentajeComisionPro',
    ];
    const revision = contieneClaves(datos, requeridas);
    return revision.ok
      ? { ok: true, resumenClaves: keys(datos) }
      : { ok: false, error: `Faltan claves en resumen: ${revision.faltantes.join(', ')}` };
  }

  if (endpointKey === 'preregistros') {
    const datos = body.datos;
    if (!Array.isArray(datos)) {
      return { ok: false, error: 'preregistros.datos no es arreglo' };
    }

    if (datos.length === 0) {
      return { ok: true, itemClaves: [], total: body.total ?? 0, vacio: true };
    }

    const requeridas = [
      'id',
      'nombreSalon',
      'propietario',
      'emailPropietario',
      'telefonoPropietario',
      'pais',
      'direccion',
      'descripcion',
      'categorias',
      'plan',
      'estado',
      'motivoRechazo',
      'estudioCreadoId',
      'notas',
      'creadoEn',
    ];

    const revision = contieneClaves(datos[0], requeridas);
    return revision.ok
      ? { ok: true, itemClaves: keys(datos[0]), total: body.total ?? datos.length, vacio: false }
      : { ok: false, error: `Faltan claves en preregistro item: ${revision.faltantes.join(', ')}` };
  }

  if (endpointKey === 'salones') {
    const datos = body.datos;
    if (!Array.isArray(datos)) {
      return { ok: false, error: 'salones.datos no es arreglo' };
    }

    if (datos.length === 0) {
      return { ok: true, itemClaves: [], total: 0, vacio: true };
    }

    const requeridas = [
      'id',
      'nombre',
      'propietario',
      'plan',
      'pais',
      'estado',
      'activo',
      'fechaVencimiento',
      'totalReservas',
      'creadoEn',
    ];

    const revision = contieneClaves(datos[0], requeridas);
    return revision.ok
      ? { ok: true, itemClaves: keys(datos[0]), total: datos.length, vacio: false }
      : { ok: false, error: `Faltan claves en salon item: ${revision.faltantes.join(', ')}` };
  }

  if (endpointKey === 'ventas') {
    const datos = body.datos;
    if (!Array.isArray(datos)) {
      return { ok: false, error: 'ventas.datos no es arreglo' };
    }

    if (datos.length === 0) {
      return { ok: true, itemClaves: [], total: 0, vacio: true };
    }

    const requeridas = [
      'id',
      'fecha',
      'monto',
      'moneda',
      'salonId',
      'salonNombre',
      'plan',
      'pendientePago',
      'porcentajeComisionAplicado',
      'comision',
    ];

    const revision = contieneClaves(datos[0], requeridas);
    return revision.ok
      ? { ok: true, itemClaves: keys(datos[0]), total: datos.length, vacio: false }
      : { ok: false, error: `Faltan claves en venta item: ${revision.faltantes.join(', ')}` };
  }

  if (endpointKey === 'notificaciones') {
    const datos = body.datos;
    if (!Array.isArray(datos)) {
      return { ok: false, error: 'notificaciones.datos no es arreglo' };
    }

    if (datos.length === 0) {
      return { ok: true, itemClaves: [], total: 0, vacio: true };
    }

    const requeridas = ['id', 'tipo', 'titulo', 'mensaje', 'prioridad', 'creadoEn', 'referenciaId'];
    const revision = contieneClaves(datos[0], requeridas);
    return revision.ok
      ? { ok: true, itemClaves: keys(datos[0]), total: datos.length, vacio: false }
      : { ok: false, error: `Faltan claves en notificacion item: ${revision.faltantes.join(', ')}` };
  }

  return { ok: false, error: `Endpoint no soportado: ${endpointKey}` };
}

async function evaluarEntorno(nombre, baseUrl) {
  const resultado = {
    nombre,
    baseUrl,
    login: null,
    endpoints: {},
    errores: [],
  };

  const loginResp = await login(baseUrl);
  resultado.login = {
    status: loginResp.status,
    rol: loginResp.body?.datos?.rol ?? null,
    tokenPresente: Boolean(loginResp.body?.datos?.token),
  };

  if (loginResp.status !== 200) {
    resultado.errores.push(`Login fallido: HTTP ${loginResp.status}`);
    return resultado;
  }

  if (loginResp.body?.datos?.rol !== 'vendedor') {
    resultado.errores.push(`Rol inesperado en login: ${String(loginResp.body?.datos?.rol ?? 'null')}`);
    return resultado;
  }

  const token = loginResp.body?.datos?.token;
  for (const endpoint of endpoints) {
    const resp = await solicitarJson(`${baseUrl}${endpoint.path}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const contrato = resp.status === 200
      ? validarContrato(endpoint.key, resp.body)
      : { ok: false, error: `HTTP ${resp.status}` };

    resultado.endpoints[endpoint.key] = {
      status: resp.status,
      ok: contrato.ok,
      detalle: contrato,
    };

    if (!contrato.ok) {
      resultado.errores.push(`${endpoint.key}: ${contrato.error}`);
    }
  }

  return resultado;
}

function compararParidad(local, prod) {
  const alertas = [];

  for (const endpoint of endpoints) {
    const localInfo = local.endpoints[endpoint.key];
    const prodInfo = prod.endpoints[endpoint.key];

    if (!localInfo?.ok || !prodInfo?.ok) continue;

    const localClaves = localInfo.detalle.itemClaves ?? localInfo.detalle.resumenClaves ?? [];
    const prodClaves = prodInfo.detalle.itemClaves ?? prodInfo.detalle.resumenClaves ?? [];

    const setLocal = new Set(localClaves);
    const setProd = new Set(prodClaves);
    const soloLocal = [...setLocal].filter((clave) => !setProd.has(clave));
    const soloProd = [...setProd].filter((clave) => !setLocal.has(clave));

    if (soloLocal.length > 0 || soloProd.length > 0) {
      alertas.push({
        endpoint: endpoint.key,
        soloLocal,
        soloProd,
      });
    }
  }

  return alertas;
}

(async () => {
  if (!config.prodApi) {
    console.error('Falta BTP_PROD_API. Usa la URL publica del backend (no el dominio del frontend).');
    console.error('Ejemplo: BTP_PROD_API=https://tu-backend.up.railway.app npm run qa:vendedor:paridad');
    process.exit(2);
    return;
  }

  const inicio = new Date().toISOString();
  const local = await evaluarEntorno('local', config.localApi);
  const prod = await evaluarEntorno('produccion', config.prodApi);
  const diferencias = compararParidad(local, prod);

  const resumen = {
    inicio,
    fin: new Date().toISOString(),
    config: {
      localApi: config.localApi,
      prodApi: config.prodApi,
      email: config.email,
      timeoutMs: config.timeoutMs,
    },
    local,
    produccion: prod,
    diferenciasContrato: diferencias,
  };

  console.log(JSON.stringify(resumen, null, 2));

  const hayErroresCriticos =
    local.errores.length > 0 ||
    prod.errores.length > 0 ||
    local.login?.status !== 200 ||
    prod.login?.status !== 200;

  if (hayErroresCriticos) {
    process.exitCode = 1;
  }
})();
