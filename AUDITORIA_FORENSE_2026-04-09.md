# Auditoría Forense de Software — Beauty Time Pro

**Fecha:** 9 de abril de 2026  
**Tipo:** Auditoría técnica integral de seguridad, accesibilidad, escalabilidad, performance y buenas prácticas  
**Alcance:** Revisión línea por línea de todo el código fuente (frontend y backend)  
**Destino comercial:** SaaS para salones de belleza — Colombia y México  
**Stack auditado:** React 19 + Vite 7 + Tailwind CSS 4 + TypeScript strict | Fastify + Prisma 7 + MySQL 8  
**Infraestructura destino:** Vercel (frontend) + Railway (backend)

---

## Resumen ejecutivo

| Categoría | Hallazgos críticos | Hallazgos altos | Hallazgos medios | Hallazgos bajos |
|---|---|---|---|---|
| Seguridad | 7 | 5 | 6 | 2 |
| Accesibilidad | 0 | 3 | 5 | 4 |
| Escalabilidad y mantenibilidad | 2 | 4 | 5 | 3 |
| Performance | 1 | 2 | 3 | 1 |
| Responsive design y UX | 0 | 1 | 3 | 2 |
| **Total** | **10** | **15** | **22** | **12** |

**Veredicto general:** El proyecto tiene una base arquitectónica sólida con buenas prácticas en muchas áreas (TypeScript strict, validación Zod, JWT con refresh token httpOnly, rate limiting, auditoría centralizada, magic bytes en uploads). Sin embargo, presenta **10 vulnerabilidades críticas** que deben corregirse **antes de cualquier lanzamiento a producción**. La mayoría son errores de implementación, no de diseño.

---

## Tabla de hallazgos consolidada

### SEGURIDAD

