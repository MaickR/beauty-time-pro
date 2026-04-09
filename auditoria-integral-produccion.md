# Auditoría Integral de Producción

## Beauty Time Pro

Fecha: 2026-04-08

## 1. Objetivo

Este documento consolida una auditoría integral orientada a salida a producción comercial, auditoría externa y operación concurrente a gran escala para Beauty Time Pro.

El análisis considera:

1. revisión directa del código fuente frontend y backend
2. hallazgos previos de seguridad, accesibilidad, rendimiento y concurrencia
3. el plan de remediación ya definido en `docs/plan-maestro-remediacion-produccion.md`
4. las reglas internas del proyecto en `.github/copilot-instructions.md`

El enfoque de esta auditoría no es académico. Está orientado a riesgos reales: abuso malicioso, robo o exposición de datos, clonación superficial del producto, degradación por alta concurrencia, deuda técnica que impida escalar, y señales que delaten un producto construido sin suficiente disciplina de ingeniería.

## 2. Dictamen ejecutivo

### Estado general

Beauty Time Pro todavía no está en condición de salida a producción comercial exigente.

La base tecnológica elegida es sólida y aprovechable, pero el producto aún presenta brechas que una auditoría externa profesional probablemente señalaría en cinco frentes:

1. seguridad de autenticación y sesión
2. trazabilidad operativa incompleta
3. escalabilidad funcional y de datos todavía frágil para crecimiento masivo
4. frontend con deuda estructural en UX, accesibilidad y consistencia
5. cobertura de pruebas insuficiente para un SaaS transaccional

### Recomendación de liberación

Veredicto: `NO GO`

No se recomienda liberar esta aplicación a producción comercial masiva hasta cerrar todos los hallazgos críticos y altos descritos en este informe.

## 3. Puntuación profesional por dimensión

| Dimensión | Puntuación actual | Veredicto resumido |
|---|---:|---|
| Seguridad | 5.2/10 | Base aceptable, pero con huecos serios en refresh, CSRF, revocación y auditoría |
| Performance | 6.1/10 | Hay señales sanas, pero faltan pruebas, métricas y eliminación de cargas en memoria |
| Accesibilidad | 6.4/10 | Existen aciertos, pero no alcanza todavía un estándar de excelencia consistente |
| Escalabilidad | 5.8/10 | El diseño funciona hoy, pero ciertas decisiones no escalan bien a miles de usuarios |
| Usabilidad | 6.6/10 | Hay valor funcional, pero falta pulido, consistencia y reducción de fricción |
| Mantenibilidad | 5.7/10 | La base es legible en partes, pero persisten señales claras de deuda estructural |
| Preparación para auditoría externa | 4.9/10 | Hoy habría observaciones importantes y bloqueos de salida |

## 4. Hallazgos positivos confirmados

La auditoría también confirma fortalezas reales. Esto es importante porque demuestra que el proyecto no necesita rehacerse desde cero.

### 4.1 Backend y seguridad base

1. el servidor valida variables de entorno con Zod al arranque en `server/src/lib/env.ts`
2. el frontend también valida variables de entorno con Zod en `src/lib/env.ts`
3. el backend usa Fastify con `helmet`, `cookie`, `jwt`, `rate-limit`, `compress` y límites de multipart
4. la app usa dinero en enteros, no `float`, en `server/prisma/schema.prisma`
5. existe validación por magic bytes para imágenes en `server/src/utils/validarImagen.ts`
6. existen índices Prisma en varios modelos sensibles, por ejemplo reservas, estudios, suscripciones push y audit log

### 4.2 Frontend y rendimiento base

1. el ruteo usa `lazy()` de React en `src/app/enrutador.tsx`
2. el build de Vite ya separa chunks manuales en `vite.config.ts`
3. el cliente HTTP deduplica refresh concurrente en `src/lib/clienteHTTP.ts`
4. existe un límite de error visual (`LimiteError`) usado en el enrutador

### 4.3 Accesibilidad parcial existente

1. varios botones de ícono tienen `aria-label`
2. hay `aria-describedby` en formularios relevantes
3. existen modales con `role="dialog"`
4. hay indicadores de carga con `aria-busy` en varios puntos

