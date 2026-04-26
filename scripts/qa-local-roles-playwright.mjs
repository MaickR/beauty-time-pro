import { chromium } from 'playwright';

const config = {
  baseUrl: process.env.BTP_FRONTEND_URL ?? 'http://localhost:5173',
  headless: process.env.BTP_HEADLESS !== 'false',
  timeoutMs: Number(process.env.BTP_QA_TIMEOUT_MS ?? 30000),
};

const escenarios = [
  // Solo se incluye maestro_principal si las credenciales están configuradas explícitamente por variables de entorno
  ...(process.env.BTP_MASTER_EMAIL && process.env.BTP_MASTER_PASS
    ? [
        {
          id: 'maestro_principal',
          rolEsperado: 'maestro',
          acceso: process.env.BTP_MASTER_EMAIL,
          contrasena: process.env.BTP_MASTER_PASS,
          rutaEsperada: /\/maestro(\/|$)/i,
        },
      ]
    : []),
  {
    id: 'maestro_qa',
    rolEsperado: 'maestro',
    acceso: process.env.BTP_QA_MAESTRO_EMAIL ?? 'qa.maestro@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/maestro(\/|$)/i,
  },
  {
    id: 'supervisor_qa',
    rolEsperado: 'supervisor',
    acceso: process.env.BTP_QA_SUPERVISOR_EMAIL ?? 'qa.supervisor@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/supervisor(\/|$)/i,
  },
  {
    id: 'vendedor_qa',
    rolEsperado: 'vendedor',
    acceso: process.env.BTP_QA_VENDEDOR_EMAIL ?? 'qa.vendedor@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/vendedor(\/|$)/i,
  },
  {
    id: 'dueno_qa',
    rolEsperado: 'dueno',
    acceso: process.env.BTP_QA_DUENO_EMAIL ?? 'qa.dueno@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/estudio\/.+\/agenda(\/|$)/i,
  },
  {
    id: 'empleado_qa',
    rolEsperado: 'empleado',
    acceso: process.env.BTP_QA_EMPLEADO_EMAIL ?? 'qa.empleado@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/empleado\/agenda(\/|$)/i,
  },
  {
    id: 'cliente_qa',
    rolEsperado: 'cliente',
    acceso: process.env.BTP_QA_CLIENTE_EMAIL ?? 'qa.cliente@salonpromaster.com',
    contrasena: process.env.BTP_QA_PASSWORD ?? 'QaLogin2026!',
    rutaEsperada: /\/(reservar\/.+|cliente\/inicio)(\/|$)/i,
  },
];

function crearResultado(escenario) {
  return {
    escenario: escenario.id,
    rolEsperado: escenario.rolEsperado,
    acceso: escenario.acceso,
    loginOk: false,
    rutaFinal: null,
    acciones: [],
    consolaErrores: [],
    erroresPagina: [],
    respuestasError: [],
    requestsFallidos: [],
    errores: [],
  };
}

function instrumentar(page, resultado) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    resultado.consolaErrores.push({
      texto: msg.text(),
      ubicacion: msg.location(),
    });
  });

  page.on('pageerror', (error) => {
    resultado.erroresPagina.push(String(error?.message ?? error));
  });

  page.on('requestfailed', (request) => {
    resultado.requestsFallidos.push({
      metodo: request.method(),
      url: request.url(),
      razon: request.failure()?.errorText ?? 'desconocida',
    });
  });

  page.on('response', (response) => {
    const req = response.request();
    if (!['fetch', 'xhr'].includes(req.resourceType())) return;
    const status = response.status();
    if (status < 400) return;
    resultado.respuestasError.push({
      metodo: req.method(),
      url: response.url(),
      status,
    });
  });
}

