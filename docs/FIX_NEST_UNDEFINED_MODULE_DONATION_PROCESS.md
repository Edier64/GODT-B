# GODT-B — FIX CRÍTICO DE ARRANQUE NESTJS
## UndefinedModuleException en DonationProcessModule

**Fecha:** 08 de noviembre de 2026  
**Rama:** `feature/clinical-history-donor-intake-ocr`  
**Repositorio:** `Edier64/GODT-B`  
**Estado:** Resuelto y Verificado al 100%

---

## 1. CAUSA RAÍZ

Durante el arranque de la aplicación NestJS (`node dist/src/main.js` o `nest start --watch`), el framework construye el grafo de dependencias de los módulos declarados en `AppModule`.

Al llegar a `OcrModule`, NestJS inicia el escaneo recursivo de sus dependencias:
1. `OcrModule` importa `CanonicalDictionaryModule` (para inyectar `CanonicalPropagationEngine` en `OcrWorkflowUseCase`).
2. `CanonicalDictionaryModule` importa `DonationProcessModule` usando `forwardRef(() => DonationProcessModule)` (para inyectar `DONATION_PROCESS_REPOSITORY` en `GetProcessCanonicalValuesUseCase`).
3. Al instanciar `DonationProcessModule`, NestJS analiza su arreglo `imports: [AuthModule, PrismaModule, InstitutionModule, DocumentsModule, OcrModule]`.
4. El elemento ubicado en el índice `[4]` es `OcrModule`. Dado que `OcrModule` aún no había completado su ciclo de evaluación y carga en Node.js (por encontrarse pendiente en el stack de resolución), la referencia en JavaScript a `OcrModule` se evaluaba como `undefined`.
5. Al no poseer un wrapper diferido (`forwardRef()`) en ese extremo de la cadena, NestJS arrojaba `UndefinedModuleException`:
   ```text
   UndefinedModuleException [Error]: Nest cannot create the DonationProcessModule instance.
   The module at index [4] of the DonationProcessModule "imports" array is undefined.
   Scope [AppModule -> OcrModule -> CanonicalDictionaryModule]
   ```

---

## 2. CADENA CIRCULAR IDENTIFICADA

```mermaid
flowchart LR
    AppModule --> OcrModule
    OcrModule -->|imports| CanonicalDictionaryModule
    CanonicalDictionaryModule -->|forwardRef| DonationProcessModule
    DonationProcessModule -->|forwardRef (CORREGIDO)| OcrModule

    subgraph Dependencias_Inyectadas ["Dependencias Inyectadas en el Ciclo"]
        OcrWorkflowUseCase -->|usa| CanonicalPropagationEngine
        GetProcessCanonicalValuesUseCase -->|usa| DONATION_PROCESS_REPOSITORY
        IntakeDonorFromClinicalHistoryUseCase -->|usa| StartOcrUseCase & OCR_REPOSITORY
    end
```

### Resumen de la cadena:
- **`DonationProcessModule`** necesita **`OcrModule`** para inyectar `StartOcrUseCase` y `OCR_REPOSITORY` en `IntakeDonorFromClinicalHistoryUseCase`.
- **`OcrModule`** necesita **`CanonicalDictionaryModule`** para inyectar `CanonicalPropagationEngine` en `OcrWorkflowUseCase`.
- **`CanonicalDictionaryModule`** necesita **`DonationProcessModule`** para inyectar `DONATION_PROCESS_REPOSITORY` en `GetProcessCanonicalValuesUseCase`.

---

## 3. ARCHIVOS CORREGIDOS Y JUSTIFICACIÓN DE FORWARDREF

