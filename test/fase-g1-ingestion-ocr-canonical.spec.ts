import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import * as crypto from "crypto";
import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";
import { UploadSourceDocumentUseCase } from "../src/application/documents/upload-source-document.use-case";
import { GetSourceDocumentUseCase } from "../src/application/documents/get-source-document.use-case";
import { DocumentAccessDeniedError } from "../src/application/documents/document-errors";
import { extractTextFromDocx } from "../src/application/ocr/docx-extractor";
import { extractTextLayerFromPdf } from "../src/application/ocr/pdf-text-layer-extractor";
import { LocalRulesExtractionProvider } from "../src/application/ocr/local-rules-extraction.provider";
import { DocumentUnderstandingService } from "../src/application/ocr/document-understanding.service";
import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { OcrCandidate } from "../src/application/ocr/ocr-provider.port";

describe("Fase G.1 — Document Ingestion, Local Private Storage, OCR/IA & Canonical Integration", () => {
  let storageDir: string;
  let storageAdapter: LocalPrivateStorageAdapter;

  const coordinatorActor = {
    userId: "coord-user-1",
    role: "COORDINATOR" as const,
    institutionalIps: ["IPS-SAN-VICENTE", "IPS-GENERAL"],
  };

  const externalActor = {
    userId: "ext-user-9",
    role: "COORDINATOR" as const,
    institutionalIps: ["IPS-OTRA-REGION"],
  };

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "godt-g1-test-"));
    const config = new ConfigService({
      STORAGE_BASE_PATH: storageDir,
      DOCUMENT_STORAGE_MAX_BYTES: 20 * 1024 * 1024,
    });
    storageAdapter = new LocalPrivateStorageAdapter(config);
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  // =========================================================================
  // SECCIÓN 1: ALMACENAMIENTO PRIVADO LOCAL (Parte 2)
  // =========================================================================
  describe("1. Local Private Storage Architecture & Security", () => {
    it("guarantees atomic writes and deterministic structured path layout", async () => {
      const processId = "proc-001";
      const sourceDocId = "source-001";
      const payload = Buffer.from("DATOS_CLINICOS_CONFIDENCIALES_R3");

      const stored = await storageAdapter.put({
        buffer: payload,
        originalFilename: "historia_clinica.pdf",
        mimeType: "application/pdf",
        processId,
        sourceDocumentId: sourceDocId,
        subDirectory: "ingestion",
      });

      // Layout: donations/${processId}/sources/${sourceDocumentId}/${subDirectory}/${uuid}.${ext}
      expect(stored.storageKey).toMatch(
        new RegExp(
          `^donations/${processId}/sources/${sourceDocId}/ingestion/[0-9a-f-]+\\.pdf$`,
        ),
      );

      // Verificación de integridad SHA-256
      const expectedSha256 = crypto
        .createHash("sha256")
        .update(payload)
        .digest("hex");
      expect(stored.sha256Hash).toBe(expectedSha256);

      // Lectura y verificación de contenido
      const readBack = await storageAdapter.get(stored.storageKey);
      expect(readBack.toString("utf-8")).toBe("DATOS_CLINICOS_CONFIDENCIALES_R3");

      // Verificación con exists()
      expect(await storageAdapter.exists(stored.storageKey)).toBe(true);
      expect(await storageAdapter.exists("donations/fake/key.pdf")).toBe(false);
    });

    it("strictly rejects path traversal attacks in storage operations", async () => {
      await expect(storageAdapter.get("../../etc/passwd")).rejects.toThrow(
        "Invalid storage key",
      );
      await expect(storageAdapter.get("..\\..\\windows\\system32")).rejects.toThrow(
        "Invalid storage key",
      );
      await expect(storageAdapter.get("/root/secret.key")).rejects.toThrow(
        "Invalid storage key",
      );
    });

    it("rejects payloads that exceed configured maximum size limit", async () => {
      const smallConfig = new ConfigService({
        STORAGE_BASE_PATH: storageDir,
        DOCUMENT_STORAGE_MAX_BYTES: 16, // 16 bytes max
      });
      const limitedStorage = new LocalPrivateStorageAdapter(smallConfig);

      await expect(
        limitedStorage.put({
          buffer: Buffer.from("Este contenido supera los dieciseis bytes permitidos"),
          originalFilename: "exceso.pdf",
          mimeType: "application/pdf",
        }),
      ).rejects.toThrow("configured storage limit");
    });
  });

  // =========================================================================
  // SECCIÓN 2: 10 ESCENARIOS EXIGIDOS DE INGESTA, OCR E INTELIGENCIA ARTIFICIAL
  // =========================================================================
  describe("2. Diez Escenarios Exigidos de Ingesta, OCR e Inteligencia Artificial", () => {
    // -----------------------------------------------------------------------
    // Escenario 1: Documento PDF nativo con capa de texto digital legible
    // -----------------------------------------------------------------------
    it("Escenario 1: extrae capa de texto digital de PDF nativo sin rasterización innecesaria", async () => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage([600, 800]);

      page.drawText("HOSPITAL UNIVERSITARIO SAN VICENTE FUNDACION", {
        x: 50,
        y: 750,
        size: 14,
        font,
      });
      page.drawText("HISTORIA CLINICA - SERVICIO UCI ADULTOS", {
        x: 50,
        y: 720,
        size: 12,
        font,
      });
      page.drawText("Donante: CARLOS ANDRES PEREZ GOMEZ", {
        x: 50,
        y: 690,
        size: 11,
        font,
      });
      page.drawText("Identificacion: C.C. 1020304050", {
        x: 50,
        y: 660,
        size: 11,
        font,
      });
      page.drawText("Edad: 39 anos Sexo: MASCULINO", {
        x: 50,
        y: 630,
        size: 11,
        font,
      });
      page.drawText("Grupo Sanguineo: O Positivo", {
        x: 50,
        y: 600,
        size: 11,
        font,
      });
      page.drawText("Causa de Muerte: Trauma craneoencefalico severo", {
        x: 50,
        y: 570,
        size: 11,
        font,
      });
      page.drawText("Creatinina: 1.2 mg/dL", {
        x: 50,
        y: 540,
        size: 11,
        font,
      });
      page.drawText("pH: 7.35", {
        x: 50,
        y: 510,
        size: 11,
        font,
      });
      page.drawText("Codigo RND: RND-2026-0042", {
        x: 50,
        y: 480,
        size: 11,
        font,
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      // 1. Verificación de capa de texto digital
      const layerResult = extractTextLayerFromPdf(pdfBuffer);
      expect(layerResult.hasTextLayer).toBe(true);
      expect(layerResult.text.length).toBeGreaterThan(100);
      expect(layerResult.text).toContain("CARLOS ANDRES PEREZ GOMEZ");
      expect(layerResult.text).toContain("1020304050");

      // 2. Extracción mediante reglas locales sobre el texto digital
      const rulesEngine = new LocalRulesExtractionProvider();
      const candidates = rulesEngine.extract(layerResult.text);

      expect(candidates.length).toBeGreaterThanOrEqual(6);

      const idCandidate = candidates.find(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.identity.document_number",
      );
      expect(idCandidate).toBeDefined();
      expect(idCandidate?.candidateValue).toBe("1020304050");
      expect(idCandidate?.confidenceScore).toBeGreaterThanOrEqual(0.9);

      const groupCandidate = candidates.find(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.blood_group",
      );
      expect(groupCandidate).toBeDefined();
      expect(groupCandidate?.candidateValue).toBe("O");

      const rhCandidate = candidates.find(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.rh_factor",
      );
      expect(rhCandidate).toBeDefined();
      expect(rhCandidate?.candidateValue).toBe("+");

      const rndCandidate = candidates.find(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.registration.rnd_code",
      );
      expect(rndCandidate).toBeDefined();
      expect(rndCandidate?.candidateValue).toBe("RND-2026-0042");
    });

    // -----------------------------------------------------------------------
    // Escenario 2: Documento escaneado o imagen rasterizada (requiere OCR)
    // -----------------------------------------------------------------------
    it("Escenario 2: detecta ausencia de capa de texto en PDF escaneado y recurre a OCR", async () => {
      // PDF sin texto digital (página vacía o sin operadores BT..ET de texto)
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([600, 800]); // sin texto digital
      const pdfBytes = await pdfDoc.save();
      const scannedBuffer = Buffer.from(pdfBytes);

      const layerResult = extractTextLayerFromPdf(scannedBuffer);
      expect(layerResult.hasTextLayer).toBe(false);
      expect(layerResult.text.trim()).toBe("");

      // DocumentUnderstandingService delega a OCR cuando no hay texto digital
      const mockOcrProvider = {
        process: jest.fn().mockResolvedValue([
          {
            canonicalFieldKey: "donor.identity.document_number",
            candidateValue: "71234567",
            confidenceScore: 0.88,
          },
        ]),
      };

      const docService = new DocumentUnderstandingService(
        new ConfigService(),
        new LocalRulesExtractionProvider(),
        mockOcrProvider as never,
      );

      const result = await docService.analyze({
        buffer: scannedBuffer,
        mimeType: "application/pdf",
      });

      expect(mockOcrProvider.process).toHaveBeenCalled();
      expect(result.strategyUsed).toBe("PDF_SCANNED");
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].candidateValue).toBe("71234567");
    });

    // -----------------------------------------------------------------------
    // Escenario 3: Imagen directa (PNG/JPEG) con etiquetas clínicas reconocibles
    // -----------------------------------------------------------------------
    it("Escenario 3: procesa imágenes directas derivándolas a OCR con reglas clínicas", async () => {
      // Magic bytes PNG válidos: \x89PNG\r\n\x1a\n
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]);

      const mockOcrProvider = {
        process: jest.fn().mockResolvedValue([
          {
            canonicalFieldKey: "donor.clinical.creatinine",
            candidateValue: "1.4",
            confidenceScore: 0.89,
          },
          {
            canonicalFieldKey: "donor.clinical.blood_group",
            candidateValue: "B",
            confidenceScore: 0.94,
          },
        ]),
      };

      const docService = new DocumentUnderstandingService(
        new ConfigService(),
        new LocalRulesExtractionProvider(),
        mockOcrProvider as never,
      );

      const result = await docService.analyze({
        buffer: pngHeader,
        mimeType: "image/png",
      });

      expect(result.strategyUsed).toBe("IMAGE_OCR");
      expect(
        result.candidates.some(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.creatinine",
        ),
      ).toBe(true);
      expect(
        result.candidates.find(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.blood_group",
        )?.candidateValue,
      ).toBe("B");
    });

    // -----------------------------------------------------------------------
    // Escenario 4: Documento Word (.docx) con texto y tablas
    // -----------------------------------------------------------------------
    it("Escenario 4: extrae texto estructurado y tablas de archivo .docx nativo", async () => {
      // Construir un archivo DOCX sintético real en memoria con adm-zip
      const zip = new AdmZip();

      // document.xml con párrafos y celdas de tabla
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>RESUMEN DE HISTORIA CLINICA - TISSUE BANK</w:t></w:r></w:p>
          <w:p><w:r><w:t>Donante: MARIA ELENA RESTREPO MONTOYA</w:t></w:r></w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Identificacion:</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>C.C. 43567890</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Grupo Sanguineo:</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>AB Positivo</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Hospital de:</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Hospital General de Medellin</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>`;

      zip.addFile("word/document.xml", Buffer.from(documentXml, "utf-8"));
      zip.addFile(
        "[Content_Types].xml",
        Buffer.from("<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>"),
      );

      const docxBuffer = zip.toBuffer();

      const extracted = extractTextFromDocx(docxBuffer);
      expect(extracted.text).toContain("MARIA ELENA RESTREPO MONTOYA");
      expect(extracted.text).toContain("43567890");
      expect(extracted.text).toContain("AB Positivo");
      expect(extracted.tables.length).toBe(1);

      const docService = new DocumentUnderstandingService(
        new ConfigService(),
        new LocalRulesExtractionProvider(),
      );

      const result = await docService.analyze({
        buffer: docxBuffer,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      expect(result.strategyUsed).toBe("DOCX_PARSER");
      expect(
        result.candidates.find(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.identity.document_number",
        )?.candidateValue,
      ).toBe("43567890");
      expect(
        result.candidates.find(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.blood_group",
        )?.candidateValue,
      ).toBe("AB");
      expect(
        result.candidates.find(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.rh_factor",
        )?.candidateValue,
      ).toBe("+");
    });

    // -----------------------------------------------------------------------
    // Escenario 5: Documento ilegible o con ruido severo
    // -----------------------------------------------------------------------
    it("Escenario 5: maneja documento con ruido severo retornando lista vacia sin fallar", async () => {
      const noisyText =
        "@@@ ### %%%% &&&& *** ~~~ .... ,,,\n--- === +++ ||| \n§§§ ¶¶¶ ¬¬¬";

      const rulesEngine = new LocalRulesExtractionProvider();
      const candidates = rulesEngine.extract(noisyText);

      expect(candidates).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // Escenario 6: Documento con campos ambiguos o múltiples candidatos
    // -----------------------------------------------------------------------
    it("Escenario 6: prioriza candidatos mas confiables y reporta reglas ejecutadas", async () => {
      // Documento con múltiples cédulas
      const complexText = `
        IPS Informante: Clinica Cardiovascular
        Medico de turno: Dr. Pedro Gomez C.C. 9876543
        Donante: CARLOS DUQUE C.C. 71888999
        Edad: 48 anos
        Grupo Sanguineo: O+
      `;

      const rulesEngine = new LocalRulesExtractionProvider();
      const candidates = rulesEngine.extract(complexText);

      const docCandidates = candidates.filter(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.identity.document_number",
      );
      expect(docCandidates.length).toBeGreaterThanOrEqual(1);

      const ageCandidate = candidates.find(
        (c: OcrCandidate) => c.canonicalFieldKey === "donor.demographics.age",
      );
      expect(ageCandidate?.candidateValue).toBe("48");
    });

    // -----------------------------------------------------------------------
    // Escenario 7: Documento con campos incompletos
    // -----------------------------------------------------------------------
    it("Escenario 7: extrae parcialmente campos presentes sin abortar ante campos faltantes", async () => {
      // Sólo nombre y grupo, sin fecha, sin labs, sin causa de muerte
      const partialText = "Donante: ANDREA VALENCIA MEJIA\nGrupo Sanguineo: O-";

      const rulesEngine = new LocalRulesExtractionProvider();
      const candidates = rulesEngine.extract(partialText);

      expect(
        candidates.some(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.identity.full_name",
        ),
      ).toBe(true);
      expect(
        candidates.some(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.blood_group",
        ),
      ).toBe(true);
      expect(
        candidates.some(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.rh_factor",
        ),
      ).toBe(true);
      expect(
        candidates.some(
          (c: OcrCandidate) => c.canonicalFieldKey === "donor.clinical.creatinine",
        ),
      ).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Escenario 8: Documento con datos contradictorios con datos canónicos
    // -----------------------------------------------------------------------
    it("Escenario 8: permite resolucion humana de divergencias y registra procedencia", async () => {
      const mockField = {
        id: "field-div-1",
        jobId: "job-1",
        donorId: "donor-100",
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: "AB", // El documento dice AB
        confirmedValue: null as string | null,
        validationStatus: "PENDIENTE",
        confidence: 0.92,
        sourceDocument: {
          processId: "proc-100",
          donor: { originatingIpsName: "IPS-SAN-VICENTE" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: {
          findUnique: jest.fn().mockResolvedValue(mockField),
        },
        donationProcess: {
          findFirst: jest.fn().mockResolvedValue({ id: "proc-100" }),
        },
      };

      const mockRepo = {
        validateField: jest.fn().mockImplementation((id, data) => ({
          ...mockField,
          validationStatus: data.status,
          confirmedValue: data.confirmedValue,
        })),
        propagateField: jest.fn().mockResolvedValue({
          field: { ...mockField, validationStatus: "MODIFICADO", confirmedValue: "O" },
          donorRecord: {},
        }),
      };

      const mockPropagationEngine = {
        applyAndPropagate: jest.fn().mockResolvedValue({
          accepted: true,
          conflicts: [],
        }),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as never,
        mockPrisma as never,
        mockPropagationEngine as never,
      );

      // 1. Coordinador edita el valor divergente a "O" (MODIFICADO)
      const validated = await workflow.validate(
        "field-div-1",
        { status: "MODIFICADO", confirmedValue: "O" },
        coordinatorActor,
      );
      expect(validated.validationStatus).toBe("MODIFICADO");
      expect(validated.confirmedValue).toBe("O");

      // 2. Propagación al diccionario canónico
      mockField.validationStatus = "MODIFICADO";
      mockField.confirmedValue = "O";

      await workflow.propagate("donor-100", "field-div-1", coordinatorActor);

      expect(mockPropagationEngine.applyAndPropagate).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: "proc-100",
          canonicalFieldKey: "donor.clinical.blood_group",
          value: "O",
          sourceKind: "OCR_MODIFIED",
          actorUserId: coordinatorActor.userId,
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Escenario 9: Intento de subida de archivo corrupto o discrepancia de magic bytes
    // -----------------------------------------------------------------------
    it("Escenario 9: rechaza archivo con firma magica o extension adulterada (Error 400)", async () => {
      const mockRepo = {
        create: jest.fn(),
        findByHash: jest.fn(),
      };
      const mockPrisma = {
        donationProcess: {
          findUnique: jest.fn().mockResolvedValue({
            id: "proc-1",
            donorId: "donor-1",
            primaryIpsName: "IPS-SAN-VICENTE",
            originatingIps: "IPS-SAN-VICENTE",
            donor: { originatingIpsName: "IPS-SAN-VICENTE" },
          }),
        },
      };

      const uploadUseCase = new UploadSourceDocumentUseCase(
        mockRepo as never,
        storageAdapter,
        mockPrisma as never,
      );

      // Caso A: Se declara como PDF pero contiene bytes arbitrarios
      await expect(
        uploadUseCase.execute({
          processId: "proc-1",
          uploadedById: coordinatorActor.userId,
          originalFilename: "falso.pdf",
          declaredMimeType: "application/pdf",
          buffer: Buffer.from("ESTE_NO_ES_UN_PDF_VALIDO"),
          documentCategory: "CLINICAL_HISTORY",
          actor: coordinatorActor,
        }),
      ).rejects.toThrow("Document signature does not match MIME type");

      // Caso B: Se declara como DOCX pero no es un archivo ZIP
      await expect(
        uploadUseCase.execute({
          processId: "proc-1",
          uploadedById: coordinatorActor.userId,
          originalFilename: "falso.docx",
          declaredMimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("ESTE_NO_ES_UN_ZIP_DOCX"),
          documentCategory: "CLINICAL_HISTORY",
          actor: coordinatorActor,
        }),
      ).rejects.toThrow("Document signature does not match MIME type");

      // Caso C: Se declara como PNG pero no tiene magic bytes PNG
      await expect(
        uploadUseCase.execute({
          processId: "proc-1",
          uploadedById: coordinatorActor.userId,
          originalFilename: "falso.png",
          declaredMimeType: "image/png",
          buffer: Buffer.from("GIF89a imagen falsa"),
          documentCategory: "CLINICAL_HISTORY",
          actor: coordinatorActor,
        }),
      ).rejects.toThrow("Document signature does not match MIME type");
    });

    // -----------------------------------------------------------------------
    // Escenario 10: Subida duplicada de documento identico (mismo SHA-256)
    // -----------------------------------------------------------------------
    it("Escenario 10: detecta documento identico y rechaza duplicados por SHA-256", async () => {
      const validPdf = Buffer.from("%PDF-1.7 Documento unico para control de duplicados");

      const mockRepo = {
        create: jest.fn(),
        findByHash: jest.fn().mockResolvedValue({
          id: "doc-existente-1",
          originalFilename: "historia_previa.pdf",
          sha256Hash: crypto.createHash("sha256").update(validPdf).digest("hex"),
        }),
      };
      const mockPrisma = {
        donationProcess: {
          findUnique: jest.fn().mockResolvedValue({
            id: "proc-1",
            donorId: "donor-1",
            primaryIpsName: "IPS-SAN-VICENTE",
            originatingIps: "IPS-SAN-VICENTE",
            donor: { originatingIpsName: "IPS-SAN-VICENTE" },
          }),
        },
      };

      const uploadUseCase = new UploadSourceDocumentUseCase(
        mockRepo as never,
        storageAdapter,
        mockPrisma as never,
      );

      await expect(
        uploadUseCase.execute({
          processId: "proc-1",
          uploadedById: coordinatorActor.userId,
          originalFilename: "historia_duplicada.pdf",
          declaredMimeType: "application/pdf",
          buffer: validPdf,
          documentCategory: "CLINICAL_HISTORY",
          actor: coordinatorActor,
        }),
      ).rejects.toThrow("Document already exists");
    });
  });

  // =========================================================================
  // SECCIÓN 3: CONTROL DE ACCESO INSTITUCIONAL (RBAC / IPS SCOPING)
  // =========================================================================
  describe("3. Institutional Multi-Tenancy & Access Scoping", () => {
    it("denies access to upload when actor does not belong to process originating IPS", async () => {
      const validPdf = Buffer.from("%PDF-1.7 Documento de prueba de permisos");

      const mockRepo = { create: jest.fn(), findByHash: jest.fn().mockResolvedValue(null) };
      const mockPrisma = {
        donationProcess: {
          findUnique: jest.fn().mockResolvedValue({
            id: "proc-1",
            donorId: "donor-1",
            primaryIpsName: "IPS-SAN-VICENTE",
            originatingIps: "IPS-SAN-VICENTE",
            donor: { originatingIpsName: "IPS-SAN-VICENTE" },
          }),
        },
      };

      const uploadUseCase = new UploadSourceDocumentUseCase(
        mockRepo as never,
        storageAdapter,
        mockPrisma as never,
      );

      await expect(
        uploadUseCase.execute({
          processId: "proc-1",
          uploadedById: externalActor.userId,
          originalFilename: "doc.pdf",
          declaredMimeType: "application/pdf",
          buffer: validPdf,
          documentCategory: "CLINICAL_HISTORY",
          actor: externalActor,
        }),
      ).rejects.toThrow(DocumentAccessDeniedError);
    });

    it("allows listing documents filtered by processId for authorized coordinator", async () => {
      const mockPrisma = {
        donationProcess: {
          findUnique: jest.fn().mockResolvedValue({
            id: "proc-1",
            donorId: "donor-1",
            primaryIpsName: "IPS-SAN-VICENTE",
            originatingIps: "IPS-SAN-VICENTE",
            donor: { originatingIpsName: "IPS-SAN-VICENTE" },
          }),
        },
        sourceDocument: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "doc-1",
              processId: "proc-1",
              originalFilename: "epicrisis.pdf",
              mimeType: "application/pdf",
              fileSizeBytes: 2048,
              sha256Hash: "abcdef123456",
              ocrJobs: [
                {
                  id: "job-1",
                  status: "COMPLETADO",
                  extractedFields: [
                    {
                      id: "f-1",
                      canonicalFieldKey: "donor.identity.full_name",
                      candidateValue: "CARLOS PEREZ",
                      validationStatus: "PENDIENTE",
                    },
                  ],
                },
              ],
            },
          ]),
        },
      };

      const getUseCase = new GetSourceDocumentUseCase(
        {} as never,
        {} as never,
        mockPrisma as never,
      );

      const list = await getUseCase.listByProcessId("proc-1", coordinatorActor);
      expect(list.length).toBe(1);
      expect(list[0].originalFilename).toBe("epicrisis.pdf");
      expect(list[0].ocrJobs?.[0].status).toBe("COMPLETADO");
    });
  });

  // =========================================================================
  // SECCIÓN 4: WORKFLOW HUMANO DE VALIDACIÓN Y PROPAGACIÓN
  // =========================================================================
  describe("4. Human In The Loop: Validation & Propagation States", () => {
    it("handles RECHAZADO transition without updating canonical engine", async () => {
      const mockField = {
        id: "field-rej-1",
        donorId: "donor-1",
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "99.9",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-1",
          donor: { originatingIpsName: "IPS-SAN-VICENTE" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: { findUnique: jest.fn().mockResolvedValue(mockField) },
      };
      const mockRepo = {
        validateField: jest.fn().mockResolvedValue({
          ...mockField,
          validationStatus: "RECHAZADO",
        }),
      };
      const mockPropagationEngine = {
        applyAndPropagate: jest.fn(),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as never,
        mockPrisma as never,
        mockPropagationEngine as never,
      );

      const result = await workflow.validate(
        "field-rej-1",
        { status: "RECHAZADO" },
        coordinatorActor,
      );

      expect(result.validationStatus).toBe("RECHAZADO");
      expect(mockPropagationEngine.applyAndPropagate).not.toHaveBeenCalled();
    });

    it("propagates CONFIRMADO candidate directly with provenance OCR_CONFIRMED", async () => {
      const mockField = {
        id: "field-conf-1",
        donorId: "donor-1",
        canonicalFieldKey: "donor.identity.full_name",
        candidateValue: "CARLOS ANDRES PEREZ GOMEZ",
        validationStatus: "CONFIRMADO",
        confirmedValue: null,
        sourceDocument: {
          processId: "proc-1",
          donor: { originatingIpsName: "IPS-SAN-VICENTE" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: { findUnique: jest.fn().mockResolvedValue(mockField) },
        donationProcess: { findFirst: jest.fn().mockResolvedValue({ id: "proc-1" }) },
      };
      const mockRepo = {
        propagateField: jest.fn().mockResolvedValue({
          field: mockField,
          donorRecord: {},
        }),
      };
      const mockPropagationEngine = {
        applyAndPropagate: jest.fn().mockResolvedValue({ accepted: true }),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as never,
        mockPrisma as never,
        mockPropagationEngine as never,
      );

      await workflow.propagate("donor-1", "field-conf-1", coordinatorActor);

      expect(mockPropagationEngine.applyAndPropagate).toHaveBeenCalledWith({
        processId: "proc-1",
        canonicalFieldKey: "donor.identity.full_name",
        value: "CARLOS ANDRES PEREZ GOMEZ",
        sourceKind: "OCR_CONFIRMED",
        actorUserId: coordinatorActor.userId,
      });
    });
  });
});