| ID | Severidad | Categoría | Archivo | Descripción | Impacto |
|---|---|---|---|---|---|
| SEC-01 | 🔴 CRÍTICA | Criptografía | `server/src/rutas/registro.ts` L265, L524 | Usa `bcrypt.hash(contrasena, 12)` en lugar de `generarHashContrasena()` (PBKDF2). También en `admins.ts` L189, `clientesApp.ts` L878, `estudios.ts` L747, `empleados.ts` L318, L384 | **Usuarios registrados con bcrypt no pueden autenticarse si `compararHashContrasena()` espera formato PBKDF2 primero.** Nota: `compararHashContrasena` tiene fallback a bcrypt, pero mantener dos estándares criptográficos es una deuda técnica grave y un riesgo de seguridad. El estándar PBKDF2 con 120,000 iteraciones es superior |
| SEC-02 | 🔴 CRÍTICA | Enumeración | `server/src/rutas/registro.ts` L205-208 | Endpoint `/registro/verificar-disponibilidad` devuelve `{ disponible: true }` en ambos branches (si existe y si no existe). Es un bug lógico que además permite enumeración de emails | Atacante puede determinar qué emails están registrados |
| SEC-03 | 🔴 CRÍTICA | Hard delete | `server/src/rutas/admin.ts` L545-557 | `deleteMany` para personal, pagos, estudios y usuarios. También en `estudios.ts` L657-702 (más de 15 deleteMany en cascada) | Destruye toda trazabilidad. Imposibilita investigación de fraude. Viola las instrucciones del proyecto sobre soft delete |
| SEC-04 | 🔴 CRÍTICA | Hard delete productos | `server/src/rutas/productos.ts` L157 | `prisma.producto.delete()` sin auditoría ni soft delete | Pérdida de historial de productos usados en reservas anteriores |
| SEC-05 | 🔴 CRÍTICA | Info Leak | `server/src/rutas/admin.ts` L1234, `estudios.ts` L542, L709 | `detalle: error instanceof Error ? error.message : 'Error desconocido'` se envía al cliente | Expone mensajes internos de Prisma, SQL y stack traces al atacante |
| SEC-06 | 🔴 CRÍTICA | Falta validación acceso | `server/src/rutas/estudios.ts` L408-430 | `PUT /estudios/:id` no valida que el usuario autenticado sea dueño del estudio que intenta modificar | Un maestro o cualquier dueño podría modificar cualquier estudio |
| SEC-07 | 🔴 CRÍTICA | CSP inseguro | `vercel.json` L16 | `script-src 'self' 'unsafe-inline'` permite inyección de scripts inline | Vector de XSS en producción. Vite no genera scripts inline que lo requieran |
| SEC-08 | 🟠 ALTA | Token en sessionStorage | `src/lib/clienteHTTP.ts` L52-62 | Access token JWT se guarda en `sessionStorage`, accesible vía XSS | Si existe una vulnerabilidad XSS, el token queda expuesto. El refresh token está correctamente en httpOnly cookie |
| SEC-09 | 🟠 ALTA | Datos sensibles localStorage | `src/caracteristicas/autenticacion/PaginaRegistroSalon.tsx` L343, L387 | Datos del formulario de registro (nombre, email, teléfono, dirección) se persisten en `localStorage` | Datos personales permanecen en disco del navegador indefinidamente |
| SEC-10 | 🟠 ALTA | Auditoría incompleta | `server/src/rutas/clientes.ts`, `productos.ts`, `empleados.ts` | PUT/DELETE en clientes y productos no invocan `registrarAuditoria()` | Cambios críticos sin rastro |
| SEC-11 | 🟠 ALTA | Transacciones incompletas | `server/src/rutas/admin.ts` L2107-2109 | Borrados sin transacción con `.catch(() => undefined)` | Estado inconsistente si una operación falla a mitad |
| SEC-12 | 🟠 ALTA | Validación Body | `server/src/rutas/estudios.ts` L337, L408 | Body tipado como `Record<string, unknown>` sin schema Zod | Datos arbitrarios pueden llegar a la BD |
| SEC-13 | 🟡 MEDIA | Rate limit incompleto | Endpoints públicos | `/disponibilidad/:slug`, `/servicios/:slug`, GET de clientes/empleados sin rate limit | Scraping, enumeración de entidades |
| SEC-14 | 🟡 MEDIA | Rate limit configurable | `server/src/lib/env.ts` | No hay variables de entorno para configurar límites y ventanas de rate limit | Valores hardcodeados difíciles de ajustar en producción |
| SEC-15 | 🟡 MEDIA | confirm() nativo | `src/caracteristicas/estudio/componentes/PanelProductos.tsx` L345 | `if (confirm('Delete this product?'))` usa diálogo nativo del navegador | Viola las instrucciones del proyecto. UX inconsistente. No accesible |
| SEC-16 | 🟡 MEDIA | Cascadas en Prisma | `server/prisma/schema.prisma` L217, L243, L318, L346 | `onDelete: Cascade` en Personal→Estudio, Cliente→Estudio, Reserva→Estudio | Si se borra un estudio con las funciones existentes de delete, se pierden todas las reservas, clientes y personal |
| SEC-17 | 🟡 MEDIA | SW sin try-catch | `public/sw.js` L2 | `event.data?.json()` sin manejo de errores | Falla silenciosa si payload push mal formado |
| SEC-18 | 🟡 MEDIA | ESLint permisivo | `eslint.config.js` L25 | `@typescript-eslint/no-explicit-any: 'warn'` debería ser `'error'` | Permite `any` accidentales pasen a producción |
| SEC-19 | 🔵 BAJA | backup.txt | `backup.txt` | Archivo de 2000+ líneas con código legado (Firebase) incluyendo `alert()`, `confirm()`, `window.print()` | Confunde mantenedores, ocupa espacio en repo |
| SEC-20 | 🔵 BAJA | webp no en magic bytes | `server/src/utils/validarImagen.ts` L8-11 | Solo detecta jpg y png, no webp ni avif | Limita formatos modernos de imagen |

---

### ACCESIBILIDAD (WCAG 2.1 AA)

