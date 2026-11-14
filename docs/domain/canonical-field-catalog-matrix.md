# Matriz Técnica de Homologación de Marcadores Canónicos — GODT Regional 3 (Fase C.1)

## 1. Principios de Homologación y Correspondencia Técnica

1. **Equivalencia Semántica Real:** No se homologan campos por mera coincidencia de nombre o etiqueta si el contexto clínico diverge (ej. creatinina basal de ingreso vs creatinina de quirófano post-reanimación).
2. **Desacoplamiento de Alcance (`Scope`):** Se separa lo propio del individuo biológico (`DONOR` — sincronizado transaccionalmente con `DonorRecord`) de lo circunstancial del operativo (`PROCESS` — circunscrito a `ProcessCanonicalValue`).
3. **Estrategia Temporal para Magnitudes Seriadas (`cardinality: "REPEATABLE"`):** Las magnitudes clínicas seriadas nunca se sobreescriben. Se persisten de forma append-only en `PROCESS_CANONICAL_HISTORY` con marca temporal (`effectiveAt`), contexto de muestra (`sampleContext`), unidad y usuario actuante.
4. **Estrategias de Selección No Silenciosa:** Cuando un formulario consume una magnitud repetible, aplica obligatoriamente una de tres estrategias:
   - `SAMPLE_CONTEXT_MATCH`: Coincidencia explícita con la etiqueta de muestra requerida (ej. "Gasometría Basal UCI").
   - `DETERMINISTIC_RULE`: Regla determinística parametrizada (ej. `BASELINE` o `WINDOW_HOURS`).
   - `MANUAL_SELECTION`: Prohibición de precarga ciega; requiere selección humana explícita del listado de observaciones disponibles.
5. **Estado de Homologación Oficial:** Cada posición documental declara si su esquema y plantilla están homologados (`VALIDATED`) o pendientes de especificación normativa (`PENDING_HOMOLOGATION`). Las posiciones 20 a 23 permanecen estrictamente como `PENDING_HOMOLOGATION`.

---

## 2. Catálogo Maestro de Marcadores Canónicos (16 Marcadores Activos)

| Marcador Canónico (`canonicalFieldKey`) | Nombre Visible | Tipo de Dato | Unidad | Alcance (`Scope`) | Cardinalidad | Política | Selección REPEATABLE | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `donor.identity.full_name` | Nombre Completo del Donante | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Texto no vacío, $\ge 3$ caracteres |
| `donor.identity.document_number` | Número de Identificación | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Alfanumérico, sin puntos ni espacios |
| `donor.identity.document_type` | Tipo de Documento | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Enum: `CC`, `TI`, `CE`, `PA`, `RC`, `AS`, `MS` |
| `donor.identity.birth_date` | Fecha de Nacimiento | `date-time` | — | `DONOR` | `SINGLE` | `SHARED` | — | Formato ISO 8601, fecha en el pasado |
| `donor.demographics.sex` | Sexo Biológico | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Enum: `MASCULINO`, `FEMENINO`, `INTERSEX` |
| `donor.demographics.age` | Edad en Años | `number` | `años` | `DONOR` | `SINGLE` | `SHARED` | — | Entero positivo entre 0 y 120 |
| `donor.registration.rnd_code` | Código Consulta RND | `string` | — | `DONOR` | `SINGLE` | `READONLY_DERIVED` | — | Formato oficial RND-GODT |
| `donor.clinical.blood_group` | Grupo Sanguíneo (ABO) | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Enum: `A`, `B`, `AB`, `O` |
| `donor.clinical.rh_factor` | Factor Rh | `string` | — | `DONOR` | `SINGLE` | `SHARED` | — | Enum: `POSITIVO`, `NEGATIVO` |
| `donor.institution.originating_ips` | IPS Generadora / Origen | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | — | Texto no vacío, nombre institucional IPS |
| `donor.clinical.clinical_service` | Servicio Clínico de Origen | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | — | Texto no vacío (ej. "UCI Adultos", "Urgencias") |
| `donor.clinical.cause_of_death` | Causa de Muerte Encefálica | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | — | Texto diagnóstico CIE-10 o descripción médica |
| `donor.clinical.arterial_ph` | pH Arterial | `number` | `pH` | `PROCESS` | `REPEATABLE` | `SHARED` | `SAMPLE_CONTEXT_MATCH` / `MANUAL_SELECTION` | Número decimal entre 6.50 y 8.00 |
| `donor.clinical.creatinine` | Creatinina Sérica | `number` | `mg/dL` | `PROCESS` | `REPEATABLE` | `SHARED` | `SAMPLE_CONTEXT_MATCH` / `MANUAL_SELECTION` | Número decimal entre 0.10 y 30.00 |
| `process.recovery.aortic_clamp_at` | Fecha/Hora Clampeo Aórtico | `date-time` | — | `PROCESS` | `SINGLE` | `SHARED` | — | Formato ISO 8601, fecha/hora quirúrgica |
| `process.recovery.cardiac_arrest_at` | Fecha/Hora de Paro Cardíaco | `date-time` | — | `PROCESS` | `SINGLE` | `SHARED` | — | Formato ISO 8601, fecha/hora parada circulatoria |

