# Matriz Homologada de Marcadores Canónicos — GODT Regional 3 (Fase C)

## 1. Principios de Homologación de Marcadores

1. **Equivalencia Semántica Real:** No se homologan campos por mera coincidencia de nombre o etiqueta si el contexto clínico diverge.
2. **Desacoplamiento de Alcance:** Se separa lo propio del individuo (`DONOR`) de lo circunstancial del operativo (`PROCESS`).
3. **Estrategia Temporal:** Las magnitudes clínicas seriadas (`REPEATABLE`) nunca se reemplazan; se conservan con fecha/hora efectiva y contexto de muestra.
4. **Independencia Documental:** Los campos compartidos pueden originarse en cualquier documento habilitado y alimentan la misma fuente canónica.

---

## 2. Catálogo Oficial de Marcadores Canónicos

| Marcador Canónico (`canonicalFieldKey`) | Nombre Visible | Tipo de Dato | Unidad | Alcance (`Scope`) | Cardinalidad | Política | Documentos que Comparten el Marcador |
|---|---|---|---|---|---|---|---|
| `donor.identity.full_name` | Nombre Completo del Donante | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 2, Anexo 3, Anexo 4, Anexo 5, Anexo 6, Anexo 7 (Todas las variantes), Anexo 8, Anexo 9 |
| `donor.identity.document_number` | Número de Documento de Identidad | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 2, Anexo 3, Anexo 4, Anexo 5, Anexo 6, Anexo 7 (Todas las variantes), Anexo 8, Anexo 9 |
| `donor.identity.document_type` | Tipo de Documento | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 2, Anexo 3, Anexo 4, Anexo 5, Anexo 6, Anexo 7, Anexo 8, Anexo 9 |
| `donor.identity.birth_date` | Fecha de Nacimiento | `date-time` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 6, Anexo 7 |
| `donor.demographics.sex` | Sexo Biológico | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 6, Anexo 7 |
| `donor.demographics.age` | Edad en Años | `number` | `años` | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 6, Anexo 7 (Órganos y Tejidos) |
| `donor.registration.rnd_code` | Código Consulta RND | `string` | — | `DONOR` | `SINGLE` | `READONLY_DERIVED` | Anexo 1, Anexo 2, Anexo 4, Anexo 6, Anexo 7, Anexo 8 |
| `donor.clinical.blood_group` | Grupo Sanguíneo (ABO) | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 5, Anexo 6, Anexo 7 (Órganos y Tejidos) |
| `donor.clinical.rh_factor` | Factor Rh | `string` | — | `DONOR` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 5, Anexo 6, Anexo 7 (Órganos y Tejidos) |
| `donor.institution.originating_ips` | IPS Generadora / Remitente | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | Anexo 1, Anexo 2, Anexo 4, Anexo 5, Anexo 6, Anexo 8, Anexo 9 |
| `donor.clinical.clinical_service` | Servicio Clínico de Origen | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4 |
| `donor.clinical.cause_of_death` | Causa de Muerte Encefálica | `string` | — | `PROCESS` | `SINGLE` | `SHARED` | Anexo 1, Anexo 4, Anexo 6, Anexo 7 (Fichas Quirúrgicas), Anexo 9 |
| `donor.clinical.arterial_ph` | pH Arterial | `number` | `pH` | `PROCESS` | `REPEATABLE` | `SHARED` | Anexo 1 (Monitoreo gasométrico), Anexo 4 (Laboratorios de oferta) |
| `donor.clinical.creatinine` | Creatinina Sérica | `number` | `mg/dL` | `PROCESS` | `REPEATABLE` | `SHARED` | Anexo 1 (Paraclínicos), Anexo 4 (Laboratorios), Anexo 7 (Nefrectomía Der/Izq) |
| `process.recovery.aortic_clamp_at` | Fecha/Hora Clampeo Aórtico | `date-time` | — | `PROCESS` | `SINGLE` | `SHARED` | Anexo 6 (Extracción general), Anexo 7 (Corazón, Hígado, Riñones, Pulmón, Páncreas) |
| `process.recovery.cardiac_arrest_at` | Fecha/Hora de Paro Cardíaco | `date-time` | — | `PROCESS` | `SINGLE` | `SHARED` | Anexo 6 (Extracción general), Anexo 7 (Actas de rescate de tejidos ocular, cardio, osteo, piel) |

