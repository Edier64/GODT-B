import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { DocumentResponseValidator } from "../document-engine/document-response.validator";
import {
  canTransition,
  DocumentLockedError,
  InvalidLifecycleTransitionError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class ValidateDocumentInstanceUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    private readonly responseValidator: DocumentResponseValidator,
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
        currentRevision: true,
      },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${input.instanceId}' no encontrada`);
    }

    if (
      input.user.role !== "ADMIN" &&
      instance.process &&
      !input.user.institutionalIps?.includes(instance.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError("No tiene autorización sobre este proceso");
    }

    if (!canTransition(instance.status, "VALIDADO")) {
      throw new InvalidLifecycleTransitionError(
        `No es posible pasar del estado '${instance.status}' a 'VALIDADO'`,
      );
    }

    const schema = instance.templateVersion.jsonSchema as Record<string, unknown>;
    const responseData = (instance.currentRevision?.responseData as Record<string, unknown>) || {};

    const validationResult = this.responseValidator.validate(schema, responseData);

    // Actualizar resumen de validación en la revisión actual
    if (instance.currentRevisionId) {
      await this.prisma.documentResponseRevision.update({
        where: { id: instance.currentRevisionId },
        data: {
          validationSummary: validationResult as any,
        },
      });
    }

    if (!validationResult.valid) {
      return {
        instanceId: instance.id,
        valid: false,
        status: instance.status,
        errors: validationResult.errors,
      };
    }

    // Transición de estado a VALIDADO
    const updated = await this.prisma.documentInstance.update({
      where: { id: instance.id },
      data: { status: "VALIDADO" },
    });

    if (instance.processDocumentId) {
      await this.prisma.processDocument.update({
        where: { id: instance.processDocumentId },
        data: { status: "VALIDADO" },
      });
    }

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_INSTANCE_VALIDATED",
      entityType: "DOCUMENT_INSTANCE",
      entityId: instance.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        revisionNumber: instance.currentRevision?.revisionNumber ?? 1,
      },
    });

    return {
      instanceId: updated.id,
      valid: true,
      status: updated.status,
      errors: [],
    };
  }
}
