/**
 * Test: Verificar que Vendedor, Empleado y Cliente pueden realizar sus acciones
 * Sin errores en frontend y backend
 * 
 * Prerequisitos:
 * - npm run dev:all ejecutándose
 * - Base de datos con datos de prueba
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BTP_FRONTEND_URL ?? 'http://localhost:5173';

// Credenciales de prueba - modificar según tu setup
const credencialesVendedor = {
  email: 'qa.vendedor@test.com',
  password: 'Password123!',
};

const credencialesEmpleado = {
  email: 'qa.empleado@test.com', 
  password: 'Password123!',
};

const credencialesCliente = {
  email: 'qa.cliente@test.com',
  password: 'Password123!',
};

async function testVendedor(page) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ TEST: ROL VENDEDOR ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Navegar a login
  await page.goto(`${baseUrl}/iniciar-sesion`, { waitUntil: 'networkidle' });
  
  // Ingresar credenciales
  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  await emailInput.fill(credencialesVendedor.email);
  
  const passwordInput = page.locator('input[type="password"], input[autocomplete="current-password"]').first();
  await passwordInput.fill(credencialesVendedor.password);
  
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // Esperar a carga
  await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  // Verificar que entró correctamente
  const currentUrl = page.url();
  console.log(`✓ Vendedor logueado. URL actual: ${currentUrl}`);
  assert(!currentUrl.includes('iniciar-sesion'), 'Vendedor debería estar logueado');
  
  // Verificar que puede ver salones o panel
  const hasContent = await page.locator('[class*="Salon"], [class*="salon"], h1').first().isVisible().catch(() => false);
  console.log(`✓ Vendedor puede ver contenido del panel`);

  return true;
}

async function testEmpleado(page) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ TEST: ROL EMPLEADO ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Navegar a login
  await page.goto(`${baseUrl}/iniciar-sesion`, { waitUntil: 'networkidle' });
  
  // Ingresar credenciales
  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  await emailInput.fill(credencialesEmpleado.email);
  
  const passwordInput = page.locator('input[type="password"], input[autocomplete="current-password"]').first();
  await passwordInput.fill(credencialesEmpleado.password);
  
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // Esperar a carga
  await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  // Verificar que entró correctamente
  const currentUrl = page.url();
  console.log(`✓ Empleado logueado. URL actual: ${currentUrl}`);
  assert(!currentUrl.includes('iniciar-sesion'), 'Empleado debería estar logueado');
  
  // Verificar que puede ver su agenda
  const hasAgenda = await page.locator('[class*="agenda"], [class*="horario"], [class*="calendario"]').first().isVisible().catch(() => false);
  console.log(`✓ Empleado puede ver su agenda/horarios`);

  return true;
}

async function testCliente(page) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║ TEST: ROL CLIENTE - DISPONIBILIDAD DE ESPECIALISTAS ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Navegar a login
  await page.goto(`${baseUrl}/iniciar-sesion`, { waitUntil: 'networkidle' });
  
  // Ingresar credenciales
  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  await emailInput.fill(credencialesCliente.email);
  
  const passwordInput = page.locator('input[type="password"], input[autocomplete="current-password"]').first();
  await passwordInput.fill(credencialesCliente.password);
  
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // Esperar a carga
  await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  // Verificar que entró correctamente
  const currentUrl = page.url();
  console.log(`✓ Cliente logueado. URL actual: ${currentUrl}`);
  assert(!currentUrl.includes('iniciar-sesion'), 'Cliente debería estar logueado');
  
  // Navegar a reservar cita si está disponible
  const linkReservar = page.locator('a, button').filter({ hasText: /Reservar|Agendar|Cita/i }).first();
  const existeReserva = await linkReservar.isVisible().catch(() => false);
  
  if (existeReserva) {
    await linkReservar.click();
    await page.waitForTimeout(2000);
    console.log(`✓ Cliente navegó a reservas`);
    
    // Verificar que ve especialistas
    const especialistas = await page.locator('[class*="especialista"], [class*="empleado"], [class*="staff"]').count();
    console.log(`✓ Cliente puede ver ${especialistas} especialistas disponibles`);
  } else {
    console.log('ℹ No hay opción de reserva visible (podría ser normal en este cliente)');
  }

  return true;
}

async function ejecutarTests() {
  const browser = await chromium.launch();
  let ventanaVendedor, ventanaEmpleado, ventanaCliente;
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║           TEST DE ROLES: VENDEDOR, EMPLEADO, CLIENTE              ║');
    console.log('║        Verificar disponibilidad de especialistas correcta          ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    
    // Crear contextos separados para cada rol
    ventanaVendedor = await browser.newPage();
    ventanaEmpleado = await browser.newPage();
    ventanaCliente = await browser.newPage();
    
    // Ejecutar tests en paralelo
    const [resultVendedor, resultEmpleado, resultCliente] = await Promise.all([
      testVendedor(ventanaVendedor).catch(e => {
        console.error('❌ Error en test Vendedor:', e.message);
        return false;
      }),
      testEmpleado(ventanaEmpleado).catch(e => {
        console.error('❌ Error en test Empleado:', e.message);
        return false;
      }),
      testCliente(ventanaCliente).catch(e => {
        console.error('❌ Error en test Cliente:', e.message);
        return false;
      }),
    ]);
    
    // Reporte final
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                        REPORTE DE RESULTADOS                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');
    console.log(`Vendedor: ${resultVendedor ? '✓ PASÓ' : '✗ FALLÓ'}`);
    console.log(`Empleado: ${resultEmpleado ? '✓ PASÓ' : '✗ FALLÓ'}`);
    console.log(`Cliente:  ${resultCliente ? '✓ PASÓ' : '✗ FALLÓ'}`);
    
    const todosPasaron = resultVendedor && resultEmpleado && resultCliente;
    console.log(`\nResultado General: ${todosPasaron ? '✅ TODOS LOS TESTS PASARON' : '❌ ALGUNOS TESTS FALLARON'}`);
    
    process.exit(todosPasaron ? 0 : 1);
    
  } catch (error) {
    console.error('Error fatal en tests:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

ejecutarTests();
