# GODT REGIONAL 3 — FASE F
## PREPARACIÓN DEL PILOTO OPERATIVO Y CRITERIOS DE ACEPTACIÓN
### Documento de Entrega Técnica: FASE_F_PILOT_READINESS.md

---

## 1. CONTEXTO OPERACIONAL DEL PILOTO

El presente documento define las directrices operativas, el flujo secuencial de 14 pasos, los perfiles de usuario y los criterios de aceptación (Go / No-Go) para la ejecución del **Piloto Controlado de Simulación Documental** del sistema **GODT Regional 3** (cobertura territorial: Caldas, Quindío y Risaralda).

---

## 2. FLUJO OPERATIVO INTEGRAL DE 14 PASOS (SIMULACIÓN CLÍNICA SINTÉTICA)

```
[1. Apertura] ──► [2. Participantes] ──► [3. Anexo 1] ──► [4. Propagación Canónica]
                                                                   │
                                                                   ▼
[8. Atestaciones] ◄── [7. Snapshots] ◄── [6. Anexo 7 (11)] ◄── [5. Anexos 2-19]
       │
       ▼
[9. Cadena Custodia] ──► [10. Solicitud Dossier] ──► [11. Cola BullMQ]
                                                            │
                                                            ▼
[14. Verificación] ◄── [13. Manifiesto RFC 8785] ◄── [12. Renderizado PDF & ZIP]
```

### Paso 1: Detección y Creación del Proceso de Donación
- Registro de la alerta de donación en la IPS generadora.
- Asignación de código único de proceso (ej. `PROC-2026-R3-001`).
- Registro de datos demográficos iniciales del potencial donante.

### Paso 2: Asignación Institucional y Vinculación de Participantes
- Vinculación de la IPS generadora y la IPS trasplantadora.
- Registro de participantes con roles específicos:
  - Coordinador Operativo de Trasplantes.
  - Médico Evaluador / Neurólogo (para diagnóstico de muerte encefálica).
  - Profesional de Enfermería.
  - Testigo / Familiar declarante.

### Paso 3: Diligenciamiento del Anexo 1 (Detección y Selección)
- Captura de variables clínicas iniciales, causa de ingreso hospitalario y soporte hemodinámico.
- Validación de campos requeridos y estructura JSON Schema.

### Paso 4: Propagación Canónica de Datos
- Extracción automática de campos canónicos (`donor.fullName`, `donor.documentNumber`, `donor.bloodType`, etc.).
- Persistencia en `DonationProcess.canonicalData`.
- Pre-llenado automático de las secciones correspondientes en los anexos subsiguientes.

### Paso 5: Diligenciamiento de Formatos Documentales Enriquecidos (Anexos 2 al 6 y 8 al 19)
- Cobertura técnica del 100% de los formatos implementados:
  - Anexo 2: Evaluación médica y examen físico.
  - Anexo 3: Declaración de consentimiento / presunción legal de donación.
  - Anexo 4: Certificación de muerte encefálica.
  - Anexo 5: Paraclínicos y gases arteriales.
  - Anexo 6: Tiempos de isquemia y extracción.
  - Anexos 8 al 19: Protocolos específicos de mantenimiento, serología y destino anatómico.

### Paso 6: Diligenciamiento de las 11 Variantes del Anexo 7
- Selección y diligenciamiento de actas específicas por órgano y tejido donado:
  - Corazón, Pulmón Izquierdo, Pulmón Derecho, Hígado, Riñón Izquierdo, Riñón Derecho, Páncreas, Córnea Izquierda, Córnea Derecha, Hueso y Piel.

### Paso 7: Generación de Snapshots e Inmutabilidad Criptográfica
- Transición de documentos a estado `APPROVED` o `COMPLETED`.
- Creación de `DocumentSnapshot` con serialización JSON canónica y cálculo de digest SHA-256.
- Generación del PDF renderizado mediante `pdf-lib` con estampado de metadatos.

### Paso 8: Registro de Atestaciones y Firmas Electrónicas Simples
- Captura de la firma electrónica de los participantes involucrados.
- Declaración explícita bajo fe de juramento clínico.
- Cálculo de huella criptográfica SHA-256 asociada a la tupla `(actor, documento, versión, fecha)`.
- Bloqueo estricto del uso de terminología de "firma digital certificada".

