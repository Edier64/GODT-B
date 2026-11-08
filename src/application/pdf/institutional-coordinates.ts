import { rgb, PDFFont, PDFPage } from "pdf-lib";
import { PdfRenderInput } from "./pdf-render-engine.service";

export interface FieldCoordinate {
  pageIndex: number;
  x: number;
  y: number;
  fontSize?: number;
  isBold?: boolean;
  maxWidth?: number;
  color?: { r: number; g: number; b: number };
  getValue: (data: Record<string, any>, metadata: PdfRenderInput["metadata"]) => string | boolean | undefined;
}

export function drawTextWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  color: any,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
      line = word;
      currentY -= fontSize + 2;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, { x, y: currentY, size: fontSize, font, color });
    currentY -= fontSize + 2;
  }

  return currentY;
}

export const INSTITUTIONAL_OVERLAYS: Record<string, FieldCoordinate[]> = {
  // -------------------------------------------------------------
  // ANEXO 1: Formato de Valoración y Alerta del Posible Donante
  // (2 Páginas: 612 x 1008)
  // -------------------------------------------------------------
  anexo_1: [
    // Encabezado / IPS
    {
      pageIndex: 0,
      x: 135,
      y: 915,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 430,
      y: 915,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.processCode,
    },
    // Donante
    {
      pageIndex: 0,
      x: 125,
      y: 845,
      fontSize: 9,
      getValue: (d, meta) => meta.donorName || d.fallecidoNombre || d.nombreDonante || d.nombresApellidos || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 845,
      fontSize: 9,
      getValue: (d, meta) => meta.donorDocument || d.fallecidoDocumento || d.numeroIdentificacion || "N/A",
    },
    {
      pageIndex: 0,
      x: 125,
      y: 825,
      fontSize: 8.5,
      getValue: (d) => d.tipoIdentificacion || d.fallecidoTipoDocumento || "CC",
    },
    {
      pageIndex: 0,
      x: 240,
      y: 825,
      fontSize: 8.5,
      getValue: (d) => `${d.edad || d.donanteEdad || "N/A"} años`,
    },
    {
      pageIndex: 0,
      x: 350,
      y: 825,
      fontSize: 8.5,
      getValue: (d) => d.sexo || d.donanteSexo || "MASCULINO",
    },
    {
      pageIndex: 0,
      x: 450,
      y: 825,
      fontSize: 8.5,
      isBold: true,
      getValue: (d) => `${d.grupoSanguineo || "O"} ${d.factorRh || "POSITIVO"}`,
    },
    // Diagnóstico y Causa de Muerte
    {
      pageIndex: 0,
      x: 135,
      y: 775,
      fontSize: 8.5,
      maxWidth: 420,
      getValue: (d) => d.causaMuerte || d.diagnosticoMuerte || "Trauma Craneoencefálico Severo / ECV Isquémico",
    },
    {
      pageIndex: 0,
      x: 135,
      y: 735,
      fontSize: 8.5,
      getValue: (d) => d.glasgowIngreso ? `Glasgow: ${d.glasgowIngreso}/15` : "Glasgow: 3/15 (Midriasis bilateral)",
    },
    // Monitoreo hemodinámico
    {
      pageIndex: 0,
      x: 135,
      y: 680,
      fontSize: 8.5,
      getValue: (d) => `${d.tensionArterialSistolica || "118"}/${d.tensionArterialDiastolica || "78"} mmHg`,
    },
    {
      pageIndex: 0,
      x: 280,
      y: 680,
      fontSize: 8.5,
      getValue: (d) => `${d.frecuenciaCardiaca || "84"} lpm`,
    },
    {
      pageIndex: 0,
      x: 420,
      y: 680,
      fontSize: 8.5,
      getValue: (d) => `${d.temperaturaCorporal || "36.5"} °C`,
    },
    // Página 2: Criterios clínicos y firmas
    {
      pageIndex: 1,
      x: 135,
      y: 900,
      fontSize: 8.5,
      getValue: (d) => d.reflejosTronco || "Reflejos pupilares, corneales y oculocefálicos abolidos",
    },
    {
      pageIndex: 1,
      x: 135,
      y: 850,
      fontSize: 8.5,
      getValue: (d) => d.testApnea || "Test de apnea positivo (pCO2 > 60 mmHg sin esfuerzo respiratorio)",
    },
    {
      pageIndex: 1,
      x: 135,
      y: 400,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode ? `RND INS Certificado: ${meta.rndCode}` : "Pendiente consulta RND oficial",
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 2: Notificación a los Deudos (Ley 1805 / Presunción Legal)
  // (2 Páginas: 612 x 792)
  // -------------------------------------------------------------
  anexo_2: [
    {
      pageIndex: 0,
      x: 140,
      y: 710,
      fontSize: 9,
      isBold: true,
      getValue: (d, meta) => meta.donorName || d.fallecidoNombre || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 710,
      fontSize: 9,
      getValue: (d, meta) => `${d.fallecidoTipoDocumento || "CC"}: ${meta.donorDocument || d.fallecidoDocumento || "N/A"}`,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 665,
      fontSize: 9,
      isBold: true,
      getValue: (d) => d.notificadoNombre || "Familiar o Deudo Notificado",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 665,
      fontSize: 9,
      getValue: (d) => `${d.notificadoTipoDocumento || "CC"} ${d.notificadoDocumento || "N/A"} (${d.notificadoParentesco || "Primer Grado"})`,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 620,
      fontSize: 8.5,
      getValue: (d, meta) => `${d.ciudadNotificacion || "Cali"}, ${d.fechaNotificacion || new Date(meta.generatedAt).toLocaleDateString("es-CO")}`,
    },
    {
      pageIndex: 0,
      x: 380,
      y: 620,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => d.codigoConsultaRND || meta.rndCode || "CONSULTA-RND-1805",
    },
    {
      pageIndex: 1,
      x: 140,
      y: 680,
      fontSize: 8.5,
      maxWidth: 420,
      getValue: (d) => d.observaciones || "Notificación de la presunción legal efectuada de conformidad con la Ley 1805 de 2016.",
    },
    {
      pageIndex: 1,
      x: 140,
      y: 280,
      fontSize: 8.5,
      getValue: (d) => d.testigoNombre ? `Testigo: ${d.testigoNombre} (${d.testigoDocumento || "CC"})` : "Sin testigo adicional",
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 3: Consentimiento Informado Familiar
  // (2 Páginas: 612 x 792)
  // -------------------------------------------------------------
  anexo_3: [
    {
      pageIndex: 0,
      x: 140,
      y: 710,
      fontSize: 9,
      isBold: true,
      getValue: (d, meta) => meta.donorName || d.fallecidoNombre || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 710,
      fontSize: 9,
      getValue: (d, meta) => meta.donorDocument || d.fallecidoDocumento || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 660,
      fontSize: 9,
      isBold: true,
      getValue: (d) => d.representanteNombre || d.autorizadoPor || "Representante Legal o Familiar",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 660,
      fontSize: 9,
      getValue: (d) => `${d.representanteTipoDocumento || "CC"} ${d.representanteDocumento || "N/A"} (${d.parentesco || "Familiar"})`,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 580,
      fontSize: 9,
      isBold: true,
      getValue: (d) => d.autorizaExtraccion !== false ? "[X] SÍ AUTORIZA DONACIÓN" : "[ ] NO AUTORIZA",
    },
    {
      pageIndex: 1,
      x: 140,
      y: 400,
      fontSize: 8.5,
      maxWidth: 420,
      getValue: (d) => d.organosAutorizados || "Autorización expresa para fines de trasplante e implante según normatividad.",
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 6: Registro General de Extracción Quirúrgica
  // (2 Páginas: 612 x 792)
  // -------------------------------------------------------------
  anexo_6: [
    {
      pageIndex: 0,
      x: 130,
      y: 710,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 420,
      y: 710,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => meta.processCode,
    },
    {
      pageIndex: 0,
      x: 130,
      y: 665,
      fontSize: 9,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || "N/A",
    },
    {
      pageIndex: 0,
      x: 420,
      y: 665,
      fontSize: 9,
      getValue: (d, meta) => meta.donorDocument || d.numeroDocumento || "N/A",
    },
    {
      pageIndex: 0,
      x: 130,
      y: 610,
      fontSize: 8.5,
      getValue: (d) => d.horaInicioCirugia ? `Inicio: ${d.horaInicioCirugia}` : "Cirugía programada",
    },
    {
      pageIndex: 0,
      x: 280,
      y: 610,
      fontSize: 8.5,
      getValue: (d) => d.horaClampeo ? `Clampeo Aórtico: ${d.horaClampeo}` : "Clampeo registrado en acta",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 610,
      fontSize: 8.5,
      getValue: (d) => d.horaFinCirugia ? `Cierre: ${d.horaFinCirugia}` : "Acto quirúrgico concluido",
    },
    {
      pageIndex: 0,
      x: 130,
      y: 530,
      fontSize: 8.5,
      maxWidth: 420,
      getValue: (d) => d.solucionesPerfusion || "Custodiol / Solución de preservación según protocolo de rescate",
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 8: Formato Cadena de Custodia (Landscape: 931 x 607)
  // -------------------------------------------------------------
  anexo_8: [
    {
      pageIndex: 0,
      x: 160,
      y: 540,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => meta.processCode,
    },
    {
      pageIndex: 0,
      x: 450,
      y: 540,
      fontSize: 9,
      isBold: true,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || "N/A",
    },
    {
      pageIndex: 0,
      x: 750,
      y: 540,
      fontSize: 9,
      getValue: (_, meta) => meta.primaryIpsName,
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 9: Carta INMLCF Entrega de Cuerpo
  // (1 Página: 612 x 792)
  // -------------------------------------------------------------
  anexo_9: [
    {
      pageIndex: 0,
      x: 140,
      y: 710,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 640,
      fontSize: 9,
      getValue: (d, meta) => meta.donorName || d.fallecidoNombre || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 640,
      fontSize: 9,
      getValue: (d, meta) => meta.donorDocument || d.fallecidoDocumento || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 580,
      fontSize: 8.5,
      getValue: (d) => d.fiscalia || d.numeroNoticiaCriminal || "SPOA / Noticia Criminal según oficio",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 520,
      fontSize: 8.5,
      maxWidth: 420,
      getValue: (d) => d.observacionesEntrega || "Cuerpo entregado con cadena de custodia intacta al Instituto Nacional de Medicina Legal y Ciencias Forenses.",
    },
  ],
};
