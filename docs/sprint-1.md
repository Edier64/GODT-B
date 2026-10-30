# Sprint 1 — Maestro donante, privacidad y seguridad

## Alcance implementado

- `POST /api/v1/donors`: crea un expediente con RND e IPS obligatorios.
- `GET /api/v1/donors`: lista paginada con filtro por RND y estado.
- `GET /api/v1/donors/:id`: consulta con control de alcance.
- `PATCH /api/v1/donors/:id`: actualiza únicamente datos permitidos.
- JWT Bearer obligatorio en los endpoints de expediente.
- Auditoría de creación del expediente.
- Motor declarativo de mapeo canónico (`CanonicalMappingService`).
- Política determinista de anonimización (`AnonymizationPolicy`).

La autenticación valida tokens emitidos por el proveedor institucional o por
un servicio compatible, usando `JWT_SECRET` y `JWT_ISSUER`. No se implementa
un endpoint local que emita tokens arbitrarios.

## Matriz de permisos provisional

| Acción | ADMIN | COORDINATOR | SURGEON | TECHNICIAN |
|---|---:|---:|---:|---:|
| Crear expediente | Sí | Sí | Sí | Sí |
| Listar expedientes | Todos | Todos | Propios | Propios |
| Consultar expediente | Todos | Todos | Propios | Propios |
| Actualizar expediente | Todos | Todos | Propios | Propios |

“Propios” significa expediente cuyo `createdById` coincide con el sujeto JWT.
Esta es una política técnica provisional: el alcance por IPS y las
asignaciones institucionales requieren confirmación funcional.

## Privacidad y Anexo 4

La política usa una lista blanca de campos no civiles y elimina claves civiles
conocidas incluso dentro de estructuras JSON anidadas. No usa IA, frontend ni
ocultamiento visual. La prueba negativa verifica que nombre, documento y
contacto no aparecen en la salida.

## Pendientes que bloquean el cierre completo

- Validar clínico-jurídicamente las reglas de legalización Anexo 2/3.
- Implementar el mínimo condicional de dos representantes en el caso de uso de
  legalización.
- Conectar el diccionario canónico a los formatos oficiales INS disponibles.
- Añadir actualización de expediente dentro de una transacción con auditoría
  cuando se formalicen los casos de uso de modificación.
- Integrar el proveedor institucional de identidad/JWKS en lugar de secretos
  locales cuando se defina el entorno de despliegue.
