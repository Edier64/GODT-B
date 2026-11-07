import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import {
  DossierAccessDeniedError,
  DossierManifest,
  DossierNotFoundError,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";

export interface IntegrityVerificationItem {
  itemType: "ORIGINAL_PDF" | "CONSOLIDATED_PDF" | "ZIP_ARCHIVE" | "SOURCE_DOCUMENT";
  codeOrName: string;
  expectedSha256: string;
  actualSha256: string;
  matches: boolean;
  status: "OK" | "MISMATCH" | "FILE_NOT_FOUND";
  details?: string;
}

export interface IntegrityVerificationReport {
  exportId: string;
  processCode: string;
  verifiedAt: string;
  verifiedBy: string;
  overallStatus: "INTEGRITY_VERIFIED" | "INTEGRITY_COMPROMISED";
  totalChecked: number;
  passedCount: number;
  failedCount: number;
  items: IntegrityVerificationItem[];
}

@Injectable()
export class VerifyDossierIntegrityUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(exportId: string, user: AuthenticatedUser): Promise<IntegrityVerificationReport> {
    const record = await this.prisma.processDossierExport.findUnique({
      where: { id: exportId },
      include: {
        process: true,
      },
    });

    if (!record) {
      throw new DossierNotFoundError(`Exportación '${exportId}' no encontrada`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(record.process.primaryIpsName)
    ) {
      throw new DossierAccessDeniedError("No tiene autorización para verificar este expediente");
    }

    if (record.status !== "COMPLETED" || !record.manifestData) {
      throw new Error(`La exportación '${exportId}' no se encuentra en estado COMPLETED o carece de manifiesto`);
    }

    const manifest = record.manifestData as unknown as DossierManifest;
    const items: IntegrityVerificationItem[] = [];

    // 1. Verificar cada PDF original liberado
    for (const doc of manifest.documents) {
      if (doc.status === "LIBERADO" && doc.originalFile?.storageKey) {
        try {
          const buf = await this.storage.get(doc.originalFile.storageKey);
          const actualHash = createHash("sha256").update(buf).digest("hex");
          const matches = actualHash.toLowerCase() === doc.originalFile.sha256.toLowerCase();

          items.push({
            itemType: "ORIGINAL_PDF",
            codeOrName: `${doc.documentCode} (${doc.originalFile.fileName})`,
            expectedSha256: doc.originalFile.sha256,
            actualSha256: actualHash,
            matches,
            status: matches ? "OK" : "MISMATCH",
          });
        } catch (err: any) {
          items.push({
            itemType: "ORIGINAL_PDF",
            codeOrName: `${doc.documentCode} (${doc.originalFile.fileName})`,
            expectedSha256: doc.originalFile.sha256,
            actualSha256: "ERROR",
            matches: false,
            status: "FILE_NOT_FOUND",
            details: err?.message,
          });
        }
      }
    }

    // 2. Verificar el PDF consolidado si existe
    if (record.consolidatedPdfStorageKey && record.consolidatedPdfSha256) {
      try {
        const buf = await this.storage.get(record.consolidatedPdfStorageKey);
        const actualHash = createHash("sha256").update(buf).digest("hex");
        const matches = actualHash.toLowerCase() === record.consolidatedPdfSha256.toLowerCase();

        items.push({
          itemType: "CONSOLIDATED_PDF",
          codeOrName: "expediente_consolidado.pdf",
          expectedSha256: record.consolidatedPdfSha256,
          actualSha256: actualHash,
          matches,
          status: matches ? "OK" : "MISMATCH",
        });
      } catch (err: any) {
        items.push({
          itemType: "CONSOLIDATED_PDF",
          codeOrName: "expediente_consolidado.pdf",
          expectedSha256: record.consolidatedPdfSha256,
          actualSha256: "ERROR",
          matches: false,
          status: "FILE_NOT_FOUND",
          details: err?.message,
        });
      }
    }

    // 3. Verificar el paquete ZIP completo
    if (record.zipStorageKey && record.zipSha256) {
      try {
        const buf = await this.storage.get(record.zipStorageKey);
        const actualHash = createHash("sha256").update(buf).digest("hex");
        const matches = actualHash.toLowerCase() === record.zipSha256.toLowerCase();

        items.push({
          itemType: "ZIP_ARCHIVE",
          codeOrName: `GODT_EXPEDIENTE_${record.process.processCode}.zip`,
          expectedSha256: record.zipSha256,
          actualSha256: actualHash,
          matches,
          status: matches ? "OK" : "MISMATCH",
        });
      } catch (err: any) {
        items.push({
          itemType: "ZIP_ARCHIVE",
          codeOrName: `GODT_EXPEDIENTE_${record.process.processCode}.zip`,
          expectedSha256: record.zipSha256,
          actualSha256: "ERROR",
          matches: false,
          status: "FILE_NOT_FOUND",
          details: err?.message,
        });
      }
    }

    const passedCount = items.filter((i) => i.matches).length;
    const failedCount = items.length - passedCount;
    const overallStatus = failedCount === 0 ? "INTEGRITY_VERIFIED" : "INTEGRITY_COMPROMISED";

    await this.audit.record({
      actorUserId: user.userId,
      action: "DOSSIER_INTEGRITY_VERIFIED",
      entityType: "PROCESS_DOSSIER_EXPORT",
      entityId: exportId,
      correlationId: record.processId,
      metadata: {
        overallStatus,
        totalChecked: items.length,
        passedCount,
        failedCount,
      },
    });

    const userRecord = await this.prisma.systemUser.findUnique({
      where: { id: user.userId },
    });

    return {
      exportId,
      processCode: record.process.processCode,
      verifiedAt: new Date().toISOString(),
      verifiedBy: userRecord?.email || user.userId,
      overallStatus,
      totalChecked: items.length,
      passedCount,
      failedCount,
      items,
    };
  }
}
