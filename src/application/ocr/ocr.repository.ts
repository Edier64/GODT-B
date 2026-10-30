import { OcrExtractedField, OcrProcessingJob } from "@prisma/client";
import { OcrCandidate } from "./ocr-provider.port";

export interface OcrRepository {
  createJob(input: {
    sourceDocumentId: string;
    requestedById: string;
    providerName: string;
    correlationId: string;
  }): Promise<OcrProcessingJob>;
  findQueuedJob(sourceDocumentId: string): Promise<OcrProcessingJob | null>;
  findJob(id: string): Promise<OcrProcessingJob | null>;
  listFields(jobId: string): Promise<OcrExtractedField[]>;
  saveCandidates(
    jobId: string,
    sourceDocumentId: string,
    donorId: string,
    candidates: OcrCandidate[],
  ): Promise<void>;
  completeJob(id: string): Promise<void>;
  failJob(id: string, errorCode: string): Promise<void>;
  validateField(
    id: string,
    input: {
      status: "CONFIRMADO" | "MODIFICADO" | "RECHAZADO";
      confirmedValue?: string;
      userId: string;
    },
  ): Promise<OcrExtractedField>;
  propagateField(id: string, userId: string): Promise<OcrExtractedField>;
}

export const OCR_REPOSITORY = Symbol("OCR_REPOSITORY");