Estas fortalezas reducen el esfuerzo de remediación, pero no compensan los bloqueadores de producción.

## 5. Checklist ejecutivo de salida a producción

### 5.1 Bloqueantes críticos

- [ ] Implementar refresh token rotativo real con invalidación del token previo
- [ ] Invalidar todas las sesiones activas ante cambio de contraseña, bloqueo, suspensión y desactivación
- [ ] Implementar protección CSRF donde aplique
- [ ] Completar auditoría obligatoria en todas las acciones críticas
- [ ] Añadir `Permissions-Policy`
- [ ] Añadir correlación de request con `X-Request-ID` o equivalente
- [ ] Eliminar estados críticos modelados como `String` libre donde deben ser enum de dominio
- [ ] Cerrar borrados físicos incompatibles con trazabilidad o historial
- [ ] Migrar formularios críticos a `React Hook Form + Zod`
- [ ] Cubrir autenticación, reservas, dinero y permisos con pruebas automatizadas

### 5.2 Requisitos altos antes de vender a escala

- [ ] Reducir carga en memoria de endpoints administrativos pesados
- [ ] Añadir métricas, observabilidad y alertas
- [ ] Normalizar contratos de dominio y naming interno
- [ ] Dividir componentes grandes y reducir estado local excesivo
- [ ] Eliminar estilos inline evitables y consolidar sistema visual reusable
- [ ] Completar `robots.txt`, `sitemap.xml`, metadatos públicos y estrategia SEO
- [ ] Revisar accesibilidad integral para flujos públicos y privados
- [ ] Ejecutar pruebas de carga con evidencia medible

## 6. Auditoría de seguridad

## 6.1 Hallazgos críticos

### 6.1.1 Refresh token sin rotación robusta

Evidencia:

- `server/src/rutas/auth.ts`, bloque `/auth/refrescar`, líneas alrededor de 629-750
- `server/src/rutas/auth.ts`, función `emitirTokens`, líneas alrededor de 914-921

Problema:

El endpoint refresca y reemite tokens, pero no existe una persistencia de sesión ni una invalidación verificable del refresh token anterior. Eso significa que el control actual depende de expiración temporal, no de revocación real.

Riesgo:

1. reutilización de tokens comprometidos
2. sesiones no controladas después de eventos sensibles
3. hallazgo grave en una revisión seria de autenticación

Recomendación:

1. introducir tabla de sesiones o `tokenVersion`
2. guardar huella, fecha de emisión, revocación y metadatos del dispositivo
3. invalidar el refresh anterior cada vez que se emita uno nuevo

### 6.1.2 Cambio de contraseña sin revocación de sesiones

Evidencia:

- `server/src/rutas/auth.ts`, líneas alrededor de 615-617

Problema:

El flujo de reset actual actualiza el hash y marca el token de reset como usado, pero no revoca sesiones activas ni versiones previas de JWT.

Riesgo:

Un atacante con token previo podría seguir operando incluso después de un cambio de contraseña.

### 6.1.3 Protección CSRF no visible ni centralizada

Evidencia:

- no se encontró implementación explícita de CSRF en backend
- existen endpoints mutables autenticados por cookie de refresh y `credentials: 'include'`

Problema:

Aunque hay verificación de origen en `/auth/refrescar` y `/auth/cerrar-sesion`, eso no equivale a una estrategia CSRF completa de aplicación.

Riesgo:

1. acciones autenticadas disparadas desde origen malicioso
2. cobertura desigual entre endpoints

### 6.1.4 Auditoría incompleta para acciones críticas

Evidencia:

- existe utilidad en `server/src/utils/auditoria.ts`
- la estructura actual registra `usuarioId`, `accion`, `entidadTipo`, `entidadId`, `detalles` e `ip`
- no registra de forma obligatoria `antes`, `despues`, correlación de request ni catálogos estrictos de evento

Problema:

La infraestructura base existe, pero no hay cobertura integral ni una forma fuerte de demostrar trazabilidad completa ante incidentes.

