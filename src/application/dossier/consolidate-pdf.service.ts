import { Inject, Injectable } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import { createHash } from "crypto";
import { DossierManifest } from "../../domain/dossier/dossier.types";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { GenerateDossierIndexService } from "./generate-dossier-index.service";

export interface ConsolidatePdfResult {
  pdfBuffer: Buffer;
  sha256Hash: string;
  sizeBytes: number;
  totalPageCount: number;
  updatedManifest: DossierManifest;
}

@Injectable()
export class ConsolidatePdfService {
  constructor(
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    private readonly indexService: GenerateDossierIndexService,
  ) {}

  async consolidate(
    manifest: DossierManifest,
    releasedPdfBuffersByPosition: Map<number, Buffer>,
  ): Promise<ConsolidatePdfResult> {
    // 1. Primer paso: calcular la paginación estimada
    // Primero generamos un índice inicial para saber cuántas páginas tiene el índice
    const tempIndex = await this.indexService.generate(manifest);
    const indexPageCount = tempIndex.pageCount;

    // Calcular rangos de página de cada documento en el PDF consolidado
    let currentPage = indexPageCount + 1;

    for (const doc of manifest.documents) {
      const buffer = releasedPdfBuffersByPosition.get(doc.positionNumber);
      if (buffer && (doc.status === "LIBERADO" || doc.includedInConsolidatedPdf)) {
        try {
          const docPdf = await PDFDocument.load(buffer);
          const docPageCount = docPdf.getPageCount();
          doc.includedInConsolidatedPdf = true;
          doc.consolidatedPageRange = {
            startPage: currentPage,
            endPage: currentPage + docPageCount - 1,
          };
          currentPage += docPageCount;
        } catch {
          doc.includedInConsolidatedPdf = false;
          doc.consolidatedPageRange = null;
        }
      } else {
        doc.includedInConsolidatedPdf = false;
        doc.consolidatedPageRange = null;
      }
    }

    // 2. Ahora generar el índice definitivo con los rangos de página exactos
    const finalIndex = await this.indexService.generate(manifest);

    // 3. Crear el PDF consolidado final
    const consolidatedDoc = await PDFDocument.create();

    // Copiar las páginas del índice definitivo (portada + tabla)
    const indexPdf = await PDFDocument.load(finalIndex.pdfBuffer);
    const indexPages = await consolidatedDoc.copyPages(indexPdf, indexPdf.getPageIndices());
    for (const page of indexPages) {
      consolidatedDoc.addPage(page);
    }

    // Copiar las páginas de cada documento liberado preservando orientación y tamaño
    for (const doc of manifest.documents) {
      const buffer = releasedPdfBuffersByPosition.get(doc.positionNumber);
      if (buffer && doc.includedInConsolidatedPdf) {
        try {
          const subDoc = await PDFDocument.load(buffer);
          const subPages = await consolidatedDoc.copyPages(subDoc, subDoc.getPageIndices());
          for (const page of subPages) {
            consolidatedDoc.addPage(page);
          }
        } catch (err) {
          // Si algún sub-documento tiene problema de lectura, continuar sin romper el consolidado
        }
      }
    }

    // Guardar el PDF consolidado
    const pdfBytes = await consolidatedDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const sha256Hash = createHash("sha256").update(pdfBuffer).digest("hex");
    const totalPageCount = consolidatedDoc.getPageCount();

    // Actualizar metadata del PDF consolidado en el manifiesto
    manifest.consolidatedPdf = {
      fileName: `expediente_consolidado_${manifest.processCode}.pdf`,
      sha256: sha256Hash,
      sizeBytes: pdfBuffer.length,
      pageCount: totalPageCount,
    };

    return {
      pdfBuffer,
      sha256Hash,
      sizeBytes: pdfBuffer.length,
      totalPageCount,
      updatedManifest: manifest,
    };
  }
}
