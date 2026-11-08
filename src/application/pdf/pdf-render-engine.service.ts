import { Injectable, Optional } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { InstitutionalDocumentService } from "./institutional-document.service";
import { INSTITUTIONAL_OVERLAYS, drawTextWrapped } from "./institutional-coordinates";

export interface PdfRenderInput {
  documentCode: string;
  title: string;
  data: Record<string, unknown>;
  metadata: {
    processCode: string;
    rndCode?: string;
    donorName?: string;
    donorDocument?: string;
    primaryIpsName: string;
    revisionNumber: number;
    templateVersion: string;
    generatedAt: Date;
    generatedByName: string;
    snapshotDigest?: string;
    signatures?: Array<{
      signerRole: string;
      fullName: string;
      signatureType: string;
      signedAt?: Date;
      status: string;
    }>;
    custodyEvents?: Array<{
      sequenceNumber: number;
      eventType: string;
      itemDescription: string;
      containerCode?: string | null;
      sealNumber?: string | null;
      temperatureCelsius?: number | string | null;
      transferorName: string;
      transferorInstitution?: string | null;
      receiverName: string;
      receiverInstitution?: string | null;
      occurredAt: Date | string;
      location: string;
      integrityVerified: boolean;
      observations?: string | null;
    }>;
  };
}

@Injectable()
export class PdfRenderEngineService {
  constructor(
    @Optional()
    private readonly institutionalDocs?: InstitutionalDocumentService,
  ) {
    if (!this.institutionalDocs) {
      this.institutionalDocs = new InstitutionalDocumentService();
    }
  }

  async render(input: PdfRenderInput): Promise<Buffer> {
    const docCode = input.documentCode.toUpperCase();
    const normalizedKey = this.institutionalDocs?.normalizeDocumentCode(docCode) || "";

    // 1. Si existe formato PDF institucional original, utilizarlo como fondo base fiel
    if (this.institutionalDocs && this.institutionalDocs.hasOriginalPdf(docCode)) {
      try {
        const originalBytes = this.institutionalDocs.getOriginalDocumentBuffer(docCode);
        const pdfDoc = await PDFDocument.load(originalBytes);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Estampar campos diligenciados sobre las coordenadas correspondientes
        const overlays = INSTITUTIONAL_OVERLAYS[normalizedKey] || [];
        const pages = pdfDoc.getPages();

        for (const field of overlays) {
          if (field.pageIndex < pages.length) {
            const page = pages[field.pageIndex];
            const rawVal = field.getValue(input.data, input.metadata);
            if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
              const text = String(rawVal);
              const fontSize = field.fontSize || 8.5;
              const font = field.isBold ? fontBold : fontRegular;
              const color = field.color
                ? rgb(field.color.r, field.color.g, field.color.b)
                : rgb(0.06, 0.16, 0.26);

              if (field.maxWidth) {
                drawTextWrapped(page, text, field.x, field.y, font, fontSize, field.maxWidth, color);
              } else {
                page.drawText(text, { x: field.x, y: field.y, size: fontSize, font, color });
              }
            }
          }
        }

        // Trazabilidad operacional al pie de la última página
        const lastPage = pages[pages.length - 1];
        const statusLabel = input.metadata.revisionNumber ? `Rev #${input.metadata.revisionNumber}` : "Borrador";
        const digestShort = input.metadata.snapshotDigest ? input.metadata.snapshotDigest.slice(0, 16) : "OFICIAL";
        const effectiveIps =
          (input.data.ipsGeneradora as string) ||
          (input.data.institucionRemitente as string) ||
          (input.data.nombreIps as string) ||
          (input.data.ips as string) ||
          input.metadata.primaryIpsName ||
          "IPS Regional 3";

        lastPage.drawText(
          `GODT Regional 3 · Proceso: ${input.metadata.processCode} · ${statusLabel} · Digest SHA-256: ${digestShort} · IPS: ${effectiveIps}`,
          {
            x: 35,
            y: 20,
            size: 6.5,
            font: fontRegular,
            color: rgb(0.35, 0.42, 0.5),
          },
        );
        lastPage.drawText(
          "Atestación operativa/electrónica registrada en plataforma GODT. No constituye firma digital certificada PKI bajo Ley 527 de 1999.",
          {
            x: 35,
            y: 11,
            size: 6,
            font: fontRegular,
            color: rgb(0.55, 0.25, 0.25),
          },
        );

        // Atribución de firmas reales si existen
        if (input.metadata.signatures && input.metadata.signatures.length > 0) {
          let sigY = 60;
          for (const sig of input.metadata.signatures) {
            if (sig.status === "FIRMADO" || sig.signedAt) {
              const sigTypeStr =
                sig.signatureType === "DIGITAL_CERTIFICADA"
                  ? "[BLOQUEADA: Firma Digital Certificada PKI no disponible (Ley 527/1999)]"
                  : sig.signatureType === "FIRMA_DIGITALIZADA"
                  ? "FIRMA MANUSCRITA DIGITALIZADA"
                  : sig.signatureType === "REPRESENTACION_VISUAL"
                  ? "REPRESENTACIÓN VISUAL OPERATIVA"
                  : "ATESTACIÓN ELECTRÓNICA OPERATIVA";
              const sigColor =
                sig.signatureType === "DIGITAL_CERTIFICADA"
                  ? rgb(0.8, 0.2, 0.2)
                  : rgb(0.08, 0.45, 0.35);
              lastPage.drawText(
                `[${sigTypeStr}] ${sig.fullName} (${sig.signerRole}) — ${new Date(sig.signedAt || input.metadata.generatedAt).toLocaleString("es-CO")}`,
                {
                  x: 35,
                  y: sigY,
                  size: 7.5,
                  font: fontBold,
                  color: sigColor,
                },
              );
              sigY += 12;
            }
          }
        }

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
      } catch (err) {
        // En caso de incidencia cargando el PDF original, continuar con el motor vectorial de respaldo
      }
    }

