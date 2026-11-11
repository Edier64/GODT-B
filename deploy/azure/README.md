# GODT Regional 3 — Guía de Despliegue en Azure (Azure for Students)

> **Prerequisito:** No crear recursos en Azure hasta que el stack esté validado localmente.  
> **Crédito disponible:** USD 100 (Azure for Students).  
> **Costo estimado mensual:** ~$30–40 USD con `Standard_B2als_v2` (dentro del crédito).

---

## 1. Tamaño de VM recomendado

| Parámetro | Valor |
|-----------|-------|
| Tipo | `Standard_B2als_v2` |
| vCPU | 2 |
| RAM | 4 GiB |
| SO | Ubuntu Server 24.04 LTS (x64) |
| Disco OS | 30 GB SSD (Premium LRS) |
| IP pública | Estándar (estática) |
| Costo aprox. | ~$28–35 USD/mes |

> Si la memoria resulta insuficiente bajo carga OCR, escalar a `Standard_B2s` (2 vCPU, 4 GiB, ~$38/mes) o `Standard_B2ms` (2 vCPU, 8 GiB, ~$68/mes).

---

## 2. Crear la VM

```bash
# Instalar Azure CLI primero: https://docs.microsoft.com/cli/azure/install-azure-cli
az login

az group create \
  --name godt-rg \
  --location eastus

az vm create \
  --resource-group godt-rg \
  --name godt-vm \
  --image Ubuntu2404 \
  --size Standard_B2als_v2 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --os-disk-size-gb 30 \
  --storage-sku Premium_LRS

# Abrir puertos HTTP y HTTPS (SSH ya se abre automáticamente)
az vm open-port --resource-group godt-rg --name godt-vm --port 80 --priority 1001
az vm open-port --resource-group godt-rg --name godt-vm --port 443 --priority 1002
```

---

## 3. Instalar Docker en la VM

```bash
ssh azureuser@<IP_PUBLICA>

# Actualizar e instalar Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Agregar usuario al grupo docker
sudo usermod -aG docker azureuser
newgrp docker

# Verificar
docker version
docker compose version
```

---

## 4. Copiar el código

**Opción A — Clonar desde GitHub:**
```bash
mkdir -p ~/godt
cd ~/godt
git clone https://github.com/Edier64/GODT-B.git      Backend/GODT-B
git clone https://github.com/Edier64/GODT-Frontend.git  Frontend
# Descargar compose.demo.yaml y .env.demo.example (si están en un repo aparte)
# o copiarlos con scp desde la máquina local:
# scp compose.demo.yaml azureuser@<IP>:~/godt/
```

**Opción B — SCP desde máquina local:**
```bash
scp -r "D:\Universidad\Diplomado\GODT\Backend" azureuser@<IP>:~/godt/
scp -r "D:\Universidad\Diplomado\GODT\Frontend" azureuser@<IP>:~/godt/
scp "D:\Universidad\Diplomado\GODT\compose.demo.yaml" azureuser@<IP>:~/godt/
scp "D:\Universidad\Diplomado\GODT\.env.demo.example" azureuser@<IP>:~/godt/
```

---

## 5. Configurar variables de entorno

```bash
cd ~/godt
cp .env.demo.example .env
nano .env  # o vim .env

# Cambiar OBLIGATORIAMENTE:
# - POSTGRES_PASSWORD       → contraseña fuerte (mín. 16 chars, alfanumérica)
# - POSTGRES_USER           → mantener o cambiar
# - DATABASE_URL            → actualizar con la misma contraseña
# - REDIS_PASSWORD          → contraseña fuerte
# - REDIS_URL               → actualizar con la misma contraseña
# - JWT_SECRET              → 64 caracteres aleatorios:  openssl rand -hex 32
# - GEMINI_API_KEY          → clave real de Google AI Studio
# - HOST_IP                 → IP pública de la VM (o dominio si tiene)
# - CORS_ORIGIN             → http://<IP_PUBLICA> o https://<dominio>

# Generar JWT_SECRET seguro:
openssl rand -hex 32
```

> **NUNCA** usar contraseñas predecibles como `admin123` o `change_me` en una VM pública.

---

## 6. Aplicar migraciones Prisma (primera vez)

```bash
cd ~/godt

# Levantar solo PostgreSQL y aplicar migraciones
docker compose -f compose.demo.yaml --env-file .env up -d postgres
# Esperar 10–15 segundos para que Postgres esté listo

docker compose -f compose.demo.yaml --env-file .env run --rm migrator
# Debe mostrar: "All migrations have been successfully applied."
```

---

## 7. Levantar el stack completo y provisionar usuarios iniciales

