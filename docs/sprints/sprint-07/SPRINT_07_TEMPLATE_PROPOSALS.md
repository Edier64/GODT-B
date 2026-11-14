# Propuestas de plantillas no publicadas

Estas propuestas son artefactos de análisis. No son versiones `DRAFT` creadas
en PostgreSQL, no se registran en el catálogo y no autorizan diligenciamiento.

## Convención común

Cada propuesta usaría:

- `DocumentTemplate.templateCode` estable.
- `TemplateVersion.versionNumber`.
- `jsonSchema` para reglas de datos.
- `uiSchema` para secciones, etiquetas y tablas.
- `mappingConfig` únicamente con entradas existentes en
  `CANONICAL_MAPPING_CATALOG`.
- `DocumentInstance` y `DocumentResponseRevision` para historial.
- `DocumentFieldProvenance` para fuente, documento y validación.

## Anexo 2 — estructura candidata

Evidencia: encabezado de notificación, coordinador e institución, fallecido,
consulta RND, persona notificada, parentesco, notificador, testigo,
observaciones y certificado.

```json
{
  "type": "object",
  "properties": {
    "notification": {
      "type": "object",
      "properties": {
        "coordinatorName": { "type": "string" },
        "institution": { "type": "string" },
        "deceasedName": { "type": "string" },
        "identityType": { "type": "string" },
        "identityNumber": { "type": "string" },
        "rndQueryCode": { "type": "string" },
        "notifiedPeople": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "fullName": { "type": "string" },
              "identityNumber": { "type": "string" },
              "relationship": { "type": "string" }
            }
          }
        },
        "notifier": { "type": "object" },
        "witness": { "type": "object" },
        "observations": { "type": "string" }
      }
    }
  }
}
```

Los campos requeridos, catálogos de identificación, firma y número máximo de
notificados quedan pendientes.

## Anexo 5 — estructura candidata

Evidencia: ciudad, coordinación regional, fecha/hora, institución remitente,
destino, tipo y nombre del donante, muestra, causa, grupo/Rh, antecedentes,
exámenes solicitados, observaciones, otros exámenes y hemograma.

La lista de exámenes debe representarse como colección de opciones solo
después de confirmar el catálogo institucional; no se asignan valores
predeterminados.

## Anexo 7 — composición por variante

Se propone una composición declarativa:

- `organ-extraction-base`: código, IPS, fecha, técnica, hallazgos,
  observaciones y firmante.
- `organ-heart`: campos observados de cardiectomía y hallazgos en banco.
- `organ-liver`: parénquima, arteria hepática, vena porta, vena hepática y
  biopsia.
- `organ-other`: componente y lateralidad.
- `organ-pancreas`: parénquima, hemorragias, esteatonecrosis, edema y tejido
  graso.
- `organ-lung`: lateralidad y neumonectomía.
- `organ-kidney`: lateralidad, medidas, parénquima, vasos, uréter y biopsia.
- `tissue-rescue-base`: información general, valoración medicolegal,
  autorización, procedimiento, checklist y firmas.
- Variantes de tejido: anatomía ocular, cardiovascular, osteomuscular o piel.

Estas son claves de diseño, no nombres de campos publicados. Antes de crear
versiones deben definirse códigos institucionales, reglas, catálogos y
procedencia.

## UI Schema candidato

Las secciones observadas pueden representarse con `uiSchema.sections`. Las
tablas se declararían con `fieldConfigs` y `component: "table"` únicamente
cuando el `items.properties` del JSON Schema haya sido aprobado. El Anexo 8
requiere además una regla explícita de secuencia y no reordenamiento, que el
backend actual aún no expone como contrato.

## No propuesto como plantilla

- `HC Donante 2024.docx`.
- `Historia Clínica Tissue Bank.docx`.
- `Evaluación de riesgo COVID 19 Tissue Bank.docx`, hasta revisión clínica.
- `Cálculo Hemodilución.docx`, hasta aprobar fórmula, unidades y reglas.
