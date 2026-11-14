# ADR-001 — Selección del lenguaje y los frameworks

- **Estado:** Aceptada
- **Fecha:** 14 de noviembre de 2026
- **Ámbito:** Frontend y backend de GODT Regional 3
- **Decisión:** TypeScript en ambos proyectos; Vue 3 + Vite en frontend y NestJS 11 sobre Node.js 22 en backend.

## 1. Contexto

GODT necesita una interfaz web con navegación y formularios dinámicos, revisión de documentos clínicos y candidatos OCR, junto con una API que gestione autenticación, procesos de donación, persistencia, documentos y trabajos asíncronos. Las reglas del dominio deben permanecer separadas de las vistas y de los proveedores externos.

La propuesta inicial del Módulo 2 contemplaba Vue 3 con Bun y dejaba el backend entre NestJS o Spring Boot. El código actual resolvió esas alternativas: los dos repositorios usan TypeScript, npm y archivos package-lock; el backend usa NestJS y el frontend Vue 3/Vite.

## 2. Alternativas consideradas

1. **Vue 3 + TypeScript + Vite / NestJS + TypeScript + Node.js:** alternativa implementada actualmente.
2. **Vue 3 + Bun:** alternativa planteada inicialmente, pero no coincide con los manifiestos ni con las imágenes Docker actuales.
3. **Spring Boot:** alternativa mencionada en el diseño inicial, pero no existe una aplicación Spring Boot en el backend actual.
4. **JavaScript sin tipado estático:** posible técnicamente, pero no es la opción usada en los dos proyectos.

## 3. Decisión

Se mantiene el stack implementado:

### Frontend

- Vue 3 con Composition API para las vistas y componentes.
- TypeScript para contratos y lógica de interfaz.
- Vite para desarrollo y compilación.
- Pinia para el estado compartido.
- Vue Router para navegación y guardas de rutas.
- Axios para las solicitudes HTTP.
- Tailwind CSS v4 para estilos.
- En producción, Node 22 compila el bundle y Nginx sirve los archivos estáticos y actúa como reverse proxy del prefijo /api/v1.

### Backend

- Node.js 22 como runtime.
- TypeScript como lenguaje.
- NestJS 11 para módulos, controladores, inyección de dependencias y organización de la API.
- DTO, class-validator y ValidationPipe para validar entradas HTTP.
- Capas de presentación, aplicación, dominio e infraestructura para separar las reglas de negocio de los adaptadores técnicos.

## 4. Justificación

- **Coherencia tecnológica:** ambos repositorios usan TypeScript, lo que reduce cambios de contexto y permite mantener contratos explícitos entre cliente y API.
- **Estructura del backend:** NestJS ya organiza el sistema en módulos de autenticación, donantes, procesos, OCR, documentos, catálogo, ciclo de vida y dossier. Su inyección de dependencias permite seleccionar adaptadores por configuración.
- **Complejidad del frontend:** Vue 3 y Pinia cubren las vistas y formularios sin introducir un framework adicional en la interfaz.
- **Despliegue reproducible:** los Dockerfiles usan Node 22 Alpine y npm ci a partir de package-lock. El frontend genera estáticos y el backend compila a dist.
- **Mantenimiento:** el código mantiene separados controladores, casos de uso, dominio y adaptadores; el frontend separa vistas, controladores composables, servicios y stores.

## 5. Consecuencias

### Positivas

- Un lenguaje principal en frontend y backend.
- Compilación y dependencias reproducibles mediante npm ci y package-lock.
- Posibilidad de probar reglas de aplicación y adaptadores por separado.
- Despliegue independiente del gateway frontend y de los procesos API/worker del backend.

### Costos y limitaciones

- El equipo debe mantener sincronizados los contratos de API y tipos de ambos repositorios; no se declara un paquete compartido de tipos.
- El runtime de producción del gateway es Nginx, no un servidor Node persistente.
- La aplicación backend y el worker comparten código compilado, aunque ejecutan modos distintos.
- Bun y Spring Boot no deben aparecer en la documentación de arquitectura vigente como tecnologías ejecutadas. Solo deben conservarse como alternativas históricas de la propuesta.

## 6. Evidencia

- Frontend: package.json, package-lock.json, Dockerfile, vite.config.ts y README.md.
- Backend: package.json, package-lock.json, Dockerfile, nest-cli.json, src/main.ts y src/app.module.ts.
