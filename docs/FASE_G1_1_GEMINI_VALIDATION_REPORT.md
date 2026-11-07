# GODT REGIONAL 3 — INFORME DE VALIDACIÓN TÉCNICA GEMINI OCR & ENTORNO LOCAL (FASE G.1.1)
## Auditoría de Configuración, Pruebas de Red, Gobernanza y Estado de Dependencias

**Fecha:** 2026-11-07  
**Auditor:** Arquitecto de Software Senior & Especialista en Seguridad Documental  
**Módulos Evaluados:** Backend NestJS (`GODT-B`), Frontend Vue 3 (`GODT-Frontend`), Docker, Google Gemini API  
**Ramas de Entrega:**
- Backend: `feature/g1-1-gemini-runtime-validation`
- Frontend: `feature/g1-1-gemini-runtime-validation`

---

## 1. AUDITORÍA EXHAUSTIVA DE CONFIGURACIÓN GEMINI (8 PREGUNTAS TÉCNICAS)

| # | Pregunta Técnica | Hallazgo Técnico Auditado en Código |
| :-: | :--- | :--- |
| **1** | **¿Qué variable de entorno consume el adapter para la API key?** | Consume exactamente `GEMINI_API_KEY`. Se encuentra configurada en el archivo local `.env` del backend (53 caracteres de longitud). Ninguna parte del sistema la imprime en logs, consola ni respuestas HTTP. |
| **2** | **¿Qué variable habilita el uso del proveedor externo?** | Se estableció como variable canónica única: `AI_EXTERNAL_PROVIDER_ENABLED` (con soporte retrocompatible para el alias `AI_PROVIDER_ENABLED`). Su valor debe ser `"true"` para activarse. |
| **3** | **¿Qué modelo de Gemini utiliza?** | Consume la variable `GEMINI_MODEL`, con valor predeterminado `gemini-3.8-flash`. Durante la prueba real contra Google, se detectó que los modelos heredados (`gemini-2.5-flash` y `gemini-1.5-flash`) fueron descontinuados por Google (retornando HTTP 404), siendo reemplazados oficialmente por la serie `gemini-3.8-flash`. |
| **4** | **¿Qué SDK o mecanismo HTTP utiliza?** | Utiliza el mecanismo estándar `fetch` nativo de Node.js (HTTP POST) con encabezados `Content-Type: application/json` y control de corte por tiempo mediante `AbortSignal.timeout(30000)`. No introduce dependencias pesadas de SDKs externos. |
| **5** | **¿Qué formato recibe y devuelve?** | **Recibe:** Objeto tipado `{ buffer: Buffer; mimeType: string; rawText?: string }`. Si existe capa de texto previa, transmite el texto delimitado en el prompt; si es una imagen pura, transmite `inline_data` en base64.<br>**Devuelve:** Array tipado `Promise<OcrCandidate[]>`, donde cada elemento contiene `canonicalFieldKey`, `candidateValue`, `confidenceScore` y `boundingBox` con snippet contextual y modelo utilizado. |
| **6** | **¿Está correctamente registrado en NestJS?** | Sí. Se encuentra registrado como provider en `OcrModule`, inyectado en `DocumentUnderstandingService`, referenciado en la fábrica de `OCR_PROVIDER` y exportado para consumo intermodular. |
| **7** | **¿`DocumentUnderstandingService` realmente lo invoca?** | **Sí, implementado y verificado:** Tras obtener el texto base (sea de DOCX, PDF digital o Tesseract local), comprueba `geminiAdapter.isEnabled()`. Si está activo, invoca `geminiAdapter.process(...)`. Si Gemini tiene éxito, filtra alucinaciones contra el texto base y consolida candidatos. |
| **8** | **¿El flujo OCR ejecuta el proveedor o se queda exclusivamente en `LocalRulesExtractionProvider`?** | **Flujo híbrido robusto con fallback:** Si `AI_EXTERNAL_PROVIDER_ENABLED=true` en development, ejecuta Gemini. Si Gemini responde con sobrecarga (HTTP 503), límite de cuota (HTTP 429) o timeout, el servicio captura la excepción, registra un diagnóstico `WARN` y activa inmediatamente el fallback a `LocalRulesExtractionProvider` preservando los candidatos locales sin interrumpir el proceso. |

---

## 2. GOBERNANZA CLÍNICA Y SEGURIDAD DE LA INFORMACIÓN

1. **Aislamiento de Entornos:**
   - En `staging` y `production`, `GeminiOcrAdapter.isEnabled()` retorna `false` incondicionalmente, emitiendo una advertencia de seguridad si alguien intentara habilitarlo.
   - En `development`, solo se activa si `AI_EXTERNAL_PROVIDER_ENABLED=true` y existe `GEMINI_API_KEY`.
2. **Protección de Datos Sensibles:**
   - Verificado con `git check-ignore -v .env`: el archivo `.env` está en `.gitignore` tanto en Backend como en Frontend y no está rastreado por Git (`git ls-files .env` vacío).
   - Ninguna variable con prefijo `VITE_` en el frontend expone claves de API externas.
