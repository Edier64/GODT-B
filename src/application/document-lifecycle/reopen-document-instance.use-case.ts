import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DocumentLockedError,
  InvalidLifecycleTransitionError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class ReopenDocumentInstanceUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(input: {
    instanceId: string;
    justification: string;
    user: AuthenticatedUser;
  }) {
    if (!input.justification || input.justification.trim().length < 10) {
      throw new InvalidLifecycleTransitionError(
        "Se requiere una justificación clínica o administrativa obligatoria (mínimo 10 caracteres) para autorizar la reapertura técnica del documento.",
      );
    }

    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        process: true,
        generatedPdfs: true,
        documentParticipants: true,
      },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${input.instanceId}' no encontrada`);
    }

    if (input.user.role !== "ADMIN" && input.user.role !== "COORDINATOR") {
      throw new DonationProcessAccessDeniedError(
        "Únicamente los roles ADMIN o COORDINATOR pueden autorizar la reapertura técnica de un documento.",
      );
    }

    if (instance.status === "LIBERADO") {
      throw new DocumentLockedError(
        "El documento se encuentra en estado LIBERADO y forma parte inmutable del expediente del proceso de donación. No se admite su reapertura técnica.",
      );
    }

    if (instance.status === "CANCELADO") {
      throw new DocumentLockedError("Un documento en estado CANCELADO no puede ser reabierto.");
    }

    if (instance.status === "BORRADOR") {
      throw new InvalidLifecycleTransitionError("El documento ya se encuentra en estado BORRADOR.");
    }

    const previousStatus = instance.status;
    const now = new Date();

    // Transacción atómica de reapertura técnica:
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Marcar snapshots previos como SUPERSEDED
      // Las firmas anteriores PERMANECEN asociadas a sus respectivos snapshots históricos (NO se borran)
      await tx.generatedPdfDocument.updateMany({
        where: { documentInstanceId: instance.id, status: { not: "SUPERSEDED" } },
        data: { status: "SUPERSEDED" },
      });

      // 2. Restablecer el estado de los participantes a ASIGNADO (las firmas anteriores no se transfieren al nuevo borrador)
      await tx.documentParticipant.updateMany({
        where: { documentInstanceId: instance.id },
        data: { status: "ASIGNADO" },
      });

      // 3. Regresar el estado de la instancia documental a BORRADOR
      const updatedInstance = await tx.documentInstance.update({
        where: { id: instance.id },
        data: {
          status: "BORRADOR",
          completedAt: null,
          approvedAt: null,
        },
      });

      if (instance.processDocumentId) {
        await tx.processDocument.update({
          where: { id: instance.processDocumentId },
          data: { status: "BORRADOR" },
        });
      }

      return updatedInstance;
    });

    // 4. Registro formal de auditoría de la reapertura técnica
    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_INSTANCE_REOPENED",
      entityType: "DOCUMENT_INSTANCE",
      entityId: instance.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        previousStatus,
        newStatus: "BORRADOR",
        justification: input.justification.trim(),
        invalidatedSnapshotsCount: instance.generatedPdfs.length,
        reopenedAt: now.toISOString(),
      },
    });

    return {
      id: result.id,
      documentCode: result.documentCode,
      status: result.status,
      previousStatus,
      reopenedAt: now,
      justification: input.justification.trim(),
    };
  }
}

