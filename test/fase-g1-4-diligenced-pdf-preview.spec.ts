import * as zlib from "node:zlib";
import { Reflector } from "@nestjs/core";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { InstitutionalDocumentController } from "../src/presentation/document-engine/institutional-document.controller";
import { JwtAuthGuard } from "../src/presentation/auth/jwt-auth.guard";

function extractAllTextFromPdfBuffer(buf: Buffer): string {
  const str = buf.toString("latin1");
  let allText = str;
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
      const decodedHex = decompressed.replace(/<([0-9A-Fa-f]+)>/g, (_, h) =>
        Buffer.from(h, "hex").toString("latin1"),
      );
      allText += " " + decompressed + " " + decodedHex;
    } catch {}
  }
  return allText;
}

describe("Fase G.1.4: Diligenced PDF Preview, Revision Isolation & Auth Security", () => {
  let docService: InstitutionalDocumentService;
  let pdfRenderer: PdfRenderEngineService;

  beforeAll(() => {
    docService = new InstitutionalDocumentService();
    pdfRenderer = new PdfRenderEngineService(docService);
  });

  describe("1. Inversión de Precedencia y Superposición Vectorial Fiel en Anexo 1", () => {
    it("debe sobreponer datos capturados en el formulario ignorando valores stale de metadata (Caso 3 Causa Raíz 1)", async () => {
      const pdfBytes = await pdfRenderer.render({
        documentCode: "ANEXO_1",
        title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
        data: {
          nombreDonante: "PRUEBA PDF GODT",
          numeroIdentificacion: "TEST-2026-001",
          ipsGeneradora: "Clínica Imbanaco",
          servicioHospitalario: "UCI Adultos",
          observacionesAlerta: "VALIDACION RENDER G1.4",
          causaMuerte: "Trauma Encefálico Severo Cerrado",
          glasgowScore: 3,
          tensionArterialSistolica: 120,
          tensionArterialDiastolica: 80,
          frecuenciaCardiaca: 82,
          temperaturaCorporal: 36.8,
        },
        metadata: {
          processCode: "PROC-TEST-2026-G14",
          donorName: "VALOR_VIEJO_DE_DONANTE",
          donorDocument: "DOC_VIEJO_INCORRECTO",
          primaryIpsName: "IPS_METADATA_OBSOLETA",
          revisionNumber: 1,
          templateVersion: "1.0.0",
          generatedAt: new Date("2026-11-08T10:00:00Z"),
          generatedByName: "COORDINATOR",
        },
      });

      expect(Buffer.isBuffer(pdfBytes)).toBe(true);
      const text = extractAllTextFromPdfBuffer(pdfBytes);

      // Verificación de los datos diligenciados prioritarios
      expect(text).toContain("PRUEBA PDF GODT");
      expect(text).not.toContain("VALOR_VIEJO_DE_DONANTE");

      expect(text).toContain("TEST-2026-001");
      expect(text).not.toContain("DOC_VIEJO_INCORRECTO");

      expect(text).toContain("Clínica Imbanaco");
      expect(text).not.toContain("IPS_METADATA_OBSOLETA");

      // Verificación de coordenadas añadidas para servicio y observaciones
      expect(text).toContain("UCI Adultos");
      expect(text).toContain("VALIDACION RENDER G1.4");
    });

    it("debe actualizar el PDF con la segunda revisión reflejando el nuevo texto y eliminando el anterior", async () => {
      // Revisión 2: Modificación de la observación
      const pdfRev2 = await pdfRenderer.render({
        documentCode: "ANEXO_1",
        title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
        data: {
          nombreDonante: "PRUEBA PDF GODT",
          numeroIdentificacion: "TEST-2026-001",
          ipsGeneradora: "Clínica Imbanaco",
          servicioHospitalario: "UCI Adultos",
          observacionesAlerta: "SEGUNDA REVISION PDF",
          causaMuerte: "Trauma Encefálico Severo Cerrado",
        },
        metadata: {
          processCode: "PROC-TEST-2026-G14",
          donorName: "PRUEBA PDF GODT",
          donorDocument: "TEST-2026-001",
          primaryIpsName: "Clínica Imbanaco",
          revisionNumber: 2,
          templateVersion: "1.0.0",
          generatedAt: new Date("2026-11-08T10:15:00Z"),
          generatedByName: "COORDINATOR",
        },
      });

      const textRev2 = extractAllTextFromPdfBuffer(pdfRev2);

      // Verificación de que la segunda revisión contiene el nuevo valor
      expect(textRev2).toContain("SEGUNDA REVISION PDF");
      expect(textRev2).not.toContain("VALIDACION RENDER G1.4");
      expect(textRev2).toContain("Rev #2");
    });
  });

  describe("2. Fidelidad y Precedencia en Anexo 4, Anexo 7 Variante y Anexo 8", () => {
    it("debe priorizar datos del formulario en Anexo 4", async () => {
      const pdfBytes = await pdfRenderer.render({
        documentCode: "ANEXO_4",
        title: "Anexo 4: Registro de Donante y Oferta",
        data: {
          donanteNombre: "DONANTE ANEXO 4 TEST",
          donanteDocumento: "CC-998877",
          ipsGeneradora: "Fundación Valle del Lili",
          donanteEdad: 42,
          causaMuerteDetalle: "Hemorragia Subaracnoidea Fisher IV",
        },
        metadata: {
          processCode: "PROC-ANX4-01",
          donorName: "NOMBRE_VIEJO",
          donorDocument: "DOC_VIEJO",
          primaryIpsName: "IPS_VIEJA",
          revisionNumber: 1,
          templateVersion: "1.0.0",
          generatedAt: new Date(),
          generatedByName: "COORDINATOR",
        },
      });

      const text = extractAllTextFromPdfBuffer(pdfBytes);
      expect(text).toContain("DONANTE ANEXO 4 TEST");
      expect(text).not.toContain("NOMBRE_VIEJO");
      expect(text).toContain("CC-998877");
      expect(text).toContain("Fundación Valle del Lili");
    });

    it("debe priorizar datos del formulario en Anexo 7 Cardiovascular", async () => {
      const pdfBytes = await pdfRenderer.render({
        documentCode: "ANEXO_7_CARDIOVASCULAR",
        title: "Anexo 7: Acta de Rescate de Tejido Cardiovascular",
        data: {
          donanteNombre: "DONANTE CARDIO TEST",
          nombreIps: "Hospital San Juan de Dios",
          bancoTejidos: "Banco Cardiovascular Regional 3",
          valvulasRescatadas: "Homoinjerto aórtico y pulmonar íntegros.",
        },
        metadata: {
          processCode: "PROC-CARDIO-01",
          donorName: "VIEJO_DONANTE_CARDIO",
          primaryIpsName: "IPS_ERRONEA",
          revisionNumber: 1,
          templateVersion: "1.0.0",
          generatedAt: new Date(),
          generatedByName: "CIRUJANO_EXTRACTOR",
        },
      });

      const text = extractAllTextFromPdfBuffer(pdfBytes);
      expect(text).toContain("DONANTE CARDIO TEST");
      expect(text).not.toContain("VIEJO_DONANTE_CARDIO");
      expect(text).toContain("Hospital San Juan de Dios");
    });

    it("debe priorizar datos del formulario en Anexo 8 (Cadena de Custodia)", async () => {
      const pdfBytes = await pdfRenderer.render({
        documentCode: "ANEXO_8",
        title: "Anexo 8: Formato Cadena de Custodia",
        data: {
          nombreDonante: "DONANTE CUSTODIA TEST",
          ipsGeneradora: "Hospital Mario Correa Rengifo",
        },
        metadata: {
          processCode: "PROC-CUSTODIA-01",
          donorName: "NOMBRE_VIEJO_CUSTODIA",
          primaryIpsName: "IPS_VIEJA_CUSTODIA",
          revisionNumber: 1,
          templateVersion: "1.0.0",
          generatedAt: new Date(),
          generatedByName: "CUSTODIO",
        },
      });

      const text = extractAllTextFromPdfBuffer(pdfBytes);
      expect(text).toContain("DONANTE CUSTODIA TEST");
      expect(text).not.toContain("NOMBRE_VIEJO_CUSTODIA");
      expect(text).toContain("Hospital Mario Correa Rengifo");
    });
  });

  describe("3. Control de Caché HTTP y Encabezados de Respuesta en Backend", () => {
    let controller: InstitutionalDocumentController;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        documentInstance: {
          findUnique: jest.fn(),
        },
        documentResponseRevision: {
          findUnique: jest.fn(),
        },
      };
      controller = new InstitutionalDocumentController(docService, pdfRenderer, mockPrisma);
    });

    it("getOriginalFile debe emitir encabezados no-cache y ETag estricto", () => {
      const headers: Record<string, any> = {};
      const mockRes: any = {
        setHeader: jest.fn((key: string, val: any) => {
          headers[key] = val;
        }),
        end: jest.fn(),
      };

      controller.getOriginalFile("anexo_1", "false", mockRes);

      expect(headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
      expect(headers["Pragma"]).toBe("no-cache");
      expect(headers["Expires"]).toBe("0");
      expect(headers["ETag"]).toMatch(/^"[a-f0-9]{64}"$/);
      expect(headers["Content-Type"]).toBe("application/pdf");
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("getPreviewPdf debe soportar revisionId y emitir encabezados no-cache y ETag", async () => {
      const instanceId = "inst-123";
      const rev1Id = "rev-001";
      const rev2Id = "rev-002";

      const mockInstance = {
        id: instanceId,
        documentCode: "anexo_1",
        donor: { fullName: "DONANTE BASE", documentNumber: "123", rndCode: "RND-1", originatingIpsName: "HUV" },
        process: { processCode: "PROC-999", primaryIpsName: "HUV" },
        processDocument: { title: "Anexo 1" },
        templateVersion: { versionNumber: "1.0.0" },
        currentRevision: {
          id: rev2Id,
          revisionNumber: 2,
          responseData: { nombreDonante: "DONANTE REV 2", numeroIdentificacion: "DOC-2", observacionesAlerta: "SEGUNDA" },
          createdAt: new Date(),
        },
        documentParticipants: [],
        custodyEvents: [],
      };

      mockPrisma.documentInstance.findUnique.mockResolvedValue(mockInstance);
      mockPrisma.documentResponseRevision.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === rev1Id) {
          return {
            id: rev1Id,
            documentInstanceId: instanceId,
            revisionNumber: 1,
            responseData: { nombreDonante: "DONANTE REV 1", numeroIdentificacion: "DOC-1", observacionesAlerta: "PRIMERA" },
            createdAt: new Date(),
          };
        }
        return null;
      });

      // 1. Petición para revisionId específica (rev1Id)
      const headersRev1: Record<string, any> = {};
      let bufferRev1: Buffer | null = null;
      const mockRes1: any = {
        setHeader: jest.fn((k: string, v: any) => { headersRev1[k] = v; }),
        end: jest.fn((b: Buffer) => { bufferRev1 = b; }),
      };

      await controller.getPreviewPdf(
        instanceId,
        "false",
        rev1Id,
        { userId: "u1", role: "COORDINATOR" } as any,
        mockRes1,
      );

      expect(headersRev1["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
      expect(headersRev1["Pragma"]).toBe("no-cache");
      expect(headersRev1["Expires"]).toBe("0");
      expect(headersRev1["ETag"]).toMatch(/^"[a-f0-9]{64}"$/);
      expect(bufferRev1).not.toBeNull();
      const textRev1 = extractAllTextFromPdfBuffer(bufferRev1!);
      expect(textRev1).toContain("DONANTE REV 1");
      expect(textRev1).toContain("PRIMERA");

      // 2. Petición sin revisionId (debe usar currentRevision, es decir rev2Id)
      const headersRev2: Record<string, any> = {};
      let bufferRev2: Buffer | null = null;
      const mockRes2: any = {
        setHeader: jest.fn((k: string, v: any) => { headersRev2[k] = v; }),
        end: jest.fn((b: Buffer) => { bufferRev2 = b; }),
      };

      await controller.getPreviewPdf(
        instanceId,
        "false",
        undefined,
        { userId: "u1", role: "COORDINATOR" } as any,
        mockRes2,
      );

      expect(headersRev2["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
      expect(bufferRev2).not.toBeNull();
      const textRev2 = extractAllTextFromPdfBuffer(bufferRev2!);
      expect(textRev2).toContain("DONANTE REV 2");
      expect(textRev2).toContain("SEGUNDA");
    });
  });

  describe("4. Seguridad de Autenticación RBAC y Protección de Rutas (Caso 1)", () => {
    it("el controlador InstitutionalDocumentController debe estar protegido globalmente con JwtAuthGuard", () => {
      const guards = Reflect.getMetadata("__guards__", InstitutionalDocumentController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThanOrEqual(1);
      const hasJwtGuard = guards.some((g: any) => g === JwtAuthGuard || g.name === "JwtAuthGuard");
      expect(hasJwtGuard).toBe(true);
    });
  });
});