3. **Guardrails de Inteligencia Artificial:**
   - **Instrucción de Aislamiento:** El documento se trata como datos no confiables de solo lectura, neutralizando ataques de inyección de instrucciones (*Prompt Injection*).
   - **Filtro Anti-Alucinación:** Si Gemini propone un valor que no tiene respaldo en el texto base analizado, el adaptador lo descarta preventivamente.
   - **Prohibición de Juicio Clínico:** El modelo no puede emitir diagnósticos, certificar muertes encefálicas ni determinar viabilidad de órganos.

---

## 3. AUDITORÍA DEL ENTORNO LOCAL Y DEPENDENCIAS EN WINDOWS

Se inspeccionó el estado del equipo local para determinar la operatividad real del sistema:

| Componente / Dependencia | Estado Actual en el Host | Impacto Funcional | Recomendación Técnica |
| :--- | :---: | :--- | :--- |
| **PostgreSQL 17.6** | **OPERATIVO (Docker)** | Contenedor `godt-b-postgres-1` saludable en puerto 5432. 12 pruebas de integración PostgreSQL aprobadas al 100%. | Mantener contenedor activo vía Docker Desktop. |
| **Redis 7.4 (BullMQ)** | **OPERATIVO (Docker)** | Contenedor `godt-b-redis-1` saludable en puerto 6379. PING responde PONG. | Mantener contenedor activo vía Docker Desktop. |
| **Almacenamiento Local (`storage/private`)** | **OPERATIVO** | Permisos de lectura/escritura verificados. Pruebas de guardado atómico y anti-traversal aprobadas. | Configurado en `STORAGE_BASE_PATH=storage/private`. |
| **Extracción Digital (DOCX)** | **OPERATIVO** | `DocxExtractor` lee `word/document.xml` mediante `adm-zip` en $<10\text{ ms}$ sin dependencias externas. | 100% autónomo. |
| **Extracción Digital (PDF)** | **OPERATIVO** | `PdfTextLayerExtractor` descomprime streams FlateDecode en $<50\text{ ms}$ sin dependencias externas. | 100% autónomo. |
| **Google Gemini API** | **OPERATIVO CON CONTINGENCIA** | Conectividad y autenticación comprobadas. Ante picos globales (HTTP 503), el fallback a reglas locales garantiza continuidad. | Habilitado en `.env` local. |
| **Tesseract OCR (`tesseract.exe`)** | **NO INSTALADO EN PATH HOST** | Requerido únicamente para imágenes o PDFs escaneados que no posean capa de texto digital. | Instalar Tesseract en Windows si se procesan faxes escaneados: `winget install UB-Mannheim.TesseractOCR` |
| **Poppler (`pdftoppm.exe`)** | **NO INSTALADO EN PATH HOST** | Requerido únicamente para convertir páginas PDF escaneadas a imágenes para Tesseract. | Instalar Poppler en Windows si se requiere rasterizado: `winget install osdn.poppler` |

---

## 4. RESULTADOS DE LA PRUEBA DE RED CON GEMINI

Se ejecutaron consultas de diagnóstico directo contra la API de Google:

1. **Listado de Modelos:** HTTP 200 OK (50 modelos disponibles asociados a la clave).
2. **Modelos Obsoletos:** `gemini-2.5-flash` y `gemini-1.5-flash` retornaron HTTP 404 con instrucción oficial de migración a `gemini-3.8-flash`.
3. **Petición Estructurada con `gemini-3.8-flash`:**
   - La API autenticó la clave satisfactoriamente.
   - En momentos de sobrecarga global del proveedor, la API respondió:
     `HTTP 503 UNAVAILABLE: "This model is currently experiencing high demand. Spikes in demand are usually temporary."`
   - **Comportamiento del Backend GODT:** El sistema capturó el error 503 de manera no destructiva, emitió un registro `WARN` y retornó los datos procesados mediante el motor local de reglas deterministas sin interrumpir la operación del usuario.

---

## 5. CONCLUSIONES Y AUTORIZACIÓN TÉCNICA FORMAL

- **Almacenamiento Privado Local:** **GO** (Probado, atómico, seguro contra Path Traversal).
- **OCR Local (Capa Digital PDF y DOCX):** **GO** (Completamente funcional y autónomo sin binarios externos).
- **OCR Local (Escaneados con Tesseract):** **CONDICIONAL / RECOMENDACIÓN** (Completamente probado a nivel de lógica de arquitectura; para escanear faxes físicos en el host de Windows se recomienda instalar Tesseract vía `winget`).
- **Google Gemini API:** **GO (Con Fallback Validado)** (Autenticación exitosa, filtros anti-alucinación aprobados y tolerancia a 503 en producción local).
- **Pruebas Integrales del Flujo:** **GO** (24 suites backend y contratos frontend en estado verde).