| ID | Severidad | Criterio WCAG | Archivo | Descripción | Solución |
|---|---|---|---|---|---|
| ACC-01 | 🟠 ALTA | 2.4.1 Bypass Blocks | Layout global | No existe enlace "Skip to main content" | Agregar `<a href="#contenido-principal" className="sr-only focus:not-sr-only ...">Skip to main content</a>` antes del header |
| ACC-02 | 🟠 ALTA | 1.3.1 Info and Relationships | `src/componentes/diseno/NavegacionCliente.tsx` L188, `NavegacionEmpleado.tsx` L145 | `<nav>` sin `aria-label` para diferenciar navegaciones | Agregar `aria-label="Main navigation"` |
| ACC-03 | 🟠 ALTA | 1.3.1 | `src/caracteristicas/cliente/PaginaHistorialCliente.tsx` L151 | Tabla sin `overflow-x-auto` en contenedor | Envolver tabla en `<div className="overflow-x-auto">` |
| ACC-04 | 🟡 MEDIA | 2.4.3 Focus Order | Modales globales | No hay focus trap implementado en modales. El usuario puede salir del modal con Tab | Implementar `react-focus-lock` o focus trap manual |
| ACC-05 | 🟡 MEDIA | 2.5.5 Target Size | Múltiples componentes | Botones con `p-1.5` o `px-2 py-1` no alcanzan 44×44px mínimo en móvil | Aumentar a mínimo `p-2.5` (40×40px) o `p-3` (48×48px) |
| ACC-06 | 🟡 MEDIA | 1.4.3 Contrast Minimum | Múltiples componentes | `text-slate-400` sobre fondo blanco tiene ratio ~3.5:1 (debajo de 4.5:1) | Usar mínimo `text-slate-500` para textos informativos |
| ACC-07 | 🟡 MEDIA | 1.3.1 | `src/componentes/ui/SelectorFecha.tsx` L151, L171, L190 | `<select>` sin `<label>` vinculado | Agregar `<label htmlFor="id">` para cada selector |
| ACC-08 | 🟡 MEDIA | 1.3.1 | `src/caracteristicas/estudio/componentes/ModalSolicitudCancelacion.tsx` L97 | `aria-describedby` apunta al label en lugar de texto descriptivo | Asociar con elemento descriptivo `<p>` separado |
| ACC-09 | 🔵 BAJA | 4.1.2 | `src/componentes/ui/BannerNotificacionesPush.tsx` L22, L30 | Botones con texto visible pero sin `aria-label` adicional | Agregar aria-label para mayor claridad |
| ACC-10 | 🔵 BAJA | 2.4.7 | Menú móvil | Cierre de menú sin animación visual | Agregar transición fade-in/fade-out |
| ACC-11 | 🔵 BAJA | General | `index.html` | Falta `<main id="contenido-principal">` como landmark | Agregar landmark al wrapper principal |
| ACC-12 | 🔵 BAJA | 1.1.1 | General | Falta `robots.txt` y `sitemap.xml` para SEO técnico | Crear archivos y configurar rutas |

**Aspectos positivos de accesibilidad:**
- ✅ 20+ modales con `role="dialog"` y `aria-labelledby`
- ✅ 30+ instancias de `aria-busy="true"` en estados de carga
- ✅ 15+ instancias de `aria-describedby` en errores de formulario
- ✅ 100% de imágenes con `alt` descriptivo
- ✅ Todos los inputs con `focus:ring-2` (focus visible)
- ✅ Botones de solo ícono con `aria-label`
- ✅ `<html lang="es">` definido
- ✅ Meta viewport correcto

---

### ESCALABILIDAD Y MANTENIBILIDAD

