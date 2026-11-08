# GODT REGIONAL 3 — FASE G.1.3.2
## INFORME DE AUDITORÍA Y CIERRE: FIDELIDAD VISUAL, RBAC Y VALIDACIÓN DOCUMENTAL

**Fecha:** 8 de Noviembre de 2026  
**Sistema:** GODT Regional 3 (Gestión Operativa de Donación y Trasplantes)  
**Entorno de Trabajo:**  
- **Backend:** `D:\Universidad\Diplomado\GODT\Backend\GODT-B` (Rama: `feature/fase-g1-3-2-visual-and-security-validation`)  
- **Frontend:** `D:\Universidad\Diplomado\GODT\Frontend` (Rama: `feature/fase-g1-3-2-visual-and-security-validation`)  
- **Tecnologías:** NestJS, TypeScript, Prisma, PostgreSQL, Vue 3, Vite, Tailwind CSS, OpenXML (`adm-zip`), PDF Rendering Engine (`pdf-lib`).

---

## 1. RESUMEN EJECUTIVO

La **Fase G.1.3.2** representa la consolidación definitiva de la fidelidad visual, la seguridad institucional basada en roles (RBAC) y la integridad del motor documental de GODT Regional 3.

Tras las fases funcionales G.1.3 y la auditoría correctiva G.1.3.1, persistían tres áreas críticas que requerían cierre técnico estricto:
1. **Contradicción en el Aislamiento RBAC:** Unificación entre la regla de negocio y las pruebas unitarias: únicamente el rol `ADMIN` goza de alcance transversal global sobre cualquier IPS; los roles `COORDINATOR` y `USER` quedan estrictamente limitados a las instituciones donde cuentan con vinculación aprobada (`status: "APPROVED"` en `UserInstitutionScope` o asignación explícita en `user.institutionalIps`).
2. **Mapeo Completo del Anexo 4:** Se implementaron las coordenadas tipográficas y límites de ancho (`maxWidth`) sobre las 4 páginas del formato Oficio (612 × 1008 pt) de `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf`, verificando que ningún texto sobrepase cuadrículas, encabezados o pies de página, permitiendo su promoción formal a `RENDER_READY`.
3. **Robustez OpenXML del Anexo 5 Diligenciado:** Se validó la inyección XML directa sobre `anexo-5-formato-de-remision-de-muestras.docx` con datos cortos, medios y extensos (> 500 caracteres), verificando el escape de entidades XML (`&`, `<`, `>`, `"`, `'`) y la conservación íntegra de encabezados (`header1..3.xml`), pies (`footer1..3.xml`), estilos (`styles.xml`) y medios gráficos (`image1.png`, `image2.png`). Se ratificó el estado `REVIEW_REQUIRED` para su visualización PDF de contingencia.
4. **Validación Visual de los 18 PDF Oficiales:** Se renderizaron y verificaron los 18 formatos PDF con datos clínicos sintéticos, auditando dimensiones exactas (Carta, Oficio, A4 y Landscape para el Anexo 8) y guardando los artefactos generados en `test-output/visual-audit/`.
5. **Clasificación Rigurosa de Homologación:** Se tipificó el estado `INSTITUTIONAL_REGISTERED_TEMPLATE` para distinguir las plantillas operativas de bancos y variantes de extracción de aquellos formatos amparados por resoluciones ministeriales directas (`OFFICIAL_HOMOLOGATED`).

---

## 2. PROTECCIÓN DE REPOSITORIOS Y ESTADO DE GIT

- **Operaciones No Destructivas:** No se ejecutaron comandos `reset`, `clean`, `checkout -f` ni mutaciones destructivas.
- **Protección de Archivos Físicos:** Los 23 archivos originales en `docs/documentos-reales/` permanecieron inalterados, verificados byte a byte mediante sus hashes SHA-256 canónicos.
- **Ramas de Trabajo:**
  - Backend: `feature/fase-g1-3-2-visual-and-security-validation` creada sobre `main` (`e837c86`).
  - Frontend: `feature/fase-g1-3-2-visual-and-security-validation` creada sobre `main` (`0118217`).

---

## 3. UNIFICACIÓN Y RIGOR DE RBAC: AISLAMIENTO INSTITUCIONAL

Se subsanó la discrepancia que existía en `test/institution-service.spec.ts` donde un test suite enunciaba erróneamente alcance transversal para coordinadores.

