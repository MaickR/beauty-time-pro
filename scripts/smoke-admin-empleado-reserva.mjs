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
const fechaObjetivo = '2026-04-17';

async function iniciarSesion(page, email) {
  await page.goto(`${baseUrl}/iniciar-sesion`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByLabel(/Correo o teléfono/i).fill(email);
  await page.locator('#contrasena').fill(credenciales.contrasena);
  await page.getByRole('button', { name: /Entrar al sistema/i }).click();
  await page.waitForLoadState('networkidle');
}

async function seleccionarFechaAgenda(page, fechaIso) {
  await page.getByRole('button', { name: fechaIso }).click();
  await page.waitForLoadState('networkidle');
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
  await iniciarSesion(paginaDueno, credenciales.dueno);
  await paginaDueno.getByRole('button', { name: /Crear cita manual/i }).waitFor({ timeout: 30000 });
  resultados.admin.urlFinal = paginaDueno.url();

  await seleccionarFechaAgenda(paginaDueno, fechaObjetivo);
  await paginaDueno.getByRole('button', { name: /Crear cita manual/i }).click();

  const dialogo = paginaDueno.getByRole('dialog', { name: /Crear cita manual/i });
  await dialogo.waitFor({ state: 'visible', timeout: 10000 });
  await dialogo.locator('#personal-manual').selectOption({ label: 'QA Especialista' });
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
  await seleccionarFechaAgenda(paginaDueno, fechaObjetivo);
  await paginaDueno.getByText(clientePrueba, { exact: false }).waitFor({ timeout: 15000 });
  resultados.admin.clienteVisible = true;

  const contextoEmpleado = await browser.newContext();
  const paginaEmpleado = await contextoEmpleado.newPage();

  await iniciarSesion(paginaEmpleado, credenciales.empleado);
  await paginaEmpleado.getByRole('button', { name: /Detalle/i }).first().waitFor({ timeout: 30000 });
  resultados.empleado.urlFinal = paginaEmpleado.url();

  await seleccionarFechaAgenda(paginaEmpleado, fechaObjetivo);
  await paginaEmpleado.getByText(clientePrueba, { exact: false }).waitFor({ timeout: 15000 });
  resultados.empleado.clienteVisible = true;
  const textoAgendaEmpleado = await paginaEmpleado.locator('main').textContent();
  assert.match(
    textoAgendaEmpleado ?? '',
    /Corte Dama \/ Niña/,
    'El servicio creado en admin no apareció en la agenda del empleado',
  );
  resultados.empleado.servicioVisible = true;

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