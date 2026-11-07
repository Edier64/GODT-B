# GODT REGIONAL 3 — FASE G.1
## IMPLEMENTACIÓN DEL ALMACENAMIENTO PRIVADO LOCAL DE DOCUMENTOS
### Documento de Entrega Técnica: FASE_G1_LOCAL_STORAGE_IMPLEMENTATION.md

---

## 1. OBJETIVO Y ARQUITECTURA DE ALMACENAMIENTO

El subsistema de almacenamiento privado de **GODT Regional 3** implementa una arquitectura desacoplada basada en el puerto `FileStoragePort` y el adaptador concreto `LocalPrivateStorageAdapter`, garantizando el resguardo seguro, confidencial e inmutable de los documentos clínicos y evidencias anexas.

### 1.1 Jerarquía Estándar de Directorios
El almacenamiento físico se organiza de forma estricta por proceso de donación y por documento fuente, segregando los binarios originales de los artefactos derivados generados por los motores de OCR e Inteligencia Artificial:

```text
storage/
└── donations/
    └── {processId}/
        ├── sources/
        │   └── {sourceDocumentId}/
        │       ├── original/
        │       │   └── {uuid}.{ext}          <-- Binario original inmutable cargado por el usuario
        │       ├── extracted/
        │       │   ├── text.txt               <-- Texto plano extraído (capa digital o OCR)
        │       │   └── candidates.json        <-- Candidatos estructurados JSON de la extracción
        │       └── pages/
        │           ├── page_1.png             <-- Imágenes rasterizadas de páginas para OCR
        │           └── page_2.png
        ├── documents/
        │   └── {documentInstanceId}/
        │       └── snapshot_{sha256}.pdf      <-- PDFs oficiales generados y sellados
        └── dossier/
            └── {exportId}/
                ├── dossier_{processId}.pdf    <-- PDF continuo consolidado
                ├── dossier_{processId}.zip    <-- Expediente exportable con manifiesto
                └── manifest_{exportId}.json   <-- Manifiesto canónico RFC 8785
```

---

## 2. CONFIGURACIÓN Y PRECEDENCIA DE VARIABLES DE ENTORNO

La ruta física raíz se resuelve dinámicamente mediante `ConfigService` de NestJS, eliminando rutas absolutas codificadas en duro:

```typescript
this.root = resolve(
  config.get(
    "STORAGE_BASE_PATH",
    config.get(
      "LOCAL_STORAGE_PATH",
      config.get("DOCUMENT_STORAGE_PATH", "storage/private"),
    ),
  ),
);
```

- **Variable Principal:** `STORAGE_BASE_PATH` (ejemplo: `/var/godt/storage` en producción; `storage/private` en desarrollo).
- **Límite de Tamaño de Archivo:** `MAX_UPLOAD_FILE_SIZE_BYTES` (valor por defecto: 20 MB; configurable según las políticas de red institucional).

---

## 3. MECANISMOS DE SEGURIDAD Y DURABILIDAD

### 3.1 Escritura Atómica
Para evitar la persistencia de archivos truncados o corruptos ante cortes de energía o caídas del proceso de Node.js, toda escritura en disco se realiza de forma atómica:
1. El buffer recibido se escribe en un archivo temporal con sufijo aleatorio: `${target}.tmp.${randomBytes(4).toString("hex")}`.
2. Tras confirmar la escritura completa, se ejecuta una operación atómica a nivel de sistema de archivos (`rename(tempPath, target)`).
3. En caso de excepción, el archivo temporal se purga inmediatamente en el bloque `catch`.

### 3.2 Prevención de Salto de Directorio (Path Traversal)
Todo acceso de lectura o escritura valida la clave de almacenamiento (`storageKey`):
- Se rechazan claves que contengan secuencias relativas `..`.
- Se rechazan claves con prefijos absolutos `/` o `\`.
- Se comprueba matemáticamente que la ruta absoluta normalizada comience estrictamente con la raíz configurada:
  ```typescript
  if (!target.startsWith(`${normalizedRoot}${separator}`) && target !== normalizedRoot) {
    throw new Error("Invalid storage key");
  }
  ```

### 3.3 Aislamiento de Red y Privacidad
- El directorio de almacenamiento se ubica **fuera de la carpeta pública del frontend, fuera de `dist` y fuera de cualquier carpeta servida estáticamente** por Nginx o Express.
- Las respuestas del API REST **nunca retornan rutas físicas absolutas del servidor**; únicamente exponen identificadores de documento (`id`) y claves relativas internas (`objectStorageKey`).
- La descarga de archivos requiere autenticación JWT activa con verificación de pertenencia institucional (IPS generadora o rol `ADMIN`).

---

## 4. METADATOS EN BASE DE DATOS (`SOURCEDOCUMENT`)

La base de datos PostgreSQL conserva exclusivamente los metadatos y sumas de verificación criptográficas, nunca los binarios:

```prisma
model SourceDocument {
  id               String              @id @default(uuid()) @db.Uuid
  donorId          String              @map("donor_id") @db.Uuid
  processId        String?             @map("process_id") @db.Uuid
  uploadedById     String              @map("uploaded_by") @db.Uuid
  originalFilename String              @map("original_filename") @db.VarChar(255)
  mimeType         String              @map("mime_type") @db.VarChar(100)
  documentCategory String              @map("document_category") @db.VarChar(100)
  objectStorageKey String              @map("object_storage_key") @db.VarChar(500)
  sha256Hash       String              @map("sha256_hash") @db.Char(64)
  status           String              @db.VarChar(50)
  uploadedAt       DateTime            @default(now()) @map("uploaded_at") @db.Timestamptz(6)
  ...
}
```

---

## 5. CONCLUSIÓN

El adaptador `LocalPrivateStorageAdapter` cumple la totalidad de los requisitos técnicos de la Fase G.1: separación clara de originales y derivados, escritura atómica segura, control de duplicados por hash SHA-256 e inmunidad ante ataques de salto de directorio.

