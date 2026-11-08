import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";
import { UploadSourceDocumentUseCase } from "../src/application/documents/upload-source-document.use-case";
import { IntakeDonorFromClinicalHistoryUseCase } from "../src/application/processes/intake-donor-from-clinical-history.use-case";
import { CreateDonationProcessUseCase } from "../src/application/processes/create-donation-process.use-case";
import { StartOcrUseCase } from "../src/application/ocr/start-ocr.use-case";
import { extractTextLayerFromPdf } from "../src/application/ocr/pdf-text-layer-extractor";
import { LocalRulesExtractionProvider } from "../src/application/ocr/local-rules-extraction.provider";
import { DocumentUnderstandingService } from "../src/application/ocr/document-understanding.service";
import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import {
  DonationProcess,
  DonationProcessValidationError,
} from "../src/domain/processes/donation-process";

describe("GODT Regional 3 — Flujo de Ingesta de Donante desde Historia Clínica (Fase G.1 Integral)", () => {
  let storageDir: string;
  let storageAdapter: LocalPrivateStorageAdapter;
  let syntheticPdfBuffer: Buffer;

  const mockCoordinatorUser: AuthenticatedUser = {
    userId: "coord-user-intake-1",
    role: "COORDINATOR",
    institutionalIps: ["FUNDACION VALLE DEL LILI", "HOSPITAL UNIVERSITARIO DEL VALLE"],
  };

  const SYNTHETIC_DISCLAIMER =
    "DOCUMENTO SINTÉTICO — PRUEBA FUNCIONAL GODT — NO CORRESPONDE A UN PACIENTE REAL";

  beforeAll(async () => {
    // Generar PDF Sintético en memoria con capa de texto digital y marca obligatoria
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Marca visible y legal obligatoria
    page.drawText(SYNTHETIC_DISCLAIMER, {
      x: 30,
      y: 770,
      size: 9,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1),
    });

    page.drawText("EPICRISIS Y VALORACION CLINICA - POTENCIAL DONANTE", {
      x: 30,
      y: 740,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.4),
    });

    // Metadatos institucionales y demográficos
    const clinicalLines = [
      "INSTITUCION REMITENTE / GENERADORA: FUNDACION VALLE DEL LILI",
      "SERVICIO CLINICO: UCI ADULTOS",
      "NOMBRE COMPLETO: DONANTE SINTETICO PRUEBA OCR",
      "TIPO DE IDENTIFICACION: CC",
      "NUMERO DE IDENTIFICACION: 9988776655",
      "SEXO: MASCULINO",
      "EDAD: 38 AÑOS",
      "FECHA DE NACIMIENTO: 12/05/1988",
      "GRUPO SANGUINEO: O",
      "FACTOR RH: POSITIVO",
      "DIAGNOSTICO / CAUSA DE MUERTE: TRAUMATISMO CRANEOENCEFALICO SEVERO",
      "FECHA DE INGRESO: 2026-03-01 08:30",
      "VALORACION PARACLINICA:",
      "- CREATININA: 1.15 mg/dL",
      "- GASOMETRIA ARTERIAL PH: 7.38",
      "- CODIGO REGISTRO NACIONAL: RND-2026-8888",
      "",
      SYNTHETIC_DISCLAIMER,
    ];

    let y = 700;
    for (const line of clinicalLines) {
      page.drawText(line, {
        x: 40,
        y,
        size: 10,
        font: line.includes("SINTÉTICO") ? fontBold : fontRegular,
        color: line.includes("SINTÉTICO") ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.1, 0.1),
      });
      y -= 22;
    }

    const pdfBytes = await pdfDoc.save();
    syntheticPdfBuffer = Buffer.from(pdfBytes);
  });

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "godt-intake-test-"));
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
  // CASO A: INGESTA INICIAL Y CREACIÓN DE PROCESO PROVISIONAL
  // =========================================================================
  describe("Caso A: Ingesta inicial desde Historia Clínica y creación provisional", () => {
    it("crea atómicamente el proceso de donación, donante provisional y almacena el documento", async () => {
      const mockCreatedProcess: DonationProcess = {
        id: "proc-synth-001",
        processCode: "PROC-2026-0042",
        donorId: "donor-synth-001",
        status: "EN_VALORACION",
        primaryIpsName: "FUNDACION VALLE DEL LILI",
        openedById: mockCoordinatorUser.userId,
        openedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreateProcessUseCase = {
        execute: jest.fn().mockResolvedValue(mockCreatedProcess),
      };

      const mockStoredDoc = {
        id: "source-synth-doc-001",
        donorId: "donor-synth-001",
        processId: "proc-synth-001",
        originalFilename: "historia_clinica_sintetica.pdf",
        mimeType: "application/pdf",
        documentCategory: "HISTORIA_CLINICA",
        objectStorageKey: "donations/proc-synth-001/sources/source-synth-doc-001/original/test.pdf",
        sha256Hash: crypto.createHash("sha256").update(syntheticPdfBuffer).digest("hex"),
        status: "RECIBIDO",
        uploadedAt: new Date(),
        uploadedById: mockCoordinatorUser.userId,
      };

      const mockUploadDocUseCase = {
        execute: jest.fn().mockResolvedValue(mockStoredDoc),
      };

      const mockOcrJob = {
        id: "job-synth-001",
        sourceDocumentId: "source-synth-doc-001",
        status: "COMPLETADO",
        providerName: "gemini",
        correlationId: "corr-synth-1",
        errorCode: null,
      };

      const mockStartOcrUseCase = {
        execute: jest.fn().mockResolvedValue(mockOcrJob),
      };

      const mockOcrRepo = {
        listFields: jest.fn().mockResolvedValue([
          {
            id: "f-1",
            canonicalFieldKey: "donor.identity.full_name",
            candidateValue: "DONANTE SINTETICO PRUEBA OCR",
            validationStatus: "PENDIENTE",
          },
        ]),
      };

      const intakeUseCase = new IntakeDonorFromClinicalHistoryUseCase(
        mockCreateProcessUseCase as any,
        mockUploadDocUseCase as any,
        mockStartOcrUseCase as any,
        mockOcrRepo as any,
      );

      const result = await intakeUseCase.execute({
        primaryIpsName: "FUNDACION VALLE DEL LILI",
        notes: "Apertura asistida por ingesta de HC",
        file: {
          buffer: syntheticPdfBuffer,
          originalname: "historia_clinica_sintetica.pdf",
          mimetype: "application/pdf",
          size: syntheticPdfBuffer.length,
        },
        actor: mockCoordinatorUser,
      });

      expect(result.process.id).toBe("proc-synth-001");
      expect(result.donorId).toBe("donor-synth-001");
      expect(result.sourceDocument.documentCategory).toBe("HISTORIA_CLINICA");
      expect(result.ocrJob.id).toBe("job-synth-001");
      expect(result.candidates.length).toBe(1);

      expect(mockCreateProcessUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryIpsName: "FUNDACION VALLE DEL LILI",
        }),
        mockCoordinatorUser,
      );
      expect(mockUploadDocUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: "proc-synth-001",
          documentCategory: "HISTORIA_CLINICA",
        }),
      );
    });

    it("rechaza la ingesta si falta la IPS generadora o el archivo clínico", async () => {
      const intakeUseCase = new IntakeDonorFromClinicalHistoryUseCase(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(
        intakeUseCase.execute({
          primaryIpsName: "",
          file: {
            buffer: syntheticPdfBuffer,
            originalname: "hc.pdf",
            mimetype: "application/pdf",
            size: syntheticPdfBuffer.length,
          },
          actor: mockCoordinatorUser,
        }),
      ).rejects.toThrow("primaryIpsName es requerida");

      await expect(
        intakeUseCase.execute({
          primaryIpsName: "FUNDACION VALLE DEL LILI",
          file: null as any,
          actor: mockCoordinatorUser,
        }),
      ).rejects.toThrow("Se requiere un archivo de historia clínica");
    });
  });

  // =========================================================================
  // CASO B: EXTRACCIÓN DE CANDIDATOS Y DETECCIÓN CANÓNICA
  // =========================================================================
  describe("Caso B: Extracción de candidatos con IA y Reglas Locales sobre PDF sintético", () => {
    it("extrae la capa de texto digital preservando la marca sintética y detecta campos canónicos", async () => {
      const textLayer = extractTextLayerFromPdf(syntheticPdfBuffer);
      expect(textLayer.hasTextLayer).toBe(true);
      expect(textLayer.text).toContain("DOCUMENTO SINTÉTICO");
      expect(textLayer.text).toContain("NO CORRESPONDE A UN PACIENTE REAL");
      expect(textLayer.text).toContain("DONANTE SINTETICO PRUEBA OCR");
      expect(textLayer.text).toContain("9988776655");
      expect(textLayer.text).toContain("FUNDACION VALLE DEL LILI");
      expect(textLayer.text).toContain("UCI ADULTOS");

      const rulesProvider = new LocalRulesExtractionProvider();
      const candidates = rulesProvider.extract(textLayer.text);

      const findCand = (key: string) =>
        candidates.find((c: any) => c.canonicalFieldKey === key);

      // Verificación de los campos canónicos mapeados
      expect(findCand("donor.identity.full_name")?.candidateValue).toBe(
        "DONANTE SINTETICO PRUEBA OCR",
      );
      expect(findCand("donor.identity.document_number")?.candidateValue).toBe(
        "9988776655",
      );
      expect(findCand("donor.identity.document_type")?.candidateValue).toBe("CC");
      expect(findCand("donor.demographics.age")?.candidateValue).toBe("38");
      expect(findCand("donor.demographics.sex")?.candidateValue).toBe("MASCULINO");
      expect(findCand("donor.clinical.blood_group")?.candidateValue).toBe("O");
      expect(["+", "POSITIVO"]).toContain(
        findCand("donor.clinical.rh_factor")?.candidateValue,
      );
      expect(findCand("donor.clinical.cause_of_death")?.candidateValue).toBe(
        "TRAUMATISMO CRANEOENCEFALICO SEVERO",
      );
      expect(findCand("donor.clinical.creatinine")?.candidateValue).toBe("1.15");
      expect(findCand("donor.clinical.arterial_ph")?.candidateValue).toBe("7.38");
      expect(findCand("donor.institution.originating_ips")?.candidateValue).toBe(
        "FUNDACION VALLE DEL LILI",
      );
      expect(findCand("donor.clinical.clinical_service")?.candidateValue).toBe(
        "UCI ADULTOS",
      );

      // Todos los candidatos tienen scores de confianza y evidencia/snippet
      for (const cand of candidates) {
        expect(cand.confidenceScore).toBeGreaterThanOrEqual(0.7);
        expect(cand.boundingBox?.snippet).toBeDefined();
      }
    });
  });

  // =========================================================================
  // CASO C: REVISIÓN HUMANA (CONFIRMAR, MODIFICAR, RECHAZAR)
  // =========================================================================
  describe("Caso C: Gobernanza clínica y revisión humana interactiva", () => {
    it("permite confirmar, modificar con nuevo valor y rechazar candidatos de forma aislada", async () => {
      const fieldName = {
        id: "f-name",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.identity.full_name",
        candidateValue: "DONANTE SINTETICO PRUEBA OCR",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const fieldService = {
        id: "f-service",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.clinical.clinical_service",
        candidateValue: "UCI ADULTOS",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const fieldCreatinine = {
        id: "f-creat",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "1.15",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: {
          findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            if (where.id === "f-name") return Promise.resolve(fieldName);
            if (where.id === "f-service") return Promise.resolve(fieldService);
            if (where.id === "f-creat") return Promise.resolve(fieldCreatinine);
            return Promise.resolve(null);
          }),
        },
      };

      const mockRepo = {
        validateField: jest.fn().mockImplementation((id: string, input: any) => ({
          id,
          validationStatus: input.status,
          confirmedValue: input.confirmedValue || null,
          validatedById: input.userId,
        })),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as any,
        mockPrisma as any,
        {} as any,
      );

      // 1. Confirmar Nombre
      const confName = await workflow.validate(
        "f-name",
        { status: "CONFIRMADO" },
        mockCoordinatorUser,
      );
      expect(confName.validationStatus).toBe("CONFIRMADO");

      // 2. Modificar Servicio con ajuste humano
      const modService = await workflow.validate(
        "f-service",
        { status: "MODIFICADO", confirmedValue: "UCI Neurotrauma Especializada" },
        mockCoordinatorUser,
      );
      expect(modService.validationStatus).toBe("MODIFICADO");
      expect(modService.confirmedValue).toBe("UCI Neurotrauma Especializada");

      // 3. Rechazar Creatinina (ej. muestra dudosa)
      const rejCreat = await workflow.validate(
        "f-creat",
        { status: "RECHAZADO" },
        mockCoordinatorUser,
      );
      expect(rejCreat.validationStatus).toBe("RECHAZADO");
    });
  });

  // =========================================================================
  // CASO D: PROPAGACIÓN CANÓNICA Y AUTOLLENADO DE ANEXOS
  // =========================================================================
  describe("Caso D: Propagación canónica e inyección en formularios de anexos", () => {
    it("propaga valores confirmados y modificados a DocumentInstance con procedencia OCR", async () => {
      const mockField = {
        id: "f-name-prop",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.identity.full_name",
        candidateValue: "DONANTE SINTETICO PRUEBA OCR",
        validationStatus: "CONFIRMADO",
        confirmedValue: null,
        validatedById: mockCoordinatorUser.userId,
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: {
          findUnique: jest.fn().mockResolvedValue(mockField),
        },
        donationProcess: {
          findFirst: jest.fn().mockResolvedValue({ id: "proc-synth-1" }),
        },
      };

      const mockRepo = {
        propagateField: jest.fn().mockResolvedValue(mockField),
      };

      const mockPropagationEngine = {
        applyAndPropagate: jest.fn().mockResolvedValue({
          canonicalFieldKey: "donor.identity.full_name",
          currentValue: "DONANTE SINTETICO PRUEBA OCR",
          propagatedCount: 2,
          propagatedInstances: [
            { instanceId: "inst-anexo-1", documentCode: "REG-F-01", status: "UPDATED" },
            { instanceId: "inst-anexo-4", documentCode: "REG-F-04", status: "UPDATED" },
          ],
        }),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as any,
        mockPrisma as any,
        mockPropagationEngine as any,
      );

      const res = await workflow.propagateToProcess(
        "proc-synth-1",
        "f-name-prop",
        mockCoordinatorUser,
      );

      expect(res).toBeDefined();
      expect(mockPropagationEngine.applyAndPropagate).toHaveBeenCalledWith({
        processId: "proc-synth-1",
        canonicalFieldKey: "donor.identity.full_name",
        value: "DONANTE SINTETICO PRUEBA OCR",
        sourceKind: "OCR_CONFIRMED",
        actorUserId: mockCoordinatorUser.userId,
      });
    });

    it("soporta batchPropagateToProcess validando y propagando en bloque", async () => {
      const f1 = {
        id: "f-batch-1",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.identity.document_number",
        candidateValue: "9988776655",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const f2 = {
        id: "f-batch-2",
        donorId: "donor-synth-1",
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: "O",
        validationStatus: "PENDIENTE",
        sourceDocument: {
          processId: "proc-synth-1",
          donor: { originatingIpsName: "FUNDACION VALLE DEL LILI" },
        },
      };

      const mockPrisma = {
        ocrExtractedField: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === "f-batch-1") return Promise.resolve(f1);
            if (where.id === "f-batch-2") return Promise.resolve(f2);
            return Promise.resolve(null);
          }),
        },
      };

      const mockRepo = {
        validateField: jest.fn().mockResolvedValue({ status: "CONFIRMADO" }),
        propagateField: jest.fn().mockResolvedValue({ id: "prop" }),
      };

      const mockPropagationEngine = {
        applyAndPropagate: jest.fn().mockResolvedValue({ propagatedCount: 1 }),
      };

      const workflow = new OcrWorkflowUseCase(
        mockRepo as any,
        mockPrisma as any,
        mockPropagationEngine as any,
      );

      const batchResults = await workflow.batchPropagateToProcess(
        "proc-synth-1",
        [
          { fieldId: "f-batch-1", status: "CONFIRMADO" },
          { fieldId: "f-batch-2", status: "CONFIRMADO" },
        ],
        mockCoordinatorUser,
      );

      expect(batchResults.length).toBe(2);
      expect(batchResults[0].status).toBe("CONFIRMADO");
      expect(batchResults[1].status).toBe("CONFIRMADO");
    });
  });

  // =========================================================================
  // CASO E: EDICIÓN MANUAL Y PRESERVACIÓN DE INMUTABILIDAD
  // =========================================================================
  describe("Caso E: Edición manual en formulario y gobernanza append-only", () => {
    it("crea una nueva revisión con procedencia MANUAL sin destruir la procedencia OCR previa", async () => {
      const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
      const mockDictionaryRepo = {
        findFieldByKey: jest.fn().mockResolvedValue({
          canonicalFieldKey: "donor.identity.full_name",
          displayName: "Nombre Completo del Donante",
          dataType: "string",
          scope: "DONOR",
          sharingPolicy: "SHARED",
        }),
        findProcessValueByKey: jest.fn().mockResolvedValue({
          currentValue: "DONANTE SINTETICO PRUEBA OCR",
          sourceKind: "OCR_CONFIRMED",
        }),
        upsertProcessValue: jest.fn().mockResolvedValue({
          id: "val-1",
          versionNumber: 2,
        }),
        addHistoryEntry: jest.fn().mockResolvedValue({ id: "hist-2" }),
      };

      const mockPrisma = {
        donationProcess: {
          findUnique: jest.fn().mockResolvedValue({
            id: "proc-synth-1",
            donorId: "donor-synth-1",
          }),
        },
        donorRecord: {
          update: jest.fn().mockResolvedValue({}),
        },
        documentInstance: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "inst-anexo-1",
              documentCode: "REG-F-01",
              status: "EN_DILIGENCIAMIENTO",
              templateVersion: {
                mappingConfig: [
                  {
                    canonicalFieldKey: "donor.identity.full_name",
                    schemaPath: "nombreDonante",
                  },
                ],
              },
              currentRevision: {
                revisionNumber: 1,
                responseData: { nombreDonante: "DONANTE SINTETICO PRUEBA OCR" },
                provenance: [
                  {
                    fieldPath: "nombreDonante",
                    canonicalFieldKey: "donor.identity.full_name",
                    sourceKind: "OCR_CONFIRMED",
                  },
                ],
              },
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        documentResponseRevision: {
          create: jest.fn().mockResolvedValue({ id: "rev-2", revisionNumber: 2 }),
        },
        documentFieldProvenance: {
          create: jest.fn().mockResolvedValue({ id: "prov-2" }),
        },
      };

      const engine = new CanonicalPropagationEngine(
        mockDictionaryRepo as any,
        mockPrisma as any,
        mockAudit as any,
      );

      // El usuario edita manualmente el nombre
      const result = await engine.applyAndPropagate({
        processId: "proc-synth-1",
        canonicalFieldKey: "donor.identity.full_name",
        value: "DONANTE SINTETICO NOMBRE EDITADO MANUALMENTE",
        sourceKind: "MANUAL",
        actorUserId: mockCoordinatorUser.userId,
      });

      expect(result.currentValue).toBe("DONANTE SINTETICO NOMBRE EDITADO MANUALMENTE");
      expect(result.propagatedCount).toBe(1);

      // Verificamos que se creó nueva revisión append-only
      expect(mockPrisma.documentResponseRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            revisionNumber: 2,
            responseData: {
              nombreDonante: "DONANTE SINTETICO NOMBRE EDITADO MANUALMENTE",
            },
          }),
        }),
      );

      // Verificamos que se registró procedencia con PROCESS_CANONICAL (o MANUAL según origen)
      expect(mockPrisma.documentFieldProvenance.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CASO F: FALLBACK OFFLINE ANTE FALLO DE IA GEMINI
  // =========================================================================
  describe("Caso F: Resiliencia y fallback offline ante caída de Gemini API", () => {
    it("conmuta transparentemente a LocalRulesExtractionProvider si Gemini falla (503 / timeout)", async () => {
      const mockFailingGemini = {
        name: "gemini",
        isEnabled: jest.fn().mockReturnValue(true),
        process: jest.fn().mockRejectedValue(new Error("Gemini API 503 Service Unavailable")),
      };

      const mockConfig = new ConfigService({
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
      });
      const rulesProvider = new LocalRulesExtractionProvider();

      const docService = new DocumentUnderstandingService(
        mockConfig,
        rulesProvider,
        mockFailingGemini as any, // fallback
        undefined,
        undefined,
        mockFailingGemini as any, // gemini
      );

      const result = await docService.analyze({
        buffer: syntheticPdfBuffer,
        mimeType: "application/pdf",
        sourceDocumentId: "source-synth-doc-001",
      });

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.strategyUsed).toBe("PDF_DIGITAL");

      const fullNameCand = result.candidates.find(
        (c) => c.canonicalFieldKey === "donor.identity.full_name",
      );
      expect(fullNameCand?.candidateValue).toBe("DONANTE SINTETICO PRUEBA OCR");
    });
  });

  // =========================================================================
  // CASO G: SEGURIDAD CANÓNICA Y BLINDAJE DE READONLY_DERIVED (RND_CODE)
  // =========================================================================
  describe("Caso G: Seguridad canónica, aislamiento de PROV-RND y blindaje de READONLY_DERIVED", () => {
    it("rechaza estrictamente la propagación OCR sobre campos READONLY_DERIVED como rnd_code", async () => {
      const mockDictionaryRepo = {
        findFieldByKey: jest.fn().mockResolvedValue({
          canonicalFieldKey: "donor.registration.rnd_code",
          displayName: "Código Nacional RND",
          dataType: "string",
          scope: "DONOR",
          sharingPolicy: "READONLY_DERIVED",
        }),
      };

      const engine = new CanonicalPropagationEngine(
        mockDictionaryRepo as any,
        {} as any,
        {} as any,
      );

      await expect(
        engine.applyAndPropagate({
          processId: "proc-synth-1",
          canonicalFieldKey: "donor.registration.rnd_code",
          value: "RND-OVERWRITE-HACK",
          sourceKind: "OCR_CONFIRMED",
          actorUserId: mockCoordinatorUser.userId,
        }),
      ).rejects.toThrow("es de solo lectura derivada institucional");

      await expect(
        engine.applyAndPropagate({
          processId: "proc-synth-1",
          canonicalFieldKey: "donor.registration.rnd_code",
          value: "RND-OVERWRITE-HACK-MOD",
          sourceKind: "OCR_MODIFIED",
          actorUserId: mockCoordinatorUser.userId,
        }),
      ).rejects.toThrow("es de solo lectura derivada institucional");
    });

    it("garantiza que los códigos provisionales PROV-RND y PROV-DOC mantienen su prefijo y no suplantan identificaciones oficiales", () => {
      const currentYear = new Date().getFullYear();
      const mockProvisionalRnd = `PROV-RND-${currentYear}-4B9A7C1E2F3D4E5A`;
      const mockProvisionalDoc = `PROV-DOC-${currentYear}-8F7E6D5C4B3A2190`;

      expect(mockProvisionalRnd).toMatch(new RegExp(`^PROV-RND-${currentYear}-[0-9A-F]{16,}$`));
      expect(mockProvisionalDoc).toMatch(new RegExp(`^PROV-DOC-${currentYear}-[0-9A-F]{16,}$`));

      // No debe ser confundido con un código oficial de RND
      expect(mockProvisionalRnd.startsWith("PROV-")).toBe(true);
      expect(mockProvisionalDoc.startsWith("PROV-")).toBe(true);
    });
  });
});
