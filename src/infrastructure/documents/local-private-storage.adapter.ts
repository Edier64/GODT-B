import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import {
  FileStoragePort,
  StoredFile,
} from "../../application/documents/file-storage.port";

@Injectable()
export class LocalPrivateStorageAdapter implements FileStoragePort {
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get(
        "STORAGE_BASE_PATH",
        config.get(
          "LOCAL_STORAGE_PATH",
          config.get("DOCUMENT_STORAGE_PATH", "storage/private"),
        ),
      ),
    );
    this.maxBytes = Number(
      config.get(
        "MAX_UPLOAD_FILE_SIZE_BYTES",
        config.get("DOCUMENT_STORAGE_MAX_BYTES", 20 * 1024 * 1024),
      ),
    );
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
    if (!input.mimeType) throw new Error("File MIME type is required");

    const extension =
      basename(input.originalFilename).split(".").pop()?.toLowerCase() ?? "bin";

    let storageKey: string;
    if (input.processId && input.sourceDocumentId) {
      const sub = input.subDirectory
        ? input.subDirectory.replace(/[^a-zA-Z0-9_-]/g, "")
        : "original";
      storageKey = `donations/${input.processId}/sources/${input.sourceDocumentId}/${sub}/${randomUUID()}.${extension}`;
    } else {
      storageKey = `source-documents/${randomUUID()}.${extension}`;
    }

    const target = this.pathFor(storageKey);
    const parentDir = resolve(target, "..");
    await mkdir(parentDir, { recursive: true });

    // Escritura atómica mediante archivo temporal y renombrado
    const tempPath = `${target}.tmp.${randomBytes(4).toString("hex")}`;
    try {
      await writeFile(tempPath, input.buffer, { flag: "w" });
      await rename(tempPath, target);
    } catch (error) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignorar error al limpiar temporal
      }
      throw error;
    }

    return {
      storageKey,
      sha256Hash: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.pathFor(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const s = await stat(this.pathFor(storageKey));
      return s.isFile();
    } catch {
      return false;
    }
  }

  private pathFor(storageKey: string): string {
    if (
      !storageKey ||
      storageKey.includes("..") ||
      storageKey.startsWith("/") ||
      storageKey.startsWith("\\")
    ) {
      throw new Error("Invalid storage key");
    }
    const target = resolve(this.root, storageKey);
    const normalizedRoot = resolve(this.root);
    const separator = process.platform === "win32" ? "\\" : "/";
    if (
      !target.startsWith(`${normalizedRoot}${separator}`) &&
      target !== normalizedRoot
    ) {
      throw new Error("Invalid storage key");
    }
    return target;
  }
}
