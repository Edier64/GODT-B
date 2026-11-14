# Sprint 05 — Auditoría de base de datos

## Verificaciones realizadas

- `prisma validate`: correcto.
- Migraciones presentes: inicial, timestamps, integridad, legalización,
  motor documental, hash único por donante e integridad/inmutabilidad del
  Sprint 4.
- Se revisaron claves foráneas `RESTRICT`, índices, unicidad de hash por
  donante, revisión actual de instancia, procedencia y trigger de
  inmutabilidad de versiones publicadas.
- No se ejecutaron migraciones ni se alteraron datos.

## Integridad relevante

- Un documento usa relación al donante y restricción única
  `(donor_id, sha256_hash)`.
- Una revisión actual debe pertenecer a la misma instancia mediante FK
  compuesta.
- Las versiones `PUBLISHED` no pueden actualizarse mediante trigger.
- Campos OCR tienen checks de confianza, estado y trazabilidad de validación.
- Conflictos y eventos de auditoría conservan actor y timestamps.

## Bloqueo de evidencia

`npx prisma migrate status` no pudo conectar con `localhost:5432` (`P1001`).
Por ello no se afirma que la base local esté sincronizada ni que las
migraciones hayan sido ejecutadas contra PostgreSQL en esta sesión.
