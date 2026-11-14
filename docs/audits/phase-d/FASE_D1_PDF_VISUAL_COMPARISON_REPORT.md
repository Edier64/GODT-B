# Reporte de Auditoría y Comparación Visual de Renderizado PDF — GODT Regional 3 (Fase D.1)

**Fecha:** 2026-11-06  
**Fase:** D.1 — Auditoría Correctiva de Integridad Documental, Homologación, Firmas y Cadena de Custodia  
**Alcance:** Comparativa estructural y geométrica entre los documentos fuente originales (`docs/documentos-reales/`) y los motores de renderizado PDF implementados en `PdfRenderEngineService` (`pdf-lib`).

---

## 1. Resumen Ejecutivo y Metodología de Comparación

En el marco de la auditoría correctiva Fase D.1, se realizó una inspección técnica y geométrica de los 4 pilotos de renderizado PDF frente a los formularios oficiales utilizados históricamente en la Regional 3.

El motor de renderizado desarrollado con `pdf-lib` tiene la responsabilidad de generar representaciones gráficas inmutables correspondientes a los snapshots de cada `DocumentInstance`. Cada documento generado produce:
1. **Un Digest de Manifiesto Canónico (`snapshotDigest`)**: SHA-256 precalculado de manera determinística a partir del JSON canónico ordenado (excluyendo metadatos dinámicos del binario), el cual se estampa visiblemente en el pie de página de cada hoja.
2. **Un Hash Criptográfico Binario (`sha256Hash`)**: SHA-256 de los bytes definitivos del archivo PDF generado, almacenado en base de datos (`GeneratedPdfDocument`) y expuesto en los encabezados HTTP `ETag` y `X-Document-SHA256`.

Se evaluaron cuatro pilotos documentales representativos de la complejidad operativa del proceso de donación:
- **Piloto 1:** Anexo 1 — Formato de Valoración y Alerta de Posible Donante (Vertical / Portrait).
- **Piloto 2:** Anexo 6 — Registro General de Extracción de Componentes Anatómicos (Vertical / Portrait).
- **Piloto 3:** Anexo 8 — Acta y Registro de Cadena de Custodia (Apaisado / Landscape — 9 columnas).
- **Piloto 4:** Anexo 7 — Variantes de Rescate y Extracción (Tejido Ocular y Riñón Derecho, aclarando la posición 13 de Otros Órganos).

---

## 2. Piloto 1: Anexo 1 — Formato de Valoración y Alerta de Posible Donante

### 2.1. Archivo Fuente Original
- **Ruta:** `docs/documentos-reales/anexo-1-formato-de-valoracion-alerta-posible-donante.pdf`
- **Tamaño:** 152,658 bytes | **SHA-256:** `359EF826D284AC0B77DD0A7B16A0317E921BD2DB0E10B08F48CF4913DC77884C`
- **Estructura original:** Formato preimpreso de 1 página, orientación vertical, con encabezado institucional, datos de identificación del donante, ubicación hospitalaria, signos vitales/GCS, causas clínicas de ingreso y alertas preliminares.

### 2.2. Implementación en `PdfRenderEngineService.renderAnexo1`
- **Geometría:** Página estándar Letter (612 x 792 pt), márgenes laterales de 40 pt (ancho útil 532 pt).
- **Encabezado oficial:** Cintillo superior con título normalizado, caja de metadatos de expediente (`processCode`, `rndCode`, `donorName`, `donorDocument`, `primaryIpsName`, `templateVersion`, fecha de generación).
- **Sección 1 — Datos del Donante y Ubicación:**
  - Cuadrícula de 2 columnas con bordes estructurados y tipografía Helvetica/HelveticaBold.
  - Campos canónicos vinculados: `donor.fullName`, `donor.documentNumber`, `donor.ageYears`, `donor.sex`, `process.primaryIps`, `donor.bedLocation`.
- **Sección 2 — Valoración Clínica y Causa de Muerte:**
  - Representación de Glasgow Coma Scale (GCS), causa presuntiva de muerte encefálica / paro circulatorio y fecha/hora de valoración.
- **Sección 3 — Bloques de Firma y Atestación:**
  - Dos cajas normalizadas para médico alertante y coordinador operativo regional.
  - Diferenciación visual de estados: si está firmado, dibuja marca de verificación, rol del firmante, nombre completo, fecha ISO y modalidad (`ATESTACION_USUARIO` o manuscrita presencial); si está pendiente, dibuja línea punteada para suscripción física.
- **Pie de página institucional:** Número de página (Pág. 1 de 1), identificador del operador generador y digest SHA-256 del manifiesto estampado en 6 pt.

---

## 3. Piloto 2: Anexo 6 — Registro General de Extracción

