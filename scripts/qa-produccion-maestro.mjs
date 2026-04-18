import { chromium } from 'playwright';

const urlLogin = process.env.BTP_PROD_URL ?? 'https://salonpromaster.com/iniciar-sesion';
const credenciales = {
  email: process.env.BTP_SMOKE_EMAIL ?? 'qa.maestro@salonpromaster.com',
  contrasena: process.env.BTP_SMOKE_PASSWORD ?? 'QaLogin2026!',
};

const evidenciaGlobal = {
  consola: [],
  erroresPagina: [],
  respuestasApi: [],
  requestsFallidos: [],
};

const informe = {
  ejecucion: {
    inicio: new Date().toISOString(),
    fin: null,
    urlLogin,
    headless: true,
  },
  credenciales: {
    email: credenciales.email,
    contrasenaEnmascarada: `${'*'.repeat(Math.max(4, credenciales.contrasena.length - 2))}${credenciales.contrasena.slice(-2)}`,
  },
  modulos: {
    loginAdminMaestro: {
      estado: 'PENDIENTE',
      detalles: [],
      evidencia: {},
    },
    creacionSalon: {
      estado: 'PENDIENTE',
      detalles: [],
      evidencia: {},
    },
    creacionVendedor: {
      estado: 'PENDIENTE',
      detalles: [],
      evidencia: {},
    },
    creacionSupervisor: {
      estado: 'PENDIENTE',
      detalles: [],
      evidencia: {},
    },
    planStandardPersonal: {
      estado: 'PENDIENTE',
      detalles: [],
      evidencia: {},
    },
  },
  incidencias: [],
};

function instrumentarPagina(pagina, nombrePagina) {
  pagina.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    evidenciaGlobal.consola.push({
      pagina: nombrePagina,
      tipo: mensaje.type(),
      texto: mensaje.text(),
      ubicacion: mensaje.location(),
      momento: new Date().toISOString(),
    });
  });

  pagina.on('pageerror', (error) => {
    evidenciaGlobal.erroresPagina.push({
      pagina: nombrePagina,
      mensaje: String(error?.message ?? error),
      stack: String(error?.stack ?? ''),
      momento: new Date().toISOString(),
    });
  });

  pagina.on('requestfailed', (request) => {
    if (!['fetch', 'xhr'].includes(request.resourceType())) return;
    evidenciaGlobal.requestsFallidos.push({
      pagina: nombrePagina,
      metodo: request.method(),
      url: request.url(),
      razon: request.failure()?.errorText ?? 'desconocida',
      momento: new Date().toISOString(),
    });
  });

  pagina.on('response', (response) => {
    const request = response.request();
    if (!['fetch', 'xhr'].includes(request.resourceType())) return;
    const status = response.status();
    if (status < 400) return;

    evidenciaGlobal.respuestasApi.push({
      pagina: nombrePagina,
      metodo: request.method(),
      url: response.url(),
      status,
      momento: new Date().toISOString(),
    });
  });
}

function tomarMarca() {
  return {
    consola: evidenciaGlobal.consola.length,
    erroresPagina: evidenciaGlobal.erroresPagina.length,
    respuestasApi: evidenciaGlobal.respuestasApi.length,
    requestsFallidos: evidenciaGlobal.requestsFallidos.length,
  };
}

function obtenerEvidenciaDesde(marca) {
  return {
    erroresConsola: evidenciaGlobal.consola.slice(marca.consola),
    erroresPagina: evidenciaGlobal.erroresPagina.slice(marca.erroresPagina),
    erroresApi: evidenciaGlobal.respuestasApi.slice(marca.respuestasApi),
    requestsFallidos: evidenciaGlobal.requestsFallidos.slice(marca.requestsFallidos),
  };
}

async function leerCuerpoRespuesta(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    try {
      return await respuesta.text();
    } catch {
      return null;
    }
  }
}