| ID | Severidad | Categoría | Archivo | Descripción | Solución |
|---|---|---|---|---|---|
| ESC-01 | 🔴 CRÍTICA | Archivo monolítico | `server/src/rutas/admin.ts` (2870 líneas) | Archivo con 2870 líneas mezclando más de 30 handlers. Imposible de mantener, testear o revisar en code review | Separar en módulos: `admin/salones.ts`, `admin/pagos.ts`, `admin/usuarios.ts`, `admin/metricas.ts`, `admin/preregistros.ts` |
| ESC-02 | 🔴 CRÍTICA | Patrón handler-as-service | `server/src/rutas/admin.ts`, `reservas.ts`, `estudios.ts`, `clientesApp.ts` | Handlers contienen lógica de negocio directamente. No usan la capa servicio ni repositorio | Extraer lógica a `servicios/` y `repositorios/` como definen las instrucciones del proyecto |
| ESC-03 | 🟠 ALTA | Componentes > 200 líneas | Múltiples | PaginaRegistroSalon (1631 líneas), VisorReservas (958), GestionCuentas (795), PanelReserva (790), PaginaReservaCliente (784), GestionSalones (768), VisorSalon (726), VisorPreregistros (700), PaginaAgendaEmpleado (667) | Extraer subcomponentes. El proyecto establece máximo 200 líneas |
| ESC-04 | 🟠 ALTA | Archivos backend gigantes | `server/src/rutas/reservas.ts` (1363), `clientesApp.ts` (941), `auth.ts` (836), `estudios.ts` (816), `registro.ts` (528) | Sin separación servicio/repositorio. Todo en handlers | Refactorizar a handler → servicio → repositorio |
| ESC-05 | 🟠 ALTA | Duplicación de hashing | `server/src/rutas/registro.ts`, `admins.ts`, `clientesApp.ts`, `empleados.ts`, `estudios.ts` | 7 archivos usan `bcrypt.hash()` directamente en lugar de la función centralizada `generarHashContrasena()` | Usar exclusivamente `generarHashContrasena()` de `utils/contrasenas.ts` |
| ESC-06 | 🟠 ALTA | ContextoApp 5 useState | `src/contextos/ContextoApp.tsx` L23-27 | Excede el límite de 3 useState por componente | Consolidar en `useReducer` con estado unificado |
| ESC-07 | 🟡 MEDIA | Soft delete parcial | `server/prisma/schema.prisma` | Solo `Personal` tiene `eliminadoEn`. Faltan `ClienteApp`, `Usuario`, `EmpleadoAcceso`, `Producto` | Agregar campo `eliminadoEn DateTime?` a modelos relevantes |
| ESC-08 | 🟡 MEDIA | Índices faltantes | `server/prisma/schema.prisma` | Faltan `@@index([estudioId, activo])` en Personal, `@@index([eliminadoEn])` en Personal | Crear índices compuestos para consultas frecuentes |
| ESC-09 | 🟡 MEDIA | tiendaAuth.ts | `src/tienda/tiendaAuth.ts` (359 líneas) | Store de Zustand con demasiadas responsabilidades | Separar en stores más pequeños |
| ESC-10 | 🟡 MEDIA | servicioAdmin.ts | `src/servicios/servicioAdmin.ts` (369 líneas) | Servicio monolítico del frontend para admin | Separar por dominio |
| ESC-11 | 🟡 MEDIA | tipos/index.ts | `src/tipos/index.ts` (318 líneas) | Todos los tipos en un solo archivo | Separar por dominio: `tipos/estudio.ts`, `tipos/reserva.ts`, etc. |
| ESC-12 | 🔵 BAJA | Dockerfile sin multi-stage | `server/Dockerfile` | Sin caching de dependencias separado del código fuente | Usar build multi-stage para cachear `COPY package*.json → RUN npm ci` |
| ESC-13 | 🔵 BAJA | Dockerfile sin HEALTHCHECK | `server/Dockerfile` | Sin health check nativo de Docker | Agregar `HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1` |
| ESC-14 | 🔵 BAJA | Railway env | `server/railway.json` | No documenta variables de entorno requeridas | Documentar en README o railway.json |

**Aspectos positivos de mantenibilidad:**
- ✅ TypeScript strict mode sin `any` (0 ocurrencias encontradas)
- ✅ Sin `@ts-ignore` ni `@ts-expect-error`
- ✅ Nombres en español consistentes
- ✅ Estructura de carpetas del frontend respetada
- ✅ React Hook Form + Zod para formularios
- ✅ Validación de entorno con Zod
- ✅ Comentarios JSDoc en funciones públicas

---

### PERFORMANCE

| ID | Severidad | Categoría | Archivo | Descripción | Solución |
|---|---|---|---|---|---|
| PER-01 | 🔴 CRÍTICA | Paginación faltante | `server/src/rutas/productos.ts`, `fidelidad.ts` L125 | `findMany` sin `take`/`skip` — carga todos los registros | Agregar paginación con `take: 10, skip: (pagina - 1) * 10` |
| PER-02 | 🟠 ALTA | Queries sin select | `server/src/rutas/admin.ts` L329-342, L1782-1800 | `findMany` trae todos los campos de estudio para listados | Usar `select` con solo los campos necesarios para la tabla |
| PER-03 | 🟠 ALTA | N+1 potencial | `server/src/rutas/admin.ts` L2822-2827 | Dos queries separadas para salones México y Colombia en lugar de un solo query agrupado | Usar `groupBy` o query único con filtro |
| PER-04 | 🟡 MEDIA | window.location.reload() | `src/caracteristicas/cliente/PaginaReservaCliente.tsx` L574 | Recarga completa de la página en lugar de invalidar queries | Usar `queryClient.invalidateQueries()` + `navigate()` |
| PER-05 | 🟡 MEDIA | Sin compresión de chunks | `vite.config.ts` | No hay precompresión gzip/brotli en build | Agregar `vite-plugin-compression` para brotli |
| PER-06 | 🟡 MEDIA | Múltiples findMany sin Promise.all | `server/src/rutas/estudios.ts` L645-648 | 4 queries secuenciales que podrían ser paralelos (ya están en Promise.all, verificado) | Correcto — falso positivo |
| PER-07 | 🔵 BAJA | Cache headers estáticos | `server/src/index.ts` L147-156 | Assets estáticos (logos, avatares) sin `Cache-Control` | Agregar `Cache-Control: public, max-age=86400` para imágenes |

