# GODT REGIONAL 3 — FASE G.1
## MOTOR OCR LOCAL Y EXTRACCIÓN ASISTIDA POR INTELIGENCIA ARTIFICIAL
### Documento de Entrega Técnica: FASE_G1_OCR_AI_IMPLEMENTATION.md

---

## 1. RESUMEN EJECUTIVO Y ARQUITECTURA DESACOPLADA

El subsistema de Reconocimiento Óptico de Caracteres (OCR) y Extracción Asistida por Inteligencia Artificial de **GODT Regional 3** tiene por objetivo procesar documentos heterogéneos recibidos (historias clínicas, paraclínicos, actas de rescate en PDF, DOCX e imágenes), identificar información clínica clave y presentar candidatos estructurados para su validación humana y propagación al motor de datos canónicos.

### 1.1 Diagrama de Flujo del Procesamiento
```
[ Documento Fuente: PDF / DOCX / Imagen ]
                    │
                    ▼
    [ Clasificador de Tipo de Archivo ]
    ├─ DOCX (OpenXML) ──────► [ Extractor de Párrafos y Tablas (AdmZip) ]
    ├─ PDF Digital ─────────► [ Extractor Directo de Capa de Texto (BT..ET) ]
    ├─ PDF Escaneado ───────► [ Rasterizador Local + OCR Tesseract (spa/eng) ]
    └─ Imagen (PNG / JPG) ──► [ OCR Directo Tesseract ]
                    │
                    ▼
          [ Texto Reconocido ]
                    │
                    ▼
    [ DocumentUnderstandingService ]
    ├─ LocalRulesExtractionProvider (100% local, patrones clínicos, normalización)
    └─ GeminiOcrAdapter (Opcional, deshabilitado por defecto para datos clínicos)
                    │
                    ▼
    [ Candidatos Estructurados (OcrExtractedField: PENDIENTE) ]
                    │
                    ▼
    [ Revisión Humana: Aceptar / Editar / Rechazar ]
                    │
                    ▼
    [ CanonicalPropagationEngine ] ──► [ ProcessCanonicalValue & Provenance ]
```

---

## 2. ESTRATEGIA DE PROCESAMIENTO SEGÚN EL TIPO DE ARCHIVO

| Tipo de Archivo | Estrategia de Extracción | Ventajas Técnicas |
| :--- | :--- | :--- |
| **DOCX (OpenXML)** | Parseo directo de `word/document.xml` mediante `AdmZip`. | Cero pérdida de caracteres, extracción estructurada de celdas de tablas (`<w:tc>`) y párrafos (`<w:p>`), velocidad instantánea sin rasterizado. |
| **PDF Digital** | Inspección y descompresión FlateDecode de operadores de texto `BT ... ET`, `Tj` y `TJ`. | Si la capa digital contiene $\ge 50$ caracteres significativos, se extrae el texto puro sin invocar OCR pesado ni degradar la nitidez. |
| **PDF Escaneado** | Rasterizado de páginas a imágenes PNG de 300 DPI y ejecución de Tesseract. | Procesa documentos impresos o fotocopiados mediante segmentación de bloques y tablas TSV. |
| **Imágenes (PNG/JPG)** | OCR directo sobre el mapa de bits mediante Tesseract CLI. | Reconocimiento de caracteres con bounding boxes y puntuación de confianza por palabra. |

---

## 3. POLÍTICA DE PROTECCIÓN DE DATOS SENSIBLES Y PRIVACIDAD

> [!IMPORTANT]
> **POLÍTICA DE CERO FUGA DE DATOS CLÍNICOS REALES:**
> 1. El motor de extracción por defecto es **100% LOCAL** (`LocalRulesExtractionProvider` y `TesseractOcrAdapter`), ejecutándose íntegramente dentro de los servidores de la Regional 3 sin emitir llamadas de red externas.
> 2. Los proveedores externos de Inteligencia Artificial en la nube (como Google Gemini API) permanecen **DESHABILITADOS POR DEFECTO** para documentos clínicos confidenciales (`AI_EXTERNAL_PROVIDER_ENABLED=false`).
> 3. La integración con proveedores externos solo puede ser habilitada explícitamente en entornos de laboratorio con documentos 100% sintéticos y tras aprobación del Comité de Ética y Protección de Datos.

