import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PdfRenderEngineService } from "../pdf/pdf-render-engine.service";
import {
  canTransition,
  DocumentSnapshotMetadata,
  InvalidLifecycleTransitionError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { CompleteDocumentInstanceUseCase } from "./complete-document-instance.use-case";

@Injectable()
export class GenerateDocumentSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    private readonly pdfRenderer: PdfRenderEngineService,
    private readonly completeUseCase: CompleteDocumentInstanceUseCase,
  ) {}

  async execute(input: {
    instanceId: string;
    user: AuthenticatedUser;
  }) {
    let instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        donor: true,
        process: true,
        processDocument: true,
        templateVersion: true,
        currentRevision: {
          include: { provenance: true },
        },
        documentParticipants: {
          orderBy: { signatureOrder: "asc" },
        },
        custodyEvents: {
          orderBy: { sequenceNumber: "asc" },
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
        "No tiene autorización para generar versiones oficiales de este documento",
      );
    }

    // Si aún no está completado, completarlo formalmente
    if (instance.status !== "COMPLETADO" && instance.status !== "PENDIENTE_FIRMAS") {
      await this.completeUseCase.execute({
        instanceId: instance.id,
        user: input.user,
      });

      // Recargar datos
      instance = (await this.prisma.documentInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          donor: true,
          process: true,
          processDocument: true,
          templateVersion: true,
          currentRevision: {
            include: { provenance: true },
          },
          documentParticipants: {
            orderBy: { signatureOrder: "asc" },
          },
          custodyEvents: {
            orderBy: { sequenceNumber: "asc" },
          },
        },
      }))!;
    }

    const now = new Date();
    const responseData = (instance.currentRevision?.responseData as Record<string, unknown>) || {};
    const revisionNumber = instance.currentRevision?.revisionNumber ?? 1;

    // 1. Recopilar valores canónicos vigentes del proceso
    let canonicalValuesMap: Record<string, unknown> = {};
    let repeatableObservations: DocumentSnapshotMetadata["repeatableObservations"] = [];

    if (instance.processId) {
      const pValues = await this.prisma.processCanonicalValue.findMany({
        where: { processId: instance.processId },
      });
      canonicalValuesMap = pValues.reduce((acc, v) => {
        acc[v.canonicalFieldKey] = v.currentValue;
        return acc;
      }, {} as Record<string, unknown>);

      const pHistory = await this.prisma.processCanonicalHistory.findMany({
        where: { processId: instance.processId },
        orderBy: { effectiveAt: "desc" },
        take: 50,
      });
      repeatableObservations = pHistory.map((h) => ({
        canonicalFieldKey: h.canonicalFieldKey,
        observationId: h.id,
        value: h.value,
        sampleContext: h.sampleContext || undefined,
        effectiveAt: h.effectiveAt.toISOString(),
        unit: h.unit || undefined,
      }));
    }

    // 2. Construir participantes congelados con fidelidad histórica completa
    const frozenParticipants = instance.documentParticipants.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      documentType: p.documentType || "CC",
      documentNumber: p.documentNumber || "N/A",
      signerRole: p.signerRole,
      isSigner: p.isSigner,
      signatureRequired: p.signatureRequired,
      signatureOrder: p.signatureOrder || undefined,
      status: p.status,
    }));

    // Manifiesto determinista canónico previo a la generación
    const manifestToDigest = {
      instanceId: instance.id,
      documentCode: instance.documentCode,
      templateVersionId: instance.templateVersionId,
      templateVersionNumber: instance.templateVersion.versionNumber,
      definitionHash: instance.templateVersion.definitionHash || "",
      revisionNumber,
      responseData,
      provenance: (instance.currentRevision?.provenance || []).map((p) => ({
        fieldPath: p.fieldPath,
        sourceKind: p.sourceKind,
        canonicalFieldKey: p.canonicalFieldKey || undefined,
      })),
      canonicalValues: canonicalValuesMap,
      repeatableObservations,
      participants: frozenParticipants,
      generatedById: input.user.userId,
      generatedAt: now.toISOString(),
    };

    function sortObjectKeys(obj: any): any {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sortObjectKeys);
      const sorted: Record<string, any> = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = sortObjectKeys(obj[k]);
      }
      return sorted;
    }

    const snapshotDigest = createHash("sha256")
      .update(JSON.stringify(sortObjectKeys(manifestToDigest)))
      .digest("hex");

    // 3. Renderizar PDF con el motor vectorial especializado incorporando el snapshotDigest
    const pdfBuffer = await this.pdfRenderer.render({
      documentCode: instance.documentCode,
      title: instance.processDocument?.title || instance.documentCode,
      data: responseData,
      metadata: {
        processCode: instance.process?.processCode || "PROC-N/A",
        rndCode: instance.donor.rndCode,
        donorName: instance.donor.fullName,
        donorDocument: instance.donor.documentNumber,
        primaryIpsName: instance.process?.primaryIpsName || instance.donor.originatingIpsName,
        revisionNumber,
        templateVersion: instance.templateVersion.versionNumber,
        generatedAt: now,
        generatedByName: input.user.role,
        snapshotDigest,
        signatures: instance.documentParticipants.map((p) => ({
          signerRole: p.signerRole,
          fullName: p.fullName,
          signatureType: "ATESTACION_USUARIO",
          status: p.status,
        })),
        custodyEvents: instance.custodyEvents.map((c) => ({
          sequenceNumber: c.sequenceNumber,
          eventType: c.eventType,
          itemDescription: c.itemDescription,
          containerCode: c.containerCode,
          sealNumber: c.sealNumber,
          temperatureCelsius: c.temperatureCelsius ? Number(c.temperatureCelsius) : null,
          transferorName: c.transferorName,
          transferorInstitution: c.transferorInstitution,
          receiverName: c.receiverName,
          receiverInstitution: c.receiverInstitution,
          occurredAt: c.occurredAt,
          location: c.location,
          integrityVerified: c.integrityVerified,
          observations: c.observations,
        })),
      },
    });

    // 4. Hash criptográfico del binario PDF final
    const sha256Hash = createHash("sha256").update(pdfBuffer).digest("hex");

    // 5. Guardar archivo en almacenamiento seguro privado
    const filename = `${instance.documentCode}_PROC_${instance.process?.processCode || "DOC"}_REV${revisionNumber}.pdf`;
    const stored = await this.storage.put({
      buffer: pdfBuffer,
      originalFilename: filename,
      mimeType: "application/pdf",
    });

    // 6. Construir snapshot inmutable forense
    const snapshotMetadata: DocumentSnapshotMetadata & {
      snapshotDigest: string;
      pdfBinaryHash: string;
    } = {
      processId: instance.processId || "",
      positionNumber: instance.processDocument?.positionNumber ?? 1,
      documentCode: instance.documentCode,
      instanceId: instance.id,
      templateVersionId: instance.templateVersionId,
      templateVersionNumber: instance.templateVersion.versionNumber,
      definitionHash: instance.templateVersion.definitionHash || "",
      revisionNumber,
      responseData,
      provenance: (instance.currentRevision?.provenance || []).map((p) => ({
        fieldPath: p.fieldPath,
        sourceKind: p.sourceKind,
        canonicalFieldKey: p.canonicalFieldKey || undefined,
      })),
      canonicalValues: canonicalValuesMap,
      repeatableObservations,
      participants: frozenParticipants,
      generatedById: input.user.userId,
      generatedAt: now.toISOString(),
      renderEngine: "pdf-lib/1.17",
      snapshotDigest,
      pdfBinaryHash: sha256Hash,
    };

    // 6. Determinar número de versión PDF para esta instancia
    const countExistingPdfs = await this.prisma.generatedPdfDocument.count({
      where: { documentInstanceId: instance.id },
    });
    const versionNumber = countExistingPdfs + 1;

    // 7. Persistir GeneratedPdfDocument
    const generatedPdf = await this.prisma.generatedPdfDocument.create({
      data: {
        donorId: instance.donorId,
        processId: instance.processId,
        templateVersionId: instance.templateVersionId,
        documentCode: instance.documentCode,
        versionNumber,
        status: "GENERATED",
        objectStorageKey: stored.storageKey,
        sha256Hash,
        anonymizationApplied: false,
        dataSnapshot: snapshotMetadata as any,
        generatedById: input.user.userId,
        documentInstanceId: instance.id,
      },
    });

    // 8. Determinar transición de estado según firmas requeridas
    const hasRequiredSignatures = instance.documentParticipants.some(
      (p) => p.signatureRequired && p.status !== "FIRMADO",
    );

    const nextStatus = hasRequiredSignatures ? "PENDIENTE_FIRMAS" : "LIBERADO";

    await this.prisma.documentInstance.update({
      where: { id: instance.id },
      data: {
        status: nextStatus,
        approvedAt: nextStatus === "LIBERADO" ? now : undefined,
      },
    });

    if (instance.processDocumentId) {
      await this.prisma.processDocument.update({
        where: { id: instance.processDocumentId },
        data: { status: nextStatus },
      });
    }

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_SNAPSHOT_GENERATED",
      entityType: "GENERATED_PDF_DOCUMENT",
      entityId: generatedPdf.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        versionNumber,
        sha256Hash,
        storageKey: stored.storageKey,
        hasRequiredSignatures,
        resultingStatus: nextStatus,
      },
    });

    return {
      generatedPdf,
      pdfBuffer,
      sha256Hash,
      resultingStatus: nextStatus,
    };
  }
}
