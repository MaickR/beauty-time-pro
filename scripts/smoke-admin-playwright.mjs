import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BTP_FRONTEND_URL ?? 'http://localhost:5174';
const credenciales = {
  email: process.env.BTP_SMOKE_EMAIL ?? 'qa.maestro@salonpromaster.com',
  contrasena: process.env.BTP_SMOKE_PASSWORD ?? 'QaLogin2026!',
};

const resultados = {
  loginMaestro: false,
  tabs: [],
  persistenciaBorrador: false,
  creacionSalonQa: false,
  formularioLimpioTrasCrear: false,
  modalDirectorio: false,
  detalles: {},
  advertencias: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByLabel('Correo de acceso').fill(credenciales.email);
  await page.locator('#contrasena').fill(credenciales.contrasena);
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  await page.getByRole('button', { name: /Registrar nuevo salón/i }).waitFor({ timeout: 20000 });
  resultados.loginMaestro = true;

  for (const tab of ['Control de cobros', 'Colaboradores', 'Pre-registros', 'Base de Datos']) {
    await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
    await page.getByText(new RegExp(tab, 'i')).first().waitFor({ timeout: 10000 });
    resultados.tabs.push(tab);
  }

  await page.getByRole('button', { name: /Panel Administrativo|Panel Maestro|Panel Supervisor/i }).click();
  await page.getByRole('button', { name: /Registrar nuevo salón/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });

  const etiquetaDueno = (await page.locator('label[for="dueno-estudio"]').textContent())?.trim() ?? '';
  resultados.detalles.etiquetaDueno = etiquetaDueno;
  if (etiquetaDueno !== 'Nombre completo del dueño') {
    resultados.advertencias.push(`La etiqueta del dueño sigue visible como "${etiquetaDueno}".`);
  }

  const inputNombre = page.locator('#nombre-estudio');
  const inputDueno = page.locator('#dueno-estudio');
  const inputDireccion = page.locator('#direccion-estudio');
  const inputEmail = page.locator('#email-dueno');
  const inputTelefono = page.locator('#telefono-estudio');
  const inputContrasena = page.locator('#contrasena-dueno');
  const botonRegenerar = page.getByLabel('Generar otra contraseña');

  const sello = Date.now().toString().slice(-6);
  const nombreSalon = `Salon QA Navegador ${sello}`;
  await inputNombre.fill(nombreSalon);
  await inputDueno.fill('Laura Gomez');
  await inputDireccion.fill('Calle 123 Centro');
  await inputEmail.fill(`laura${sello}@gmail.com`);
  await inputTelefono.fill('5512345678');

  const contrasenas = [];
  contrasenas.push(await inputContrasena.inputValue());
  assert.equal(contrasenas[0].length, 8, 'La contraseña inicial no tiene 8 caracteres');

  for (let indice = 0; indice < 4; indice += 1) {
    await botonRegenerar.click();
    contrasenas.push(await inputContrasena.inputValue());
  }

  resultados.detalles.contrasenasGeneradas = contrasenas;
  resultados.detalles.maximoVariantesAlcanzado = await botonRegenerar.isDisabled();
  assert.equal(await botonRegenerar.isDisabled(), true, 'El botón de regenerar debió bloquearse al quinto intento');

  await page.getByRole('dialog').getByLabel('Cerrar modal').click();
  await page.getByRole('button', { name: /Registrar nuevo salón/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });

  assert.equal(await inputNombre.inputValue(), nombreSalon, 'No persistió el nombre del salón');
  assert.equal(await inputDueno.inputValue(), 'Laura Gomez', 'No persistió el nombre del dueño');
  assert.equal(await inputDireccion.inputValue(), 'Calle 123 Centro', 'No persistió la dirección');
  assert.equal(await inputTelefono.inputValue(), '5512345678', 'No persistió el teléfono');
  resultados.persistenciaBorrador = true;

  let respuestaCrear = null;
  const promesaRespuestaCrear = page
    .waitForResponse(
      (respuesta) =>
        respuesta.url().includes('/admin/salones') && respuesta.request().method() === 'POST',
      { timeout: 12000 },
    )
    .catch(() => null);

  await page.getByRole('button', { name: 'Crear salón' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Crear salón' }).click();
  respuestaCrear = await promesaRespuestaCrear;

  if (respuestaCrear) {
    resultados.detalles.respuestaCrearSalon = {
      status: respuestaCrear.status(),
      body: await respuestaCrear.text().catch(() => null),
    };
  } else {
    resultados.detalles.respuestaCrearSalon = null;
    resultados.detalles.camposInvalidos = await page.locator(':invalid').evaluateAll((elementos) =>
      elementos.map((elemento) => ({
        id: elemento.id,
        name: elemento.getAttribute('name'),
        ariaLabel: elemento.getAttribute('aria-label'),
        placeholder: elemento.getAttribute('placeholder'),
        validationMessage: 'validationMessage' in elemento ? elemento.validationMessage : null,
      })),
    );
  }

  const confirmacionVisible = await page
    .getByText('Registro completado')
    .isVisible()
    .catch(() => false);
  if (!confirmacionVisible) {
    throw new Error('No apareció la confirmación de creación del salón');
  }
  resultados.creacionSalonQa = true;

  await page.getByRole('button', { name: /Cerrar confirmación/i }).click();
  await page.getByRole('button', { name: /Registrar nuevo salón/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  resultados.formularioLimpioTrasCrear = (await inputNombre.inputValue()) === '';
  assert.equal(resultados.formularioLimpioTrasCrear, true, 'El formulario no quedó limpio tras crear el salón');
  await page.getByRole('dialog').getByLabel('Cerrar modal').click();

  const botonEditar = page.getByLabel(/Ver detalle de/i).first();
  await botonEditar.waitFor({ timeout: 15000 });
  await botonEditar.click();
  await page.getByText(/Información del salón/i).waitFor({ timeout: 15000 });
  resultados.modalDirectorio = true;

  console.log(JSON.stringify(resultados, null, 2));
} catch (error) {
  console.error('SMOKE_ERROR');
  console.error(error?.stack ?? error);
  console.log(JSON.stringify(resultados, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}