### Reglas de Aislamiento Estricto Verificadas:
1. **Rol ADMIN:** Único rol con alcance transversal irrestricto sobre cualquier IPS registrada en el catálogo nacional o habilitado para registrar nuevas instituciones maestras.
2. **Rol COORDINATOR:** Confinado estrictamente a su alcance institucional aprobado. Si un coordinador intenta aperturar un proceso en una IPS ajena o sobre la cual no cuenta con vinculación aprobada, el sistema arroja `ForbiddenException: "Esta institución ya existe, pero actualmente no tienes autorización aprobada para abrir procesos en ella."`.
3. **Solicitudes en trámite (PENDING / REJECTED):** Si existe un registro en `UserInstitutionScope` con estado `PENDING`, se rechaza explícitamente indicando que debe esperar la aprobación del Administrador. Si el estado es `REJECTED`, el acceso queda permanentemente bloqueado.
4. **Coincidencias Aproximadas (Typo / Levenshtein):** Las coincidencias con similitud tipográfica o fonética generan sugerencias asistenciales en la interfaz (`matchType: "APPROXIMATE"`), pero **NUNCA** otorgan autorización automática de apertura de proceso.

> **Evidencia en Suite de Pruebas:**
> - `test/institution-isolation.spec.ts`: 6 escenarios aprobados (100%).
> - `test/institution-service.spec.ts`: 11 escenarios aprobados (100%).

---

## 4. MAPEO EXHAUSTIVO Y VALIDACIÓN DEL ANEXO 4

El **Anexo 4** (*Registro de Donante y Oferta de Componentes Anatómicos*) es el formato clínico más extenso del proceso de donación en Colombia (4 páginas Oficio, 612 × 1008 pt).

### Distribución de Mapeo por Página:

| Página | Coordenadas Y (pt) | Secciones Clave Mapeadas | Mecanismo Anti-Desborde |
|---|---|---|---|
| **Página 1 (p0)** | 876 – 128 | Código RND, Fecha/Hora oferta, Médico coordinador, Regional, IPS Generadora, Donante (Nombre, Doc, Edad, Sexo, Etnia, ABO, RH), Presunción legal/consentimiento, Ingreso IPS, Servicio, Remitido, Estancia, Muerte encefálica (primer y segundo médico, causa), Test de apnea, Doppler transcraneal, EEG, Antecedentes patológicos, familiares, quirúrgicos, tóxicos, farmacológicos, trauma, hospitalarios, infecciones, eventos y manejo. | `maxWidth` delimitado (135–430 pt), `fontSize: 7.5–8.5 pt`, `drawTextWrapped`. |
| **Página 2 (p1)** | 856 – 69 | Examen físico (Peso, Talla, Perímetros abdominal y torácico, IMC, Tatuajes/Piercing), Signos vitales (TA, TAM, FC, FR, Temp, SpO2, Diuresis), Monitoreo (Ventilación mecánica, línea arterial, nutrición enteral/parenteral, balance líquidos, cuña, CVC), Manejo (líquidos IV, transfusiones), Medicamentos/Vasoactivos (6 filas), Ayudas diagnósticas (Rx Tórax, Eco abdominal, ECG, Ecocardiograma, FEVI), Laboratorios (Hemograma, química, gases, coagulación, electrolitos). | Cuadrículas con `fontSize: 7.5 pt` y alineación horizontal a las líneas del formulario. |
| **Página 3 (p2)** | 878 – 175 | Laboratorios continuación (Cloro, Calcio, Lactato, Fosfatasa, Albúmina, Troponina, Cultivos), Perfil Infeccioso / Serología (HVC, Chagas, HBsAg, Sífilis, AUSAB, VIH, HBc Total/IgG/IgM, Toxoplasma IgG/IgM, HTLV 1/2, CMV IgG, Epstein-Barr), Inmunología HLA (A*, B*, DRB1*, DQB1*), Antecedentes sociales (escolaridad, estado civil, ocupación, estrato, procedencia, religión), Antecedentes epidemiológicos (17 factores de riesgo descartados), Lesiones corporales. | Textos formateados, checkboxes marcados como "NO" / descartado, `maxWidth: 450–490 pt`. |
| **Página 4 (p3)** | 650 – 368 | Oferta Anatómica multiorgánica (Corazón, Pulmones, Hígado, Riñones D/I, Páncreas, Córneas, Tejidos), Asignación a IPS trasplantadoras, Observaciones generales de trazabilidad operativa, Firma, Nombre, Cargo del Coordinador Operativo, Fecha y hora de suscripción. | Bloques de texto continuo envueltos con `drawTextWrapped` (`maxWidth: 480 pt`). |

