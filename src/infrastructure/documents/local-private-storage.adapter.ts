import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { randomUUID } from "crypto";
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
        "LOCAL_STORAGE_PATH",
        config.get("DOCUMENT_STORAGE_PATH", "storage/private"),
      ),
    );
    this.maxBytes = Number(
      config.get("DOCUMENT_STORAGE_MAX_BYTES", 10 * 1024 * 1024),
    );
  }

  async put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
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
    const storageKey = `source-documents/${randomUUID()}.${extension}`;
    await mkdir(this.root, { recursive: true });
    const target = resolve(this.root, storageKey);
    if (
      !target.startsWith(
        `${this.root}${process.platform === "win32" ? "\\" : "/"}`,
      )
    ) {
      throw new Error("Invalid storage key");
    }
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, input.buffer, { flag: "wx" });
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

  private pathFor(storageKey: string): string {
    const target = resolve(this.root, storageKey);
    if (
      !target.startsWith(
        `${this.root}${process.platform === "win32" ? "\\" : "/"}`,
      )
    ) {
      throw new Error("Invalid storage key");
    }
    return target;
  }
}
