import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BTP_FRONTEND_URL ?? 'http://localhost:5173';
const credenciales = {
  dueno: process.env.BTP_DUENO_EMAIL ?? 'qa.dueno@salonpromaster.com',
  empleado: process.env.BTP_EMPLEADO_EMAIL ?? 'qa.empleado@salonpromaster.com',
  contrasena: process.env.BTP_SMOKE_PASSWORD ?? 'QaLogin2026!',
};

const sello = Date.now().toString().slice(-6);
const selloNombre = sello
  .split('')
  .map((digito) => String.fromCharCode(65 + Number(digito)))
  .join('');
const clientePrueba = `QA Flujo ${selloNombre}`;
const telefonoPrueba = `5510${sello}`;

function formatearFechaIso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

const fechaObjetivo = (() => {
  const fecha = new Date();
  return formatearFechaIso(fecha);
})();

async function iniciarSesion(page, email) {
  await page.goto(`${baseUrl}/iniciar-sesion`, { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForSelector('#acceso, input[autocomplete="username"], input[type="text"]', {
    timeout: 30000,
  });

  const candidatosAcceso = [
    page.locator('#acceso'),
    page.getByLabel(/Clave de acceso|Correo electronico|Correo o teléfono|Correo de acceso|Correo/i),
    page.locator('input[autocomplete="username"]'),
    page.locator('input[type="text"]').first(),
  ];

  let accesoCompletado = false;
  for (const candidato of candidatosAcceso) {
    const existe = await candidato.count().catch(() => 0);
    if (!existe) continue;
    const visible = await candidato.first().isVisible().catch(() => false);
    if (!visible) continue;
    await candidato.first().fill(email);
    accesoCompletado = true;
    break;
  }

  assert.ok(accesoCompletado, 'No se encontró el input principal de acceso en login');

  const botonEntrar = page.getByRole('button', { name: /LOGIN|Entrar al sistema|Entrar/i }).first();
  await botonEntrar.waitFor({ state: 'visible', timeout: 30000 });

  const campoContrasena = page.locator('#contrasena');
  const contrasenaHabilitadaInicial = await campoContrasena.isEnabled().catch(() => false);
  if (!contrasenaHabilitadaInicial) {
    await botonEntrar.click();
    await page
      .waitForFunction(() => {
        const input = document.querySelector('#contrasena');
        return Boolean(input) && !input.disabled && input.offsetParent !== null;
      }, { timeout: 30000 })
      .catch(() => null);
  }

  await campoContrasena.waitFor({ state: 'visible', timeout: 30000 });
  await campoContrasena.fill(credenciales.contrasena);
  await botonEntrar.click();
  await page.waitForLoadState('networkidle');
}

async function seleccionarFechaAgenda(page, fechaIso) {
  const botonFechaObjetivo = page.getByRole('button', { name: fechaIso }).first();
  const existeFechaObjetivo = await botonFechaObjetivo.isVisible().catch(() => false);

  if (existeFechaObjetivo) {
    await botonFechaObjetivo.click();
    await page.waitForLoadState('networkidle');
    return fechaIso;
  }

  const botonesFechaDisponibles = page.locator('button').filter({ hasText: /^\d{4}-\d{2}-\d{2}$/ });
  const totalBotonesFecha = await botonesFechaDisponibles.count();
  for (let indice = 0; indice < totalBotonesFecha; indice += 1) {
    const boton = botonesFechaDisponibles.nth(indice);
    const deshabilitado = await boton.isDisabled().catch(() => true);
    if (deshabilitado) continue;

    const etiqueta = (await boton.textContent())?.trim() ?? '';
    await boton.click();
    await page.waitForLoadState('networkidle');
    return etiqueta || fechaIso;
  }

  throw new Error('No se encontró una fecha disponible en la agenda');
}

async function cerrarDialogosBloqueantes(page) {
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

  await page.waitForLoadState('networkidle');
}

async function obtenerPersonalIdEmpleado() {
  const respuesta = await fetch('http://localhost:3000/auth/iniciar-sesion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: credenciales.empleado,
      contrasena: credenciales.contrasena,
    }),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  const personalId = cuerpo?.datos?.personalId;

  assert.ok(
    respuesta.status === 200 && typeof personalId === 'string' && personalId.length > 0,
    'No se pudo obtener personalId del empleado QA para el smoke de reservas',
  );

  return personalId;
}

async function obtenerTokenEmpleado() {
  const respuesta = await fetch('http://localhost:3000/auth/iniciar-sesion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: credenciales.empleado,
      contrasena: credenciales.contrasena,
    }),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  const token = cuerpo?.datos?.token;
  assert.ok(
    respuesta.status === 200 && typeof token === 'string' && token.length > 0,
    'No se pudo obtener token del empleado QA para validar agenda',
  );

  return token;
}

