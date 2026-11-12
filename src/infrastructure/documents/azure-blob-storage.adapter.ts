import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobServiceClient,
  ContainerClient,
  RestError,
} from "@azure/storage-blob";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import { basename } from "path";
import {
  FileStoragePort,
  StoredFile,
} from "../../application/documents/file-storage.port";

/**
 * Adaptador de Azure Blob Storage para FileStoragePort.
 *
 * Seguridad:
 * - Usa contenedor privado sin acceso anónimo.
 * - En Azure (producción/staging) autentica con Managed Identity (DefaultAzureCredential)
 *   usando AZURE_STORAGE_ACCOUNT_URL (sin llaves compartidas en código o imágenes).
 * - Para pruebas/emulador local (Azurite), acepta AZURE_STORAGE_CONNECTION_STRING
 *   únicamente cuando se define explícitamente por variable de entorno.
 */
@Injectable()
export class AzureBlobStorageAdapter implements FileStoragePort {
  private readonly logger = new Logger(AzureBlobStorageAdapter.name);
  private readonly containerClient: ContainerClient;
  private readonly maxBytes: number;
  private readonly containerName: string;

  constructor(config: ConfigService, containerClientOverride?: ContainerClient) {
    this.containerName = (
      config.get<string>("AZURE_STORAGE_CONTAINER", "godt-documents") ||
      "godt-documents"
    ).trim();

    this.maxBytes = Number(
      config.get(
        "MAX_UPLOAD_FILE_SIZE_BYTES",
        config.get("DOCUMENT_STORAGE_MAX_BYTES", 20 * 1024 * 1024),
      ),
    );

    if (containerClientOverride) {
      this.containerClient = containerClientOverride;
      return;
    }

    const connectionString = (
      config.get<string>("AZURE_STORAGE_CONNECTION_STRING") || ""
    ).trim();
    const accountUrl = (
      config.get<string>("AZURE_STORAGE_ACCOUNT_URL") || ""
    ).trim();
    const nodeEnv = (config.get<string>("NODE_ENV") || "development")
      .trim()
      .toLowerCase();

    if (!this.containerName) {
      throw new Error(
        "[CRITICAL] AZURE_STORAGE_CONTAINER es obligatorio cuando STORAGE_PROVIDER=azure.",
      );
    }

    let blobServiceClient: BlobServiceClient;
    if (accountUrl) {
      // Autenticación recomendada en Azure Container Apps: Managed Identity (OIDC/MSI)
      blobServiceClient = new BlobServiceClient(
        accountUrl,
        new DefaultAzureCredential(),
      );
      if (connectionString && (nodeEnv === "production" || nodeEnv === "staging")) {
        this.logger.warn(
          "Se detectaron AZURE_STORAGE_ACCOUNT_URL y AZURE_STORAGE_CONNECTION_STRING en entorno productivo; se prioriza Managed Identity.",
        );
      }
    } else if (connectionString) {
      if (nodeEnv === "production" || nodeEnv === "staging") {
        this.logger.warn(
          "AzureBlobStorageAdapter inicializado con AZURE_STORAGE_CONNECTION_STRING en entorno productivo; se recomienda migrar a Managed Identity con AZURE_STORAGE_ACCOUNT_URL.",
        );
      }
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      throw new Error(
        "[CRITICAL] Configuración incompleta para Azure Blob Storage: defina AZURE_STORAGE_ACCOUNT_URL (Managed Identity) o AZURE_STORAGE_CONNECTION_STRING (solo desarrollo/Azurite).",
      );
    }

    this.containerClient = blobServiceClient.getContainerClient(this.containerName);
  }

  async put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    processId?: string;
    sourceDocumentId?: string;
    subDirectory?: "original" | "extracted" | "pages" | string;
  }): Promise<StoredFile> {
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1) {
      throw new Error("DOCUMENT_STORAGE_MAX_BYTES is invalid");
    }
    if (input.buffer.length > this.maxBytes) {
      throw new Error("File exceeds the configured storage limit");
    }
    if (!input.mimeType) {
      throw new Error("File MIME type is required");
    }

    const storageKey = this.buildStorageKey(input);
    const sha256Hash = createHash("sha256").update(input.buffer).digest("hex");
    const blockBlobClient = this.containerClient.getBlockBlobClient(storageKey);

    await blockBlobClient.uploadData(input.buffer, {
      blobHTTPHeaders: {
        blobContentType: input.mimeType,
      },
      metadata: {
        sha256: sha256Hash,
        ...(input.sourceDocumentId
          ? { source_document_id: input.sourceDocumentId }
          : {}),
      },
    });

    return {
      storageKey,
      sha256Hash,
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    this.assertKey(storageKey);
    const blockBlobClient = this.containerClient.getBlockBlobClient(storageKey);
    try {
      return await blockBlobClient.downloadToBuffer();
    } catch (error) {
      if (this.isBlobNotFoundError(error)) {
        throw new NotFoundException(`Stored blob not found for key: ${storageKey}`);
      }
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    this.assertKey(storageKey);
    const blockBlobClient = this.containerClient.getBlockBlobClient(storageKey);
    await blockBlobClient.deleteIfExists();
  }

  async exists(storageKey: string): Promise<boolean> {
    this.assertKey(storageKey);
    const blockBlobClient = this.containerClient.getBlockBlobClient(storageKey);
    return blockBlobClient.exists();
  }

  async checkHealth(): Promise<boolean> {
    return this.containerClient.exists();
  }

  private buildStorageKey(input: {
    originalFilename: string;
    processId?: string;
    sourceDocumentId?: string;
    subDirectory?: string;
  }): string {
    const cleanBase = basename(input.originalFilename || "file.bin");
    const rawExt = cleanBase.includes(".") ? cleanBase.split(".").pop() : undefined;
    const extension = (rawExt?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()) || "bin";

    if (input.processId && input.sourceDocumentId) {
      const safeProcessId = input.processId.replace(/[^a-zA-Z0-9_-]/g, "");
      const safeSourceId = input.sourceDocumentId.replace(/[^a-zA-Z0-9_-]/g, "");
      const sub = input.subDirectory
        ? input.subDirectory.replace(/[^a-zA-Z0-9_-]/g, "")
        : "original";
      return `donations/${safeProcessId}/sources/${safeSourceId}/${sub || "original"}/${randomUUID()}.${extension}`;
    }

    return `source-documents/${randomUUID()}.${extension}`;
  }

  private assertKey(storageKey: string): void {
    if (
      !storageKey ||
      storageKey.includes("..") ||
      storageKey.startsWith("/") ||
      storageKey.includes("\\") ||
      /[\x00-\x1f\x7f]/.test(storageKey)
    ) {
      throw new Error("Invalid storage key");
    }
  }

  private isBlobNotFoundError(error: unknown): boolean {
    if (error instanceof RestError) {
      return error.statusCode === 404 || error.code === "BlobNotFound";
    }
    if (typeof error === "object" && error !== null) {
      const candidate = error as { statusCode?: number; code?: string };
      return candidate.statusCode === 404 || candidate.code === "BlobNotFound";
    }
    return false;
  }
}

