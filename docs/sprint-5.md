# Sprint 5 - Validación de respuestas documentales

## Alcance implementado

- Se creó `DocumentResponseValidator`, separado de
  `DocumentDefinitionValidator`.
- La validación usa Ajv 2020-12 con `ajv-formats`.
- Se soportan tipos, requeridos, longitudes, patrones, formatos, rangos,
  enumeraciones, objetos anidados, arrays y `additionalProperties`.
- Los errores incluyen ruta JSON, keyword, mensaje y parámetros.
- `validateInstance` carga el `jsonSchema` de la `TemplateVersion` exacta de la
  instancia.
- Las respuestas inválidas actualizan únicamente el resumen de validación de
  la revisión actual y no cambian la instancia a `IN_REVIEW`.
- No se modifican `clinicalData`, procedencia OCR ni el historial de
  revisiones.
- No se requiere migración: `validationSummary` ya es JSONB.

## Evidencia

| Criterio | Estado | Evidencia |
|---|---|---|
| Validador separado | VERIFIED | `DocumentResponseValidator` y pruebas unitarias |
| Draft 2020-12 | VERIFIED | Ajv 2020 con `$schema` Draft 2020-12 |
| Tipos y requeridos | VERIFIED | Pruebas unitarias e integración |
| Formatos, patrones y longitudes | VERIFIED | Pruebas unitarias |
| Rangos y enumeraciones | VERIFIED | Pruebas unitarias |
| Objetos y arrays | VERIFIED | Pruebas unitarias |
| Propiedades no declaradas | VERIFIED | `additionalProperties: false` e integración |
| Versión exacta de plantilla | VERIFIED | `validateInstance` consulta `instance.templateVersionId` |
| No aprobación inválida | VERIFIED | Instancia permanece `DRAFT` en integración |
| Migración Sprint 5 | VERIFIED | No es necesaria; `validationSummary` existente almacena los errores en JSONB |

## Pendientes conservados

- Prueba específica de rollback de procedencia de Sprint 4.
- Homologación institucional completa del catálogo de mappings canónicos.
- Administración de recursos documentales, dependencias y frontend quedan
  fuera de esta fase.