---

## 3. Matriz Técnica de Correspondencia por Versión de Plantilla

### Posición 01: Anexo 1 — Notificación y Gestión Inicial
- **Código de Plantilla:** `ANEXO_1` / `anexo-1-notificacion-v1`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `paciente.nombresApellidos` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio, longitud $\ge 3$ |
| `paciente.numeroDocumento` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `paciente.tipoDocumento` | `donor.identity.document_type` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio, enum documento |
| `paciente.fechaNacimiento` | `donor.identity.birth_date` | `DONOR` | `SHARED` | `date-time` | — | `SINGLE` | — | Fecha válida en pasado |
| `paciente.sexo` | `donor.demographics.sex` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum sexo |
| `paciente.edad` | `donor.demographics.age` | `DONOR` | `SHARED` | `number` | `años` | `SINGLE` | — | $\ge 0$ |
| `registro.codigoRnd` | `donor.registration.rnd_code` | `DONOR` | `READONLY_DERIVED` | `string` | — | `SINGLE` | — | Solo lectura |
| `clinicos.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `clinicos.factorRh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `institucion.ipsOrigen` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `institucion.servicio` | `donor.clinical.clinical_service` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `clinicos.causaMuerte` | `donor.clinical.cause_of_death` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `paraclinicos.gasometriaBasal.ph` | `donor.clinical.arterial_ph` | `PROCESS` | `SHARED` | `number` | `pH` | `REPEATABLE` | `SAMPLE_CONTEXT_MATCH` ("Gasometría Basal UCI") | Entre 6.80 y 7.80 |
| `paraclinicos.quimica.creatinina` | `donor.clinical.creatinine` | `PROCESS` | `SHARED` | `number` | `mg/dL` | `REPEATABLE` | `SAMPLE_CONTEXT_MATCH` ("Creatinina Basal Ingreso") | Entre 0.20 y 25.00 |

---

