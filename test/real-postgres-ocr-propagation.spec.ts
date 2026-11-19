import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { PrismaOcrRepository } from "../src/infrastructure/ocr/prisma-ocr.repository";
import { PrismaCanonicalDictionaryRepository } from "../src/infrastructure/canonical/prisma-canonical-dictionary.repository";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { Decimal } from "@prisma/client/runtime/library";

describe("PostgreSQL Real Integration — Flujo de Validación y Propagación Canónica OCR", () => {
  let prisma: PrismaService;
  let ocrRepo: PrismaOcrRepository;
  let canonicalRepo: PrismaCanonicalDictionaryRepository;
  let engine: CanonicalPropagationEngine;
  let workflow: OcrWorkflowUseCase;

  const runId = `test-ocr-pg-${Date.now()}`;
  let testUser: any;
  let testDonor: any;
  let testProcess: any;
  let testDoc: any;
  let testJob: any;

  let fieldGs: any;
  let fieldRh: any;
  let fieldService: any;
  let fieldCreat: any;
  let fieldDeath: any;

  const authUser: AuthenticatedUser = {
    userId: "",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const auditEventsRecorded: any[] = [];
  const mockAuditPort: AuditEventPort = {
    record: async (event) => {
      auditEventsRecorded.push(event);
    },
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    ocrRepo = new PrismaOcrRepository(prisma);
    canonicalRepo = new PrismaCanonicalDictionaryRepository(prisma);
    engine = new CanonicalPropagationEngine(canonicalRepo, prisma, mockAuditPort);
    workflow = new OcrWorkflowUseCase(ocrRepo, prisma, engine);

    // Sembrar catálogo maestro canónico en PostgreSQL si no existe
    await canonicalRepo.seedDefaultCatalog();

    // 1. Crear Usuario Coordinador Sintético
    testUser = await prisma.systemUser.create({
      data: {
        email: `${runId}@godt.gov.co`,
        fullName: "Coordinador Real PostgreSQL",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authUser.userId = testUser.id;

    // 2. Crear Donante Sintético
    testDonor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-${runId}`,
        documentNumber: `1199${Date.now().toString().slice(-6)}`,
        fullName: "Donante Sintetico Real PG",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: testUser.id,
      },
    });

    // 3. Crear Proceso de Donación
    testProcess = await prisma.donationProcess.create({
      data: {
        processCode: `PROC-${runId}`,
        donorId: testDonor.id,
        status: "EN_VALORACION",
        primaryIpsName: "Hospital Universitario del Valle",
        openedById: testUser.id,
      },
    });

    // 4. Crear Documento Fuente
    testDoc = await prisma.sourceDocument.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        uploadedById: testUser.id,
        originalFilename: "HC_Sintetica_Real_PG.pdf",
        mimeType: "application/pdf",
        documentCategory: "HISTORIA_CLINICA",
        objectStorageKey: `synthetic/${runId}.pdf`,
        sha256Hash: `hash${Date.now()}`.padEnd(64, "0").slice(0, 64),
        status: "PROCESADO",
      },
    });

    // 5. Crear Trabajo OCR
    testJob = await prisma.ocrProcessingJob.create({
      data: {
        sourceDocumentId: testDoc.id,
        requestedById: testUser.id,
        providerName: "gemini",
        status: "COMPLETADO",
        correlationId: `corr-${runId}`,
      },
    });

    // 6. Sembrar Campos Extraídos OCR en estado PENDIENTE
    fieldGs = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: "O",
        confidenceScore: new Decimal("0.960"),
        validationStatus: "PENDIENTE",
      },
    });

    fieldRh = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.rh_factor",
        candidateValue: "+",
        confidenceScore: new Decimal("0.950"),
        validationStatus: "PENDIENTE",
      },
    });

    fieldService = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.clinical_service",
        candidateValue: "UCI PEDIATRICA",
        confidenceScore: new Decimal("0.720"),
        validationStatus: "PENDIENTE",
      },
    });

    fieldCreat = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "1.25",
        confidenceScore: new Decimal("0.980"),
        validationStatus: "PENDIENTE",
      },
    });

    fieldDeath = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.cause_of_death",
        candidateValue: "Alucinación clínica espuria",
        confidenceScore: new Decimal("0.350"),
        validationStatus: "PENDIENTE",
      },
    });
  });

  afterAll(async () => {
    // Limpieza controlada en PostgreSQL
    try {
      if (testUser) {
        await prisma.auditEvent.deleteMany({ where: { actorUserId: testUser.id } });
      }
      if (testProcess) {
        await prisma.processCanonicalHistory.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processCanonicalValue.deleteMany({ where: { processId: testProcess.id } });
      }
      if (testDonor) {
        await prisma.ocrExtractedField.deleteMany({ where: { donorId: testDonor.id } });
      }
      if (testJob) {
        await prisma.ocrProcessingJob.deleteMany({ where: { id: testJob.id } });
      }
      if (testDoc) {
        await prisma.sourceDocument.deleteMany({ where: { id: testDoc.id } });
      }
      if (testProcess) {
        await prisma.donationProcess.deleteMany({ where: { id: testProcess.id } });
      }
      if (testDonor) {
        await prisma.donorRecord.deleteMany({ where: { id: testDonor.id } });
      }
      if (testUser) {
        await prisma.systemUser.deleteMany({ where: { id: testUser.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Validación manual HITL en PostgreSQL: Confirmar, Modificar y Rechazar", async () => {
    // 1. Confirmar Grupo Sanguíneo
    const fConfirm = await workflow.validate(fieldGs.id, { status: "CONFIRMADO" }, authUser);
    expect(fConfirm.validationStatus).toBe("CONFIRMADO");
    expect(fConfirm.confirmedValue).toBe("O");

    // 2. Modificar Servicio Clínico a 'UCI ADULTOS'
    const fMod = await workflow.validate(
      fieldService.id,
      { status: "MODIFICADO", confirmedValue: "UCI ADULTOS" },
      authUser,
    );
    expect(fMod.validationStatus).toBe("MODIFICADO");
    expect(fMod.confirmedValue).toBe("UCI ADULTOS");

    // 3. Rechazar Causa de Muerte
    const fRej = await workflow.validate(fieldDeath.id, { status: "RECHAZADO" }, authUser);
    expect(fRej.validationStatus).toBe("RECHAZADO");
    expect(fRej.confirmedValue).toBeNull();

    // Consultar PostgreSQL directamente para verificar persistencia en OCR_EXTRACTED_FIELD
    const pgGs = await prisma.ocrExtractedField.findUnique({ where: { id: fieldGs.id } });
    const pgService = await prisma.ocrExtractedField.findUnique({ where: { id: fieldService.id } });
    const pgDeath = await prisma.ocrExtractedField.findUnique({ where: { id: fieldDeath.id } });

    expect(pgGs?.validationStatus).toBe("CONFIRMADO");
    expect(pgService?.validationStatus).toBe("MODIFICADO");
    expect(pgService?.confirmedValue).toBe("UCI ADULTOS");
    expect(pgDeath?.validationStatus).toBe("RECHAZADO");
  });

  it("2. Propagación individual y masiva contra PostgreSQL real", async () => {
    // Propagar individualmente Grupo Sanguíneo
    const singleProp = await workflow.propagateToProcess(testProcess.id, fieldGs.id, authUser);
    expect(singleProp.validationStatus).toBe("CONFIRMADO");

    // Propagar en lote los demás campos
    const batchItems = [
      { fieldId: fieldRh.id, status: "CONFIRMADO" as const },
      { fieldId: fieldCreat.id, status: "CONFIRMADO" as const },
      { fieldId: fieldService.id, status: "MODIFICADO" as const, confirmedValue: "UCI ADULTOS" },
      { fieldId: fieldDeath.id, status: "RECHAZADO" as const },
    ];

    const batchResult = await workflow.batchPropagateToProcess(testProcess.id, batchItems, authUser);
    expect(batchResult.total).toBe(4);
    expect(batchResult.propagatedCount).toBe(3); // Rh, Creatinina, Servicio
    expect(batchResult.skippedCount).toBe(0);
    expect(batchResult.failedCount).toBe(0);

    // 3. Consultar la base de datos PostgreSQL real
    const canonicalValues = await prisma.processCanonicalValue.findMany({
      where: { processId: testProcess.id },
    });

    const valGs = canonicalValues.find((v) => v.canonicalFieldKey === "donor.clinical.blood_group");
    const valRh = canonicalValues.find((v) => v.canonicalFieldKey === "donor.clinical.rh_factor");
    const valCreat = canonicalValues.find((v) => v.canonicalFieldKey === "donor.clinical.creatinine");
    const valService = canonicalValues.find((v) => v.canonicalFieldKey === "donor.clinical.clinical_service");
    const valDeath = canonicalValues.find((v) => v.canonicalFieldKey === "donor.clinical.cause_of_death");

    expect(valGs).toBeDefined();
    expect(valGs?.currentValue).toBe("O");

    expect(valRh).toBeDefined();
    expect(valRh?.currentValue).toBe("+");

    expect(valCreat).toBeDefined();
    expect(valCreat?.currentValue).toBe(1.25); // Parseado numéricamente

    expect(valService).toBeDefined();
    expect(valService?.currentValue).toBe("UCI ADULTOS");

    // El campo rechazado NO debe existir en los valores canónicos del proceso
    expect(valDeath).toBeUndefined();

    // Verificar historial de auditoría inmutable en PostgreSQL
    const histories = await prisma.processCanonicalHistory.findMany({
      where: { processId: testProcess.id },
    });
    expect(histories.length).toBeGreaterThanOrEqual(4);
  });

  it("3. Comprobación de idempotencia ante re-propagaciones en PostgreSQL", async () => {
    // Re-propagar el mismo campo confirmado
    const reResult = await workflow.propagateToProcess(testProcess.id, fieldGs.id, authUser);
    expect(reResult.validationStatus).toBe("CONFIRMADO");

    // Verificar que en PostgreSQL no se duplicó la fila
    const count = await prisma.processCanonicalValue.count({
      where: {
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.blood_group",
      },
    });
    expect(count).toBe(1);
  });

  it("4. Aislamiento de error en lote: fallo individual no aborta el lote en PostgreSQL", async () => {
    // Crear un campo válido adicional
    const fieldPh = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: testJob.id,
        sourceDocumentId: testDoc.id,
        donorId: testDonor.id,
        canonicalFieldKey: "donor.clinical.arterial_ph",
        candidateValue: "7.41",
        confidenceScore: new Decimal("0.970"),
        validationStatus: "PENDIENTE",
      },
    });

    // Intentar propagar en lote un ID inexistente junto con el campo pH válido
    const batchWithFault = [
      { fieldId: "00000000-0000-0000-0000-000000000999", status: "CONFIRMADO" as const },
      { fieldId: fieldPh.id, status: "CONFIRMADO" as const },
    ];

    const batchResult = await workflow.batchPropagateToProcess(testProcess.id, batchWithFault, authUser);
    expect(batchResult.total).toBe(2);
    expect(batchResult.failedCount).toBe(1);
    expect(batchResult.propagatedCount).toBe(1);

    // Verificar que el campo válido se persistió en PostgreSQL a pesar del fallo del otro
    const phVal = await prisma.processCanonicalValue.findFirst({
      where: {
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.arterial_ph",
      },
    });
    expect(phVal).toBeDefined();
    expect(phVal?.currentValue).toBe(7.41);
  });
});