```bash
cd ~/godt
docker compose -f compose.demo.yaml --env-file .env up -d --build

# 1. Sembrar instituciones maestras (si aún no existen)
docker compose -f compose.demo.yaml --env-file .env exec backend npx ts-node scripts/seed-institutions.ts

# 2. Provisionar el primer Administrador (captura contraseña sin eco interactivo)
docker compose -f compose.demo.yaml --env-file .env exec -it backend \
  npm run auth:provision-user -- --email admin@godt.gov.co --name "Administrador Regional GODT" --role ADMIN --all-active-institutions

# 3. Provisionar la cuenta de la Doctora / Coordinadora
docker compose -f compose.demo.yaml --env-file .env exec -it backend \
  npm run auth:provision-user -- --email doctora.coord@godt.gov.co --name "Dra. Coordinadora Regional 3" --role COORDINATOR --ips "Hospital Universitario del Valle,Clínica Imbanaco"
```

> **Cookies y HTTPS:** En producción/Azure con TLS (`https://`) mantenga `AUTH_COOKIE_SECURE=true` y `AUTH_COOKIE_SAMESITE=strict` en `.env`. En pruebas locales únicamente sobre HTTP sin TLS (`localhost`), use `AUTH_COOKIE_SECURE=false` en entorno de desarrollo.

Verificar estado:
```bash
docker compose -f compose.demo.yaml --env-file .env ps
# Todos los servicios deben mostrar "healthy" o "running"
```

---

## 8. Verificación

```bash
# Health check del backend (a través de Nginx)
curl http://localhost/health

# Respuesta esperada:
# {"status":"ok","database":"up","redis":"up","storage":"up",...}

# UI: abrir en el navegador
# http://<IP_PUBLICA>/
```

---

## 9. HTTPS con Let's Encrypt (opcional)

```bash
# Instalar certbot
sudo apt-get install -y certbot

# Detener Nginx temporalmente para validación HTTP
docker compose -f compose.demo.yaml stop frontend

# Obtener certificado
sudo certbot certonly --standalone -d <su-dominio.com>

# Los certificados quedan en: /etc/letsencrypt/live/<su-dominio.com>/

# Actualizar nginx.conf en Frontend/docker/nginx.conf para escuchar en 443
# y montar los certificados en el contenedor frontend vía volumen en compose.
```

---

## 10. Actualización / Rollback

```bash
# Actualizar código
cd ~/godt
git pull  # o scp nuevos archivos

# Reconstruir y relanzar (zero-downtime aproximado)
docker compose -f compose.demo.yaml --env-file .env up -d --build --no-deps backend frontend

# Rollback: volver al commit anterior
git checkout <commit-anterior>
docker compose -f compose.demo.yaml --env-file .env up -d --build --no-deps backend frontend
```

---

## 11. Backups

### Base de datos
```bash
# Crear backup
docker compose -f compose.demo.yaml --env-file .env exec postgres \
  pg_dump -U godt_user godt_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar
docker compose -f compose.demo.yaml --env-file .env exec -T postgres \
  psql -U godt_user godt_db < backup_20261110_120000.sql
```

### Documentos subidos
```bash
# Backup del volumen de documentos
docker run --rm \
  -v godt_demo_documents:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/documents_$(date +%Y%m%d).tar.gz -C /data .

# Restaurar
docker run --rm \
  -v godt_demo_documents:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/documents_20261110.tar.gz -C /data
```

---

## 12. Detener / Desasignar VM para ahorrar crédito

```bash
# Detener contenedores (conserva datos en volúmenes)
docker compose -f compose.demo.yaml --env-file .env down

# Desasignar la VM (detiene cobro de compute, mantiene discos)
az vm deallocate --resource-group godt-rg --name godt-vm

# Volver a iniciar
az vm start --resource-group godt-rg --name godt-vm
ssh azureuser@<nueva-IP>  # la IP puede cambiar si no es estática
cd ~/godt
docker compose -f compose.demo.yaml --env-file .env up -d
```

> **Nota:** Los discos y la IP pública estática siguen generando un costo mínimo (~$3–5/mes) aunque la VM esté desasignada.

---

## 13. Pendientes antes del despliegue en Azure

- [ ] Validar el stack completo localmente con `docker compose -f compose.demo.yaml up -d`  
- [ ] Confirmar que `docker compose run --rm migrator` aplica todas las migraciones  
- [ ] Verificar login y flujo de ingesta OCR en `http://localhost`  
- [ ] Confirmar persistencia tras `docker compose down && up -d`  
- [ ] Configurar `GEMINI_API_KEY` real en el archivo `.env` de la VM  
- [ ] Cambiar todas las contraseñas placeholder  
- [ ] Configurar `HOST_IP` y `CORS_ORIGIN` con la IP pública de Azure  
- [ ] (Opcional) Configurar dominio y HTTPS con certbot  

---

## 14. Estimación de costos (Azure for Students — USD 100)

| Recurso | Costo aprox./mes |
|---------|-----------------|
| `Standard_B2als_v2` VM (730h) | ~$28 |
| Disco OS 30 GB SSD Premium | ~$5 |
| IP pública estática | ~$4 |
| Transferencia de datos saliente (5 GB) | ~$1 |
| **Total estimado** | **~$38/mes** |

Con USD 100 de crédito: **~2.6 meses** de operación continua.  
Usando deallocate en horas de no uso: podría extenderse a 4+ meses.

