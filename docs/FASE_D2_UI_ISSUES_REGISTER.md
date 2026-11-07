# REGISTRO DE OBSERVACIONES Y NO CONFORMIDADES UI/UX — FASE D.2
## GODT REGIONAL 3 — SISTEMA CLÍNICO-DOCUMENTAL DE DONACIÓN Y TRASPLANTE

Fecha: Noviembre 2026  
Versión: 1.0.0 (Fase D.2)  
Alcance: Auditoría visual y de experiencia de usuario en componentes de DonationProcess, Document Engine, Lifecycle, Firmas y Cadena de Custodia.  
Directriz: **NO aplicar rediseño visual invasivo en Fase D.2**; registrar hallazgos técnicos para priorización en backlog de refinamiento de UI.

---

### Resumen de Estado UI/UX

El frontend (`GODT-Frontend`) implementa una interfaz funcional, coherente y reactiva basada en Vue 3 + Tailwind CSS + Pinia, con comunicación fluida hacia el backend NestJS. No se detectan bloqueos operativos ni errores de renderizado crítico. Se identifican las siguientes observaciones técnicas no bloqueantes.

---

### Matriz de Observaciones UI/UX

| ID | Componente / Vista | Nivel | Hallazgo Observado | Comportamiento Esperado | Recomendación Futura |
|---|---|---|---|---|---|
| **UI-01** | `DocumentFormView.vue` / `CustodyEventSection.vue` | Menor | **Orientación visual Anexo 8:** El formulario web se renderiza en flujo vertical (portrait), mientras que el formato oficial institucional y su PDF emitido son horizontales (landscape). | El usuario visualiza los campos en columna en web, pero el PDF exportado es apaisado. No afecta los datos pero genera contraste perceptivo. | En Fase E, diseñar una plantilla de visualización tipo rejilla horizontal o tabla tipo bitácora clínica para Anexo 8 en pantallas anchas. |
| **UI-02** | `DonationProcessDetailView.vue` | Menor | **Envoltura de cabecera en móviles:** En pantallas con ancho menor a 768px, el identificador RND, los badges de estado del proceso y los botones de acción rápida ("Iniciar Diligenciamiento", "Asociar Institución") experimentan quiebre de línea múltiple. | Los elementos deben colapsar en un menú desplegable de acciones en pantallas pequeñas. | Incorporar un botón tipo "Acciones (...)" con dropdown en breakpoints `< md`. |
| **UI-03** | `DonationProcessDetailView.vue` (Pestaña Paquete) | Informativo | **Distinción de aplicabilidad en barra de progreso:** La métrica de avance calcula el porcentaje sobre documentos activos, pero cuando varias posiciones están en `NO_APLICA`, el conteo visual podría explicitar mejor los documentos no requeridos vs. pendientes. | La barra actual contabiliza correctamente el progreso sin bloquear, pero un desglose visual (e.g. 15 aplicables, 4 condicionales, 4 pendientes de homologación) aportaría mayor claridad clínica. | Agregar tooltip desglosado con leyenda de aplicabilidad sobre la barra de progreso. |
| **UI-04** | `DocumentFormView.vue` | Menor | **Indicadores de bloqueo en modo sólo lectura:** Cuando una instancia documental avanza a `COMPLETADO`, `FIRMADO` o `LIBERADO`, los inputs se deshabilitan correctamente (`disabled`/`readonly`), pero en tablas anidadas y selectores no siempre resalta un banner superior persistente que avise que el expediente está sellado e inmutable. | El usuario debe advertir inmediatamente que el documento está en modo consulta inmutable antes de intentar interactuar con un campo. | Añadir un banner superior flotante de color ámbar/azul con candado: *"Documento sellado — Modo sólo lectura"*. |
| **UI-05** | `CustodyEventSection.vue` | Menor | **Captura de fecha y hora local vs UTC:** El selector `<input type="datetime-local" />` utiliza la hora del navegador del cliente, mientras que el backend almacena en estándar ISO-8601 UTC. En zonas horarias no sincronizadas podría haber ligeras discrepancias de visualización si no se formatea localmente en la tabla histórica. | La tabla histórica formatea correctamente con `toLocaleString()`, pero el placeholder inicial toma la hora del sistema sin indicar zona horaria (COT / UTC-5). | Incluir sufijo de zona horaria explícito `(COT / UTC-5)` junto al selector de fecha. |
| **UI-06** | `DocumentSignatureModal.vue` | Informativo | **Validación previa de atestación legal:** El campo de texto de justificación o atestación permite presionar "Firmar" con textos breves; el backend valida que la atestación sea sustantiva. | El frontend debería prevenir el clic si la atestación contiene menos de 10 caracteres o si el firmante no ha seleccionado su tipo de firma. | Incorporar validación de longitud mínima reactiva en el formulario del modal. |
| **UI-07** | `AccessView.vue` | Informativo | **Acceso rápido para desarrollo:** Se incorporaron botones de inicio de sesión rápido (Dra. Elena Ramos - Coordinador, Administrador). | Estos botones facilitan enormemente las pruebas locales y de integración, pero no deben exponerse en compilaciones de producción. | Envolver los botones de desarrollo bajo `v-if="isDevEnvironment"` (`import.meta.env.DEV`). |

---

### Conclusión de Auditoría UI/UX

1. Todas las interfaces requeridas para la Fase D.2 se encuentran operativas, conectadas y estables.
2. Las 7 observaciones identificadas son de nivel Menor o Informativo y corresponden a refinamientos estéticos o de ergonomía visual.
3. No se requiere ninguna modificación estructural ni destructiva en los componentes frontend existentes.
