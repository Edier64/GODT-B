import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { BuildIntegrityManifestService } from "./build-integrity-manifest.service";
import { GenerateDossierIndexService } from "./generate-dossier-index.service";
import { ConsolidatePdfService } from "./consolidate-pdf.service";
import { PackageZipService } from "./package-zip.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

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
            this.logger.warn(`No se pudo leer buffer para ${doc.documentCode}: ${err?.message}`);
          }
        }
      }

      // 4. Preparar archivos de custodia (Anexo 8)
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

        if (anexo8Doc.status === "LIBERADO" && anexo8Doc.originalFile?.storageKey) {
          try {
            const anexo8Buf = await this.storage.get(anexo8Doc.originalFile.storageKey);
            custodyFiles.push({
              filename: "anexo_8_cadena_custodia.pdf",
              buffer: anexo8Buf,
            });
          } catch {
            // continuar si ya está en releasedPdfsForZip
          }
        }
      }

      // 5. Leer documentos fuente si fueron autorizados y solicitados
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
            this.logger.warn(`No se pudo leer documento fuente ${src.id}: ${err?.message}`);
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

      // 6. Consolidar PDF y calcular rangos de página
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

      // 8. Empaquetar el archivo ZIP completo
      const zipResult = await this.zipService.createPackage({
        manifest: consolidateResult.updatedManifest,
        indexPdfBuffer: indexResult.pdfBuffer,
        indexJsonSummary: indexResult.jsonSummary,
        consolidatedPdfBuffer: consolidateResult.pdfBuffer,
        evidenciasAtestacionesJson: evidenciasAtestaciones,
        releasedPdfs: releasedPdfsForZip,
        custodyFiles,
        sourceDocuments: sourceDocumentsForZip,
      });

      // Actualizar manifiesto con metadata del ZIP
      consolidateResult.updatedManifest.zipPackage = {
        fileName: zipResult.fileName,
        sha256: zipResult.sha256Hash,
        sizeBytes: zipResult.sizeBytes,
      };

      // 9. Marcar exportación como COMPLETED
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          status: "COMPLETED",
          progressPercent: 100,
          currentStep: "COMPLETADO",
          zipStorageKey: zipResult.storageKey,
          zipSha256: zipResult.sha256Hash,
          zipSizeBytes: BigInt(zipResult.sizeBytes),
          manifestData: consolidateResult.updatedManifest as any,
          completedAt: now,
          expiresAt,
        },
      });

      // Registrar auditoría
      await this.audit.record({
        actorUserId: user.userId,
        action: "DOSSIER_EXPORT_COMPLETED",
        entityType: "PROCESS_DOSSIER_EXPORT",
        entityId: exportId,
        correlationId: exportRecord.processId,
        metadata: {
          processCode: exportRecord.process.processCode,
          zipSha256: zipResult.sha256Hash,
          zipSizeBytes: zipResult.sizeBytes,
          consolidatedPdfSha256: consolidateResult.sha256Hash,
          totalPositions: manifest.documents.length,
          releasedCount: manifest.summary.releasedCount,
        },
      });

      this.logger.log(`Exportación de expediente ${exportId} finalizada con éxito.`);
    } catch (error: any) {
      this.logger.error(`Error procesando exportación de expediente ${exportId}: ${error?.message}`, error?.stack);

      await this.prisma.processDossierExport.update({
        where: { id: exportId },
        data: {
          status: "FAILED",
          progressPercent: 0,
          currentStep: "ERROR",
          errorMessage: error?.message || "Error inesperado durante la consolidación del expediente.",
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