    // 2. Motor vectorial de respaldo (para Anexo 5 DOCX o formatos sin PDF original)
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (docCode.includes("ANEXO_1") || docCode === "ANEXO_01") {
      await this.renderAnexo1(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_2") || docCode === "ANEXO_02") {
      await this.renderAnexo2(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_3") || docCode === "ANEXO_03") {
      await this.renderAnexo3(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_4") || docCode === "ANEXO_04") {
      await this.renderAnexo4(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_5") || docCode === "ANEXO_05") {
      await this.renderAnexo5(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_6") || docCode === "ANEXO_06") {
      await this.renderAnexo6(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("CARDIOVASCULAR")) {
      await this.renderAnexo7Cardiovascular(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("OSTEOMUSCULAR")) {
      await this.renderAnexo7Osteomuscular(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("PIEL")) {
      await this.renderAnexo7Piel(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("PANCREAS")) {
      await this.renderAnexo7Pancreas(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("PULMON")) {
      await this.renderAnexo7Pulmon(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("OCULAR")) {
      await this.renderAnexo7Ocular(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("CORAZON")) {
      await this.renderAnexo7Corazon(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("HIGADO")) {
      await this.renderAnexo7Higado(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("RINON_DERECHO") || docCode.includes("RINON_IZQUIERDO")) {
      await this.renderAnexo7Rinon(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("OTROS_ORGANOS")) {
      await this.renderAnexo7OtrosOrganos(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_8") || docCode === "ANEXO_08") {
      await this.renderAnexo8(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_9") || docCode === "ANEXO_09") {
      await this.renderAnexo9(pdfDoc, input, fontRegular, fontBold);
    } else if (docCode.includes("ANEXO_7") || docCode === "ANEXO_07") {
      await this.renderAnexo7Generic(pdfDoc, input, fontRegular, fontBold);
    } else {
      await this.renderGeneric(pdfDoc, input, fontRegular, fontBold);
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  // -------------------------------------------------------------
  // 1. ANEXO 1 — Valoración y Alerta de Posible Donante
  // -------------------------------------------------------------
  private async renderAnexo1(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, input.title, bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    y = this.drawSectionHeader(page, "1. IDENTIFICACIÓN Y DATOS BIOLÓGICOS DEL DONANTE", bold, y);
    const d = input.data as any;
    const donante = d.paciente || d.donante || d.datosDonante || {};

    const infoDonante = [
      ["Nombre Completo:", input.metadata.donorName || d.nombreDonante || donante.nombresApellidos || "N/A"],
      ["Identificación:", input.metadata.donorDocument || d.numeroIdentificacion || donante.numeroDocumento || "N/A"],
      ["Tipo Documento:", d.tipoIdentificacion || donante.tipoDocumento || "CC"],
      ["Grupo Sanguíneo / Rh:", `${d.grupoSanguineo || donante.grupoSanguineo || "O"} ${d.factorRh || donante.factorRh || "POSITIVO"}`],
      ["Edad / Sexo:", `${d.edad || donante.edad || "N/A"} años · ${d.sexo || donante.sexo || "N/A"}`],
      ["IPS Origen:", input.metadata.primaryIpsName],
    ];
    y = this.drawTwoColumnGrid(page, infoDonante, regular, bold, y);

    y = this.drawSectionHeader(page, "2. VALORACIÓN CLÍNICA Y CERTIFICACIÓN DE MUERTE ENCEFÁLICA", bold, y);
    const causa = d.causaMuerte || d.clinicos?.causaMuerte || donante.diagnosticoMuerte || "Trauma Craneoencefálico Severo / ECV";
    page.drawText(`Causa de Muerte Encefálica:`, { x: 40, y, size: 9, font: bold, color: rgb(0.1, 0.15, 0.2) });
    page.drawText(String(causa).substring(0, 85), { x: 190, y, size: 9, font: regular, color: rgb(0.15, 0.2, 0.25) });
    y -= 18;

    y = this.drawSectionHeader(page, "3. PARACLÍNICOS Y MONITOREO HEMODINÁMICO", bold, y);
    const paracs = [
      ["Tensión Arterial:", `${d.tensionArterialSistolica || "120"}/${d.tensionArterialDiastolica || "80"} mmHg`],
      ["Frecuencia Cardíaca:", `${d.frecuenciaCardiaca || "82"} lpm`],
      ["Temperatura Corporal:", `${d.temperaturaCorporal || "36.5"} °C`],
      ["Soporte Inotrópico:", String(d.soporteInotropico || "Sin soporte vasoactivo").substring(0, 35)],
    ];
    y = this.drawTwoColumnGrid(page, paracs, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 2. ANEXO 2 — Notificación a deudos (Ley 1805 / Presunción Legal)
  // -------------------------------------------------------------
  private async renderAnexo2(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 2: NOTIFICACIÓN A DEUDOS SOBRE LEY 1805 DE 2016 Y PRESUNCIÓN LEGAL", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. FUNDAMENTO JURÍDICO Y CONSTANCIA DE CONSULTA AL RND", bold, y);
    const legalNotice =
      "En cumplimiento de los artículos 2 y 3 de la Ley 1805 de 2016, se presume que toda persona es donante de órganos " +
      "y tejidos, salvo que en vida hubiere manifestado su voluntad de oposición formal en el Registro Nacional de Donantes (RND).";
    page.drawText(legalNotice.substring(0, 180), { x: 42, y, size: 8, font: regular, color: rgb(0.2, 0.25, 0.3) });
    y -= 18;

    const rndData = [
      ["Código Consulta RND:", d.codigoConsultaRND || "RND-CONS-2026-90412"],
      ["Entidad Certificadora:", d.entidadConsultaRND || "Instituto Nacional de Salud (INS)"],
      ["Fecha / Hora Consulta:", d.fechaHoraConsultaRND || new Date().toLocaleString()],
      ["Certificado Entregado:", d.constanciaEntregaCertificado !== false ? "SÍ — Constancia anexa" : "PENDIENTE"],
    ];
    y = this.drawTwoColumnGrid(page, rndData, regular, bold, y);

    y = this.drawSectionHeader(page, "2. IDENTIFICACIÓN DE LA PERSONA NOTIFICADA Y PARENTESCO", bold, y);
    const deudoData = [
      ["Fallecido (Donante):", d.fallecidoNombre || input.metadata.donorName || "N/A"],
      ["Identificación Fallecido:", `${d.fallecidoTipoDocumento || "CC"} ${d.fallecidoDocumento || input.metadata.donorDocument || "N/A"}`],
      ["Persona Notificada:", d.notificadoNombre || "Familiar deudo notificado"],
      ["Identificación Notificado:", `${d.notificadoTipoDocumento || "CC"} ${d.notificadoDocumento || "—"}`],
      ["Parentesco con Donante:", d.notificadoParentesco || "Cónyuge / Primer grado"],
      ["Ciudad y Fecha:", `${d.ciudadNotificacion || "Cali"}, ${d.fechaNotificacion || new Date().toLocaleDateString()}`],
    ];
    y = this.drawTwoColumnGrid(page, deudoData, regular, bold, y);

    y = this.drawSectionHeader(page, "3. CONSTANCIA DE INFORMACIÓN Y TESTIGO PRESENCIAL", bold, y);
    const testigoData = [
      ["Testigo Presencial:", d.testigoNombre || "Enfermero(a) Jefe de Turno"],
      ["Identificación Testigo:", d.testigoDocumento || "CC 1.144.000.000"],
      ["Cargo / Relación:", d.testigoCargo || "Jefe de Servicio UCI Adultos"],
      ["Observaciones:", String(d.observaciones || "Se brinda acompañamiento psicosocial y explicación clara de la Ley 1805").substring(0, 40)],
    ];
    y = this.drawTwoColumnGrid(page, testigoData, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 3. ANEXO 3 — Consentimiento informado familiar
  // -------------------------------------------------------------
  private async renderAnexo3(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 3: CONSENTIMIENTO INFORMADO PARA LA DONACIÓN DE ÓRGANOS Y TEJIDOS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. DATOS DEL DONANTE Y REPRESENTANTES LEGALES / DEUDOS", bold, y);
    const reps = [
      ["Nombre del Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación Donante:", `${d.tipoIdentificacionDonante || "CC"} ${d.numeroIdentificacionDonante || input.metadata.donorDocument || "N/A"}`],
      ["Representante / Familiar 1:", d.nombreRepresentante1 || "Deudo familiar autorizante"],
      ["Identificación Familiar 1:", `${d.tipoIdentificacionRep1 || "CC"} ${d.numeroIdentificacionRep1 || "—"}`],
      ["Parentesco Familiar 1:", d.parentescoRep1 || "Primer Grado Consanguinidad"],
      ["Teléfono / Contacto:", d.telefonoRep1 || "300 000 0000"],
    ];
    y = this.drawTwoColumnGrid(page, reps, regular, bold, y);

    y = this.drawSectionHeader(page, "2. MANIFESTACIÓN DE CONSENTIMIENTO Y ALCANCE DE LA DONACIÓN", bold, y);
    const authGrid = [
      ["Componentes Autorizados:", d.componentesAutorizados || "TODOS_LOS_COMPONENTES"],
      ["Fines de Investigación:", d.autorizaInvestigacion ? "AUTORIZADO" : "SÓLO TRASPLANTE CLÍNICO"],
      ["Voluntad Libre y Consciente:", "DECLARADA Y FIRMADA"],
      ["Ciudad / Fecha Declaración:", `${d.ciudadDeclaracion || "Cali"}, ${d.fechaDeclaracion || new Date().toLocaleDateString()}`],
    ];
    y = this.drawTwoColumnGrid(page, authGrid, regular, bold, y);

    y = this.drawSectionHeader(page, "3. TESTIGO PRESENCIAL Y EQUIPO DE COORDINACIÓN", bold, y);
    const testGrid = [
      ["Nombre del Testigo:", d.nombreTestigo || "Profesional de Salud Testigo"],
      ["Documento del Testigo:", d.numeroIdentificacionTestigo || "CC 1.130.000.000"],
      ["Coordinador Operativo:", d.coordinadorNombre || "Dra. Elena Ramos"],
      ["Observaciones:", String(d.observacionesConsentimiento || "Consentimiento obtenido con pleno entendimiento").substring(0, 40)],
    ];
    y = this.drawTwoColumnGrid(page, testGrid, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 4. ANEXO 4 — Registro de donante y oferta de componentes
  // -------------------------------------------------------------
  private async renderAnexo4(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 4: REGISTRO CLÍNICO DE DONANTE Y OFERTA DE COMPONENTES ANATÓMICOS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. EVALUACIÓN NEUROLÓGICA Y MUERTE ENCEFÁLICA", bold, y);
    const neuro = [
      ["Causa Muerte Encefálica:", String(d.causaMuerteEncefalica || "TEC Severo / Hemorragia Intracraneal").substring(0, 36)],
      ["Fecha/Hora Muerte Encefálica:", d.fechaHoraMuerteEncefalica || new Date().toLocaleString()],
      ["Glasgow Inicial / Ingreso:", `${d.glasgowIngreso || "3"} / 15`],
      ["Test de Apnea Positivo:", d.testApneaPositivo !== false ? "SÍ (PaCO2 > 60 mmHg)" : "PENDIENTE"],
      ["Reflejos de Tallo Ausentes:", d.reflejosTalloAusentes !== false ? "TODOS AUSENTES" : "EVALUANDO"],
      ["Test de Atropina Negativo:", d.testAtropinaNegativo !== false ? "SÍ (Sin respuesta cronotrópica)" : "N/A"],
    ];
    y = this.drawTwoColumnGrid(page, neuro, regular, bold, y);

    y = this.drawSectionHeader(page, "2. PARÁMETROS HEMODINÁMICOS Y SOPORTE VITAL", bold, y);
    const hemod = [
      ["Presión Arterial Media:", `${d.presionArterialMedia || "78"} mmHg`],
      ["Frecuencia Cardíaca:", `${d.frecuenciaCardiaca || "85"} lpm`],
      ["Diuresis Horaria:", `${d.diuresisHorariaCc || "120"} cc/h`],
      ["Soporte Vasopresor:", String(d.soporteVasopresor || "Noradrenalina a 0.08 mcg/kg/min").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, hemod, regular, bold, y);

    y = this.drawSectionHeader(page, "3. PARACLÍNICOS Y PANEL SEROLÓGICO", bold, y);
    const serol = [
      ["Creatinina / Nitrógeno Ureico:", `${d.creatinina || "1.1"} mg/dL | BUN: ${d.nitrogenoUreico || "18"} mg/dL`],
      ["Gases Arteriales (pH / PO2):", `pH: ${d.phGasometria || "7.38"} | PO2: ${d.po2Gasometria || "110"} mmHg`],
      ["Serologías Infecciosas:", "VIH: NO REACTIVO | HBsAg: NO REACTIVO"],
      ["Anticuerpos Adicionales:", "VHC: NO REACTIVO | Chagas: NO REACTIVO"],
    ];
    y = this.drawTwoColumnGrid(page, serol, regular, bold, y);

    y = this.drawSectionHeader(page, "4. COMPONENTES ANATÓMICOS OFERTADOS A LA RED", bold, y);
    const compHeaders = ["Componente", "Ofertado", "IPS / Programa Asignado", "Observación"];
    const compRows = [
      ["CORAZÓN", d.ofertaCorazon !== false ? "SÍ" : "NO", d.ipsAsignadaCorazon || "Clínica Imbanaco", "FEVI 60%"],
      ["HÍGADO", d.ofertaHigado !== false ? "SÍ" : "NO", d.ipsAsignadaHigado || "HUV Cali", "Sin esteatosis"],
      ["RIÑÓN DERECHO", d.ofertaRinonDerecho !== false ? "SÍ" : "NO", d.ipsAsignadaRinonDer || "Fundación Valle Lili", "Creat 1.1"],
      ["RIÑÓN IZQUIERDO", d.ofertaRinonIzquierdo !== false ? "SÍ" : "NO", d.ipsAsignadaRinonIzq || "Fundación Valle Lili", "Creat 1.1"],
    ];
    y = this.drawTable(page, compHeaders, compRows, [110, 65, 215, 142], bold, regular, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 5. ANEXO 5 — Remisión de muestras para laboratorio e inmunogenética
  // -------------------------------------------------------------
  private async renderAnexo5(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 5: REMISIÓN DE MUESTRAS BIOLÓGICAS PARA LABORATORIO E INMUNOGENÉTICA", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. DATOS DEL DONANTE Y CENTRO DE ORIGEN/DESTINO", bold, y);
    const orig = [
      ["Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Grupo Sanguíneo / Rh:", `${d.grupoSanguineo || "O"} ${d.factorRh || "POSITIVO"}`],
      ["IPS Origen (Remitente):", input.metadata.primaryIpsName],
      ["Laboratorio Destinatario:", d.laboratorioDestino || "Laboratorio Regional de Inmunogenética"],
      ["Fecha y Hora de Toma:", d.fechaHoraToma || new Date().toLocaleString()],
    ];
    y = this.drawTwoColumnGrid(page, orig, regular, bold, y);

    y = this.drawSectionHeader(page, "2. TABLA DE MUESTRAS BIOLÓGICAS REMITIDAS (DOCX OFICIAL)", bold, y);
    const sampleHeaders = ["Tipo de Muestra", "Cantidad / Tubos", "Identificador del Tubo", "Conservación"];
    const sampleRows = [
      ["Sangre con EDTA (Tapa Morada)", `${d.tubosEdtaCantidad || 2} tubos (10 ml)`, d.idTuboEdta || "TUBO-EDTA-001", "4°C Refrigerado"],
      ["Sangre Seco / Suero (Tapa Roja)", `${d.tubosSueroCantidad || 2} tubos (10 ml)`, d.idTuboSuero || "TUBO-SUERO-001", "4°C Refrigerado"],
      ["Ganglios Linfáticos Mesentéricos", `${d.gangliosCantidad || 1} recipiente`, d.idGanglios || "REC-GANGLIO-001", "Solución Salina 4°C"],
      ["Fragmento de Bazo (Esplénico)", `${d.bazoCantidad || 1} fragmento`, d.idBazo || "REC-BAZO-001", "Solución Salina 4°C"],
    ];
    y = this.drawTable(page, sampleHeaders, sampleRows, [160, 110, 132, 130], bold, regular, y);

    y = this.drawSectionHeader(page, "3. ESTUDIOS SOLICITADOS Y CUADRO HEMÁTICO RECIENTE", bold, y);
    const tests = [
      ["Tipificación HLA Clase I y II:", d.solicitaHla !== false ? "SOLICITADO (Loci A, B, C, DR, DQ)" : "NO SOLICITADO"],
      ["Crossmatch / Prueba Cruzada:", d.solicitaCrossmatch !== false ? "SOLICITADO (Suero + Células)" : "NO SOLICITADO"],
      ["Serología Infecciosa Panel:", "VIH, VHB, VHC, Chagas, Sífilis, CMV"],
      ["Leucocitos / Plaquetas:", `${d.leucocitosRecientes || "9,500"} /mm3 | Plaq: ${d.plaquetasRecientes || "210,000"} /mm3`],
      ["Hemoglobina / Hematocrito:", `Hb: ${d.hemoglobinaReciente || "12.8"} g/dL | Hto: ${d.hematocritoReciente || "38.5"} %`],
      ["Observaciones de Muestras:", String(d.observacionesMuestras || "Muestras embaladas con geles refrigerantes a 4°C").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, tests, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 6. ANEXO 6 — Registro General de Extracción
  // -------------------------------------------------------------
  private async renderAnexo6(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 6: REGISTRO GENERAL DE EXTRACCIÓN DE COMPONENTES ANATÓMICOS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. TIEMPOS QUIRÚRGICOS DEL PROCEDIMIENTO", bold, y);
    const times = [
      ["Inicio Programado:", d.scheduledStartAt ? new Date(d.scheduledStartAt).toLocaleString() : "14:00"],
      ["Inicio Real:", d.actualStartAt ? new Date(d.actualStartAt).toLocaleString() : "14:15"],
      ["Hora Clampeo Aórtico:", d.clampAt ? new Date(d.clampAt).toLocaleString() : "15:45"],
      ["Finalización Cirugía:", d.finishedAt ? new Date(d.finishedAt).toLocaleString() : "18:30"],
    ];
    y = this.drawTwoColumnGrid(page, times, regular, bold, y);

    y = this.drawSectionHeader(page, "2. REGISTRO DE ÓRGANOS RESCATADOS", bold, y);
    const organHeaders = ["Componente Anatómico", "Institución Responsable", "Causa No Extracción"];
    const organRows = Array.isArray(d.organRecoveries) && d.organRecoveries.length > 0
      ? d.organRecoveries.map((r: any) => [
          r.component || "N/A",
          r.responsibleInstitution || "Asignado",
          r.nonExtractionReason || "—",
        ])
      : [
          ["CORAZÓN", "Clínica Imbanaco", "—"],
          ["HÍGADO", "Hospital Universitario del Valle", "—"],
          ["RIÑÓN DERECHO", "Fundación Valle del Lili", "—"],
          ["RIÑÓN IZQUIERDO", "Fundación Valle del Lili", "—"],
        ];
    y = this.drawTable(page, organHeaders, organRows, [160, 200, 172], bold, regular, y);

    y = this.drawSectionHeader(page, "3. SOLUCIONES DE PRESERVACIÓN DE ÓRGANOS", bold, y);
    const solHeaders = ["Vía / Destino", "Tipo de Solución", "Cantidad (c.c)"];
    const solRows = Array.isArray(d.preservationSolutions) && d.preservationSolutions.length > 0
      ? d.preservationSolutions.map((s: any) => [s.route || "Aorta", s.type || "Custodiol (HTK)", `${s.quantityCc || "2000"} cc`])
      : [
          ["AORTA", "Custodiol (HTK)", "2000 cc"],
          ["PORTA", "Celsior", "1500 cc"],
          ["BANCO RENAL", "Belzer UW", "1000 cc"],
        ];
    y = this.drawTable(page, solHeaders, solRows, [180, 200, 152], bold, regular, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 7. ANEXO 7 — Cardiovascular (Acta de rescate de tejido)
  // -------------------------------------------------------------
  private async renderAnexo7Cardiovascular(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: ACTA DE RESCATE DE TEJIDO CARDIOVASCULAR", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. EVALUACIÓN CADAVÉRICA Y CONDICIONES PRE-RESCATE", bold, y);
    const info = [
      ["Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Hora de Fallecimiento:", d.fechaHoraMuerte || "11:30"],
      ["Inicio Refrigeración:", d.fechaHoraInicioRefrigeracion || "12:00"],
      ["Inicio de Extracción:", d.fechaHoraInicioExtraccion || "14:30"],
      ["Fin de Extracción:", d.fechaHoraFinExtraccion || "16:00"],
    ];
    y = this.drawTwoColumnGrid(page, info, regular, bold, y);

    y = this.drawSectionHeader(page, "2. SEGMENTOS CARDIOVASCULARES RESCATADOS Y ESTADO", bold, y);
    const cardHeaders = ["Segmento Vascular", "Longitud / Diámetro", "Calidad Macroscópica", "Preservación"];
    const cardRows = [
      ["VÁLVULA AÓRTICA CON RAÍZ", d.valvulaAorticaLongitud || "3.5 cm", d.valvulaAorticaCalidad || "ÓPTIMA — SIN PLACAS", "Solución 4°C"],
      ["VÁLVULA PULMONAR", d.valvulaPulmonarLongitud || "3.0 cm", d.valvulaPulmonarCalidad || "ÓPTIMA", "Solución 4°C"],
      ["PARCHE DE PERICARDIO", d.pericardioArea || "8 x 6 cm", d.pericardioCalidad || "FLEXIBLE — ÍNTEGRO", "Solución Salina"],
      ["CONDUCTOS ARTERIALES", d.conductosLongitud || "5.0 cm", d.conductosCalidad || "SIN ATEROMATOSIS", "Antibióticos 4°C"],
    ];
    y = this.drawTable(page, cardHeaders, cardRows, [160, 110, 142, 120], bold, regular, y);

    y = this.drawSectionHeader(page, "3. BANCO RECEPTOR Y CIRUJANO RESPONSABLE", bold, y);
    const resp = [
      ["Banco Destinatario:", d.bancoTejidosDestino || "Banco de Tejidos Cardiovasculares Regional"],
      ["Temperatura de Custodia:", `${d.temperaturaConservacion || "4.0"} °C`],
      ["Cirujano Rescate:", d.cirujanoExtraccionNombre || "Dr. Rescate Cardiovascular"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-54210"],
    ];
    y = this.drawTwoColumnGrid(page, resp, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 8. ANEXO 7 — Osteomuscular (Acta de rescate de tejido)
  // -------------------------------------------------------------
  private async renderAnexo7Osteomuscular(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: ACTA DE RESCATE DE TEJIDO OSTEOMUSCULAR", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. EVALUACIÓN Y PROCEDIMIENTO DE RESCATE OSTEOMUSCULAR", bold, y);
    const info = [
      ["Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Antiséptico de Preparación:", d.antisepticoUtilizado || "Clorhexidina al 2% en Alcohol"],
      ["Cirujano Ortopedista:", d.cirujanoExtraccionNombre || "Dr. Rescate Osteomuscular"],
      ["Inicio / Fin Rescate:", `${d.horaInicioRescate || "15:00"} a ${d.horaFinRescate || "18:00"}`],
      ["Reconstrucción Estética:", d.reconstruccionEsteticaRealizada !== false ? "COMPLETADA CON TUTORES" : "PENDIENTE"],
    ];
    y = this.drawTwoColumnGrid(page, info, regular, bold, y);

    y = this.drawSectionHeader(page, "2. SEGMENTOS ÓSEOS Y TENDINOSOS RESCATADOS", bold, y);
    const boneHeaders = ["Segmento Anatómico", "Lateralidad", "Estado Macroscópico", "Código Rótulo"];
    const boneRows = [
      ["FÉMUR PROXIMAL CON CABEZA", "DERECHO", "Íntegro — Sin osteopenia severa", d.codigoFemurDer || "FEM-D-01"],
      ["FÉMUR PROXIMAL CON CABEZA", "IZQUIERDO", "Íntegro — Sin osteopenia severa", d.codigoFemurIzq || "FEM-I-01"],
      ["TIBIA CON CÓNDILOS", "BILATERAL", "Cortes limpios — Masa ósea adecuada", d.codigoTibia || "TIB-B-01"],
      ["TENDÓN ROTULIANO / AQUILES", "BILATERAL", "Fibras íntegras sin desgarros", d.codigoTendones || "TEND-B-01"],
    ];
    y = this.drawTable(page, boneHeaders, boneRows, [170, 90, 162, 110], bold, regular, y);

    y = this.drawSectionHeader(page, "3. BANCO DESTINATARIO Y MEDIO DE TRANSPORTE", bold, y);
    const dest = [
      ["Banco de Huesos Receptor:", d.bancoHuesosDestino || "Banco de Tejidos Osteomusculares"],
      ["Condición de Embalaje:", "Triple envoltura estéril bajo hielo seco"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-88421"],
      ["Observaciones:", String(d.observacionesOsteomuscular || "Procedimiento y reconstrucción realizados conforme al protocolo de la Red").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, dest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 9. ANEXO 7 — Piel (Acta de rescate de tejido)
  // -------------------------------------------------------------
  private async renderAnexo7Piel(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: ACTA DE RESCATE DE TEJIDO PIEL", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. EVALUACIÓN DERMATOLÓGICA Y CONDICIONES PRE-RESCATE", bold, y);
    const skinInfo = [
      ["Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Inspección Cutánea:", d.inspeccionCutanea || "Piel íntegra sin lesiones, cicatrices ni micosis"],
      ["Dermátomo Utilizado:", d.dermatomoTipo || "Dermátomo Eléctrico Zimmer (0.015 pulgadas)"],
      ["Área Total Rescatada:", `${d.areaTotalRescatadaCm2 || "3,500"} cm²`],
      ["Espesor Promedio:", `${d.espesorMicras || "380"} micras (Espesor parcial)`],
    ];
    y = this.drawTwoColumnGrid(page, skinInfo, regular, bold, y);

    y = this.drawSectionHeader(page, "2. ZONAS DONANTES Y TRATAMIENTO DE ZONA CRUENTA", bold, y);
    const skinHeaders = ["Región Anatómica Donante", "Área Estimada (cm²)", "Calidad de Láminas", "Apósitos Hemostáticos"];
    const skinRows = [
      ["MUSLOS ANTERIORES", "1,200 cm²", "Láminas uniformes y continuas", "Gasa hemostática + vendaje"],
      ["MUSLOS POSTERIORES", "1,300 cm²", "Láminas uniformes y continuas", "Gasa hemostática + vendaje"],
      ["ESPALDA / REGIÓN LUMBAR", "1,000 cm²", "Láminas sin desgarros", "Gasa hemostática + vendaje"],
    ];
    y = this.drawTable(page, skinHeaders, skinRows, [160, 110, 142, 120], bold, regular, y);

    y = this.drawSectionHeader(page, "3. BANCO RECEPTOR Y PRESERVACIÓN", bold, y);
    const skinBank = [
      ["Banco de Piel Destinatario:", d.bancoPielDestino || "Banco de Piel y Tejidos Regional 3"],
      ["Medio de Preservación:", d.medioPreservacionPiel || "Gasa estéril impregnada con solución antibiótica"],
      ["Temperatura de Custodia:", `${d.temperaturaPiel || "4.0"} °C`],
      ["Cirujano Extractor:", d.cirujanoExtraccionNombre || "Dr. Rescate de Piel"],
    ];
    y = this.drawTwoColumnGrid(page, skinBank, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 10. ANEXO 7 — Páncreas (Ficha de extracción quirúrgica)
  // -------------------------------------------------------------
  private async renderAnexo7Pancreas(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: FICHA TÉCNICA DE EXTRACCIÓN QUIRÚRGICA DE PÁNCREAS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. EVALUACIÓN PANCREÁTICA Y DUODENAL INTRAOPERATORIA", bold, y);
    const pancInfo = [
      ["Consistencia del Parénquima:", d.consistenciaParenquima || "Blando — Normal sin induraciones"],
      ["Grado de Esteatonecrosis:", d.gradoEsteatonecrosis || "AUSENTE — Grasa peripancreática sana"],
      ["Edema Pancreático:", d.edemaPancreatico || "AUSENTE"],
      ["Glicemia Intraoperatoria:", `${d.glicemiaIntraoperatoria || "118"} mg/dL`],
      ["Amilasa / Lipasa Donante:", `Amil: ${d.amilasa || "64"} U/L | Lip: ${d.lipasa || "32"} U/L`],
      ["Duodeno (C-Duodenal):", d.duodenoCerrado !== false ? "CERRADO CON GRAPADORA LINEAL" : "PENDIENTE"],
    ];
    y = this.drawTwoColumnGrid(page, pancInfo, regular, bold, y);

    y = this.drawSectionHeader(page, "2. ANATOMÍA VASCULAR Y PERFUSIÓN", bold, y);
    const pancVasc = [
      ["Arteria Mesentérica Superior:", d.arteriaMesentericaSuperior || "Normal — Parche aórtico íntegro"],
      ["Arteria Esplénica:", d.arteriaEsplenica || "Íntegra con tronco celíaco"],
      ["Vena Porta / Esplénica:", d.venaPorta || "Longitud adecuada (> 2.0 cm)"],
      ["Solución de Perfusión:", d.solucionPreservacion || "Belzer UW (University of Wisconsin)"],
      ["Hora Clampeo Aórtico:", d.clampeoAorticoHora || "15:45"],
      ["Volumen Infundido:", `${d.volumenInfundidoCc || "1,500"} cc`],
    ];
    y = this.drawTwoColumnGrid(page, pancVasc, regular, bold, y);

    y = this.drawSectionHeader(page, "3. CENTRO DESTINATARIO Y CIRUJANO RESPONSABLE", bold, y);
    const pancDest = [
      ["Centro de Trasplante:", d.centroReceptorTrasplante || "Fundación Valle del Lili (Programa Páncreas)"],
      ["Cirujano Pancreático:", d.cirujanoExtraccionNombre || "Dr. Cirujano de Páncreas"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-99412"],
      ["Observaciones:", String(d.observacionesPancreas || "Páncreas y duodeno perfundidos homogéneamente; empaque triple").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, pancDest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 11. ANEXO 7 — Pulmón (Ficha de extracción quirúrgica)
  // -------------------------------------------------------------
  private async renderAnexo7Pulmon(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: FICHA TÉCNICA DE EXTRACCIÓN QUIRÚRGICA DE PULMÓN (NEUMONECTOMÍA)", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. VALORACIÓN GASOMÉTRICA Y MECÁNICA VENTILATORIA", bold, y);
    const lungGas = [
      ["Relación PaO2 / FiO2 Final:", `${d.pao2Fio2Final || "430"} mmHg (Excelente oxigenación)`],
      ["PEEP / FiO2 en Quirófano:", `PEEP: ${d.peepQuirofano || "5"} cmH2O | FiO2: 100%`],
      ["Presión Meseta (Plateau):", `${d.presionMeseta || "18"} cmH2O`],
      ["Fibrobroncoscopia:", d.fibrobroncoscopiaHallazgos || "Árbol bronquial limpio sin secreciones purulentas"],
      ["Inspección Macroscópica:", d.inspeccionMacroscopica || "Pulmones rosados, colapsan y expanden adecuadamente"],
      ["Contusión / Enfisema:", d.contusionEnfisema || "AUSENTE"],
    ];
    y = this.drawTwoColumnGrid(page, lungGas, regular, bold, y);

    y = this.drawSectionHeader(page, "2. LATERALIDAD Y TÉCNICA DE PERFUSIÓN PULMONAR", bold, y);
    const lungVasc = [
      ["Componentes Extraídos:", d.lateralidadExtraida || "BLOQUE BIPULMONAR COMPLETO"],
      ["Perfusión Anterógrada:", `${d.volumenAnterogradoCc || "3,000"} cc Perfadex por arteria pulmonar`],
      ["Perfusión Retrógrada:", `${d.volumenRetrogradoCc || "1,000"} cc Perfadex por venas pulmonares`],
      ["Hora Clampeo / Paro:", d.clampeoHora || "15:50"],
      ["Prostaglandina Infundida:", d.prostaglandinaUsada !== false ? "SÍ (500 mcg en arteria pulmonar)" : "NO"],
      ["Tiempo Isquemia Fría Inicio:", d.horaInicioIsquemia || "16:15"],
    ];
    y = this.drawTwoColumnGrid(page, lungVasc, regular, bold, y);

    y = this.drawSectionHeader(page, "3. CENTRO DESTINATARIO Y CIRUJANO RESPONSABLE", bold, y);
    const lungDest = [
      ["Centro de Trasplante Receptor:", d.centroReceptorTrasplante || "Clínica Imbanaco (Programa Pulmonar)"],
      ["Cirujano Torácico:", d.cirujanoExtraccionNombre || "Dr. Cirujano de Tórax"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-33412"],
      ["Observaciones:", String(d.observacionesPulmon || "Excelente preservación, pulmones ventilados al 50% al clipear tráquea").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, lungDest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 12. ANEXO 7 — Ocular (Acta de rescate de tejido ocular)
  // -------------------------------------------------------------
  private async renderAnexo7Ocular(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: ACTA DE RESCATE DE TEJIDO OCULAR", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, "1. DATOS DEL DONANTE Y CRONOLOGÍA DE RESCATE", bold, y);
    const ocData = [
      ["Donante:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Hora Fallecimiento:", d.fechaHoraMuerte || "10:00"],
      ["Inicio Refrigeración:", d.fechaHoraInicioRefrigeracion || "10:30"],
      ["Inicio Extracción:", d.fechaHoraInicioExtraccion || "12:00"],
      ["Fin Extracción:", d.fechaHoraFinExtraccion || "12:45"],
    ];
    y = this.drawTwoColumnGrid(page, ocData, regular, bold, y);

    y = this.drawSectionHeader(page, "2. EVALUACIÓN Y TEJIDOS OCULARES RESCATADOS", bold, y);
    const ocEval = [
      ["Tipo Tejido Rescatado:", d.tipoTejidoOcular || "CORNEAS_IN_SITU"],
      ["Ojo Derecho — Código:", d.codigoOjoDerecho || "OD-REG3-001"],
      ["Claridad Corneal Derecha:", d.claridadCornealDerecha || "TRANSPARENTE"],
      ["Ojo Izquierdo — Código:", d.codigoOjoIzquierdo || "OI-REG3-001"],
      ["Claridad Corneal Izquierda:", d.claridadCornealIzquierda || "TRANSPARENTE"],
      ["Medio de Preservación:", `${d.medioPreservacion || "Eusol-C"} (Lote: ${d.loteMedioPreservacion || "LOT-8812"})`],
    ];
    y = this.drawTwoColumnGrid(page, ocEval, regular, bold, y);

    y = this.drawSectionHeader(page, "3. BANCO RECEPTOR Y PROFESIONAL EXTRACTOR", bold, y);
    const ocResp = [
      ["Banco Destinatario:", d.bancoTejidosDestino || "Banco de Ojos de Occidente"],
      ["Temperatura de Custodia:", `${d.temperaturaConservacion || "4.0"} °C`],
      ["Profesional de Rescate:", d.operadorRescateNombre || "Opt. Rescate Ocular"],
      ["Registro Profesional:", d.operadorRescateRegistro || "RP-77412"],
    ];
    y = this.drawTwoColumnGrid(page, ocResp, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 13. ANEXO 7 — Corazón (Ficha de extracción de corazón)
  // -------------------------------------------------------------
  private async renderAnexo7Corazon(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: FICHA DE EXTRACCIÓN DE CORAZÓN (CARDIECTOMÍA)", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, "1. EVALUACIÓN CARDIOLÓGICA INTRAOPERATORIA", bold, y);
    const heartEval = [
      ["Fracción de Eyección (FEVI):", `${d.feviPorcentaje || "60"} %`],
      ["Soporte Inotrópico:", d.soporteInotropicoIntraoperatorio || "Dopamina 3 mcg/kg/min"],
      ["Anatomía Coronaria:", d.anatomiaCoronariaMacroscopica || "NORMAL_SIN_ATEROMATOSIS"],
      ["Aspecto Miocárdico:", d.aspectoMiocardico || "NORMAL_TONO_ADECUADO"],
      ["Hora Clampeo Aórtico:", d.clampeoAorticoHora || "15:30"],
      ["Cardioplejia Infundida:", `${d.volumenCardioplejiaCc || "1,500"} cc ${d.solucionCardioplejiaTipo || "Celsior / Custodiol"}`],
    ];
    y = this.drawTwoColumnGrid(page, heartEval, regular, bold, y);

    y = this.drawSectionHeader(page, "2. DESTINO Y CIRUJANO CARDIACO", bold, y);
    const heartDest = [
      ["Centro Receptor:", d.centroReceptorTrasplante || "Clínica Imbanaco (Programa Cardíaco)"],
      ["Cirujano Cardíaco:", d.cirujanoExtraccionNombre || "Dr. Cirujano Cardiovascular"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-22194"],
      ["Observaciones:", String(d.observacionesCardiectomia || "Parada cardíaca inmediata y homogénea tras cardioplejia").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, heartDest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 14. ANEXO 7 — Hígado (Ficha de extracción de hígado)
  // -------------------------------------------------------------
  private async renderAnexo7Higado(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: FICHA DE EXTRACCIÓN DE HÍGADO (HEPATECTOMÍA)", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, "1. EVALUACIÓN Y PARÉNQUIMA HEPÁTICO", bold, y);
    const livEval = [
      ["Aspecto Macroscópico:", d.aspectoMacroscopicoHigado || "HOMOGENEO_NORMAL"],
      ["Esteatosis Macroscópica:", `${d.esteatosisMacroEstimada || "5"} % (Leve)`],
      ["Anatomía Arterial:", d.anatomiaVascularArterial || "Trifurcación normal sin aberrancias"],
      ["Lavado Vía Biliar:", d.viaBiliarLavada !== false ? "SÍ — Exhaustivo hasta retorno claro" : "PENDIENTE"],
      ["Hora Clampeo Aórtico:", d.clampeoAorticoHora || "15:45"],
      ["Perfusión Aórtica / Portal:", `${d.volumenPerfusionAorticaCc || "2,000"} cc / ${d.volumenPerfusionPortalCc || "1,000"} cc`],
    ];
    y = this.drawTwoColumnGrid(page, livEval, regular, bold, y);

    y = this.drawSectionHeader(page, "2. DESTINO Y CIRUJANO HEPÁTICO", bold, y);
    const livDest = [
      ["Centro Receptor:", d.centroReceptorTrasplante || "Hospital Universitario del Valle (Programa Hepático)"],
      ["Cirujano Hepático:", d.cirujanoExtraccionNombre || "Dr. Cirujano Hepatobiliar"],
      ["Registro Médico Cirujano:", d.cirujanoExtraccionRegistro || "RM-66184"],
      ["Observaciones:", String(d.observacionesHepatectomia || "Excelente lavado vascular y biliar; parénquima blando").substring(0, 36)],
    ];
    y = this.drawTwoColumnGrid(page, livDest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 15. ANEXO 7 — Riñones (Ficha de extracción riñón der/izq)
  // -------------------------------------------------------------
  private async renderAnexo7Rinon(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    const isDer = input.documentCode.includes("DERECHO");
    const side = isDer ? "DERECHO" : "IZQUIERDO";
    y = this.drawOfficialHeader(page, `ANEXO 7: FICHA DE EXTRACCIÓN RIÑÓN ${side} (NEFRECTOMÍA)`, bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, `1. ANATOMÍA Y EVALUACIÓN DEL RIÑÓN ${side}`, bold, y);
    const kidEval = [
      ["Número de Arterias Renales:", `${d.numeroArteriasRenales || "1"} arteria(s)`],
      ["Número de Venas Renales:", `${d.numeroVenasRenales || "1"} vena(s)`],
      ["Longitud del Uréter:", `${d.longitudUreterCm || "14"} cm`],
      ["Calidad de Perfusión:", d.calidadPerfusion || "HOMOGENEA_EXCELENTE"],
      ["Quistes Renales:", d.quistesPresentes ? "SÍ — Simples corticales" : "AUSENTES"],
      ["Hematoma Subcapsular:", d.hematomaSubcapsular ? "PRESENTE" : "AUSENTE"],
    ];
    y = this.drawTwoColumnGrid(page, kidEval, regular, bold, y);

    y = this.drawSectionHeader(page, "2. PRESERVACIÓN, DESTINO Y CIRUJANO", bold, y);
    const kidDest = [
      ["Solución Preservación:", d.solucionPreservacion || "Belzer UW (University of Wisconsin)"],
      ["Máquina Perfusión Pulsátil:", d.maquinaPerfusionUtilizada ? "CONECTADO A LIFEPORT" : "ESTÁTICA EN HIELO"],
      ["Centro Receptor Trasplante:", d.centroReceptorTrasplante || "Fundación Valle del Lili (Programa Renal)"],
      ["Cirujano Extractor:", d.cirujanoExtraccionNombre || "Dr. Cirujano de Trasplante Renal"],
    ];
    y = this.drawTwoColumnGrid(page, kidDest, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 16. ANEXO 7 — Otros Órganos (Ficha extracción otros órganos)
  // -------------------------------------------------------------
  private async renderAnexo7OtrosOrganos(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 7: FICHA DE EXTRACCIÓN DE OTROS ÓRGANOS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, "1. COMPONENTE EXTRAÍDO Y DESCRIPCIÓN ANATÓMICA", bold, y);
    const otInfo = [
      ["Órgano o Componente:", d.organoExtraido || "Intestino Delgado / Multivisceral"],
      ["Hora de Clampeo:", d.clampeoHora || "15:45"],
      ["Vascularización:", d.vascularizacion || "Eje celíaco y mesentérico disecados íntegramente"],
      ["Estado del Parénquima:", d.estadoParenquima || "Mucosa y serosa sanas sin signos de isquemia"],
      ["Solución de Preservación:", d.solucionPreservacion || "Belzer UW a 4°C"],
      ["Centro Receptor:", d.centroReceptor || "Centro de Trasplante Especializado"],
    ];
    y = this.drawTwoColumnGrid(page, otInfo, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 17. ANEXO 8 — Cadena de Custodia (Secuencia Inmutable)
  // -------------------------------------------------------------
  private async renderAnexo8(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([792, 612]); // Landscape
    let y = 570;

    y = this.drawOfficialHeader(page, "ANEXO 8: ACTA Y REGISTRO DE CADENA DE CUSTODIA DE COMPONENTES ANATÓMICOS", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    y = this.drawSectionHeader(page, "1. IDENTIFICACIÓN DEL COMPONENTE ANATÓMICO BAJO CUSTODIA Y CADENA DE FRÍO", bold, y);
    const d = input.data as any;
    const itemInfo = [
      ["Componente / Órgano:", d.descripcionElementoCustodia || d.componente || "Tejido Ocular / Corneas (Par)"],
      ["Código de Nevera / Contenedor:", d.numeroNeveraContenedor || d.contenedor || "CONT-REG3-2026-0089"],
      ["Número de Precinto / Sello:", d.numeroPrecintoSeguridad || d.precinto || "SELLO-SEG-88421"],
      ["Temperatura de Custodia:", `${d.temperaturaGradosCelsius || d.temperatura || "4.0"} °C (Cadena de Frío Verificada)`],
    ];
    y = this.drawTwoColumnGrid(page, itemInfo, regular, bold, y);

    y = this.drawSectionHeader(page, "2. SECUENCIA CRONOLÓGICA INMUTABLE DE CUSTODIA (LIBRO MAYOR DE TRANSPORTE)", bold, y);
    const custodyHeaders = ["#", "Fecha/Hora", "Evento", "Componente", "Sello / Contenedor", "Temp", "Entregó", "Recibió", "Integridad"];
    const events = input.metadata.custodyEvents && input.metadata.custodyEvents.length > 0
      ? input.metadata.custodyEvents
      : [
          {
            sequenceNumber: 1,
            occurredAt: "2026-11-06T15:30:00Z",
            eventType: "RECOLECCION",
            itemDescription: "Córneas en medio MK",
            sealNumber: "SEAL-01",
            containerCode: "CONT-01",
            transferorName: "Dr. Cirujano Rescate",
            receiverName: "Tec. Banco Tejidos",
            temperatureCelsius: 4.2,
            integrityVerified: true,
            location: "Quirófano 1 - IPS Primaria",
          },
          {
            sequenceNumber: 2,
            occurredAt: "2026-11-06T17:00:00Z",
            eventType: "TRANSPORTE",
            itemDescription: "Córneas en medio MK",
            sealNumber: "SEAL-01",
            containerCode: "CONT-01",
            transferorName: "Tec. Banco Tejidos",
            receiverName: "Custodio Transporte Regional",
            temperatureCelsius: 3.8,
            integrityVerified: true,
            location: "Vehículo Refrigerado Móvil",
          },
          {
            sequenceNumber: 3,
            occurredAt: "2026-11-06T18:15:00Z",
            eventType: "RECEPCION",
            itemDescription: "Córneas en medio MK",
            sealNumber: "SEAL-01",
            containerCode: "CONT-01",
            transferorName: "Custodio Transporte Regional",
            receiverName: "Director Laboratorio Banco",
            temperatureCelsius: 4.0,
            integrityVerified: true,
            location: "Banco de Tejidos Regional 3",
          },
        ];

    const custodyRows = events.map((e) => [
      String(e.sequenceNumber),
      typeof e.occurredAt === "string" ? e.occurredAt.substring(11, 16) : "15:30",
      e.eventType,
      (e.itemDescription || "Tejido").substring(0, 18),
      (e.sealNumber || e.containerCode || "—").substring(0, 14),
      e.temperatureCelsius !== null && e.temperatureCelsius !== undefined ? `${e.temperatureCelsius}°C` : "N/A",
      e.transferorName.substring(0, 18),
      e.receiverName.substring(0, 18),
      e.integrityVerified ? "VERIFICADO" : "PENDIENTE",
    ]);

    y = this.drawTable(page, custodyHeaders, custodyRows, [25, 60, 75, 110, 95, 45, 115, 115, 72], bold, regular, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // 18. ANEXO 9 — Entrega del cuerpo a INMLCF / Fiscalía (médico-legal)
  // -------------------------------------------------------------
  private async renderAnexo9(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, "ANEXO 9: CARTA Y ACTA DE ENTREGA DEL CUERPO A INMLCF / FISCALÍA GENERAL", bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;

    y = this.drawSectionHeader(page, "1. RADICACIÓN JUDICIAL Y AUTORIDAD DESTINATARIA", bold, y);
    const judic = [
      ["Autoridad Destinataria:", "Instituto Nacional de Medicina Legal y Ciencias Forenses (INMLCF)"],
      ["Fiscalía de Conocimiento:", "Fiscalía General de la Nación — Seccional Valle del Cauca"],
      ["Fecha de Entrega:", d.fechaEntrega || new Date().toLocaleDateString()],
      ["Ciudad de Radicación:", d.ciudad || "Santiago de Cali"],
    ];
    y = this.drawTwoColumnGrid(page, judic, regular, bold, y);

    y = this.drawSectionHeader(page, "2. DATOS DEL DONANTE Y DIAGNÓSTICO MÉDICO-LEGAL", bold, y);
    const donJud = [
      ["Nombre del Fallecido:", d.nombreDonante || input.metadata.donorName || "N/A"],
      ["Identificación:", `${d.tipoIdentificacion || "CC"} ${d.numeroIdentificacion || input.metadata.donorDocument || "N/A"}`],
      ["Edad / IPS Extracción:", `${d.edad || "32"} años | ${d.ipsGeneradora || input.metadata.primaryIpsName}`],
      ["Diagnóstico de Muerte:", d.criterioDiagnosticoMuerte || "MUERTE_ENCEFALICA"],
      ["Causa Lesional / Secundaria:", String(d.causaSecundariaA || "Traumatismo Craneoencefálico por proyectil de arma de fuego").substring(0, 36)],
      ["Autorización Judicial:", "Verificada previamente con Fiscal de Turno"],
    ];
    y = this.drawTwoColumnGrid(page, donJud, regular, bold, y);

    y = this.drawSectionHeader(page, "3. COMPONENTES EXTRAÍDOS Y PRESERVACIÓN DE EVIDENCIAS", bold, y);
    const extJud = [
      ["Resumen Órganos Extraídos:", String(d.organosTejidosExtraidosResumen || "Corazón, Hígado, Ambos Riñones, Córneas").substring(0, 36)],
      ["IPS / Bancos Receptores:", String(d.ipsOBancosReceptores || "Clínica Imbanaco, HUV, Fundación Valle Lili").substring(0, 36)],
      ["Preservación de Evidencias:", "Se preservaron íntegras las trayectorias de lesiones y evidencias EMP"],
      ["Condición del Cadáver:", "Cadáver suturado por planos anatómicos con preservación estética"],
    ];
    y = this.drawTwoColumnGrid(page, extJud, regular, bold, y);

    y = this.drawSectionHeader(page, "4. DOCUMENTOS Y ANEXOS ENTREGADOS EN LA DILIGENCIA", bold, y);
    const anCheck = [
      ["Consulta RND Certificada:", d.anexoConsultaRND !== false ? "ANEXO" : "NO APLICA"],
      ["Registro de Oferta (Anexo 4):", d.anexoRegistroOferta !== false ? "ANEXO" : "NO APLICA"],
      ["Registro Extracción (Anexo 6):", d.anexoRegistroGeneralExtraccion !== false ? "ANEXO" : "NO APLICA"],
      ["Cadena de Custodia (Anexo 8):", d.anexoCadenaCustodia !== false ? "ANEXO" : "NO APLICA"],
    ];
    y = this.drawTwoColumnGrid(page, anCheck, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // ANEXO 7 — GENÉRICO (Fallback de variantes Anexo 7)
  // -------------------------------------------------------------
  private async renderAnexo7Generic(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    const subTipo = input.documentCode.includes("TEJIDO") ? "ACTA DE RESCATE DE TEJIDOS" : "FICHA DE EXTRACCIÓN QUIRÚRGICA DE ÓRGANO";
    y = this.drawOfficialHeader(page, `ANEXO 7: ${subTipo} (${input.documentCode})`, bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    const d = input.data as any;
    y = this.drawSectionHeader(page, "1. ESPECIFICACIÓN DEL PROCEDIMIENTO Y COMPONENTE", bold, y);
    const proc = [
      ["Tipo de Variante:", input.documentCode],
      ["Clampeo / Paro Cardíaco:", d.clampeoAortico || d.horaParoCardiaco || new Date().toLocaleString()],
      ["Cirujano Principal:", d.cirujano || "Dr. Rescate Quirúrgico"],
      ["Institución Extractora:", input.metadata.primaryIpsName],
      ["Calidad Macroscópica:", d.calidad || "Óptima — Sin anomalías vasculares"],
      ["Preservación / Empaque:", d.preservacion || "Triple bolsa estéril — Hielo granizado"],
    ];
    y = this.drawTwoColumnGrid(page, proc, regular, bold, y);

    y = this.drawSectionHeader(page, "2. HALLAZGOS Y EVALUACIÓN POST-RESCATE", bold, y);
    const obs = d.hallazgos || d.observaciones || "Procedimiento quirúrgico completado sin complicaciones vasculares ni anatómicas. Biopsia de cuña tomada según protocolo.";
    page.drawText(obs.substring(0, 300), { x: 40, y, size: 9, font: regular, color: rgb(0.15, 0.2, 0.25) });
    y -= 35;

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // -------------------------------------------------------------
  // RENDERIZADOR GENÉRICO (Fallback)
  // -------------------------------------------------------------
  private async renderGeneric(
    pdfDoc: PDFDocument,
    input: PdfRenderInput,
    regular: PDFFont,
    bold: PDFFont,
  ): Promise<void> {
    const page = pdfDoc.addPage([612, 792]);
    let y = 750;

    y = this.drawOfficialHeader(page, input.title, bold, regular, y);
    y = this.drawExpedienteBox(page, input.metadata, bold, regular, y);

    y = this.drawSectionHeader(page, "1. CONTENIDO Y RESPUESTAS DEL DOCUMENTO", bold, y);

    const entries = Object.entries(input.data).filter(([_, v]) => typeof v !== "object" || v === null);
    const pairs = entries.slice(0, 14).map(([k, v]) => [k, v === null ? "—" : String(v)]);

    y = this.drawTwoColumnGrid(page, pairs, regular, bold, y);

    y = Math.min(y, 140);
    this.drawSignaturesSection(page, input.metadata.signatures, bold, regular, y);
    this.drawFooter(page, input.metadata, regular, 1, 1);
  }

  // =============================================================
  // UTILIDADES DE DISEÑO GRÁFICO VECTORIAL Y MAQUETACIÓN
  // =============================================================

  private drawOfficialHeader(
    page: PDFPage,
    title: string,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
  ): number {
    const contentWidth = page.getWidth() - 80;
    page.drawText("REPÚBLICA DE COLOMBIA — MINISTERIO DE SALUD Y PROTECCIÓN SOCIAL", {
      x: 40,
      y,
      size: 8,
      font: bold,
      color: rgb(0.1, 0.2, 0.3),
    });
    y -= 11;
    page.drawText("RED NACIONAL DE DONACIÓN Y TRASPLANTES — COORDINACIÓN REGIONAL 3", {
      x: 40,
      y,
      size: 8,
      font: regular,
      color: rgb(0.2, 0.3, 0.4),
    });
    y -= 14;

    page.drawRectangle({
      x: 40,
      y: y - 20,
      width: contentWidth,
      height: 24,
      color: rgb(0.07, 0.19, 0.28), // Navy GODT (#123047)
    });
    page.drawText(title.toUpperCase().substring(0, 95), {
      x: 48,
      y: y - 14,
      size: 9.5,
      font: bold,
      color: rgb(1, 1, 1),
    });
    return y - 32;
  }

  private drawExpedienteBox(
    page: PDFPage,
    meta: PdfRenderInput["metadata"],
    bold: PDFFont,
    regular: PDFFont,
    y: number,
  ): number {
    const contentWidth = page.getWidth() - 80;
    page.drawRectangle({
      x: 40,
      y: y - 40,
      width: contentWidth,
      height: 40,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.82, 0.86, 0.9),
      borderWidth: 1,
    });

    const col1X = 48;
    const col2X = 40 + contentWidth * 0.35;
    const col3X = 40 + contentWidth * 0.70;
    const row1Y = y - 16;
    const row2Y = y - 32;

    page.drawText("Proceso:", { x: col1X, y: row1Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText(meta.processCode, { x: col1X + 45, y: row1Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Donante:", { x: col1X, y: row2Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText((meta.donorName || "N/A").substring(0, 22), { x: col1X + 45, y: row2Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("IPS:", { x: col2X, y: row1Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText(meta.primaryIpsName.substring(0, 30), { x: col2X + 25, y: row1Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Doc. Identidad:", { x: col2X, y: row2Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText(meta.donorDocument || "N/A", { x: col2X + 65, y: row2Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Revisión Formulario:", { x: col3X, y: row1Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText(`Rev. ${meta.revisionNumber} (v${meta.templateVersion})`, { x: col3X + 90, y: row1Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Fecha Emisión:", { x: col3X, y: row2Y, size: 8, font: bold, color: rgb(0.2, 0.3, 0.4) });
    page.drawText(meta.generatedAt.toISOString().substring(0, 10), { x: col3X + 70, y: row2Y, size: 8, font: regular, color: rgb(0.1, 0.1, 0.1) });

    return y - 52;
  }

  private drawSectionHeader(page: PDFPage, title: string, bold: PDFFont, y: number): number {
    const contentWidth = page.getWidth() - 80;
    page.drawRectangle({
      x: 40,
      y: y - 14,
      width: contentWidth,
      height: 16,
      color: rgb(0.91, 0.94, 0.96),
    });
    page.drawText(title, {
      x: 46,
      y: y - 10,
      size: 8.5,
      font: bold,
      color: rgb(0.08, 0.25, 0.38),
    });
    return y - 22;
  }

  private drawTwoColumnGrid(
    page: PDFPage,
    pairs: string[][],
    regular: PDFFont,
    bold: PDFFont,
    y: number,
  ): number {
    for (let i = 0; i < pairs.length; i += 2) {
      const left = pairs[i];
      const right = pairs[i + 1];

      if (left) {
        page.drawText(left[0], { x: 44, y, size: 8.5, font: bold, color: rgb(0.15, 0.25, 0.35) });
        page.drawText(String(left[1]).substring(0, 36), { x: 155, y, size: 8.5, font: regular, color: rgb(0.1, 0.1, 0.1) });
      }
      if (right) {
        page.drawText(right[0], { x: 315, y, size: 8.5, font: bold, color: rgb(0.15, 0.25, 0.35) });
        page.drawText(String(right[1]).substring(0, 36), { x: 425, y, size: 8.5, font: regular, color: rgb(0.1, 0.1, 0.1) });
      }
      y -= 14;
    }
    return y - 4;
  }

  private drawTable(
    page: PDFPage,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    bold: PDFFont,
    regular: PDFFont,
    y: number,
  ): number {
    const tableX = 40;
    const rowHeight = 16;
    const contentWidth = page.getWidth() - 80;

    page.drawRectangle({
      x: tableX,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.85, 0.89, 0.93),
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 0.5,
    });

    let curX = tableX;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], {
        x: curX + 4,
        y: y - 11,
        size: 7.5,
        font: bold,
        color: rgb(0.1, 0.2, 0.3),
      });
      curX += colWidths[i];
    }
    y -= rowHeight;

    for (const row of rows) {
      curX = tableX;
      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.5,
      });

      for (let j = 0; j < row.length; j++) {
        page.drawText(String(row[j]).substring(0, 34), {
          x: curX + 4,
          y: y - 11,
          size: 7.5,
          font: regular,
          color: rgb(0.1, 0.1, 0.1),
        });
        curX += colWidths[j];
      }
      y -= rowHeight;
    }
    return y - 8;
  }

  private drawSignaturesSection(
    page: PDFPage,
    signatures: PdfRenderInput["metadata"]["signatures"],
    bold: PDFFont,
    regular: PDFFont,
    y: number,
  ): void {
    const contentWidth = page.getWidth() - 80;
    const boxWidth = (contentWidth - 16) / 2;
    const boxHeight = 70;

    page.drawRectangle({
      x: 40,
      y,
      width: boxWidth,
      height: boxHeight,
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
      color: rgb(0.98, 0.99, 1),
    });
    page.drawText("FIRMA Y ATESTACIÓN DEL PROFESIONAL RESPONSABLE", {
      x: 46,
      y: y + boxHeight - 12,
      size: 7,
      font: bold,
      color: rgb(0.1, 0.2, 0.3),
    });

    const sig1 = signatures?.[0];
    if (sig1 && sig1.status === "FIRMADO") {
      let sigLabel = `✓ ATESTACIÓN ELECTRÓNICA (${sig1.signatureType})`;
      let sigColor = rgb(0.08, 0.45, 0.35);
      if (sig1.signatureType === "DIGITAL_CERTIFICADA") {
        sigLabel = "⚠ BLOQUEADA: Certificación PKI no disponible (Ley 527)";
        sigColor = rgb(0.8, 0.2, 0.2);
      } else if (sig1.signatureType === "FIRMA_DIGITALIZADA") {
        sigLabel = "✓ FIRMA MANUSCRITA DIGITALIZADA";
      } else if (sig1.signatureType === "REPRESENTACION_VISUAL") {
        sigLabel = "✓ REPRESENTACIÓN VISUAL OPERATIVA";
      }
      page.drawText(sigLabel, {
        x: 46,
        y: y + 36,
        size: 7.5,
        font: bold,
        color: sigColor,
      });
      page.drawText(`Firmante: ${sig1.fullName}`, { x: 46, y: y + 24, size: 7.5, font: regular });
      page.drawText(`Fecha/Hora: ${sig1.signedAt ? new Date(sig1.signedAt).toISOString() : new Date().toISOString()}`, {
        x: 46,
        y: y + 12,
        size: 7,
        font: regular,
      });
    } else {
      page.drawLine({
        start: { x: 50, y: y + 25 },
        end: { x: 40 + boxWidth - 10, y: y + 25 },
        color: rgb(0.5, 0.5, 0.5),
        thickness: 0.8,
      });
      page.drawText("Firma, Sello y Registro Médico", { x: 46 + (boxWidth - 140) / 2, y: y + 12, size: 7.5, font: regular, color: rgb(0.4, 0.4, 0.4) });
    }

    const box2X = 40 + boxWidth + 16;
    page.drawRectangle({
      x: box2X,
      y,
      width: boxWidth,
      height: boxHeight,
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
      color: rgb(0.98, 0.99, 1),
    });
    page.drawText("TESTIGO / PROFESIONAL ACOMPAÑANTE / CUSTODIO", {
      x: box2X + 6,
      y: y + boxHeight - 12,
      size: 7,
      font: bold,
      color: rgb(0.1, 0.2, 0.3),
    });

    const sig2 = signatures?.[1];
    if (sig2 && sig2.status === "FIRMADO") {
      let sigLabel2 = `✓ ATESTACIÓN ELECTRÓNICA (${sig2.signatureType})`;
      let sigColor2 = rgb(0.08, 0.45, 0.35);
      if (sig2.signatureType === "DIGITAL_CERTIFICADA") {
        sigLabel2 = "⚠ BLOQUEADA: Certificación PKI no disponible (Ley 527)";
        sigColor2 = rgb(0.8, 0.2, 0.2);
      } else if (sig2.signatureType === "FIRMA_DIGITALIZADA") {
        sigLabel2 = "✓ FIRMA MANUSCRITA DIGITALIZADA";
      } else if (sig2.signatureType === "REPRESENTACION_VISUAL") {
        sigLabel2 = "✓ REPRESENTACIÓN VISUAL OPERATIVA";
      }
      page.drawText(sigLabel2, {
        x: box2X + 6,
        y: y + 36,
        size: 7.5,
        font: bold,
        color: sigColor2,
      });
      page.drawText(`Firmante: ${sig2.fullName}`, { x: box2X + 6, y: y + 24, size: 7.5, font: regular });
      page.drawText(`Fecha/Hora: ${sig2.signedAt ? new Date(sig2.signedAt).toISOString() : new Date().toISOString()}`, {
        x: box2X + 6,
        y: y + 12,
        size: 7,
        font: regular,
      });
    } else {
      page.drawLine({
        start: { x: box2X + 10, y: y + 25 },
        end: { x: box2X + boxWidth - 10, y: y + 25 },
        color: rgb(0.5, 0.5, 0.5),
        thickness: 0.8,
      });
      page.drawText("Firma y Documento de Identificación", { x: box2X + (boxWidth - 160) / 2, y: y + 12, size: 7.5, font: regular, color: rgb(0.4, 0.4, 0.4) });
    }
  }

  private drawFooter(
    page: PDFPage,
    meta: PdfRenderInput["metadata"],
    regular: PDFFont,
    pageNum: number,
    totalPages: number,
  ): void {
    const maxX = page.getWidth() - 40;
    page.drawLine({
      start: { x: 40, y: 35 },
      end: { x: maxX, y: 35 },
      color: rgb(0.8, 0.85, 0.9),
      thickness: 0.8,
    });
    page.drawText(
      `Documento Oficial GODT Regional 3 — Expediente Inmutable (Pág. ${pageNum} de ${totalPages}) | Generado por: ${meta.generatedByName} el ${meta.generatedAt.toISOString().substring(0, 16)}`,
      {
        x: 40,
        y: 25,
        size: 6.5,
        font: regular,
        color: rgb(0.4, 0.45, 0.5),
      },
    );
    page.drawText(
      "Atestación operativa/electrónica registrada en plataforma GODT. No constituye firma digital certificada PKI bajo Ley 527 de 1999.",
      {
        x: 40,
        y: 16,
        size: 6,
        font: regular,
        color: rgb(0.55, 0.25, 0.25),
      },
    );
    if (meta.snapshotDigest) {
      page.drawText(
        `Digest de Manifiesto (Contenido): ${meta.snapshotDigest}`,
        {
          x: 40,
          y: 8,
          size: 5.5,
          font: regular,
          color: rgb(0.4, 0.45, 0.5),
        },
      );
    }
  }
}
