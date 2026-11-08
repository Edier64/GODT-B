import { Injectable, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { normalizeString } from "../institutions/normalization.helper";

export interface PageDimension {
  page: number;
  width: number;
  height: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
}

export interface InstitutionalDocumentMetadata {
  documentCode: string;
  templateCode: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  pageCount: number;
  dimensions: PageDimension[];
  hasAcroForm: boolean;
  status: "OFFICIAL_HOMOLOGATED" | "PENDING_HOMOLOGATION" | "COMPLEMENTARY_SOURCE";
  renderMode: "STATIC_OVERLAY" | "VECTOR_GENERATED" | "SOURCE_ATTACHMENT";
}

const TEMPLATE_FILE_MAP: Record<
  string,
  {
    filename: string;
    mimeType: string;
    title: string;
    status: InstitutionalDocumentMetadata["status"];
    renderMode: InstitutionalDocumentMetadata["renderMode"];
  }
> = {
  anexo_1: {
    filename: "anexo-1-formato-de-valoracion-alerta-posible-donante.pdf",
    mimeType: "application/pdf",
    title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_2: {
    filename: "anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf",
    mimeType: "application/pdf",
    title: "Anexo 2: Notificación a los Deudos sobre la Ley 1805 de 2016",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_3: {
    filename: "anexo-3-formato-consentimiento-donacion-legalizacion.pdf",
    mimeType: "application/pdf",
    title: "Anexo 3: Formato de Consentimiento Informado Familiar",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_4: {
    filename: "anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf",
    mimeType: "application/pdf",
    title: "Anexo 4: Registro de Donante y Oferta de Órganos y Tejidos",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_5: {
    filename: "anexo-5-formato-de-remision-de-muestras.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Anexo 5: Formato de Remisión de Muestras Biológicas",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "VECTOR_GENERATED",
  },
  anexo_6: {
    filename: "anexo-6-registro-general-de-extraccion.pdf",
    mimeType: "application/pdf",
    title: "Anexo 6: Registro General de Extracción Quirúrgica",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_ocular: {
    filename: "anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Acta de Rescate de Tejido Ocular",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_cardiovascular: {
    filename: "anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Acta de Rescate de Tejido Cardiovascular",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_osteomuscular: {
    filename: "anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Acta de Rescate de Tejido Osteomuscular",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_piel: {
    filename: "anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Acta de Rescate de Tejido Piel",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_corazon: {
    filename: "anexo-7-registro-extraccion-corazon-cardiectomia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Corazón (Cardiectomía)",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_higado: {
    filename: "anexo-7-registro-extraccion-higado-hepatectomia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Hígado (Hepatectomía)",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_otros_organos: {
    filename: "anexo-7-registro-extraccion-otros-organos.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Otros Órganos",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_pancreas: {
    filename: "anexo-7-registro-extraccion-pancreas.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Páncreas",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_pulmon: {
    filename: "anexo-7-registro-extraccion-pulmon-neumonectomia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Pulmón (Neumonectomía)",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_rinon_derecho: {
    filename: "anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Riñón Derecho",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_7_rinon_izquierdo: {
    filename: "anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 7: Registro de Extracción de Riñón Izquierdo",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_8: {
    filename: "anexo-8-formato-cadena-de-custodia.pdf",
    mimeType: "application/pdf",
    title: "Anexo 8: Formato de Cadena de Custodia de Órganos y Tejidos",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  anexo_9: {
    filename: "anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf",
    mimeType: "application/pdf",
    title: "Anexo 9: Carta INMLCF Entrega de Cuerpo en Procesos Médico-Legales",
    status: "OFFICIAL_HOMOLOGATED",
    renderMode: "STATIC_OVERLAY",
  },
  // Documentos complementarios clínicos (SourceDocument, no plantillas oficiales)
  calculo_hemodilucion: {
    filename: "Cálculo Hemodilución.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Cálculo de Hemodilución Regional 3",
    status: "COMPLEMENTARY_SOURCE",
    renderMode: "SOURCE_ATTACHMENT",
  },
  evaluacion_covid_tissue_bank: {
    filename: "Evaluación de riesgo COVID 19 Tissue Bank.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Evaluación de Riesgo COVID-19 Tissue Bank",
    status: "COMPLEMENTARY_SOURCE",
    renderMode: "SOURCE_ATTACHMENT",
  },
  hc_donante_2024: {
    filename: "HC Donante 2024.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Historia Clínica Donante 2024 (Soporte Fuente)",
    status: "COMPLEMENTARY_SOURCE",
    renderMode: "SOURCE_ATTACHMENT",
  },
  historia_clinica_tissue_bank: {
    filename: "Historia Clínica Tissue Bank.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Historia Clínica Tissue Bank (Soporte Fuente)",
    status: "COMPLEMENTARY_SOURCE",
    renderMode: "SOURCE_ATTACHMENT",
  },
};

@Injectable()
export class InstitutionalDocumentService {
  private readonly baseDir = path.resolve(process.cwd(), "docs", "documentos-reales");
  private readonly metadataCache = new Map<string, InstitutionalDocumentMetadata>();

  /**
   * Normaliza el código documental para resolución unívoca
   */
  normalizeDocumentCode(rawCode: string): string {
    const cleaned = normalizeString(rawCode).replace(/\s+/g, "_");
    if (cleaned.includes("anexo_1") || cleaned === "anexo_01") return "anexo_1";
    if (cleaned.includes("anexo_2") || cleaned === "anexo_02") return "anexo_2";
    if (cleaned.includes("anexo_3") || cleaned === "anexo_03") return "anexo_3";
    if (cleaned.includes("anexo_4") || cleaned === "anexo_04") return "anexo_4";
    if (cleaned.includes("anexo_5") || cleaned === "anexo_05") return "anexo_5";
    if (cleaned.includes("anexo_6") || cleaned === "anexo_06") return "anexo_6";
    if (cleaned.includes("ocular")) return "anexo_7_ocular";
    if (cleaned.includes("cardiovascular")) return "anexo_7_cardiovascular";
    if (cleaned.includes("osteomuscular")) return "anexo_7_osteomuscular";
    if (cleaned.includes("piel")) return "anexo_7_piel";
    if (cleaned.includes("corazon") || cleaned.includes("cardiectomia")) return "anexo_7_corazon";
    if (cleaned.includes("higado") || cleaned.includes("hepatectomia")) return "anexo_7_higado";
    if (cleaned.includes("otros_organos") || cleaned.includes("otros")) return "anexo_7_otros_organos";
    if (cleaned.includes("pancreas")) return "anexo_7_pancreas";
    if (cleaned.includes("pulmon") || cleaned.includes("neumonectomia")) return "anexo_7_pulmon";
    if (cleaned.includes("rinon_derecho")) return "anexo_7_rinon_derecho";
    if (cleaned.includes("rinon_izquierdo")) return "anexo_7_rinon_izquierdo";
    if (cleaned.includes("anexo_8") || cleaned === "anexo_08" || cleaned.includes("custodia")) return "anexo_8";
    if (cleaned.includes("anexo_9") || cleaned === "anexo_09" || cleaned.includes("inmlcf")) return "anexo_9";
    if (cleaned.includes("hemodilucion")) return "calculo_hemodilucion";
    if (cleaned.includes("covid")) return "evaluacion_covid_tissue_bank";
    if (cleaned.includes("hc_donante") || cleaned.includes("2024")) return "hc_donante_2024";
    if (cleaned.includes("tissue_bank")) return "historia_clinica_tissue_bank";
    return cleaned;
  }

  /**
   * Obtiene la ruta física del archivo original
   */
  getOriginalFilePath(documentCode: string): string {
    const key = this.normalizeDocumentCode(documentCode);
    const entry = TEMPLATE_FILE_MAP[key];
    if (!entry) {
      throw new NotFoundException(`No existe formato institucional mapeado para '${documentCode}'`);
    }

    const filePath = path.join(this.baseDir, entry.filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Archivo físico no encontrado en disco: '${entry.filename}'`);
    }
    return filePath;
  }

  /**
   * Determina si el formato dispone de un PDF institucional para renderizado con overlay
   */
  hasOriginalPdf(documentCode: string): boolean {
    try {
      const key = this.normalizeDocumentCode(documentCode);
      const entry = TEMPLATE_FILE_MAP[key];
      return Boolean(entry && entry.mimeType === "application/pdf");
    } catch {
      return false;
    }
  }

  /**
   * Obtiene el buffer del archivo original institucional
   */
  getOriginalDocumentBuffer(documentCode: string): Buffer {
    const filePath = this.getOriginalFilePath(documentCode);
    return fs.readFileSync(filePath);
  }

  /**
   * Obtiene los metadatos completos y computados del formato institucional
   */
  getOriginalMetadata(documentCode: string): InstitutionalDocumentMetadata {
    const key = this.normalizeDocumentCode(documentCode);
    if (this.metadataCache.has(key)) {
      return this.metadataCache.get(key)!;
    }

    const entry = TEMPLATE_FILE_MAP[key];
    if (!entry) {
      throw new NotFoundException(`No existe formato institucional mapeado para '${documentCode}'`);
    }

    const filePath = path.join(this.baseDir, entry.filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Archivo institucional '${entry.filename}' no disponible`);
    }

    const buffer = fs.readFileSync(filePath);
    const sha256Hash = createHash("sha256").update(buffer).digest("hex");
    const isPdf = entry.mimeType === "application/pdf";

    // Metadatos calculados de dimensiones por formato
    const dimensions = this.resolveDimensions(key);

    const metadata: InstitutionalDocumentMetadata = {
      documentCode: key.toUpperCase(),
      templateCode: key,
      title: entry.title,
      filename: entry.filename,
      mimeType: entry.mimeType,
      sizeBytes: buffer.length,
      sha256Hash,
      pageCount: isPdf ? dimensions.length : 0,
      dimensions,
      hasAcroForm: false, // Auditado: los formatos oficiales son PDFs vectoriales estáticos sin AcroForm
      status: entry.status,
      renderMode: entry.renderMode,
    };

    this.metadataCache.set(key, metadata);
    return metadata;
  }

  /**
   * Lista el inventario completo de los formatos institucionales y soportes clínicos
   */
  listInstitutionalInventory(): InstitutionalDocumentMetadata[] {
    return Object.keys(TEMPLATE_FILE_MAP).map((k) => this.getOriginalMetadata(k));
  }

  private resolveDimensions(key: string): PageDimension[] {
    switch (key) {
      case "anexo_1":
      case "anexo_4":
        const pCount1 = key === "anexo_1" ? 2 : 4;
        return Array.from({ length: pCount1 }, (_, i) => ({
          page: i + 1,
          width: 612,
          height: 1008,
          orientation: "PORTRAIT",
        }));

      case "anexo_7_ocular":
        return [
          { page: 1, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
          { page: 2, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
        ];

      case "anexo_7_cardiovascular":
      case "anexo_7_osteomuscular":
      case "anexo_7_piel":
        return [
          { page: 1, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
          { page: 2, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
          { page: 3, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
        ];

      case "anexo_8":
        return [
          { page: 1, width: 930.96, height: 606.96, orientation: "LANDSCAPE" },
          { page: 2, width: 933.96, height: 608.04, orientation: "LANDSCAPE" },
        ];

      case "anexo_2":
      case "anexo_3":
      case "anexo_6":
        return [
          { page: 1, width: 612, height: 792, orientation: "PORTRAIT" },
          { page: 2, width: 612, height: 792, orientation: "PORTRAIT" },
        ];

      case "anexo_7_corazon":
      case "anexo_7_higado":
      case "anexo_7_otros_organos":
      case "anexo_7_pancreas":
      case "anexo_7_pulmon":
      case "anexo_7_rinon_derecho":
      case "anexo_7_rinon_izquierdo":
      case "anexo_9":
        return [{ page: 1, width: 612, height: 792, orientation: "PORTRAIT" }];

      default:
        return [];
    }
  }
}