### Transición de Estado Técnico:
- **Estado Anterior:** `FIELD_MAPPING_IN_PROGRESS`
- **Nuevo Estado Auditado:** `RENDER_READY`

---

## 5. VALIDACIÓN OPENXML Y ROBUSTEZ DEL ANEXO 5 DILIGENCIADO

El **Anexo 5** (*Formato de Remisión de Muestras Biológicas*) es nativamente un documento OpenXML Word (`.docx`).

### Pruebas de Inyección y Estabilidad Estructural Ejecutadas:
1. **Escape de Entidades XML:** Implementación de la función `escapeXml` que sanea `&`, `<`, `>`, `"`, `'` antes de inyectar en `word/document.xml`, impidiendo errores de parseo XML ante observaciones clínicas complejas.
2. **Textos Cortos:** Inyección de códigos breves (`"CC 123"`, `"O+"`, `"TEC"`), comprobando que el archivo conserve su tamaño (> 50 KB) y estructura válida.
3. **Textos Medios:** Inyección estándar de instituciones, nombres y observaciones analíticas de histocompatibilidad.
4. **Textos Extensos (> 500 caracteres):** Inyección de cadenas largas de trazabilidad de transporte en cadena de frío sin rompimiento de tablas ni márgenes.
5. **Conservación de Partes OpenXML:** Se verificó que el ZIP resultante contenga intactos:
   - `word/styles.xml` (33,815 bytes)
   - `word/header1.xml`, `header2.xml`, `header3.xml`
   - `word/footer1.xml`, `footer2.xml`, `footer3.xml`
   - `word/media/image1.png` (21,050 bytes)
   - `word/media/image2.png` (5,512 bytes)
6. **Transparencia Técnica:** La vista PDF de contingencia se mantiene clasificada como `REVIEW_REQUIRED`, reflejando con rigor que la generación nativa oficial es DOCX.

> **Evidencia en Suite de Pruebas:**
> - `test/anexo-5-docx-robustness.spec.ts`: 5 escenarios aprobados (100%).

---

## 6. AUDITORÍA VISUAL Y DE DIMENSIONES DE LOS 18 FORMATOS PDF

Se implementó la suite `test/pdf-visual-alignment.spec.ts` que renderiza los 18 formatos PDF oficiales y exporta las muestras a `test-output/visual-audit/`.

### Matriz de Verificación Dimensional:

