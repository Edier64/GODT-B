import { Inject, Injectable } from "@nestjs/common";
import {
  DocumentApplicability,
  ProcessDocument,
  ProcessDocumentConflictError,
  ProcessDocumentNotFoundError,
  ProcessPackageValidationError,
} from "../../domain/packages/process-package";
import {
  PROCESS_PACKAGE_REPOSITORY,
  ProcessPackageRepository,
} from "./process-package.repository";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "../processes/donation-process.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class UpdateDocumentApplicabilityUseCase {
  constructor(
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository: ProcessPackageRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(
    documentId: string,
    input: {
      applicabilityStatus: DocumentApplicability;
      nonApplicabilityReason?: string;
    },
    user: AuthenticatedUser,
  ): Promise<ProcessDocument> {
    const document = await this.packageRepository.findProcessDocumentById(documentId);
    if (!document) {
      throw new ProcessDocumentNotFoundError(
        `Posición documental '${documentId}' no encontrada`,
      );
    }

    const process = await this.processRepository.findById(document.processId);
    if (!process) {
      throw new DonationProcessNotFoundError(
        `Proceso '${document.processId}' no encontrado`,
      );
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para modificar la aplicabilidad documental",
      );
    }

    if (
      input.applicabilityStatus === "NO_APLICA" &&
      (!input.nonApplicabilityReason || !input.nonApplicabilityReason.trim())
    ) {
      throw new ProcessPackageValidationError(
        "Se requiere una justificación clínica o normativa para marcar una posición como NO APLICA",
      );
    }

    if (
      (document.status === "COMPLETADO" || document.status === "FIRMADO") &&
      input.applicabilityStatus === "NO_APLICA"
    ) {
      throw new ProcessDocumentConflictError(
        "No se puede marcar como NO APLICA un documento que ya ha sido completado o firmado",
      );
    }

    const updated = await this.packageRepository.updateProcessDocumentApplicability(
      documentId,
      input.applicabilityStatus,
      input.nonApplicabilityReason?.trim(),
    );

    if (input.applicabilityStatus === "NO_APLICA") {
      await this.packageRepository.updateProcessDocumentStatus(documentId, "NO_APLICA");
    } else if (document.status === "NO_APLICA") {
      const nextStatus = document.currentInstanceId ? "EN_DILIGENCIAMIENTO" : "PENDIENTE";
      await this.packageRepository.updateProcessDocumentStatus(documentId, nextStatus);
    }

    await this.audit.record({
      actorUserId: user.userId,
      action: "DOCUMENT_APPLICABILITY_CHANGED",
      entityType: "PROCESS_DOCUMENT",
      entityId: documentId,
      correlationId: document.processId,
      metadata: {
        documentCode: document.documentCode,
        applicabilityStatus: input.applicabilityStatus,
        reason: input.nonApplicabilityReason,
      },
    });

    return updated;
  }
}

