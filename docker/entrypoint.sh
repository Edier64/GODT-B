#!/bin/sh
set -e

APP_MODE="${APP_MODE:-api}"

resolve_entry() {
  if [ -f "dist/src/$1" ]; then
    echo "dist/src/$1"
  elif [ -f "dist/$1" ]; then
    echo "dist/$1"
  else
    echo "[entrypoint] ERROR: No se encontró dist/src/$1 ni dist/$1" >&2
    exit 1
  fi
}

case "$APP_MODE" in
  api)
    MAIN_ENTRY="$(resolve_entry main.js)"
    echo "[entrypoint] Iniciando NestJS API server ($MAIN_ENTRY)..."
    exec node "$MAIN_ENTRY"
    ;;
  worker)
    WORKER_ENTRY="$(resolve_entry worker.js)"
    echo "[entrypoint] Iniciando BullMQ Worker sin servidor HTTP ($WORKER_ENTRY)..."
    exec node "$WORKER_ENTRY"
    ;;
  migrate)
    echo "[entrypoint] Ejecutando migraciones Prisma (etapa independiente)..."
    npx prisma migrate deploy
    MIGRATE_QUEUES_ENTRY="$(resolve_entry infrastructure/runtime/migrate-queues.js)"
    echo "[entrypoint] Ejecutando migraciones BullMQ PostgreSQL ($MIGRATE_QUEUES_ENTRY)..."
    exec node "$MIGRATE_QUEUES_ENTRY"
    ;;
  *)
    echo "[entrypoint] APP_MODE desconocido: $APP_MODE (esperado: api | worker | migrate)" >&2
    exit 1
    ;;
esac