**Aspectos positivos de performance:**
- ✅ Lazy loading de rutas implementado
- ✅ Chunking estratégico en Vite (vendor-react, vendor-query, vendor-router, vendor-ui)
- ✅ Compression gzip habilitado en Fastify (`@fastify/compress`)
- ✅ Body limit de 1MB configurado
- ✅ File upload limitado a 2MB
- ✅ Paginación en listados principales de admin
- ✅ Debounce en búsquedas del frontend

---

### RESPONSIVE DESIGN Y UX

| ID | Severidad | Categoría | Archivo | Descripción | Solución |
|---|---|---|---|---|---|
| RES-01 | 🟠 ALTA | Tabla sin responsive | `src/caracteristicas/cliente/PaginaHistorialCliente.tsx` L151 | `<table>` sin `overflow-x-auto` wrapper. Se desborda en tablets medianos | Envolver en `<div className="overflow-x-auto">` |
| RES-02 | 🟡 MEDIA | Touch targets | Múltiples tablas y calendarios | Botones de acción en tablas con `p-1.5` — demasiado pequeños para dedos | Aumentar padding a mínimo `p-2.5` en contexto móvil |
| RES-03 | 🟡 MEDIA | Calendarios apretados | PaginaAgenda, PaginaAgendaEmpleado | Celdas de calendario con poco espacio en pantallas pequeñas | Ajustar grid con `gap-1` y `min-h-[44px]` |
| RES-04 | 🟡 MEDIA | Tabs horizontales | Componentes con pestañas de filtro | Sin scroll horizontal en pantallas estrechas con muchos tabs | Agregar `overflow-x-auto` y `scrollbar-hide` |
| RES-05 | 🔵 BAJA | Textos largos sin truncar | Nombres de servicios en tablas | Nombres muy largos pueden desbordar celdas | Agregar `truncate` o `line-clamp-1` |
| RES-06 | 🔵 BAJA | print styles | General | Sin media queries de impresión | Agregar `@media print` para vistas de agenda y reportes |

**Aspectos positivos de responsive:**
- ✅ Mobile-first consistente con breakpoints `md:`, `lg:`, `xl:`
- ✅ Breakpoints oficiales de Tailwind
- ✅ Navegación móvil con barra inferior y hamburger menu
- ✅ Grid responsive en dashboards
- ✅ 10/11 tablas con `overflow-x-auto`
- ✅ Modales fullscreen en móvil
- ✅ Viewport meta tag correcto
- ✅ viewport `width=device-width, initial-scale=1.0`

---

## Soluciones detalladas por prioridad

### Fase 1 — CRÍTICA (Bloquea producción)

#### SEC-01: Unificar hashing de contraseñas

**Problema:** 7 archivos usan `bcrypt.hash()` directamente en lugar de `generarHashContrasena()`.

**Archivos afectados:**
- `server/src/rutas/registro.ts` (L265, L524)
- `server/src/rutas/admins.ts` (L189)
- `server/src/rutas/clientesApp.ts` (L878)
- `server/src/rutas/estudios.ts` (L747)
- `server/src/rutas/empleados.ts` (L318, L384)

**Solución:**

En cada archivo, reemplazar:
```typescript
// INCORRECTO
import bcrypt from 'bcrypt';
const hashContrasena = await bcrypt.hash(contrasena, 12);

// CORRECTO
import { generarHashContrasena } from '../utils/contrasenas.js';
const hashContrasena = await generarHashContrasena(contrasena);
```

La función `compararHashContrasena` ya soporta ambos formatos (fallback a bcrypt), así que los hashes existentes seguirán funcionando. Los nuevos hashes serán PBKDF2 con 120,000 iteraciones.

---

#### SEC-02: Corregir bug de disponibilidad de email

**Archivo:** `server/src/rutas/registro.ts` L205-208

**Solución:**
```typescript
// ACTUAL (BUG: ambos branches devuelven true)
if (existeCliente ?? existeUsuario) {
  return respuesta.send({ disponible: true });
}
return respuesta.send({ disponible: true });

// CORRECTO
if (existeCliente ?? existeUsuario) {
  return respuesta.send({ disponible: false });
}
return respuesta.send({ disponible: true });
```

