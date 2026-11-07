# REGISTRO DE OBSERVACIONES Y NO CONFORMIDADES UI/UX — FASE D.2 / D.4
## GODT REGIONAL 3 — SISTEMA CLÍNICO-DOCUMENTAL DE DONACIÓN Y TRASPLANTE

Fecha: Noviembre 2026  
Versión: 2.0.0 (Estabilización Fase D.4)  
Alcance: Auditoría y estabilización visual y de experiencia de usuario en componentes de DonationProcess, Document Engine, Lifecycle, Firmas, Cadena de Custodia y Layout Multi-Viewport.  
Estado General: **100% DE INCIDENCIAS RESUELTAS Y AUDITADAS EN FASE D.4**.

---

### Resumen de Estabilización UI/UX — Fase D.4

Durante la Fase D.4 se implementaron las soluciones definitivas para la totalidad de las 7 observaciones UI/UX registradas previamente en la Fase D.2. Las implementaciones preservan la paleta institucional (#123047 Navy, #1E5575 Azul, #159C9A Teal, #F5F7FA Fondo), no reescriben componentes existentes, y fueron auditadas y aprobadas mediante una suite de regresión visual multi-viewport sobre Chrome DevTools Protocol (CDP) en 5 resoluciones normativas (1920×1080, 1366×768, 1024×768, 768×1024, 390×844).

---

### Matriz de Observaciones y Estado de Resolución

| ID | Componente / Vista | Nivel | Hallazgo Original | Estado | Solución Técnica Implementada (Fase D.4) | Evidencia Visual (Screenshots) |
|---|---|---|---|---|---|---|
| **UI-01** | `DocumentFormView.vue` / `CustodyEventSection.vue` | Menor | Orientación visual Anexo 8 (pantalla portrait vs PDF landscape). | **RESUELTO EN FASE D.4** | Se implementó contenedor con scroll horizontal (`min-w-[1020px]`), cabecera fija (`sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs`), distintivo visual de orientación oficial apaisada y tabla bitácora de custodia. | `anexo8-custodia-1920x1080-desktop.png`<br>`anexo8-custodia-390x844-mobile.png` |
| **UI-02** | `DonationProcessDetailView.vue` | Menor | Envoltura de cabecera en móviles (< 768px). Badges y botones colisionaban. | **RESUELTO EN FASE D.4** | Cabecera reestructurada con `flex-col md:flex-row`, badges auto-envolventes (`flex-wrap`), botones directos `+ Institución` y `+ Participante` con espaciado responsive y selector de estado adaptativo. Desborde horizontal: 0px. | `proceso-detalle-768x1024-tablet-portrait.png`<br>`proceso-detalle-390x844-mobile.png` |
| **UI-03** | `DonationProcessDetailView.vue` (Pestaña Paquete) | Informativo | Distinción de aplicabilidad y posiciones 20–23 en barra de progreso. | **RESUELTO EN FASE D.4** | Segregación matemática estricta: fórmula `(Completados + Firmados) / Aplicables * 100`. Las 4 posiciones en `PENDING_HOMOLOGATION` (20 a 23) no distorsionan el denominador operativo. Desglose en 6 tarjetas métricas (Total 23, Aplicables, Completos, Firmados, No Aplica, Pend. Homol.) y leyenda de fórmula. | `proceso-detalle-1920x1080-desktop.png`<br>`proceso-detalle-1366x768-laptop.png`<br>`proceso-detalle-1024x768-tablet-landscape.png` |
| **UI-04** | `DocumentFormView.vue` / `DynamicField.vue` | Menor | Falta de banner persistente e indicadores de bloqueo en modo sólo lectura. | **RESUELTO EN FASE D.4** | Banner superior prominente `sticky top-2 z-30` con styling ámbar/dorado *"Documento Sellado — Modo Sólo Lectura"*, estado del documento, botones de "Ver PDF Oficial" y "Reapertura Técnica", más styling `bg-slate-100/90 cursor-not-allowed` en campos. | `documento-sellado-1920x1080-desktop.png`<br>`documento-sellado-390x844-mobile.png` |
| **UI-05** | `CustodyEventSection.vue` | Menor | Captura y visualización de fecha/hora sin indicador explícito de zona horaria local. | **RESUELTO EN FASE D.4** | Indicador explícito `(COT / UTC-5)` en etiqueta del formulario modal, cabecera de la tabla y badge. Formateo con `timeZone: "America/Bogota"` y cálculo de desfase local para Colombia. | `anexo8-custodia-1920x1080-desktop.png`<br>`anexo8-custodia-390x844-mobile.png` |
| **UI-06** | `DocumentSignatureModal.vue` | Informativo | Validación previa de atestación legal y distinción de modalidades. | **RESUELTO EN FASE D.4** | Validación reactiva de atestación mínima (>= 10 caracteres) con contador dinámico `.../10 caracteres mín.`. Botón de confirmación deshabilitado reactivamente ante atestación insuficiente. Cuatro tarjetas visuales diferenciadas para modalidades de firma y tarjeta bloqueada con badge *"Requiere ONAC"*. | `modal-firma-1920x1080-desktop.png`<br>`modal-firma-390x844-mobile.png` |
| **UI-07** | `AccessView.vue` | Informativo | Ocultamiento de botones de acceso rápido de desarrollo en producción. | **RESUELTO EN FASE D.4** | Aislamiento bajo `v-if="isDev"` (`import.meta.env.DEV`). Verificado que en `vite preview` (modo producción) los botones son omitidos del DOM y sólo se renderiza el formulario institucional seguro. | `login-1920x1080-desktop.png`<br>`login-390x844-mobile.png` |

---

### Verificación Técnica de la Suite Automatizada

- **Herramienta:** Node.js Test Runner + Chrome DevTools Protocol (`tests/visual-regression.test.mjs`).
- **Viewports Evaluados:**
  1. `1920x1080` (Desktop Full HD)
  2. `1366x768` (Laptop Standard)
  3. `1024x768` (Tablet Landscape)
  4. `768x1024` (Tablet Portrait)
  5. `390x844` (Mobile iPhone)
- **Resultado:** 100% de aserciones aprobadas. 21 capturas de pantalla registradas en `Frontend/screenshots/fase-d4/`.
