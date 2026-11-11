# =============================================================================
# GODT Regional 3 — Backend Dockerfile (Producción)
# =============================================================================

# ----------- Etapa 1: Build -----------
FROM node:22-alpine AS build
WORKDIR /app

# Instalar dependencias reproducibles (respeta package-lock.json)
COPY package*.json ./
RUN npm ci

# Copiar prisma y generar cliente
COPY prisma ./prisma
RUN npx prisma generate

# Copiar fuentes y compilar NestJS
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
RUN npm run build

# ----------- Etapa 2: Dependencias de producción -----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ----------- Etapa 3: Runtime -----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Sobrescribir con el cliente Prisma compilado (incluye binarios nativos)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Copiar artefactos compilados
COPY --from=build /app/dist ./dist

# Copiar schema de Prisma (necesario para migrate deploy en el servicio migrator)
COPY --from=build /app/prisma ./prisma

# Copiar entrypoint (con permisos correctos)
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

# Health check nativo con Node (no requiere curl)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