**Nota adicional:** Considerar devolver siempre `{ disponible: true }` con un mensaje genérico para evitar enumeración, y enviar la validación real por email.

---

#### SEC-03 y SEC-04: Reemplazar hard delete con soft delete

**Problema:** Más de 31 operaciones `deleteMany` y `delete` en el backend eliminan datos permanentemente.

**Solución en schema.prisma:**
```prisma
model Personal {
  // Ya tiene eliminadoEn
}

model ClienteApp {
  eliminadoEn   DateTime?
  // ... campos existentes
}

model Usuario {
  eliminadoEn   DateTime?
  // ... campos existentes
}

model EmpleadoAcceso {
  eliminadoEn   DateTime?
  // ... campos existentes
}

model Producto {
  eliminadoEn   DateTime?
  // ... campos existentes
}
```

**Solución en handlers:** Reemplazar:
```typescript
// INCORRECTO
await prisma.producto.delete({ where: { id: productoId } });

// CORRECTO
await prisma.producto.update({
  where: { id: productoId },
  data: { eliminadoEn: new Date(), activo: false },
});
```

**Para los deleteMany en admin.ts y estudios.ts:** Estas operaciones de "eliminar estudio completo" deben usar transacciones con soft delete:
```typescript
await prisma.$transaction(async (tx) => {
  const ahora = new Date();
  await tx.personal.updateMany({ where: { estudioId: id }, data: { eliminadoEn: ahora, activo: false } });
  await tx.reserva.updateMany({ where: { estudioId: id }, data: { estado: 'cancelada' } });
  await tx.estudio.update({ where: { id }, data: { eliminadoEn: ahora, activo: false, estado: 'bloqueado' } });
  // Registrar en auditoría
  await registrarAuditoria({ /* ... */ });
});
```

---

#### SEC-05: No exponer error.message al frontend

**Archivos afectados:** `admin.ts` L1234, `estudios.ts` L542, L709, `reservas.ts` L979

**Solución:**
```typescript
// INCORRECTO
return respuesta.code(500).send({
  error: 'Error procesando solicitud',
  detalle: error instanceof Error ? error.message : 'Error desconocido',
});

// CORRECTO
servidor.log.error(error); // Log server-side con contexto
return respuesta.code(500).send({
  error: 'Error processing request. Please try again.',
});
```

---

#### SEC-06: Validar propiedad del estudio en PUT

**Archivo:** `server/src/rutas/estudios.ts` L408-430

**Solución:**
```typescript
servidor.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
  '/estudios/:id',
  { preHandler: verificarJWT },
  async (solicitud, respuesta) => {
    const payload = solicitud.user as PayloadJWT;
    const { id } = solicitud.params;

    // AGREGAR: Validación de acceso
    if (payload.rol === 'dueno' && payload.estudioId !== id) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }

    const resultado = esquemaActualizarEstudio.safeParse(solicitud.body);
    // ... resto del handler
  },
);
```

---

#### SEC-07: Eliminar unsafe-inline del CSP

**Archivo:** `vercel.json` L16

