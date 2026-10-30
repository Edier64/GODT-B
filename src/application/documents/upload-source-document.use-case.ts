import { Inject, Injectable } from "@nestjs/common";
import { SourceDocument } from "@prisma/client";
import { createHash } from "crypto";
import {
  DocumentAccessDeniedError,
  DocumentValidationError,
  DuplicateDocumentError,
} from "./document-errors";
import { DOCUMENT_REPOSITORY, DocumentRepository } from "./document.repository";
import { FILE_STORAGE_PORT, FileStoragePort } from "./file-storage.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

@Injectable()
export class UploadSourceDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    donorId: string;
    uploadedById: string;
    originalFilename: string;
    declaredMimeType: string;
    buffer: Buffer;
    documentCategory: string;
    actor: AuthenticatedUser;
  }): Promise<SourceDocument> {
    const donor = await this.prisma.donorRecord.findUnique({
      where: { id: input.donorId },
      select: { originatingIpsName: true },
    });
    if (!donor) throw new DocumentValidationError("Donor record was not found");
    if (
      input.actor.role !== "ADMIN" &&
      !input.actor.institutionalIps?.includes(donor.originatingIpsName)
    ) {
      throw new DocumentAccessDeniedError();
    }
    if (!input.buffer.length || input.buffer.length > MAX_FILE_SIZE) {
      throw new DocumentValidationError("Document size is invalid");
    }
    if (!ALLOWED_MIME_TYPES.has(input.declaredMimeType)) {
      throw new DocumentValidationError("Document MIME type is not supported");
    }
    if (!this.matchesSignature(input.buffer, input.declaredMimeType)) {
      throw new DocumentValidationError(
        "Document signature does not match MIME type",
      );
    }
    const sha256Hash = createHash("sha256").update(input.buffer).digest("hex");
    const duplicate = await this.documents.findByHash(
      input.donorId,
      sha256Hash,
    );
    if (duplicate) throw new DuplicateDocumentError("Document already exists");
    const stored = await this.storage.put({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      mimeType: input.declaredMimeType,
    });
    try {
      return await this.documents.create({
        donorId: input.donorId,
        uploadedById: input.uploadedById,
        originalFilename: input.originalFilename,
        mimeType: input.declaredMimeType,
        documentCategory: input.documentCategory,
        objectStorageKey: stored.storageKey,
        sha256Hash: stored.sha256Hash,
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  private matchesSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === "application/pdf")
      return buffer.subarray(0, 5).toString() === "%PDF-";
    if (mimeType === "image/png")
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  }
}