Riesgo:

1. auditoría parcial
2. dificultad para investigación forense
3. conflicto operativo o legal sin evidencia suficiente

### 6.1.5 Exposición de access token a XSS por almacenamiento en `sessionStorage`

Evidencia:

- `src/lib/clienteHTTP.ts`, constante `CLAVE_TOKEN` y funciones `leerToken`, `guardarToken`, `limpiarToken`

Problema:

El access token reside en `sessionStorage`. Eso es mejor que `localStorage` para persistencia larga, pero sigue siendo accesible desde JavaScript en caso de XSS.

Riesgo:

1. robo de sesión ante XSS almacenado o reflejado
2. menor robustez que una estrategia de access token en memoria

Recomendación:

Migrar a modelo de access token en memoria con refresh cookie httpOnly, o justificar explícitamente por qué se mantiene `sessionStorage` y qué controles compensatorios lo respaldan.

### 6.1.6 Falta `Permissions-Policy`

Evidencia:

- `server/src/index.ts`, configuración de `helmet`, líneas alrededor de 67-96

Problema:

Hay CSP y otros headers, pero no se observó política de permisos explícita.

### 6.1.7 Sin `X-Request-ID` o correlación equivalente

Evidencia:

- `server/src/index.ts` no añade correlación de request

Problema:

Sin correlación, los errores, acciones auditadas y eventos de negocio quedan mucho más difíciles de seguir en producción.

## 6.2 Hallazgos altos

### 6.2.1 Estados críticos modelados como texto libre

Evidencia:

- `server/prisma/schema.prisma`
- `Reserva.estado String @default("pending")`
- `ReservaServicio.estado String @default("pending")`
- `CorreoPendiente.estado String @default("pending")`
- `PreregistroSalon.estado String @default("pendiente")`

Problema:

La app mezcla enums y strings libres para estados importantes. Esto rompe la regla interna del proyecto y aumenta el riesgo de transiciones inválidas, errores silenciosos y complejidad innecesaria.

Impacto:

1. validación más débil
2. mayor costo de mantenimiento
3. mayor probabilidad de estados imposibles

### 6.2.2 Modelo con exceso de JSON para dominio central

Evidencia:

- `server/prisma/schema.prisma`
- `Estudio.sucursales Json`
- `Estudio.horario Json`
- `Estudio.servicios Json`
- `Estudio.serviciosCustom Json`
- `Estudio.festivos Json`
- `Reserva.servicios Json`

Problema:

El uso de JSON en dominio central acelera prototipado, pero complica:

1. integridad relacional
2. índices finos
3. auditoría por campo
4. actualizaciones concurrentes seguras
5. reporting avanzado

Esto es especialmente importante si se espera crecer a miles de usuarios y agregar nuevas capacidades más adelante.

### 6.2.3 Borrados físicos en zonas sensibles

Evidencia:

- `server/src/rutas/productos.ts`, línea alrededor de 157: `prisma.producto.delete`
- `server/src/rutas/admins.ts`, línea alrededor de 479: `prisma.usuario.delete`
- `server/src/rutas/empleados.ts`, línea alrededor de 461: `prisma.empleadoAcceso.delete`
- `server/src/rutas/admin.ts`, líneas alrededor de 2108-2109: `prisma.estudio.delete` y `prisma.usuario.delete`

Problema:

El proyecto ya tiene campos `activo` o equivalentes en varios modelos. Mantener borrado físico en otros puntos introduce inconsistencia y potencial pérdida de trazabilidad.

### 6.2.4 Publicación directa de uploads

Evidencia:

- `server/src/index.ts`, bloque de `fastifyStatic` sobre `/uploads/`

Problema:

Hoy la carpeta visible parece limitada a logos, pero la arquitectura ya está lista para exponer cualquier archivo subido bajo una ruta estática pública. Si mañana se agregan contratos, comprobantes u otros adjuntos, el riesgo crece de inmediato.

Recomendación:

Separar assets públicos de archivos privados y servir estos últimos mediante autorización y URLs controladas.

### 6.2.5 MFA no implementado para cuentas maestro