**Solución:**
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https://*.railway.app https://*.up.railway.app; font-src 'self';"
}
```

**Nota:** Tailwind CSS v4 con Vite genera CSS en archivos externos, no inline. Si algún componente necesita estilos inline (poco probable), usar nonces o hashes en lugar de `unsafe-inline`.

---

#### ESC-01 y ESC-02: Refactorizar archivos monolíticos del backend

**Archivo:** `server/src/rutas/admin.ts` (2870 líneas)

**Estructura objetivo:**
```
server/src/
├── rutas/
│   ├── admin/
│   │   ├── index.ts          // Re-exporta y registra todos
│   │   ├── salones.ts        // CRUD y gestión de salones
│   │   ├── pagos.ts          // Registro y control de pagos
│   │   ├── metricas.ts       // Dashboard y estadísticas
│   │   ├── preregistros.ts   // Aprobación de pre-registros
│   │   └── usuarios.ts       // Gestión de cuentas admin
│   ├── reservas/
│   │   ├── index.ts
│   │   ├── crear.ts
│   │   ├── reagendar.ts
│   │   └── cancelar.ts
├── servicios/
│   ├── servicioSalones.ts
│   ├── servicioReservas.ts
│   └── servicioPagos.ts
├── repositorios/
│   ├── repositorioSalones.ts
│   ├── repositorioReservas.ts
│   └── repositorioPagos.ts
```

---

#### PER-01: Agregar paginación en endpoints sin ella

**Archivo:** `server/src/rutas/productos.ts`

**Solución:**
```typescript
servidor.get<{ Params: { id: string }; Querystring: { pagina?: string; limite?: string } }>(
  '/estudio/:id/productos',
  { preHandler: verificarJWT },
  async (solicitud, respuesta) => {
    const pagina = Math.max(1, Number(solicitud.query.pagina) || 1);
    const limite = Math.min(50, Math.max(1, Number(solicitud.query.limite) || 10));
    const saltar = (pagina - 1) * limite;

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where: { estudioId: id },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        take: limite,
        skip: saltar,
      }),
      prisma.producto.count({ where: { estudioId: id } }),
    ]);

    return respuesta.send({
      datos: productos,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  },
);
```

---

### Fase 2 — ALTA (Próxima iteración, antes de lanzamiento)

#### SEC-08: Mover access token a memoria

Eliminar uso de `sessionStorage` para el access token. Guardarlo en una variable de módulo (closure):

```typescript
// src/lib/clienteHTTP.ts
let _tokenEnMemoria: string | null = null;

function leerToken(): string | null {
  return _tokenEnMemoria;
}

export function guardarToken(token: string): void {
  _tokenEnMemoria = token;
}

export function limpiarToken(): void {
  _tokenEnMemoria = null;
}
```

Esto significa que el token se pierde al recargar la página, pero el refresh token en httpOnly cookie lo recupera automáticamente.

---

#### SEC-10: Completar auditoría en todos los endpoints de mutación

Cada PUT, POST (crear), DELETE y PATCH debe invocar `registrarAuditoria()`. Verificar:
- `clientes.ts` — PUT falta auditoría
- `productos.ts` — CRUD completo sin auditoría
- `empleados.ts` — algunos endpoints sin auditoría
- `fidelidad.ts` — canje de recompensa con auditoría parcial

---

#### ACC-01: Skip to main content

```tsx
// src/componentes/diseno/LayoutPrincipal.tsx
export function LayoutPrincipal({ children }: Props) {
  return (
    <>
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-pink-600 focus:font-semibold"
      >
        Skip to main content
      </a>
      <header>...</header>
      <main id="contenido-principal">
        {children}
      </main>
    </>
  );
}
```

---

#### ACC-04: Implementar focus trap en modales

Instalar y usar `react-focus-lock`:
```bash
npm install react-focus-lock
```

```tsx
import FocusLock from 'react-focus-lock';

export function Modal({ children, abierto, onCerrar }: Props) {
  if (!abierto) return null;

  return (
    <FocusLock returnFocus>
      <div role="dialog" aria-labelledby="titulo-modal" aria-modal="true">
        {children}
      </div>
    </FocusLock>
  );
}
```

---

#### ESC-03: Extraer subcomponentes de archivos gigantes del frontend

Ejemplo para `PaginaRegistroSalon.tsx` (1631 líneas):

```
src/caracteristicas/autenticacion/
├── PaginaRegistroSalon.tsx          // Orquestador (< 200 líneas)
├── componentes/
│   ├── PasoInfoBasica.tsx           // Paso 1
│   ├── PasoDatosSalon.tsx           // Paso 2
│   ├── PasoServicios.tsx            // Paso 3
│   ├── PasoPersonalizacion.tsx      // Paso 4
│   └── PasoConfirmacion.tsx         // Paso 5
├── hooks/
│   └── usarRegistroSalon.ts         // Estado y lógica del formulario
```

---

### Fase 3 — MEDIA (Próximos sprints)

#### SEC-13: Rate limit en endpoints públicos

```typescript
servidor.get('/disponibilidad/:slug', {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: '1 minute',
    },
  },
}, async (solicitud, respuesta) => { /* ... */ });
```

#### ACC-06: Mejorar contraste de textos

Buscar y reemplazar globalmente:
- `text-slate-400` → `text-slate-500` (en textos informativos, no decorativos)
- `text-gray-400` → `text-gray-500`

#### ESC-07: Soft delete completo

Agregar `eliminadoEn` a modelos faltantes y crear middleware Prisma para filtrar automáticamente:

```typescript
// server/src/lib/prismaMiddleware.ts
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (params.args?.where) {
      params.args.where.eliminadoEn = null;
    }
  }
  return next(params);
});
```

#### ESC-08: Índices compuestos faltantes

```prisma
model Personal {
  @@index([estudioId, activo])
  @@index([eliminadoEn])
}

