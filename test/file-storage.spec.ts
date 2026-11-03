import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";

describe("LocalPrivateStorageAdapter", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "godt-storage-test-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("stores, reads and removes files without exposing a physical path", async () => {
    const config = new ConfigService({
      LOCAL_STORAGE_PATH: directory,
      DOCUMENT_STORAGE_MAX_BYTES: 1024,
    });
    const storage = new LocalPrivateStorageAdapter(config);
    const stored = await storage.put({
      buffer: Buffer.from("synthetic"),
      originalFilename: "source.pdf",
      mimeType: "application/pdf",
    });

    expect(stored.storageKey).toMatch(/^source-documents\/[0-9a-f-]+\.pdf$/);
    expect(await storage.get(stored.storageKey)).toEqual(
      Buffer.from("synthetic"),
    );
    await storage.remove(stored.storageKey);
    await expect(storage.get(stored.storageKey)).rejects.toThrow();
  });

  it("rejects traversal keys and oversized files", async () => {
    const config = new ConfigService({
      LOCAL_STORAGE_PATH: directory,
      DOCUMENT_STORAGE_MAX_BYTES: 4,
    });
    const storage = new LocalPrivateStorageAdapter(config);
    await expect(
      storage.put({
        buffer: Buffer.from("large"),
        originalFilename: "source.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow("configured storage limit");
    await expect(storage.get("../secret")).rejects.toThrow(
      "Invalid storage key",
    );
  });
});
