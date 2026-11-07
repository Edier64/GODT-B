# GODT REGIONAL 3 — FASE F
## GUÍA OPERATIVA DE DESPLIEGUE Y PUESTA EN PRODUCCIÓN
### Documento de Entrega Técnica: FASE_F_DEPLOYMENT_GUIDE.md

---

## 1. OBJETIVO Y ALCANCE

Esta guía establece el procedimiento estándar, reproducible y seguro para desplegar la plataforma **GODT Regional 3** en entornos de preproducción (Staging) y producción, garantizando la correcta inicialización de servicios, migraciones de base de datos sin pérdida de información y configuración de seguridad perimetral.

---

## 2. REQUISITOS PREVIOS DEL SISTEMA

### 2.1 Especificaciones de Hardware Recomendadas (Servidor / Instancia)
- **CPU:** 4 vCPUs (x86_64 o ARM64).
- **RAM:** 8 GB mínimo (16 GB recomendado para soporte concurrente de renderizado PDF de expedientes).
- **Almacenamiento:** 100 GB SSD NVMe para base de datos y volumen de almacenamiento privado (`/var/godt/storage`).
- **Sistema Operativo:** Linux Ubuntu 22.04 LTS o 24.04 LTS / Debian 12.

### 2.2 Requisitos de Software
- **Node.js:** Versión 20.x LTS o 22.x LTS (con npm 10+).
- **PostgreSQL:** Versión 16.x con extensión `uuid-ossp` o generación nativa `gen_random_uuid()`.
- **Redis:** Versión 7.x (standalone o cluster con persistencia RDB/AOF habilitada).
- **Nginx:** Versión 1.22+ con soporte HTTP/2 y terminación TLS 1.3.
- **Gestor de Procesos:** PM2 v5+ o `systemd`.

---

## 3. ARQUITECTURA DE DESPLIEGUE

```
                      [ Cliente Web (Navegador) ]
                                  │
                                  ▼ (HTTPS:443)
                         [ Nginx Reverse Proxy ]
                          │                   │
         (/api/*)         │                   │ (/* Estáticos SPA)
                          ▼                   ▼
                 [ NestJS Backend ]     [ Vite SPA Build ]
                 (Puerto 3000)          (/var/www/godt/dist)
                   │           │
    (SQL:5432)     │           │ (TCP:6379)
                   ▼           ▼
           [ PostgreSQL 16 ]  [ Redis 7 (BullMQ) ]
                   │
                   ▼ (Montaje Local / PVC)
          [ Almacenamiento Privado ]
             (/var/godt/storage)
```

---

## 4. PROCEDIMIENTO PASO A PASO DE DESPLIEGUE

### Paso 1: Clonación del Código y Preparación de Directorios
```bash
# Directorio base institucional
sudo mkdir -p /var/www/godt && cd /var/www/godt

# Clonación de Backend y Frontend
git clone https://github.com/institucional/GODT-B.git backend
git clone https://github.com/institucional/GODT-Frontend.git frontend

# Creación de volumen de almacenamiento privado protegido
sudo mkdir -p /var/godt/storage
sudo chown -R godt:godt /var/godt/storage
sudo chmod 700 /var/godt/storage
```

### Paso 2: Configuración de Variables de Entorno del Backend
Copiar la plantilla oficial y configurar los secretos criptográficos:
```bash
cd /var/www/godt/backend
cp .env.example .env
```
Generar una clave secreta JWT criptográficamente segura (mínimo 32 bytes):
```bash
openssl rand -hex 32
```
Editar `.env` asegurando:
```ini
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://godt_user:StrongPasswordHere@127.0.0.1:5432/godt_regional3?schema=public&connection_limit=20"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=StrongRedisPasswordHere
JWT_SECRET=c58f0... (resultado de openssl rand -hex 32)
JWT_EXPIRES_IN=8h
STORAGE_BASE_PATH=/var/godt/storage
ENABLE_IN_MEMORY_QUEUE_FALLBACK=false
CORS_ORIGIN=https://godt.regional3.gov.co
SWAGGER_ENABLED=false
DOSSIER_CONCURRENCY=2
INSTANCE_ID=worker-prod-01
```

### Paso 3: Instalación de Dependencias y Compilación del Backend
```bash
cd /var/www/godt/backend
npm ci --omit=dev
# Instalar dependencias de desarrollo temporalmente para compilación
npm install --no-audit
npm run build
```

### Paso 4: Ejecución Segura de Migraciones de Base de Datos
> [!IMPORTANT]
> En entornos de producción y preproducción, **NUNCA** ejecute `npx prisma db push` ni scripts con `DROP DATABASE`. Utilice únicamente el comando oficial de despliegue de migraciones:

```bash
npx prisma migrate deploy
```
Verifique que las 15 migraciones hayan sido aplicadas con éxito sin errores de sintaxis o de claves foráneas.

### Paso 5: Compilación y Publicación del Frontend
```bash
cd /var/www/godt/frontend
cp .env.example .env
```
Ajustar `.env`:
```ini
VITE_API_URL=https://godt.regional3.gov.co/api
VITE_STORAGE_URL=https://godt.regional3.gov.co/storage
VITE_ENABLE_ANALYTICS=false
VITE_DEBUG_MODE=false
```
Compilar la aplicación Vue 3:
```bash
npm ci
npm run build
# Los archivos generados residen en /var/www/godt/frontend/dist
```

### Paso 6: Configuración del Gestor de Procesos (PM2)
Crear archivo `ecosystem.config.js` en el backend:
```javascript
module.exports = {
  apps: [
    {
      name: 'godt-backend',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
```
Iniciar el servicio:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Paso 7: Configuración del Servidor Web Reverso Nginx
Crear `/etc/nginx/sites-available/godt.regional3.gov.co`:
```nginx
server {
    listen 80;
    server_name godt.regional3.gov.co;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name godt.regional3.gov.co;

    ssl_certificate /etc/letsencrypt/live/godt.regional3.gov.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/godt.regional3.gov.co/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Frontend SPA
    location / {
        root /var/www/godt/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 180s;
    }
}
```
Habilitar el sitio y reiniciar Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/godt.regional3.gov.co /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. COMPROBACIÓN POST-DESPLIEGUE (SMOKE TESTS)

Ejecutar la verificación del probe de salud HTTP:
```bash
curl -i https://godt.regional3.gov.co/api/health
```
Respuesta esperada (HTTP 200 OK):
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "storage": "accessible",
  "timestamp": "2026-11-07T20:10:00.000Z"
}
```

---

## 6. PROTOCOLO DE REVERSIÓN (ROLLBACK)

En caso de fallo crítico no recuperable durante una actualización:
1. Detener el proceso con PM2: `pm2 stop godt-backend`
2. Restaurar el commit anterior vía Git: `git checkout <commit_estable>`
3. Si se aplicó una migración incompatible:
   - Restaurar el respaldo previo de PostgreSQL usando `pg_restore` (ver `FASE_F_BACKUP_RECOVERY_PLAN.md`).
4. Recompilar backend: `npm run build`
5. Reiniciar servicio: `pm2 restart godt-backend`
6. Verificar el estado con `curl https://godt.regional3.gov.co/api/health`.
