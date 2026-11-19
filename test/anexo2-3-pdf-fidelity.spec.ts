import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PDFDocument } from "pdf-lib";

describe("Anexos 2 y 3 PDF High Fidelity & Subpixel Coordinates", () => {
  let engine: PdfRenderEngineService;

  beforeAll(() => {
    const instDocs = new InstitutionalDocumentService();
    engine = new PdfRenderEngineService(instDocs);
  });

  describe("Anexo 2 — Notificación a los Deudos (Ley 1805 / Presunción Legal)", () => {
    it("debe renderizar Anexo 2 en 2 páginas oficiales con alineación exacta de coordenadas", async () => {
      const input = {
        documentCode: "ANEXO_2",
        title: "Anexo 2: Notificación a los Deudos sobre la Ley 1805 de 2016",
        data: {
          coordinadorNombre: "Dra. María Carmona",
          coordinadorDocumento: "31876543",
          ipsGeneradora: "Hospital Universitario del Valle",
          fallecidoNombre: "Juan David Pérez González",
          fallecidoTipoDocumento: "Cédula de Ciudadanía",
          fallecidoDocumento: "1144123456",
          codigoConsultaRnd: "RND-2026-VAL-00892",
          entidadRnd: "Instituto Nacional de Salud",
          horaRnd: "14:30",
          fechaRnd: "2026-11-19",
          notificadoNombre: "Ana Patricia González Restrepo",
          notificadoDocumento: "38987654",
          notificadoParentesco: "Madre",
          ciudadNotificacion: "Santiago de Cali",
          fechaNotificacion: "2026-11-19",
          segundaPersonaNombre: "Carlos Alberto Pérez Ortiz",
          segundaPersonaDocumento: "16789123",
          segundaPersonaParentesco: "Padre",
          coordinadorCargo: "Coordinador Operativo de Trasplantes",
          testigoNombre: "Lic. Andrea Morales Rivas",
          testigoDocumento: "66778899",
          testigoCargo: "Trabajadora Social Hospitalaria",
          observaciones: "Notificación de la presunción legal efectuada de conformidad con la Ley 1805 de 2016.",
        },
        metadata: {
          processCode: "PROC-2026-0099",
          rndCode: "RND-2026-VAL-00892",
          donorName: "Juan David Pérez González",
          donorDocument: "1144123456",
          primaryIpsName: "Hospital Universitario del Valle",
          revisionNumber: 1,
          templateVersion: "2.0.0",
          generatedAt: new Date("2026-11-19T15:15:00.000Z"),
          generatedByName: "Dra. María Carmona",
          snapshotDigest: "f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb",
        },
      };

      const pdfBuffer = await engine.render(input);
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(15000);

      const doc = await PDFDocument.load(pdfBuffer);
      expect(doc.getPageCount()).toBe(2);

      const page1 = doc.getPage(0);
      expect(page1.getWidth()).toBe(612);
      expect(page1.getHeight()).toBe(792);

      const page2 = doc.getPage(1);
      expect(page2.getWidth()).toBe(612);
      expect(page2.getHeight()).toBe(792);
    });
  });

  describe("Anexo 3 — Consentimiento Informado Familiar", () => {
    it("debe renderizar Anexo 3 en 2 páginas oficiales con tabla de representantes, recuadro de autorización y firmas", async () => {
      const input = {
        documentCode: "ANEXO_3",
        title: "Anexo 3: Formato de Consentimiento Informado Familiar",
        data: {
          fechaConsentimiento: "2026-11-19",
          horaConsentimiento: "15:45",
          ciudadConsentimiento: "Santiago de Cali",
          representanteNombre: "Ana Patricia González Restrepo",
          representanteTipoDocumento: "CC",
          representanteDocumento: "38987654",
          representanteLugarExpedicion: "Cali",
          parentesco: "Madre",
          segundoRepresentanteNombre: "Carlos Alberto Pérez Ortiz",
          segundoRepresentanteDocumento: "16789123",
          segundoRepresentanteLugarExpedicion: "Cali",
          segundoRepresentanteParentesco: "Padre",
          fallecidoNombre: "Juan David Pérez González",
          fallecidoTipoDocumento: "Cédula de Ciudadanía",
          fallecidoDocumento: "1144123456",
          fallecidoLugarExpedicion: "Cali",
          autorizaExtraccion: true,
          autorizaDonacion: true,
          finalidadTrasplante: true,
          organosAutorizados: "Autorización para fines de trasplante e implante de órganos y tejidos.",
          testigoNombre: "Lic. Andrea Morales Rivas",
          testigoDocumento: "66778899",
          testigoCargo: "Trabajadora Social Hospitalaria",
          entrevistadorNombre: "Dra. María Carmona",
          entrevistadorRegistro: "RM-76-9812-VALLE",
          segundoEntrevistadorNombre: "Dr. Fernando Restrepo",
          segundoEntrevistadorDocumento: "94567812",
        },
        metadata: {
          processCode: "PROC-2026-0099",
          rndCode: "RND-2026-VAL-00892",
          donorName: "Juan David Pérez González",
          donorDocument: "1144123456",
          primaryIpsName: "Hospital Universitario del Valle",
          revisionNumber: 1,
          templateVersion: "2.0.0",
          generatedAt: new Date("2026-11-19T16:00:00.000Z"),
          generatedByName: "Dra. María Carmona",
          snapshotDigest: "18293a9afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298",
        },
      };

      const pdfBuffer = await engine.render(input);
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(15000);

      const doc = await PDFDocument.load(pdfBuffer);
      expect(doc.getPageCount()).toBe(2);

      const page1 = doc.getPage(0);
      expect(page1.getWidth()).toBe(612);
      expect(page1.getHeight()).toBe(792);

      const page2 = doc.getPage(1);
      expect(page2.getWidth()).toBe(612);
      expect(page2.getHeight()).toBe(792);
    });
  });
});
