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
      getValue: (d, meta) => d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName || "IPS Regional 3",
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
      getValue: (d, meta) => d.nombreDonante || d.donanteNombre || d.fallecidoNombre || d.nombresApellidos || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 845,
      fontSize: 9,
      getValue: (d, meta) => d.numeroIdentificacion || d.donanteDocumento || d.fallecidoDocumento || meta.donorDocument || "N/A",
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
      getValue: (d) => (d.glasgowScore !== undefined && d.glasgowScore !== null ? `Glasgow: ${d.glasgowScore}/15` : (d.glasgowIngreso ? `Glasgow: ${d.glasgowIngreso}/15` : "Glasgow: 3/15 (Midriasis bilateral)")),
    },
    // Servicio Hospitalario
    {
      pageIndex: 0,
      x: 140,
      y: 703,
      fontSize: 8.5,
      getValue: (d) => d.servicioHospitalario || d.servicioUbicacion || "UCI Adultos",
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
    // Página 2: Criterios clínicos, observaciones y firmas
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
      x: 130,
      y: 245,
      fontSize: 8.5,
      maxWidth: 440,
      getValue: (d) => d.observacionesAlerta || d.observaciones || "",
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
      getValue: (d, meta) => d.fallecidoNombre || d.nombreDonante || d.donanteNombre || d.nombresApellidos || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 710,
      fontSize: 9,
      getValue: (d, meta) => `${d.fallecidoTipoDocumento || d.tipoIdentificacion || "CC"}: ${d.fallecidoDocumento || d.numeroIdentificacion || d.donanteDocumento || meta.donorDocument || "N/A"}`,
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
      getValue: (d, meta) => d.fallecidoNombre || d.nombreDonante || d.donanteNombre || d.nombresApellidos || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 710,
      fontSize: 9,
      getValue: (d, meta) => d.fallecidoDocumento || d.numeroIdentificacion || d.donanteDocumento || meta.donorDocument || "N/A",
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
      getValue: (d, meta) => d.ipsGeneradora || d.institucionRemitente || d.nombreIps || meta.primaryIpsName || "IPS Red Regional 3",
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
      getValue: (d, meta) => d.nombreDonante || d.donanteNombre || d.fallecidoNombre || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 420,
      y: 665,
      fontSize: 9,
      getValue: (d, meta) => d.numeroDocumento || d.numeroIdentificacion || d.donanteDocumento || meta.donorDocument || "N/A",
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
      getValue: (d, meta) => d.nombreDonante || d.donanteNombre || d.fallecidoNombre || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 750,
      y: 540,
      fontSize: 9,
      getValue: (d, meta) => d.ipsGeneradora || d.institucionRemitente || d.nombreIps || meta.primaryIpsName || "IPS Regional 3",
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
      getValue: (d, meta) => d.ipsGeneradora || d.nombreIps || d.institucionRemitente || meta.primaryIpsName || "IPS Regional 3",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 640,
      fontSize: 9,
      getValue: (d, meta) => d.fallecidoNombre || d.nombreDonante || d.nombresApellidos || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 430,
      y: 640,
      fontSize: 9,
      getValue: (d, meta) => d.fallecidoDocumento || d.numeroIdentificacion || meta.donorDocument || "N/A",
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
    // =============================================================
    // PÁGINA 1: Identificación del Donante, Diagnóstico y Causa de Muerte
    // =============================================================
    {
      pageIndex: 0,
      x: 180,
      y: 876,
      fontSize: 8.5,
      isBold: true,
      getValue: (d, meta) => meta.rndCode || d.codigoConsultaRND || "RND-REG3-1805",
    },
    {
      pageIndex: 0,
      x: 360,
      y: 876,
      fontSize: 8,
      getValue: (d, meta) => d.fechaOferta || new Date(meta.generatedAt).toLocaleDateString("es-CO"),
    },
    {
      pageIndex: 0,
      x: 510,
      y: 876,
      fontSize: 8,
      getValue: (d, meta) => d.horaOferta || new Date(meta.generatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    },
    {
      pageIndex: 0,
      x: 180,
      y: 842,
      fontSize: 8,
      isBold: true,
      getValue: (d, meta) => meta.generatedByName || d.medicoCoordinador || "Coordinador Operativo Red Regional 3",
    },
    {
      pageIndex: 0,
      x: 440,
      y: 842,
      fontSize: 8,
      getValue: (d) => d.regionalGeneradora || "Regional 3 (Suroccidente)",
    },
    {
      pageIndex: 0,
      x: 335,
      y: 795,
      fontSize: 8,
      isBold: true,
      maxWidth: 240,
      getValue: (d, meta) => d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName || "IPS Red Regional 3",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 777,
      fontSize: 8,
      isBold: true,
      maxWidth: 150,
      getValue: (d, meta) => d.donanteNombre || d.nombreDonante || d.nombresApellidos || meta.donorName || "Donante Fallecido",
    },
    {
      pageIndex: 0,
      x: 295,
      y: 777,
      fontSize: 8,
      getValue: (d, meta) => `${d.donanteTipoDocumento || d.tipoIdentificacion || "CC"} ${d.donanteDocumento || d.numeroIdentificacion || meta.donorDocument || "N/A"}`,
    },
    {
      pageIndex: 0,
      x: 435,
      y: 777,
      fontSize: 8,
      getValue: (d) => `${d.edad || d.donanteEdad || "35"}`,
    },
    {
      pageIndex: 0,
      x: 545,
      y: 777,
      fontSize: 7.5,
      getValue: (d) => d.nacionalidad || "Colombiana",
    },
    {
      pageIndex: 0,
      x: 320,
      y: 760,
      fontSize: 8,
      getValue: (d) => d.sexo || d.donanteSexo || "MASCULINO",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 760,
      fontSize: 7.5,
      getValue: (d) => d.tipoConsentimiento || "Presunción Legal (Ley 1805/2016)",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 724,
      fontSize: 7.5,
      getValue: (d, meta) => d.fechaLegalizacion || new Date(meta.generatedAt).toLocaleString("es-CO"),
    },
    {
      pageIndex: 0,
      x: 300,
      y: 730,
      fontSize: 7.5,
      getValue: (d) => d.etnia || "Mestizo",
    },
    {
      pageIndex: 0,
      x: 480,
      y: 698,
      fontSize: 8.5,
      isBold: true,
      getValue: (d) => d.grupoSanguineo || d.abo || "O",
    },
    {
      pageIndex: 0,
      x: 555,
      y: 698,
      fontSize: 8.5,
      isBold: true,
      getValue: (d) => d.factorRh || d.rh || "POSITIVO (+)",
    },
    {
      pageIndex: 0,
      x: 330,
      y: 703,
      fontSize: 8,
      getValue: (d) => `${d.glasgowIngreso || "3"}/15`,
    },
    {
      pageIndex: 0,
      x: 415,
      y: 688,
      fontSize: 7.5,
      getValue: (d) => `${d.glasgowAlerta || "3"}/15`,
    },
    {
      pageIndex: 0,
      x: 140,
      y: 676,
      fontSize: 7.5,
      getValue: (d) => d.fechaIngresoIps || "HC IPS",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 641,
      fontSize: 7.5,
      getValue: (d) => d.servicioHospitalario || "UCI Adultos",
    },
    {
      pageIndex: 0,
      x: 395,
      y: 640,
      fontSize: 7.5,
      getValue: (d) => (d.remitido ? "SÍ" : "NO"),
    },
    {
      pageIndex: 0,
      x: 565,
      y: 640,
      fontSize: 7.5,
      getValue: (d) => `${d.estanciaHospitalaria || "3"}`,
    },
    {
      pageIndex: 0,
      x: 280,
      y: 598,
      fontSize: 7.5,
      maxWidth: 290,
      getValue: (d) => d.observacionesMuerte || "Diagnóstico clínico de muerte encefálica conforme a Decreto 2493/2004 y Res. 2640/2005",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 585,
      fontSize: 7.5,
      getValue: (d) => d.primerMedicoDx || "Médico Tratante UCI",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 563,
      fontSize: 7.5,
      getValue: (d) => d.segundoMedicoDx || "Médico Neurólogo",
    },
    {
      pageIndex: 0,
      x: 270,
      y: 501,
      fontSize: 8,
      maxWidth: 300,
      getValue: (d) => d.causaMuerteEncefalica || d.causaMuerte || "Trauma Craneoencefálico Severo / Hemorragia Intracraneal espontánea",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 427,
      fontSize: 7.5,
      maxWidth: 180,
      getValue: (d) => d.testApnea || "Positivo: pH 7.25, PaO2 110, PaCO2 64 mmHg sin esfuerzo respiratorio",
    },
    {
      pageIndex: 0,
      x: 334,
      y: 424,
      fontSize: 7.5,
      maxWidth: 240,
      getValue: (d) => d.pruebaFlujo || "Doppler Transcraneal: Ausencia de flujo diastólico / Espigas sistólicas",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 396,
      fontSize: 7.5,
      maxWidth: 430,
      getValue: (d) => d.eeg || "Electroencefalograma: Silencio eléctrico cerebral confirmado bilateralmente",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 351,
      fontSize: 7.5,
      maxWidth: 135,
      getValue: (d) => d.antecedentesPatologicos || "Negativos para neoplasias o infección crónica",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 351,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.antecedentesFamiliares || "No significativos",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 324,
      fontSize: 7.5,
      maxWidth: 135,
      getValue: (d) => d.antecedentesQuirurgicos || "Apendicectomía previa",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 324,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.antecedentesToxicos || "Negativos",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 296,
      fontSize: 7.5,
      maxWidth: 135,
      getValue: (d) => d.antecedentesFarmacologicos || "Soporte UCI",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 296,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.antecedentesInmunologicos || "Negativos",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 268,
      fontSize: 7.5,
      maxWidth: 135,
      getValue: (d) => d.antecedentesTraumaticos || "Politraumatismo / TEC",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 268,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.antecedentesHospitalarios || "Ingreso actual UCI",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 232,
      fontSize: 7.5,
      maxWidth: 135,
      getValue: (d) => d.antecedentesInfecciosos || "Sin foco infeccioso activo",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 232,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.tabaquismoAlcohol || "Ocasional / Sin daño orgánico",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 206,
      fontSize: 7.5,
      getValue: (d) => d.fiebreManejo || "Afebril con medios físicos",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 206,
      fontSize: 7.5,
      getValue: (d) => d.hipotensionManejo || "Estable con vasoactivo baja dosis",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 170,
      fontSize: 7.5,
      getValue: (d) => d.rcpManejo || "No requirió RCP previa",
    },
    {
      pageIndex: 0,
      x: 380,
      y: 170,
      fontSize: 7.5,
      getValue: (d) => d.infeccionManejo || "Profilaxis antibiótica estándar",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 128,
      fontSize: 7.5,
      maxWidth: 430,
      getValue: (d) => d.intervencionesQx || "Cateterismo venoso central, línea arterial, intubación orotraqueal",
    },

    // =============================================================
    // PÁGINA 2: Examen Físico, Signos Vitales, Manejo y Laboratorios
    // =============================================================
    {
      pageIndex: 1,
      x: 90,
      y: 856,
      fontSize: 8,
      getValue: (d) => `${d.peso || "72"}`,
    },
    {
      pageIndex: 1,
      x: 190,
      y: 856,
      fontSize: 8,
      getValue: (d) => `${d.talla || "172"}`,
    },
    {
      pageIndex: 1,
      x: 300,
      y: 856,
      fontSize: 8,
      getValue: (d) => `${d.perimetroAbdominal || "84"}`,
    },
    {
      pageIndex: 1,
      x: 410,
      y: 856,
      fontSize: 8,
      getValue: (d) => `${d.perimetroToracico || "96"}`,
    },
    {
      pageIndex: 1,
      x: 530,
      y: 856,
      fontSize: 8,
      getValue: (d) => `${d.imc || "24.3"}`,
    },
    {
      pageIndex: 1,
      x: 220,
      y: 829,
      fontSize: 7.5,
      getValue: (d) => d.tatuajesPiercing || "NO",
    },
    {
      pageIndex: 1,
      x: 380,
      y: 834,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.observacionesFisico || "Adecuado estado general para rescate",
    },
    {
      pageIndex: 1,
      x: 65,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.tensionArterial || "115/75"}`,
    },
    {
      pageIndex: 1,
      x: 140,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.presionArterialMedia || "78"}`,
    },
    {
      pageIndex: 1,
      x: 215,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.frecuenciaCardiaca || "82"}`,
    },
    {
      pageIndex: 1,
      x: 295,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.frecuenciaRespiratoria || "16"}`,
    },
    {
      pageIndex: 1,
      x: 380,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.temperatura || "36.6"}`,
    },
    {
      pageIndex: 1,
      x: 455,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.saturacionOxigeno || "99"}`,
    },
    {
      pageIndex: 1,
      x: 535,
      y: 794,
      fontSize: 7.5,
      getValue: (d) => `${d.diuresisHoraria || "1.2"}`,
    },
    {
      pageIndex: 1,
      x: 120,
      y: 728,
      fontSize: 7.5,
      getValue: (d) => `${d.ventilacionMecanica || "48 horas"}`,
    },
    {
      pageIndex: 1,
      x: 220,
      y: 728,
      fontSize: 7.5,
      getValue: (d) => (d.lineaArterial !== false ? "SÍ" : "NO"),
    },
    {
      pageIndex: 1,
      x: 370,
      y: 729,
      fontSize: 7.5,
      getValue: (d) => d.nutricionEnteral || "Suspendida",
    },
    {
      pageIndex: 1,
      x: 525,
      y: 729,
      fontSize: 7.5,
      getValue: (d) => d.nutricionParenteral || "NO",
    },
    {
      pageIndex: 1,
      x: 120,
      y: 679,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.balanceLiquidos || "Ingresos: 2800 cc · Egresos: 2650 cc · Balance: +150 cc",
    },
    {
      pageIndex: 1,
      x: 180,
      y: 645,
      fontSize: 7.5,
      getValue: (d) => d.presionCuna || "12 mmHg",
    },
    {
      pageIndex: 1,
      x: 420,
      y: 645,
      fontSize: 7.5,
      getValue: (d) => d.cvc || "Subclavio derecho normoposicionado",
    },
    {
      pageIndex: 1,
      x: 180,
      y: 609,
      fontSize: 7.5,
      maxWidth: 390,
      getValue: (d) => d.liquidosEndovenosos || "Lactato de Ringer 80 cc/h + Dextrosa 5% según glucemias",
    },
    {
      pageIndex: 1,
      x: 200,
      y: 577,
      fontSize: 7.5,
      maxWidth: 370,
      getValue: (d) => d.transfusiones || "NO transfundido (Sin dilución serológica)",
    },
    {
      pageIndex: 1,
      x: 140,
      y: 551,
      fontSize: 7.5,
      maxWidth: 430,
      getValue: (d) => d.observacionesManejo || "Metas hemodinámicas y electrolíticas de mantenimiento cumplidas",
    },
    {
      pageIndex: 1,
      x: 60,
      y: 499,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.med1 || "Noradrenalina: 0.05 mcg/kg/min (mantenimiento TAM > 70 mmHg)",
    },
    {
      pageIndex: 1,
      x: 60,
      y: 486,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.med2 || "Vasopresina: 0.02 UI/min",
    },
    {
      pageIndex: 1,
      x: 60,
      y: 472,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.med3 || "Levotiroxina: 200 mcg SNG (Protocolo de sustitución hormonal)",
    },
    {
      pageIndex: 1,
      x: 60,
      y: 459,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.med4 || "Metilprednisolona: 15 mg/kg IV",
    },
    {
      pageIndex: 1,
      x: 90,
      y: 402,
      fontSize: 7.5,
      maxWidth: 180,
      getValue: (d) => d.rxTorax || "Campos pulmonares limpios, silueta cardíaca normal",
    },
    {
      pageIndex: 1,
      x: 350,
      y: 402,
      fontSize: 7.5,
      maxWidth: 220,
      getValue: (d) => d.ecoAbdominal || "Hígado y riñones normales sin esteatosis ni litiasis",
    },
    {
      pageIndex: 1,
      x: 70,
      y: 381,
      fontSize: 7.5,
      maxWidth: 190,
      getValue: (d) => d.ecg || "Ritmo sinusal regular sin isquemia",
    },
    {
      pageIndex: 1,
      x: 350,
      y: 381,
      fontSize: 7.5,
      maxWidth: 220,
      getValue: (d) => d.ecocardiograma || "Ventrículo no dilatado, función global conservada",
    },
    {
      pageIndex: 1,
      x: 330,
      y: 356,
      fontSize: 8,
      isBold: true,
      getValue: (d) => `${d.fevi || "62"}%`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 278,
      fontSize: 7.5,
      getValue: (d) => `${d.hemoglobina || "13.2"} g/dL`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 260,
      fontSize: 7.5,
      getValue: (d) => `${d.hematocrito || "40.5"}%`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 243,
      fontSize: 7.5,
      getValue: (d) => `${d.leucocitos || "10200"}`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 120,
      fontSize: 7.5,
      getValue: (d) => `${d.plaquetas || "235000"}`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 278,
      fontSize: 7.5,
      getValue: (d) => `${d.creatinina || "0.85"} mg/dL`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 260,
      fontSize: 7.5,
      getValue: (d) => `${d.bun || "15"} mg/dL`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 243,
      fontSize: 7.5,
      getValue: (d) => `${d.alt || "28"} U/L`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 227,
      fontSize: 7.5,
      getValue: (d) => `${d.ast || "24"} U/L`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 209,
      fontSize: 7.5,
      getValue: (d) => `${d.bilirrubinaTotal || "0.7"} mg/dL`,
    },
    {
      pageIndex: 1,
      x: 280,
      y: 137,
      fontSize: 7.5,
      getValue: (d) => `${d.glicemia || "128"} mg/dL`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 278,
      fontSize: 7.5,
      getValue: (d) => `${d.ph || "7.38"}`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 260,
      fontSize: 7.5,
      getValue: (d) => `${d.pco2 || "38"} mmHg`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 243,
      fontSize: 7.5,
      getValue: (d) => `${d.po2 || "102"} mmHg`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 168,
      fontSize: 7.5,
      getValue: (d) => `${d.pt || "12.4"} s`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 154,
      fontSize: 7.5,
      getValue: (d) => `${d.ptt || "29.8"} s`,
    },
    {
      pageIndex: 1,
      x: 460,
      y: 137,
      fontSize: 7.5,
      getValue: (d) => `${d.inr || "1.02"}`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 86,
      fontSize: 7.5,
      getValue: (d) => `${d.sodio || "142"} mEq/L`,
    },
    {
      pageIndex: 1,
      x: 90,
      y: 69,
      fontSize: 7.5,
      getValue: (d) => `${d.potasio || "4.1"} mEq/L`,
    },

    // =============================================================
    // PÁGINA 3: Serología Infecciosa, HLA, Antecedentes Sociales y Epidemiológicos
    // =============================================================
    {
      pageIndex: 2,
      x: 90,
      y: 878,
      fontSize: 7.5,
      getValue: (d) => `${d.cloro || "104"} mEq/L`,
    },
    {
      pageIndex: 2,
      x: 280,
      y: 878,
      fontSize: 7.5,
      getValue: (d) => `${d.fosfatasaAlcalina || "75"} U/L`,
    },
    {
      pageIndex: 2,
      x: 515,
      y: 877,
      fontSize: 7.5,
      getValue: (d) => d.cultivos || "Negativos",
    },
    {
      pageIndex: 2,
      x: 90,
      y: 861,
      fontSize: 7.5,
      getValue: (d) => `${d.calcio || "9.1"} mg/dL`,
    },
    {
      pageIndex: 2,
      x: 280,
      y: 861,
      fontSize: 7.5,
      getValue: (d) => `${d.albumina || "4.0"} g/dL`,
    },
    {
      pageIndex: 2,
      x: 90,
      y: 844,
      fontSize: 7.5,
      getValue: (d) => `${d.lactato || "1.4"} mmol/L`,
    },
    {
      pageIndex: 2,
      x: 280,
      y: 844,
      fontSize: 7.5,
      getValue: (d) => `${d.troponina || "0.01"} ng/mL`,
    },
    {
      pageIndex: 2,
      x: 120,
      y: 830,
      fontSize: 7.5,
      maxWidth: 450,
      getValue: (d) => d.observacionesLaboratorio || "Laboratorios en rangos de viabilidad para rescate multiorgánico",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 760,
      fontSize: 7.5,
      isBold: true,
      getValue: (d) => d.serologiaVhc || d.hvc || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 760,
      fontSize: 7.5,
      isBold: true,
      getValue: (d) => d.serologiaChagas || d.chagas || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 751,
      fontSize: 7.5,
      isBold: true,
      getValue: (d) => d.serologiaHbsag || d.hbsag || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 751,
      fontSize: 7.5,
      isBold: true,
      getValue: (d) => d.serologiaSifilis || d.sifilis || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 737,
      fontSize: 7.5,
      getValue: (d) => d.hbausab || "POSITIVO (>10 UI/L)",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 737,
      fontSize: 7.5,
      isBold: true,
      getValue: (d) => d.serologiaVih || d.vih || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 727,
      fontSize: 7.5,
      getValue: (d) => d.hbcTotal || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 727,
      fontSize: 7.5,
      getValue: (d) => d.toxoIgg || "Positivo (Memoria)",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 715,
      fontSize: 7.5,
      getValue: (d) => d.hbcIgg || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 715,
      fontSize: 7.5,
      getValue: (d) => d.toxoIgm || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 704,
      fontSize: 7.5,
      getValue: (d) => d.hbcIgm || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 704,
      fontSize: 7.5,
      getValue: (d) => d.htlv || "NO REACTIVO",
    },
    {
      pageIndex: 2,
      x: 180,
      y: 692,
      fontSize: 7.5,
      getValue: (d) => d.cmvIgg || "Positivo",
    },
    {
      pageIndex: 2,
      x: 420,
      y: 681,
      fontSize: 7.5,
      getValue: (d) => d.ebv || "Positivo IgG / Negativo IgM",
    },
    {
      pageIndex: 2,
      x: 70,
      y: 633,
      fontSize: 7.5,
      getValue: (d) => d.hlaA || "02, 24",
    },
    {
      pageIndex: 2,
      x: 200,
      y: 633,
      fontSize: 7.5,
      getValue: (d) => d.hlaB || "07, 35",
    },
    {
      pageIndex: 2,
      x: 340,
      y: 633,
      fontSize: 7.5,
      getValue: (d) => d.hlaDr || "04, 15",
    },
    {
      pageIndex: 2,
      x: 480,
      y: 633,
      fontSize: 7.5,
      getValue: (d) => d.hlaDq || "03, 06",
    },
    {
      pageIndex: 2,
      x: 140,
      y: 574,
      fontSize: 7.5,
      getValue: (d) => d.escolaridad || "Universitaria",
    },
    {
      pageIndex: 2,
      x: 140,
      y: 560,
      fontSize: 7.5,
      getValue: (d) => d.estadoCivil || "Soltero",
    },
    {
      pageIndex: 2,
      x: 100,
      y: 546,
      fontSize: 7.5,
      getValue: (d) => d.ocupacion || "Empleado",
    },
    {
      pageIndex: 2,
      x: 410,
      y: 546,
      fontSize: 7.5,
      getValue: (d) => `${d.numeroHijos || "0"}`,
    },
    {
      pageIndex: 2,
      x: 140,
      y: 531,
      fontSize: 7.5,
      getValue: (d) => `${d.estrato || "3"}`,
    },
    {
      pageIndex: 2,
      x: 140,
      y: 518,
      fontSize: 7.5,
      getValue: (d) => d.procedencia || "Urbana",
    },
    {
      pageIndex: 2,
      x: 120,
      y: 504,
      fontSize: 7.5,
      getValue: (d) => d.religion || "Sin objeción",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 477,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 464,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 450,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 435,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 420,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 363,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 485,
      y: 277,
      fontSize: 7.5,
      getValue: () => "NO",
    },
    {
      pageIndex: 2,
      x: 77,
      y: 175,
      fontSize: 7.5,
      maxWidth: 490,
      getValue: (d) => d.lesionesCuerpo || "Inspección corporal normal. Ausencia de estigmas traumáticos mayores o signos de venopunción de riesgo",
    },

    // =============================================================
    // PÁGINA 4: Oferta Anatómica, Asignación y Cierre Operativo
    // =============================================================
    {
      pageIndex: 3,
      x: 78,
      y: 650,
      fontSize: 8,
      maxWidth: 480,
      getValue: (d) =>
        d.ofertaComponentes ||
        "OFERTA MULTIORGÁNICA Y TEJIDOS: Corazón, Pulmones, Hígado, Riñón Derecho, Riñón Izquierdo, Páncreas, Córneas (AO), Tejido Osteomuscular y Tejido Cutáneo. Donante multiorgánico efectivo.",
    },
    {
      pageIndex: 3,
      x: 78,
      y: 534,
      fontSize: 8,
      maxWidth: 480,
      getValue: (d) =>
        d.asignacionIps ||
        "ASIGNACIÓN IPS TRASPLANTADORAS: Asignación efectuada conforme a lista de espera única nacional INS, criterios de compatibilidad histológica e isquemia fría. Receptores confirmados.",
    },
    {
      pageIndex: 3,
      x: 78,
      y: 460,
      fontSize: 7.5,
      maxWidth: 480,
      getValue: (d) =>
        d.observacionesGenerales ||
        "Observaciones: Proceso coordinado en tiempo real en GODT Regional 3, con trazabilidad documental íntegra según normas de la Coordinación Nacional de Donación y Trasplantes.",
    },
    {
      pageIndex: 3,
      x: 200,
      y: 412,
      fontSize: 8.5,
      isBold: true,
      getValue: (_, meta) => meta.generatedByName || "Médico Coordinador Operativo Red Regional 3",
    },
    {
      pageIndex: 3,
      x: 200,
      y: 390,
      fontSize: 8,
      getValue: (d, meta) => `${d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName} · Coordinación Operativa`,
    },
    {
      pageIndex: 3,
      x: 200,
      y: 368,
      fontSize: 7.5,
      getValue: (_, meta) => `Legalización: ${new Date(meta.generatedAt).toLocaleString("es-CO")}`,
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
      getValue: (d, meta) => d.nombreDonante || d.donanteNombre || d.fallecidoNombre || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 140,
      y: 655,
      fontSize: 8.5,
      getValue: (d, meta) => d.numeroIdentificacion || d.donanteDocumento || meta.donorDocument || "N/A",
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
      getValue: (d, meta) => d.ipsGeneradora || d.nombreIps || meta.primaryIpsName,
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
      getValue: (d, meta) => d.ipsGeneradora || d.nombreIps || meta.primaryIpsName,
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
      getValue: (d, meta) => d.donanteNombre || d.nombreDonante || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || meta.primaryIpsName,
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
      getValue: (d, meta) => d.donanteNombre || d.nombreDonante || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || meta.primaryIpsName,
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
      getValue: (d, meta) => d.donanteNombre || d.nombreDonante || meta.donorName || "N/A",
    },
    {
      pageIndex: 0,
      x: 180,
      y: 640,
      fontSize: 8.5,
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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
      getValue: (d, meta) => d.nombreIps || d.ipsGeneradora || d.institucionRemitente || meta.primaryIpsName,
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

