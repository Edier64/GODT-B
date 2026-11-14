# Sprint 3 — Fundación del motor documental dinámico

## Implementado y probado

- Catálogo documental extensible con código interno estable, nombre, categoría,
  estado y metadatos.
- Versiones de plantilla con JSON Schema, UI Schema, mappings, configuración de
  dependencias/generación y hash de definición.
- Flujo `DRAFT -> VALIDATED -> PUBLISHED`.
- Publicación administrativa con autorización, transacción y auditoría.
- Versiones publicadas protegidas contra modificación lógica.
- `DocumentInstance` asociado a donante y `TemplateVersion`.
- Revisiones append-only con número único por instancia.
- Referencia transaccional a la revisión actual.
- Procedencia de campos y estados de conflicto.
- Rechazo de fuentes OCR pendientes/rechazadas como fuentes oficiales.
- Control de acceso por IPS para instancias y expediente.
- Restricciones `RESTRICT` para conservar historia.
- API REST de catálogo, versiones e instancias.

## Validación ejecutada

| Comando | Resultado |
|---|---|
| `npm test -- --runInBand` | 7 suites, 16 tests passed |
| `$env:RUN_INTEGRATION_TESTS="true"; npm run test:integration` | 4 suites, 7 tests passed |
| `npm run build` | Correcto |
| `npm run lint` | Correcto |
| `npm run format:check` | Correcto |
| `npx prisma validate` | Correcto |
| `npx prisma migrate status` | 6 migraciones, base sincronizada |

## Limitaciones del sprint

- No se implementaron los 23 formularios.
- No se implementó generación PDF ni PDF/A-1a.
- No se implementó el motor definitivo de dependencias.
- No se implementó migración automática entre versiones.
- La validación JSON Schema es estructural para la fundación; la validación
  completa de instancias y tipos debe ampliarse antes de producción.
- Las reglas jurídicas, clínicas, participantes y catálogos oficiales siguen
  sujetas a homologación institucional.
- El endpoint de aprobación formal de instancia queda para una fase posterior.

## Migración

Se creó `20261030054252_sprint3_document_engine`. No elimina tablas ni aplica
eliminaciones en cascada sobre datos históricos.

## Estado

Sprint 3 queda **implementado como fundación técnica y validado**, no como motor
documental completo. La siguiente fase debe ampliar validación de instancias,
administración de recursos y generación documental únicamente después de la
aprobación institucional correspondiente.