Problema:

La regla interna lo marca como mejora prioritaria. Para una consola con poder administrativo alto, MFA debería entrar en hoja de ruta cercana y no quedar como mejora difusa.

## 6.3 Hallazgos medios

### 6.3.1 Rate limiting presente, pero no claramente centralizado por superficie de riesgo

Se observan rate limits en `auth`, `registro`, `reservas`, `perfil` y `personal`, lo cual es positivo, pero el sistema todavía no demuestra una cobertura uniforme y documentada por tipo de amenaza.

Debe existir una matriz clara por endpoint:

1. login
2. refresh
3. reset
4. uploads
5. reservas públicas
6. endpoints administrativos
7. mensajería masiva

### 6.3.2 Protección contra clonación de la app

Hallazgo importante:

No existe defensa técnica absoluta contra que alguien copie la UI pública o replique flujos visibles del frontend. Eso no se resuelve con ofuscación ni con ocultar código del cliente.

La defensa real debe enfocarse en:

1. backend fuerte y no replicable sin acceso a negocio y datos
2. desactivar source maps públicos si no son estrictamente necesarios
3. licenciamiento, branding, monitoreo y pruebas de abuso
4. proteger secretos, contratos, procesos y operación, no solo la apariencia visual

## 7. Auditoría de performance y optimización

## 7.1 Hallazgos positivos

1. `vite.config.ts` ya usa separación manual de chunks
2. `src/app/enrutador.tsx` usa lazy loading en muchas rutas
3. `src/lib/clienteHTTP.ts` deduplica refresh concurrente
4. hay uso de `useMemo` en componentes costosos específicos

## 7.2 Hallazgos críticos y altos

### 7.2.1 Paginación en memoria en endpoints administrativos

Evidencia:

- `server/src/rutas/admin.ts`, línea alrededor de 745: `estudiosNormalizados.slice(...)`
- `server/src/rutas/admin.ts`, línea alrededor de 785: `solicitudesCompatibles.slice(...)`
- `server/src/rutas/admin.ts`, línea alrededor de 2189: `clientes.slice(...)`
- `server/src/rutas/admin.ts`, línea alrededor de 2219: retorno de `clientes.slice(0, 10_000)`

Problema:

Este patrón implica recuperar un conjunto grande y paginar después en memoria. A escala esto degrada latencia, memoria y throughput.

Riesgo:

1. endpoints lentos bajo carga
2. consumo innecesario de RAM
3. peor escalabilidad horizontal

### 7.2.2 Jobs batch con barridos completos

Evidencia:

- `server/src/jobs/cumpleanos.ts`
- `server/src/jobs/recordatorios.ts`

Problema:

`cumpleanos.ts` recorre estudios y luego clientes por estudio. `recordatorios.ts` recorre todas las reservas confirmadas no notificadas y evalúa una por una.

Esto puede funcionar con bajo volumen, pero no es una estrategia robusta si el producto crece de forma agresiva.

Recomendación:

1. convertir a jobs por ventanas pequeñas y consultas más selectivas
2. usar colas dedicadas y paginación por lotes
3. instrumentar tiempo de ejecución, tamaño de lote y reintentos

### 7.2.3 Falta de evidencia de pruebas de carga y observabilidad

No se observó en esta revisión evidencia de:

1. pruebas de carga repetibles para login, reservas y agenda
2. métricas por endpoint
3. dashboard operativo de p95, p99, errores y saturación
4. alertas por cola, latencia o fallos de jobs

Sin eso, hablar de miles de usuarios simultáneos es aspiración, no garantía operativa.

### 7.2.4 Riesgo de consultas y transformación pesada en rutas grandes

La ruta `server/src/rutas/admin.ts` concentra demasiado trabajo: listados, métricas, slices en memoria, cruces de entidades y transformación de estructuras. Ese archivo es una señal clara de hotspot técnico.

## 7.3 Recomendaciones de performance

1. mover paginación y filtrado al query SQL siempre que sea posible
2. evitar cargas completas si el usuario solo ve una página
3. aislar reporting pesado en endpoints o servicios específicos
4. introducir métricas con APM o telemetría propia
5. ejecutar carga sintética antes de cada hito de release mayor