### Paso 9: Registro de Cadena de Custodia
- Registro cronológico inmutable de eventos en `CustodyEvent`: creación, edición, aprobación, adición de anexos y exportación.

### Paso 10: Solicitud de Generación del Expediente Consolidado
- Invocación del endpoint `POST /api/donations/:id/dossier/export`.
- Creación del registro `ProcessDossierExport` en estado `PENDING`.

### Paso 11: Procesamiento Asíncrono en BullMQ
- Encolamiento del trabajo en Redis.
- Asignación a worker con `workerInstanceId` único y heartbeat periódico cada 15 segundos.
- Control de concurrencia y recuperación automática de tareas huérfanas.

### Paso 12: Consolidación del PDF del Expediente
- Ensamblado de carátula institucional con datos del proceso.
- Índice general con numeración correlativa de páginas.
- Fusión de los 23 documentos y separadores de sección.

### Paso 13: Generación del Paquete ZIP y Manifiesto Canónico RFC 8785
- Empaquetamiento en streaming de PDFs individuales y expediente consolidado.
- Exclusión segura de documentos fuente confidenciales por defecto (`includeSourceDocuments=false`).
- Generación de `manifest.json` serializado estrictamente bajo RFC 8785 con digest SHA-256 final.

### Paso 14: Verificación Integral de Integridad del Expediente
- Ejecución de `VerifyDossierIntegrityUseCase` desde la interfaz o API.
- Descompresión protegida contra ZIP bombs (máximo 500 entradas, 500 MB).
- Comprobación matemática del 100% de los hashes del manifiesto contra los archivos físicos.
- Aprobación visual en el tablero de control de GODT Regional 3.

---

## 3. CRITERIOS DE ACEPTACIÓN (CHECKLIST GO / NO-GO)

| # | Criterio de Aceptación | Método de Comprobación | Umbral de Éxito | Estado |
| :- | :--- | :--- | :--- | :---: |
| **C-01** | Pruebas de integración y unitarias | `npm test` en backend | 22 suites / 165 pruebas aprobadas | **PASÓ** |
| **C-02** | Contratos de API frontend-backend | `npm run test:contracts` en front | 5 contratos verificados sin fallos | **PASÓ** |
| **C-03** | Compilación de producción limpia | `npm run build` en backend y front | 0 errores TypeScript, bundle optimizado | **PASÓ** |
| **C-04** | Serialización canónica RFC 8785 | Vector oficial RFC 8785 en tests | Validación de sustitutos, orden UTF-16 | **PASÓ** |
| **C-05** | Integridad de respaldos y restauración | `npm run backup:test` | 366/366 archivos (100% SHA-256 match) | **PASÓ** |
| **C-06** | Seguridad de arranque en producción | `validateCriticalEnvironment` | Rechazo de credenciales débiles y JWT $<32$ | **PASÓ** |
| **C-07** | Protección contra ZIP Bomb | Simulación de descompresión | Rechazo de archivos $>500$ entradas / 500MB | **PASÓ** |
| **C-08** | Terminología jurídica regulada | Búsqueda léxica en código y docs | Cero menciones de "firma certificada/no repudio" | **PASÓ** |

---

## 4. DESCARGO DE RESPONSABILIDAD MÉDICO-LEGAL

> [!WARNING]
> **AVISO IMPORTANTE:** El sistema GODT Regional 3 en su estado actual se encuentra preparado y validado exclusivamente para **entornos de simulación académica, entrenamiento de coordinadores y prueba piloto controlada con datos ficticios/sintéticos**.
> 
> La operación con pacientes reales y procesos clínicos en vivo requiere:
> 1. Acto administrativo formal de autorización expedido por la Dirección de Prestación de Servicios de Salud y el Instituto Nacional de Salud (INS).
> 2. Integración formal con una Entidad de Certificación Digital acreditada por la ONAC para la emisión de firmas digitales con valor probatorio pleno según la Ley 527 de 1999, o la adopción formal del protocolo de atestación simple por parte del Comité de Ética y Trasplantes de la Regional 3.
> 3. Cero inclusión de datos personales de donantes reales durante la fase de validación técnica.
