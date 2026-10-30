# Sprint 4 - Estabilizacion e integridad del motor documental

## Implementado

- El alcance institucional del motor usa `DocumentAccessContext`; los usuarios no administrativos sin IPS no tienen bypass.
- Las consultas de instancias y las operaciones de escritura validan el donante contra el alcance del usuario.
- `DocumentInstance.currentRevisionId` usa una FK compuesta con `documentInstanceId`.
- Las revisiones se crean dentro de transacciones serializables y la revision actual se actualiza en la misma transaccion.
- Las versiones publicadas estan protegidas en la aplicacion y mediante trigger PostgreSQL.
- La procedencia valida donante, documento fuente y estado de validacion OCR.
- Se conserva valor de origen, validador y fecha cuando la fuente es OCR.
- Los mappings se validan contra un catalogo canonico tipado.
- Los conflictos entre valores de una misma ruta se marcan como `PENDING` y cuentan con endpoint de resolucion auditado.
- Los DTOs de procedencia, mappings y resolucion de conflictos se validan con `ValidationPipe`.
- Existe una suite E2E HTTP en `test/document-engine.e2e-spec.ts` para IPS,
  versiones, revisiones, mappings y conflictos.

## Evidencia ejecutada

| Verificación | Resultado | Evidencia PostgreSQL |
|---|---|---|
| Migraciones | VERIFIED | `npx prisma migrate deploy` aplicó `20261030090000_sprint4_integrity_and_immutability`; `npx prisma migrate status` confirmó esquema al día |
| Trigger | VERIFIED | Consulta a `pg_trigger` encontró `template_version_published_immutable` |
| FK compuesta | VERIFIED | Consulta a `pg_constraint` encontró `DOCUMENT_INSTANCE_current_revision_instance_fkey` y la UNIQUE de revisión |
| Autorización IPS | VERIFIED | E2E: IPS propia 200, IPS cruzada 403, usuario sin IPS 403 |
| Pruebas unitarias | VERIFIED | 7 suites, 16 pruebas |
| Integración | VERIFIED | 4 suites, 9 pruebas contra PostgreSQL real |
| E2E | VERIFIED | 1 suite, 7 pruebas HTTP contra NestJS y PostgreSQL real |
| Concurrencia | VERIFIED | Integración PostgreSQL ejecutó dos `saveRevision` simultáneos y verificó revisiones 1, 2, 3 y 4 sin duplicados |
| Rollback | PARTIAL | Rollback transaccional de auditoría verificado en integración; falta evidencia específica de rollback de procedencia del motor documental |
| `npx prisma validate` | VERIFIED | Esquema Prisma válido |
| `npx tsc --noEmit` | VERIFIED | Type-check exitoso |
| `npm run build` | VERIFIED | Build NestJS exitoso |
| `npm run lint` | VERIFIED | ESLint exitoso |
| `npm run format:check` | VERIFIED | Prettier exitoso |

## Limitaciones pendientes

- Añadir una prueba específica de rollback de procedencia dentro del motor documental.
- Homologar institucionalmente el catálogo completo de mappings canónicos.

## Entorno PostgreSQL

El entorno PostgreSQL existente respondió en `localhost:5432`. No se
reconfiguraron contenedores, credenciales ni dependencias. Las pruebas usaron
datos sintéticos y realizaron limpieza de sus propios registros.

## Recomendación de cierre

La seguridad IPS, la inmutabilidad, la FK compuesta, la procedencia básica,
los conflictos, las migraciones y los flujos HTTP principales están
`VERIFIED`. El sprint puede pasar a revisión de cierre con dos pendientes
`PARTIAL`: rollback específico de procedencia y homologación completa de
mappings.