## 8. Auditoría de accesibilidad, Lighthouse y semántica

## 8.1 Diagnóstico general

La aplicación no está lejos de un nivel aceptable, pero todavía no está en una condición que permita prometer un Lighthouse máximo o una accesibilidad excelente de forma consistente en todas las pantallas.

### Aclaración importante

Buscar “puntaje máximo” en Lighthouse para todo el producto, incluyendo dashboards autenticados, no es el objetivo correcto. El objetivo serio debe ser:

1. puntaje excelente y estable en pantallas públicas
2. accesibilidad fuerte y consistente en flujos privados
3. rendimiento real percibido y medido, no solo score visual

## 8.2 Hallazgos altos

### 8.2.1 Idioma visible del producto inconsistente con la política declarada

Evidencia:

- `index.html` declara `<html lang="es">`
- `src/caracteristicas/autenticacion/PaginaInicioSesion.tsx` muestra gran parte del texto visible en español
- `src/componentes/ui/PaginaError.tsx` también usa mensajes visibles en español

Problema:

Tu política interna dice que el texto visible para usuario final debe estar en inglés. El producto hoy está mezclado o predominantemente en español en varias áreas visibles.

Impacto:

1. inconsistencia de marca
2. menor claridad de producto
3. contradicción directa entre estándar y realidad implementada

### 8.2.2 Estilos inline repetidos y tematización frágil

Evidencia:

- `src/caracteristicas/cliente/PaginaReservaCliente.tsx`
- `src/caracteristicas/cliente/PaginaPerfilCliente.tsx`
- `src/caracteristicas/cliente/PaginaInicioCliente.tsx`
- `src/caracteristicas/cliente/PaginaDetalleSalon.tsx`
- `src/caracteristicas/autenticacion/PaginaRegistroSalon.tsx`

Problema:

El uso repetido de `style={{}}` con colores y anchos dinámicos dificulta consistencia visual, control de contraste, reutilización y mantenimiento.

### 8.2.3 SEO técnico público incompleto

Evidencia:

- la carpeta `public/` contiene solo `favicon.svg` y `sw.js`
- no existen `robots.txt` ni `sitemap.xml`
- no se observó estrategia explícita de datos estructurados

Impacto:

1. menor preparación para indexación seria
2. menor disciplina de salida pública

## 8.3 Hallazgos medios

### 8.3.1 La accesibilidad existe por piezas, no todavía como sistema

Hay `aria-label`, `aria-describedby` y algunos diálogos accesibles, pero todavía no se evidencia una política transversal que asegure:

1. manejo consistente de foco
2. contraste y semántica uniforme
3. flujos completos auditados con teclado y lector de pantalla
4. animaciones compatibles con reducción de movimiento

### 8.3.2 Error boundary presente, pero no suficientemente segmentado

Evidencia:

- `src/componentes/ui/LimiteError.tsx`
- `src/app/enrutador.tsx`

Hallazgo:

Sí existe límite de error. Eso es mejor que la conclusión inicial de ausencia total. Sin embargo, el patrón actual sigue siendo grueso y orientado a secciones grandes del enrutador, no a aislamiento fino por feature o subárbol complejo.

## 8.4 Recomendaciones de accesibilidad y Lighthouse

1. definir una matriz WCAG para componentes base
2. revisar todas las pantallas críticas con teclado únicamente
3. revisar contraste con tema dinámico de salón
4. agregar `robots.txt`, `sitemap.xml` y datos estructurados para páginas públicas
5. fijar meta de Lighthouse pública de 95+ en performance, accessibility y best practices
6. no perseguir el 100 sin criterio si eso empeora arquitectura o experiencia real

## 9. Auditoría de escalabilidad y arquitectura futura

## 9.1 Hallazgos críticos y altos

### 9.1.1 Demasiada lógica concentrada en archivos hotspot

Ejemplos:

