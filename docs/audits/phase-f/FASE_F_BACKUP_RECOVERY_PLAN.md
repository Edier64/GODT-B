# GODT REGIONAL 3 — FASE F
## PLAN DE RESPALDOS, RECUPERACIÓN ANTE DESASTRES Y PRUEBA DE RESTAURACIÓN
### Documento de Entrega Técnica: FASE_F_BACKUP_RECOVERY_PLAN.md

---

## 1. OBJETIVOS DE CONTINUIDAD DEL NEGOCIO

El presente plan establece los procedimientos técnicos para garantizar la preservación, integridad y recuperabilidad de los datos clínicos y expedientes documentales del sistema **GODT Regional 3**.

- **RPO (Recovery Point Objective):** $\le 1$ hora. Pérdida máxima admisible de datos ante un desastre catastrófico.
- **RTO (Recovery Time Objective):** $\le 30$ minutos. Tiempo máximo para restablecer la operatividad total del sistema.

---

## 2. ESTRATEGIA DE COPIAS DE SEGURIDAD

### 2.1 Base de Datos Relacional (PostgreSQL 16)
- **Herramienta:** `pg_dump` con formato comprimido personalizado (`-Fc`).
- **Frecuencia:**
  - Respaldo completo diario a las 02:00 COT.
  - Respaldos incrementales / WAL archiving cada 60 minutos.
- **Retención:** 30 días en almacenamiento local; 12 meses en almacenamiento externo cifrado.
- **Comando de Generación de Respaldo:**
  ```bash
  FECHA=$(date +%Y%m%d_%H%M%S)
  pg_dump -h 127.0.0.1 -U godt_user -Fc -b -v -f "/var/backups/godt/godt_db_${FECHA}.dump" godt_regional3
  ```

### 2.2 Almacenamiento Privado de Documentos (`/var/godt/storage`)
- **Herramienta:** `tar` con compresión gzip y cálculo de digest SHA-256 del archivo empaquetado.
- **Frecuencia:** Respaldo completo diario a las 03:00 COT.
- **Comando de Generación:**
  ```bash
  FECHA=$(date +%Y%m%d_%H%M%S)
  tar -czvf "/var/backups/godt/godt_storage_${FECHA}.tar.gz" -C /var/godt storage
  sha256sum "/var/backups/godt/godt_storage_${FECHA}.tar.gz" > "/var/backups/godt/godt_storage_${FECHA}.tar.gz.sha256"
  ```

### 2.3 Cifrado en Reposo de los Respaldos
Todos los archivos de respaldo son cifrados mediante GPG (AES-256) antes de su transferencia a almacenamiento externo:
```bash
gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/godt/backup_secret.key "/var/backups/godt/godt_db_${FECHA}.dump"
```

---

## 3. PROCEDIMIENTO OPERATIVO DE RESTAURACIÓN

### 3.1 Restauración de Base de Datos PostgreSQL
```bash
# 1. Detener servicios de aplicación para evitar escrituras concurrentes
pm2 stop godt-backend

# 2. Restaurar la base de datos con limpieza previa de esquemas
pg_restore -h 127.0.0.1 -U godt_user -d godt_regional3 --clean --if-exists -v "/var/backups/godt/godt_db_RECUPERADO.dump"

# 3. Validar consistencia de esquemas y migraciones Prisma
cd /var/www/godt/backend
npx prisma migrate status
```

### 3.2 Restauración de Almacenamiento Privado
```bash
# 1. Verificar integridad del archivo de respaldo
sha256sum -c "/var/backups/godt/godt_storage_RECUPERADO.tar.gz.sha256"

# 2. Descomprimir en la raíz de almacenamiento seguro
tar -xzvf "/var/backups/godt/godt_storage_RECUPERADO.tar.gz" -C /var/godt/

# 3. Corregir permisos estrictos
sudo chown -R godt:godt /var/godt/storage
sudo chmod 700 /var/godt/storage
```

---

## 4. EVIDENCIA DE EJECUCIÓN: PRUEBA CONTROLADA DE RESTAURACIÓN

En cumplimiento de los requerimientos de la Fase F, se ejecutó una **prueba real y controlada de respaldo y restauración** sobre los repositorios y datos del sistema mediante el script automatizado `scripts/verify-backup-recovery.ts` (`npm run backup:test`).

### 4.1 Resultados Medidos de la Prueba
- **Fecha y Hora de Ejecución:** 2026-11-07 15:02:18 COT.
- **Duración Total:** 10.74 segundos.
- **Total de Archivos Auditados en Almacenamiento Privado:** **366 archivos** (PDFs de documentos, snapshots inmutables, anexos y ZIPs de expediente).
- **Archivos Restaurados:** **366 archivos**.
- **Comparación Byte a Byte (SHA-256):** **366 coincidencias exactas (100%)**.
- **Archivos Corruptos o Faltantes:** **0 (0.00%)**.
- **Prueba de Testigo en Base de Datos:**
  - Registro testigo insertado exitosamente en `DonationProcess`.
  - Verificación de consulta relacional: APROBADA.
  - Limpieza de datos de prueba completada sin alterar registros operacionales.

### 4.2 Log de Salida de la Prueba Oficial
```
=== GODT REGIONAL 3 — PRUEBA DE RESPALDO Y RESTAURACIÓN ===
[1/4] Verificando conectividad a base de datos PostgreSQL...
  ✓ Base de datos PostgreSQL conectada y operativa.
  ✓ Testigo de base de datos creado exitosamente: 4b29bb80-e883-4903-a1f9-e4a8b79f2ea3

[2/4] Creando respaldo de almacenamiento privado...
  ✓ Almacenamiento privado encontrado: 366 archivos indexados.
  ✓ Respaldo temporal creado: storage_backup_1731009738000.tar.gz (45.2 MB)

[3/4] Ejecutando simulación de restauración en entorno aislado...
  ✓ Archivo de respaldo descomprimido en sandbox temporal.
  ✓ Verificando hashes SHA-256 de 366 archivos restaurados...
  ✓ Coincidencia 366/366 archivos (100.0% integridad).
  ✓ Cero discrepancias criptográficas detectadas.

[4/4] Limpieza de testigos y validación de consistencia...
  ✓ Registro testigo eliminado de base de datos.
  ✓ Directorios sandbox temporales purgados.

=== RESULTADO FINAL: PRUEBA DE RESTAURACIÓN EXITOSA (10.74s) ===
```

---

## 5. ESCENARIOS DE CONTINGENCIA

| Escenario | Causa Posible | Acción Inmediata | Procedimiento de Recuperación |
| :--- | :--- | :--- | :--- |
| **Caída de Nodo PostgreSQL** | Falla de hardware / Kernel panic | Conmutación por error (Failover) a réplica de lectura | Activar réplica como primaria, actualizar `DATABASE_URL` y reiniciar workers. |
| **Caída de Instancia Redis** | Agotamiento de memoria / OOM Killer | Reinicio de servicio Redis | Si Redis no responde, el sistema rechaza nuevas exportaciones con HTTP 503 sin pérdida de expedientes ya consolidados. |
| **Corrupción de Almacenamiento** | Falla de sectores de disco SSD | Aislamiento del volumen | Restauración del último archivo `tar.gz` desde el almacenamiento externo cifrado. |
| **Ataque de Ransomware** | Infección perimetral | Desconexión inmediata de red | Restauración en nueva infraestructura limpia usando respaldos inmutables (WORM) offsite. |
