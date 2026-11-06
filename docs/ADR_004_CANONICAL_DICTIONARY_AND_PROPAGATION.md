# ADR 004: Diccionario Canónico, Marcadores Compartidos, Propagación Documental y Endurecimiento de Trazabilidad Transaccional

## Estado
Aprobado y Endurecido (Fases C y C.1) — 2026-11-06

## Contexto
En el operativo de donación y trasplante de órganos y tejidos de la Regional 3, múltiples documentos normativos (Anexos 1 al 9 y sus variantes) solicitan información idéntica o equivalente: datos del donante, grupo sanguíneo, factor Rh, institución generadora, código RND, causa de muerte, tiempos quirúrgicos (clampeo aórtico, paro cardíaco), gasometrías seriadas (pH, pO2, pCO2) y parámetros de laboratorio (creatinina, electrolitos).

Hasta el Sprint 09, el diligenciamiento de cada anexo operaba de forma aislada, o bien dependía exclusivamente de precargas estáticas de `DonorRecord` (`writable: false`). El coordinador o médico asistencial debía transcribir manualmente los mismos datos en cada formato, aumentando el riesgo de errores clínicos, discrepancias médico-legales y tiempos muertos en quirófano.

Además, los documentos deben poder diligenciarse desde el minuto cero del operativo, incluso antes de que el hospital emisor digitalice o entregue una historia clínica física. Posteriormente, cuando se carguen historias clínicas o soportes paraclínicos, OCR e IA podrán extraer valores candidatos, pero estos deben integrarse al mismo canal unificado tras la confirmación humana.

En la Fase C.1 se identificaron necesidades críticas de endurecimiento:
1. Las mediciones clínicas seriadas (`REPEATABLE`) no podían sobreescribir silenciosamente borradores de anexos redactados en diferentes momentos del proceso clínico.
2. Era necesario garantizar la consistencia transaccional del donante biológico (`DonorRecord`) entre procesos independientes.
3. Se requería auditoría forense inmutable de divergencias clínicas (`CANONICAL_CONFLICT_DETECTED` y `CANONICAL_CONFLICT_RESOLVED`) con justificación obligatoria.
4. Concurrencia optimista y prevención de colisiones en PostgreSQL real.

---

## Decisiones de Arquitectura

### 1. Desacoplamiento y Alcance de Datos (`Scope`)
Para garantizar la integridad y evitar duplicaciones ficticias o sobreescrituras descontroladas, se definen tres niveles de alcance ontológico:

| Alcance (`Scope`) | Entidad Propietaria (Fuente de Verdad) | Descripción y Ciclo de Vida | Ejemplos |
|---|---|---|---|
| `DONOR` | `DonorRecord` | Datos identitarios y biológicos inherentes a la persona donante. Persisten más allá del operativo concreto. La fuente de verdad reside en `DonorRecord`. Al actualizarse con autorización, sincroniza atómicamente `DonorRecord` y las instancias que lo enlazan. | `donor.identity.full_name`, `donor.identity.document_number`, `donor.clinical.blood_group`, `donor.clinical.rh_factor`, `donor.demographics.sex`. |
| `PROCESS` | `DonationProcess` (`ProcessCanonicalValue`) | Parámetros circunstanciales, tiempos quirúrgicos, asignaciones institucionales y mediciones temporales generadas durante el operativo de donación. Su ámbito es el proceso concreto. | `donor.clinical.arterial_ph`, `donor.clinical.creatinine`, `process.recovery.aortic_clamp_at`, `donor.institution.originating_ips`. |
| `DOCUMENT` | `DocumentInstance` | Respuestas exclusivas y específicas de un anexo particular. No tienen significado transversal fuera de su formato y nunca se propagan a otros documentos. | Observaciones textuales del instrumentador, checklist de empaque, campos auxiliares de formato. |

### 2. Cardinalidad y Tratamiento de Mediciones Repetibles (`REPEATABLE`)
Se reconocen dos clases funcionales de información:
1. **Valores Únicos Vigentes (`cardinality: "SINGLE"`):**
   - Conceptos donde rige una única verdad canónica activa por proceso o donante.
   - Cada actualización genera una nueva revisión en `PROCESS_CANONICAL_HISTORY` con control de concurrencia optimista (`versionNumber` / `expectedVersion`), conservando el valor vigente en `PROCESS_CANONICAL_VALUE`.
