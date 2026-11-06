import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  canTransition,
  InvalidLifecycleTransitionError,
  MissingRequiredSignaturesError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class ReleaseDocumentInstanceUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(input: {
    instanceId: string;
    user: AuthenticatedUser;
  }) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        process: true,
        documentParticipants: true,
        generatedPdfs: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
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
        "Solo los coordinadores o administradores pueden liberar documentos oficiales",
      );
    }

    if (!canTransition(instance.status, "LIBERADO")) {
      throw new InvalidLifecycleTransitionError(
        `No es posible liberar un documento desde el estado '${instance.status}'`,
      );
    }

    // Verificar firmas obligatorias
    const pendingSignatures = instance.documentParticipants.filter(
      (p) => p.signatureRequired && p.status !== "FIRMADO",
    );

    if (pendingSignatures.length > 0) {
      throw new MissingRequiredSignaturesError(
        `Faltan firmas obligatorias de: ${pendingSignatures.map((p) => p.fullName).join(", ")}`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.documentInstance.update({
      where: { id: instance.id },
      data: {
        status: "LIBERADO",
        approvedAt: now,
        updatedById: input.user.userId,
      },
    });

    if (instance.processDocumentId) {
      await this.prisma.processDocument.update({
        where: { id: instance.processDocumentId },
        data: { status: "LIBERADO" },
      });
    }

    if (instance.generatedPdfs.length > 0) {
      await this.prisma.generatedPdfDocument.update({
        where: { id: instance.generatedPdfs[0].id },
        data: {
          status: "RELEASED",
          approvedById: input.user.userId,
        },
      });
    }

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_INSTANCE_RELEASED",
      entityType: "DOCUMENT_INSTANCE",
      entityId: instance.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        approvedAt: now.toISOString(),
      },
    });

    return updated;
  }
}
