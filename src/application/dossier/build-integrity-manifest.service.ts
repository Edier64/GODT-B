import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  computeCanonicalManifestDigest,
  DossierDocumentItem,
  DossierManifest,
  DossierManifestFileItem,
  DossierSignatureItem,
  DossierSourceDocumentItem,
} from "../../domain/dossier/dossier.types";
import { getOfficialDossierFilename } from "../../domain/dossier/dossier-nomenclature";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface BuildManifestInput {
  processId: string;
  user: AuthenticatedUser;
  includeSourceDocuments?: boolean;
  selectedDocumentCodes?: string[];
  selectedSourceDocumentIds?: string[];
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

    // Mapear el último PDF generado por documentInstanceId
    const latestPdfByInstanceId = new Map<string, (typeof pdfs)[0]>();
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

      // Extraer firmas con validación estricta de hash de atestación
      const signatures: DossierSignatureItem[] = [];
      if (instance?.documentParticipants) {
        for (const part of instance.documentParticipants) {
          for (const sig of part.signatures) {
            const rawHash = sig.snapshotHash?.trim();
            // Descartar hash de string vacío (e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
            const isEmptyHash =
              !rawHash ||
              rawHash === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

            const attestationLevel =
              sig.signatureType === "DIGITAL_CERTIFICADA"
                ? "DIGITAL_CERTIFICADA_BLOQUEADA"
                : "ATESTA_MANUAL_INTERNA";

            signatures.push({
              participantId: part.id,
              signerRole: part.signerRole,
              signerName: part.fullName,
              signerDocument: part.documentNumber,
              signatureType: sig.signatureType,
              signedAt: sig.signedAt ? sig.signedAt.toISOString() : null,
              snapshotSha256: isEmptyHash ? null : rawHash,
              hasCryptographicSignature: !isEmptyHash,
              attestationLevel,
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

      // Nomenclatura oficial homologada
      const officialFileName = getOfficialDossierFilename(
        pDoc.positionNumber,
        pDoc.documentCode,
        latestPdf?.versionNumber || 1,
      );

      documentsList.push({
        positionNumber: pDoc.positionNumber,
        documentCode: pDoc.documentCode,
        title: pDoc.title,
        status: docStatus,
        applicabilityStatus: pDoc.applicabilityStatus,
        nonApplicabilityReason: pDoc.nonApplicabilityReason,
        category: pDoc.category,
        includedInConsolidatedPdf: isEligibleForConsolidation,
        consolidatedPageRange: null,
        originalFile: latestPdf
          ? {
              fileName: officialFileName,
              sha256: latestPdf.sha256Hash,
              sizeBytes: (latestPdf.dataSnapshot as any)?.pdfSizeBytes || 0,
              versionNumber: latestPdf.versionNumber,
              generatedAt:
                (latestPdf.dataSnapshot as any)?.generatedAt ||
                process.updatedAt.toISOString(),
              storageKey: latestPdf.objectStorageKey,
            }
          : null,
        signatures,
        custodyEventsCount: custodyCount,
      });
    }

    // 3. Documentos Fuente (solo si autorizados explícitamente y bajo juramento)
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
            sizeBytes: 0,
            uploadedAt: src.uploadedAt.toISOString(),
            includedInPackage: true,
          });
        }
      }
    }

    // 4. Armar Manifiesto Base
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
      systemVersion: "GODT Regional 3 v1.0.0 (Fase E.1)",
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
        hasConsolidatedPdf: true,
      },
      consolidatedPdf: null,
      documents: documentsList,
      sourceDocuments: sourceDocumentsList,
      files: [],
    };

    return manifest;
  }

  /**
   * Registra el inventario de archivos en el manifiesto y calcula el digest canónico.
   * Nivel A: Hashes individuales en manifest.files.
   * Nivel B: manifestDigest calculado determinísticamente.
   */
  finalizeManifest(manifest: DossierManifest, files: DossierManifestFileItem[]): {
    manifest: DossierManifest;
    manifestDigest: string;
  } {
    // Ordenar archivos por ruta relativa de forma determinista
    manifest.files = [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // Nivel B: Calcular digest canónico excluyendo manifestDigest
    const manifestDigest = computeCanonicalManifestDigest(manifest);
    manifest.manifestDigest = manifestDigest;

    return { manifest, manifestDigest };
  }

  buildEvidenciasAtestaciones(
    manifest: DossierManifest,
    custodyEventsByDoc: Array<{ documentCode: string; events: any[] }>,
  ): Record<string, unknown> {
    const validSignaturesTrail = manifest.documents
      .filter((d) => d.signatures.length > 0)
      .map((d) => ({
        positionNumber: d.positionNumber,
        documentCode: d.documentCode,
        title: d.title,
        signatures: d.signatures.map((sig) => ({
          signerRole: sig.signerRole,
          signerName: sig.signerName,
          signerDocument: sig.signerDocument,
          signatureType: sig.signatureType,
          signedAt: sig.signedAt,
          snapshotSha256: sig.snapshotSha256,
          hasCryptographicSignature: sig.hasCryptographicSignature,
          attestationLevel: sig.attestationLevel,
        })),
      }));

    return {
      schemaVersion: "1.0.0",
      processId: manifest.processId,
      processCode: manifest.processCode,
      generatedAt: manifest.generatedAt,
      generatedBy: {
        userId: manifest.generatedBy.userId,
        fullName: manifest.generatedBy.fullName,
        role: manifest.generatedBy.role,
      },
      signaturesAuditTrail: validSignaturesTrail,
      custodyChainsAuditTrail: custodyEventsByDoc,
      attestationNotice:
        "Las atestaciones documentadas corresponden a declaraciones y firmas manuscritas o electrónicas simples emitidas bajo juramento en el marco clínico de GODT Regional 3.",
      digitalSignatureDisclaimer:
        "AVISO TÉCNICO-LEGAL: La modalidad DIGITAL_CERTIFICADA (PKI acreditado por ONAC) se encuentra actualmente bloqueada hasta la suscripción con el prestador de certificación digital. Ninguna firma interna debe ser tratada como certificado digital de clave pública hasta su homologación formal.",
    };
  }
}
