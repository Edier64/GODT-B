# GODT REGIONAL 3 — GUÍA TÉCNICA DE ARRANQUE LOCAL Y VALIDACIÓN FUNCIONAL (FASE G.1.1)
## Instrucciones Operativas para Levantar Backend, Frontend, OCR y Pruebas Funcionales

**Fecha de Actualización:** 2026-11-07  
**Estado de la Plataforma:** **AUTORIZACIÓN TÉCNICA (GO)**  
**Entorno:** Desarrollo Local Windows 11  

---

## 1. PRE-REQUISITOS Y SERVICIOS BASE (DOCKER)

Antes de iniciar las aplicaciones, compruebe que los contenedores de infraestructura estén corriendo:

### Paso 1: Verificar y levantar PostgreSQL y Redis
Abra una consola PowerShell en `d:\Universidad\Diplomado\GODT\Backend\GODT-B` y ejecute:

```powershell
docker compose ps
```

Si los servicios no están iniciados, levántelos en segundo plano:
```powershell
docker compose up -d
```

**Verificación esperada:**
- `godt-b-postgres-1`: Estado `Up (healthy)`, puerto `5432->5432`.
- `godt-b-redis-1`: Estado `Up (healthy)`, puerto `6379->6379`.
- `godt-b-pgadmin-1`: Estado `Up`, puerto `5050->80`.

---

## 2. VERIFICACIÓN DE BASE DE DATOS Y MIGRACIONES

Compruebe que las 15 migraciones de PostgreSQL estén aplicadas:

```powershell
cd "d:\Universidad\Diplomado\GODT\Backend\GODT-B"
npx prisma migrate status
```
*Salida esperada:* `15 migrations found in prisma/migrations. Database schema is up to date!`

### Generar Tokens JWT para Autenticación en el Frontend:
Si el frontend le solicita un JWT de acceso, genere credenciales de desarrollo con:

```powershell
npm run token:dev
```
*Esto sincronizará los usuarios de prueba en PostgreSQL e imprimirá el token JWT del Coordinador y del Administrador, guardándolos en `scripts/dev-tokens.json`.*

---

## 3. ARRANQUE DEL BACKEND (NESTJS)

En `d:\Universidad\Diplomado\GODT\Backend\GODT-B`:

```powershell
npm run start:dev
```

> [!NOTE]
> **Procesamiento de Colas (Worker BullMQ):** El worker de OCR (`OcrWorker`) se inicializa automáticamente **en proceso** dentro del mismo servidor NestJS mediante el ciclo de vida `OnModuleInit()`. **No se requiere un proceso de terminal separado para el worker en desarrollo local**.

### Comprobar Sonda de Salud (`/api/health`)
Abra una nueva pestaña de navegador o ejecute:
```powershell
curl http://localhost:3000/api/health
```
*Respuesta esperada:*
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "storage": "writable"
}
```

---

## 4. ARRANQUE DEL FRONTEND (VUE 3 + VITE)

En una nueva ventana de terminal en `d:\Universidad\Diplomado\GODT\Frontend`:

```powershell
npm run dev
```

*Salida esperada:*
```
VITE v6.2.5  ready in 250 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 5. RUTAS Y NAVEGACIÓN DISPONIBLES EN EL FRONTEND

| Recurso / Módulo | URL en Navegador | Propósito |
| :--- | :--- | :--- |
| **Página Principal / Login** | `http://localhost:5173/` | Autenticación mediante token JWT (pegar token de `npm run token:dev`). |
| **Bandeja de Donantes** | `http://localhost:5173/donors` | Listado de donantes potenciales y procesos activos. |
| **Detalle del Proceso** | `http://localhost:5173/processes/:id` | Tablero unificado de donación. |
| ├── **Pestaña 1** | *Paquete Documental* | Matriz de 23 posiciones, estados de los 19 formatos y firmas. |
| ├── **Pestaña 2** | *Valores Canónicos* | Diccionario canónico, valores propagados y resolución de conflictos. |
| ├── **Pestaña 3** | *Expediente Consolidado* | Portada, consolidado PDF, descarga ZIP y manifiesto SHA-256. |
| └── **Pestaña 4 (Fase G.1)** | *Documentos Fuente & OCR / IA* | **Carga de archivos (PDF/DOCX/PNG), extracción inteligente, revisión y propagación asistida.** |
| **Swagger API Docs** | `http://localhost:3000/api/docs` | Documentación interactiva OpenAPI de todos los endpoints. |

---

## 6. PRUEBA DE HUMO PASO A PASO: CARGA DOCUMENTAL, OCR Y PROPAGACIÓN

Para validar el flujo completo desde la interfaz de usuario:

1. **Abrir el proceso:** Ingrese a `http://localhost:5173/processes/<ID_DEL_PROCESO>`.
2. **Seleccionar Pestaña 4:** Haga clic en la pestaña **"Documentos Fuente & OCR / IA (Fase G.1)"**.
3. **Subir Documento:**
   - Haga clic en el botón azul **"Cargar Documento Fuente"**.
   - Arrastre o seleccione un archivo (`.docx` o `.pdf` digital) de la carpeta `Backend/GODT-B/docs/documentos-reales/` (por ejemplo, `HISTORIA_CLINICA_TISSUE_BANK.docx` o `Calculo_Hemodilucion_Donante.docx`).
   - Seleccione la categoría documental (ej. *Historia Clínica*) y confirme la subida.
4. **Ejecutar Extracción OCR / IA:**
   - En la tabla de documentos, identifique el documento recién cargado y haga clic en **"Ejecutar OCR / IA"**.
   - El trabajo pasará a `PROCESANDO` y se completará en menos de 1 segundo para documentos digitales o DOCX.
5. **Revisar y Validar Candidatos:**
   - Haga clic en **"Revisar Candidatos"**.
   - Se desplegará el modal interactivo con los campos extraídos (Cédula, Grupo Sanguíneo, Factor Rh, Edad, Sexo, etc.), el nivel de confianza y el fragmento de evidencia.
   - Puede editar en línea cualquier valor antes de confirmar.
   - Haga clic en **"Confirmar"** en los campos deseados.
6. **Propagar al Motor Canónico:**
   - Haga clic en **"Propagar Todos los Confirmados"**.
   - Verifique que los valores pasen inmediatamente a la Pestaña **"Valores Canónicos"** y se reflejen en los formularios de los 19 anexos oficiales.

---

## 7. EJECUCIÓN DE PRUEBAS AUTOMATIZADAS INDEPENDIENTES

Para ejecutar pruebas específicas desde la consola:

- **Batería Integral Fase G.1 (10 Escenarios + Almacenamiento):**
  ```powershell
  cd "d:\Universidad\Diplomado\GODT\Backend\GODT-B"
  npx jest test/fase-g1-ingestion-ocr-canonical.spec.ts
  ```
- **Pruebas de Gobernanza y Gemini OCR (Mockeadas / Sin Internet):**
  ```powershell
  npx jest test/gemini-ocr-integration.spec.ts
  ```
- **Prueba de Humo Real de Gemini (Opt-In / Conexión a Google API):**
  ```powershell
  $env:RUN_REAL_GEMINI_SMOKE_TEST="true"
  npx jest test/gemini-ocr-integration.spec.ts
  ```
- **Pruebas de Contratos Frontend:**
  ```powershell
  cd "d:\Universidad\Diplomado\GODT\Frontend"
  npm run test:contracts
  ```
