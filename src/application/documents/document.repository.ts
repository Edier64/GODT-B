import { SourceDocument } from "@prisma/client";

export interface DocumentRepository {
  create(input: {
    donorId: string;
    uploadedById: string;
    originalFilename: string;
    mimeType: string;
    documentCategory: string;
    objectStorageKey: string;
    sha256Hash: string;
  }): Promise<SourceDocument>;
  findById(id: string): Promise<SourceDocument | null>;
  findByDonorId(donorId: string): Promise<SourceDocument[]>;
  findByHash(
    donorId: string,
    sha256Hash: string,
  ): Promise<SourceDocument | null>;
}

export const DOCUMENT_REPOSITORY = Symbol("DOCUMENT_REPOSITORY");
