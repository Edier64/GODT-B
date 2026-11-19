# INFORME TÉCNICO DE ESTABILIZACIÓN VISUAL, UX/UI Y CONSUMO DE ENDPOINTS — FASE D.4
## GODT REGIONAL 3 — SISTEMA CLÍNICO-DOCUMENTAL DE DONACIÓN Y TRASPLANTE

Fecha: Noviembre 2026  
Versión: 1.0.0 (Fase D.4 Final)  
Repositorios:
- **Frontend:** `GODT-Frontend` (Vue 3, TypeScript, Tailwind CSS, Pinia, Axios)
- **Backend:** `GODT-B` (NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis)  
Rama de trabajo: `feature/fase-d4-ui-stabilization` → Integrada en `main`

---

## 1. RESUMEN EJECUTIVO

La **Fase D.4** tuvo como propósito consolidar la estabilidad visual, la ergonomía de navegación y la resiliencia en el consumo de endpoints en el ecosistema GODT Regional 3, resolviendo de forma integral y comprobable las 7 no conformidades estéticas y de interacción registradas en `FASE_D2_UI_ISSUES_REGISTER.md`.

### Logros Principales:
1. **Resolución 100% de Hallazgos UI/UX:** Se implementaron correcciones específicas para UI-01 a UI-07 sin rehacer vistas ni eliminar funcionalidad existente.
2. **Diseño Multi-Viewport Verificado:** Se certificó la responsividad y ausencia de desbordes horizontales en 5 viewports normativos (Desktop 1920×1080, Laptop 1366×768, Tablet Landscape 1024×768, Tablet Portrait 768×1024, Mobile 390×844) mediante una suite automatizada basada en Chrome DevTools Protocol (CDP).
3. **Robustez en Servicios Axios:** Manejo centralizado de errores con propagación de mensajes de dominio y códigos HTTP (400, 401, 403, 404, 409, 422, 500, red).
4. **Protección Anti-Doble Envío:** Botones de acción crítica con estados reactivos `disabled` e indicadores de carga durante operaciones asíncronas de ciclo de vida.
5. **Cadena de Custodia con Zona Horaria Oficial:** Registro y visualización inmutable con hora legal colombiana explicitada (`COT / UTC-5`).
6. **Validación Reactiva de Firmas:** Verificación en tiempo real de longitud mínima de atestación (≥ 10 caracteres) y distinción gráfica de modalidades.
7. **Batería de Pruebas Superada al 100%:** 126 pruebas backend en Jest, 4 contratos frontend, 1 suite de flujo E2E y 1 suite de regresión visual multi-viewport.

---

## 2. DETALLE DE RESOLUCIÓN DE INCIDENCIAS UI-01 A UI-07

### UI-01: Anexo 8 en Pantalla — Tabla Bitácora con Scroll Horizontal y Sticky Header
- **Problema previo:** El Anexo 8 (Cadena de Custodia) se presentaba en formulario vertical apilado, en contraste con el formato apaisado (landscape) oficial y del PDF emitido.
- **Solución implementada:**
  - En `CustodyEventSection.vue` se diseñó un contenedor con scroll horizontal explícito (`min-w-[1020px]`) y cabecera fija (`sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs`).
  - Se agregó un distintivo superior en color azul marino indicando *"Formato Apaisado (Landscape)"* junto con la zona horaria *"Zona: COT / UTC-5"*.
  - La visualización en pantallas móviles y desktop permite navegar la secuencia cronológica de eslabones con scroll fluido sin alterar el formato de exportación PDF oficial.
- **Evidencia:** `screenshots/fase-d4/anexo8-custodia-1920x1080-desktop.png`, `anexo8-custodia-390x844-mobile.png`.

### UI-02: Cabecera Responsiva en Detalle del Proceso (< 768px)
- **Problema previo:** En pantallas móviles y tablets pequeñas, el código del proceso, los badges de estado y los botones colisionaban provocando quiebres de línea erráticos y desbordes.
- **Solución implementada:**
  - En `DonationProcessDetailView.vue`, el header superior fue reestructurado con `flex-col md:flex-row md:items-center justify-between gap-4`.
  - El código de proceso y los badges se configuraron con `flex-wrap items-center gap-2.5 break-all`.
  - Se integraron botones directos de acción rápida `+ Institución` y `+ Participante` visibles y accesibles en móviles sin solapamiento.
  - Se verificó que `document.documentElement.scrollWidth <= window.innerWidth` en todos los breakpoints.
- **Evidencia:** `screenshots/fase-d4/proceso-detalle-768x1024-tablet-portrait.png`, `proceso-detalle-390x844-mobile.png`.