### Posición 04: Anexo 4 — Evaluación y Oferta de Órganos y Tejidos
- **Código de Plantilla:** `ANEXO_4` / `anexo-4-evaluacion-oferta-v1`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `donante.nombreCompleto` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.identificacion` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.tipoId` | `donor.identity.document_type` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum documento |
| `donante.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `donante.rh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `donante.ipsRemitente` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.diagnosticoMuerte` | `donor.clinical.cause_of_death` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `laboratorios.ultimoPh` | `donor.clinical.arterial_ph` | `PROCESS` | `SHARED` | `number` | `pH` | `REPEATABLE` | `MANUAL_SELECTION` (Selección explícita de medición) | Entre 6.80 y 7.80 |
| `laboratorios.ultimaCreatinina` | `donor.clinical.creatinine` | `PROCESS` | `SHARED` | `number` | `mg/dL` | `REPEATABLE` | `MANUAL_SELECTION` (Selección explícita de medición) | Entre 0.20 y 25.00 |

---

### Posición 05: Anexo 5 — Asignación y Aceptación de Componentes
- **Código de Plantilla:** `ANEXO_5` / `anexo-5-asignacion-v1`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `donante.nombre` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.documento` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `donante.factorRh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `donante.ipsGeneradora` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |

---

### Posición 06: Anexo 6 — Acta de Extracción y Rescate de Componentes Anatómicos
- **Código de Plantilla:** `ANEXO_6` / `anexo-6-extraccion-componentes-v0`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `datosDonante.nombreCompleto` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `datosDonante.numeroIdentificacion` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `datosDonante.tipoIdentificacion` | `donor.identity.document_type` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum documento |
| `datosDonante.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `datosDonante.factorRh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `procedimiento.ipsGeneradora` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `procedimiento.causaMuerte` | `donor.clinical.cause_of_death` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `tiemposQuirurgicos.horaClampeoAortico` | `process.recovery.aortic_clamp_at` | `PROCESS` | `SHARED` | `date-time` | — | `SINGLE` | — | Fecha/hora ISO |
| `tiemposQuirurgicos.horaParoCardiaco` | `process.recovery.cardiac_arrest_at` | `PROCESS` | `SHARED` | `date-time` | — | `SINGLE` | — | Fecha/hora ISO |

---

### Posiciones 07 a 13: Anexo 7 — Fichas Quirúrgicas de Órganos (Corazón, Pulmón, Hígado, Riñón Der, Riñón Izq, Páncreas, Otros Órganos)
- **Códigos de Plantilla:** `ANEXO_7_CORAZON`, `ANEXO_7_PULMON`, `ANEXO_7_HIGADO`, `ANEXO_7_RINON_DERECHO`, `ANEXO_7_RINON_IZQUIERDO`, `ANEXO_7_PANCREAS`, `ANEXO_7_OTROS_ORGANOS`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `donante.nombreCompleto` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.identificacion` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `donante.factorRh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `quirurgico.clampeoAortico` | `process.recovery.aortic_clamp_at` | `PROCESS` | `SHARED` | `date-time` | — | `SINGLE` | — | ISO fecha/hora |
| `laboratorioPreoperatorio.creatinina` (Solo Riñón Der/Izq) | `donor.clinical.creatinine` | `PROCESS` | `SHARED` | `number` | `mg/dL` | `REPEATABLE` | `SAMPLE_CONTEXT_MATCH` ("Creatinina Pre-Quirúrgica") | Entre 0.20 y 25.00 |

---

### Posiciones 14 a 17: Anexo 7 — Fichas Quirúrgicas de Rescate de Tejidos (Ocular, Osteomuscular, Cardiovascular, Piel)
- **Códigos de Plantilla:** `ANEXO_7_TEJIDO_OCULAR`, `ANEXO_7_TEJIDO_OSTEO`, `ANEXO_7_TEJIDO_CARDIO`, `ANEXO_7_TEJIDO_PIEL`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `donante.nombreCompleto` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.identificacion` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `donante.grupoSanguineo` | `donor.clinical.blood_group` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum ABO |
| `donante.factorRh` | `donor.clinical.rh_factor` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Enum Rh |
| `procedimiento.horaParoCardiaco` | `process.recovery.cardiac_arrest_at` | `PROCESS` | `SHARED` | `date-time` | — | `SINGLE` | — | ISO fecha/hora |

---

### Posición 18: Anexo 8 — Lista de Chequeo y Verificación Documental
- **Código de Plantilla:** `ANEXO_8` / `anexo-8-lista-chequeo-v1`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `verificacion.nombreDonante` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `verificacion.identificacion` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `verificacion.ipsOrigen` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |

---