async function llenarCampoAcceso(page, valor) {
  await page.waitForSelector('#acceso, input[autocomplete="username"], input[type="text"]', {
    timeout: config.timeoutMs,
  });

  const candidatos = [
    page.locator('#acceso'),
    page.getByLabel(/Clave de acceso|Correo electronico|Correo o teléfono|Correo de acceso|Correo/i),
    page.locator('input[autocomplete="username"]'),
    page.locator('input[type="text"]').first(),
  ];

  for (const campo of candidatos) {
    const existe = await campo.count().catch(() => 0);
    if (!existe) continue;
    const visible = await campo.first().isVisible().catch(() => false);
    if (!visible) continue;
    await campo.first().fill(valor);
    return;
  }

  throw new Error('No se encontró el input principal de acceso.');
}

async function llenarContrasena(page, valor) {
  const campo = page.locator('#contrasena');
  await campo.waitFor({ state: 'attached', timeout: config.timeoutMs });
  await page.waitForFunction(
    () => {
      const input = document.querySelector('#contrasena');
      return Boolean(input) && !input.disabled && input.offsetParent !== null;
    },
    { timeout: config.timeoutMs },
  );
  await campo.fill(valor);
}

async function enviarFormulario(page) {
  const boton = page.getByRole('button', { name: /LOGIN|Entrar al sistema|Entrar/i }).first();
  await boton.waitFor({ state: 'visible', timeout: config.timeoutMs });
  await boton.click();
}

async function ejecutarLoginEscalonado(page, escenario) {
  await llenarCampoAcceso(page, escenario.acceso);

  const campoContrasena = page.locator('#contrasena');
  const contrasenaHabilitadaInicial = await campoContrasena
    .isEnabled()
    .catch(() => false);

  if (!contrasenaHabilitadaInicial) {
    await enviarFormulario(page);

    await Promise.race([
      page
        .waitForFunction(
          () => {
            const input = document.querySelector('#contrasena');
            return Boolean(input) && !input.disabled && input.offsetParent !== null;
          },
          { timeout: config.timeoutMs },
        )
        .catch(() => null),
      page.waitForURL((url) => !url.pathname.endsWith('/iniciar-sesion'), {
        timeout: config.timeoutMs,
      }).catch(() => null),
    ]);
  }

  const sigueEnLogin = new URL(page.url()).pathname.endsWith('/iniciar-sesion');
  const contrasenaHabilitada = await campoContrasena.isEnabled().catch(() => false);

  if (sigueEnLogin && contrasenaHabilitada) {
    await llenarContrasena(page, escenario.contrasena);
    await enviarFormulario(page);
  }
}

async function esperarResultadoLogin(page) {
  const inicio = Date.now();
  let alerta = null;

  while (Date.now() - inicio < config.timeoutMs) {
    const ruta = new URL(page.url()).pathname;
    if (ruta !== '/iniciar-sesion') {
      return { ruta, alerta: null };
    }

    const alertaTexto = await page.getByRole('alert').first().textContent().catch(() => null);
    if (alertaTexto?.trim()) {
      alerta = alertaTexto.trim();
      break;
    }

    await page.waitForTimeout(250);
  }

  return { ruta: new URL(page.url()).pathname, alerta };
}

