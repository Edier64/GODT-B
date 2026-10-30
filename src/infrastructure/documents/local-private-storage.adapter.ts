import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { randomUUID } from "crypto";
import {
  FileStoragePort,
  StoredFile,
} from "../../application/documents/file-storage.port";

@Injectable()
export class LocalPrivateStorageAdapter implements FileStoragePort {
  private readonly root = resolve(
    process.env.DOCUMENT_STORAGE_PATH ?? "storage/private",
  );

  async put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredFile> {
    const extension =
      basename(input.originalFilename).split(".").pop()?.toLowerCase() ?? "bin";
    const storageKey = `${randomUUID()}.${extension}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, storageKey), input.buffer, { flag: "wx" });
    return {
      storageKey,
      sha256Hash: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    if (basename(storageKey) !== storageKey)
      throw new Error("Invalid storage key");
    return readFile(join(this.root, storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    if (basename(storageKey) !== storageKey)
      throw new Error("Invalid storage key");
    await unlink(join(this.root, storageKey));
  }
}
