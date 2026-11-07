import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { BuildIntegrityManifestService } from "./build-integrity-manifest.service";
import { GenerateDossierIndexService } from "./generate-dossier-index.service";
import { ConsolidatePdfService } from "./consolidate-pdf.service";
import { PackageZipService } from "./package-zip.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { DossierManifestFileItem } from "../../domain/dossier/dossier.types";

@Injectable()
export class ProcessDossierExportService {
  private readonly logger = new Logger(ProcessDossierExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    private readonly manifestService: BuildIntegrityManifestService,
    private readonly indexService: GenerateDossierIndexService,
    private readonly consolidateService: ConsolidatePdfService,
    private readonly zipService: PackageZipService,
  ) {}

  async processExport(exportId: string, user: AuthenticatedUser): Promise<void> {
    const exportRecord = await this.prisma.processDossierExport.findUnique({
      where: { id: exportId },
      include: { process: true },
    });

    if (!exportRecord) {
      throw new Error(`Registro de exportación '${exportId}' no encontrado`);
    }

    try {
      // 1. Estado inicial: PROCESSING
      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          status: "PROCESSING",
          progressPercent: 10,
          currentStep: "RECOPILANDO_DATOS",
        },
      });

      // 2. Construir Manifiesto Preliminar
      const manifest = await this.manifestService.build({
        processId: exportRecord.processId,
        user,
        includeSourceDocuments: exportRecord.includeSourceDocuments,
        selectedDocumentCodes: exportRecord.selectedDocumentCodes,
        selectedSourceDocumentIds: exportRecord.selectedSourceDocumentIds,
      });

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          progressPercent: 25,
          currentStep: "CARGANDO_DOCUMENTOS_ORIGINALES",
        },
      });

      // 3. Leer los buffers de los PDFs liberados desde almacenamiento privado
      const releasedPdfBuffersByPosition = new Map<number, Buffer>();
      const releasedPdfsForZip: Array<{
        documentCode: string;
        positionNumber: number;
        filename: string;
        buffer: Buffer;
      }> = [];

      for (const doc of manifest.documents) {
        if (doc.status === "LIBERADO" && doc.originalFile?.storageKey) {
          try {
            const buf = await this.storage.get(doc.originalFile.storageKey);
            releasedPdfBuffersByPosition.set(doc.positionNumber, buf);
            releasedPdfsForZip.push({
              documentCode: doc.documentCode,
              positionNumber: doc.positionNumber,
              filename: doc.originalFile.fileName,
              buffer: buf,
            });
          } catch (err: any) {
            this.logger.warn(
              `No se pudo leer buffer para ${doc.documentCode}: ${err?.message}`,
            );
          }
        }
      }

      // 4. Preparar archivos de custodia (Anexo 8) sin duplicación de binarios
      const custodyFiles: Array<{ filename: string; buffer: Buffer }> = [];
      const anexo8Doc = manifest.documents.find((d) => d.documentCode.includes("ANEXO_8"));
      const custodyEventsByDoc: Array<{ documentCode: string; events: any[] }> = [];

      if (anexo8Doc) {
        const custodyEvents = await this.prisma.custodyEvent.findMany({
          where: { processId: exportRecord.processId },
          orderBy: { sequenceNumber: "asc" },
        });

        custodyEventsByDoc.push({
          documentCode: "ANEXO_8",
          events: custodyEvents,
        });

        custodyFiles.push({
          filename: "eventos_custodia_inmutables.json",
          buffer: Buffer.from(JSON.stringify(custodyEvents, null, 2), "utf-8"),
        });

        // Puntero de referencia inequívoco que evita duplicación binaria del PDF en el ZIP
        const anexo8Reference = {
          documentCode: "ANEXO_8",
          positionNumber: 18,
          title: "Anexo 8 — Formato cadena de custodia EMP y evidencias",
          officialPdfLocation: anexo8Doc.originalFile
            ? `01_DOCUMENTOS_LIBERADOS/${anexo8Doc.originalFile.fileName}`
            : null,
          sha256: anexo8Doc.originalFile?.sha256 || null,
          notice:
            "El documento oficial firmado de Acta de Cadena de Custodia se conserva en la carpeta 01_DOCUMENTOS_LIBERADOS/ preservando intacta su firma electrónica y su hash SHA-256. En 04_CADENA_CUSTODIA/ se preservan los eventos y la línea de tiempo inmutable.",
        };

        custodyFiles.push({
          filename: "referencia_anexo_8.json",
          buffer: Buffer.from(JSON.stringify(anexo8Reference, null, 2), "utf-8"),
        });
      }

      // 5. Leer documentos fuente si fueron autorizados y solicitados bajo juramento
      const sourceDocumentsForZip: Array<{
        filename: string;
        category: string;
        buffer: Buffer;
      }> = [];

      if (exportRecord.includeSourceDocuments) {
        const srcDocs = await this.prisma.sourceDocument.findMany({
          where: {
            processId: exportRecord.processId,
            ...(exportRecord.selectedSourceDocumentIds.length > 0
              ? { id: { in: exportRecord.selectedSourceDocumentIds } }
              : {}),
          },
        });

        for (const src of srcDocs) {
          try {
            const buf = await this.storage.get(src.objectStorageKey);
            sourceDocumentsForZip.push({
              filename: src.originalFilename,
              category: src.documentCategory,
              buffer: buf,
            });
          } catch (err: any) {
            this.logger.warn(
              `No se pudo leer documento fuente ${src.id}: ${err?.message}`,
            );
          }
        }
      }

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          progressPercent: 50,
          currentStep: "GENERANDO_INDICE_Y_CONSOLIDANDO_PDF",
        },
      });

      // 6. Consolidar PDF continuo y calcular rangos de página
      const consolidateResult = await this.consolidateService.consolidate(
        manifest,
        releasedPdfBuffersByPosition,
      );

      // Guardar PDF consolidado en almacenamiento privado
      const storedPdf = await this.storage.put({
        buffer: consolidateResult.pdfBuffer,
        originalFilename: `expediente_consolidado_${manifest.processCode}.pdf`,
        mimeType: "application/pdf",
      });

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          consolidatedPdfStorageKey: storedPdf.storageKey,
          consolidatedPdfSha256: consolidateResult.sha256Hash,
          progressPercent: 75,
          currentStep: "EMPAQUETANDO_ARCHIVO_ZIP",
        },
      });

      // 7. Generar índice final y evidencias
      const indexResult = await this.indexService.generate(consolidateResult.updatedManifest);
      const evidenciasAtestaciones = this.manifestService.buildEvidenciasAtestaciones(
        consolidateResult.updatedManifest,
        custodyEventsByDoc,
      );

      // 8. Construir inventario de archivos (Nivel A: Hashes individuales en manifest.files)
      const manifestFiles: DossierManifestFileItem[] = [];

      // 00_INDICE
      manifestFiles.push({
        fileName: "indice_expediente.pdf",
        relativePath: "00_INDICE/indice_expediente.pdf",
        fileType: "INDEX_PDF",
        sha256: createHash("sha256").update(indexResult.pdfBuffer).digest("hex"),
        sizeBytes: indexResult.pdfBuffer.length,
      });

      const indexJsonBuf = Buffer.from(
        JSON.stringify(indexResult.jsonSummary, null, 2),
        "utf-8",
      );
      manifestFiles.push({
        fileName: "resumen_expediente.json",
        relativePath: "00_INDICE/resumen_expediente.json",
        fileType: "INDEX_JSON",
        sha256: createHash("sha256").update(indexJsonBuf).digest("hex"),
        sizeBytes: indexJsonBuf.length,
      });

      // 01_DOCUMENTOS_LIBERADOS
      for (const doc of releasedPdfsForZip) {
        manifestFiles.push({
          fileName: doc.filename,
          relativePath: `01_DOCUMENTOS_LIBERADOS/${doc.filename}`,
          fileType: "ORIGINAL_PDF",
          sha256: createHash("sha256").update(doc.buffer).digest("hex"),
          sizeBytes: doc.buffer.length,
          documentCode: doc.documentCode,
          positionNumber: doc.positionNumber,
          status: "LIBERADO",
        });
      }

      // 02_DOCUMENTO_CONSOLIDADO
      manifestFiles.push({
        fileName: "expediente_consolidado.pdf",
        relativePath: "02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf",
        fileType: "CONSOLIDATED_PDF",
        sha256: consolidateResult.sha256Hash,
        sizeBytes: consolidateResult.pdfBuffer.length,
      });

      // 03_EVIDENCIAS: evidencias_atestaciones.json
      const evidBuf = Buffer.from(
        JSON.stringify(evidenciasAtestaciones, null, 2),
        "utf-8",
      );
      manifestFiles.push({
        fileName: "evidencias_atestaciones.json",
        relativePath: "03_EVIDENCIAS/evidencias_atestaciones.json",
        fileType: "EVIDENCE_ATTESTATIONS",
        sha256: createHash("sha256").update(evidBuf).digest("hex"),
        sizeBytes: evidBuf.length,
      });

      // 04_CADENA_CUSTODIA
      for (const cf of custodyFiles) {
        manifestFiles.push({
          fileName: cf.filename,
          relativePath: `04_CADENA_CUSTODIA/${cf.filename}`,
          fileType: cf.filename.includes("evento") ? "CUSTODY_EVENTS" : "CUSTODY_REFERENCE",
          sha256: createHash("sha256").update(cf.buffer).digest("hex"),
          sizeBytes: cf.buffer.length,
        });
      }

      // 05_FUENTES_COMPLEMENTARIAS
      for (const src of sourceDocumentsForZip) {
        manifestFiles.push({
          fileName: src.filename,
          relativePath: `05_FUENTES_COMPLEMENTARIAS/${src.category}/${src.filename}`,
          fileType: "SOURCE_DOCUMENT",
          sha256: createHash("sha256").update(src.buffer).digest("hex"),
          sizeBytes: src.buffer.length,
        });
      }

      // 6. README.txt institucional
      const readmeContent = this.zipService.buildReadme(consolidateResult.updatedManifest);
      const readmeBuf = Buffer.from(readmeContent, "utf-8");
      manifestFiles.push({
        fileName: "README.txt",
        relativePath: "README.txt",
        fileType: "README",
        sha256: createHash("sha256").update(readmeBuf).digest("hex"),
        sizeBytes: readmeBuf.length,
      });

      // Finalizar manifiesto con Nivel A y Nivel B (manifestDigest canónico)
      const { manifest: finalizedManifest, manifestDigest } =
        this.manifestService.finalizeManifest(
          consolidateResult.updatedManifest,
          manifestFiles,
        );

      // 9. Empaquetar el archivo ZIP completo (Nivel C)
      const zipResult = await this.zipService.createPackage({
        manifest: finalizedManifest,
        indexPdfBuffer: indexResult.pdfBuffer,
        indexJsonSummary: indexResult.jsonSummary,
        consolidatedPdfBuffer: consolidateResult.pdfBuffer,
        evidenciasAtestacionesJson: evidenciasAtestaciones,
        releasedPdfs: releasedPdfsForZip,
        custodyFiles,
        sourceDocuments: sourceDocumentsForZip,
        readmeBuffer: readmeBuf,
      });

      // 10. Marcar exportación como COMPLETED con manifestDigest y packageChecksumSha256
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          status: "COMPLETED",
          progressPercent: 100,
          currentStep: "COMPLETADO",
          zipStorageKey: zipResult.storageKey,
          zipSha256: zipResult.packageChecksumSha256,
          packageChecksumSha256: zipResult.packageChecksumSha256,
          manifestDigest,
          zipSizeBytes: BigInt(zipResult.sizeBytes),
          manifestData: finalizedManifest as any,
          completedAt: now,
          expiresAt,
        },
      });

      // Registrar auditoría con los 3 niveles separados
      await this.audit.record({
        actorUserId: user.userId,
        action: "DOSSIER_EXPORT_COMPLETED",
        entityType: "PROCESS_DOSSIER_EXPORT",
        entityId: exportId,
        correlationId: exportRecord.processId,
        metadata: {
          processCode: exportRecord.process.processCode,
          packageChecksumSha256: zipResult.packageChecksumSha256,
          manifestDigest,
          zipSizeBytes: zipResult.sizeBytes,
          consolidatedPdfSha256: consolidateResult.sha256Hash,
          totalPositions: manifest.documents.length,
          releasedCount: manifest.summary.releasedCount,
        },
      });

      this.logger.log(`Exportación de expediente ${exportId} finalizada con éxito.`);
    } catch (error: any) {
      this.logger.error(
        `Error procesando exportación de expediente ${exportId}: ${error?.message}`,
        error?.stack,
      );

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          status: "FAILED",
          progressPercent: 0,
          currentStep: "ERROR",
          errorMessage:
            error?.message || "Error inesperado durante la consolidación del expediente.",
        },
      });

      await this.audit.record({
        actorUserId: user.userId,
        action: "DOSSIER_EXPORT_FAILED",
        entityType: "PROCESS_DOSSIER_EXPORT",
        entityId: exportId,
        correlationId: exportRecord.processId,
        metadata: {
          errorMessage: error?.message,
        },
      });

      throw error;
    }
  }
}
