# Administración de plantillas

## Permisos

La administración debe separarse de los roles operativos. Se requiere un rol
institucional autorizado para crear, validar, publicar, retirar y consultar
versiones. El propietario de un expediente no obtiene permisos de plantilla.

## Flujo

1. Crear metadatos.
2. Cargar definición y recurso privado.
3. Validar JSON Schema, UI schema, mappings y referencias.
4. Revisar previsualización.
5. Autorizar publicación.
6. Auditar actor, versión, fecha, hash y motivo.

No se ejecuta código arbitrario almacenado en una plantilla. Las reglas
complejas deben vivir en casos de uso controlados.
