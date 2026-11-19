import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { OcrRepository } from "../src/application/ocr/ocr.repository";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { CanonicalDictionaryRepository } from "../src/application/canonical/canonical-dictionary.repository";
import { HOMOLOGATED_CANONICAL_FIELDS, ProcessCanonicalValue } from "../src/domain/canonical/canonical-dictionary";
import { AuditEventPort } from "../src/application/audit/audit-event.port";

describe("Demostración Integral de Propagación a Base de Datos & Entidades Canónicas", () => {
  // Simulador de persistencia relacional en memoria con tipado fiel a Prisma
  const db = {
    donationProcesses: new Map<string, any>(),
    sourceDocuments: new Map<string, any>(),
    ocrExtractedFields: new Map<string, any>(),
    canonicalValues: new Map<string, ProcessCanonicalValue>(),
    canonicalHistories: [] as any[],
    auditLogs: [] as any[],
  };

  const coordinator: AuthenticatedUser = {
    userId: "usr-coord-valle-01",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  let workflow: OcrWorkflowUseCase;
  let engine: CanonicalPropagationEngine;

  const processId = "proc-integration-2026";
  const donorId = "donor-integration-2026";
  const docId = "doc-hc-sintetica-01";

  beforeAll(() => {
    // 1. Sembrar Proceso y Documento de Origen
    db.donationProcesses.set(processId, {
      id: processId,
      processCode: "PROC-2026-VALLE-001",
      donorId,
      status: "EN_CURSO",
      primaryIpsName: "Hospital Universitario del Valle",
      openedById: coordinator.userId,
      openedAt: new Date("2026-11-19T08:00:00Z"),
    });

    db.sourceDocuments.set(docId, {
      id: docId,
      processId,
      donorId,
      fileName: "HC_Donante_Sintetico_2026.pdf",
      mimeType: "application/pdf",
      sourceType: "IMAGE_OCR",
      donor: { originatingIpsName: "Hospital Universitario del Valle" },
    });

    // 2. Sembrar Campos OCR Extraídos en estado PENDIENTE
    const initialFields = [
      {
        id: "field-gs",
        donorId,
        sourceDocumentId: docId,
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: "O",
        confidenceScore: 0.96,
        validationStatus: "PENDIENTE",
        confirmedValue: null,
      },
      {
        id: "field-rh",
        donorId,
        sourceDocumentId: docId,
        canonicalFieldKey: "donor.clinical.rh_factor",
        candidateValue: "+",
        confidenceScore: 0.95,
        validationStatus: "PENDIENTE",
        confirmedValue: null,
      },
      {
        id: "field-creatinina",
        donorId,
        sourceDocumentId: docId,
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "1.15",
        confidenceScore: 0.98,
        validationStatus: "PENDIENTE",
        confirmedValue: null,
      },
      {
        id: "field-servicio",
        donorId,
        sourceDocumentId: docId,
        canonicalFieldKey: "donor.clinical.clinical_service",
        candidateValue: "UCI PEDIATRICA", // Modificado manualmente a UCI ADULTOS
        confidenceScore: 0.70,
        validationStatus: "PENDIENTE",
        confirmedValue: null,
      },
      {
        id: "field-alucinacion",
        donorId,
        sourceDocumentId: docId,
        canonicalFieldKey: "donor.clinical.cause_of_death",
        candidateValue: "Texto no evidenciado en documento", // Rechazado
        confidenceScore: 0.40,
        validationStatus: "PENDIENTE",
        confirmedValue: null,
      },
    ];

    initialFields.forEach((f) => db.ocrExtractedFields.set(f.id, { ...f }));

    // 3. Mock Repositorio OCR conectado a db
    const ocrRepo: OcrRepository = {
      findJob: jest.fn(),
      findQueuedJob: jest.fn(),
      listQueuedJobs: jest.fn(),
      createJob: jest.fn(),
      saveCandidates: jest.fn(),
      completeJob: jest.fn(),
      failJob: jest.fn(),
      listFields: jest.fn(),
      validateField: jest.fn(async (fieldId: string, update: any) => {
        const item = db.ocrExtractedFields.get(fieldId);
        if (!item) throw new Error("Field not found");
        item.validationStatus = update.status;
        item.confirmedValue = update.confirmedValue ?? (update.status === "CONFIRMADO" ? item.candidateValue : null);
        item.validatedById = update.userId;
        item.validatedAt = new Date();
        db.ocrExtractedFields.set(fieldId, item);
        return item;
      }),
      propagateField: jest.fn(async (fieldId: string) => {
        const item = db.ocrExtractedFields.get(fieldId);
        if (!item) throw new Error("Field not found");
        if (item.canonicalFieldKey === "campo.inexistente.invalido") {
          throw new Error("Violación de restricción de integridad canónica en base de datos");
        }
        item.validationStatus = "CONFIRMADO";
        return item;
      }),
    };

    // 4. Mock Prisma conectado a db
    const prismaMock: any = {
      ocrExtractedField: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          const item = db.ocrExtractedFields.get(where.id);
          if (!item) return null;
          return {
            ...item,
            sourceDocument: {
              ...db.sourceDocuments.get(item.sourceDocumentId),
              donor: { originatingIpsName: "Hospital Universitario del Valle" },
              processId,
            },
          };
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
          const item = db.ocrExtractedFields.get(where.id);
          if (item) {
            Object.assign(item, data);
            db.ocrExtractedFields.set(where.id, item);
          }
          return item;
        }),
      },
      sourceDocument: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => db.sourceDocuments.get(where.id)),
      },
      donationProcess: {
        findFirst: jest.fn(async ({ where }: { where: { id?: string; donorId?: string } }) => {
          if (where.id) return db.donationProcesses.get(where.id);
          return Array.from(db.donationProcesses.values()).find((p: any) => p.donorId === where.donorId) || null;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          const proc = db.donationProcesses.get(where.id);
          if (!proc) return null;
          return { ...proc, donor: { id: proc.donorId, originatingIpsName: proc.primaryIpsName } };
        }),
      },
      donorRecord: {
        update: jest.fn(async () => ({})),
      },
      documentInstance: {
        findMany: jest.fn(async () => []),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(prismaMock)),
    };

    // 5. Repositorio Canónico conectado a db
    const canonicalRepo: CanonicalDictionaryRepository = {
      listCatalog: async () => HOMOLOGATED_CANONICAL_FIELDS.map((d, i) => ({ ...d, id: `def-${i}`, createdAt: new Date(), updatedAt: new Date() })) as any,
      findFieldByKey: async (key: string) => {
        const d = HOMOLOGATED_CANONICAL_FIELDS.find((item) => item.canonicalFieldKey === key);
        return d ? ({ ...d, id: "def-id", createdAt: new Date(), updatedAt: new Date() } as any) : null;
      },
      seedDefaultCatalog: async () => {},
      findProcessValues: async (procId: string) => Array.from(db.canonicalValues.values()).filter((v) => v.processId === procId),
      findProcessValueByKey: async (procId: string, key: string) => db.canonicalValues.get(`${procId}:${key}`) || null,
      upsertProcessValue: async (data: any) => {
        const existing = db.canonicalValues.get(`${data.processId}:${data.canonicalFieldKey}`);
        const saved: ProcessCanonicalValue = {
          id: existing?.id || `can-val-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
          currentValue: data.value,
          unit: data.unit ?? null,
          sampleContext: data.sampleContext ?? null,
          versionNumber: (existing?.versionNumber || 0) + 1,
          effectiveAt: data.effectiveAt || new Date(),
          sourceKind: data.sourceKind,
          sourceInstanceId: data.sourceInstanceId ?? null,
          sourceRevisionId: data.sourceRevisionId ?? null,
          conflictStatus: "NONE",
          updatedById: data.actorUserId,
          updatedAt: new Date(),
        };
        db.canonicalValues.set(`${data.processId}:${data.canonicalFieldKey}`, saved);
        return saved;
      },
      addHistoryEntry: async (data: any) => {
        db.canonicalHistories.push(data);
        return {} as any;
      },
      listHistory: async (procId: string) => db.canonicalHistories.filter((h) => h.processId === procId),
      listObservations: async () => [],
      updateConflictStatus: async () => ({} as any),
    };

    const auditPort: AuditEventPort = {
      record: async (evt) => {
        db.auditLogs.push(evt);
      },
    };

    engine = new CanonicalPropagationEngine(canonicalRepo, prismaMock, auditPort);
    workflow = new OcrWorkflowUseCase(ocrRepo, prismaMock, engine);
  });

  it("Paso 1: Validación Manual Humana — Confirmar, Modificar y Rechazar", async () => {
    // 1. Confirmar Grupo Sanguíneo
    const fConfirm = await workflow.validate("field-gs", { status: "CONFIRMADO" }, coordinator);
    expect(fConfirm.validationStatus).toBe("CONFIRMADO");
    expect(fConfirm.confirmedValue).toBe("O");

    // 2. Modificar Servicio Clínico de 'UCI PEDIATRICA' a 'UCI ADULTOS'
    const fMod = await workflow.validate(
      "field-servicio",
      { status: "MODIFICADO", confirmedValue: "UCI ADULTOS" },
      coordinator,
    );
    expect(fMod.validationStatus).toBe("MODIFICADO");
    expect(fMod.confirmedValue).toBe("UCI ADULTOS");

    // 3. Rechazar Causa de Muerte Espuria
    const fRej = await workflow.validate("field-alucinacion", { status: "RECHAZADO" }, coordinator);
    expect(fRej.validationStatus).toBe("RECHAZADO");
    expect(fRej.confirmedValue).toBeNull();

    // Comprobar estado persistido en db
    expect(db.ocrExtractedFields.get("field-gs").validationStatus).toBe("CONFIRMADO");
    expect(db.ocrExtractedFields.get("field-servicio").validationStatus).toBe("MODIFICADO");
    expect(db.ocrExtractedFields.get("field-alucinacion").validationStatus).toBe("RECHAZADO");
  });

  it("Paso 2: Propagación Individual y en Lote hacia Entidades Canónicas", async () => {
    // Propagar individualmente el Grupo Sanguíneo
    const singleResult = await workflow.propagateToProcess(processId, "field-gs", coordinator);
    expect(singleResult.validationStatus).toBe("CONFIRMADO");

    // Consultar estado persistido en el diccionario canónico del proceso
    const bloodGroupValue = db.canonicalValues.get(`${processId}:donor.clinical.blood_group`);
    expect(bloodGroupValue).toBeDefined();
    expect(bloodGroupValue?.currentValue).toBe("O");

    // Propagar en lote los restantes (confirmado, modificado y rechazado)
    const batchItems = [
      { fieldId: "field-rh", status: "CONFIRMADO" as const },
      { fieldId: "field-creatinina", status: "CONFIRMADO" as const },
      { fieldId: "field-servicio", status: "MODIFICADO" as const, confirmedValue: "UCI ADULTOS" },
      { fieldId: "field-alucinacion", status: "RECHAZADO" as const },
    ];

    const batchResult = await workflow.batchPropagateToProcess(processId, batchItems, coordinator);

    expect(batchResult.total).toBe(4);
    expect(batchResult.propagatedCount).toBe(3); // Rh, Creatinina, Servicio
    expect(batchResult.skippedCount).toBe(0);
    expect(batchResult.failedCount).toBe(0);

    // Verificar que el campo rechazado fue registrado como RECHAZADO y NO fue propagado a la BD canónica
    const rejectedInBatch = batchResult.results.find((r) => r.fieldId === "field-alucinacion");
    expect(rejectedInBatch?.status).toBe("RECHAZADO");
    expect(db.canonicalValues.has(`${processId}:donor.clinical.cause_of_death`)).toBe(false);

    // Verificar persistencia de valores canónicos en BD
    expect(db.canonicalValues.get(`${processId}:donor.clinical.rh_factor`)?.currentValue).toBe("+");
    expect(db.canonicalValues.get(`${processId}:donor.clinical.creatinine`)?.currentValue).toBe(1.15); // parseado a número
    expect(db.canonicalValues.get(`${processId}:donor.clinical.clinical_service`)?.currentValue).toBe("UCI ADULTOS");
  });

  it("Paso 3: Idempotencia y Manejo Resiliente ante Valores Preexistentes", async () => {
    // Si intentamos propagar nuevamente 'field-gs', el valor se actualiza o preserva sin error
    const rePropagate = await workflow.propagateToProcess(processId, "field-gs", coordinator);
    expect(rePropagate.validationStatus).toBe("CONFIRMADO");
    expect(db.canonicalValues.get(`${processId}:donor.clinical.blood_group`)?.currentValue).toBe("O");
  });

  it("Paso 4: Aislamiento de Fallo — Error individual en lote no corrompe los campos válidos", async () => {
    // Introducir un campo con clave desconocida o inválida en BD
    db.ocrExtractedFields.set("field-corrupto", {
      id: "field-corrupto",
      donorId,
      sourceDocumentId: docId,
      canonicalFieldKey: "campo.inexistente.invalido",
      candidateValue: "invalido",
      confidenceScore: 0.90,
      validationStatus: "PENDIENTE",
      confirmedValue: null,
    });

    db.ocrExtractedFields.set("field-valido-aislado", {
      id: "field-valido-aislado",
      donorId,
      sourceDocumentId: docId,
      canonicalFieldKey: "donor.clinical.arterial_ph",
      candidateValue: "7.38",
      confidenceScore: 0.95,
      validationStatus: "PENDIENTE",
      confirmedValue: null,
    });

    const items = [
      { fieldId: "field-corrupto", status: "CONFIRMADO" as const },
      { fieldId: "field-valido-aislado", status: "CONFIRMADO" as const },
    ];

    const result = await workflow.batchPropagateToProcess(processId, items, coordinator);

    // El lote procesa ambos: uno falla y el otro se propaga exitosamente
    expect(result.total).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.propagatedCount).toBe(1);

    expect(result.results.find((r) => r.fieldId === "field-corrupto")?.status).toBe("FALLIDO");
    expect(result.results.find((r) => r.fieldId === "field-valido-aislado")?.status).toBe("PROPAGADO");

    // El campo válido fue persistido sin verse afectado por el fallo (parseado numéricamente a 7.38)
    expect(db.canonicalValues.get(`${processId}:donor.clinical.arterial_ph`)?.currentValue).toBe(7.38);
  });
});
