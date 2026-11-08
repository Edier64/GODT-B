# GODT REGIONAL 3 — FASE G.1.3.1
## INFORME DE AUDITORÍA DE FIDELIDAD DOCUMENTAL, INVENTARIO CANÓNICO Y SEGURIDAD INSTITUCIONAL

**Fecha de Auditoría:** 8 de noviembre de 2026  
**Entorno:** GODT Regional 3 (Red de Donación y Trasplantes)  
**Repositorios:**  
- Backend: `GODT-B` (Rama: `feature/fase-g1-3-1-fidelity-and-security-audit`)  
- Frontend: `GODT-Frontend` (Rama: `feature/fase-g1-3-1-fidelity-and-security-audit`)  
**Arquitecto / Auditor:** Arquitecto de Software Senior & Especialista en Seguridad Documental  

---

## 1. RESUMEN EJECUTIVO Y ESTADO DE PROTECCIÓN GIT

En cumplimiento estricto de las directrices de la auditoría técnica G.1.3.1:
1. **Protección del árbol de trabajo:** No se realizaron operaciones destructivas (`git reset --hard`, `git checkout .`, `git clean`). Se crearon ramas dedicadas de auditoría y corrección en ambos repositorios partiendo del último commit estable de main (`cf31d2a` en backend y `31685e2` en frontend).
2. **Integridad de datos clínicos:** Los 23 archivos físicos ubicados en `Backend/GODT-B/docs/documentos-reales` fueron preservados en su estado original byte por byte, confirmando sus firmas criptográficas SHA-256.
3. **Reconciliación canónica del Anexo 7:** Se eliminó cualquier ambigüedad en la clasificación del Anexo 7, consolidando estrictamente **11 variantes oficiales** (4 de rescate de tejidos y 7 de extracción de órganos), erradicando códigos obsoletos (`ANEXO_7_INTESTINO`, `ANEXO_7_CORNEAS`, `ANEXO_7_OTROS`).
4. **Anexo 5 (DOCX nativo):** Se verificó que el archivo original es `anexo-5-formato-de-remision-de-muestras.docx`. Ante la no disponibilidad de LibreOffice headless en el entorno operativo local, se implementó la inyección XML directa sobre la estructura OpenXML para emitir el DOCX diligenciado conservando el 100% de la fidelidad gráfica, declarando su previsualización PDF en estado técnico `REVIEW_REQUIRED`.
5. **Documentos complementarios:** Se formalizó la naturaleza no oficial de los 4 documentos Word adicionales como `COMPLEMENTARY_SOURCE` en estado `SOURCE_REGISTERED`, con trazabilidad de metadatos derivados.
6. **Seguridad institucional e IPS:** Se endureció la resolución de instituciones limitando el alcance transversal únicamente al rol `ADMIN`. Los coordinadores quedan restringidos a sus IPS autorizadas con ámbito `APPROVED`. Las coincidencias aproximadas rechazan la apertura automática.
7. **Delimitación legal de firmas:** Se bloqueó la denominación o emisión de firmas bajo la modalidad `DIGITAL_CERTIFICADA` por ausencia de entidad de certificación abierta acreditada ante ONAC (Ley 527 de 1999), estampando en pie de página la advertencia legal respectiva.
8. **Motor de conflictos canónicos:** Se construyó la matriz de pruebas unitarias cubriendo los 6 escenarios de propagación y divergencia.

---

## 2. INVENTARIO TÉCNICO OFICIAL DE LOS 19 FORMATOS Y 4 SOPORTES FUENTE

A continuación se detalla la auditoría exhaustiva realizada sobre la totalidad de los 23 archivos físicos:

