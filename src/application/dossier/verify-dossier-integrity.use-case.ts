import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import AdmZip from "adm-zip";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import {
  computeCanonicalManifestDigest,
  DossierAccessDeniedError,
  DossierManifest,
  DossierNotFoundError,
  HardenedVerificationItem,
  HardenedVerificationReport,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";

@Injectable()
export class VerifyDossierIntegrityUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(
    exportId: string,
    user: AuthenticatedUser,
  ): Promise<HardenedVerificationReport> {
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
      throw new DossierAccessDeniedError(
        "No tiene autorización para verificar este expediente institucional",
      );
    }

    if (record.status !== "COMPLETED" || !record.zipStorageKey) {
      throw new Error(
        `La exportación '${exportId}' no se encuentra en estado COMPLETED o carece de archivo de almacenamiento`,
      );
    }

    // 1. Obtener hash esperado del paquete en PostgreSQL (Nivel C)
    const expectedPackageSha256 = (
      record.packageChecksumSha256 ||
      record.zipSha256 ||
      ""
    ).toLowerCase();

    // 2. Obtener digest esperado del manifiesto en PostgreSQL (Nivel B)
    const expectedManifestDigest = (
      record.manifestDigest ||
      (record.manifestData as any)?.manifestDigest ||
      ""
    ).toLowerCase();

    let zipBuffer: Buffer;
    try {
      zipBuffer = await this.storage.get(record.zipStorageKey);
    } catch (err: any) {
      return {
        exportId,
        processCode: record.process.processCode,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user.userId,
        overallStatus: "VERIFICATION_FAILED",
        expectedPackageSha256,
        actualPackageSha256: "ERROR",
        packageHashMatches: false,
        expectedManifestDigest,
        actualManifestDigest: "ERROR",
        manifestDigestMatches: false,
        totalFilesInspected: 0,
        totalChecked: 0,
        correctFilesCount: 0,
        passedCount: 0,
        alteredFilesCount: 0,
        missingFilesCount: 0,
        unexpectedFilesCount: 0,
        failedCount: 1,
        items: [
          {
            relativePath: record.zipStorageKey,
            fileName: "archivo_zip",
            itemType: "ZIP_ARCHIVE",
            expectedSha256: expectedPackageSha256,
            actualSha256: "UNREADABLE",
            matches: false,
            status: "ERROR",
            details: `No se pudo leer el archivo ZIP desde almacenamiento: ${err?.message}`,
          },
        ],
      };
    }

    // 3. Nivel C: Calcular hash binario real del paquete ZIP y comparar con BD
    const actualPackageSha256 = createHash("sha256")
      .update(zipBuffer)
      .digest("hex")
      .toLowerCase();
    const packageHashMatches =
      Boolean(expectedPackageSha256) && actualPackageSha256 === expectedPackageSha256;

    // 4. Abrir e inspeccionar estructura interna del ZIP con AdmZip
    const items: HardenedVerificationItem[] = [];
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (err: any) {
      return {
        exportId,
        processCode: record.process.processCode,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user.userId,
        overallStatus: "INTEGRITY_COMPROMISED",
        expectedPackageSha256,
        actualPackageSha256,
        packageHashMatches,
        expectedManifestDigest,
        actualManifestDigest: "INVALID_ZIP",
        manifestDigestMatches: false,
        totalFilesInspected: 0,
        totalChecked: 0,
        correctFilesCount: 0,
        passedCount: 0,
        alteredFilesCount: 1,
        missingFilesCount: 0,
        unexpectedFilesCount: 0,
        failedCount: 1,
        items: [
          {
            relativePath: "root",
            fileName: "paquete_zip",
            itemType: "ZIP_ARCHIVE",
            expectedSha256: expectedPackageSha256,
            actualSha256: actualPackageSha256,
            matches: false,
            status: "ALTERED",
            details: `Estructura ZIP corrupta o no parseable: ${err?.message}`,
          },
        ],
      };
    }

    const zipEntries = zip.getEntries();
    const rootPrefixRegex = new RegExp(`^GODT_EXPEDIENTE_${record.process.processCode}/`, "i");

    const MAX_ZIP_ENTRIES = 500;
    const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB
    let totalUncompressedBytes = 0;

    if (zipEntries.length > MAX_ZIP_ENTRIES) {
      return {
        exportId,
        processCode: record.process.processCode,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user.userId,
        overallStatus: "INTEGRITY_COMPROMISED",
        expectedPackageSha256,
        actualPackageSha256,
        packageHashMatches,
        expectedManifestDigest,
        actualManifestDigest: "SUSPICIOUS_ZIP_STRUCTURE",
        manifestDigestMatches: false,
        totalFilesInspected: zipEntries.length,
        totalChecked: 0,
        correctFilesCount: 0,
        passedCount: 0,
        alteredFilesCount: 1,
        missingFilesCount: 0,
        unexpectedFilesCount: 0,
        failedCount: 1,
        items: [
          {
            relativePath: "root",
            fileName: "paquete_zip",
            itemType: "ZIP_SECURITY",
            expectedSha256: expectedPackageSha256,
            actualSha256: actualPackageSha256,
            matches: false,
            status: "ALTERED",
            details: `El archivo ZIP excede el límite de seguridad de entradas (${zipEntries.length} > ${MAX_ZIP_ENTRIES}). Posible bomba de descompresión.`,
          },
        ],
      };
    }

    // Mapear entradas verificando seguridad contra Path Traversal y Zip Bomb
    const entriesByRelativePath = new Map<string, (typeof zipEntries)[0]>();
    for (const entry of zipEntries) {
      if (
        entry.entryName.includes("..") ||
        entry.entryName.startsWith("/") ||
        entry.entryName.startsWith("\\")
      ) {
        return {
          exportId,
          processCode: record.process.processCode,
          verifiedAt: new Date().toISOString(),
          verifiedBy: user.userId,
          overallStatus: "INTEGRITY_COMPROMISED",
          expectedPackageSha256,
          actualPackageSha256,
          packageHashMatches,
          expectedManifestDigest,
          actualManifestDigest: "PATH_TRAVERSAL_DETECTED",
          manifestDigestMatches: false,
          totalFilesInspected: zipEntries.length,
          totalChecked: 0,
          correctFilesCount: 0,
          passedCount: 0,
          alteredFilesCount: 1,
          missingFilesCount: 0,
          unexpectedFilesCount: 0,
          failedCount: 1,
          items: [
            {
              relativePath: entry.entryName,
              fileName: entry.name,
              itemType: "ZIP_SECURITY",
              expectedSha256: "",
              actualSha256: "TRAVERSAL",
              matches: false,
              status: "ALTERED",
              details: "Detectado intento de evasión de directorio (Path Traversal) en el archivo ZIP.",
            },
          ],
        };
      }

      totalUncompressedBytes += entry.header.size;
      if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        return {
          exportId,
          processCode: record.process.processCode,
          verifiedAt: new Date().toISOString(),
          verifiedBy: user.userId,
          overallStatus: "INTEGRITY_COMPROMISED",
          expectedPackageSha256,
          actualPackageSha256,
          packageHashMatches,
          expectedManifestDigest,
          actualManifestDigest: "ZIP_BOMB_DETECTED",
          manifestDigestMatches: false,
          totalFilesInspected: zipEntries.length,
          totalChecked: 0,
          correctFilesCount: 0,
          passedCount: 0,
          alteredFilesCount: 1,
          missingFilesCount: 0,
          unexpectedFilesCount: 0,
          failedCount: 1,
          items: [
            {
              relativePath: "root",
              fileName: "paquete_zip",
              itemType: "ZIP_SECURITY",
              expectedSha256: expectedPackageSha256,
              actualSha256: actualPackageSha256,
              matches: false,
              status: "ALTERED",
              details: "El tamaño total descomprimido del ZIP excede el límite máximo de seguridad (500 MB).",
            },
          ],
        };
      }

      if (!entry.isDirectory) {
        const normalizedPath = entry.entryName.replace(rootPrefixRegex, "");
        entriesByRelativePath.set(normalizedPath, entry);
      }
    }

    // 5. Nivel B: Localizar y validar el manifiesto_integridad.json dentro del ZIP
    const manifestEntry = entriesByRelativePath.get("03_EVIDENCIAS/manifiesto_integridad.json");
    let actualManifestDigest = "";
    let manifestDigestMatches = false;
    let manifestData: DossierManifest | null = null;

    if (!manifestEntry) {
      items.push({
        relativePath: "03_EVIDENCIAS/manifiesto_integridad.json",
        fileName: "manifiesto_integridad.json",
        itemType: "EVIDENCE_MANIFEST",
        expectedSha256: expectedManifestDigest,
        actualSha256: "NOT_FOUND",
        matches: false,
        status: "MISSING",
        details: "El manifiesto de integridad no se encuentra en el paquete ZIP.",
      });
    } else {
      try {
        const manifestJsonText = manifestEntry.getData().toString("utf-8");
        manifestData = JSON.parse(manifestJsonText) as DossierManifest;
        actualManifestDigest = computeCanonicalManifestDigest(manifestData).toLowerCase();
        manifestDigestMatches =
          Boolean(expectedManifestDigest) && actualManifestDigest === expectedManifestDigest;

        items.push({
          relativePath: "03_EVIDENCIAS/manifiesto_integridad.json",
          fileName: "manifiesto_integridad.json",
          itemType: "EVIDENCE_MANIFEST",
          expectedSha256: expectedManifestDigest,
          actualSha256: actualManifestDigest,
          matches: manifestDigestMatches,
          status: manifestDigestMatches ? "OK" : "ALTERED",
          details: manifestDigestMatches
            ? "Digest canónico del manifiesto verificado contra PostgreSQL."
            : "Discrepancia en el digest canónico del manifiesto respecto a PostgreSQL.",
        });
      } catch (err: any) {
        items.push({
          relativePath: "03_EVIDENCIAS/manifiesto_integridad.json",
          fileName: "manifiesto_integridad.json",
          itemType: "EVIDENCE_MANIFEST",
          expectedSha256: expectedManifestDigest,
          actualSha256: "PARSE_ERROR",
          matches: false,
          status: "ALTERED",
          details: `Error parseando JSON del manifiesto: ${err?.message}`,
        });
      }
    }

    // 6. Nivel A: Validar cada archivo individual inventariado en manifest.files
    const expectedFiles = manifestData?.files || [];
    const checkedPaths = new Set<string>();
    checkedPaths.add("03_EVIDENCIAS/manifiesto_integridad.json");

    for (const expFile of expectedFiles) {
      checkedPaths.add(expFile.relativePath);
      const entry = entriesByRelativePath.get(expFile.relativePath);

      if (!entry) {
        items.push({
          relativePath: expFile.relativePath,
          fileName: expFile.fileName,
          itemType: expFile.fileType,
          expectedSha256: expFile.sha256,
          actualSha256: "MISSING",
          matches: false,
          status: "MISSING",
          details: "Archivo inventariado en el manifiesto no fue hallado en el ZIP.",
        });
        continue;
      }

      const fileData = entry.getData();
      const actualSha256 = createHash("sha256").update(fileData).digest("hex").toLowerCase();
      const matches = actualSha256 === expFile.sha256.toLowerCase();

      items.push({
        relativePath: expFile.relativePath,
        fileName: expFile.fileName,
        itemType: expFile.fileType,
        expectedSha256: expFile.sha256.toLowerCase(),
        actualSha256,
        matches,
        status: matches ? "OK" : "ALTERED",
        details: matches
          ? "Hash SHA-256 coincide exactamente con el inventario del manifiesto."
          : "Hash SHA-256 alterado. El archivo fue modificado respecto al inventario.",
      });
    }

    // 7. Detectar archivos inesperados dentro del ZIP
    for (const [relPath, entry] of entriesByRelativePath.entries()) {
      if (!checkedPaths.has(relPath)) {
        const fileData = entry.getData();
        const actualSha256 = createHash("sha256").update(fileData).digest("hex").toLowerCase();

        items.push({
          relativePath: relPath,
          fileName: entry.name,
          itemType: "UNEXPECTED_FILE",
          expectedSha256: "NONE",
          actualSha256,
          matches: false,
          status: "UNEXPECTED",
          details: "Archivo presente en el ZIP que no fue inventariado en el manifiesto oficial.",
        });
      }
    }

    // 8. Cálculo de métricas
    const correctFilesCount = items.filter((i) => i.status === "OK").length;
    const alteredFilesCount = items.filter((i) => i.status === "ALTERED").length;
    const missingFilesCount = items.filter((i) => i.status === "MISSING").length;
    const unexpectedFilesCount = items.filter((i) => i.status === "UNEXPECTED").length;

    // Estado global de integridad
    const hasDiscrepancy =
      !packageHashMatches ||
      !manifestDigestMatches ||
      alteredFilesCount > 0 ||
      missingFilesCount > 0 ||
      unexpectedFilesCount > 0;

    const overallStatus = hasDiscrepancy ? "INTEGRITY_COMPROMISED" : "INTEGRITY_VERIFIED";

    // 9. Registrar auditoría forense
    await this.audit.record({
      actorUserId: user.userId,
      action: "DOSSIER_INTEGRITY_VERIFIED",
      entityType: "PROCESS_DOSSIER_EXPORT",
      entityId: exportId,
      correlationId: record.processId,
      metadata: {
        overallStatus,
        packageHashMatches,
        manifestDigestMatches,
        totalChecked: items.length,
        correctFilesCount,
        alteredFilesCount,
        missingFilesCount,
        unexpectedFilesCount,
      },
    });

    const userRecord = await this.prisma.systemUser.findUnique({
      where: { id: user.userId },
    });

    return {
      exportId,
      processCode: record.process.processCode,
      verifiedAt: new Date().toISOString(),
      verifiedBy: userRecord?.email || userRecord?.fullName || user.userId,
      overallStatus,
      expectedPackageSha256,
      actualPackageSha256,
      packageHashMatches,
      expectedManifestDigest,
      actualManifestDigest,
      manifestDigestMatches,
      totalFilesInspected: items.length,
      totalChecked: items.length,
      correctFilesCount,
      passedCount: correctFilesCount,
      alteredFilesCount,
      missingFilesCount,
      unexpectedFilesCount,
      failedCount: alteredFilesCount + missingFilesCount + unexpectedFilesCount,
      items,
    };
  }
}
