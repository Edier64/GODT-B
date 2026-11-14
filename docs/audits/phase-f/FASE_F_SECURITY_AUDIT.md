# GODT REGIONAL 3 — FASE F
## AUDITORÍA DE SEGURIDAD Y CONTROL DE RIESGOS DOCUMENTALES
### Documento de Entrega Técnica: FASE_F_SECURITY_AUDIT.md

---

## 1. RESUMEN EJECUTIVO

La presente auditoría técnica y de seguridad evalúa los controles criptográficos, la protección de información clínica confidencial, el control de acceso basado en roles (RBAC), la resistencia a ataques de denegación de servicio por descompresión (ZIP bombs) y la conformidad de serialización canónica para el sistema **GODT Regional 3**.

---

## 2. MATRIZ DE HALLAZGOS Y REMEDIACIONES DE SEGURIDAD

| # | Hallazgo | Riesgo Asociado | Severidad | Evidencia Técnica | Corrección Aplicada | Estado | Pendiente | Responsable / Área |
| :- | :--- | :--- | :---: | :--- | :--- | :---: | :--- | :--- |
| **H-01** | Uso potencial de claves débiles o por defecto en `JWT_SECRET` | Suplantación de identidad de coordinadores médicos o acceso no autorizado | **ALTA** | En entornos dev existían valores como `"supersecret"` o cadenas cortas de menos de 16 caracteres. | Validación en arranque (`main.ts`): aborta si `JWT_SECRET` mide $<32$ caracteres o coincide con palabras inseguras en `production` / `staging`. | **RESUELTO** | Rotación semestral de secretos en producción. | Seguridad de la Información / DevOps |
| **H-02** | Sustitución no conforme de sustitutos huérfanos Unicode (RFC 8785) | Variaciones de digest SHA-256 entre plataformas y no conformidad con RFC 8785 | **MEDIA** | `JSON.stringify` en V8 reemplaza puntos de código `U+D800..U+DFFF` por caracteres de escape `\ud800` en lugar de fallar. | Función `containsLoneSurrogate` en `dossier.types.ts` que rechaza cadenas con sustitutos huérfanos antes de serializar. | **RESUELTO** | Ninguno. | Arquitectura de Software |
| **H-03** | Colisión de `workerInstanceId` en réplicas con `INSTANCE_ID` estático | Robo de lease de tareas activas entre réplicas del worker BullMQ | **ALTA** | ConfigMaps de Kubernetes con el mismo valor estático de `INSTANCE_ID` en todos los pods de la réplica. | Composición dinámica del ID: `${INSTANCE_ID}-${process.pid}-${randomBytes(4).toString("hex")}`. | **RESUELTO** | Ninguno. | DevOps / Backend Lead |
| **H-04** | Condición de carrera en recuperación de exportaciones huérfanas | Múltiples workers procesando o cancelando simultáneamente la misma exportación | **ALTA** | `update({ where: { id } })` incondicional sobre exportaciones en estado `PROCESSING`. | Bloqueo optimista atómico con `updateMany({ where: { id, status: 'PROCESSING', lastHeartbeatAt } })`. | **RESUELTO** | Ninguno. | Backend Lead |
| **H-05** | Activación indebida de cola en memoria en producción | Pérdida de tareas de exportación por reinicios del servicio en despliegues reales | **ALTA** | La bandera `ENABLE_IN_MEMORY_QUEUE_FALLBACK` permitía degradación si no se validaba el entorno. | Compuerta estricta: fallback bloqueado a menos que `NODE_ENV === "development"` o `test`. En producción lanza 503 Service Unavailable. | **RESUELTO** | Monitorización de conectividad Redis en producción. | DevOps |
| **H-06** | Vulnerabilidad de denegación de servicio por compresión (ZIP Bomb) | Agotamiento de almacenamiento y memoria RAM del servidor al verificar ZIPs | **ALTA** | Descompresión sin límite de entradas o tamaño expandido en `VerifyDossierIntegrityUseCase`. | Límites estrictos: `MAX_ZIP_ENTRIES = 500` y `MAX_TOTAL_UNCOMPRESSED_BYTES = 500 MB`. Rechaza archivos que excedan umbrales. | **RESUELTO** | Ninguno. | Seguridad de Aplicaciones |
| **H-07** | Salto de directorio (Path Traversal) en lectura de archivos ZIP | Escritura o lectura arbitraria de archivos fuera del directorio seguro | **CRÍTICA** | Nombres de entradas en ZIP conteniendo `../`, `..\` o rutas absolutas `/etc/passwd`. | Normalización y validación estricta de rutas de entrada: rechaza `..`, prefijos `/` o `\`, y caracteres de control. | **RESUELTO** | Ninguno. | Seguridad de Aplicaciones |
| **H-08** | Confusión entre atestación electrónica simple y firma digital certificada | Incumplimiento de la Ley 527 de 1999 y exigencias de entidades de acreditación (ONAC) | **ALTA** | Uso ambiguo de términos como "firma digital certificada" o "no repudio" en interfaces y documentación previa. | Prohibición estricta de términos legales engañosos. Bloqueo de `DIGITAL_CERTIFICADA`. Modelo clasificado como **Atestación Técnica Electrónica Bajo Fe de Juramento Clínico**. | **RESUELTO** | Auditoría jurídica periódica ante el Ministerio de Salud / INS. | Asesoría Jurídica / Dirección Médica |
| **H-09** | Política CORS permisiva en despliegue de desarrollo | Acceso cruzado no deseado a APIs clínico-documentales desde dominios de terceros | **MEDIA** | Orígenes comodín `*` o localhost activos indistintamente del entorno de ejecución. | Orígenes configurables vía `CORS_ORIGIN`, validación estricta de dominio, bloqueo de wildcard `*` en producción. | **RESUELTO** | Configuración de DNS y certificados SSL en proxy inverso. | DevOps |
| **H-10** | Exposición de documentos fuente confidenciales en el expediente público | Fuga de datos de historia clínica original no anonimizada a destinatarios no autorizados | **ALTA** | Inclusión indiscriminada de todos los `SourceDocument` en el ZIP exportable. | Flag `includeSourceDocuments=false` por defecto en la exportación del expediente. Exige permiso explícito de Coordinación Regional. | **RESUELTO** | Verificación en auditorías de entrega documental. | Comité de Ética y Trasplantes |
| **H-11** | Presencia de datos personales o clínicos reales en pruebas o repositorios | Vulneración de la Ley 1581 de 2012 (Habeas Data) y secreto profesional médico | **CRÍTICA** | Riesgo de utilizar cédulas o historias clínicas de pacientes reales durante pruebas del sistema. | Toda la información utilizada en semillas, pruebas unitarias e integración es **100% sintética y ficticia** (nombres, cédulas, diagnósticos). | **RESUELTO** | Política de "Cero Datos Reales en Ambientes No Productivos". | Oficial de Protección de Datos |
| **H-12** | Monitoreo de salud sin visibilidad de subsistemas críticos | Desconocimiento del estado real de degradación ante caídas de Postgres o Redis | **MEDIA** | Endpoint `/api/health` retornando únicamente `{ status: 'ok' }` sin probar conexiones activas. | Probe integral en `HealthService` que ejecuta `SELECT 1` en Postgres, `ping()` en Redis y `fs.accessSync` en almacenamiento, reportando estado consolidado. | **RESUELTO** | Integración con sistema de alertas de infraestructura (Prometheus / Datadog). | DevOps / Monitoreo |

---

## 3. ESPECIFICACIÓN DEL MODELO DE FIRMA Y ATESTACIÓN

### 3.1 Naturaleza Criptográfica y Jurídica
El sistema GODT Regional 3 implementa **Atestaciones Técnicas Electrónicas con Huella Criptográfica SHA-256** asociadas al contexto de autenticación del usuario clínico autenticado:

```typescript
export interface DossierSignatureItem {
  attestationId: string;
  actorIdentity: {
    participantId: string;
    fullName: string;
    documentNumber: string;
    signerRole: string;
  };
  documentInstanceId: string;
  documentCode: string;
  documentPosition: number;
  versionNumber: number;
  documentPdfSha256: string;
  signatureType: string;
  attestationType: string;
  declaration: string;
  signedAt: string;
  attestationDigest: string;
}
```

### 3.2 Términos Excluidos y Prohibidos
Queda taxativamente prohibido en código, documentación e interfaces de usuario el uso de los siguientes términos:
- ❌ *"Firma digital certificada"* (reservada para certificados emitidos por entidades de certificación digital abiertas acreditadas por la ONAC).
- ❌ *"No repudio técnico/jurídico absoluto"*.
- ❌ *"Validez jurídica garantizada frente a terceros"*.
- ❌ *"Equivalencia legal plena con firma manuscrita"*.

La modalidad autorizada para este sistema es:
- ✅ **Atestación Técnica Electrónica con Trazabilidad y Cadena de Custodia**.
- ✅ **Firma Electrónica Simple bajo Contexto Institucional Autenticado**.

---

## 4. CONCLUSIÓN DE SEGURIDAD

El sistema GODT Regional 3 ha superado los criterios de seguridad técnica para la fase de pruebas y piloto controlado. Los riesgos de inyección, salto de directorio, denegación de servicio por compresión y falsificación de firmas electrónicas han sido mitigados satisfactoriamente.