function hayIncidenciaCritica(evidencia, urlsPermitidas = []) {
  const erroresApiNoPermitidos = evidencia.erroresApi.filter((errorApi) => {
    if (errorApi.status >= 500) return true;
    if (errorApi.status === 401 || errorApi.status === 403) return true;
    if (errorApi.status >= 400 && errorApi.status < 500) {
      return !urlsPermitidas.some((permitida) => errorApi.url.includes(permitida));
    }
    return false;
  });

  return {
    tieneCritica:
      evidencia.erroresConsola.length > 0 ||
      evidencia.erroresPagina.length > 0 ||
      evidencia.requestsFallidos.length > 0 ||
      erroresApiNoPermitidos.length > 0,
    erroresApiNoPermitidos,
  };
}

async function irPanelAdmin(pagina) {
  const botonPanel = pagina
    .getByRole('button', { name: /Panel Administrativo|Panel Maestro|Panel Supervisor/i })
    .first();
  if (await botonPanel.isVisible().catch(() => false)) {
    await botonPanel.click();
  }
}

async function abrirModalSalon(pagina) {
  await irPanelAdmin(pagina);
  await pagina.getByRole('button', { name: /Registrar nuevo salón/i }).first().click();
  await pagina.getByRole('dialog').waitFor({ timeout: 15000 });
}

async function llenarFormularioSalon(pagina, datos) {
  await pagina.locator('#nombre-estudio').fill(datos.nombreSalon);
  await pagina.locator('#dueno-estudio').fill(datos.dueno);
  await pagina.locator('#direccion-estudio').fill(datos.direccion);
  await pagina.locator('#email-dueno').fill(datos.emailDueno);
  await pagina.locator('#contrasena-dueno').fill(datos.contrasenaDueno);
  await pagina.locator('#telefono-estudio').fill(datos.telefono);
  await pagina.locator('#plan-estudio').selectOption(datos.plan);
  await pagina.locator('#inicio-operaciones').fill(datos.inicioOperaciones);
}

function extraerListaDatos(posiblePayload) {
  if (Array.isArray(posiblePayload)) return posiblePayload;
  if (!posiblePayload || typeof posiblePayload !== 'object') return [];

  const candidatos = [
    posiblePayload.datos,
    posiblePayload.data,
    posiblePayload.items,
    posiblePayload.salones,
    posiblePayload.colaboradores,
  ];

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) return candidato;
    if (candidato && typeof candidato === 'object') {
      if (Array.isArray(candidato.items)) return candidato.items;
      if (Array.isArray(candidato.datos)) return candidato.datos;
      if (Array.isArray(candidato.salones)) return candidato.salones;
    }
  }

  return [];
}

async function buscarSalonPorNombre(pagina, nombreSalon) {
  return pagina.evaluate(async (nombreBuscado) => {
    const rutas = [
      '/admin/salones/activos?pagina=1&limite=200',
      '/admin/salones?pagina=1&limite=200',
      '/admin/salones',
    ];

    for (const ruta of rutas) {
      try {
        const respuesta = await fetch(ruta, { credentials: 'include' });
        if (!respuesta.ok) continue;
        const payload = await respuesta.json().catch(() => null);
        const lista = Array.isArray(payload?.datos)
          ? payload.datos
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.datos?.items)
              ? payload.datos.items
              : Array.isArray(payload?.items)
                ? payload.items
                : [];

        const encontrado = lista.find((item) => item?.nombre === nombreBuscado);
        if (encontrado) {
          return { encontrado, rutaUsada: ruta, status: respuesta.status };
        }
      } catch {
        // Ignorar y probar siguiente ruta.
      }
    }

    return { encontrado: null, rutaUsada: null, status: null };
  }, nombreSalon);
}

