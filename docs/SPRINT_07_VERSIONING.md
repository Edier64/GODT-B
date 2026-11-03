# Sprint 07 — Versionado

El ciclo implementado es `DRAFT -> VALIDATED -> PUBLISHED`. Solo una versión
validada puede publicarse y una instancia normal requiere una versión
publicada. La base de datos mantiene la inmutabilidad de las versiones
publicadas y las instancias conservan su versión original.

No se ejecutaron migraciones en este sprint. Crear una nueva versión,
migrar datos o retirar una versión requiere una decisión funcional explícita y
no se realiza automáticamente.
