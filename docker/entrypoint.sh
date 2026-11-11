#!/bin/sh
set -e

# El worker BullMQ ya se inicializa dentro de OcrModule (onModuleInit).
# WORKER_MODE se conserva como documentación pero no existe dist/worker.js.
# El contenedor siempre inicia la API completa de NestJS.
if [ "${WORKER_MODE}" = "true" ]; then
  echo "[entrypoint] WORKER_MODE=true detectado, pero el worker BullMQ se ejecuta"
  echo "[entrypoint] dentro del proceso API. Iniciando API completa..."
fi

echo "[entrypoint] Iniciando NestJS API server..."
exec node dist/main.js
