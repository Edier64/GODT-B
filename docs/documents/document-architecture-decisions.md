# Decisiones arquitectónicas documentales

## ADR-01 — Instancia documental explícita

**Decisión:** crear `DocumentInstance` y un historial de revisiones.

**Razón:** `GeneratedPdfDocument` solo representa un resultado generado y
`TemplateVersion` solo define una plantilla. Extenderlos para drafts,
procedencia y revisión mezclaría responsabilidades y perdería claridad.

## ADR-02 — Respuestas fuera de `clinicalData`

**Decisión:** almacenar respuestas en revisiones de instancia.

**Razón:** `clinicalData` es información canónica del expediente; una respuesta
de formulario incluye presentación, versión, estado y procedencia propios.

## ADR-03 — Participantes especializados

**Decisión:** conservar `DonationRepresentative` y agregar un modelo común de
participantes documentales.

**Razón:** deudo, testigo, firmante, profesional y custodio no son sinónimos ni
comparten reglas. La homologación jurídica definirá cantidades y requisitos.

## ADR-04 — Dependencias declarativas versionadas

**Decisión:** reglas en la versión de plantilla, con tipos `REQUIRED`,
`OPTIONAL`, `CONDITIONAL`, `VARIANT`, `PARALLEL` y `VALIDATED_INPUT`.

**Razón:** evita una secuencia rígida y permite conservar el comportamiento
histórico sin ejecutar código arbitrario.

## ADR-05 — Renderizado híbrido

**Decisión:** seleccionar superposición, DOCX, HTML/CSS o estructurado por
versión y recurso.

**Razón:** los formatos oficiales tienen exigencias distintas de fidelidad,
tablas, páginas y orientación.

## ADR-06 — Inmutabilidad publicada

**Decisión:** una versión publicada, revisión aprobada y PDF generado no se
modifican; las correcciones crean nuevas versiones o revisiones.

**Razón:** protege trazabilidad y permite reconstruir el documento histórico.

## ADR-07 — Fuentes y conflictos explícitos

**Decisión:** cada campo relevante conserva procedencia y estado de conflicto.

**Razón:** OCR validado puede asistir, pero nunca sustituye la revisión humana
ni permite sobrescritura silenciosa.

## ADR-08 — Preservación por `RESTRICT`

**Decisión:** no eliminar en cascada plantillas, instancias, revisiones o PDFs.

**Razón:** los documentos históricos y auditorías deben permanecer consultables.

## ADR-09 — Catálogo abierto

**Decisión:** el número de documento no determina el código ni la arquitectura.

**Razón:** permite incorporar el documento 24 o nuevas variantes mediante
configuración y versionamiento, sin cambiar el motor.

## Alcance de esta decisión

Estas decisiones son diseño previo. No autorizan cambios en Prisma, migraciones,
endpoints ni frontend hasta que se aprueben las decisiones institucionales y
los contratos técnicos.

## Escenarios conceptuales

### Documento 24

Se crea una entrada de catálogo, versión borrador, schema, UI schema, mapping y
recurso. Tras validación y publicación, el frontend lo descubre por catálogo.
No se cambia un componente central.

### Versión 2

Se copia la definición lógica como nuevo `TemplateVersion`, se cambia el schema
o recurso y se publica. Las instancias existentes continúan apuntando a versión
1.

### Histórico versión 1

La consulta de la instancia resuelve `templateVersionId=1`, la revisión
guardada y el PDF con su hash. La versión 2 no altera el resultado.

### Retiro

El catálogo deja de ofrecer nuevas instancias, pero las instancias y PDFs
históricos siguen disponibles según permisos.

### Nueva variante Anexo 7

Se registra una variante y una versión específica que reutiliza las secciones
comunes y declara sus campos anatómicos. No se crea una cadena de `if` por
documento en el motor.

### Borrador incompleto

Se guarda una revisión parcial como `DRAFT`. La validación devuelve faltantes,
pero no borra el contenido ni permite aprobación.

### Conflicto OCR/expediente

El precargado devuelve dos fuentes y un conflicto. El usuario decide y el
backend registra la resolución y su procedencia.

### OCR pendiente

El backend no lo agrega como fuente oficial ni lo usa para aprobar o generar.
Puede mostrarlo como candidato no confirmado en una vista restringida.

## Decisiones que requieren aprobación institucional

1. Identificadores, nombres oficiales, categorías y vigencia de cada documento.
2. Reglas de selección Anexo 2 frente a Anexo 3.
3. Cantidad y calidad jurídica de representantes y testigos.
4. Requisitos de firmas, certificados y profesionales responsables.
5. Catálogos clínicos, obligatoriedad y reglas condicionales.
6. Tratamiento de documentos diligenciados como fuente o formulario.
7. Formato oficial de salida y exigencia concreta de PDF/A.
8. Aceptación de firma manuscrita escaneada, firma electrónica o espacio vacío.
9. Políticas de retención, anonimización y acceso institucional.
10. Versiones oficiales de los 23 documentos y procedimiento de homologación.

## Dictamen

El diseño está **preparado para iniciar implementación técnica por fases**,
pero no está preparado para publicar reglas clínicas, jurídicas, catálogos
oficiales ni versiones definitivas. Puede comenzarse, tras aprobación, por la
base técnica de catálogo/versionamiento y persistencia de instancias, dejando
las reglas no homologadas configurables y explícitamente pendientes.
