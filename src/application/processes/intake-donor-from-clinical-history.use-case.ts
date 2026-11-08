import { Inject, Injectable, Logger } from "@nestjs/common";
import { CreateDonationProcessUseCase } from "./create-donation-process.use-case";
import { UploadSourceDocumentUseCase } from "../documents/upload-source-document.use-case";
import { StartOcrUseCase } from "../ocr/start-ocr.use-case";
import { OCR_REPOSITORY, OcrRepository } from "../ocr/ocr.repository";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DonationProcess,
  DonationProcessValidationError,
} from "../../domain/processes/donation-process";
import { SourceDocument, OcrProcessingJob, OcrExtractedField } from "@prisma/client";

export interface IntakeDonorFromClinicalHistoryInput {
  primaryIpsName: string;
  notes?: string;
  processCode?: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  actor: AuthenticatedUser;
}

export interface IntakeDonorFromClinicalHistoryResult {
  process: DonationProcess;
  donorId: string;
  sourceDocument: SourceDocument;
  ocrJob: OcrProcessingJob;
  candidates: OcrExtractedField[];
}

@Injectable()
export class IntakeDonorFromClinicalHistoryUseCase {
  private readonly logger = new Logger(IntakeDonorFromClinicalHistoryUseCase.name);

  constructor(
    private readonly createProcess: CreateDonationProcessUseCase,
    private readonly uploadDocument: UploadSourceDocumentUseCase,
    private readonly startOcr: StartOcrUseCase,
    @Inject(OCR_REPOSITORY) private readonly ocrRepository: OcrRepository,
  ) {}

  async execute(
    input: IntakeDonorFromClinicalHistoryInput,
  ): Promise<IntakeDonorFromClinicalHistoryResult> {
    if (!input.primaryIpsName || !input.primaryIpsName.trim()) {
      throw new DonationProcessValidationError("primaryIpsName es requerida");
    }

    if (!input.file || !input.file.buffer || !input.file.buffer.length) {
      throw new DonationProcessValidationError(
        "Se requiere un archivo de historia clínica (PDF o DOCX)",
      );
    }

    this.logger.log(
      `Iniciando flujo de ingesta desde historia clínica '${input.file.originalname}' para IPS '${input.primaryIpsName}'`,
    );

    // 1. Crear donante provisional y proceso de donación de manera atómica
    const process = await this.createProcess.execute(
      {
        primaryIpsName: input.primaryIpsName.trim(),
        processCode: input.processCode?.trim() || undefined,
        notes: input.notes?.trim() || "Proceso aperturado mediante ingesta de Historia Clínica (OCR / IA)",
      },
      input.actor,
    );

    // 2. Almacenar el archivo como SourceDocument de categoría HISTORIA_CLINICA
    const sourceDocument = await this.uploadDocument.execute({
      processId: process.id,
      donorId: process.donorId,
      uploadedById: input.actor.userId,
      originalFilename: input.file.originalname,
      declaredMimeType: input.file.mimetype,
      buffer: input.file.buffer,
      documentCategory: "HISTORIA_CLINICA",
      actor: input.actor,
    });

    // 3. Iniciar el trabajo de extracción OCR / IA
    const ocrJob = await this.startOcr.execute(sourceDocument.id, input.actor);

    // 4. Consultar los candidatos extraídos
    const candidates = await this.ocrRepository.listFields(ocrJob.id);

    this.logger.log(
      `Ingesta completada. Proceso: ${process.processCode} (${process.id}), Documento: ${sourceDocument.id}, Job OCR: ${ocrJob.id}, Candidatos iniciales: ${candidates.length}`,
    );

    return {
      process,
      donorId: process.donorId,
      sourceDocument,
      ocrJob,
      candidates,
    };
  }
}