async function buscarColaboradorPorEmail(pagina, correo) {
  return pagina.evaluate(async (emailBuscado) => {
    try {
      const respuesta = await fetch('/admin/admins', { credentials: 'include' });
      const payload = await respuesta.json().catch(() => null);
      const lista = Array.isArray(payload?.datos)
        ? payload.datos
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const encontrado = lista.find((item) => item?.email?.toLowerCase?.() === emailBuscado);
      return { status: respuesta.status, encontrado: encontrado ?? null };
    } catch (error) {
      return { status: null, encontrado: null, error: String(error?.message ?? error) };
    }
  }, correo.toLowerCase());
}

async function obtenerPersonalEstudio(pagina, estudioId) {
  return pagina.evaluate(async (id) => {
    try {
      const respuesta = await fetch(`/estudios/${id}/personal`, { credentials: 'include' });
      const payload = await respuesta.json().catch(() => null);
      const lista = Array.isArray(payload?.datos) ? payload.datos : [];
      return { status: respuesta.status, total: lista.length };
    } catch (error) {
      return { status: null, total: 0, error: String(error?.message ?? error) };
    }
  }, estudioId);
}

async function completarFormularioLogin(pagina, email, contrasena) {
  const campoIdentificador = pagina.locator('#identificador');
  if (await campoIdentificador.count()) {
    await campoIdentificador.fill(email);
  } else {
    await pagina.getByLabel(/Correo de acceso|Correo o teléfono/i).fill(email);
  }

  await pagina.locator('#contrasena').fill(contrasena);
}

const navegador = await chromium.launch({ headless: true });
const contexto = await navegador.newContext();
const pagina = await contexto.newPage();
instrumentarPagina(pagina, 'maestro');

const contextoPruebas = {
  salonPro: null,
  vendedor: null,
  supervisor: null,
  salonStandard: null,
};

