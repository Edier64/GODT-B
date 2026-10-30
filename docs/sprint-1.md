# Sprint 1 — Maestro donante, privacidad y seguridad

## Alcance implementado

- `POST /api/v1/donors`: crea un expediente con RND e IPS obligatorios.
- `GET /api/v1/donors`: lista paginada con filtro por RND y estado.
- `GET /api/v1/donors/:id`: consulta con control de alcance.
- `PATCH /api/v1/donors/:id`: actualiza únicamente datos permitidos.
- `POST /api/v1/donors/:id/legalization`: evalúa y registra legalización.
- JWT Bearer en los endpoints de expediente y legalización.
- Auditoría transaccional de creación, actualización y legalización.
- Motor declarativo de mapeo canónico (`CanonicalMappingService`).
- Política determinista de anonimización (`AnonymizationPolicy`).

La autenticación valida tokens emitidos por el proveedor institucional o por
un servicio compatible, usando `JWT_SECRET` y `JWT_ISSUER`. No se implementa
un endpoint local que emita tokens arbitrarios. El claim opcional
`institutionalIps` limita el acceso por IPS; `ADMIN` mantiene alcance global.

## Matriz de permisos provisional

| Rol | Acción | Recurso | Alcance |
|---|---|---|---|
| ADMIN | Crear, listar, consultar, actualizar | Expediente | Todas las IPS |
| COORDINATOR | Crear, listar, consultar, actualizar, legalizar | Expediente/legalización | IPS incluidas en `institutionalIps` |
| SURGEON | Crear, listar, consultar, actualizar | Expediente | IPS incluidas en `institutionalIps` |
| TECHNICIAN | Crear, listar, consultar, actualizar | Expediente | IPS incluidas en `institutionalIps` |

El propietario del expediente no sustituye la asignación institucional. La
autenticación JWT, la autorización por rol y el alcance por IPS son controles
separados. La asignación oficial de usuarios a IPS aún debe ser suministrada
por el proveedor institucional.

## Privacidad y Anexo 4

La política usa una lista blanca de campos no civiles y elimina claves civiles
conocidas incluso dentro de estructuras JSON anidadas. No usa IA, frontend ni
ocultamiento visual. La prueba negativa verifica que nombre, documento y
contacto no aparecen en la salida.

## Legalización Anexo 2 y Anexo 3

La política técnica provisional implementa:

- Anexo 2 (`PRESUNCION_LEGAL`): adulto colombiano sin oposición registrada.
- Anexo 3 (`CONSENTIMIENTO_FAMILIAR`): menor de edad o extranjero no residente,
  con mínimo de dos representantes.

La cantidad de representantes se valida en dominio y la creación de la
legalización, representantes y auditoría se ejecuta en una transacción. La
política no se considera homologación clínica o jurídica.

## Estado de cierre

### Implementado y probado

- CRUD de donantes con RND e IPS obligatorios.
- Control RBAC y alcance institucional por `institutionalIps`.
- Legalización Anexo 2/3 y validación de representantes.
- Auditoría de creación, modificación y legalización.
- Rollback de actualización cuando falla la auditoría.
- Anonimización determinista y pruebas de lista blanca.
- Pruebas unitarias, integración con PostgreSQL, build, lint y formato.

### Implementado, pero pendiente de validación institucional

- Reglas jurídicas definitivas de Anexo 2 y Anexo 3.
- Catálogo oficial de roles, asignaciones por IPS y proveedor JWT/JWKS.
- Diccionario canónico contra los formatos oficiales INS.

### Fuera del alcance de Sprint 1

- OCR, almacenamiento documental, plantillas, PDF y procedimientos de
  recuperación. Estos corresponden a Sprint 2/3 y no fueron modificados.