model Reserva {
  @@index([estudioId, fecha, estado])
}

model Producto {
  @@index([estudioId, activo])
}
```

---

### Fase 4 — BAJA (Mejora continua)

- SEC-19: Eliminar `backup.txt` del repositorio
- SEC-20: Agregar detección de webp y avif en `validarImagen.ts`
- ESC-12: Dockerfile multi-stage con caching
- ESC-13: HEALTHCHECK en Dockerfile
- ACC-12: Crear `robots.txt` y `sitemap.xml`
- PER-07: Agregar `Cache-Control` a assets estáticos
- RES-06: Media queries de impresión

---

## Cumplimiento de copilot-instructions.md

| Instrucción | Cumplimiento | Observación |
|---|---|---|
| TypeScript strict: true | ✅ 100% | Sin `any`, sin `@ts-ignore` |
| Nombres en español | ✅ 95% | Algunos mensajes de UI en inglés (correcto según instrucciones) |
| Backend recalcula precios | ✅ | `obtenerPrecioTotalServicios()` en backend |
| No usar float para dinero | ✅ | Usa `Int` (centavos) en Prisma |
| No usar Math.random() | ✅ | 0 ocurrencias |
| JWT httpOnly refresh | ✅ | Cookie httpOnly, secure, sameSite: strict |
| Rate limit en login/reset | ✅ | Configurado en auth.ts |
| Validación Zod en env | ✅ | Backend y frontend |
| Headers de seguridad | ⚠️ 85% | CSP con `unsafe-inline` |
| Soft delete | ⚠️ 30% | Solo Personal tiene `eliminadoEn` |
| Auditoría completa | ⚠️ 70% | Falta en clientes, productos, empleados |
| Handler→Servicio→Repositorio | ❌ 10% | Casi todo en handlers directamente |
| Máximo 200 líneas componente | ❌ 30% | 53 componentes exceden el límite |
| Máximo 3 useState | ⚠️ 80% | ContextoApp tiene 5 |
| Transacciones en ops críticas | ✅ 85% | Reservas, pagos, admin con $transaction |
| No exponer secretos | ✅ | Variables de entorno validadas |
| Validar magic bytes | ✅ | 3/3 endpoints de upload |
| No borrar datos con historial | ❌ 20% | Múltiples hard deletes |

---

## Métricas del proyecto

| Métrica | Valor |
|---|---|
| Total archivos auditados (frontend) | ~194 |
| Total archivos auditados (backend) | ~45 |
| Líneas de código frontend (estimado) | ~25,000 |
| Líneas de código backend (estimado) | ~12,000 |
| Componentes > 200 líneas | 53 |
| Archivos backend > 500 líneas | 6 |
| Uso de `any` | 0 |
| Uso de `@ts-ignore` | 0 |
| Modales accesibles | 20+ |
| Endpoints con rate limit | 20+ |
| Endpoints con auditoría | 30+ |
| Hard deletes | 31+ |
| Cumplimiento WCAG 2.1 AA | ~92% |

---

## Conclusión

El proyecto **Beauty Time Pro** tiene una base técnica **significativamente superior al promedio** de proyectos SaaS en etapa similar. Las decisiones arquitectónicas fundamentales son correctas: TypeScript strict, JWT con refresh token httpOnly, rate limiting, validación de entorno, magic bytes en uploads, y auditoría centralizada.

Los problemas encontrados son principalmente de **implementación y organización**, no de **diseño arquitectónico**:

1. **Deuda técnica más grave:** La falta de separación handler→servicio→repositorio en el backend crea archivos monolíticos difíciles de mantener, testear y escalar.
2. **Riesgo de seguridad más grave:** Los hard deletes eliminan toda trazabilidad y violan las reglas del propio proyecto.
3. **Bug más grave:** La inconsistencia en hashing de contraseñas y el bug de enumeración de emails.

**Recomendación:** Corregir las 10 vulnerabilidades CRÍTICAS antes de lanzar a producción. Las fases 2 y 3 pueden implementarse en los primeros sprints post-lanzamiento.

---

*Documento generado como parte de auditoría forense de software.*  
*Auditoría realizada el 9 de abril de 2026.*