try {
  {
    const modulo = informe.modulos.loginAdminMaestro;
    const marca = tomarMarca();

    try {
      await pagina.goto(urlLogin, { waitUntil: 'networkidle', timeout: 40000 });
      await completarFormularioLogin(pagina, credenciales.email, credenciales.contrasena);

      const respuestaLoginPromise = pagina.waitForResponse(
        (respuesta) =>
          respuesta.url().includes('/auth/iniciar-sesion') &&
          respuesta.request().method() === 'POST',
        { timeout: 20000 },
      );

      await pagina.getByRole('button', { name: /Entrar al sistema/i }).click();
      const respuestaLogin = await respuestaLoginPromise;
      const cuerpoLogin = await leerCuerpoRespuesta(respuestaLogin);

      modulo.detalles.push(`HTTP login: ${respuestaLogin.status()}`);
      modulo.evidencia.respuestaLogin = {
        status: respuestaLogin.status(),
        body: cuerpoLogin,
      };

      if (respuestaLogin.status() >= 400) {
        throw new Error(`Login devolvio estado ${respuestaLogin.status()}`);
      }

      await pagina
        .getByRole('button', { name: /Registrar nuevo salón|Colaboradores|Control de cobros/i })
        .first()
        .waitFor({ timeout: 20000 });

      modulo.estado = 'OK';
      modulo.detalles.push(`Ruta tras login: ${pagina.url()}`);
    } catch (error) {
      modulo.estado = 'ERROR';
      modulo.detalles.push(String(error?.message ?? error));
      informe.incidencias.push({
        modulo: 'loginAdminMaestro',
        tipo: 'error-ejecucion',
        detalle: String(error?.stack ?? error),
      });
    } finally {
      modulo.evidencia = { ...modulo.evidencia, ...obtenerEvidenciaDesde(marca) };
      const criticidad = hayIncidenciaCritica(modulo.evidencia);
      if (criticidad.tieneCritica && modulo.estado === 'OK') {
        modulo.estado = 'ERROR';
        modulo.detalles.push('Se detectaron incidencias tecnicas durante el modulo.');
      }
    }
  }

  if (informe.modulos.loginAdminMaestro.estado === 'OK') {
    {
      const modulo = informe.modulos.creacionSalon;
      const marca = tomarMarca();

      try {
        const sufijo = Date.now().toString().slice(-7);
        const datosSalon = {
          nombreSalon: `Salon QA PRO ${sufijo}`,
          dueno: 'Diana Herrera',
          direccion: 'Avenida Central 123',
          emailDueno: `qa.pro.${sufijo}@gmail.com`,
          contrasenaDueno: 'QaSalon2026!',
          telefono: '5512345678',
          plan: 'PRO',
          inicioOperaciones: '2026-01-01',
        };

        await abrirModalSalon(pagina);
        await llenarFormularioSalon(pagina, datosSalon);

        const respuestaCrearPromise = pagina.waitForResponse(
          (respuesta) =>
            respuesta.url().includes('/admin/salones') && respuesta.request().method() === 'POST',
          { timeout: 25000 },
        );

        await pagina.getByRole('button', { name: /Crear salón/i }).click();
        const respuestaCrear = await respuestaCrearPromise;
        const cuerpoCrear = await leerCuerpoRespuesta(respuestaCrear);

        modulo.evidencia.respuestaCrearSalon = {
          status: respuestaCrear.status(),
          body: cuerpoCrear,
        };

        if (respuestaCrear.status() >= 400) {
          throw new Error(`Crear salon devolvio estado ${respuestaCrear.status()}`);
        }

        await pagina.getByText(/Registro completado/i).waitFor({ timeout: 15000 });
        await pagina.getByRole('button', { name: /Cerrar confirmación/i }).click();

        const verificacionSalon = await buscarSalonPorNombre(pagina, datosSalon.nombreSalon);
        modulo.evidencia.verificacionPersistencia = verificacionSalon;

        if (!verificacionSalon.encontrado) {
          throw new Error('No se encontro el salon creado al consultar endpoints admin.');
        }

        if (String(verificacionSalon.encontrado.plan ?? '').toUpperCase() !== 'PRO') {
          throw new Error('El salon se creo, pero el plan no coincide con PRO.');
        }

        contextoPruebas.salonPro = {
          ...datosSalon,
          id: verificacionSalon.encontrado.id,
        };

        modulo.estado = 'OK';
        modulo.detalles.push(`Salon creado y persistido: ${datosSalon.nombreSalon}`);
      } catch (error) {
        modulo.estado = 'ERROR';
        modulo.detalles.push(String(error?.message ?? error));
        informe.incidencias.push({
          modulo: 'creacionSalon',
          tipo: 'error-ejecucion',
          detalle: String(error?.stack ?? error),
        });
      } finally {
        modulo.evidencia = { ...modulo.evidencia, ...obtenerEvidenciaDesde(marca) };
        const criticidad = hayIncidenciaCritica(modulo.evidencia);
        if (criticidad.tieneCritica && modulo.estado === 'OK') {
          modulo.estado = 'ERROR';
          modulo.detalles.push('Se detectaron incidencias tecnicas durante el modulo.');
        }
      }
    }

    {
      const modulo = informe.modulos.creacionVendedor;
      const marca = tomarMarca();

      try {
        const sufijo = Date.now().toString().slice(-7);
        const nombre = `Vendedor QA ${sufijo}`;
        const email = `qa.vendedor.${sufijo}@gmail.com`;

        await pagina.getByRole('button', { name: /Colaboradores/i }).first().click();
        await pagina.getByRole('button', { name: /Nuevo colaborador/i }).click();
        await pagina.getByRole('dialog').waitFor({ timeout: 10000 });

        await pagina.locator('#cargo-colaborador').selectOption('vendedor');
        await pagina.locator('#nombre-colaborador').fill(nombre);
        await pagina.locator('#email-colaborador').fill(email);
        await pagina.getByRole('button', { name: /^Generar$/i }).click();

        const contrasenaGenerada = await pagina.locator('#contrasena-colaborador').inputValue();
        modulo.evidencia.credenciales = {
          email,
          contrasenaGenerada: Boolean(contrasenaGenerada),
          longitudContrasena: contrasenaGenerada.length,
        };

        if (!contrasenaGenerada) {
          throw new Error('No se genero contrasena para el vendedor.');
        }

        const respuestaCrearPromise = pagina.waitForResponse(
          (respuesta) =>
            respuesta.url().includes('/admin/admins') && respuesta.request().method() === 'POST',
          { timeout: 25000 },
        );

        await pagina.getByRole('button', { name: /Crear colaborador/i }).click();
        const respuestaCrear = await respuestaCrearPromise;
        const cuerpoCrear = await leerCuerpoRespuesta(respuestaCrear);

        modulo.evidencia.respuestaCrearVendedor = {
          status: respuestaCrear.status(),
          body: cuerpoCrear,
        };

        if (respuestaCrear.status() >= 400) {
          throw new Error(`Crear vendedor devolvio estado ${respuestaCrear.status()}`);
        }

        const verificacion = await buscarColaboradorPorEmail(pagina, email);
        modulo.evidencia.verificacionPersistencia = verificacion;

        if (!verificacion.encontrado) {
          throw new Error('No se encontro el vendedor creado en /admin/admins.');
        }

        if (String(verificacion.encontrado.rol ?? '').toLowerCase() !== 'vendedor') {
          throw new Error('El colaborador creado no quedo con rol vendedor.');
        }

        contextoPruebas.vendedor = {
          nombre,
          email,
          contrasena: contrasenaGenerada,
          id: verificacion.encontrado.id,
        };

        modulo.estado = 'OK';
        modulo.detalles.push(`Vendedor creado y persistido: ${email}`);
      } catch (error) {
        modulo.estado = 'ERROR';
        modulo.detalles.push(String(error?.message ?? error));
        informe.incidencias.push({
          modulo: 'creacionVendedor',
          tipo: 'error-ejecucion',
          detalle: String(error?.stack ?? error),
        });
      } finally {
        modulo.evidencia = { ...modulo.evidencia, ...obtenerEvidenciaDesde(marca) };
        const criticidad = hayIncidenciaCritica(modulo.evidencia);
        if (criticidad.tieneCritica && modulo.estado === 'OK') {
          modulo.estado = 'ERROR';
          modulo.detalles.push('Se detectaron incidencias tecnicas durante el modulo.');
        }
      }
    }

    {
      const modulo = informe.modulos.creacionSupervisor;
      const marca = tomarMarca();

      try {
        const sufijo = Date.now().toString().slice(-7);
        const nombre = `Supervisor QA ${sufijo}`;
        const email = `qa.supervisor.${sufijo}@gmail.com`;

        await pagina.getByRole('button', { name: /Colaboradores/i }).first().click();
        await pagina.getByRole('button', { name: /Nuevo colaborador/i }).click();
        await pagina.getByRole('dialog').waitFor({ timeout: 10000 });

        await pagina.locator('#cargo-colaborador').selectOption('supervisor');
        await pagina.locator('#nombre-colaborador').fill(nombre);
        await pagina.locator('#email-colaborador').fill(email);
        await pagina.getByRole('button', { name: /^Generar$/i }).click();

        const contrasenaGenerada = await pagina.locator('#contrasena-colaborador').inputValue();
        if (!contrasenaGenerada) {
          throw new Error('No se genero contrasena para el supervisor.');
        }

        await pagina.getByRole('button', { name: /Métricas/i }).click();
        await pagina.getByLabel(/Ver control de salones/i).check();

        const respuestaCrearPromise = pagina.waitForResponse(
          (respuesta) =>
            respuesta.url().includes('/admin/admins') && respuesta.request().method() === 'POST',
          { timeout: 25000 },
        );

        await pagina.getByRole('button', { name: /Crear colaborador/i }).click();
        const respuestaCrear = await respuestaCrearPromise;
        const cuerpoCrear = await leerCuerpoRespuesta(respuestaCrear);

        modulo.evidencia.respuestaCrearSupervisor = {
          status: respuestaCrear.status(),
          body: cuerpoCrear,
        };

        if (respuestaCrear.status() >= 400) {
          throw new Error(`Crear supervisor devolvio estado ${respuestaCrear.status()}`);
        }

        const verificacion = await buscarColaboradorPorEmail(pagina, email);
        modulo.evidencia.verificacionPersistencia = verificacion;

        if (!verificacion.encontrado) {
          throw new Error('No se encontro el supervisor creado en /admin/admins.');
        }

        if (String(verificacion.encontrado.rol ?? '').toLowerCase() !== 'supervisor') {
          throw new Error('El colaborador creado no quedo con rol supervisor.');
        }

        const permisoVerControlSalones = Boolean(
          verificacion.encontrado?.permisosSupervisor?.verControlSalones,
        );
        if (!permisoVerControlSalones) {
          throw new Error('El supervisor no quedo con permiso verControlSalones.');
        }

        contextoPruebas.supervisor = {
          nombre,
          email,
          contrasena: contrasenaGenerada,
          id: verificacion.encontrado.id,
        };

        const contextoSupervisor = await navegador.newContext();
        const paginaSupervisor = await contextoSupervisor.newPage();
        instrumentarPagina(paginaSupervisor, 'supervisor');

        try {
          await paginaSupervisor.goto(urlLogin, { waitUntil: 'networkidle', timeout: 40000 });
          await completarFormularioLogin(paginaSupervisor, email, contrasenaGenerada);

          const respuestaLoginSupervisorPromise = paginaSupervisor.waitForResponse(
            (respuesta) =>
              respuesta.url().includes('/auth/iniciar-sesion') &&
              respuesta.request().method() === 'POST',
            { timeout: 20000 },
          );

          await paginaSupervisor.getByRole('button', { name: /Entrar al sistema/i }).click();
          const respuestaLoginSupervisor = await respuestaLoginSupervisorPromise;

          if (respuestaLoginSupervisor.status() >= 400) {
            throw new Error(
              `El supervisor no pudo iniciar sesion. Estado ${respuestaLoginSupervisor.status()}`,
            );
          }

          await paginaSupervisor.getByText(/Panel Supervisor/i).first().waitFor({ timeout: 20000 });

          if (!paginaSupervisor.url().includes('/supervisor')) {
            throw new Error(`Ruta final inesperada para supervisor: ${paginaSupervisor.url()}`);
          }

          modulo.evidencia.loginSupervisor = {
            estado: respuestaLoginSupervisor.status(),
            rutaFinal: paginaSupervisor.url(),
          };
        } finally {
          await contextoSupervisor.close();
        }

        modulo.estado = 'OK';
        modulo.detalles.push(`Supervisor creado y login funcional: ${email}`);
      } catch (error) {
        modulo.estado = 'ERROR';
        modulo.detalles.push(String(error?.message ?? error));
        informe.incidencias.push({
          modulo: 'creacionSupervisor',
          tipo: 'error-ejecucion',
          detalle: String(error?.stack ?? error),
        });
      } finally {
        modulo.evidencia = { ...modulo.evidencia, ...obtenerEvidenciaDesde(marca) };
        const criticidad = hayIncidenciaCritica(modulo.evidencia);
        if (criticidad.tieneCritica && modulo.estado === 'OK') {
          modulo.estado = 'ERROR';
          modulo.detalles.push('Se detectaron incidencias tecnicas durante el modulo.');
        }
      }
    }

    {
      const modulo = informe.modulos.planStandardPersonal;
      const marca = tomarMarca();

      try {
        const sufijoBase = Date.now().toString().slice(-7);

        const datosSalonStandard = {
          nombreSalon: `Salon QA STD ${sufijoBase}`,
          dueno: 'Marcela Rivera',
          direccion: 'Calle Norte 456',
          emailDueno: `qa.std.${sufijoBase}@gmail.com`,
          contrasenaDueno: 'QaSalon2026!',
          telefono: '5598765432',
          plan: 'STANDARD',
          inicioOperaciones: '2026-01-01',
        };

        await abrirModalSalon(pagina);
        await llenarFormularioSalon(pagina, datosSalonStandard);
        await pagina.locator('#nombre-personal').fill('Especialista Uno QA');
        await pagina.getByRole('button', { name: /Guardar Empleado/i }).click();

        const respuestaCrearStandardPromise = pagina.waitForResponse(
          (respuesta) =>
            respuesta.url().includes('/admin/salones') && respuesta.request().method() === 'POST',
          { timeout: 25000 },
        );

        await pagina.getByRole('button', { name: /Crear salón/i }).click();
        const respuestaCrearStandard = await respuestaCrearStandardPromise;
        const cuerpoCrearStandard = await leerCuerpoRespuesta(respuestaCrearStandard);

        modulo.evidencia.creacionStandard = {
          status: respuestaCrearStandard.status(),
          body: cuerpoCrearStandard,
        };

        if (respuestaCrearStandard.status() >= 400) {
          throw new Error(
            `No se pudo crear salon STANDARD con 1 empleado. Estado ${respuestaCrearStandard.status()}`,
          );
        }

        await pagina.getByText(/Registro completado/i).waitFor({ timeout: 15000 });
        await pagina.getByRole('button', { name: /Cerrar confirmación/i }).click();

        const verificacionSalon = await buscarSalonPorNombre(pagina, datosSalonStandard.nombreSalon);
        if (!verificacionSalon.encontrado) {
          throw new Error('No se encontro el salon STANDARD recien creado en endpoints admin.');
        }

        if (String(verificacionSalon.encontrado.plan ?? '').toUpperCase() !== 'STANDARD') {
          throw new Error('El salon STANDARD no quedo con plan STANDARD.');
        }

        const personal = await obtenerPersonalEstudio(pagina, verificacionSalon.encontrado.id);
        modulo.evidencia.personalSalonStandard = personal;
        if (personal.status !== 200 || personal.total < 1) {
          throw new Error('El salon STANDARD se creo, pero no reflejo personal asociado.');
        }

        contextoPruebas.salonStandard = {
          ...datosSalonStandard,
          id: verificacionSalon.encontrado.id,
        };

        const sufijoLimite = `${Date.now()}`.slice(-7);
        const datosLimite = {
          nombreSalon: `Salon QA STD LIM ${sufijoLimite}`,
          dueno: 'Lina Cardenas',
          direccion: 'Carrera 90 #12',
          emailDueno: `qa.std.lim.${sufijoLimite}@gmail.com`,
          contrasenaDueno: 'QaSalon2026!',
          telefono: '5587654321',
          plan: 'STANDARD',
          inicioOperaciones: '2026-01-01',
        };

        await abrirModalSalon(pagina);
        await llenarFormularioSalon(pagina, datosLimite);

        for (let indice = 1; indice <= 6; indice += 1) {
          await pagina.locator('#nombre-personal').fill(`Especialista Limite ${indice}`);
          await pagina.getByRole('button', { name: /Guardar Empleado/i }).click();
          await pagina.waitForTimeout(30);
        }

        const respuestaLimitePromise = pagina.waitForResponse(
          (respuesta) =>
            respuesta.url().includes('/admin/salones') && respuesta.request().method() === 'POST',
          { timeout: 25000 },
        );

        await pagina.getByRole('button', { name: /Crear salón/i }).click();
        const respuestaLimite = await respuestaLimitePromise;
        const cuerpoLimite = await leerCuerpoRespuesta(respuestaLimite);

        modulo.evidencia.validacionLimite = {
          status: respuestaLimite.status(),
          body: cuerpoLimite,
        };

        if (respuestaLimite.status() < 400 || respuestaLimite.status() >= 500) {
          throw new Error(
            `Se esperaba rechazo 4xx por limite de personal y se obtuvo ${respuestaLimite.status()}`,
          );
        }

        const mensajeLimite = JSON.stringify(cuerpoLimite ?? '').toLowerCase();
        if (!mensajeLimite.includes('emplead') && !mensajeLimite.includes('plan')) {
          throw new Error('El rechazo por limite no devolvio mensaje coherente con reglas de plan.');
        }

        const botonCerrarModal = pagina.getByLabel(/Cerrar modal/i).first();
        if (await botonCerrarModal.isVisible().catch(() => false)) {
          await botonCerrarModal.click();
        }

        modulo.estado = 'OK';
        modulo.detalles.push('Salon STANDARD creado con personal y validacion de limite 6 empleados aplicada.');
      } catch (error) {
        modulo.estado = 'ERROR';
        modulo.detalles.push(String(error?.message ?? error));
        informe.incidencias.push({
          modulo: 'planStandardPersonal',
          tipo: 'error-ejecucion',
          detalle: String(error?.stack ?? error),
        });
      } finally {
        modulo.evidencia = { ...modulo.evidencia, ...obtenerEvidenciaDesde(marca) };
        const criticidad = hayIncidenciaCritica(modulo.evidencia, ['/admin/salones']);

        const erroresApiInesperados = criticidad.erroresApiNoPermitidos;
        if (erroresApiInesperados.length > 0 && modulo.estado === 'OK') {
          modulo.estado = 'ERROR';
          modulo.detalles.push('Se detectaron respuestas API no esperadas en este modulo.');
        }

        if (
          (modulo.evidencia.erroresConsola?.length ?? 0) > 0 ||
          (modulo.evidencia.erroresPagina?.length ?? 0) > 0 ||
          (modulo.evidencia.requestsFallidos?.length ?? 0) > 0
        ) {
          if (modulo.estado === 'OK') {
            modulo.estado = 'ERROR';
            modulo.detalles.push('Se detectaron errores de consola/pagina/request durante el modulo.');
          }
        }
      }
    }
  } else {
    for (const clave of ['creacionSalon', 'creacionVendedor', 'creacionSupervisor', 'planStandardPersonal']) {
      informe.modulos[clave].estado = 'ERROR';
      informe.modulos[clave].detalles.push(
        'Modulo no ejecutado por fallo previo en login admin maestro.',
      );
    }
  }
} catch (errorGlobal) {
  informe.incidencias.push({
    modulo: 'global',
    tipo: 'error-no-controlado',
    detalle: String(errorGlobal?.stack ?? errorGlobal),
  });
} finally {
  await contexto.close();
  await navegador.close();
  informe.ejecucion.fin = new Date().toISOString();
}

