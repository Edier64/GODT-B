# ADR 004: Diccionario Canónico, Marcadores Compartidos y Motor de Propagación Documental

## Estado
Aprobado (Fase C) — 2026-11-06

## Contexto
En el operativo de donación y trasplante de órganos y tejidos de la Regional 3, múltiples documentos normativos (Anexos 1 al 9 y sus variantes) solicitan información idéntica o equivalente: datos del donante, grupo sanguíneo, factor Rh, institución generadora, código RND, causa de muerte, tiempos quirúrgicos (clampeo aórtico, paro cardíaco), gasometrías seriadas (pH, pO2, pCO2) y parámetros de laboratorio (creatinina, electrolitos).

Hasta el Sprint 09, el diligenciamiento de cada anexo operaba de forma aislada, o bien dependía exclusivamente de precargas estáticas de `DonorRecord` (`writable: false`). El coordinador o médico asistencial debía transcribir manualmente los mismos datos en cada formato, aumentando el riesgo de errores clínicos, discrepancias médico-legales y tiempos muertos en quirófano.

Además, los documentos deben poder diligenciarse desde el minuto cero del operativo, incluso antes de que el hospital emisor digitalice o entregue una historia clínica física. Posteriormente, cuando se carguen historias clínicas o soportes paraclínicos, OCR e IA podrán extraer valores candidatos, pero estos deben integrarse al mismo canal unificado tras la confirmación humana.

## Decisiones de Arquitectura

### 1. Desacoplamiento y Alcance de Datos (`Scope`)
Para garantizar la integridad y evitar duplicaciones ficticias o sobreescrituras descontroladas, se definen tres niveles de alcance ontológico:

| Alcance (`Scope`) | Entidad Propietaria (Fuente de Verdad) | Descripción y Ciclo de Vida | Ejemplos |
|---|---|---|---|
| `DONOR` | `DonorRecord` | Datos identitarios y biológicos inherentes a la persona donante. Persisten más allá del operativo concreto. La fuente de verdad reside en `DonorRecord`. Al actualizarse con autorización, sincroniza `DonorRecord` y las instancias que lo enlazan. | `donor.identity.full_name`, `donor.identity.document_number`, `donor.clinical.blood_group`, `donor.clinical.rh_factor`, `donor.demographics.sex`. |
| `PROCESS` | `DonationProcess` (`ProcessCanonicalValue`) | Parámetros circunstanciales, tiempos quirúrgicos, asignaciones institucionales y mediciones temporales generadas durante el operativo de donación. Su ámbito es el proceso concreto. | `donor.clinical.arterial_ph`, `donor.clinical.creatinine`, `process.recovery.aortic_clamp_at`, `donor.institution.originating_ips`. |
| `DOCUMENT` | `DocumentInstance` | Respuestas exclusivas y específicas de un anexo particular. No tienen significado transversal fuera de su formato y nunca se propagan a otros documentos. | Observaciones textuales del instrumentador, checklist de empaque, campos auxiliares de formato. |

### 2. Cardinalidad y Tratamiento Temporal (`Cardinality`)
Se reconocen dos clases funcionales de información:
1. **Valores Únicos Vigentes (`cardinality: "SINGLE"`):**
   - Conceptos donde rige una única verdad canónica activa por proceso o donante.
   - Cada actualización genera una nueva revisión en `PROCESS_CANONICAL_HISTORY` con control de concurrencia optimista (`versionNumber`), conservando el valor vigente en `PROCESS_CANONICAL_VALUE`.
2. **Observaciones y Mediciones Seriadas (`cardinality: "REPEATABLE"`):**
   - Mediciones que evolucionan en el tiempo (gasometrías arteriales, creatininas, signos vitales, administración de fármacos).
   - **Regla inmutable:** Nunca se sobreescribe una medición histórica. Cada registro conserva su marca temporal (`effectiveAt`), contexto de muestra (`sampleContext`, ej. "Gasometría basal", "Control 2h post-inotropo"), unidad de medida y fuente.
   - Las plantillas que requieran un valor concreto deben declarar su estrategia de selección explícita (`LATEST`, `EARLIEST`, `MATCH_SAMPLE`), sin sustituir datos arbitrariamente.

