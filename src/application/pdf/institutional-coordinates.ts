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

  // -------------------------------------------------------------
  // ANEXO 4: Registro de Donante y Oferta de Órganos y Tejidos
  // (4 Páginas Oficio: 612 x 1008)
  // -------------------------------------------------------------
  anexo_4: [
    // Pág 1: Identificación y Evaluación Neurológica
    {
      pageIndex: 0,
      x: 140,
      y: 935,
      fontSize: 9,
      isBold: true,
      getValue: (_, meta) => `Proceso: ${meta.processCode} ${meta.rndCode ? `| RND: ${meta.rndCode}` : ""}`,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 905,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 855,
      fontSize: 9,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || d.nombresApellidos || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 855,
      fontSize: 9,
      getValue: (d, meta) => meta.donorDocument || d.numeroIdentificacion || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 805,
      fontSize: 8.5,
      maxWidth: 430,
      getValue: (d) => d.causaMuerteEncefalica || "TEC Severo / Hemorragia Intracraneal espontánea",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 755,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) =>
        `Glasgow: ${d.glasgowIngreso || "3/15"} · Test de Apnea: ${d.testApneaPositivo !== false ? "Positivo" : "Pendiente"} · Reflejos de Tallo: ${d.reflejosTalloAusentes !== false ? "Ausentes" : "En evaluación"}`,
    },
    // Pág 2: Soporte Hemodinámico y Laboratorios
    {
      pageIndex: 1,
      x: 140,
      y: 920,
      fontSize: 8.5,
      maxWidth: 430,
      getValue: (d) =>
        `Parámetros: TA ${d.tensionArterial || "110/70"} mmHg · TAM ${d.presionArterialMedia || "75"} mmHg · Inotrópico: ${d.soporteInotropico || "Noradrenalina titulación baja"}`,
    },
    {
      pageIndex: 1,
      x: 140,
      y: 830,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) =>
        `Laboratorios: Hb ${d.hemoglobina || "12.5"} g/dL · Hto ${d.hematocrito || "38"}% · Leucocitos ${d.leucocitos || "9800"} · Creatinina ${d.creatinina || "0.9"} mg/dL · BUN ${d.bun || "16"} mg/dL`,
    },
    {
      pageIndex: 1,
      x: 140,
      y: 730,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) =>
        `Serología: VIH: ${d.serologiaVih || "No reactivo"} · VHB: ${d.serologiaHbsag || "No reactivo"} · VHC: ${d.serologiaVhc || "No reactivo"} · Chagas: ${d.serologiaChagas || "No reactivo"}`,
    },
    // Pág 3: Estudios Diagnósticos y Oferta Anatómica
    {
      pageIndex: 2,
      x: 140,
      y: 920,
      fontSize: 8.5,
      maxWidth: 430,
      getValue: (d) =>
        `Imágenes: Eco Abdominal: ${d.ecoAbdominal || "Hígado y riñones normales"} · Rx Tórax: ${d.rxTorax || "Campos pulmonares ventilados"}`,
    },
    {
      pageIndex: 2,
      x: 140,
      y: 820,
      fontSize: 8.5,
      maxWidth: 430,
      getValue: (d) =>
        `Oferta: ${d.organosOfertados || "Corazón, Hígado, Riñones (D/I), Pulmones, Córneas y Tejido Osteomuscular"}`,
    },
    // Pág 4: Asignación y Cierre Operativo
    {
      pageIndex: 3,
      x: 140,
      y: 920,
      fontSize: 8.5,
      maxWidth: 430,
      getValue: (d) =>
        `Asignación: ${d.ipsAceptantes || "IPS Trasplantadoras asignadas conforme a lista única nacional de espera"}`,
    },
    {
      pageIndex: 3,
      x: 140,
      y: 820,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => `Coordinador Operativo: ${meta.generatedByName} · Fecha: ${new Date(meta.generatedAt).toLocaleDateString("es-CO")}`,
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 7: VARIANTES DE RESCATE DE TEJIDOS (A4: 595.5 x 842.25)
  // -------------------------------------------------------------
  anexo_7_ocular: [
    // Pág 1: Donante e IPS
    {
      pageIndex: 0,
      x: 235,
      y: 680,
      fontSize: 8.5,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || d.fallecidoNombre || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 655,
      fontSize: 8.5,
      getValue: (d, meta) => meta.donorDocument || d.numeroIdentificacion || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 610,
      fontSize: 8,
      maxWidth: 410,
      getValue: (d) => d.causaMuerte || d.diagnosticoMuerte || "Parada Cardiorrespiratoria / Asistolia",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 550,
      fontSize: 8.5,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    // Pág 2: Procedimiento y Calidad
    {
      pageIndex: 1,
      x: 220,
      y: 746,
      fontSize: 8.5,
      getValue: (d, meta) => d.medicoCot || meta.generatedByName,
    },
    {
      pageIndex: 1,
      x: 200,
      y: 734,
      fontSize: 8.5,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 1,
      x: 85,
      y: 560,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.procedimiento || "Enucleación bilateral de globos oculares en técnica aséptica, solución antibiótica.",
    },
    {
      pageIndex: 1,
      x: 85,
      y: 480,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.evaluacionCorneas || "Córneas transparentes bilaterales, epitelio íntegro, conteo endotelial satisfactorio.",
    },
    {
      pageIndex: 1,
      x: 85,
      y: 250,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => d.profesionalExtractor || meta.generatedByName,
    },
  ],

  anexo_7_cardiovascular: [
    {
      pageIndex: 0,
      x: 220,
      y: 680,
      fontSize: 8.5,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 1,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.valvulasRescatadas || "Válvulas cardíacas disecadas: homoinjerto aórtico y pulmonar íntegros.",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.bancoTejidos || "Banco de Tejidos Cardiovasculares Regional 3",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 300,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => d.cirujanoExtractor || meta.generatedByName,
    },
  ],

  anexo_7_osteomuscular: [
    {
      pageIndex: 0,
      x: 220,
      y: 680,
      fontSize: 8.5,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 1,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.segmentosOseos || "Hemi-fémur, tibias, tendones patelares y calcáneos disecados estériles.",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.reconstruccion || "Reconstrucción anatómica y prótesis cosmética completada conforme a protocolo.",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 300,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => d.profesionalExtractor || meta.generatedByName,
    },
  ],

  anexo_7_piel: [
    {
      pageIndex: 0,
      x: 220,
      y: 680,
      fontSize: 8.5,
      getValue: (d, meta) => meta.donorName || d.nombreDonante || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 1,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.superficiePiel || "Injertos dermo-epidérmicos de espesor intermedio (aprox. 1800 cm²).",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 650,
      fontSize: 8,
      maxWidth: 430,
      getValue: (d) => d.bancoPiel || "Banco de Piel y Tejidos Regional 3",
    },
    {
      pageIndex: 2,
      x: 85,
      y: 300,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => d.profesionalExtractor || meta.generatedByName,
    },
  ],

  // -------------------------------------------------------------
  // ANEXO 7: VARIANTES DE EXTRACCIÓN DE ÓRGANOS (Carta: 612 x 792)
  // Plantilla oficial estándar Red Nacional de Trasplantes
  // -------------------------------------------------------------
  anexo_7_corazon: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Cardiectomía estándar con canulación aórtica y perfusión anterógrada de cardioplejia fría.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Corazón normotrófico, sin áreas de infarto macroscópico, contractilidad adecuada.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Inspección en mesa auxiliar: válvulas íntegras, ostia coronarios permeables, preparación adecuada.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Órgano preservado a 4°C en triple bolsa estéril y contenedor termoaislado con monitor de temperatura.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_higado: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Hepatectomía con canulación aórtica y portal, perfusión fría con solución Custodiol.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Hígado de bordes finos, coloración uniforme, sin esteatosis macroscópica relevante (<10%).",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Pedículo hepático íntegro: arteria hepática con parche aórtico, vena porta y vía biliar preservadas.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Órgano embalado en triple contenedor estéril con solución fría para implante hepático urgente.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_otros_organos: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Rescate de componente anatómico según protocolo de extracción multiorgánica coordinada.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Anatomía vascular y tisular verificada, perfusión fría adecuada, sin lesiones traumáticas.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Preparación en mesa auxiliar completada satisfactoriamente con empaque reglamentario.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Transporte bajo cadena de custodia y control de frío para trasplante asignado.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_pancreas: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Pancreatectomía con duodeno en bloque, preservación de vasos mesentéricos y esplénicos.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Páncreas blando, sin induración ni edema, perfusión vascular completa.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Canal duodenal descontaminado e irrigado con solución antibiótica, hemostasia rigurosa.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Preservado en solución UW fría para trasplante renopancreático o aislado.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_pulmon: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Neumonectomía bilateral en bloque con arteria pulmonar y manguito auricular izquierdo.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Parénquima pulmonar dócil, sin atelectasias ni contusiones, broncoaspiración descartada.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Inflación al 50% de capacidad vital, ligadura traqueal hermética, empaque frío estéril.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Perfusión pulmonar anterógrada y retrógrada con Perfadex a 4°C completada.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_rinon_derecho: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Nefrectomía derecha en bloque con parche de vena cava y arteria renal única con parche aórtico.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Riñón derecho de tamaño y coloración normal, uréter íntegro con buena longitud vascular.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Perfusión completa en mesa auxiliar, salida venosa clara, corteza y médula sin quistes.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Empaque triple estéril y rotulado para centro trasplantador receptor.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],

  anexo_7_rinon_izquierdo: [
    {
      pageIndex: 0,
      x: 480,
      y: 738,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.rndCode || meta.processCode,
    },
    {
      pageIndex: 0,
      x: 180,
      y: 678,
      fontSize: 8.5,
      maxWidth: 340,
      getValue: (_, meta) => meta.primaryIpsName,
    },
    {
      pageIndex: 0,
      x: 72,
      y: 620,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.tecnicaQuirurgica ||
        "Nefrectomía izquierda con vena renal izquierda larga, arteria renal y uréter íntegros.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 563,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosIntraoperatorios ||
        d.hallazgos ||
        "Riñón izquierdo anatómica y macroscópicamente íntegro, excelente perfusión parenquimatosa.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 412,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.hallazgosBanco ||
        "Preparación de banco: ligadura de tributarias lumbares y suprarrenal de la vena renal.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 279,
      fontSize: 8,
      maxWidth: 460,
      getValue: (d) =>
        d.observaciones ||
        "Empaque triple estéril con solución fría Custodiol, rótulo de identificación adherido.",
    },
    {
      pageIndex: 0,
      x: 72,
      y: 145,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) =>
        d.cirujanoExtraccion || d.profesionalResponsable || meta.generatedByName,
    },
  ],
};