---

## 4. MOTOR DE REGLAS LOCALES Y NORMALIZACIÓN CLÍNICA

El componente `LocalRulesExtractionProvider` implementa expresiones regulares y analizadores deterministas ajustados a la nomenclatura y terminología médica colombiana:

| Campo Canónico | Patrones Reconocidos | Reglas de Normalización | Confianza Típica |
| :--- | :--- | :--- | :---: |
| `donor.identity.document_number` | Cédula, CC, TI, Identificación, Documento | Extracción de números de 6 a 12 dígitos | $0.95$ |
| `donor.identity.document_type` | CC, TI, CE, Pasaporte, Registro Civil | Normalización a enum institucional (`CC`, `TI`) | $0.92$ |
| `donor.identity.full_name` | Nombre(s), Paciente, Donante, Fallecido | Limpieza de títulos y preposiciones no deseadas | $0.92$ |
| `donor.clinical.blood_group` | Grupo Sanguíneo, GS, Hemoclasificación | Mapeo exacto a `A`, `B`, `AB`, `O` | $0.96$ |
| `donor.clinical.rh_factor` | Factor Rh, Positivo, Negativo, `+`, `-` | Normalización estricta a `+` o `-` | $0.96$ |
| `donor.demographics.age` | Edad, Años | Conversión a entero (rango 0-125) | $0.94$ |
| `donor.demographics.sex` | Sexo, Género, Masculino, Femenino, M, F | Normalización a `MASCULINO` o `FEMENINO` | $0.93$ |
| `donor.institution.originating_ips` | IPS Generadora, Hospital, Clínica | Extracción del nombre de la institución | $0.88$ |
| `donor.clinical.clinical_service` | Servicio Clínico, Ubicación | Identificación de UCI, Urgencias, Quirófano | $0.90$ |
| `donor.clinical.cause_of_death` | Causa de Muerte, Diagnóstico de Ingreso | Detección de TCE, ACV, Muerte Encefálica | $0.86$ |
| `donor.clinical.arterial_ph` | pH, pH arterial, Gases Arteriales | Validación decimal en rango $6.80 - 7.80$ | $0.95$ |
| `donor.clinical.creatinine` | Creatinina sérica, mg/dL | Validación numérica en mg/dL | $0.94$ |
| `donor.registration.rnd_code` | Código RND, Consulta RND, RND | Extracción de código alfanumérico RND | $0.95$ |

---

## 5. CICLO DE VIDA DE REVISIÓN HUMANA Y PROPAGACIÓN CANÓNICA

Ningún dato extraído por OCR o IA se convierte de forma automática o desatendida en un dato clínico oficial del proceso.

1. **Estado Inicial:** Cada candidato extraído se almacena en `OcrExtractedField` con estado `PENDIENTE` (`PENDING_REVIEW`).
2. **Acciones del Usuario en la Interfaz:**
   - **Confirmar (`CONFIRMADO`):** El usuario acepta el valor sugerido por el OCR sin alteraciones.
   - **Modificar (`MODIFICADO`):** El usuario corrige una imprecisión del OCR, registrando tanto el valor original detectado como el valor confirmado manualmente.
   - **Rechazar (`RECHAZADO`):** El usuario descarta el candidato; el valor rechazado **nunca se propaga** al diccionario canónico.
3. **Propagación al Proceso:**
   Al presionar "Propagar a Datos Canónicos", el backend invoca `CanonicalPropagationEngine.applyAndPropagate`:
   - Se crea o actualiza `ProcessCanonicalValue`.
   - Se genera una entrada inmutable en `ProcessCanonicalHistory`.
   - Se crea el registro de procedencia `DocumentFieldProvenance` vinculando el `sourceDocumentId`, la fecha y el usuario que realizó la validación.
   - Los formularios oficiales relacionados (Anexos 1, 2, 4, etc.) se precargan automáticamente con la información confirmada.

---

## 6. CONCLUSIÓN

La arquitectura híbrida implementada combina la velocidad y exactitud de la extracción digital para DOCX y PDFs nativos con la robustez del OCR Tesseract para documentos escaneados, respaldada por un motor de reglas clínicas locales que respeta los más altos estándares de privacidad y seguridad de datos sensibles.
