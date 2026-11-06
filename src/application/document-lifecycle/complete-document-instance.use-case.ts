import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  canTransition,
  InvalidLifecycleTransitionError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { ValidateDocumentInstanceUseCase } from "./validate-document-instance.use-case";

@Injectable()
export class CompleteDocumentInstanceUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    private readonly validateUseCase: ValidateDocumentInstanceUseCase,
  ) {}

  async execute(input: {
    instanceId: string;
    user: AuthenticatedUser;
  }) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        process: true,
        templateVersion: true,
        documentParticipants: true,
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
        "Solo los coordinadores o administradores pueden completar formalmente un documento",
      );
    }

    // Si aún está en BORRADOR, intentar validarlo primero
    if (instance.status === "BORRADOR" || instance.status === "DRAFT" || instance.status === "EN_DILIGENCIAMIENTO") {
      const validation = await this.validateUseCase.execute({
        instanceId: instance.id,
        user: input.user,
      });
      if (!validation.valid) {
        throw new InvalidLifecycleTransitionError(
          "El documento contiene campos obligatorios incompletos o inválidos y no puede completarse.",
        );
      }
    } else if (!canTransition(instance.status, "COMPLETADO")) {
      throw new InvalidLifecycleTransitionError(
        `No es posible pasar del estado '${instance.status}' a 'COMPLETADO'`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.documentInstance.update({
      where: { id: instance.id },
      data: {
        status: "COMPLETADO",
        completedAt: now,
        updatedById: input.user.userId,
      },
    });

    if (instance.processDocumentId) {
      await this.prisma.processDocument.update({
        where: { id: instance.processDocumentId },
        data: { status: "COMPLETADO" },
      });
    }

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_INSTANCE_COMPLETED",
      entityType: "DOCUMENT_INSTANCE",
      entityId: instance.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        completedAt: now.toISOString(),
      },
    });

    return updated;
  }
}