2. **Observaciones y Mediciones Seriadas (`cardinality: "REPEATABLE"`):**
   - Mediciones que evolucionan en el tiempo (gasometrías arteriales, creatininas, signos vitales, administración de fármacos).
   - **Regla Inmutable:** Cada registro se persiste en `PROCESS_CANONICAL_HISTORY` de forma estrictamente append-only conservando: marca temporal (`effectiveAt`), contexto de muestra (`sampleContext`, ej. "Gasometría basal", "Control 2h post-inotropo"), unidad de medida y usuario actuante (`created_by_id`).
   - **Prevención de Sobreescritura Silenciosa:** Un nuevo reporte de gasometría en quirófano a las 14:00 NO muta silenciosamente un Anexo 1 abierto que documenta el ingreso a UCI de horas previas.
   - **Estrategias de Selección:** Las plantillas configuran explícitamente:
     - `SAMPLE_CONTEXT_MATCH`: Coincidencia exacta con la muestra esperada.
     - `DETERMINISTIC_RULE`: Regla parametrizada (ej. `BASELINE`).
     - `MANUAL_SELECTION`: Requiere selección manual del profesional desde la lista de observaciones disponibles; prohíbe precarga ciega.

### 3. Políticas de Enlace (`BindingPolicy`)
Cada campo en `mappingConfig` de una plantilla declara su política de comportamiento:
- **`SHARED`:** La edición autorizada en cualquier instancia vinculada valida y actualiza el valor canónico, propagándose automáticamente a todas las instancias abiertas y editables del mismo proceso que compartan el mismo `canonicalFieldKey`.
- **`COPY_ONCE`:** El valor canónico vigente se precarga al inicializar el borrador de la instancia. Modificaciones posteriores en el formulario permanecen locales a ese documento y no alteran la fuente canónica ni otros documentos.
- **`LOCAL`:** Campo estrictamente local al documento (`scope: DOCUMENT`).
- **`READONLY_DERIVED`:** Campo derivado de solo lectura (cálculos matemáticos como IMC, balances hídricos o datos precargados inmutables como código RND). No es editable directamente por el usuario.

### 4. Reglas de Protección y Prevención de Conflictos en la Propagación
El motor de propagación (`CanonicalPropagationEngine`) opera bajo reglas estrictas de seguridad clínica y jurídica:
1. **Inmutabilidad de Documentos Cerrados:** Nunca se propaga ni sobreescribe un documento en estado `COMPLETADO` o `FIRMADO`. Sus snapshots y firmas permanecen inalterables (`SKIPPED_LOCKED`).
2. **Detección y Auditoría Forense de Divergencias:** Si un documento destino abierto ya contiene un valor local previo distinto del valor canónico propuesto, el sistema **no sobreescribe silenciosamente**. Se emite un evento de auditoría `CANONICAL_CONFLICT_DETECTED` y se marca el registro en `CONFLICT_DETECTED`.
3. **Resolución Transaccional con Justificación Obligatoria:** La resolución de un conflicto mediante `ResolveCanonicalConflictUseCase` exige justificación clínica o administrativa obligatoria y emite `CANONICAL_CONFLICT_RESOLVED` con metadata forense completa:
   - `ACCEPT_CANDIDATE`: Acepta el nuevo valor propuesto, actualizando la instancia y registrando procedencia con `resolutionStrategy: "ACCEPT_CANDIDATE"`.
   - `KEEP_CURRENT`: Conserva el valor local actual de la instancia, registrando procedencia con `resolutionStrategy: "KEEP_CURRENT"`.
   - `MANUAL_OVERRIDE`: Introduce un valor rectificado por el profesional con justificación registrada.
4. **Instancias Futuras:** Si un anexo aún no ha sido iniciado por el coordinador, el motor **no crea instancias ficticias anticipadas**. El valor canónico permanece resguardado en `ProcessCanonicalValue` y se precarga de forma limpia en el momento en que el usuario inicie el borrador.
5. **Idempotencia y Anti-Ciclos:** La propagación identifica instancias destino exactas y no genera eventos recursivos de retro-propagación.

### 5. Control de Concurrencia Optimista e Idempotencia en PostgreSQL
1. **Concurrencia Optimista (`expectedVersion`):** En `upsertProcessValue`, si el cliente especifica `expectedVersion` y no coincide con la versión existente en PostgreSQL, la transacción se aborta con error `CanonicalConcurrencyError`, evitando carreras de datos entre múltiples profesionales.
2. **Idempotencia por Reintento:** Si un reintento de red envía exactamente los mismos datos (`value` y `sourceRevisionId`), el repositorio retorna el registro actual sin incrementar versiones innecesarias.

---

## Consecuencias y Verificación
- **100% de Pruebas de Integración PostgreSQL:** 12 escenarios de integración ejecutados y verificados directamente contra la base de datos real en Docker (`test/canonical-postgres-integration.spec.ts`).
- **87 pruebas automáticas totales del backend pasando satisfactoriamente.**
- **Cero suposiciones sobre posiciones 20 a 23:** Marcadas explícitamente como `PENDING_HOMOLOGATION` hasta su formalización normativa.