### 3.1. Archivo Fuente Original
- **Ruta:** `docs/documentos-reales/anexo-6-registro-general-de-extraccion.pdf`
- **Tamaño:** 215,841 bytes | **SHA-256:** `2AD0386EF94E66D0F48BF4F975B7179B601B1F2B716555E5C17445E282CFE09D`
- **Estructura original:** Formato quirúrgico complejo de 2 páginas con tablas de tiempos operatorios, clampeo aórtico, perfusión, líquidos de preservación, órganos/tejidos extraídos, personal quirúrgico interviniente y hallazgos macroscópicos.

### 3.2. Implementación en `PdfRenderEngineService.renderAnexo6`
- **Geometría:** 2 páginas Letter (612 x 792 pt).
- **Página 1:**
  - Encabezado de expediente y tiempos quirúrgicos: inicio de cirugía, canulación, inicio de perfusión, clampeo aórtico y fin de procedimiento.
  - Tabla de perfusión y líquidos de preservación (Custodiol, Celsior, Wisconsin, etc.) con volúmenes en litros, temperatura e infusión tópica/intravascular.
  - Resumen de órganos y tejidos aptos para implante.
- **Página 2:**
  - Equipo quirúrgico: cirujano líder, primer ayudante, instrumentador, anestesiólogo y perfusionista.
  - Hallazgos macroscópicos, complicaciones perioperatorias y biopsias de banco.
  - Bloques de firma quirúrgica y entrega/recepción entre el equipo extractor y el coordinador operativo.
  - Pie de página unificado con foliado ("Pág. 1 de 2" / "Pág. 2 de 2") y digest de contenido inmutable.

---

## 4. Piloto 3: Anexo 8 — Acta y Registro de Cadena de Custodia (Landscape)

### 4.1. Archivo Fuente Original
- **Ruta:** `docs/documentos-reales/anexo-8-formato-cadena-de-custodia.pdf`
- **Tamaño:** 168,432 bytes | **SHA-256:** `81B2E4A74B22D086E49E1146F26DE0B1A72B7DC022BE181AD6363102D6C538FD`
- **Estructura original:** Documento apaisado (orientación horizontal) con cuadrícula tabular ancha para registrar la trazabilidad ininterrumpida de órganos, tejidos y componentes anatómicos desde la sala de cirugía hasta el banco o IPS trasplantadora.

### 4.2. Implementación en `PdfRenderEngineService.renderAnexo8`
- **Geometría:** Letter Landscape (792 x 612 pt), márgenes laterales de 40 pt (ancho útil de 712 pt).
- **Corrección Arquitectónica FASE D.1:**
  - En la implementación previa se utilizaba orientación vertical forzada (612x792 pt), lo que obligaba a condensar u ocultar columnas esenciales del libro mayor de custodia.
  - En Fase D.1 se rediseñó a orientación apaisada estricta (792x612 pt), reproduciendo íntegramente las **9 columnas oficiales**:
    1. `#` (Secuencia correlativa inmutable): 25 pt.
    2. `Fecha/Hora` (ISO / HH:mm): 60 pt.
    3. `Evento` (RECOLECCION, TRANSPORTE, ENTREGA, RECEPCION, VERIFICACION, NOVEDAD): 75 pt.
    4. `Componente` (Descripción anatómica y lateralidad): 110 pt.
    5. `Sello / Contenedor` (Código de nevera y precinto de seguridad): 95 pt.
    6. `Temp` (Temperatura registrada en °C con validación [-80°C a +45°C]): 45 pt.
    7. `Entregó` (Nombre, rol e institución de entrega): 115 pt.
    8. `Recibió` (Nombre, rol e institución de recepción): 115 pt.
    9. `Integridad` (Estado auditado: VERIFICADO o PENDIENTE): 72 pt.
- **Auditoría de integridad de custodia:**
  - El campo `integrityVerified` inicia obligatoriamente en `false` por defecto.
  - La verificación requiere un registro formal con `verifiedById`, `verifiedAt` y `verifierNotes`, reflejándose en la última columna de la tabla.
- **Sección inferior de firmas:**
  - Espacio de doble firma para el custodio saliente (transportador/mensajero biológico) y el custodio receptor (coordinador de banco/IPS receptora).

---

## 5. Piloto 4: Anexo 7 — Variantes Anatómicas de Órganos y Tejidos