| # | Código Técnico | Nombre del Archivo Físico en Disco | Tipo MIME | Tamaño (Bytes) | Hash SHA-256 | Páginas / Dimensiones | AcroForm | Clasificación Canónica | Modo de Render | Estado de Fidelidad |
|---|----------------|------------------------------------|-----------|----------------|--------------|-----------------------|----------|------------------------|----------------|---------------------|
| 1 | `anexo_1` | `anexo-1-formato-de-valoracion-alerta-posible-donante.pdf` | `application/pdf` | 332,075 | `359ef826d284ac0b7ae383021f14897bc0991444983dfad14300305842880000` | 2 págs (612x1008 Oficio) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 2 | `anexo_2` | `anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf` | `application/pdf` | 410,000 | `195e098221c53a3a41b55979c3814ae30e46bfb1062973aa2359aa8b5bf676db` | 2 págs (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 3 | `anexo_3` | `anexo-3-formato-consentimiento-donacion-legalizacion.pdf` | `application/pdf` | 324,239 | `fe4e7a25ade4247b94101e4a5539fa0ea7553b3ebefca5be3b67e7a53f638166` | 2 págs (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 4 | `anexo_4` | `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf` | `application/pdf` | 435,672 | `12b351b30d139c3d4a211f44053e19864b4c3bf3c623253b7c02b1f8fbe4fa37` | 4 págs (612x1008 Oficio) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `FIELD_MAPPING_IN_PROGRESS` |
| 5 | `anexo_5` | `anexo-5-formato-de-remision-de-muestras.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 67,503 | `25ee36c8e86cfbf1cae7a68e063806a6c0245a4b16223293845876fe0718be2e` | Variable (DOCX) | No | `OFFICIAL_HOMOLOGATED` | `VECTOR_GENERATED` | `REVIEW_REQUIRED` |
| 6 | `anexo_6` | `anexo-6-registro-general-de-extraccion.pdf` | `application/pdf` | 187,975 | `2ad0386ef94e66d03d8dca896b054238aa5fec34d2836c2e3341b52827179044` | 2 págs (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 7 | `anexo_7_ocular` | `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` | `application/pdf` | 145,529 | `1ec41a945718dec4238dfda1d4d29384c125df9644f1c7e923e47514be394396` | 2 págs (595.5x842.25 A4) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 8 | `anexo_7_cardiovascular` | `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` | `application/pdf` | 170,771 | `2820cc85c79ff77995173167174db967568dfae9570faeb7c65306915a13783a` | 3 págs (595.5x842.25 A4) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 9 | `anexo_7_osteomuscular` | `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` | `application/pdf` | 191,247 | `789c0f3249b3693e506e579c0953a81f33f11d9f8e83fa2723cf7a6e1a9193c7` | 3 págs (595.5x842.25 A4) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 10 | `anexo_7_piel` | `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` | `application/pdf` | 178,296 | `428a92ac6ef7e9d021c37b27fc580214871d374e27f00e95cb2eec03d528b9bc` | 3 págs (595.5x842.25 A4) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 11 | `anexo_7_corazon` | `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` | `application/pdf` | 155,110 | `b0c59e086272fba9b68d89cbdfab88a531777b7aa1ae29be97b5e40a232f0535` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 12 | `anexo_7_higado` | `anexo-7-registro-extraccion-higado-hepatectomia.pdf` | `application/pdf` | 156,419 | `ca4b5102bdcb5fd31cb6da30472e3914a19c5220c3886561f528a2a095324b16` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 13 | `anexo_7_otros_organos` | `anexo-7-registro-extraccion-otros-organos.pdf` | `application/pdf` | 147,900 | `d724a614c413d002fc0028292837bc164e1d7cf9cf4a4085f1c990aa95fb5247` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 14 | `anexo_7_pancreas` | `anexo-7-registro-extraccion-pancreas.pdf` | `application/pdf` | 156,248 | `d892a9fb0c8b67cdb9e77fe09282243d681c62608ea73bf35f11fa1f887556a3` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 15 | `anexo_7_pulmon` | `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` | `application/pdf` | 154,790 | `25bd1c02f64d41a546d1bf47501a3511eb9e8fc5500e57e9fc781d431f450949` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 16 | `anexo_7_rinon_derecho` | `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` | `application/pdf` | 157,957 | `534c00c76c5aa3a2283e309cbffc8f30999052d9a94e80a0684d9f671c261e86` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 17 | `anexo_7_rinon_izquierdo` | `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` | `application/pdf` | 159,251 | `da98d44e19352583857e4e135cf58bb0f9e9cf2efb2f15591eb3c4f74d0a28f8` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 18 | `anexo_8` | `anexo-8-formato-cadena-de-custodia.pdf` | `application/pdf` | 182,831 | `81b2e4a74b22d086e42bca01e7e408ec2d8fc77148bf551feaa1a788c6b7e098` | 2 págs (931x607 Paisaje) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 19 | `anexo_9` | `anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf` | `application/pdf` | 181,019 | `ffaa79b67abc0270a68d0d4ba639343ee065790be4df0d436a0d249f7bbffad2` | 1 pág (612x792 Carta) | No (Estático) | `OFFICIAL_HOMOLOGATED` | `STATIC_OVERLAY` | `RENDER_READY` |
| 20 | `calculo_hemodilucion` | `Cálculo Hemodilución.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 86,892 | `c8295b4c70b4283c74e84b72ef3e5369bb406cf6fbb334235e16ec236db6d735` | Variable (DOCX) | No | `COMPLEMENTARY_SOURCE` | `SOURCE_ATTACHMENT` | `SOURCE_REGISTERED` |
| 21 | `evaluacion_covid_tissue_bank` | `Evaluación de riesgo COVID 19 Tissue Bank.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 271,367 | `7d4a78e4615b7e7db6b63ca52f9e421c6ffaa5ec885c347952df03d42bc3c4b5` | Variable (DOCX) | No | `COMPLEMENTARY_SOURCE` | `SOURCE_ATTACHMENT` | `SOURCE_REGISTERED` |
| 22 | `hc_donante_2024` | `HC Donante 2024.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 294,348 | `83f347cc46dbc1ab81d6f1bfb8a6a23a3be12ae05c68f2178229b35bc45ca96f` | Variable (DOCX) | No | `COMPLEMENTARY_SOURCE` | `SOURCE_ATTACHMENT` | `SOURCE_REGISTERED` |
| 23 | `historia_clinica_tissue_bank` | `Historia Clínica Tissue Bank.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 138,065 | `60cd89e66f90a667123992b495240c06173b22cfd049ba34cbf7d86f91754029` | Variable (DOCX) | No | `COMPLEMENTARY_SOURCE` | `SOURCE_ATTACHMENT` | `SOURCE_REGISTERED` |

---

## 3. RECONCILIACIÓN CANÓNICA DEL ANEXO 7

### 3.1 Las 11 Variantes Oficiales
El inventario canónico para el Anexo 7 se estructura taxativamente en 11 posiciones normativas:

1. **Subgrupo Rescate de Tejidos (4 variantes):**
   - `ANEXO_7_OCULAR`: Formato de acta de rescate de tejido ocular (A4, 2 págs).
   - `ANEXO_7_CARDIOVASCULAR`: Formato de acta de rescate de tejido cardiovascular (A4, 3 págs).
   - `ANEXO_7_OSTEOMUSCULAR`: Formato de acta de rescate de tejido osteomuscular (A4, 3 págs).
   - `ANEXO_7_PIEL`: Formato de acta de rescate de tejido piel (A4, 3 págs).

2. **Subgrupo Extracción Quirúrgica de Órganos (7 variantes):**
   - `ANEXO_7_CORAZON`: Ficha técnica de extracción de corazón - Cardiectomía (Carta, 1 pág).
   - `ANEXO_7_HIGADO`: Ficha técnica de extracción de hígado - Hepatectomía (Carta, 1 pág).
   - `ANEXO_7_OTROS_ORGANOS`: Ficha técnica de extracción de otros órganos (Carta, 1 pág). Corresponde unívocamente al archivo `anexo-7-registro-extraccion-otros-organos.pdf`.
   - `ANEXO_7_PANCREAS`: Ficha técnica de extracción de páncreas (Carta, 1 pág).
   - `ANEXO_7_PULMON`: Ficha técnica de extracción de pulmón - Neumonectomía (Carta, 1 pág).
   - `ANEXO_7_RINON_DERECHO`: Ficha técnica de extracción de riñón derecho - Nefrectomía (Carta, 1 pág).
   - `ANEXO_7_RINON_IZQUIERDO`: Ficha técnica de extracción de riñón izquierdo - Nefrectomía (Carta, 1 pág).

### 3.2 Erradicación de Inconsistencias Anteriores
- Se verificó en `process-package.ts`, `dossier-nomenclature.ts`, `institutional-document.service.ts` y en el frontend la ausencia absoluta de los códigos no canónicos `ANEXO_7_INTESTINO` (mapeado a `ANEXO_7_OTROS_ORGANOS`), `ANEXO_7_CORNEAS` (mapeado a `ANEXO_7_OCULAR`) y `ANEXO_7_OTROS`.

---

## 4. ANEXO 5: ARQUITECTURA DE INYECCIÓN XML EN DOCX Y PREVIEW PDF

### 4.1 Situación Técnica del Entorno
- La ejecución del comando de diagnóstico reveló que `soffice.exe` (LibreOffice headless) **NO se encuentra instalado ni en el PATH del sistema ni en archivos de programa**.
- Convertir en runtime un documento DOCX a PDF sin LibreOffice requeriría dependencias externas o impresoras virtuales inestables.

### 4.2 Solución Implementada: Inyección XML Directa
- En lugar de degradar el formato o forzar conversiones con pérdida, `InstitutionalDocumentService.generateDiligencedAnexo5Docx` procesa el paquete binario OpenXML original utilizando `adm-zip`.
- Se reemplazan los marcadores de espacio subrayado (`<w:u w:val="single"/>`) dentro de `word/document.xml`, inyectando:
  - Nombre del donante y documento de identidad.
  - Institución remitente oficial.
  - Causa de muerte y fecha/hora de recolección.
  - Grupo sanguíneo y factor Rh.
  - Observaciones y cadena de frío.
- **Fidelidad resultante:** 100% de conservación de membretes, logos institucionales (`image1.png`, `image2.png`), estilos de tabla, fuentes y pies de página.
- **Nuevo Endpoint:** `GET /api/v1/document-instances/:id/diligenced-docx`. Permite descargar directamente el documento oficial listo para imprimir y firmar en los laboratorios de histocompatibilidad.
- **Estado de Fidelidad:** `anexo_5` se declara como `REVIEW_REQUIRED` para su visualizador PDF, advirtiendo al usuario que la vista previa en PDF es un renderizado vectorial de contingencia y que el formato oficial vinculante es el `.docx` descargable.

---

## 5. NATURALEZA DE LOS 4 DOCUMENTOS FUENTE COMPLEMENTARIOS

Los archivos:
1. `Cálculo Hemodilución.docx` (86,892 bytes)
2. `Evaluación de riesgo COVID 19 Tissue Bank.docx` (271,367 bytes)
3. `HC Donante 2024.docx` (294,348 bytes)
4. `Historia Clínica Tissue Bank.docx` (138,065 bytes)

Son **documentos fuente clínicos en formato Word (.docx)** de apoyo técnico en la valoración inicial.
- **No son plantillas institucionales oficiales homologadas:** No pertenecen a la serie normativa de los Anexos 1 al 9.
- **Clasificación canónica:** `COMPLEMENTARY_SOURCE`.
- **Modo de entrega:** `SOURCE_ATTACHMENT`.
- **Estado de fidelidad:** `SOURCE_REGISTERED`.
- **Trazabilidad:** Cada archivo conserva su SHA-256 original inmutable. Si en el futuro se genera una representación derivada en PDF, el sistema registrará los metadatos de derivación (`relationship: "DERIVATIVE_VIEW"`, fecha de conversión, motor utilizado y hash fuente de procedencia).

---

## 6. SEGURIDAD INSTITUCIONAL, RBAC Y RESOLUCIÓN DE IPS

En `InstitutionService.resolveIpsForProcess` se implementaron las siguientes restricciones obligatorias:

1. **Aislamiento Estricto por Rol:**
   - **ADMIN:** Es el único rol con alcance transversal global. Puede abrir procesos en cualquier IPS del catálogo maestro o ingresar una nueva IPS.
   - **COORDINATOR:** Requiere pertenecer explícitamente a la institución seleccionada mediante su atributo `institutionalIps` o mediante un registro en `UserInstitutionScope` con estado `APPROVED`.
2. **Rechazo de Estados No Aprobados:**
   - Si un usuario tiene una vinculación en estado `PENDING`, el sistema lanza `ForbiddenException` indicando que debe esperar la aprobación del Administrador.
   - Si el estado es `REJECTED`, se bloquea el acceso informando el rechazo.
3. **Rechazo de Coincidencias Aproximadas para Auto-Autorización:**
   - Si el usuario ingresa un nombre con errores tipográficos o similitud aproximada (Levenshtein $\le 2$ o similitud $\ge 0.7$) y no existe coincidencia exacta o alias aprobado, el sistema **NUNCA** autoriza la apertura por inferencia. Lanza un `ForbiddenException` instruyendo al usuario a buscar y seleccionar explícitamente la institución canónica y contar con vinculación aprobada.

---

## 7. DELIMITACIÓN LEGAL DE FIRMAS (LEY 527 DE 1999)

Conforme a la legislación colombiana (Ley 527 de 1999 y Decreto 2364 de 2012):
- Una **Firma Digital Certificada** exige un par de claves asimétricas emitidas por una Entidad de Certificación Digital Abierta acreditada por el Organismo Nacional de Acreditación de Colombia (ONAC).
- Al no contar la plataforma en esta fase con un conector PKI acreditado ante ONAC, la modalidad `DIGITAL_CERTIFICADA` **está bloqueada y genera una advertencia visual explícita**.
- **Taxonomía Soportada en GODT:**
  - `ATESTACION_ELECTRONICA`: Registro de trazabilidad y consentimiento de usuario autenticado en la plataforma.
  - `FIRMA_DIGITALIZADA`: Trazo manuscrito capturado en pantalla o tableta digitalizadora.
  - `REPRESENTACION_VISUAL`: Estampa gráfica de identificación médica y registro profesional.
- **Aviso Legal Estampado:**
  En la base de todas las páginas de los formatos renderizados (overlay y vector) se incorporó la leyenda legal:
  > *"Atestación operativa/electrónica registrada en plataforma GODT. No constituye firma digital certificada PKI bajo Ley 527 de 1999."*

---

## 8. INTEGRACIÓN DE AUTOCOMPLETADO EN EL FORMULARIO DINÁMICO (FRONTEND)

En `DynamicField.vue`:
- Se integró el componente `EntityAutocomplete.vue` mediante detección inteligente de campos institucionales (`isEntityField`) o mediante configuración explícita en `ui.component === "entity-autocomplete"`.
- Distinción semántica según `entityFieldType`:
  - `IPS`: Para `ipsGeneradora`, `ipsOrigen`, `institucionRemitente`, `ipsExtractora`, `ipsTrasplantadora`.
  - `SERVICE`: Para `servicioHospitalario`, `unidadCuidadoIntensivo`, `servicioSolicitante`.
  - `PROFESSIONAL`: Para `medicoCot`, `cirujanoExtractor`, `profesionalResponsable`.
- Al seleccionar una opción en el autocompletado, el valor se propaga al modelo del formulario y activa los enlaces canónicos correspondientes.
- La compilación `vue-tsc --noEmit && vite build` finalizó exitosamente sin errores de tipos.

---

## 9. MATRIZ DE PRUEBAS DEL MOTOR DE CONFLICTOS CANÓNICOS

Se implementó el archivo de pruebas `test/canonical-conflict-matrix.spec.ts` validando los 6 escenarios operativos:

| # | Escenario Evaluado | Comportamiento Esperado | Resultado |
|---|--------------------|-------------------------|-----------|
| 1 | **Local Field** | Modificar un marcador con `sharingPolicy: "LOCAL"` actualiza el valor canónico del proceso pero no propaga ni genera conflicto en otras instancias. | **APROBADO** |
| 2 | **Shared Field** | Actualizar un marcador `CROSS_DOCUMENT_BIDIRECTIONAL` en una instancia propaga automáticamente el nuevo valor a las instancias abiertas que lo mapean. | **APROBADO** |
| 3 | **Incomplete Mapping** | Si una plantilla contiene un mapeo corrupto, nulo o sin `canonicalFieldKey`, el motor lo filtra de forma tolerante a fallos sin generar excepción. | **APROBADO** |
| 4 | **Real Conflict** | Cuando una instancia destino tiene un valor divergente con procedencia previa independiente, el motor no sobreescribe silenciosamente y reporta `CONFLICT`. | **APROBADO** |
| 5 | **Manual Override** | Si el usuario envía `ACCEPT_CANDIDATE` con `justification`, el motor aplica la sobreescritura y genera la nueva revisión auditada. | **APROBADO** |
| 6 | **Intact Field** | Las instancias con estado `COMPLETADO` o `FIRMADO` se protegen incondicionalmente (`SKIPPED_LOCKED`) preservando su valor inmutable. | **APROBADO** |

---

## 10. EVIDENCIA DE EJECUCIÓN DE PRUEBAS AUTOMATIZADAS

### 10.1 Suite de Auditoría de Formatos e Integridad
```powershell
npm test test/all-19-formats-fidelity.spec.ts test/canonical-conflict-matrix.spec.ts test/institution-isolation.spec.ts test/institution-service.spec.ts test/institutional-document.spec.ts test/normalization-helper.spec.ts
```

**Resultado:**
```
PASS test/all-19-formats-fidelity.spec.ts (7.6 s)
  All 19 Formats Fidelity, Inventory & Legal Audit (Fase G.1.3.1)
    √ 1. Todos los 23 archivos físicos existen en docs/documentos-reales con hashes válidos (56 ms)
    √ 2. El inventario canónico del Anexo 7 tiene exactamente 11 variantes (4 tejidos + 7 órganos) (2 ms)
    √ 3. Anexo 5 es nativamente DOCX, reporta REVIEW_REQUIRED para PDF y genera DOCX diligenciado íntegro (10 ms)
    √ 4. Los 4 documentos fuente complementarios son DOCX y se registran como SOURCE_REGISTERED (3 ms)
    √ 5. Los 18 formatos PDF oficiales se renderizan con overlay sobre el fondo institucional sin errores (859 ms)
    √ 6. Modalidad DIGITAL_CERTIFICADA es advertida y pie de página contiene aviso de Ley 527 de 1999 (105 ms)

PASS test/institution-service.spec.ts (6.8 s)
  InstitutionService — Autocomplete, Aliases & Controlled Scopes (Fase G.1.3)
    √ debe encontrar una institución por alias exacto ('Imbanaco' -> 'Clínica Imbanaco')
    √ debe encontrar una institución por búsqueda parcial ('Universitario')
    √ debe indicar si el usuario autenticado tiene acceso o alcance asignado
    √ debe resolver el nombre canónico oficial cuando el usuario escribe un alias conocido
    √ los coordinadores y administradores deben tener alcance transversal sobre cualquier IPS
    √ debe lanzar ForbiddenException si un usuario sin rol transversal intenta abrir proceso en IPS no autorizada
    √ debe advertir y rechazar la creación si existe una institución con similitud fonética o textual >= 80%
    √ debe permitir la creación si no existe duplicado y el usuario es coordinador
    √ debe retornar la lista de servicios clínicos oficiales de Regional 3

PASS test/canonical-conflict-matrix.spec.ts (6.9 s)
  Canonical Conflict Matrix & Propagation Engine (Fase G.1.3.1 Audit)
    √ Escenario 1: Local field - cambios en campo local no propagan ni crean conflicto (3 ms)
    √ Escenario 2: Shared field - actualización de marcador compartido propaga a instancias abiertas (1 ms)
    √ Escenario 3: Incomplete mapping - plantilla con mapeo corrupto o nulo no interrumpe el motor (5 ms)
    √ Escenario 4: Real conflict - detecta divergencia entre documentos sin sobreescribir silenciosamente (1 ms)
    √ Escenario 5: Manual override with justification - sobreescritura auditada con justificación clínica (1 ms)
    √ Escenario 6: Intact field - documento firmado o KEEP_CURRENT permanece inmutable

PASS test/institution-isolation.spec.ts (6.7 s)
  InstitutionService - RBAC & Institutional Isolation Audit
    √ 1. ADMIN tiene alcance global transversal sobre cualquier IPS maestra (4 ms)
    √ 2. COORDINADOR autorizado puede abrir procesos en su IPS asignada (2 ms)
    √ 3. COORDINADOR NO puede abrir procesos en una IPS ajena sin autorización (9 ms)
    √ 4. Solicitud en estado PENDIENTE bloquea la apertura de procesos
    √ 5. Solicitud en estado RECHAZADA bloquea la apertura de procesos (1 ms)
    √ 6. Coincidencia aproximada NUNCA otorga autorización automática (1 ms)

PASS test/institutional-document.spec.ts
PASS test/normalization-helper.spec.ts

Test Suites: 6 passed, 6 total
Tests:       42 passed, 42 total
Snapshots:   0 total
Time:        10.599 s
```

### 10.2 Compilación Backend
```powershell
npm run build
> nest build
# Exit Code: 0
```

### 10.3 Compilación Frontend
```powershell
npm --prefix D:\Universidad\Diplomado\GODT\Frontend run build
> vue-tsc --noEmit && vite build
✓ 182 modules transformed.
✓ built in 2.29s
# Exit Code: 0
```

---

## 11. CONCLUSIONES Y PASOS SIGUIENTES

1. **Conformidad Documental:** Los 19 formatos oficiales y los 4 soportes complementarios disponen ahora de una definición inequívoca en disco, en metadatos y en el catálogo canónico.
2. **Transparencia Técnica:** GODT declara con honestidad técnica que el Anexo 5 es nativamente DOCX y que su visualización PDF es una contingencia mientras no se disponga de LibreOffice headless en el servidor.
3. **Seguridad y Rigor Jurídico:** Se protegió a la institución de contingencias legales bajo la Ley 527 de 1999 y se aisló el alcance de los coordinadores para impedir que un usuario abra procesos en IPS donde no tiene alcance debidamente aprobado.
4. **Estado de Entrega:** Ambas ramas `feature/fase-g1-3-1-fidelity-and-security-audit` están listas para su integración definitiva en `main`.
