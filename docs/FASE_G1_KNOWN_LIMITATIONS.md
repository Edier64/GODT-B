# GODT REGIONAL 3 — LIMITACIONES CONOCIDAS Y CONDICIONES OPERATIVAS (FASE G.1)
## Ingesta Documental, OCR e Inteligencia Artificial Clínica

**Módulo:** Ingesta y Extracción Documental  
**Versión:** 1.0.0 (Fase G.1)  
**Fecha:** 2026-11-07  

---

## 1. CALIDAD MÍNIMA REQUERIDA EN DOCUMENTOS ESCANEADOS E IMÁGENES

El motor de extracción híbrido (Capa de texto digital directa, OpenXML y Tesseract OCR local) opera con máxima precisión bajo las siguientes tolerancias técnicas:

| Parámetro | Valor Recomendado | Valor Mínimo Aceptable | Comportamiento si se degrada |
| :--- | :--- | :--- | :--- |
| **Resolución de imagen** | 300 DPI | 150 DPI | Por debajo de 150 DPI la tasa de error en caracteres numéricos (cédulas, fechas) se incrementa significativamente. |
| **Inclinación (Skew angle)** | $0^\circ$ (alineado) | $\pm 5^\circ$ | Inclinaciones superiores a $10^\circ$ impiden que las expresiones regulares asocien etiquetas contiguas. |
| **Contraste / Fondo** | Texto negro sobre fondo blanco puro | Relación de contraste $\ge 4.5:1$ | Fondos con sombras de fotocopiadora o marcas de agua oscuras pueden ocultar decimales en valores de laboratorio. |
| **Formato de archivo** | PDF digital original o PNG sin compresión con pérdida | JPEG con calidad $\ge 85\%$ | Artefactos JPEG de alta compresión alrededor del texto provocan falsos positivos en caracteres como `8` vs `3` o `0` vs `O`. |

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

## 5. DEPENDENCIAS EXTERNAS Y MODO DE CONTINGENCIA OFFLINE

1. **Privacidad de Datos Clínicos:**
   - La arquitectura de Fase G.1 opera de manera **100% local y offline por defecto**.
   - No se envían documentos, imágenes ni datos personales a proveedores externos de IA en la nube (como OpenAI o Google Gemini), protegiendo la confidencialidad médica según la Ley Estatutaria 1581 de 2012 de Colombia.
2. **Modo de Contingencia sin Redis/BullMQ:**
   - Si Redis no está disponible o el contenedor de colas está detenido, el backend activa el fallback en proceso (`inline processing`) para documentos digitales y DOCX, permitiendo que el flujo operativo de donación continúe sin interrupciones.
3. **Activación Opcional de Modelos de Lenguaje Avanzados:**
   - Si en el futuro la institución decide habilitar un modelo de lenguaje externo o local (vLLM / Ollama), se requerirá la configuración explícita de `AI_PROVIDER_ENABLED=true` y el consentimiento en el protocolo de privacidad institucional.
