# Sprint 08 — selección del anexo piloto

## Decisión

El piloto seleccionado es el **Anexo 6 — Registro general de extracción de
componentes anatómicos**:

`docs/documentos-reales/anexo-6-registro-general-de-extraccion.pdf`

La fuente tiene dos páginas, tamaño registrado en el inventario Sprint 07 de
187.975 bytes y hash SHA-256
`2AD0386EF94E66D0F48BF4F975B7179B601B1F2B716555E5C17445E282CFE09D`.

## Evidencia visual y estructural

La inspección visual del PDF confirmó:

- Encabezado institucional, título, código de donante, ciudad e IPS
  generadora.
- Tabla de cuatro marcas temporales de la cirugía.
- Tabla fija de ocho componentes: corazón, riñón derecho, riñón izquierdo,
  hígado, páncreas, intestino, pulmón y otros.
- Tabla de personal por procedimiento: nefrectomía, hepatectomía,
  cardiectomía, neumonectomía, pancreatectomía y otros órganos.
- Campos separados para anestesiólogo y perfusionista.
- Segunda página con resección de bazo/ganglios, soluciones de preservación,
  tejidos para rescate, hallazgos generales y responsable.
- Líneas y espacios de firma, sin una firma electrónica definida por el
  backend.

La extracción estructural coincide con estas secciones y conserva las
etiquetas visibles, pero no se usa como sustituto de la revisión visual.

## Criterios de selección

| Criterio | Resultado |
|---|---|
| Complejidad | Media: objetos, fechas, enumeraciones y tres tablas repetitivas |
| Claridad | Alta: etiquetas y filas están explícitamente impresas |
| Evidencia | Alta: PDF legible, dos páginas y revisión visual disponible |
| Dependencias legales | Menores que Anexos 2 y 3; no decide consentimiento ni legalización |
| Dependencias clínicas | Presentes; los campos se dejan como datos de registro y no se inventan reglas |
| Compatibilidad backend | Alta: `OrganRecoverySurgery`, `TissueRecoveryProcedure`, `DonorRecord` y motor documental existen |
| Riesgo de modelado | Medio: las tablas impresas son filas fijas, mientras el renderer usa arreglos |

## Pilotos descartados

- **Anexo 2 y Anexo 3:** requieren homologar aplicabilidad, consentimiento,
  notificación y reglas jurídicas antes de usar una plantilla funcional.
- **Anexo 8:** su cadena de custodia es visualmente clara, pero exige
  semántica append-only y trazabilidad secuencial que no está expuesta como
  contrato específico por el backend.
- **Anexo 7:** tiene variantes anatómicas y debe homologarse como composición,
  no como un único formulario aislado.
- **Historias clínicas DOCX:** contienen datos diligenciados y son fuentes
  sensibles, no plantillas publicables.

## Límite del piloto

El resultado es una definición técnica en estado `DRAFT` fuera de la base de
datos. No se crea una plantilla real, no se valida institucionalmente y no se
publica. La equivalencia visual queda pendiente de una revisión formal con el
responsable institucional.