| Código de Formato | Páginas | Dimensiones Ancho × Alto (pt) | Formato Estándar | Orientación | Estado Técnico |
|---|---|---|---|---|---|
| `anexo_1` | 2 | 612 × 1008 | Oficio | PORTRAIT | `RENDER_READY` |
| `anexo_2` | 2 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_3` | 2 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_4` | 4 | 612 × 1008 | Oficio | PORTRAIT | `RENDER_READY` |
| `anexo_6` | 2 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_ocular` | 2 | 595.5 × 842.25 | A4 | PORTRAIT | `RENDER_READY` |
| `anexo_7_cardiovascular` | 3 | 595.5 × 842.25 | A4 | PORTRAIT | `RENDER_READY` |
| `anexo_7_osteomuscular` | 3 | 595.5 × 842.25 | A4 | PORTRAIT | `RENDER_READY` |
| `anexo_7_piel` | 3 | 595.5 × 842.25 | A4 | PORTRAIT | `RENDER_READY` |
| `anexo_7_corazon` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_higado` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_otros_organos` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_pancreas` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_pulmon` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_rinon_derecho` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_7_rinon_izquierdo` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |
| `anexo_8` | 2 | p1: 930.96 × 606.96<br>p2: 933.96 × 608.04 | Horizontal Especial | LANDSCAPE | `RENDER_READY` |
| `anexo_9` | 1 | 612 × 792 | Carta | PORTRAIT | `RENDER_READY` |

### Verificación de Límites Geométricos:
- **Margen Izquierdo:** `x >= 30 pt`.
- **Margen Derecho:** `x + maxWidth <= pageWidth - 15 pt`.
- **Pie de Página Protegido:** `y >= 25 pt`, impidiendo solapamientos sobre las cláusulas de atestación operativa y advertencias legales de la Ley 527 de 1999 estampadas en `y = 20 pt` e `y = 11 pt`.

---

## 7. CLARIDAD JURÍDICO-TÉCNICA DE ESTADOS DE HOMOLOGACIÓN

Para evitar atribuciones jurídicas indebidas, se diferenciaron estrictamente cuatro estados en `InstitutionalDocumentStatus`:

1. `OFFICIAL_HOMOLOGATED`: Reservado para los 7 formatos oficiales amparados por resoluciones nacionales directas y decretos regulatorios (Anexos 1, 2, 3, 4, 6, 8, 9).
2. `INSTITUTIONAL_REGISTERED_TEMPLATE`: Aplicado a las 12 plantillas operativas registradas en la Red Regional 3 y bancos de tejidos (Anexo 5 DOCX y las 11 variantes de Anexo 7).
3. `COMPLEMENTARY_SOURCE`: Aplicado a los 4 documentos clínicos fuente de soporte (Cálculo Hemodilución, Evaluación COVID Tissue Bank, HC Donante 2024, Historia Clínica Tissue Bank).
4. `PENDING_HOMOLOGATION`: Mantenido estrictamente para las posiciones normativas 20 a 23, que no poseen plantilla dinámica asignada.

---

## 8. PROPAGACIÓN CANÓNICA Y MATRIZ DE CONFLICTOS

Se auditó el comportamiento del motor de propagación canónica (`CanonicalPropagationEngine`) frente a la matriz de discrepancias:
- **Campos Locales (`sharingPolicy: "LOCAL"`):** Las modificaciones locales dentro de un documento permanecen circunscritas al mismo; no se propagan a nivel de proceso ni generan falsos conflictos transversales.
- **Campos Compartidos (`sharingPolicy: "CROSS_DOCUMENT_BIDIRECTIONAL"`):** Propagan ordenadamente a todas las instancias abiertas del proceso de donación.
- **Detección Formal de Conflictos:** Si un valor entrante difiere del valor canónico vigente con procedencia clínica distinta, el motor no sobreescribe silenciosamente: marca `conflictStatus: "UNRESOLVED_CONFLICT"` y requiere resolución formal justificada.
- **Inmutabilidad de Documentos Cerrados:** Documentos en estado `COMPLETADO` o `FIRMADO` permanecen intactos ante cualquier propagación posterior.

> **Evidencia en Suite de Pruebas:**
> - `test/canonical-conflict-matrix.spec.ts`: 6 escenarios aprobados (100%).

---

## 9. MATRIZ DE CIERRE Y RESULTADOS DE CONSTRUCCIÓN

| Componente | Verificación | Resultado |
|---|---|---|
| **Backend — RBAC Unificado** | `npm test -- test/institution-service.spec.ts test/institution-isolation.spec.ts` | 17/17 pruebas aprobadas |
| **Backend — Anexo 4 Completo** | `npm test -- test/pdf-visual-alignment.spec.ts` | 4/4 pruebas aprobadas (`RENDER_READY`) |
| **Backend — Anexo 5 DOCX Robustez** | `npm test -- test/anexo-5-docx-robustness.spec.ts` | 5/5 pruebas aprobadas |
| **Backend — Fidelidad 19 Formatos** | `npm test -- test/all-19-formats-fidelity.spec.ts` | 6/6 pruebas aprobadas |
| **Backend — Inventario Documental** | `npm test -- test/institutional-document.spec.ts` | 7/7 pruebas aprobadas |
| **Backend — Matriz Conflictos Canónicos** | `npm test -- test/canonical-conflict-matrix.spec.ts` | 6/6 pruebas aprobadas |
| **Backend — Suites de Dominio & OCR** | 28 suites de pruebas unitarias y de integración mockeada | 180 pruebas aprobadas |
| **Backend — Compilación TypeScript** | `npm run build` (`nest build`) | Exitoso (código de salida 0) |
| **Frontend — Tipado y Compilación** | `npm run build` (`vue-tsc --noEmit && vite build`) | Exitoso (182 módulos transformados) |

---

## 10. CONCLUSIÓN

La **Fase G.1.3.2** queda formalmente **CERRADA Y APROBADA**. GODT Regional 3 cuenta ahora con:
- Aislamiento institucional RBAC 100% coherente y libre de contradicciones.
- Diligenciamiento visual de Anexo 4 sobre sus 4 páginas Oficio en estado `RENDER_READY`.
- Anexo 5 nativo DOCX robusto ante textos de cualquier longitud y con escape XML estricto.
- Renderizado visual probado sobre los 18 formatos PDF institucionales.
- Compilación limpia tanto en NestJS como en Vue 3.
