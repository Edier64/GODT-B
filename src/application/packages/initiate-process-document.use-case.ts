import { Inject, Injectable, Optional } from "@nestjs/common";
import {
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
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CanonicalPropagationEngine } from "../canonical/canonical-propagation.engine";
import { Prisma } from "@prisma/client";

@Injectable()
export class InitiateProcessDocumentUseCase {
  constructor(
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository: ProcessPackageRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly propagationEngine?: CanonicalPropagationEngine,
  ) {}

  async execute(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<{ document: ProcessDocument; instanceId: string }> {
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
        "No tiene autorización para iniciar documentos en este proceso",
      );
    }

    if (document.applicabilityStatus === "NO_APLICA") {
      throw new ProcessDocumentConflictError(
        `La posición '${document.title}' está marcada como NO APLICA en este proceso`,
      );
    }

    // Si ya existe instancia vigente, retornarla (idempotente)
    if (document.currentInstanceId) {
      return {
        document,
        instanceId: document.currentInstanceId,
      };
    }

    // Resolver plantilla y versión
    let templateId = document.templateId;
    let templateVersionId = document.templateVersionId;

    if (!templateVersionId) {
      const templateCode =
        (document.rules as Record<string, unknown> | null)?.templateCode as string | undefined ||
        document.documentCode.toLowerCase();

      const template = await this.prisma.documentTemplate.findFirst({
        where: {
          OR: [
            { templateCode },
            { templateCode: { startsWith: document.documentCode.toLowerCase() } },
          ],
        },
        include: {
          versions: {
            where: {
              status: user.role === "ADMIN" ? { in: ["PUBLISHED", "DRAFT"] } : "PUBLISHED",
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!template || !template.versions.length) {
        throw new ProcessPackageValidationError(
          `La posición documental '${document.title}' está pendiente de homologación institucional y no cuenta con una plantilla publicada.`,
        );
      }

      templateId = template.id;
      templateVersionId = template.versions[0].id;

      await this.packageRepository.linkTemplateToDocument(
        documentId,
        templateId,
        templateVersionId,
      );
    }

    // Precargar valores canónicos si existen para el proceso
    let initialResponseData: Record<string, unknown> = {};
    let initialProvenance: Array<{
      fieldPath: string;
      canonicalFieldKey: string;
      sourceKind: any;
      sourceValue: unknown;
    }> = [];

    if (this.propagationEngine && templateVersionId) {
      const preloaded = await this.propagationEngine.preloadCanonicalValues(
        process.id,
        templateVersionId,
      );
      initialResponseData = preloaded.responseData;
      initialProvenance = preloaded.provenance;
    }

    // Crear la DocumentInstance asociada al proceso y a la posición
    const instance = await this.prisma.documentInstance.create({
      data: {
        donorId: process.donorId,
        processId: process.id,
        processDocumentId: documentId,
        templateId: templateId!,
        templateVersionId: templateVersionId!,
        documentCode: document.documentCode,
        status: "DRAFT",
        createdById: user.userId,
        updatedById: user.userId,
      },
    });

    if (Object.keys(initialResponseData).length > 0) {
      const rev = await this.prisma.documentResponseRevision.create({
        data: {
          documentInstanceId: instance.id,
          revisionNumber: 1,
          responseData: initialResponseData as Prisma.InputJsonValue,
          changeSummary: { reason: "CANONICAL_PRELOAD" } as Prisma.InputJsonValue,
          createdById: user.userId,
        },
      });

      await this.prisma.documentInstance.update({
        where: { id: instance.id },
        data: { currentRevisionId: rev.id },
      });

      for (const prov of initialProvenance) {
        await this.prisma.documentFieldProvenance.create({
          data: {
            responseRevisionId: rev.id,
            fieldPath: prov.fieldPath,
            canonicalFieldKey: prov.canonicalFieldKey,
            sourceKind: prov.sourceKind,
            sourceValue: prov.sourceValue as Prisma.InputJsonValue,
          },
        });
      }
    }

    // Actualizar ProcessDocument con currentInstanceId y status
    const updated = await this.packageRepository.setProcessDocumentInstance(
      documentId,
      instance.id,
    );
    await this.packageRepository.updateProcessDocumentStatus(
      documentId,
      "EN_DILIGENCIAMIENTO",
    );

    await this.audit.record({
      actorUserId: user.userId,
      action: "DOCUMENT_INSTANCE_INITIATED",
      entityType: "DOCUMENT_INSTANCE",
      entityId: instance.id,
      correlationId: process.id,
      metadata: {
        processId: process.id,
        documentCode: document.documentCode,
        positionNumber: document.positionNumber,
      },
    });

    return {
      document: updated,
      instanceId: instance.id,
    };
  }
}

