import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { basename } from "path";
import type { Readable } from "stream";
import {
  FileStoragePort,
  StoredFile,
} from "../../application/documents/file-storage.port";

@Injectable()
export class R2StorageAdapter implements FileStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const accountId = config.get<string>("R2_ACCOUNT_ID", "");
    const accessKeyId = config.get<string>("R2_ACCESS_KEY_ID", "");
    const secretAccessKey = config.get<string>("R2_SECRET_ACCESS_KEY", "");
    this.bucket = config.get<string>("R2_BUCKET", "");
    const endpoint = config.get<string>(
      "R2_ENDPOINT",
      `https://${accountId}.r2.cloudflarestorage.com`,
    );
    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !this.bucket ||
      !endpoint
    ) {
      throw new Error("R2 configuration is incomplete");
    }
    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredFile> {
    const extension =
      basename(input.originalFilename).split(".").pop()?.toLowerCase() ?? "bin";
    const storageKey = `source-documents/${randomUUID()}.${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );
    return {
      storageKey,
      sha256Hash: createHash("sha256").update(input.buffer).digest("hex"),
    };
  }

  async get(storageKey: string): Promise<Buffer> {
    this.assertKey(storageKey);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    if (!result.Body) throw new Error("Stored file has no content");
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as Readable)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async remove(storageKey: string): Promise<void> {
    this.assertKey(storageKey);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }

  private assertKey(storageKey: string): void {
    if (
      !storageKey ||
      storageKey.includes("..") ||
      storageKey.startsWith("/") ||
      storageKey.includes("\\")
    ) {
      throw new Error("Invalid storage key");
    }
  }
}
