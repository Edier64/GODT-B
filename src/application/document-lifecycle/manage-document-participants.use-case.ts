import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DocumentLockedError,
  isDocumentLocked,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class ManageDocumentParticipantsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async assign(input: {
    instanceId: string;
    processParticipantId?: string;
    fullName: string;
    documentType?: string;
    documentNumber?: string;
    signerRole: string;
    isSigner?: boolean;
    signatureRequired?: boolean;
    signatureOrder?: number;
    user: AuthenticatedUser;
  }) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: { process: true },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${input.instanceId}' no encontrada`);
    }

    if (
      input.user.role !== "ADMIN" &&
      input.user.role !== "COORDINATOR" &&
      instance.process &&
      !input.user.institutionalIps?.includes(instance.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para asignar participantes en este documento",
      );
    }

    if (isDocumentLocked(instance.status)) {
      throw new DocumentLockedError(
        `El documento se encuentra en estado '${instance.status}' y no permite modificar sus participantes.`,
      );
    }

    // Si viene processParticipantId, asegurar congruencia de datos
    let fullName = input.fullName;
    let docType = input.documentType;
    let docNum = input.documentNumber;

    if (input.processParticipantId) {
      const pPart = await this.prisma.processParticipant.findUnique({
        where: { id: input.processParticipantId },
      });
      if (pPart) {
        fullName = pPart.fullName;
        docType = pPart.documentType || docType;
        docNum = pPart.documentNumber || docNum;
      }
    }

    const participant = await this.prisma.documentParticipant.create({
      data: {
        documentInstanceId: instance.id,
        processParticipantId: input.processParticipantId,
        fullName,
        documentType: docType,
        documentNumber: docNum,
        signerRole: input.signerRole,
        isSigner: input.isSigner ?? true,
        signatureRequired: input.signatureRequired ?? false,
        signatureOrder: input.signatureOrder,
        status: "ASIGNADO",
      },
    });

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_PARTICIPANT_ASSIGNED",
      entityType: "DOCUMENT_PARTICIPANT",
      entityId: participant.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        instanceId: instance.id,
        signerRole: participant.signerRole,
        signatureRequired: participant.signatureRequired,
      },
    });

    return participant;
  }

  async list(instanceId: string) {
    return this.prisma.documentParticipant.findMany({
      where: { documentInstanceId: instanceId },
      include: {
        processParticipant: true,
        signatures: true,
      },
      orderBy: { signatureOrder: "asc" },
    });
  }

  async remove(participantId: string, user: AuthenticatedUser) {
    const participant = await this.prisma.documentParticipant.findUnique({
      where: { id: participantId },
      include: { documentInstance: true },
    });

    if (!participant) return;

    if (isDocumentLocked(participant.documentInstance.status)) {
      throw new DocumentLockedError(
        "No es posible eliminar participantes de un documento completado o liberado",
      );
    }

    await this.prisma.documentParticipant.delete({
      where: { id: participantId },
    });

    await this.audit.record({
      actorUserId: user.userId,
      action: "DOCUMENT_PARTICIPANT_REMOVED",
      entityType: "DOCUMENT_PARTICIPANT",
      entityId: participantId,
      correlationId: participant.documentInstance.processId || participant.documentInstanceId,
      metadata: {
        fullName: participant.fullName,
        signerRole: participant.signerRole,
      },
    });
  }
}
