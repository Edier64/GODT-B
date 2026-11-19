# Sprint 08.1 — integración funcional del piloto Anexo 6

## Resumen ejecutivo

Se implementó el procedimiento técnico para registrar el Anexo 6 como
`DocumentTemplate` y `TemplateVersion` en estado `DRAFT`, junto con la
integración del renderer frontend para consumir sus secciones y tablas desde
la definición recibida.

La ejecución funcional contra PostgreSQL no pudo completarse: el servidor local
no estaba disponible en `localhost:5432`. Redis tampoco estaba disponible en
`localhost:6379`. Por tanto, no se declara creación real de la plantilla,
consulta HTTP, renderizado con datos de API ni creación de instancia.

## Cambios realizados

- [anexo-6-definition.json](../scripts/anexo-6-definition.json): definición
  versionada local del schema, UI schema y mappings.
- [register-anexo-6.ts](../scripts/register-anexo-6.ts): procedimiento
  idempotente y transaccional.
- `package.json`: comando
  `npm run document:register-anexo-6`.
- `.env.example`: bandera
  `DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES=false`.
- [prisma-document-engine.repository.ts](../src/infrastructure/document-engine/prisma-document-engine.repository.ts):
  permite instancias de versiones `DRAFT` únicamente cuando `NODE_ENV=development`,
  la bandera es `true` y el JWT tiene rol `ADMIN`.
- [NewDocumentInstanceView.vue](../../../Frontend/src/views/NewDocumentInstanceView.vue):
  permite cargar definiciones `DRAFT` recibidas por catálogo; la autorización
  efectiva permanece en backend.
- [CatalogView.vue](../../../Frontend/src/views/CatalogView.vue): permite abrir
  una versión desde un expediente indicado mediante `donorId`, sin hardcodear
  el Anexo 6.
- [anexo-6-definition.spec.ts](../test/anexo-6-definition.spec.ts): pruebas
  específicas de definición, respuesta sintética, tablas y rutas de error.

## Modelos reutilizados

Se utilizaron exclusivamente los modelos existentes:

- `DocumentTemplate`
- `TemplateVersion`
- `DocumentInstance`
- `DocumentResponseRevision`
- `DocumentFieldProvenance`
- `AuditEvent`
- `DonorRecord`

El PDF original no se almacena en PostgreSQL. La plantilla conserva en
`DocumentTemplate.metadata` la ruta local ignorada, SHA-256 y
`originalStored: false`.

## Procedimiento de registro

```powershell
cd D:\Universidad\Diplomado\GODT\Backend\GODT-B
$env:PILOT_ADMIN_USER_ID="<UUID de un ADMIN activo>" # opcional
npm run document:register-anexo-6
```

El procedimiento:

1. Valida schema, UI schema y mappings con `DocumentDefinitionValidator`.
2. Busca un ADMIN activo, o utiliza `PILOT_ADMIN_USER_ID`.
3. Busca `templateCode=anexo-6-extraccion-componentes-v0`.
4. Crea la plantilla solo si no existe.
5. Busca la versión `0.1.0`.
6. Crea la versión como `DRAFT` solo si no existe.
7. Rechaza cambios si existe una versión con hash diferente o estado distinto.
8. Registra eventos de auditoría de creación.
9. No valida ni publica la versión.

## Evidencia de ejecución

El comando fue ejecutado y falló antes de modificar datos:

```text
npm run document:register-anexo-6
Can't reach database server at `localhost:5432`
```

No se creó plantilla, versión ni instancia en esta ejecución.

## Validación de esquemas

Validaciones ejecutadas localmente:

- `DocumentDefinitionValidator`: definición Anexo 6 aceptada.
- `DocumentResponseValidator`: respuesta sintética con arreglos, tablas y
  valores `null` aceptada.
- Respuesta sintética inválida: ruta
  `$.organRecoveries[0].component` reportada con error `enum`.
- Los bloques JSON documentados son sintácticamente válidos.

## Frontend y API

La integración quedó conectada a los contratos existentes:

- `GET /api/v1/document-catalog`
- `GET /api/v1/document-catalog/:id/versions`
- `POST /api/v1/donors/:donorId/document-instances`

No existe evidencia de respuesta HTTP real en este sprint porque el backend y
PostgreSQL no estaban disponibles. La UI conserva el `templateVersionId` en la
ruta y lo envía al crear la instancia.

## Resultados de pruebas

| Validación | Resultado |
|---|---|
| Backend build | Correcto |
| Backend lint | Correcto |
| Backend unit tests | 12 suites, 36 pruebas correctas |
| Prisma validate | Correcto |
| Backend integration tests | 4 suites omitidas por `RUN_INTEGRATION_TESTS` |
| Backend HTTP E2E | 1 suite omitida por `RUN_E2E_TESTS` |
| Frontend `vue-tsc` y build | Correcto |
| Frontend contract tests | 4 correctas, 1 smoke real omitida |
| PostgreSQL local | No disponible |
| Redis local | No disponible |
| Registro real de plantilla | Bloqueado por PostgreSQL |

## Criterios

| Criterio | Estado |
|---|---|
| Definición reutilizable y validada | Cumplido técnicamente |
| Procedimiento idempotente DRAFT | Implementado, no ejecutado contra DB |
| Consulta API real | Bloqueado por infraestructura |
| Renderizado con definición API | Bloqueado por infraestructura |
| Diligenciamiento sintético | Validado por pruebas de renderer/validator; no E2E |
| Creación de instancia real | Bloqueado por infraestructura |
| Conservación de versión | Cubierta por contrato y modelo; no verificada en DB |
| Publicación accidental | No realizada; la versión permanece diseñada para `DRAFT` |
| Aprobación institucional | Fuera de alcance y pendiente |

## Limitaciones y siguiente paso

Iniciar PostgreSQL y Redis locales, configurar `DATABASE_URL`, `JWT_SECRET` y
un ADMIN de prueba sintético. Después ejecutar el registro, arrancar el
backend con `DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES=true`, autenticar un ADMIN,
consultar el catálogo y recorrer una instancia con un `DonorRecord` sintético.

Hasta completar esa secuencia, el estado del sprint es **BLOQUEADO
OPERATIVAMENTE**, no aprobado.