### UI-03: Segregación Matemática de Métricas y Posiciones 20–23
- **Problema previo:** Las posiciones en homologación (20 a 23) distorsionaban el porcentaje de avance y no existía un desglose clínico claro entre aplicables, completados y no aplicables.
- **Solución implementada:**
  - En `DonationProcessDetailView.vue`, el computed `packageMetrics` calcula estrictamente:
    $$\text{Avance Normativo} = \frac{\text{Completados} + \text{Firmados}}{\text{Aplicables Normativos (máx 19)}} \times 100$$
  - Las posiciones 20 a 23 (`PENDING_HOMOLOGATION`) quedan expresamente excluidas del denominador y se reportan en su propia categoría.
  - Se implementó un panel con 6 tarjetas métricas diferenciadas: **Total (23)**, **Aplicables**, **Completos**, **Firmados**, **No Aplica**, y **Pend. Homol. (4)**.
  - Se agregó una barra de progreso animada con tooltip explicativo y una leyenda inferior desglosada con viñetas de color.
- **Evidencia:** `screenshots/fase-d4/proceso-detalle-1920x1080-desktop.png`, `proceso-detalle-1024x768-tablet-landscape.png`.

### UI-04: Banner Superior Prominente para Documentos Sellados (Modo Sólo Lectura)
- **Problema previo:** Los documentos en estados terminales o protegidos (`COMPLETADO`, `PENDIENTE_FIRMAS`, `FIRMADO`, `LIBERADO`) deshabilitaban inputs pero carecían de una advertencia superior inequívoca.
- **Solución implementada:**
  - En `DocumentFormView.vue` se implementó un banner superior persistente (`sticky top-2 z-30`) con styling ámbar cálido (`bg-amber-500/95 backdrop-blur-md`), ícono de candado 🔒, badge del estado actual del documento y mensaje explicativo sobre la inmutabilidad jurídica de los snapshots y firmas.
  - El banner incorpora accesos directos a *"Ver PDF Oficial"* y *"Reapertura Técnica"*.
  - En `DynamicField.vue` se agregó styling explícito a todos los campos en modo de solo lectura: `bg-slate-100/90 text-slate-600 cursor-not-allowed border-slate-300`.
- **Evidencia:** `screenshots/fase-d4/documento-sellado-1920x1080-desktop.png`, `documento-sellado-390x844-mobile.png`.

### UI-05: Fechas y Horas en Hora Legal Colombiana (COT / UTC-5)
- **Problema previo:** Los selectores `<input type="datetime-local" />` no explicitaban si la captura correspondía a UTC o a la hora legal de Colombia.
- **Solución implementada:**
  - En `CustodyEventSection.vue` se integró la etiqueta explícita `(COT / UTC-5)` en el label del formulario modal, en la cabecera de la tabla y en el badge superior.
  - Las funciones auxiliares `getNowCotIso()` y `formatCotDateTime()` computan el desfase fijo de -5 horas (UTC-5) y formatean con `timeZone: "America/Bogota"`, garantizando trazabilidad cronológica inalterable.
- **Evidencia:** `screenshots/fase-d4/anexo8-custodia-1920x1080-desktop.png`.

### UI-06: Modal de Firmas con Validación Reactiva y Tarjetas Gráficas Diferenciadas
- **Problema previo:** La atestación legal permitía envíos con textos cortos sin validación reactiva previa, y las cuatro modalidades carecían de contraste visual.
- **Solución implementada:**
  - En `DocumentSignatureModal.vue` se implementó el computed `isAttestationLengthValid` (mínimo 10 caracteres) y un contador dinámico `X/10 caracteres mín.` en color reactivo (rojo/teal).
  - El botón *"Confirmar y Firmar Documento"* permanece inhabilitado (`disabled`) hasta que se cumplan las validaciones de nombre, documento, aceptación de juramento y longitud de atestación.
  - Se diseñaron 4 tarjetas visuales diferenciadas para:
    1. 📜 *Atestación de Usuario* (seleccionable con checkbox de declaración bajo juramento).
    2. 🖌️ *Firma Dibujada en Pantalla* (lienzo Canvas interactivo con borrado).
    3. 📝 *Manuscrita Presencial* (constancia de rúbrica física).
    4. 🔏 *Digital Certificada* (tarjeta atenuada con badge destacado *"Requiere ONAC"*, bloqueada conforme a la Ley 527 de 1999).
- **Evidencia:** `screenshots/fase-d4/modal-firma-1920x1080-desktop.png`, `modal-firma-390x844-mobile.png`.

### UI-07: Aislamiento Estricto de Accesos de Desarrollo en Compilaciones de Producción
- **Problema previo:** Los botones de inicio de sesión rápido para desarrollo no debían exponerse en ambientes productivos.
- **Solución implementada:**
  - En `AccessView.vue`, los botones rápidos están encapsulados bajo `v-if="isDev"`, donde `const isDev = import.meta.env.DEV`.
  - En `vite build` / `vite preview`, `import.meta.env.DEV` es estrictamente `false`, eliminando por completo los botones del DOM.
  - Se verificó mediante prueba automatizada en CDP que en la vista `/acceso` de `vite preview` los botones de desarrollo no existen y únicamente se renderiza el formulario institucional seguro.
- **Evidencia:** `screenshots/fase-d4/login-1920x1080-desktop.png`, `login-390x844-mobile.png`.

---

## 3. AUDITORÍA VISUAL MULTI-VIEWPORT (5 RESOLUCIONES NORMATIVAS)

