# Análisis y homologación documental

## Matriz de correspondencia

| Fuente | Modelo de plantilla | Entidades relacionadas | Estructura comprobada | Estado |
|---|---|---|---|---|
| Anexo 1 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, `SourceDocument`, `OcrExtractedField` | Identificación, alerta, antecedentes, examen físico, monitoreo, manejo, medicamentos, ayudas diagnósticas y laboratorios | Estructura identificada |
| Anexo 2 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, `DonationLegalization`, `DonationRepresentative` | Notificación, dos bloques de persona notificada, notificador, testigo, observaciones y certificado RND | Estructura identificada |
| Anexo 3 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, `DonationLegalization`, `DonationRepresentative` | Fecha/ciudad, representantes, identidad del fallecido, autorización por finalidad, restricciones y firmas | Estructura identificada; regla de aplicabilidad pendiente |
| Anexo 4 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, legalización, procedimientos de recuperación | Donante, muerte, antecedentes, laboratorios, perfil infeccioso, HLA, sociales, epidemiología y oferta anatómica | Estructura identificada |
| Anexo 5 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, `SourceDocument` | Remisión de muestras, destino, tipo de donante, muestras, exámenes, hemograma y coordinador | Estructura identificada |
| Anexo 6 | `DocumentTemplate` + `TemplateVersion` | Recuperación de órganos/tejidos, `DonorRecord` | Tiempos, órganos rescatados, personal, preservación, tejidos y hallazgos | Estructura identificada |
| Anexo 7 tejido | Una plantilla base + versiones/variantes | `DonorRecord`, legalización, procedimientos de tejido, `SourceDocument` | Bloque común medicolegal, autorización, procedimiento, checklist y anatomía específica | Variantes identificadas |
| Anexo 7 órgano | Plantilla base parametrizada + variantes | `DonorRecord`, recuperación de órganos | Código, IPS, fecha, técnica, hallazgos, observaciones y firma; campos anatómicos por órgano | Variantes identificadas |
| Anexo 8 | `DocumentTemplate` + `TemplateVersion` | `DocumentInstance`, revisiones, `SourceDocument` | Número de caso, descripción de EMP/EF, custodios y transferencias secuenciales | Tabla secuencial pendiente |
| Anexo 9 | `DocumentTemplate` + `TemplateVersion` | `DonorRecord`, recuperación, `SourceDocument` | Carta a INMLCF, cuerpo, diagnóstico, componentes y anexos | Estructura identificada |
| Hemodilución | No publicar como plantilla sin regla aprobada | `SourceDocument` / respuesta auxiliar | Entradas de peso, volumen, transfusión y cálculo | Regla institucional pendiente |
| Evaluación COVID | Documento fuente o plantilla separada | `SourceDocument` | Criterios epidemiológicos y clínicos con respuestas | Requiere revisión clínica |
| Historias clínicas | `SourceDocument` | `DonorRecord`, `SourceDocument`, OCR validado | Antecedentes, hospitalización, pruebas, procedimientos y extracción de tejidos | Solo fuente sensible |

## Campos identificados

Los campos se clasifican por evidencia visible en el documento, no por una
suposición de dominio:

- Identificación: código/consulta RND, tipo y número de documento, nombre,
  edad, sexo, ciudad, IPS, historia, fechas y horas.
- Donación/legalización: mecanismo, certificado RND, representantes,
  parentesco, notificación, finalidad, autorización, restricciones, testigo y
  observaciones.
- Valoración: antecedentes con indicador Sí/No y detalle, examen físico,
  signos, monitoreo, ventilación, líquidos, medicamentos y laboratorios.
- Recuperación: componente, institución, causa de no extracción, procedimiento,
  personal, soluciones, banco responsable, hallazgos y firmas.
- Trazabilidad/forense: SIRDEC, noticia criminal, inspección, prendas,
  pertenencias, EMP/EF, custodios y transferencias.

La obligatoriedad no se infiere de la presencia de una línea o casilla. Debe
definirse en la versión institucional después de revisión funcional, clínica y
jurídica.

## Variantes

Las fuentes muestran cuatro actas de tejido y siete fichas de órgano. Las
actas comparten bloques generales, valoración medicolegal, autorización y
procedimiento, pero difieren en anatomía. Las fichas de órgano comparten
identificación, técnica, hallazgos, observaciones y firma, con campos
específicos para corazón, hígado, páncreas, pulmón, riñones y otros órganos.
Los riñones tienen estructura común y lateralidad distinta.

No se publicó ninguna variante. La selección de Anexo 2/3 y las condiciones de
aplicabilidad requieren homologación institucional.
