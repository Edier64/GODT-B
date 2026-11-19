# GODT REGIONAL 3 — FASE G.1
## AUDITORÍA DEL INVENTARIO DOCUMENTAL Y HOMOLOGACIÓN DE FORMATOS
### Documento de Entrega Técnica: FASE_G1_DOCUMENT_INVENTORY_AUDIT.md

---

## 1. RESUMEN EJECUTIVO Y ORIGEN EMPÍRICO DEL INVENTARIO

La auditoría técnica del repositorio documental de **GODT Regional 3** (`docs/documentos-reales`) constató la recepción original de **23 archivos físicos**.

El análisis forense y documental demuestra de manera concluyente que:
1. **19 archivos corresponden a Formatos Oficiales Homologados** de la Red de Donación y Trasplantes (Anexos 1 al 6, las 11 variantes especializadas del Anexo 7, el Anexo 8 y el Anexo 9).
2. **4 archivos corresponden a Documentos Fuente Complementarios** (historias clínicas, cálculo de hemodilución y tamizaje de riesgo). Estos documentos **no son formatos oficiales** de captura ni deben registrarse como plantillas institucionales.
3. **Las Posiciones 20 a 23 del Paquete Documental (`ProcessPackage`)** se mantienen en estado `PENDING_HOMOLOGATION` (Posición Reservada sin plantilla oficial publicada), preservando la integridad del paquete normativo de 23 posiciones sin inventar formatos ni alterar versiones publicadas.

---

## 2. MATRIZ DE AUDITORÍA Y CORRESPONDENCIA DE LOS 23 ARCHIVOS