La verificación se ejecutó mediante la suite automatizada `tests/visual-regression.test.mjs` invocando Chrome en modo headless con emulación de dispositivos CDP:

| Viewport | Resolución | Tipo de Dispositivo | Scroll Horizontal Detectado | Estado |
|---|---|---|:---:|:---:|
| **Desktop Full HD** | 1920 × 1080 | Pantalla de escritorio estándar | 0 px | APROBADO |
| **Laptop Standard** | 1366 × 768 | Computador portátil corporativo | 0 px | APROBADO |
| **Tablet Landscape** | 1024 × 768 | iPad / Tablet horizontal | 0 px | APROBADO |
| **Tablet Portrait** | 768 × 1024 | iPad / Tablet vertical | 0 px | APROBADO |
| **Mobile** | 390 × 844 | iPhone 12 / 13 / 14 | 0 px | APROBADO |

### Inventario de Capturas de Pantalla Generadas:
Las siguientes 21 capturas de pantalla fueron generadas y almacenadas en `Frontend/screenshots/fase-d4/`:
1. `login-1920x1080-desktop.png`
2. `login-1366x768-laptop.png`
3. `login-1024x768-tablet-landscape.png`
4. `login-768x1024-tablet-portrait.png`
5. `login-390x844-mobile.png`
6. `procesos-list-1920x1080-desktop.png`
7. `procesos-list-1366x768-laptop.png`
8. `procesos-list-1024x768-tablet-landscape.png`
9. `procesos-list-768x1024-tablet-portrait.png`
10. `procesos-list-390x844-mobile.png`
11. `proceso-detalle-1920x1080-desktop.png`
12. `proceso-detalle-1366x768-laptop.png`
13. `proceso-detalle-1024x768-tablet-landscape.png`
14. `proceso-detalle-768x1024-tablet-portrait.png`
15. `proceso-detalle-390x844-mobile.png`
16. `anexo8-custodia-1920x1080-desktop.png`
17. `anexo8-custodia-390x844-mobile.png`
18. `documento-sellado-1920x1080-desktop.png`
19. `documento-sellado-390x844-mobile.png`
20. `modal-firma-1920x1080-desktop.png`
21. `modal-firma-390x844-mobile.png`

---

## 4. SERVICIOS AXIOS, MANEJO DE ERRORES Y PREVENCIÓN DE DOBLE ENVÍO

### Manejo Centralizado de Errores (`src/services/api.ts`):
Se reforzó la función `getApiError(error: unknown)`:
- Prioriza mensajes enviados por el backend en `error.response.data.message` o `error.response.data.error`.
- Mapea códigos de error HTTP a mensajes clínicos claros en español:
  - **400:** *"Solicitud inválida. Verifique los datos ingresados."*
  - **401:** *"Sesión vencida o credenciales incorrectas."* (emite evento `godt:session-expired`).
  - **403:** *"No tiene permisos institucionales para realizar esta acción."*
  - **404:** *"El recurso solicitado no fue encontrado."*
  - **409:** *"Conflicto de concurrencia o estado incompatible."*
  - **422:** *"Error de validación en la estructura de datos."*
  - **500:** *"Error interno del servidor. Por favor intente más tarde."*
  - **Network Error:** *"No es posible conectar con el servidor."*

### Prevención de Doble Envío:
- En `DocumentFormView.vue`, `DonationProcessDetailView.vue`, `DocumentSignatureModal.vue` y `CustodyEventSection.vue`, todas las acciones que modifican el ciclo de vida documental o registran eslabones gestionan banderas de estado (`lifecycleLoading`, `saving`, `signing`).
- Los botones quedan inhabilitados (`:disabled="loading"`) y muestran textos contextuales (`"Validando..."`, `"Completando..."`, `"Generando..."`, `"Estampando firma..."`), impidiendo pulsaciones repetidas o peticiones duplicadas.

---

## 5. RESULTADOS DE PRUEBAS DE REGRESIÓN

| Suite | Componente | Pruebas | Resultado |
|---|---|:---:|:---:|
| Backend Unit & Integration | `Backend/GODT-B` (Jest contra PostgreSQL y Redis) | 126 pruebas en 20 suites | **100% PASSED** |
| Frontend Contracts | `Frontend` (`tests/contracts.test.mjs`) | 4 contratos | **100% PASSED** |
| Frontend E2E Workflow | `Frontend` (`tests/browser-workflow.test.mjs`) | 1 flujo completo de navegación | **100% PASSED** |
| Frontend Visual Multi-Viewport | `Frontend` (`tests/visual-regression.test.mjs`) | 5 viewports normativos, 21 screenshots | **100% PASSED** |

---

## 6. CONTROL DE VERSIONES Y TRAZABILIDAD GIT

- **Ramas:** `feature/fase-d4-ui-stabilization` creadas en ambos repositorios.
- **Integración:** Merge `--no-ff` a rama principal `main` en ambos repositorios tras verificar la suite completa.
- **Commits:** Mensajes bajo convención Conventional Commits (`feat(ui): ...`, `docs: ...`).