informe.evidenciaGlobal = evidenciaGlobal;
informe.contextoPruebas = {
  salonPro: contextoPruebas.salonPro,
  vendedor: contextoPruebas.vendedor
    ? { ...contextoPruebas.vendedor, contrasena: '[oculta]' }
    : null,
  supervisor: contextoPruebas.supervisor
    ? { ...contextoPruebas.supervisor, contrasena: '[oculta]' }
    : null,
  salonStandard: contextoPruebas.salonStandard,
};

const modulosEnError = Object.entries(informe.modulos)
  .filter(([, valor]) => valor.estado !== 'OK')
  .map(([clave]) => clave);

informe.resumen = {
  totalModulos: Object.keys(informe.modulos).length,
  modulosOk: Object.values(informe.modulos).filter((modulo) => modulo.estado === 'OK').length,
  modulosError: modulosEnError.length,
  listaModulosError: modulosEnError,
  totalErroresConsola: evidenciaGlobal.consola.length,
  totalErroresPagina: evidenciaGlobal.erroresPagina.length,
  totalErroresApi: evidenciaGlobal.respuestasApi.length,
  totalRequestsFallidos: evidenciaGlobal.requestsFallidos.length,
};

console.log('QA_PRODUCCION_RESULTADO_JSON_INICIO');
console.log(JSON.stringify(informe, null, 2));
console.log('QA_PRODUCCION_RESULTADO_JSON_FIN');

if (modulosEnError.length > 0) {
  process.exitCode = 1;
}