| Archivo Recibido en `docs/documentos-reales` | Tipo de Documento | Clasificación GODT | Código de Plantilla | Posición en Paquete | Estado de Homologación |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `anexo-1-formato-de-valoracion-alerta-posible-donante.pdf` | PDF | Formato Oficial | `anexo_1` | Posición 1 | `VALIDATED` / `PUBLISHED` |
| `anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf` | PDF | Formato Oficial | `anexo_2` | Posición 2 | `VALIDATED` / `PUBLISHED` |
| `anexo-3-formato-consentimiento-donacion-legalizacion.pdf` | PDF | Formato Oficial | `anexo_3` | Posición 3 | `VALIDATED` / `PUBLISHED` |
| `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf` | PDF | Formato Oficial | `anexo_4` | Posición 4 | `VALIDATED` / `PUBLISHED` |
| `anexo-5-formato-de-remision-de-muestras.docx` | DOCX | Formato Oficial | `anexo_5` | Posición 5 | `VALIDATED` / `PUBLISHED` |
| `anexo-6-registro-general-de-extraccion.pdf` | PDF | Formato Oficial | `anexo_6` | Posición 6 | `VALIDATED` / `PUBLISHED` |
| `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` | PDF | Variante Anexo 7 | `anexo_7_ocular` | Posición 7 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` | PDF | Variante Anexo 7 | `anexo_7_cardiovascular` | Posición 8 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` | PDF | Variante Anexo 7 | `anexo_7_osteomuscular` | Posición 9 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` | PDF | Variante Anexo 7 | `anexo_7_piel` | Posición 10 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` | PDF | Variante Anexo 7 | `anexo_7_corazon` | Posición 11 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-higado-hepatectomia.pdf` | PDF | Variante Anexo 7 | `anexo_7_higado` | Posición 12 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-otros-organos.pdf` | PDF | Variante Anexo 7 | `anexo_7_otros_organos` | Posición 13 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-pancreas.pdf` | PDF | Variante Anexo 7 | `anexo_7_pancreas` | Posición 14 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` | PDF | Variante Anexo 7 | `anexo_7_pulmon` | Posición 15 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` | PDF | Variante Anexo 7 | `anexo_7_rinon_derecho` | Posición 16 | `VALIDATED` / `PUBLISHED` |
| `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` | PDF | Variante Anexo 7 | `anexo_7_rinon_izquierdo` | Posición 17 | `VALIDATED` / `PUBLISHED` |
| `anexo-8-formato-cadena-de-custodia.pdf` | PDF | Formato Oficial | `anexo_8` | Posición 18 | `VALIDATED` / `PUBLISHED` |
| `anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf` | PDF | Formato Oficial | `anexo_9` | Posición 19 | `VALIDATED` / `PUBLISHED` |
| `Cálculo Hemodilución.docx` | DOCX | **Documento Fuente** | N/A (`SourceDocument`) | N/A | **FUENTE CLÍNICA COMPLEMENTARIA** |
| `Evaluación de riesgo COVID 19 Tissue Bank.docx` | DOCX | **Documento Fuente** | N/A (`SourceDocument`) | N/A | **FUENTE CLÍNICA COMPLEMENTARIA** |
| `HC Donante 2024.docx` | DOCX | **Documento Fuente** | N/A (`SourceDocument`) | N/A | **FUENTE CLÍNICA COMPLEMENTARIA** |
| `Historia Clínica Tissue Bank.docx` | DOCX | **Documento Fuente** | N/A (`SourceDocument`) | N/A | **FUENTE CLÍNICA COMPLEMENTARIA** |

---

## 3. DESGLOSE DE LAS 11 VARIANTES DEL ANEXO 7

El Anexo 7 no es un formulario genérico único; se subdivide en 11 actas y fichas de extracción altamente especializadas:

### 3.1 Cuatro (4) Variantes de Rescate de Tejidos
1. **Tejido Ocular (`anexo_7_ocular`):** Córneas, esclera, evaluación en lámpara de hendidura, tiempos de preservación.
2. **Tejido Cardiovascular (`anexo_7_cardiovascular`):** Válvula aórtica, válvula pulmonar, conductos y parches pericárdicos.
3. **Tejido Osteomuscular (`anexo_7_osteomuscular`):** Huesos largos, tendones, meniscos y tejido osteotendinoso.
4. **Tejido Piel (`anexo_7_piel`):** Extracción con dermatomo, espesor parcial o total, área corporal y empaque estéril.

### 3.2 Siete (7) Fichas de Extracción Quirúrgica de Órganos
5. **Corazón (`anexo_7_corazon`):** Cardiectomía para trasplante cardíaco, solución de cardioplejía y tiempo de pinzamiento aórtico.
6. **Hígado (`anexo_7_higado`):** Hepatectomía, canulación de vena porta, biopsia de cuña hepática y solución de preservación.
7. **Otros Órganos (`anexo_7_otros_organos`):** Intestino multivisceral, bazo o bloques anatómicos compuestos.
8. **Páncreas (`anexo_7_pancreas`):** Pancreatectomía, ligaduras vasculares y preservación para islotes o trasplante en bloque.
9. **Pulmón (`anexo_7_pulmon`):** Neumonectomía unilateral o en bloque bipulmonar, gasometría selectiva por vena pulmonar.
10. **Riñón Derecho (`anexo_7_rinon_derecho`):** Nefrectomía derecha, anomalías anatómicas arteriales/venosas y tiempo de perfusión.
11. **Riñón Izquierdo (`anexo_7_rinon_izquierdo`):** Nefrectomía izquierda, longitud de vena renal y estado parenquimatoso.

---

## 4. AUDITORÍA DE LAS POSICIONES 20 A 23 DEL `PROCESSPACKAGE`

Las posiciones 20 a 23 fueron reservadas en el diseño inicial para complementos normativos que aún carecen de formato estandarizado por el Ministerio de Salud o el Instituto Nacional de Salud:

- **Posición 20 (`POS_NORMATIVA_20`):** `PENDING_HOMOLOGATION`.
- **Posición 21 (`POS_NORMATIVA_21`):** `PENDING_HOMOLOGATION`.
- **Posición 22 (`POS_NORMATIVA_22`):** `PENDING_HOMOLOGATION`.
- **Posición 23 (`POS_NORMATIVA_23`):** `PENDING_HOMOLOGATION`.

**Determinación Técnica:**
Los 4 documentos complementarios en DOCX (`Cálculo Hemodilución`, `Evaluación de riesgo COVID 19`, `HC Donante 2024` e `Historia Clínica Tissue Bank`) son **documentos fuente aportados por las IPS**, no formatos oficiales. Promoverlos artificialmente a las posiciones 20-23 violaría la taxonomía de la Red. Se mantienen correctamente como `SourceDocument` procesables mediante OCR e IA.

---

## 5. REGLAS DE DEPENDENCIAS Y APLICABILIDAD

1. **Obligatoriedad Base:**
   - Anexos 1, 4, 5, 6 y 8 son obligatorios (`isMandatory: true`, `APLICABLE`).
2. **Condicionalidad Legal:**
   - Anexo 2: Aplica cuando la donación opera bajo Presunción Legal (Ley 1805 de 2016).
   - Anexo 3: Aplica cuando la donación requiere Consentimiento Familiar Expreso (menores de edad o extranjeros no residentes).
   - Anexo 9: Aplica exclusivamente cuando la causa de muerte tiene implicaciones médico-legales (`donor.causeOfDeathMedicolegal === true`).
3. **Condicionalidad Anatómica:**
   - Las 11 variantes del Anexo 7 son condicionales (`CONDICIONAL`), activadas según los órganos y tejidos efectivamente rescatados y autorizados en el proceso de donación.

---

## 6. CONCLUSIÓN DE LA AUDITORÍA

El inventario de 19 plantillas oficiales en `official-template-definitions.ts` y las 23 posiciones del paquete en `process-package.ts` se encuentran debidamente alineados con la realidad normativa de la Regional 3. No existen inconsistencias ni duplicidades en las definiciones de plantillas.

