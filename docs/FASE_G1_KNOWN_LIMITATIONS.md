# GODT REGIONAL 3 — LIMITACIONES CONOCIDAS Y CONDICIONES OPERATIVAS (FASE G.1 & G.1.1)
## Ingesta Documental, OCR Local e Inteligencia Artificial en la Nube

**Módulo:** Ingesta y Extracción Documental  
**Versión:** 1.1.0 (Fase G.1.1)  
**Fecha:** 2026-11-07  

---

## 1. CALIDAD MÍNIMA REQUERIDA EN DOCUMENTOS ESCANEADOS E IMÁGENES

El motor de extracción híbrido (Capa de texto digital directa, OpenXML, Tesseract OCR local y Google Gemini) opera con máxima fidelidad bajo las siguientes tolerancias técnicas:

| Parámetro | Valor Recomendado | Valor Mínimo Aceptable | Comportamiento ante Degradación |
| :--- | :--- | :--- | :--- |
| **Resolución de imagen** | 300 DPI | 150 DPI | Por debajo de 150 DPI la tasa de error en caracteres numéricos (cédulas, fechas) se incrementa significativamente. |
| **Inclinación (Skew angle)** | $0^\circ$ (alineado) | $\pm 5^\circ$ | Inclinaciones superiores a $10^\circ$ impiden que las expresiones regulares asocien etiquetas contiguas. |
| **Contraste / Fondo** | Texto negro sobre fondo blanco puro | Relación de contraste $\ge 4.5:1$ | Fondos con sombras de fotocopiadora o marcas de agua oscuras pueden ocultar decimales en valores de laboratorio. |
| **Formato de archivo** | PDF digital original o PNG sin compresión | JPEG con calidad $\ge 85\%$ | Artefactos JPEG de alta compresión alrededor del texto provocan falsos positivos en caracteres como `8` vs `3` o `0` vs `O`. |

---

## 2. TEXTO MANUSCRITO (HANDWRITING) VS. TEXTO MECANOGRAFIADO

1. **Texto Mecanografiado / Digital:**
   - La tasa de acierto y confianza es superior al $95\%$ en PDF electrónicos exportados desde sistemas de historias clínicas (Epicrisis, SAP, Servinte, Dinámica).
   - En documentos Word (`.docx`), la fidelidad es del $100\%$ sin pérdida de formato en celdas de tabla.
2. **Texto Manuscrito (Notas de evolución médica a mano, firmas, enmendaduras):**
   - El motor OCR local estándar (Tesseract v5 con modelo `spa`) está optimizado para tipografías impresas y mecanografiadas.
   - **Limitación:** El reconocimiento de caligrafía médica cursiva o desestructurada presenta una tasa de confianza típicamente inferior al $40\%$.
   - **Procedimiento operativo:** Las anotaciones manuscritas no reconocidas se marcarán con baja confianza o se omitirán de los candidatos, requiriendo que el coordinador las transcriba directamente en el formulario asistido.

---

## 3. LÍMITES DE TAMAÑO Y PÁGINAS: SÍNCRONO VS. ASÍNCRONO

| Modalidad | Tamaño Máximo | Límite de Páginas | Cola / Tiempo de Espera |
| :--- | :--- | :--- | :--- |
| **Extracción Síncrona (En memoria)** | Hasta $20\text{ MB}$ para `.docx` o PDF con capa digital directa | Hasta 50 páginas (texto digital) | $< 1\text{ segundo}$ de respuesta en la API. |
| **Procesamiento Asíncrono (BullMQ / Redis)** | Hasta $20\text{ MB}$ para PDF escaneado que requiera rasterización | Hasta 15 páginas por documento | Encolado en `ocr-queue` con notificación de estado (`PENDIENTE` $\to$ `PROCESANDO` $\to$ `COMPLETADO`). |
| **Límite Absoluto del Sistema** | $20\text{ MB}$ por archivo individual | $> 50$ páginas escaneadas | Rechazado o truncado a las primeras 20 páginas para evitar agotamiento de memoria del contenedor. |

---

## 4. CONDICIONES QUE EXIGEN INTERVENCIÓN HUMANA TOTAL

El sistema aplicará la política estricta **Human-In-The-Loop** en cualquiera de las siguientes circunstancias:

1. **Divergencia entre fuentes:** Si el documento extrae un valor que contradice un dato canónico ya confirmado en el `DonationProcess` (por ejemplo, discrepancia en el grupo sanguíneo o en la causa de defunción), el valor extraído permanecerá en estado de alerta hasta que el coordinador seleccione cuál prevalece mediante el modal de revisión.
2. **Puntaje de confianza inferior a 0.70:** Los candidatos con puntuaciones bajas se destacan en amarillo/naranja y no permiten propagación en bloque ("Propagar Todo"), forzando al usuario a inspeccionar y validar manualmente cada campo.
3. **Documentos con ruido severo o páginas en blanco:** Si un documento no arroja ningún candidato con confianza superior al umbral mínimo, el trabajo OCR finaliza con advertencia `OCR_LOW_CONFIDENCE`, notificando al usuario que debe diligenciar los datos manualmente o adjuntar una copia legible.

---

## 5. PROVEEDORES EXTERNOS (GOOGLE GEMINI) Y TOLERANCIA A SOBRECARGA

1. **Gobernanza de Activación:**
   - Variable canónica: `AI_EXTERNAL_PROVIDER_ENABLED=true` (con soporte para el alias `AI_PROVIDER_ENABLED`).
   - Requiere `NODE_ENV=development` y `GEMINI_API_KEY` válida.
   - En `staging` y `production`, el proveedor se desactiva por defecto protegiendo la confidencialidad médica.
2. **Disponibilidad de Modelos en Google Generative Language API:**
   - La API v1beta de Google retiró los modelos heredados (`gemini-2.5-flash` y `gemini-1.5-flash`), respondiendo con código 404 e indicando migración a `gemini-3.8-flash`.
   - **Comportamiento ante sobrecarga (Status 503 / 429):** Durante picos globales de demanda, la API de Google puede responder con código HTTP 503 (`UNAVAILABLE: This model is currently experiencing high demand`).
   - **Mitigación Arquitectural:** El adaptador captura estos fallos de forma no destructiva y activa inmediatamente el fallback a reglas locales y OCR local, garantizando que el usuario en el hospital nunca se quede sin resultados de extracción.
3. **Estado de Binarios del Sistema Operativo Host (Windows):**
   - **Documentos Digitales (.docx y PDF nativos):** Funcionamiento 100% operativo sin dependencias externas del sistema operativo.
   - **Documentos Escaneados / Mapas de Bits:** Requieren la presencia física de `tesseract.exe` (con paquete `spa.traineddata`) y Poppler (`pdftoppm.exe`) en el PATH del sistema host o en contenedores Docker dedicados.
