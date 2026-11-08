import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";

describe("InstitutionalDocumentService & Real PDF Overlay (Fase G.1.3)", () => {
  let service: InstitutionalDocumentService;
  let pdfRenderer: PdfRenderEngineService;

  beforeEach(() => {
    service = new InstitutionalDocumentService();
    pdfRenderer = new PdfRenderEngineService(service);
  });

  describe("Inventario Canónico de Documentos Institucionales", () => {
    it("debe listar los 19 formatos oficiales y los 4 documentos fuente complementarios", () => {
      const inventory = service.listInstitutionalInventory();
      expect(inventory.length).toBeGreaterThanOrEqual(23);

      const officialFormats = inventory.filter((i) => i.status === "OFFICIAL_HOMOLOGATED");
      expect(officialFormats.length).toBe(19);

      const sourceAttachments = inventory.filter((i) => i.status === "COMPLEMENTARY_SOURCE");
      expect(sourceAttachments.length).toBe(4);
    });

    it("las 4 posiciones normativas 20–23 deben permanecer en PENDING_HOMOLOGATION sin plantilla dinámica", () => {
      // Las posiciones 20-23 no tienen archivos de plantilla dinámica oficiales en el inventario de overlay
      expect(service.hasOriginalPdf("POS_NORMATIVA_20")).toBe(false);
      expect(service.hasOriginalPdf("POS_NORMATIVA_21")).toBe(false);
      expect(service.hasOriginalPdf("POS_NORMATIVA_22")).toBe(false);
      expect(service.hasOriginalPdf("POS_NORMATIVA_23")).toBe(false);
    });

    it("los 4 documentos complementarios deben clasificarse como COMPLEMENTARY_SOURCE", () => {
      const hemo = service.getOriginalMetadata("calculo_hemodilucion");
      expect(hemo.status).toBe("COMPLEMENTARY_SOURCE");
      expect(hemo.renderMode).toBe("SOURCE_ATTACHMENT");

      const covid = service.getOriginalMetadata("evaluacion_covid_tissue_bank");
      expect(covid.status).toBe("COMPLEMENTARY_SOURCE");

      const hc2024 = service.getOriginalMetadata("hc_donante_2024");
      expect(hc2024.status).toBe("COMPLEMENTARY_SOURCE");

      const hcTb = service.getOriginalMetadata("historia_clinica_tissue_bank");
      expect(hcTb.status).toBe("COMPLEMENTARY_SOURCE");
    });
  });

  describe("Metadatos y Archivos Físicos Originales", () => {
    it("debe obtener metadatos completos y calcular SHA-256 del Anexo 1 oficial", () => {
      const meta = service.getOriginalMetadata("ANEXO_1");
      expect(meta.documentCode.toUpperCase()).toBe("ANEXO_1");
      expect(meta.mimeType).toBe("application/pdf");
      expect(meta.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
      expect(meta.pageCount).toBe(2);
      expect(meta.dimensions[0].width).toBe(612);
      expect(meta.dimensions[0].height).toBe(1008);
      expect(meta.hasAcroForm).toBe(false);
      expect(meta.status).toBe("OFFICIAL_HOMOLOGATED");
    });

    it("debe retornar el buffer binario real del formato Anexo 1 con cabecera %PDF", () => {
      const buffer = service.getOriginalDocumentBuffer("ANEXO_1");
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("debe identificar correctamente Anexo 5 como formato DOCX sin PDF estático directo", () => {
      expect(service.hasOriginalPdf("ANEXO_5")).toBe(false);
      const meta = service.getOriginalMetadata("ANEXO_5");
      expect(meta.mimeType).toContain("openxmlformats-officedocument");
      expect(meta.renderMode).toBe("VECTOR_GENERATED");
    });
  });

  describe("Renderizado con Superposición Vectorial sobre Formato Institucional", () => {
    it("debe estampar respuestas y generar un PDF válido sobre el fondo original de Anexo 1", async () => {
      const renderedBytes = await pdfRenderer.render({
        documentCode: "ANEXO_1",
        title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
        data: {
          fecha_notificacion: "2026-11-07",
          hora_notificacion: "14:30",
          nombre_donante: "JUAN CARLOS RESTREPO",
          tipo_documento: "CC",
          numero_documento: "1144123456",
          edad: 34,
          genero: "MASCULINO",
          ips_origen: "Hospital Universitario del Valle",
          servicio_hospitalario: "UCI Adultos",
          criterio_alerta: "GLASGOW <= 3 CON SOSPECHA DE MUERTE ENCEFALICA",
        },
        metadata: {
          processCode: "PROC-2026-REG3-001",
          rndCode: "RND-77889",
          donorName: "JUAN CARLOS RESTREPO",
          donorDocument: "1144123456",
          primaryIpsName: "Hospital Universitario del Valle",
          revisionNumber: 2,
          templateVersion: "1",
          generatedAt: new Date(),
          generatedByName: "COORDINATOR",
          snapshotDigest: "a1b2c3d4e5f6",
        },
      });

      expect(Buffer.isBuffer(renderedBytes)).toBe(true);
      expect(renderedBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(renderedBytes.length).toBeGreaterThan(1000);
    });
  });
});
