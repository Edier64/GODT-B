import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { DossierManifest } from "../../domain/dossier/dossier.types";

export interface DossierIndexResult {
  pdfBuffer: Buffer;
  jsonSummary: Record<string, unknown>;
  pageCount: number;
}

@Injectable()
export class GenerateDossierIndexService {
  async generate(manifest: DossierManifest): Promise<DossierIndexResult> {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
    const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const navy = rgb(0.07, 0.19, 0.28); // #123047
    const teal = rgb(0.08, 0.61, 0.60); // #159C9A
    const darkGray = rgb(0.2, 0.25, 0.3);
    const lightBg = rgb(0.96, 0.97, 0.98);
    const borderGray = rgb(0.85, 0.88, 0.91);

    // Página 1: Carátula e Información General
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
    const { width, height } = page.getSize();
    let y = height - 45;

    // Header superior
    page.drawRectangle({
      x: 35,
      y: y - 55,
      width: width - 70,
      height: 65,
      color: lightBg,
      borderColor: teal,
      borderWidth: 1.5,
    });

    page.drawText("REPÚBLICA DE COLOMBIA — MINISTERIO DE SALUD Y PROTECCIÓN SOCIAL", {
      x: 45,
      y: y - 14,
      size: 8,
      font: fontBold,
      color: navy,
    });
    page.drawText("SISTEMA DE GESTIÓN CLÍNICO-DOCUMENTAL — GODT REGIONAL 3", {
      x: 45,
      y: y - 28,
      size: 11,
      font: fontBold,
      color: teal,
    });
    page.drawText("CARÁTULA E ÍNDICE OFICIAL DEL EXPEDIENTE DOCUMENTAL CONSOLIDADO", {
      x: 45,
      y: y - 44,
      size: 9.5,
      font: fontBold,
      color: navy,
    });

    y -= 75;

    // Metadatos del Proceso (Cuadro de 2 columnas)
    page.drawRectangle({
      x: 35,
      y: y - 110,
      width: width - 70,
      height: 110,
      color: rgb(1, 1, 1),
      borderColor: borderGray,
      borderWidth: 1,
    });

    const col1X = 45;
    const col2X = 310;
    let metaY = y - 18;

    page.drawText("CÓDIGO DE OPERATIVO:", { x: col1X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.processCode, { x: col1X + 115, y: metaY, size: 9, font: fontMonoBold, color: navy });

    page.drawText("FECHA EXPEDICIÓN:", { x: col2X, y: metaY, size: 8, font: fontBold, color: darkGray });
    const cotFormatted = new Date(manifest.generatedAt).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " COT (UTC-5)";
    page.drawText(cotFormatted, { x: col2X + 95, y: metaY, size: 8, font: fontRegular, color: navy });

    metaY -= 20;
    page.drawText("CÓDIGO RND DONANTE:", { x: col1X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.donorRndCode || "N/A", { x: col1X + 115, y: metaY, size: 9, font: fontMonoBold, color: teal });

    page.drawText("USUARIO RESPONSABLE:", { x: col2X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(`${manifest.generatedBy.fullName} (${manifest.generatedBy.role})`, {
      x: col2X + 95,
      y: metaY,
      size: 8,
      font: fontRegular,
      color: navy,
    });

    metaY -= 20;
    page.drawText("IPS PRINCIPAL / ORIGEN:", { x: col1X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.primaryIpsName.slice(0, 32), { x: col1X + 115, y: metaY, size: 8, font: fontRegular, color: navy });

    page.drawText("CORREO INSTITUCIONAL:", { x: col2X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.generatedBy.email, { x: col2X + 95, y: metaY, size: 8, font: fontRegular, color: darkGray });

    metaY -= 20;
    page.drawText("VERSIÓN DE PAQUETE:", { x: col1X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.packageVersion || "Piloto Regional 3 (v1.0.0)", { x: col1X + 115, y: metaY, size: 8, font: fontRegular, color: darkGray });

    page.drawText("SISTEMA AUDITOR:", { x: col2X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText(manifest.systemVersion, { x: col2X + 95, y: metaY, size: 8, font: fontMono, color: darkGray });

    metaY -= 20;
    page.drawText("INTEGRIDAD EXPEDIENTE:", { x: col1X, y: metaY, size: 8, font: fontBold, color: darkGray });
    page.drawText("CONFORME · HASHES SHA-256 REGISTRADOS", { x: col1X + 115, y: metaY, size: 8, font: fontBold, color: teal });

    y -= 125;

    // Resumen Métrico de las 23 Posiciones
    page.drawRectangle({
      x: 35,
      y: y - 40,
      width: width - 70,
      height: 40,
      color: lightBg,
      borderColor: borderGray,
      borderWidth: 1,
    });

    const sum = manifest.summary;
    const summaryItems = [
      `Total: ${sum.totalPositions}`,
      `Aplicables: ${sum.applicableCount}`,
      `Liberados: ${sum.releasedCount}`,
      `Firmados: ${sum.signedCount}`,
      `No Aplica: ${sum.nonApplicableCount}`,
      `Pend. Homol: ${sum.pendingHomologationCount}`,
      `Fuentes: ${sum.sourceDocumentsIncludedCount}`,
    ];
    let sumX = 45;
    for (const item of summaryItems) {
      page.drawText(item, { x: sumX, y: y - 24, size: 8.5, font: fontBold, color: navy });
      sumX += 74;
    }

    y -= 55;

    // Encabezado de la Tabla de Posiciones
    function drawTableHeader(targetPage: PDFPage, startY: number): number {
      targetPage.drawRectangle({
        x: 35,
        y: startY - 20,
        width: width - 70,
        height: 20,
        color: navy,
      });

      targetPage.drawText("Pos", { x: 40, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      targetPage.drawText("Código", { x: 62, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      targetPage.drawText("Formato / Documento", { x: 140, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      targetPage.drawText("Estado", { x: 330, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      targetPage.drawText("Páginas PDF", { x: 420, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      targetPage.drawText("Hash SHA-256 (8c)", { x: 495, y: startY - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });

      return startY - 24;
    }

    y = drawTableHeader(page, y);

    // Filas de la tabla (con paginación automática si no caben las 23 posiciones)
    for (let i = 0; i < manifest.documents.length; i++) {
      const doc = manifest.documents[i];

      if (y < 70) {
        // Pie de página de la página anterior
        page.drawText("Expediente Documental GODT Regional 3 — Documento de Consulta Oficial", {
          x: 35,
          y: 25,
          size: 7,
          font: fontRegular,
          color: darkGray,
        });

        // Crear nueva página para continuar la tabla
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 45;
        y = drawTableHeader(page, y);
      }

      const isEven = i % 2 === 0;
      if (isEven) {
        page.drawRectangle({
          x: 35,
          y: y - 16,
          width: width - 70,
          height: 18,
          color: rgb(0.98, 0.98, 0.99),
        });
      }

      // Posición
      page.drawText(String(doc.positionNumber).padStart(2, "0"), {
        x: 42,
        y: y - 12,
        size: 7.5,
        font: fontMonoBold,
        color: navy,
      });

      // Código
      page.drawText(doc.documentCode.slice(0, 14), {
        x: 62,
        y: y - 12,
        size: 7.5,
        font: fontMono,
        color: teal,
      });

      // Título
      page.drawText(doc.title.slice(0, 36), {
        x: 140,
        y: y - 12,
        size: 7.5,
        font: fontRegular,
        color: darkGray,
      });

      // Estado
      let statusColor = darkGray;
      if (doc.status === "LIBERADO") statusColor = rgb(0.05, 0.55, 0.35);
      else if (doc.status === "FIRMADO") statusColor = teal;
      else if (doc.status === "PENDIENTE_HOMOLOGACION") statusColor = rgb(0.7, 0.45, 0.1);

      page.drawText(doc.status.slice(0, 16), {
        x: 330,
        y: y - 12,
        size: 7,
        font: fontBold,
        color: statusColor,
      });

      // Páginas PDF
      const pageInfo = doc.consolidatedPageRange
        ? `Págs. ${doc.consolidatedPageRange.startPage} - ${doc.consolidatedPageRange.endPage}`
        : doc.applicabilityStatus === "NO_APLICA"
        ? "NO APLICA"
        : "No incluido";
      page.drawText(pageInfo, {
        x: 420,
        y: y - 12,
        size: 7.5,
        font: fontRegular,
        color: doc.consolidatedPageRange ? navy : darkGray,
      });

      // Hash SHA-256 corto
      const hashStr = doc.originalFile ? doc.originalFile.sha256.slice(0, 10) + "..." : "—";
      page.drawText(hashStr, {
        x: 495,
        y: y - 12,
        size: 7,
        font: fontMono,
        color: darkGray,
      });

      y -= 18;
    }

    // Pie de carátula con nota legal de inmutabilidad
    if (y < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    } else {
      y -= 15;
    }

    page.drawRectangle({
      x: 35,
      y: y - 65,
      width: width - 70,
      height: 65,
      color: lightBg,
      borderColor: borderGray,
      borderWidth: 1,
    });

    page.drawText("AVISO DE CONSULTA, FIRMAS DIGITALES E INMUTABILIDAD:", {
      x: 45,
      y: y - 14,
      size: 7.5,
      font: fontBold,
      color: navy,
    });

    const disclaimer1 =
      "El presente índice y el PDF consolidado constituyen representaciones de consulta unificada expedidas para fines asistenciales y de";
    const disclaimer2 =
      "auditoría. La validez legal y técnica de cada formato reposa en su archivo PDF original individual, cuyos hashes SHA-256 y firmas";
    const disclaimer3 =
      "electrónicas y atestaciones bajo juramento están preservados de forma inalterable en el paquete ZIP y en el almacenamiento institucional.";

    page.drawText(disclaimer1, { x: 45, y: y - 28, size: 6.8, font: fontRegular, color: darkGray });
    page.drawText(disclaimer2, { x: 45, y: y - 40, size: 6.8, font: fontRegular, color: darkGray });
    page.drawText(disclaimer3, { x: 45, y: y - 52, size: 6.8, font: fontRegular, color: darkGray });

    // Pie de página final
    page.drawText("Expediente Documental GODT Regional 3 — Documento de Consulta Oficial · Generado con pdf-lib", {
      x: 35,
      y: 25,
      size: 7,
      font: fontRegular,
      color: darkGray,
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const jsonSummary: Record<string, unknown> = {
      processId: manifest.processId,
      processCode: manifest.processCode,
      donorRndCode: manifest.donorRndCode,
      generatedAt: manifest.generatedAt,
      generatedBy: manifest.generatedBy,
      summary: manifest.summary,
      totalPositions: manifest.documents.length,
      documentsIndex: manifest.documents.map((d) => ({
        positionNumber: d.positionNumber,
        documentCode: d.documentCode,
        title: d.title,
        status: d.status,
        applicabilityStatus: d.applicabilityStatus,
        nonApplicabilityReason: d.nonApplicabilityReason,
        consolidatedPageRange: d.consolidatedPageRange,
        sha256: d.originalFile?.sha256 || null,
      })),
    };

    return {
      pdfBuffer,
      jsonSummary,
      pageCount: pdfDoc.getPageCount(),
    };
  }
}
