# Matriz inicial de campos documentales

Esta matriz es de diseño y no sustituye la homologación campo a campo por la
autoridad competente. `Precarga` significa que el valor puede provenir del
expediente o de OCR validado; no significa que el formulario pueda omitir una
revisión humana.

| Documento/sección | Campo o grupo | Tipo | Oblig. | Fuente | Entidad/procedencia | Validación/UI |
|---|---|---|---|---|---|---|
| Anexo 1 / identificación | Código consulta RND, fechas y horas | string/date-time | Revisar | Expediente/RND/manual | DonorRecord y legalización | Fecha-hora, lectura |
| Anexo 1 / donante | IPS, edad, sexo, etnia, nacionalidad | string/number/catalog | Revisar | Expediente/manual | DonorRecord | Catálogos configurables |
| Anexo 1 / ingreso | servicio, Glasgow, grupo/RH, remisión, estancia | catalog/number | Revisar | Expediente/manual/OCR validado | DonorRecord/clinicalData | Rangos y condicionales |
| Anexo 1 / antecedentes | nueve antecedentes y sí/no con detalle | boolean + text | Condicional | Historia/OCR/manual | clinicalData/SourceDocument | Mostrar detalle si sí |
| Anexo 1 / examen y monitoreo | antropometría, signos, ventilación, balances | number/date-time/catalog | Revisar | Historia/OCR/manual | clinicalData | Unidades y rangos |
| Anexo 1 / manejo y laboratorios | medicamentos, pruebas, laboratorios | repetible + number | Condicional | SourceDocument/OCR validado/manual | clinicalData | Tablas repetibles |
| Anexo 2 / notificación | coordinador, institución, donante, RND y fecha | string/date-time | Según formato | Expediente/legalización | DonorRecord/Audit | Solo lectura para datos precargados |
| Anexo 2 / deudos | nombre, identificación, parentesco, notificación | repetible | Revisar | Manual | DonationRepresentative | Mínimo y firmas según validación legal |
| Anexo 2 / constancias | notificador, testigo, observaciones, anexos | string/signature | Revisar | Manual/expediente | Legalization/response | Firma obligatoria según regla aprobada |
| Anexo 3 / consentimiento | representantes, identidad y parentesco | repetible | Condicional | Manual | DonationRepresentative | Regla de mecanismo; mínimo institucional |
| Anexo 3 / autorización | finalidad, sí/no, restricciones | boolean + text | Revisar | Manual | Legalization/response | No inferir consentimiento |
| Anexo 3 / firmas | representantes, entrevistadores y registros | signature/reference | Revisar | Manual/archivo | SourceDocument/response | Firma y trazabilidad |
| Anexo 4 / oferta | legalización, RND, IPS, fechas, muerte | catalog/date-time | Revisar | Expediente validado | DonorRecord/legalization | Precarga controlada |
| Anexo 4 / antecedentes y laboratorios | clínicos, infecciosos, HLA y sociales | grupos repetibles | Revisar | OCR validado/manual | clinicalData/SourceDocument | Conflictos visibles |
| Anexo 4 / oferta anatómica | órgano/tejido, donado, rescatado, instituciones | tabla repetible | Revisar | Expediente/manual | Recovery/TissueProcedure | Catálogo y causa |
| Anexo 5 | muestra, destino, causa, exámenes solicitados | catalog + repeatable | Revisar | Expediente/manual | SourceDocument/response | Casillas y catálogo |
| Anexo 6 | tiempos de cirugía, órganos, personal, soluciones | date-time + tables | Revisar | Recovery/manual | Organ/Tissue recovery | Tablas repetibles |
| Anexo 7 tejido | datos donante, valoración, autorización | grupos | Revisar | Expediente/manual | Donor/Legalization | Compartido entre variantes |
| Anexo 7 tejido | anatomía, hallazgos, muestras, checklist | variante específica | Condicional | Manual/OCR validado | TissueRecoveryProcedure | Esquema por variante |
| Anexo 7 órgano | código, IPS, fecha, técnica, hallazgos | string/date-time/text | Revisar | Expediente/manual | OrganRecoverySurgery | Variante por órgano |
| Anexo 7 órgano | medidas/estructuras específicas | number/text | Condicional | Manual | OrganRecoverySurgery | Solo riñones/hígado/páncreas |
| Anexo 8 | caso, historia, elemento, custodios y traslados | strings + repeatable table | Revisar | Manual | SourceDocument/chain response | No reordenar secuencia |
| Anexo 9 | cuerpo, diagnóstico, órganos/tejidos y anexos | strings + table | Revisar | Expediente/recovery | Donor/Recovery | Checklist de anexos |
| Hemodilución | peso, volúmenes, transfusiones y cálculo | number/date-time | Revisar | Manual/calculado | clinicalData/response | Fórmula debe ser validada |
| COVID Tissue Bank | criterios epidemiológicos/clínicos y fuente | boolean + text | Revisar | Manual/entrevista | SourceDocument/response | No inferir respuestas |
| HC Donante / historia Tissue Bank | identificación, antecedentes, muerte, pruebas | grupos clínicos extensos | Revisar | Historia/OCR validado/manual | SourceDocument/clinicalData | Acceso restringido |

## Reglas de fuente

1. Los datos del expediente se precargan solo desde valores oficiales y
   autorizados.
2. OCR `PENDIENTE` o `RECHAZADO` nunca es fuente de formulario.
3. OCR `CONFIRMADO` o `MODIFICADO` conserva documento, campo, usuario y fecha.
4. Un conflicto entre expediente, OCR y diligenciamiento manual se presenta al
   usuario; no se resuelve sobrescribiendo automáticamente.
5. La obligatoriedad de cada campo debe ser propiedad de la versión de
   plantilla, no del código del frontend.
