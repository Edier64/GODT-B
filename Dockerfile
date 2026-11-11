# =============================================================================
# GODT Regional 3 — Backend Dockerfile (Producción Multi-Stage)
# Targets:
#   - runtime (default): API HTTP y Worker BullMQ (sin devDependencies ni Prisma CLI)
#   - migrator: Etapa independiente con Prisma CLI para ejecutar prisma migrate deploy
# =============================================================================

# ----------- Etapa 1: Build -----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencias de compilación para módulos nativos (argon2) y Prisma
RUN apk add --no-cache openssl ca-certificates python3 make g++

# Instalar dependencias reproducibles (respeta package-lock.json)
COPY package*.json ./
RUN npm ci

# Copiar schema Prisma y generar cliente
COPY prisma ./prisma
RUN npx prisma generate

# Copiar fuentes y compilar NestJS (incluye main.ts y worker.ts)
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
RUN npm run build

# ----------- Etapa 2: Dependencias de producción -----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# ----------- Etapa 3: Migrator (etapa separada con Prisma CLI) -----------
FROM node:22-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates
ENV NODE_ENV=production
ENV APP_MODE=migrate

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

ENTRYPOINT ["/app/docker/entrypoint.sh"]

# ----------- Etapa 4: Runtime optimizado (API y Worker) -----------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-spa poppler-utils

ENV NODE_ENV=production
ENV APP_MODE=api
ENV PORT=3000

# Copiar únicamente dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Copiar cliente Prisma compilado (incluye binarios engine para linux-musl)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Copiar artefactos compilados (dist/main.js y dist/worker.js)
COPY --from=build /app/dist ./dist

# Copiar entrypoint ejecutable (LF)
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh && \
    mkdir -p /app/storage && \
    chown -R node:node /app

USER node

# Health check consciente del modo: HTTP /health para API, activo para worker
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD sh -c 'if [ "${APP_MODE:-api}" = "worker" ]; then pgrep -f "worker.js" >/dev/null; else node -e "require(\"http\").get(\"http://127.0.0.1:${PORT:-3000}/health\", r => process.exit(r.statusCode === 200 ? 0 : 1)).on(\"error\", () => process.exit(1));"; fi'

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
