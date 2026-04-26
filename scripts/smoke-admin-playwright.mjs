import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BTP_FRONTEND_URL ?? 'http://localhost:5173';
const credenciales = {
  email: process.env.BTP_SMOKE_EMAIL ?? 'qa.maestro@salonpromaster.com',
  contrasena: process.env.BTP_SMOKE_PASSWORD ?? 'QaLogin2026!',
};

const resultados = {
  loginMaestro: false,
  tabs: [],
  persistenciaBorrador: false,
  creacionSalonQa: false,
  creacionColaboradorQa: false,
  formularioLimpioTrasCrear: false,
  modalDirectorio: false,
  detalles: {},
  advertencias: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

async function llenarCampoAcceso(valor) {
  await page.waitForSelector('#acceso, input[autocomplete="username"], input[type="text"]', {
    timeout: 30000,
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

async function llenarContrasena(valor) {
  const campo = page.locator('#contrasena');
  await campo.waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(
    () => {
      const input = document.querySelector('#contrasena');
      return Boolean(input) && !input.disabled && input.offsetParent !== null;
    },
    { timeout: 30000 },
  );
  await campo.fill(valor);
}

async function enviarFormularioLogin() {
  const boton = page.getByRole('button', { name: /LOGIN|Entrar al sistema|Entrar/i }).first();
  await boton.waitFor({ state: 'visible', timeout: 30000 });
  await boton.click();
}

async function ejecutarLoginMaestro() {
  await llenarCampoAcceso(credenciales.email);

  const campoContrasena = page.locator('#contrasena');
  const contrasenaHabilitadaInicial = await campoContrasena.isEnabled().catch(() => false);

  if (!contrasenaHabilitadaInicial) {
    await enviarFormularioLogin();
    await Promise.race([
      page
        .waitForFunction(
          () => {
            const input = document.querySelector('#contrasena');
            return Boolean(input) && !input.disabled && input.offsetParent !== null;
          },
          { timeout: 30000 },
        )
        .catch(() => null),
      page.waitForURL((url) => !url.pathname.endsWith('/iniciar-sesion'), {
        timeout: 30000,
      }).catch(() => null),
    ]);
  }

  const sigueEnLogin = new URL(page.url()).pathname.endsWith('/iniciar-sesion');
  const contrasenaHabilitada = await campoContrasena.isEnabled().catch(() => false);

  if (sigueEnLogin && contrasenaHabilitada) {
    await llenarContrasena(credenciales.contrasena);
    await enviarFormularioLogin();
  }
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await ejecutarLoginMaestro();
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
  assert.match(
    contrasenas[0],
    /^[A-Z]{3}[a-z0-9]{3}\d{2}[#*!$%&]$/,
    'La contraseña inicial no cumple el formato salón esperado',
  );

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

  const dialogoDetalle = page.getByRole('dialog').last();
  const botonCerrarDetalle = dialogoDetalle.getByLabel(/Cerrar modal|Cerrar/i).first();
  if (await botonCerrarDetalle.isVisible().catch(() => false)) {
    await botonCerrarDetalle.click();
  }

  await page.getByRole('button', { name: /Colaboradores/i }).click();
  await page.getByRole('button', { name: /Nuevo colaborador/i }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Nuevo colaborador/i }).click();

  const dialogoColaborador = page.getByRole('dialog').last();
  await dialogoColaborador.waitFor({ timeout: 10000 });

  const selloColaborador = `${Date.now()}`.slice(-6);
  const emailColaborador = `supervisor.smoke.${selloColaborador}@gmail.com`;
  const nombreColaborador = 'Supervisor Humo';
  const contrasenaColaborador = `Su${selloColaborador}#`;

  await dialogoColaborador.locator('#cargo-colaborador').selectOption('supervisor');
  await dialogoColaborador.locator('#nombre-colaborador').fill(nombreColaborador);
  await dialogoColaborador.locator('#email-colaborador').fill(emailColaborador);
  await dialogoColaborador.locator('#contrasena-colaborador').fill(contrasenaColaborador);

  const promesaRespuestaColaborador = page
    .waitForResponse(
      (respuesta) =>
        respuesta.url().includes('/admin/admins') && respuesta.request().method() === 'POST',
      { timeout: 12000 },
    )
    .catch(() => null);

  await dialogoColaborador.getByRole('button', { name: /Crear colaborador/i }).click();
  const respuestaCrearColaborador = await promesaRespuestaColaborador;

  if (respuestaCrearColaborador) {
    resultados.detalles.respuestaCrearColaborador = {
      status: respuestaCrearColaborador.status(),
      body: await respuestaCrearColaborador.text().catch(() => null),
      email: emailColaborador,
    };
  } else {
    resultados.detalles.respuestaCrearColaborador = null;
    resultados.detalles.camposInvalidosColaborador = await dialogoColaborador
      .locator(':invalid')
      .evaluateAll((elementos) =>
        elementos.map((elemento) => ({
          id: elemento.id,
          name: elemento.getAttribute('name'),
          ariaLabel: elemento.getAttribute('aria-label'),
          placeholder: elemento.getAttribute('placeholder'),
          validationMessage: 'validationMessage' in elemento ? elemento.validationMessage : null,
        })),
      )
      .catch(() => []);
  }

  assert.equal(
    respuestaCrearColaborador?.status(),
    201,
    'La creación del colaborador no devolvió 201',
  );

  await page.getByText(/Colaborador creado correctamente/i).waitFor({ timeout: 15000 });
  resultados.creacionColaboradorQa = true;

  await page.getByText(emailColaborador).first().waitFor({ timeout: 15000 });

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