import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import {
  DossierAccessDeniedError,
  DossierNotFoundError,
  DossierValidationError,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { BullmqDossierQueueService } from "../../infrastructure/dossier/bullmq-dossier-queue.service";

export interface RequestDossierExportInput {
  processId: string;
  user: AuthenticatedUser;
  exportType?: "FULL_ZIP" | "CONSOLIDATED_PDF" | "INDEX_ONLY";
  includeSourceDocuments?: boolean;
  selectedDocumentCodes?: string[];
  selectedSourceDocumentIds?: string[];
}

@Injectable()
export class RequestDossierExportUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    private readonly queueService: BullmqDossierQueueService,
  ) {}

  async execute(input: RequestDossierExportInput) {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: input.processId },
      include: {
        documents: true,
      },
    });

    if (!process) {
      throw new DossierNotFoundError(`Proceso de donación '${input.processId}' no encontrado`);
    }

    // 1. Verificación de autorización de IPS
    if (
      input.user.role !== "ADMIN" &&
      !input.user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DossierAccessDeniedError(
        "No tiene autorización institucional para solicitar la exportación de este expediente",
      );
    }

    // 2. Verificación de permisos para documentos fuente sensibles
    if (input.includeSourceDocuments && input.user.role !== "ADMIN" && input.user.role !== "COORDINATOR") {
      throw new DossierAccessDeniedError(
        "La inclusión de documentos fuente e historias clínicas complementarias requiere rol de Coordinador o Administrador",
      );
    }

    // 3. Comprobar si ya existe una exportación idéntica en proceso (Idempotencia)
    const existingActive = await this.prisma.processDossierExport.findFirst({
      where: {
        processId: input.processId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingActive) {
      return {
        ...existingActive,
        zipSizeBytes: existingActive.zipSizeBytes ? Number(existingActive.zipSizeBytes) : null,
        message: "Ya existe una solicitud de exportación en curso para este proceso.",
      };
    }

    // 4. Crear registro en BD con estado PENDING
    const exportRecord = await this.prisma.processDossierExport.create({
      data: {
        processId: input.processId,
        requestedById: input.user.userId,
        status: "PENDING",
        exportType: input.exportType || "FULL_ZIP",
        includeSourceDocuments: input.includeSourceDocuments || false,
        selectedDocumentCodes: input.selectedDocumentCodes || [],
        selectedSourceDocumentIds: input.selectedSourceDocumentIds || [],
        progressPercent: 0,
        currentStep: "ENCOLADO",
      },
    });

    // 5. Encolar en BullMQ / segundo plano
    await this.queueService.enqueueExport(exportRecord.id, input.user);

    // 6. Auditoría
    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOSSIER_EXPORT_REQUESTED",
      entityType: "PROCESS_DOSSIER_EXPORT",
      entityId: exportRecord.id,
      correlationId: input.processId,
      metadata: {
        processCode: process.processCode,
        exportType: exportRecord.exportType,
        includeSourceDocuments: exportRecord.includeSourceDocuments,
      },
    });

    return {
      ...exportRecord,
      zipSizeBytes: exportRecord.zipSizeBytes ? Number(exportRecord.zipSizeBytes) : null,
    };
  }
}
