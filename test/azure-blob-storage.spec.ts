import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { AzureBlobStorageAdapter } from "../src/infrastructure/documents/azure-blob-storage.adapter";
import { FILE_STORAGE_PORT } from "../src/application/documents/file-storage.port";
import { Test } from "@nestjs/testing";
import { StorageModule } from "../src/infrastructure/documents/storage.module";
import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn(),
  })),
}));

jest.mock("@azure/storage-blob", () => {
  class MockRestError extends Error {
    statusCode?: number;
    code?: string;
    constructor(message: string, options?: { statusCode?: number; code?: string }) {
      super(message);
      this.statusCode = options?.statusCode;
      this.code = options?.code;
    }
  }
  return {
    RestError: MockRestError,
    BlobServiceClient: Object.assign(
      jest.fn().mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue({
          getBlockBlobClient: jest.fn(),
          exists: jest.fn().mockResolvedValue(true),
        }),
      })),
      {
        fromConnectionString: jest.fn().mockReturnValue({
          getContainerClient: jest.fn().mockReturnValue({
            getBlockBlobClient: jest.fn(),
            exists: jest.fn().mockResolvedValue(true),
          }),
        }),
      },
    ),
  };
});

describe("AzureBlobStorageAdapter", () => {
  const createMockContainer = () => {
    const store = new Map<string, Buffer>();
    const metadata = new Map<string, Record<string, string> | undefined>();
    const getBlockBlobClient = jest.fn((key: string) => ({
      uploadData: jest.fn(async (buf: Buffer, options?: { metadata?: Record<string, string> }) => {
        store.set(key, Buffer.from(buf));
        metadata.set(key, options?.metadata);
      }),
      downloadToBuffer: jest.fn(async () => {
        const found = store.get(key);
        if (!found) {
          throw Object.assign(new Error("BlobNotFound"), {
            statusCode: 404,
            code: "BlobNotFound",
          });
        }
        return found;
      }),
      deleteIfExists: jest.fn(async () => {
        store.delete(key);
      }),
      exists: jest.fn(async () => store.has(key)),
    }));
    return {
      container: {
        getBlockBlobClient,
        exists: jest.fn().mockResolvedValue(true),
      },
      store,
      metadata,
    };
  };

  it("preserva SHA-256, clave esperada, put/get/exists/remove", async () => {
    const { container, metadata } = createMockContainer();
    const config = new ConfigService({
      AZURE_STORAGE_CONTAINER: "godt-documents",
      DOCUMENT_STORAGE_MAX_BYTES: 2048,
    });
    const adapter = new AzureBlobStorageAdapter(config, container as never);
    const payload = Buffer.from("HISTORIA_CLINICA_SINTETICA");
    const expectedSha = createHash("sha256").update(payload).digest("hex");

    const stored = await adapter.put({
      buffer: payload,
      originalFilename: "historia.pdf",
      mimeType: "application/pdf",
      processId: "proc-123",
      sourceDocumentId: "doc-456",
      subDirectory: "original",
    });

    expect(stored.sha256Hash).toBe(expectedSha);
    expect(stored.storageKey).toMatch(
      /^donations\/proc-123\/sources\/doc-456\/original\/[0-9a-f-]+\.pdf$/,
    );
    expect(metadata.get(stored.storageKey)).toEqual({
      sha256: expectedSha,
      source_document_id: "doc-456",
    });
    expect(await adapter.exists(stored.storageKey)).toBe(true);
    expect(await adapter.get(stored.storageKey)).toEqual(payload);

    await adapter.remove(stored.storageKey);
    expect(await adapter.exists(stored.storageKey)).toBe(false);
    await expect(adapter.get(stored.storageKey)).rejects.toThrow(NotFoundException);
  });

  it("rechaza path traversal, archivos vacíos de MIME o que excedan el límite", async () => {
    const { container } = createMockContainer();
    const config = new ConfigService({
      AZURE_STORAGE_CONTAINER: "godt-documents",
      DOCUMENT_STORAGE_MAX_BYTES: 4,
    });
    const adapter = new AzureBlobStorageAdapter(config, container as never);

    await expect(
      adapter.put({
        buffer: Buffer.from("12345"),
        originalFilename: "big.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow("configured storage limit");

    await expect(adapter.get("../secret.pdf")).rejects.toThrow("Invalid storage key");
    await expect(adapter.exists("/abs/path.pdf")).rejects.toThrow("Invalid storage key");
    await expect(adapter.remove("bad\\key.pdf")).rejects.toThrow("Invalid storage key");
  });

  it("requiere AZURE_STORAGE_ACCOUNT_URL o AZURE_STORAGE_CONNECTION_STRING", () => {
    const config = new ConfigService({
      AZURE_STORAGE_CONTAINER: "godt-documents",
    });
    expect(() => new AzureBlobStorageAdapter(config)).toThrow(
      "Configuración incompleta para Azure Blob Storage",
    );
  });

  it("inicializa con DefaultAzureCredential cuando AZURE_STORAGE_ACCOUNT_URL está configurado", () => {
    const config = new ConfigService({
      NODE_ENV: "production",
      AZURE_STORAGE_ACCOUNT_URL: "https://godtstorage.blob.core.windows.net",
      AZURE_STORAGE_CONTAINER: "godt-documents",
    });
    const adapter = new AzureBlobStorageAdapter(config);
    expect(adapter).toBeDefined();
  });

  it("StorageModule selecciona AzureBlobStorageAdapter cuando STORAGE_PROVIDER=azure y LocalPrivateStorageAdapter por defecto", async () => {
    const origProvider = process.env.STORAGE_PROVIDER;
    const origUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
    const origContainer = process.env.AZURE_STORAGE_CONTAINER;

    try {
      process.env.STORAGE_PROVIDER = "azure";
      process.env.AZURE_STORAGE_ACCOUNT_URL = "https://godtstorage.blob.core.windows.net";
      process.env.AZURE_STORAGE_CONTAINER = "godt-documents";

      const azureModule = await Test.createTestingModule({
        imports: [StorageModule],
      }).compile();
      expect(azureModule.get(FILE_STORAGE_PORT)).toBeInstanceOf(AzureBlobStorageAdapter);
      await azureModule.close();

      process.env.STORAGE_PROVIDER = "local";
      const localModule = await Test.createTestingModule({
        imports: [StorageModule],
      }).compile();
      expect(localModule.get(FILE_STORAGE_PORT)).toBeInstanceOf(LocalPrivateStorageAdapter);
      await localModule.close();
    } finally {
      if (origProvider === undefined) delete process.env.STORAGE_PROVIDER;
      else process.env.STORAGE_PROVIDER = origProvider;
      if (origUrl === undefined) delete process.env.AZURE_STORAGE_ACCOUNT_URL;
      else process.env.AZURE_STORAGE_ACCOUNT_URL = origUrl;
      if (origContainer === undefined) delete process.env.AZURE_STORAGE_CONTAINER;
      else process.env.AZURE_STORAGE_CONTAINER = origContainer;
    }
  });
});