### 3. Políticas de Enlace (`BindingPolicy`)
Cada campo en `mappingConfig` de una plantilla declara su política de comportamiento:
- **`SHARED`:** La edición autorizada en cualquier instancia vinculada valida y actualiza el valor canónico, propagándose automáticamente a todas las instancias abiertas y editables del mismo proceso que compartan el mismo `canonicalFieldKey`.
- **`COPY_ONCE`:** El valor canónico vigente se precarga al inicializar el borrador de la instancia. Modificaciones posteriores en el formulario permanecen locales a ese documento y no alteran la fuente canónica ni otros documentos.
- **`LOCAL`:** Campo estrictamente local al documento (`scope: DOCUMENT`).
- **`READONLY_DERIVED`:** Campo derivado de solo lectura (cálculos matemáticos como IMC, balances hídricos o datos precargados inmutables como código RND). No es editable directamente por el usuario.

### 4. Reglas de Protección y Prevención de Conflictos en la Propagación
El motor de propagación (`CanonicalPropagationEngine`) opera bajo reglas estrictas de seguridad clínica y jurídica:
1. **Inmutabilidad de Documentos Cerrados:** Nunca se propaga ni sobreescribe un documento en estado `COMPLETADO` o `FIRMADO`. Sus snapshots y firmas permanecen inalterables.
2. **Detección de Divergencias:** Si un documento destino abierto ya contiene un valor local previo distinto del valor canónico propuesto, el sistema **no sobreescribe silenciosamente**. Se genera un conflicto (`conflictStatus: "CONFLICT_DETECTED"`) y se ofrece al coordinador las opciones de resolución:
   - `ACCEPT_CANDIDATE`: Acepta el nuevo valor canónico propuesto.
   - `KEEP_CURRENT`: Mantiene el valor actual de la instancia.
   - `MANUAL_OVERRIDE`: Introduce un valor rectificado con justificación obligatoria.
3. **Instancias Futuras:** Si un anexo aún no ha sido iniciado por el coordinador, el motor **no crea instancias ficticias anticipadas**. El valor canónico permanece resguardado en `ProcessCanonicalValue` y se precarga de forma limpia en el momento en que el usuario decida iniciar el borrador.
4. **Idempotencia y Anti-Ciclos:** La propagación identifica instancias destino exactas y no genera eventos recursivos de retro-propagación.

### 5. Trazabilidad de Procedencia (`DocumentFieldProvenance`)
Cada dato registrado mediante el motor canónico almacena su trazabilidad:
- `sourceKind`: `MANUAL` (ingreso directo en formulario), `PROCESS_CANONICAL` (recibido por propagación), `DONOR_RECORD` (maestro biológico), `OCR_CONFIRMED` (ratificado tras escaneo), `CALCULATED`.
- Instancia y revisión de origen, usuario actuante, fecha/hora y número de versión canónica.

## Consecuencias
- **Positivas:**
  - Diligenciamiento una sola vez de datos comunes entre los 23 anexos.
  - Reducción drástica de discrepancias en nombres, documentos, horas de clampeo, gasometrías y resultados serológicos.
  - Total independencia de la disponibilidad previa de historias clínicas (funciona 100% manual desde el inicio).
  - Trazabilidad y auditoría forense inalterable requerida para procesos de donación y trasplante.
- **Riesgos y Mitigaciones:**
  - *Riesgo:* Sobreescritura involuntaria de campos específicos en formularios ya avanzados.
  - *Mitigación:* Regla de protección contra sobreescritura silenciosa y generación explícita de conflictos auditados.