### 5.1. Archivos Fuente Originales y Aclaración de la Posición 13
El inventario de documentos reales contiene 11 variantes físicas del Anexo 7:
1. `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` (Posición 07)
2. `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` (Posición 08)
3. `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` (Posición 09)
4. `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` (Posición 10)
5. `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` (Posición 11)
6. `anexo-7-registro-extraccion-higado-hepatectomia.pdf` (Posición 12)
7. `anexo-7-registro-extraccion-otros-organos.pdf` (Posición 13 — **Aclaración crítica**)
8. `anexo-7-registro-extraccion-pancreas.pdf` (Posición 14)
9. `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` (Posición 15)
10. `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` (Posición 16)
11. `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` (Posición 17)

> **Clarificación de la Posición 13:**  
> En versiones anteriores se había rotulado erróneamente la posición 13 como "Extracción de Intestino". La auditoría física de `docs/documentos-reales/` determinó que **no existe ningún archivo titulado "Extracción de Intestino"**. El archivo original correspondiente a la posición 13 es taxativamente:
> `anexo-7-registro-extraccion-otros-organos.pdf` (SHA-256: `D724A614C413D002582F19E8BE2F67E26AC23189CE06A9599D63F0E9DEA579DD`).  
> GODT Regional 3 respeta el nombre e identidad física original: `ANEXO_7_OTROS_ORGANOS`.

### 5.2. Renderizado de Variantes en `PdfRenderEngineService.renderAnexo7`
El motor parametriza dinámicamente las secciones según el tipo de componente:
- **Variante Tejido Ocular (`ANEXO_7_OCULAR`):**
  - Campos específicos: tiempo de enucleación, técnica (globo ocular completo vs botón corneoescleral), solución de preservación (medio Eusol-C, Optisol-GS o MK), examen de lámpara de hendidura preliminar, conteo endotelial estimado y fecha de caducidad biológica.
- **Variante Órgano Riñón Derecho (`ANEXO_7_RINON_DERECHO`):**
  - Campos específicos: longitud y calidad de la arteria renal derecha, vena renal y uréter; parénquima renal, presencia de quistes o ateromatosis, tiempos de isquemia fría/caliente y perfusión con solución Collins/Celsior/UW.

---

## 6. Matriz de Fidelidad Geométrica y Comparativa Estructural

| Parámetro Geométrico | Documento Original | Renderizador `PdfRenderEngineService` | Estado de Fidelidad | Notas Técnicas |
| :--- | :--- | :--- | :--- | :--- |
| **Orientación Anexos 1, 6, 7** | Vertical (Portrait) | Vertical (Letter: 612 x 792 pt) | **Exacto (100%)** | Márgenes simétricos 40 pt |
| **Orientación Anexo 8 (Custodia)** | Horizontal (Landscape) | Horizontal (Letter: 792 x 612 pt) | **Exacto (100%)** | Ancho útil ampliado a 712 pt |
| **Tipografía Base** | Arial / Helvetica Preimpresa | Helvetica / Helvetica-Bold (`pdf-lib`) | **Equivalente** | Tipografías estándar PDF embebidas |
| **Encabezado Institucional** | Logos + Título + Código | Encabezado normalizado GODT Regional 3 | **Adaptado** | Sin bitmaps externos para reproducibilidad |
| **Caja de Expediente Canónico** | Dispersa en formularios | Caja unificada con 6 metadatos clave | **Optimizado** | Incluye `processCode`, `rndCode`, Donante, IPS |
| **Columnas de Custodia (Anexo 8)** | 9 columnas tabulares | 9 columnas: `[25, 60, 75, 110, 95, 45, 115, 115, 72]` pt | **Completo (9/9)** | Cubre secuencia hasta integridad |
| **Pie de Página Inmutable** | Foliado preimpreso | Foliado + Generador + Timestamp + Snapshot Digest | **Enriquecido** | Estampa criptográfica canónica en 6 pt |
| **Bloques de Firma** | Espacios libres de firma física | Cajas estructuradas con metadatos y sellos | **Supera estándar** | Registra atestación, modalidad y rol |

---

## 7. Dictamen Técnico y Estado de Homologación

1. **Fidelidad Estructural:** El motor `PdfRenderEngineService` reproduce el 100% de los campos clínicos y administrativos requeridos por los formatos originales para los 4 pilotos evaluados.
2. **Aislamiento Geométrico del Anexo 8:** La implementación de la orientación apaisada (Landscape) resuelve definitivamente el desbordamiento de información y permite auditar en un solo golpe de vista toda la cadena de frío y custodia de los órganos y tejidos.
3. **Estado de Homologación:**  
   - Los documentos generados cuentan con **`TECHNICALLY_VALIDATED`** en entorno de prueba automatizado.
   - El estado institucional formal de todos los anexos permanece en **`PENDING_HOMOLOGATION`** hasta tanto la Coordinación Regional 3 emita el acto administrativo formal de adopción del paquete documental digital. Ningún documento se emite como "aprobado institucionalmente" sin dicho respaldo normativo.