- `server/src/rutas/admin.ts`
- `src/caracteristicas/maestro/componentes/VisorReservas.tsx`
- `src/caracteristicas/estudio/componentes/AgendaDiaria.tsx`
- `src/caracteristicas/maestro/componentes/PanelFinanciero.tsx`

Problema:

Cuando el producto agregue más módulos, IA, mensajería, pagos extendidos o automatizaciones, estos hotspots se volverán cuellos de botella de desarrollo y zonas de regresión frecuente.

### 9.1.2 Contratos de dominio inconsistentes y mezcla de idiomas

Evidencia:

- `src/tipos/index.ts` usa múltiples propiedades internas en inglés
- el backend usa nombres españoles en Prisma mientras el frontend mezcla inglés y español

Impacto:

1. más costo de onboarding
2. más fricción entre frontend y backend
3. más sensación de producto ensamblado sin un lenguaje ubicuo sólido

### 9.1.3 Duplicidad de representación de reserva

Evidencia:

- `Reserva.servicios Json`
- `ReservaServicio` como tabla relacional adicional

Problema:

Mantener a la vez JSON y tabla para los servicios de una reserva es una fuente potencial de divergencia y deuda de migración.

### 9.1.4 Falta de separación más fuerte entre lectura operacional y reporting

La capa administrativa mezcla necesidades de operación cotidiana con consultas que tienden más a analítica y consolidación. Para escalar bien, eso debería desacoplarse.

## 9.2 Recomendaciones de escalabilidad

1. normalizar progresivamente los datos hoy guardados en JSON
2. separar dominio transaccional de reporting y exportaciones
3. introducir contratos DTO y modelos internos bien diferenciados
4. reducir hotspots de backend y frontend mediante módulos pequeños
5. planificar extensibilidad antes de sumar nuevas tecnologías o grandes features

## 10. Auditoría de usabilidad y producto

## 10.1 Hallazgos altos

### 10.1.1 Inconsistencia de idioma y experiencia

El producto mezcla inglés y español en diferentes capas visibles. Eso afecta percepción de calidad, consistencia y claridad.

### 10.1.2 Formularios críticos todavía heterogéneos

Persisten formularios construidos con `useState` crudo en lugar de un estándar único. Eso repercute en:

1. UX inconsistente
2. validación desigual
3. errores más difíciles de sostener a largo plazo

### 10.1.3 Uso residual de `confirm()` nativo

Evidencia:

- `src/caracteristicas/estudio/componentes/PanelProductos.tsx`, línea alrededor de 345

Esto da una experiencia abrupta, inconsistente y menos accesible que un diálogo propio.

## 10.2 Recomendaciones de usabilidad

1. unificar componentes de confirmación, error, carga y feedback
2. definir copywriting consistente por rol y flujo
3. reducir densidad visual y complejidad en paneles administrativos
4. diseñar con enfoque móvil y tablet como prioridad real, no adaptación posterior

## 11. Auditoría de calidad de código y mantenibilidad

## 11.1 Hallazgos críticos y altos

### 11.1.1 Cobertura de pruebas claramente insuficiente

Evidencia:

- solo se identificaron dos pruebas automatizadas:
  - `src/utils/programacion.test.ts`
  - `server/src/utils/validarEmail.test.ts`

Problema:

La cobertura actual es demasiado baja para un SaaS con reservas, credenciales, pagos, permisos y jobs.

### 11.1.2 Componentes sobredimensionados y exceso de `useState`

Hallazgo heredado y revalidado:

1. existen componentes que exceden el umbral interno de 200 líneas
2. existen componentes que exceden el umbral interno de 3 `useState`

Esto no es solo una regla estética. Es una señal de acoplamiento y baja capacidad de evolución.

### 11.1.3 Documentación técnica viva aún incompleta

Situación:

1. existe README
2. no se verificó `CONTRIBUTING.md`
3. no se verificó `CHANGELOG.md`
4. no hay evidencia suficiente de ADRs o decisiones arquitectónicas vivas

### 11.1.4 Señales de producto ensamblado en vez de sistema diseñado

Esto es lo más importante respecto a la preocupación de que “parezca hecho con IA”.

No delata a un producto el uso de IA. Lo delatan estas señales:

