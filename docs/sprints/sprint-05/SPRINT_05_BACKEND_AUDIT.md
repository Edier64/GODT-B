# Sprint 05 — Auditoría backend

## Alcance y estado inicial

- Rama: `Feature/Legalizacion`.
- Commit auditado: `23826f5`.
- Remoto: `origin/Feature/Legalizacion`.
- Cambios locales previos: `docs/postman.md` y `docs/postman/`; no fueron
  modificados.
- No se ejecutaron cambios de rama, merges, resets ni operaciones destructivas.

## Hallazgos

| Área | Hallazgo | Severidad | Estado |
|---|---|---:|---|
| Contrato OCR | `GET /ocr/jobs/:jobId` no devolvía estado ni código de error del trabajo | Alto | Corregido en este sprint |
| Autenticación | JWT valida `sub`, rol y `institutionalIps`; ausencia de alcance impide acceso no administrativo | Alto | Verificado |
| IPS | Donantes, documentos, OCR e instancias validan el alcance institucional | Crítico | Verificado mediante código y pruebas |
| Auditoría | Operaciones críticas registran eventos y rechazan metadata sensible | Alto | Verificado |
| Base de datos | Prisma valida; estado contra PostgreSQL no pudo comprobarse | Alto | Bloqueado por PostgreSQL apagado |
| Reportes/aprobación/PDF | No existen endpoints en la rama auditada | Medio | Pendiente backend, no simulado |

## Corrección aplicada

`OcrWorkflowUseCase.getJob` consulta el trabajo, verifica acceso por IPS y
devuelve `jobId`, `sourceDocumentId`, `status`, `errorCode` y `fields`.
El controlador usa este caso de uso y el frontend actualiza el estado real sin
inventar transiciones.

No se modificaron migraciones, credenciales, configuración institucional ni
proveedores de identidad.
