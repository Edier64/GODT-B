# Sprint 08 — matriz campo a campo del Anexo 6

## Convenciones

- `PENDIENTE` significa que el documento muestra un campo, pero no define por
  sí solo obligatoriedad, catálogo o regla de negocio.
- Las rutas usan JSONPath compatible con los errores del motor (`$`, `.campo`
  y `[índice]`).
- Los campos `rndCode` y `originatingIpsName` son datos maestros de
  `DonorRecord` y se muestran mediante mappings de solo lectura; no se
  duplican como captura manual.

| ID | Etiqueta original | Ruta JSON | Sección | Tipo | Componente | Opciones | Evidencia | Obligación | Dependencias / entidad | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| A6-01 | Código donante | `$.rndCode` | Encabezado | string | input solo lectura | — | Encabezado, “Código donante” | Maestro; no inferir requerida | `DonorRecord.rndCode` | Mapping `DONOR_RECORD` |
| A6-02 | Ciudad | `$.city` | Encabezado | string | input | — | Línea “Ciudad” | PENDIENTE | No existe campo canónico equivalente | No copiar desde otra entidad |
| A6-03 | IPS generadora | `$.originatingIpsName` | Encabezado | string | input solo lectura | — | Línea “IPS generadora” | Maestro; no inferir requerida | `DonorRecord.originatingIpsName` | Mapping `DONOR_RECORD` |
| A6-04 | Fecha y hora programada de inicio del rescate | `$.scheduledStartAt` | Cirugía | date-time nullable | datetime-local | — | Celda superior izquierda | PENDIENTE | `OrganRecoverySurgery` | El documento no indica regla de completitud |
| A6-05 | Fecha y hora real de inicio del rescate | `$.actualStartAt` | Cirugía | date-time nullable | datetime-local | — | Celda superior derecha | PENDIENTE | `OrganRecoverySurgery.procedureStartedAt` | La propuesta no escribe el modelo maestro |
| A6-06 | Hora de clampeo (No aplica solo en tejidos) | `$.clampAt` | Cirugía | date-time nullable | datetime-local | — | Celda inferior izquierda | Condicional visible; regla PENDIENTE | `OrganRecoverySurgery.aorticClampAt` | No se implementa una regla clínica adicional |
| A6-07 | Fecha y hora finalización de cirugía de rescate | `$.finishedAt` | Cirugía | date-time nullable | datetime-local | — | Celda inferior derecha | PENDIENTE | `OrganRecoverySurgery.procedureEndedAt` | — |
| A6-08 | Componente | `$.organRecoveries[].component` | Órganos rescatados | enum | select | corazón, riñones, hígado, páncreas, intestino, pulmón, otros | Primera columna de ocho filas | Fila impresa; obligatoriedad PENDIENTE | `OrganRecoverySurgery.organsRecovered` | Valores técnicos conservadores |
| A6-09 | Institución responsable del rescate | `$.organRecoveries[].responsibleInstitution` | Órganos rescatados | string nullable | input | — | Segunda columna | PENDIENTE | JSON operativo de cirugía | No se inventa catálogo de IPS |
| A6-10 | Causa de no extracción (Si aplica) | `$.organRecoveries[].nonExtractionReason` | Órganos rescatados | string nullable | textarea | — | Tercera columna | Condicional visible; regla PENDIENTE | JSON operativo de cirugía | No se obliga cuando sí hay rescate |
| A6-11 | Procedimiento | `$.personnel[].procedure` | Personal | enum | select | nefrectomía, hepatectomía, cardiectomía, neumonectomía, pancreatectomía, otros órganos | Primera columna de filas | Etiquetas impresas | PENDIENTE | `OrganRecoverySurgery.surgicalTeam` | Dos filas “Otros órganos” se conservan como slots |
| A6-12 | Cirujano(s) | `$.personnel[].surgeon` | Personal | string nullable | input | — | Columna “Cirujano(s)” | PENDIENTE | JSON operativo de cirugía | No se exige usuario porque el documento fuente no lo define |
| A6-13 | Ayudante | `$.personnel[].assistant` | Personal | string nullable | input | — | Columna “Ayudante” | PENDIENTE | JSON operativo de cirugía | — |
| A6-14 | Instrumentación | `$.personnel[].instrumentation` | Personal | string nullable | input | — | Columna “Instrumentación” | PENDIENTE | JSON operativo de cirugía | — |
| A6-15 | Anestesiólogo | `$.anesthesiologist` | Personal | string nullable | input | — | Campo separado al final de página 1 | PENDIENTE | `surgicalTeam` | — |
| A6-16 | Perfusionista | `$.perfusionist` | Personal | string nullable | input | — | Campo separado al final de página 1 | PENDIENTE | `surgicalTeam` | — |
| A6-17 | Resección de bazo y ganglios para estudios de Inmunogenética | `$.spleenLymphNodeResection` | Estudios | enum | select | SI, NO | Texto explícito “(SI/NO)” | PENDIENTE | `OrganRecoverySurgery` | No se interpreta el significado clínico |
| A6-18 | Tipo de solución | `$.preservationSolutions[].type` | Preservación | string nullable | input | — | Columna “Tipo” | PENDIENTE | `preservationSolution` | El documento no muestra catálogo |
| A6-19 | Vía o destino | `$.preservationSolutions[].route` | Preservación | enum | select | por aorta, por porta, banco de riñón, banco de hígado, banco de corazón, banco pulmón, otro | Filas impresas | PENDIENTE | `preservationSolution` | Se preservan etiquetas visibles |
| A6-20 | Cantidad (c.c) | `$.preservationSolutions[].quantityCc` | Preservación | number nullable | input number | — | Columna “Cantidad (c.c)” | PENDIENTE | `preservationSolution` | No se fija mínimo clínico |
| A6-21 | Componente | `$.tissueRecoveries[].component` | Tejidos | enum | select | tejidos oculares, osteomusculares, cardiovasculares, piel, otros | Primera columna de página 2 | PENDIENTE | `TissueRecoveryProcedure.recoveredComponents` | Slots visibles |
| A6-22 | Banco responsable del rescate | `$.tissueRecoveries[].responsibleBank` | Tejidos | string nullable | input | — | Segunda columna | PENDIENTE | `TissueRecoveryProcedure.recoveredComponents` | No se crea catálogo nuevo |
| A6-23 | Profesional / Técnico extracción | `$.tissueRecoveries[].extractionProfessional` | Tejidos | string nullable | input | — | Tercera columna | PENDIENTE | `TissueRecoveryProcedure` | El modelo tiene IDs, pero el formulario fuente muestra texto |
| A6-24 | Causa de no extracción (Si aplica) | `$.tissueRecoveries[].nonExtractionReason` | Tejidos | string nullable | textarea | — | Cuarta columna | Condicional visible; PENDIENTE | `TissueRecoveryProcedure` | — |
| A6-25 | Hallazgos relevantes (generales) durante la cirugía | `$.generalFindings` | Hallazgos | string nullable | textarea | — | Bloque de líneas de página 2 | PENDIENTE | `DocumentResponseRevision` | No se convierte en diagnóstico |
| A6-26 | Firma / Nombre médico o profesional responsable | `$.responsibleProfessionalName` | Cierre | string nullable | input | — | Leyenda de firma | PENDIENTE | Usuario/procedimiento | No simula firma electrónica |
| A6-27 | c.c. | `$.responsibleProfessionalId` | Cierre | string nullable | input | — | Línea “c.c.” | PENDIENTE | Usuario/procedimiento | No se valida formato no documentado |

## Relación con el modelo

La plantilla conserva la respuesta como `DocumentResponseRevision`, con
proveniencia opcional. Los mappings canónicos solo precargan los dos datos
maestros disponibles. Las estructuras clínicas de cirugía y tejidos se
mantienen como respuesta documental porque el motor actual no expone un
mapping canónico de escritura hacia esas entidades.
