import { Inject, Injectable, Logger } from "@nestjs/common";
import { SourceDocument } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import AdmZip from "adm-zip";
import {
  DocumentAccessDeniedError,
  DocumentValidationError,
  DuplicateDocumentError,
} from "./document-errors";
import { DOCUMENT_REPOSITORY, DocumentRepository } from "./document.repository";
import { FILE_STORAGE_PORT, FileStoragePort } from "./file-storage.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "image/x-ms-bmp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
  "application/zip",
]);

export interface UploadSourceDocumentInput {
  donorId?: string;
  processId?: string;
  uploadedById: string;
  originalFilename: string;
  declaredMimeType: string;
  buffer: Buffer;
  documentCategory?: string;
  actor: AuthenticatedUser;
}

@Injectable()
export class UploadSourceDocumentUseCase {
  private readonly logger = new Logger(UploadSourceDocumentUseCase.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: UploadSourceDocumentInput): Promise<SourceDocument> {
    let effectiveDonorId = input.donorId;
    let effectiveIpsName = "";

    if (input.processId) {
      const process = await this.prisma.donationProcess.findUnique({
        where: { id: input.processId },
        select: { id: true, donorId: true, primaryIpsName: true },
      });
      if (!process) {
        throw new DocumentValidationError("Donation process was not found");
      }
      effectiveDonorId = effectiveDonorId || process.donorId;
      effectiveIpsName = process.primaryIpsName;
    } else if (input.donorId) {
      const donor = await this.prisma.donorRecord.findUnique({
        where: { id: input.donorId },
        select: { originatingIpsName: true },
      });
      if (!donor) throw new DocumentValidationError("Donor record was not found");
      effectiveIpsName = donor.originatingIpsName;
    } else {
      throw new DocumentValidationError("Either processId or donorId is required");
    }

    if (
      input.actor.role !== "ADMIN" &&
      !input.actor.institutionalIps?.includes(effectiveIpsName)
    ) {
      throw new DocumentAccessDeniedError();
    }

    if (!input.buffer.length || input.buffer.length > MAX_FILE_SIZE) {
      throw new DocumentValidationError("Document size is invalid");
    }

    if (!ALLOWED_MIME_TYPES.has(input.declaredMimeType)) {
      throw new DocumentValidationError("Document MIME type is not supported");
    }

    const detectedMime = this.resolveMimeType(input.buffer, input.declaredMimeType);
    if (!detectedMime) {
      throw new DocumentValidationError(
        "Document signature does not match MIME type",
      );
    }

    const sha256Hash = createHash("sha256").update(input.buffer).digest("hex");
    if (effectiveDonorId) {
      const duplicate = await this.documents.findByHash(
        effectiveDonorId,
        sha256Hash,
      );
      if (duplicate) throw new DuplicateDocumentError("Document already exists");
    }

    const sourceDocumentId = randomUUID();
    const sanitizedFilename = input.originalFilename
      .replace(/[^\w\s.-]/gi, "_")
      .trim() || "document";

    const stored = await this.storage.put({
      buffer: input.buffer,
      originalFilename: sanitizedFilename,
      mimeType: detectedMime,
      processId: input.processId,
      sourceDocumentId,
      subDirectory: "original",
    });

    try {
      return await this.documents.create({
        donorId: effectiveDonorId!,
        processId: input.processId,
        uploadedById: input.uploadedById,
        originalFilename: sanitizedFilename,
        mimeType: detectedMime,
        documentCategory: input.documentCategory || "CLINICAL_SOURCE",
        objectStorageKey: stored.storageKey,
        sha256Hash: stored.sha256Hash,
      });
    } catch (error) {
      // No eliminar el blob como compensación: la identidad de producción no
      // tiene permiso delete sobre documentos clínicos. El blob conserva
      // metadata de correlación para reconciliarlo posteriormente contra
      // SOURCE_DOCUMENT sin exponer contenido clínico en logs.
      this.logger.error(
        JSON.stringify({
          event: "source_document_persistence_failed",
          sourceDocumentId,
          storageKey: stored.storageKey,
          sha256Hash: stored.sha256Hash,
          persistenceError: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  private resolveMimeType(buffer: Buffer, declared: string): string | null {
    if (buffer.subarray(0, 5).toString() === "%PDF-") {
      return "application/pdf";
    }
    if (
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      return "image/png";
    }
    if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
      return "image/jpeg";
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    ) {
      return "image/webp";
    }
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
    ) {
      return "image/tiff";
    }
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return "image/bmp";
    }
    if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const isDocx = entries.some(
          (e) =>
            e.entryName.startsWith("word/") ||
            e.entryName === "[Content_Types].xml",
        );
        if (isDocx) {
          return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}