### Posición 19: Anexo 9 — Acta de Disposición y Destino Final
- **Código de Plantilla:** `ANEXO_9` / `anexo-9-disposicion-final-v1`
- **Estado de Homologación:** `VALIDATED`

| `schemaPath` | `canonicalFieldKey` | `scope` | `bindingPolicy` | `dataType` | `unit` | `cardinality` | `repeatableSelectionStrategy` | Regla de Validación |
|---|---|---|---|---|---|---|---|---|
| `disposicion.nombreDonante` | `donor.identity.full_name` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `disposicion.documento` | `donor.identity.document_number` | `DONOR` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `disposicion.ipsFallecimiento` | `donor.institution.originating_ips` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |
| `disposicion.causaDefuncion` | `donor.clinical.cause_of_death` | `PROCESS` | `SHARED` | `string` | — | `SINGLE` | — | Obligatorio |

---

## 4. Posiciones 20 a 23 — Declaración Expresa de Pendiente de Homologación

> [!WARNING]
> Las posiciones 20 a 23 forman parte de la estructura normativa de 23 posiciones del paquete de donación de la Regional 3. Sin embargo, sus plantillas digitales no se encuentran aprobadas ni publicadas oficialmente en el catálogo institucional. Por directriz de arquitectura de la Fase C.1, se registran formalmente con estado **`PENDING_HOMOLOGATION`**. No deben presentarse como esquemas validados ni activarse para diligenciamiento formal hasta agotar la mesa técnica con la Coordinación Regional.

| Posición | Código Lógico | Título Declarado | Categoría | Estado de Homologación | Plantilla Asociada | Mapeos Canónicos Reservados |
|---|---|---|---|---|---|---|
| **20** | `POSICION_20_PENDIENTE` | Posición 20 (Pendiente Homologación Técnica) | `COMPLEMENTARY` | `PENDING_HOMOLOGATION` | `null` | Reservado para `donor.identity.*`, `process.recovery.*` |
| **21** | `POSICION_21_PENDIENTE` | Posición 21 (Pendiente Homologación Técnica) | `COMPLEMENTARY` | `PENDING_HOMOLOGATION` | `null` | Reservado para `donor.identity.*`, `process.recovery.*` |
| **22** | `POSICION_22_PENDIENTE` | Posición 22 (Pendiente Homologación Técnica) | `COMPLEMENTARY` | `PENDING_HOMOLOGATION` | `null` | Reservado para `donor.identity.*`, `process.recovery.*` |
| **23** | `POSICION_23_PENDIENTE` | Posición 23 (Pendiente Homologación Técnica) | `COMPLEMENTARY` | `PENDING_HOMOLOGATION` | `null` | Reservado para `donor.identity.*`, `process.recovery.*` |

---

## 5. Resumen de Políticas de Propagación y Protección

1. **Campos con alcance `DONOR`:**
   - La verdad biológica reside exclusivamente en `DonorRecord`.
   - Toda actualización vía motor canónico se ejecuta dentro de una transacción que actualiza `DonorRecord` y emite `ProcessCanonicalHistory`.
   - Es transversal a través de procesos que involucren al mismo donante biológico.
2. **Campos con alcance `PROCESS`:**
   - Circunscritos estrictamente al `DonationProcess` en curso.
   - Dos donaciones del mismo donante en tiempos distintos (o donación multiorgánica vs tejidos diferida) no colisionan sus tiempos quirúrgicos ni sus gasometrías.
3. **Protección de Sellado:**
   - Cualquier documento en estado `COMPLETADO` o `FIRMADO` se omite de toda mutación automática (`SKIPPED_LOCKED`).
4. **Detección de Divergencias:**
   - Todo documento abierto que contenga un valor divergente entra en estado `CONFLICT_DETECTED`. Requiere justificación clínica y resolución explícita (`ACCEPT_CANDIDATE`, `KEEP_CURRENT`, `MANUAL_OVERRIDE`).