async function ejecutarAccionesRol(page, rolEsperado, resultado) {
  const cerrarDialogosBloqueantes = async () => {
    const botonesCerrar = page.getByRole('button', {
      name: /Cerrar|Close|Entendido|Aceptar|Continuar|Omitir|Ahora no|Mas tarde|Más tarde/i,
    });

    for (let intento = 0; intento < 3; intento += 1) {
      const dialogosVisibles = await page
        .getByRole('dialog')
        .filter({ hasNot: page.locator('[aria-hidden="true"]') })
        .count()
        .catch(() => 0);
      if (!dialogosVisibles) {
        return;
      }

      const totalBotones = await botonesCerrar.count().catch(() => 0);
      if (totalBotones > 0) {
        const boton = botonesCerrar.first();
        if (await boton.isVisible().catch(() => false)) {
          await boton.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
          continue;
        }
      }

      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
    }
  };

  const clickSiVisible = async (nombreRegex, etiqueta) => {
    await cerrarDialogosBloqueantes();

    const boton = page.getByRole('button', { name: nombreRegex }).first();
    const enlace = page.getByRole('link', { name: nombreRegex }).first();
    const objetivo = (await boton.isVisible().catch(() => false)) ? boton : enlace;

    if (!(await objetivo.isVisible().catch(() => false))) {
      return false;
    }

    let clicRealizado = false;
    try {
      await objetivo.click({ timeout: 2500 });
      clicRealizado = true;
    } catch {
      await cerrarDialogosBloqueantes();
      await objetivo.click({ timeout: 2500 }).then(() => {
        clicRealizado = true;
      }).catch(() => {});
    }

    if (clicRealizado) {
      resultado.acciones.push(etiqueta);
      await page.waitForTimeout(350);
      return true;
    }

    return false;
  };

  if (rolEsperado === 'maestro') {
    await clickSiVisible(/Control de cobros/i, 'abrio_control_cobros');
    await clickSiVisible(/Colaboradores/i, 'abrio_colaboradores');
    await clickSiVisible(/Pre-registros/i, 'abrio_preregistros');
    await clickSiVisible(/Base de Datos/i, 'abrio_base_datos');

    const botonNuevoSalon = page.getByRole('button', { name: /Registrar nuevo salón/i }).first();
    if (await botonNuevoSalon.isVisible().catch(() => false)) {
      await botonNuevoSalon.click();
      const dialogo = page.getByRole('dialog').first();
      if (await dialogo.isVisible().catch(() => false)) {
        resultado.acciones.push('abrio_modal_registro_salon');
        const cerrar = page.getByLabel(/Cerrar modal|Cerrar/i).first();
        if (await cerrar.isVisible().catch(() => false)) {
          await cerrar.click();
          resultado.acciones.push('cerro_modal_registro_salon');
        }
      }
    }

    return;
  }

  if (rolEsperado === 'supervisor') {
    await clickSiVisible(/Control de cobros/i, 'abrio_control_cobros_supervisor');
    await clickSiVisible(/Pre-registros/i, 'abrio_preregistros_supervisor');
    await clickSiVisible(/Salones|Directorio|Control/i, 'abrio_panel_supervisor');
    return;
  }

  if (rolEsperado === 'vendedor') {
    await clickSiVisible(/Resumen/i, 'abrio_resumen');
    await clickSiVisible(/Pre-registros/i, 'abrio_preregistros');
    await clickSiVisible(/Mis salones/i, 'abrio_salones');
    await clickSiVisible(/Ventas/i, 'abrio_ventas');
    await clickSiVisible(/Notificaciones/i, 'abrio_notificaciones');
    return;
  }

  if (rolEsperado === 'dueno') {
    await clickSiVisible(/Crear cita manual/i, 'abrio_formulario_cita_manual');
    const dialogo = page.getByRole('dialog', { name: /Crear cita manual/i }).first();
    if (await dialogo.isVisible().catch(() => false)) {
      const cerrar = dialogo.getByRole('button', { name: /Cerrar/i }).first();
      if (await cerrar.isVisible().catch(() => false)) {
        await cerrar.click();
      }
      resultado.acciones.push('interaccion_modal_cita_manual');
    }
    await clickSiVisible(/Administración|Admin/i, 'navego_a_admin_estudio');
    await clickSiVisible(/Agenda/i, 'abrio_agenda_dueno');
    return;
  }

  if (rolEsperado === 'empleado') {
    await clickSiVisible(/Detalle/i, 'abrio_detalle_reserva');
    await clickSiVisible(/Perfil/i, 'abrio_perfil_empleado');
    await clickSiVisible(/Agenda/i, 'consulta_agenda_empleado');
    return;
  }

  if (rolEsperado === 'cliente') {
    await clickSiVisible(/Reservar|Agendar|Continuar/i, 'intento_flujo_reserva_cliente');
    await clickSiVisible(/Historial/i, 'abrio_historial_cliente');
    await clickSiVisible(/Perfil/i, 'abrio_perfil_cliente');
    const contenido = await page.locator('main').textContent().catch(() => '');
    if (contenido && /historial|reserva|sal[oó]n|agenda/i.test(contenido)) {
      resultado.acciones.push('consulta_vista_cliente');
    }
  }
}

