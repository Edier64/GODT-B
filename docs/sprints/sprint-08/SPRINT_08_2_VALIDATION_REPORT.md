# Sprint 08.2 — Informe de validación funcional del piloto Anexo 6

## Estado final

**PARCIAL**. El flujo real de persistencia del backend fue ejecutado con PostgreSQL,
Redis y HTTP autenticado. La instancia DRAFT se creó, se consultó y conservó la
versión `0.1.0`, y una respuesta conforme fue validada como válida. No se realizó
una comprobación visual interactiva desde el navegador Vue en esta sesión; por
ello no se declara completado el recorrido integral frontend.

## 1. Infraestructura utilizada

- Docker Compose existente del backend, sin eliminar volúmenes.
- PostgreSQL `17.6-alpine`, disponible en `localhost:5432`.
- Redis `7.4-alpine`, disponible en `localhost:6379`.
- Backend NestJS en `http://localhost:3000`.
- Modo local restringido: `NODE_ENV=development` y
  `DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES=true`.
- Las credenciales y secretos no se incluyeron en este informe.

El endpoint `/health` confirmó:

```json
{"status":"ok","database":"up","redis":"up"}
```

## 2. Migraciones

Prisma confirmó siete migraciones aplicadas y ninguna migración pendiente. No se
ejecutaron `db push --force-reset`, `migrate reset` ni operaciones destructivas.

## 3. Registro idempotente

Se creó un usuario ADMIN sintético local
`anexo6-pilot-admin@example.test` para la prueba. El comando ejecutado fue:

```text
npm run document:register-anexo-6
```

Primera ejecución:

- `templateId`: `793764e4-5796-427a-8125-8d1f57e670b4`
- `versionId`: `d2fb6454-2ae5-400e-8555-224b7e6f2880`
- código: `anexo-6-extraccion-componentes-v0`
- versión: `0.1.0`
- estado de versión: `DRAFT`
- `created`: `true`
- hash de definición: `a25444ab8e767d2955747786c29a88304e973bc8e83e07e1f0b122e691a2e53a`

Segunda ejecución:

- mismos identificadores y hash;
- `created`: `false`;
- no se creó una segunda plantilla ni una segunda versión.

La plantilla conserva metadata de fuente con la ruta local y el SHA-256 del PDF.
`originalStored` permanece en `false`; el PDF original no se almacenó en
PostgreSQL.

La consulta directa a PostgreSQL confirmó una plantilla, una versión DRAFT y dos
eventos de auditoría: `DOCUMENT_TEMPLATE_CREATED` y
`TEMPLATE_VERSION_CREATED`.

## 4. Endpoints HTTP reales

Se probaron con un JWT firmado para el ADMIN sintético:

- `POST /api/v1/donors`
- `GET /api/v1/document-catalog`
- `GET /api/v1/document-catalog/:id/versions`
- `POST /api/v1/donors/:donorId/document-instances`
- `GET /api/v1/document-instances/:id`
- `POST /api/v1/document-instances/:id/validate`

El expediente y las respuestas fueron completamente sintéticos.

## 5. Persistencia y validación de instancia

Se creó una instancia DRAFT real con:

- `instanceId`: `1f8f98e7-08cc-417d-9074-bdd2fa9fc3ee`
- `templateVersionId`: `d2fb6454-2ae5-400e-8555-224b7e6f2880`
- respuesta con objetos, arreglos, enums y valores `null`.

La consulta posterior devolvió el mismo `templateVersionId`. La validación HTTP
respondió `201` y `valid: true`.

También se ejecutó una respuesta deliberadamente incompatible. El backend
respondió `valid: false` con errores de `additionalProperties` y `enum`, lo que
confirma que los errores no se transforman en éxitos simulados.

## 6. Autorización y seguridad

- El acceso HTTP se realizó con JWT y rol ADMIN.
- La autorización continúa en el backend.
- La habilitación DRAFT requiere simultáneamente desarrollo, bandera explícita y
  rol ADMIN.
- No se publicaron plantillas ni se modificaron versiones publicadas.
- No se utilizaron historias clínicas reales.
- Los documentos institucionales originales no se modificaron, copiaron ni
  incorporaron a Git.
- No se almacenaron respuestas clínicas en IndexedDB; la caché frontend solo
  conserva definiciones autorizadas.

La prueba visual con un usuario no ADMIN y el reinicio del backend con la bandera
deshabilitada no se ejecutaron en esta sesión. Las restricciones permanecen
cubiertas por la lógica y las pruebas unitarias existentes.

## 7. Pruebas ejecutadas

### Backend

- Build NestJS: correcto.
- Lint ESLint: correcto.
- Unit/integration Jest: **12 suites, 36 pruebas exitosas**.
- Validación Prisma: correcta.
- HTTP real con PostgreSQL y Redis: creación, consulta y validación ejecutadas.

### Frontend

- `vue-tsc --noEmit`: correcto.
- Build Vite: correcto.
- Contratos: **4 exitosas, 1 omitida** por requerir API real.
- No se completó una prueba visual interactiva en navegador.

## 8. Criterios

| Criterio | Resultado |
|---|---|
| Plantilla DRAFT persistida | Cumplido |
| Registro idempotente | Cumplido |
| Consulta autenticada del catálogo y versión | Cumplido |
| Creación real de instancia DRAFT | Cumplido |
| Consulta real de instancia | Cumplido |
| Conservación de versión | Cumplido |
| Validación positiva y negativa | Cumplido |
| Renderizado visual desde Vue | Pendiente |
| Recorrido completo desde navegador | Pendiente |
| Publicación institucional | No realizada, fuera de alcance |

## 9. Limitaciones y siguiente validación

La evidencia demuestra el flujo real del backend y la compatibilidad técnica del
frontend mediante build, typecheck y contratos, pero no demuestra todavía la
interacción visual completa desde Vue. El siguiente paso debe ejecutar el frontend
contra el backend local, abrir el Anexo 6 desde el catálogo, diligenciar sus
secciones dinámicas y confirmar la respuesta HTTP desde la interfaz, sin
hardcodear datos ni publicar la plantilla.
