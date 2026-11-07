import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  DossierDocumentItem,
  DossierManifest,
  DossierSignatureItem,
  DossierSourceDocumentItem,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface BuildManifestInput {
  processId: string;
  user: AuthenticatedUser;
  includeSourceDocuments?: boolean;
  selectedDocumentCodes?: string[];
  selectedSourceDocumentIds?: string[];
}

export interface ManifestBuildResult {
  manifest: DossierManifest;
  evidenciasAtestaciones: Record<string, unknown>;
  releasedPdfBuffersByPosition: Map<number, Buffer>;
  sourceDocumentBuffersById: Map<string, { buffer: Buffer; filename: string }>;
}

@Injectable()
export class BuildIntegrityManifestService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: BuildManifestInput): Promise<DossierManifest> {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: input.processId },
      include: {
        donor: true,
        packageVersion: true,
        institutions: true,
        participants: true,
        documents: {
          orderBy: { positionNumber: "asc" },
          include: {
            currentInstance: {
              include: {
                currentRevision: true,
                documentParticipants: {
                  include: {
                    signatures: true,
                  },
                },
                custodyEvents: {
                  orderBy: { sequenceNumber: "asc" },
                },
              },
            },
          },
        },
        sourceDocuments: true,
      },
    });

    if (!process) {
      throw new Error(`Proceso de donación '${input.processId}' no encontrado`);
    }

    // 1. Obtener los GeneratedPdfDocument de este proceso
    const pdfs = await this.prisma.generatedPdfDocument.findMany({
      where: { processId: input.processId },
      orderBy: { versionNumber: "desc" },
      include: {
        signatures: true,
      },
    });

    // Mapear el último PDF generado por documentInstanceId o documentCode
    const latestPdfByInstanceId = new Map<string, typeof pdfs[0]>();
    for (const pdf of pdfs) {
      if (pdf.documentInstanceId && !latestPdfByInstanceId.has(pdf.documentInstanceId)) {
        latestPdfByInstanceId.set(pdf.documentInstanceId, pdf);
      }
    }

    // 2. Construir lista de 23 posiciones documentales
    const documentsList: DossierDocumentItem[] = [];
    let applicableCount = 0;
    let releasedCount = 0;
    let signedCount = 0;
    let completedCount = 0;
    let nonApplicableCount = 0;
    let pendingHomologationCount = 0;

    for (const pDoc of process.documents) {
      const isHomologation = pDoc.category === "PENDING_HOMOLOGATION";
      const isNoAplica = pDoc.applicabilityStatus === "NO_APLICA";

      if (isHomologation) {
        pendingHomologationCount++;
      } else if (isNoAplica) {
        nonApplicableCount++;
      } else {
        applicableCount++;
      }

      const instance = pDoc.currentInstance;
      const docStatus = instance?.status || pDoc.status;

      if (docStatus === "LIBERADO") releasedCount++;
      else if (docStatus === "FIRMADO") signedCount++;
      else if (docStatus === "COMPLETADO") completedCount++;

      // Buscar último PDF asociado
      const latestPdf = instance ? latestPdfByInstanceId.get(instance.id) : undefined;

      // Extraer firmas
      const signatures: DossierSignatureItem[] = [];
      if (instance?.documentParticipants) {
        for (const part of instance.documentParticipants) {
          for (const sig of part.signatures) {
            signatures.push({
              signerRole: part.signerRole,
              signerName: part.fullName,
              signerDocument: part.documentNumber,
              signatureType: sig.signatureType,
              signedAt: sig.signedAt ? sig.signedAt.toISOString() : null,
              snapshotSha256: sig.snapshotHash,
            });
          }
        }
      }

      const custodyCount = instance?.custodyEvents?.length || 0;

      // Filtrar selección si el usuario especificó códigos
      const isSelected =
        !input.selectedDocumentCodes ||
        input.selectedDocumentCodes.length === 0 ||
        input.selectedDocumentCodes.includes(pDoc.documentCode);

      const isEligibleForConsolidation =
        docStatus === "LIBERADO" && isSelected && pDoc.applicabilityStatus !== "NO_APLICA";

      documentsList.push({
        positionNumber: pDoc.positionNumber,
        documentCode: pDoc.documentCode,
        title: pDoc.title,
        status: docStatus,
        applicabilityStatus: pDoc.applicabilityStatus,
        nonApplicabilityReason: pDoc.nonApplicabilityReason,
        category: pDoc.category,
        includedInConsolidatedPdf: isEligibleForConsolidation,
        consolidatedPageRange: null, // Se calculará al ensamblar el PDF
        originalFile: latestPdf
          ? {
              fileName: `${pDoc.documentCode}_v${latestPdf.versionNumber}.pdf`,
              sha256: latestPdf.sha256Hash,
              sizeBytes: (latestPdf.dataSnapshot as any)?.pdfSizeBytes || 0,
              versionNumber: latestPdf.versionNumber,
              generatedAt: (latestPdf.dataSnapshot as any)?.generatedAt || process.updatedAt.toISOString(),
              storageKey: latestPdf.objectStorageKey,
            }
          : null,
        signatures,
        custodyEventsCount: custodyCount,
      });
    }

    // 3. Documentos Fuente (solo si autorizados explícitamente)
    const sourceDocumentsList: DossierSourceDocumentItem[] = [];
    if (input.includeSourceDocuments && process.sourceDocuments) {
      for (const src of process.sourceDocuments) {
        const isSelected =
          !input.selectedSourceDocumentIds ||
          input.selectedSourceDocumentIds.length === 0 ||
          input.selectedSourceDocumentIds.includes(src.id);

        if (isSelected) {
          sourceDocumentsList.push({
            id: src.id,
            category: src.documentCategory,
            originalFilename: src.originalFilename,
            sha256: src.sha256Hash,
            sizeBytes: 0, // Se complementa al leer el buffer si aplica
            uploadedAt: src.uploadedAt.toISOString(),
            includedInPackage: true,
          });
        }
      }
    }

    // 4. Armar Manifiesto Raíz
    const userRecord = await this.prisma.systemUser.findUnique({
      where: { id: input.user.userId },
    });

    const manifest: DossierManifest = {
      manifestVersion: "1.0.0",
      processId: process.id,
      processCode: process.processCode,
      donorId: process.donorId,
      donorRndCode: process.donor.rndCode,
      primaryIpsName: process.primaryIpsName,
      generatedAt: new Date().toISOString(),
      generatedBy: {
        userId: input.user.userId,
        fullName: userRecord?.fullName || "COORDINADOR GODT",
        email: userRecord?.email || "coordinacion@godt.gov.co",
        role: input.user.role,
      },
      packageVersion: process.packageVersion?.versionNumber
        ? `v${process.packageVersion.versionNumber}`
        : "Piloto Regional 3 v1.0.0",
      systemVersion: "GODT Regional 3 v1.0.0 (Fase E)",
      summary: {
        totalPositions: documentsList.length,
        normativePositions: 19,
        applicableCount,
        releasedCount,
        signedCount,
        completedCount,
        nonApplicableCount,
        pendingHomologationCount,
        sourceDocumentsIncludedCount: sourceDocumentsList.length,
      },
      consolidatedPdf: null,
      zipPackage: null,
      documents: documentsList,
      sourceDocuments: sourceDocumentsList,
    };

    // Calcular hash determinista del manifiesto (sin el campo manifestSha256)
    const manifestString = JSON.stringify(manifest, Object.keys(manifest).sort());
    manifest.manifestSha256 = createHash("sha256").update(manifestString).digest("hex");

    return manifest;
  }

  buildEvidenciasAtestaciones(
    manifest: DossierManifest,
    custodyEventsByDoc: Array<{ documentCode: string; events: any[] }>,
  ): Record<string, unknown> {
    return {
      schemaVersion: "1.0.0",
      processId: manifest.processId,
      processCode: manifest.processCode,
      generatedAt: manifest.generatedAt,
      generatedBy: manifest.generatedBy,
      signaturesAuditTrail: manifest.documents
        .filter((d) => d.signatures.length > 0)
        .map((d) => ({
          positionNumber: d.positionNumber,
          documentCode: d.documentCode,
          title: d.title,
          signatures: d.signatures,
        })),
      custodyChainsAuditTrail: custodyEventsByDoc,
      verificationNotice:
        "Este archivo contiene las evidencias criptográficas de atestación bajo juramento y eslabones de cadena de custodia formalmente registrados en GODT Regional 3.",
    };
  }
}