function evaluarCriticidad(resultado) {
  // Los 400 del endpoint /auth/iniciar-sesion son esperados en el paso intermedio del login
  // escalonado. No deben contarse como errores críticos.
  const erroresHttpCriticos = resultado.respuestasError.filter((errorHttp) => {
    if (errorHttp.status === 400 && /\/auth\/iniciar-sesion/.test(errorHttp.url)) {
      return false;
    }
    return [400, 401, 403, 500].includes(errorHttp.status);
  });

  // Los mensajes de consola del browser sobre el 400 de login también son esperados
  const consolaErroresCriticos = resultado.consolaErrores.filter((err) => {
    const texto = err.texto ?? '';
    const url = err.ubicacion?.url ?? '';
    if (/400/.test(texto) && /\/auth\/iniciar-sesion/.test(url)) {
      return false;
    }
    if (/Failed to load resource.*400/.test(texto)) {
      return false;
    }
    return true;
  });

  return {
    hayCriticos:
      resultado.errores.length > 0 ||
      consolaErroresCriticos.length > 0 ||
      resultado.erroresPagina.length > 0 ||
      resultado.requestsFallidos.length > 0 ||
      erroresHttpCriticos.length > 0,
    erroresHttpCriticos,
  };
}

async function ejecutarEscenario(browser, escenario) {
  const resultado = crearResultado(escenario);
  const context = await browser.newContext();
  const page = await context.newPage();
  instrumentar(page, resultado);

  try {
    await page.goto(`${config.baseUrl}/iniciar-sesion`, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeoutMs,
    });

    await ejecutarLoginEscalonado(page, escenario);

    await page.waitForLoadState('networkidle', { timeout: config.timeoutMs }).catch(() => {});
    const resultadoLogin = await esperarResultadoLogin(page);
    const rutaFinal = resultadoLogin.ruta;
    resultado.rutaFinal = rutaFinal;

    if (!escenario.rutaEsperada.test(rutaFinal)) {
      const errorRaiz = resultadoLogin.alerta;
      resultado.errores.push(
        `Ruta final inesperada: ${rutaFinal}${errorRaiz ? ` | alerta: ${errorRaiz}` : ''}`,
      );
      return resultado;
    }

    resultado.loginOk = true;
    await ejecutarAccionesRol(page, escenario.rolEsperado, resultado);
  } catch (error) {
    resultado.errores.push(String(error?.message ?? error));
  } finally {
    await context.close();
  }

  return resultado;
}

const browser = await chromium.launch({ headless: config.headless });

const resumen = {
  inicio: new Date().toISOString(),
  baseUrl: config.baseUrl,
  headless: config.headless,
  escenarios: [],
  erroresGlobales: [],
};

try {
  for (const escenario of escenarios) {
    // eslint-disable-next-line no-await-in-loop
    const resultado = await ejecutarEscenario(browser, escenario);
    resumen.escenarios.push(resultado);
  }
} catch (error) {
  resumen.erroresGlobales.push(String(error?.message ?? error));
} finally {
  await browser.close();
  resumen.fin = new Date().toISOString();
}

resumen.escenarios = resumen.escenarios.map((resultado) => {
  const criticidad = evaluarCriticidad(resultado);
  return {
    ...resultado,
    estado: resultado.loginOk && !criticidad.hayCriticos ? 'OK' : 'ERROR',
    erroresHttpCriticos: criticidad.erroresHttpCriticos,
  };
});

resumen.totales = {
  escenarios: resumen.escenarios.length,
  ok: resumen.escenarios.filter((escenario) => escenario.estado === 'OK').length,
  error: resumen.escenarios.filter((escenario) => escenario.estado !== 'OK').length,
};

console.log('QA_LOCAL_ROLES_RESULTADO_INICIO');
console.log(JSON.stringify(resumen, null, 2));
console.log('QA_LOCAL_ROLES_RESULTADO_FIN');

if (resumen.totales.error > 0 || resumen.erroresGlobales.length > 0) {
  process.exitCode = 1;
}