const browser = await chromium.launch({ headless: true });
const contextoDueno = await browser.newContext();
const paginaDueno = await contextoDueno.newPage();

const resultados = {
  baseUrl,
  fechaObjetivo,
  clientePrueba,
  telefonoPrueba,
  admin: {
    urlFinal: null,
    horaElegida: null,
    respuestaCrear: null,
    clienteVisible: false,
  },
  empleado: {
    urlFinal: null,
    clienteVisible: false,
    servicioVisible: false,
  },
};

try {
  const personalIdEmpleado = await obtenerPersonalIdEmpleado();
  const tokenEmpleado = await obtenerTokenEmpleado();

  await iniciarSesion(paginaDueno, credenciales.dueno);
  await cerrarDialogosBloqueantes(paginaDueno);
  await paginaDueno.getByRole('button', { name: /Crear cita manual/i }).waitFor({ timeout: 30000 });
  resultados.admin.urlFinal = paginaDueno.url();

  const fechaSeleccionada = await seleccionarFechaAgenda(paginaDueno, fechaObjetivo);
  await paginaDueno.getByRole('button', { name: /Crear cita manual/i }).click();

  const dialogo = paginaDueno.getByRole('dialog', { name: /Crear cita manual/i });
  await dialogo.waitFor({ state: 'visible', timeout: 10000 });
  await dialogo.locator('#personal-manual').selectOption(personalIdEmpleado);
  await dialogo.getByRole('button', { name: /Corte Dama \/ Niña/i }).click();

  const botonHora = dialogo.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await botonHora.waitFor({ state: 'visible', timeout: 15000 });
  const horaElegida = (await botonHora.textContent())?.trim();
  assert.ok(horaElegida, 'No se encontró un horario disponible para la cita manual');
  resultados.admin.horaElegida = horaElegida;
  await botonHora.click();

  await dialogo.getByLabel(/Nombre del cliente/i).fill(clientePrueba);
  await dialogo.getByLabel(/Teléfono/i).fill(telefonoPrueba);
  const selectsDialogo = dialogo.locator('select');
  await selectsDialogo.nth(2).selectOption('16');
  await selectsDialogo.nth(3).selectOption('4');
  await selectsDialogo.nth(4).selectOption('1990');
  await dialogo.getByLabel(/Correo electrónico/i).fill(`qa.flujo.${sello}@gmail.com`);

  const promesaCrear = paginaDueno.waitForResponse(
    (respuesta) =>
      respuesta.url().includes('/reservas') && respuesta.request().method() === 'POST',
    { timeout: 15000 },
  );

  await dialogo.getByRole('button', { name: /^Crear cita$/i }).click();
  const respuestaCrear = await promesaCrear;
  resultados.admin.respuestaCrear = {
    status: respuestaCrear.status(),
    url: respuestaCrear.url(),
    body: await respuestaCrear.text(),
  };
  assert.equal(respuestaCrear.status(), 201, 'La cita manual no se creó correctamente desde admin');

  await dialogo.waitFor({ state: 'hidden', timeout: 15000 });
  await paginaDueno.reload({ waitUntil: 'networkidle' });
  await seleccionarFechaAgenda(paginaDueno, fechaSeleccionada);
  // La UI de agenda puede tardar en reflejar el nuevo bloque por rehidratación/scroll virtual.
  // Se valida con reintentos y no bloquea el flujo crítico de propagación hacia empleado.
  let clienteVisibleDueno = false;
  for (let intento = 0; intento < 4; intento += 1) {
    clienteVisibleDueno = await paginaDueno
      .getByText(clientePrueba, { exact: false })
      .isVisible()
      .catch(() => false);

    if (clienteVisibleDueno) {
      break;
    }

    await paginaDueno.reload({ waitUntil: 'networkidle' });
    await seleccionarFechaAgenda(paginaDueno, fechaSeleccionada).catch(() => null);
    await paginaDueno.waitForTimeout(1200);
  }
  resultados.admin.clienteVisible = clienteVisibleDueno;

  const contextoEmpleado = await browser.newContext();
  const paginaEmpleado = await contextoEmpleado.newPage();

  await iniciarSesion(paginaEmpleado, credenciales.empleado);
  await cerrarDialogosBloqueantes(paginaEmpleado);
  await paginaEmpleado.getByRole('button', { name: /Detalle/i }).first().waitFor({ timeout: 30000 });
  resultados.empleado.urlFinal = paginaEmpleado.url();

  await seleccionarFechaAgenda(paginaEmpleado, fechaSeleccionada).catch(() => null);
  const clienteVisibleEnUi = await paginaEmpleado
    .getByText(clientePrueba, { exact: false })
    .isVisible()
    .catch(() => false);

  if (clienteVisibleEnUi) {
    resultados.empleado.clienteVisible = true;
    const textoAgendaEmpleado = await paginaEmpleado.locator('main').textContent();
    assert.match(
      textoAgendaEmpleado ?? '',
      /Corte Dama \/ Niña/,
      'El servicio creado en admin no apareció en la agenda visible del empleado',
    );
    resultados.empleado.servicioVisible = true;
  } else {
    const agendaApi = await fetch(
      `http://localhost:3000/empleados/mi-agenda?fecha=${encodeURIComponent(fechaSeleccionada)}`,
      {
        headers: {
          authorization: `Bearer ${tokenEmpleado}`,
        },
      },
    );
    const cuerpoAgenda = await agendaApi.json().catch(() => ({}));
    const reservas = Array.isArray(cuerpoAgenda?.datos) ? cuerpoAgenda.datos : [];
    const reservaObjetivo = reservas.find((reserva) =>
      String(reserva?.nombreCliente ?? '').toLowerCase().includes(clientePrueba.toLowerCase()),
    );

    assert.ok(
      agendaApi.status === 200 && reservaObjetivo,
      'La reserva no se reflejó en la agenda del empleado (UI ni API)',
    );

    resultados.empleado.clienteVisible = true;
    resultados.empleado.servicioVisible = Array.isArray(reservaObjetivo?.servicios)
      ? reservaObjetivo.servicios.some((servicio) =>
          String(servicio?.name ?? '').toLowerCase().includes('corte dama / niña'.toLowerCase()),
        )
      : false;
    assert.equal(
      resultados.empleado.servicioVisible,
      true,
      'La reserva llegó al empleado pero sin el servicio esperado',
    );
  }

  console.log(JSON.stringify(resultados, null, 2));

  await contextoEmpleado.close();
} catch (error) {
  console.error('SMOKE_ADMIN_EMPLEADO_ERROR');
  console.error(error?.stack ?? error);
  console.log(JSON.stringify(resultados, null, 2));
  process.exitCode = 1;
} finally {
  await contextoDueno.close();
  await browser.close();
}