### Archivo modificado:
- [`src/presentation/processes/donation-process.module.ts`](file:///d:/Universidad/Diplomado/GODT/Backend/GODT-B/src/presentation/processes/donation-process.module.ts)

### Cambios realizados:
1. Importación del helper `forwardRef` desde `@nestjs/common`:
   ```typescript
   import { Module, forwardRef } from "@nestjs/common";
   ```
2. Encapsulamiento de `OcrModule` dentro de una función de referencia diferida en el arreglo `imports`:
   ```typescript
   @Module({
     imports: [
       AuthModule,
       PrismaModule,
       InstitutionModule,
       DocumentsModule,
       forwardRef(() => OcrModule), // Índice [4] diferido
     ],
     ...
   })
   ```

### Justificación técnica:
- En NestJS, cuando existe una dependencia circular entre módulos (sea directa de dos nodos $A \leftrightarrow B$ o transitiva de tres o más nodos $A \to B \to C \to A$), el cargador de módulos de Node.js deja símbolos con valor `undefined` mientras resuelve las dependencias circulares.
- El uso de `forwardRef(() => OcrModule)` difiere la resolución del identificador de clase hasta que todas las funciones de los módulos del ciclo han sido ejecutadas en el runtime, permitiendo que NestJS construya el contenedor de inyección de dependencias (DI) sin errores.
- No se modificó la arquitectura de capas ni se eliminaron proveedores, use cases ni controllers.

---

## 4. RESULTADOS DE COMPILACIÓN Y ARRANQUE REAL

### A. Compilación TypeScript (`npm run build`)
```text
> godt-b@0.1.0 build
> nest build

Compilación finalizada exitosamente con código de salida 0.
```

### B. Arranque real en desarrollo (`npm run start:dev` y `node dist/src/main.js`)
```text
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [NestFactory] Starting Nest application...
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [InstanceLoader] AppModule dependencies initialized +36ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [InstanceLoader] PrismaModule dependencies initialized +1ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [InstanceLoader] OcrModule dependencies initialized +2ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [InstanceLoader] CanonicalDictionaryModule dependencies initialized +1ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [InstanceLoader] DonationProcessModule dependencies initialized +1ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [BullmqDossierQueueService] BullMQ Dossier Queue & Worker (worker-59036-94a6dc7d) inicializados exitosamente.
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [NestApplication] Nest application successfully started +6ms
[Nest] 59036  - 08/11/2026, 2:46:55 a. m.     LOG [Bootstrap] Servidor GODT Backend escuchando en puerto 3000 (entorno: development)
```

### C. Prueba del endpoint `/health` en vivo
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```
Respuesta HTTP 200 OK:
```json
{
  "status": "ok",
  "database": "up",
  "redis": "up",
  "storage": "up",
  "environment": "development",
  "version": "1.0.0-fase-f",
  "timestamp": "2026-11-08T07:48:17.561Z"
}
```

---

## 5. VERIFICACIÓN DE INYECCIÓN DE DEPENDENCIAS (TEST DEDICADO)

Se creó la suite [`test/module-resolution-and-injection.spec.ts`](file:///d:/Universidad/Diplomado/GODT/Backend/GODT-B/test/module-resolution-and-injection.spec.ts) para comprobar la inyección de los servicios críticos:

```text
PASS test/module-resolution-and-injection.spec.ts
  NestJS DI and Circular Module Resolution Verification
    √ resuelve e inicializa correctamente DonationProcessModule y OcrModule sin UndefinedModuleException (2 ms)
    √ inyecta correctamente IntakeDonorFromClinicalHistoryUseCase con sus dependencias (1 ms)
    √ inyecta correctamente StartOcrUseCase con sus dependencias de OCR (1 ms)
    √ inyecta correctamente OcrWorkflowUseCase y CanonicalPropagationEngine (1 ms)
    √ inyecta correctamente los controladores DonationProcessController y OcrController (1 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

---

## 6. PRUEBAS DE REGRESIÓN E INTEGRACIÓN (POSTGRESQL Y REDIS ACTIVOS)

Con los contenedores Docker de PostgreSQL 17 (puerto 5432) y Redis 7.4 (puerto 6379) activos y verificados:

1. **Suite de Ingesta desde Historia Clínica:**
   - Archivo: `test/fase-g1-clinical-history-intake.spec.ts`
   - Resultado: **10 tests pasados (10/10 PASS)**
2. **Suite de Regresión OCR y Almacenamiento Privado:**
   - Archivo: `test/fase-g1-ingestion-ocr-canonical.spec.ts`
   - Resultado: **17 tests pasados (17/17 PASS)**
3. **Suite de Operaciones Reales HTTP API (20 operaciones contra PostgreSQL):**
   - Archivo: `test/real-http-api-operations.spec.ts`
   - Resultado: **20 tests pasados (20/20 PASS)**
4. **Suite de Integración Canónica en PostgreSQL:**
   - Archivo: `test/canonical-postgres-integration.spec.ts`
   - Resultado: **12 tests pasados (12/12 PASS)**
5. **Suite E2E Escenarios Reales (Ciclo de Vida y Snapshots):**
   - Archivo: `test/fase-d2-e2e-scenarios.spec.ts`
   - Resultado: **7 tests pasados (7/7 PASS)**
6. **Suite Integral General (`npm test`):**
   - **Test Suites: 36 passed, 36 total (100% de éxito)**
   - **Tests: 279 passed, 1 skipped, 280 total**

---

## 7. ERRORES PENDIENTES

- **Cero errores pendientes.** Todos los módulos, use cases, repositorios, controladores y colas BullMQ arrancan e interactúan de forma limpia.

---

## 8. ESTADO DE GIT Y POLÍTICA DE MERGE

- **Rama Feature de Trabajo:** `feature/clinical-history-donor-intake-ocr`
- **Rama `main` Local:** Sincronizada y limpia con respecto a `origin/main` (`Your branch is up to date with 'origin/main'`).
- **Política de Protección:** **No se realizó merge directo a `main`**, conservando la integridad de la rama principal para su integración mediante Pull Request.

