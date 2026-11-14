# Documentos institucionales privados en Docker local

## Objetivo

Los formatos originales usados por `InstitutionalDocumentService` no forman
parte del repositorio Git ni de la imagen Docker. En desarrollo local se
suministran a los contenedores mediante un bind mount de solo lectura.

La aplicación conserva su ruta interna habitual:

`/app/docs/documentos-reales`

No es necesario cambiar el servicio NestJS: este resuelve los archivos desde
`process.cwd()/docs/documentos-reales`.

## Preparación en Windows (PowerShell)

Desde la raíz del backend:

```powershell
New-Item -ItemType Directory -Force .\docs\documentos-reales
```

Copia manualmente a esa carpeta los archivos institucionales originales
autorizados para el entorno local. No los adjuntes a commits ni los subas a
GitHub.

Comprueba que Git los ignora:

```powershell
git check-ignore docs/documentos-reales/archivo-de-prueba.pdf
```

El comando debe devolver la ruta del archivo ignorado. No uses documentos
clínicos reales en pruebas automatizadas compartidas; utiliza fixtures
sintéticos cuando corresponda.

## Levantar el entorno

Con el archivo de variables local preparado:

```powershell
docker compose -f docker-compose.local.yml --env-file .env.local up --build
```

Compose monta la carpeta local en los servicios `godt-api` y `godt-worker`
como solo lectura (`:ro`). El servicio de migraciones no necesita esos
documentos.

## Comportamiento esperado

- La imagen puede construirse en GitHub Actions aunque la carpeta privada no
  exista en el runner.
- `.dockerignore` excluye `docs/` del contexto de construcción, por lo que
  los archivos privados tampoco se envían al daemon de Docker.
- El Dockerfile crea el directorio vacío dentro de la imagen para conservar la
  ruta esperada.
- En Docker local, el volumen proporciona los archivos reales a API y worker.
- Si la carpeta local está vacía, la imagen y los contenedores pueden iniciar,
  pero las operaciones que consultan o generan formatos institucionales
  fallarán con el error de archivo no encontrado. La carpeta debe contener los
  originales necesarios para esas operaciones.

## Seguridad

No copies documentos originales a Git, no los incluyas en la imagen, no los
envíes como artefactos de CI y no agregues excepciones a `.gitignore` o
`.dockerignore` para incluirlos. El montaje es de solo lectura para impedir
que los contenedores modifiquen las fuentes originales.