---

## 3. Mapeo por Plantilla (Ejemplos de Referencia)

### Anexo 1 (`anexo_01`)
- `patient.fullName` $\rightarrow$ `donor.identity.full_name` (`SHARED`)
- `patient.idNumber` $\rightarrow$ `donor.identity.document_number` (`SHARED`)
- `clinical.bloodGroup` $\rightarrow$ `donor.clinical.blood_group` (`SHARED`)
- `clinical.rhFactor` $\rightarrow$ `donor.clinical.rh_factor` (`SHARED`)
- `clinical.causeOfDeath` $\rightarrow$ `donor.clinical.cause_of_death` (`SHARED`)
- `labs.arterialPh` $\rightarrow$ `donor.clinical.arterial_ph` (`SHARED`, `strategy: "LATEST"`)
- `labs.creatinine` $\rightarrow$ `donor.clinical.creatinine` (`SHARED`, `strategy: "LATEST"`)

### Anexo 4 (`anexo_04`)
- `donor.fullName` $\rightarrow$ `donor.identity.full_name` (`SHARED`)
- `donor.idNumber` $\rightarrow$ `donor.identity.document_number` (`SHARED`)
- `donor.bloodGroup` $\rightarrow$ `donor.clinical.blood_group` (`SHARED`)
- `donor.rhFactor` $\rightarrow$ `donor.clinical.rh_factor` (`SHARED`)
- `donor.causeOfDeath` $\rightarrow$ `donor.clinical.cause_of_death` (`SHARED`)
- `evaluation.arterialPh` $\rightarrow$ `donor.clinical.arterial_ph` (`SHARED`, `strategy: "LATEST"`)

### Anexo 6 (`anexo_06` / `anexo-6-extraccion-componentes-v0`)
- `datosDonante.nombreCompleto` $\rightarrow$ `donor.identity.full_name` (`SHARED`)
- `datosDonante.numeroIdentificacion` $\rightarrow$ `donor.identity.document_number` (`SHARED`)
- `datosDonante.grupoSanguineo` $\rightarrow$ `donor.clinical.blood_group` (`SHARED`)
- `datosDonante.factorRh` $\rightarrow$ `donor.clinical.rh_factor` (`SHARED`)
- `tiemposQuirurgicos.clampeoAortico` $\rightarrow$ `process.recovery.aortic_clamp_at` (`SHARED`)
- `tiemposQuirurgicos.paroCardiaco` $\rightarrow$ `process.recovery.cardiac_arrest_at` (`SHARED`)

### Anexo 7 Variantes de Órganos (Corazón, Hígado, Riñón Derecho, Riñón Izquierdo, etc.)
- `donante.nombre` $\rightarrow$ `donor.identity.full_name` (`SHARED`)
- `donante.identificacion` $\rightarrow$ `donor.identity.document_number` (`SHARED`)
- `procedimiento.horaClampeo` $\rightarrow$ `process.recovery.aortic_clamp_at` (`SHARED`)
- `laboratorios.creatininaPreRescate` $\rightarrow$ `donor.clinical.creatinine` (`SHARED`, solo en fichas renales)

### Anexo 7 Variantes de Tejidos (Ocular, Cardio, Osteo, Piel)
- `donante.nombre` $\rightarrow$ `donor.identity.full_name` (`SHARED`)
- `donante.identificacion` $\rightarrow$ `donor.identity.document_number` (`SHARED`)
- `procedimiento.horaParoCardiaco` $\rightarrow$ `process.recovery.cardiac_arrest_at` (`SHARED`)