1. dominios con naming inconsistente
2. mezcla de idioma interno y visible
3. componentes demasiado largos
4. reglas declaradas pero no automatizadas
5. duplicidad de datos y decisiones locales no unificadas
6. tests insuficientes frente a la complejidad del negocio

Si esas señales se corrigen, el producto se verá como software profesional, independientemente de qué herramientas hayan ayudado a construirlo.

## 11.2 Recomendaciones de calidad

1. mover reglas críticas a automatización real
2. introducir definición de hecho terminado por feature
3. exigir backend, tests y auditoría en cambios críticos
4. añadir más documentación útil y menos explicación decorativa
5. refactorizar por dominio, no por archivo aislado

## 12. Recomendaciones estratégicas para resistir abuso y ataques

## 12.1 Amenazas prioritarias a considerar

1. credential stuffing y fuerza bruta
2. reutilización de refresh tokens
3. enumeración de cuentas y salones
4. scraping de datos públicos
5. abuso de reservas falsas
6. subida de archivos maliciosos o imprevistos
7. explotación de endpoints pesados para degradar servicio
8. replicación superficial de UI para phishing o copia comercial

## 12.2 Controles recomendados

1. refresh rotation real con revocación
2. rate limit por IP, usuario y huella de operación
3. antifraude y heurísticas en reservas públicas
4. MFA para panel maestro
5. auditoría exhaustiva y correlada
6. política de archivos públicos vs privados
7. source maps desactivados en producción si no son estrictamente necesarios
8. monitoreo de abuso y tableros operativos
9. revisión legal y de marca para desincentivar clonación superficial

## 13. Orden recomendado de remediación

### Fase A — Seguridad y control operativo

1. refresh token rotativo real
2. revocación de sesiones
3. CSRF
4. `Permissions-Policy`
5. `X-Request-ID`
6. auditoría obligatoria completa

### Fase B — Integridad del dominio y backend

1. enums de estados críticos
2. reducción de borrado físico
3. saneamiento de contratos y naming
4. plan de normalización de JSON críticos

### Fase C — Frontend, UX y accesibilidad

1. migración de formularios a RHF + Zod
2. error boundaries más finos
3. eliminación de `confirm()` y estilos inline evitables
4. revisión Lighthouse y WCAG en pantallas públicas y críticas

### Fase D — Escala, rendimiento y operación

1. paginación real en base de datos
2. jobs por lotes y colas más robustas
3. observabilidad y métricas
4. pruebas de carga con evidencia

### Fase E — Calidad de entrega

1. más pruebas automatizadas
2. controles de CI sobre reglas críticas
3. documentación técnica viva
4. prompts e instrucciones de Copilot más específicas por contexto

## 14. Criterios mínimos para declarar la app lista para producción

La app solo debería considerarse lista cuando cumpla al menos con lo siguiente:

1. sin hallazgos críticos abiertos de seguridad
2. sin gaps de auditoría en acciones sensibles
3. sesiones revocables y refresh seguro
4. pruebas automatizadas sobre autenticación, dinero, permisos y reservas
5. paginación y consultas críticas preparadas para carga real
6. accesibilidad aceptable y consistente en flujos críticos
7. evidencia de rendimiento bajo carga
8. estándares de código reforzados por automatización, no solo por documentos

## 15. Conclusión final

Beauty Time Pro tiene una base suficientemente valiosa como para convertirse en un SaaS serio, competitivo y defendible. Pero hoy todavía está en etapa de remediación, no de expansión despreocupada.

La app no está fallando por elección de stack. Está fallando por control incompleto de seguridad, trazabilidad parcial, heterogeneidad de frontend, deuda de dominio y falta de automatización del estándar interno.

Si se ejecuta bien el plan de remediación, el producto puede quedar en una posición fuerte para:

1. venderse en México y Colombia
2. sostener revisión de ingeniería profesional
3. escalar con menos riesgo técnico
4. verse y mantenerse como software profesional hecho para durar

Si no se corrigen los puntos descritos aquí, el crecimiento funcional solo va a ampliar la deuda y hacer más costosa la estabilización futura.