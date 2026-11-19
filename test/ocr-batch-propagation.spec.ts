import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { OcrRepository } from "../src/application/ocr/ocr.repository";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";

describe("Auditoría y Corrección de Propagación Masiva OCR (Fase 1)", () => {
  let workflow: OcrWorkflowUseCase;
  let mockRepository: jest.Mocked<OcrRepository>;
  let mockPrisma: any;
  let mockEngine: jest.Mocked<CanonicalPropagationEngine>;

  const actor: AuthenticatedUser = {
    userId: "user-coord-001",
    role: "COORDINATOR",
    institutionalIps: ["Hospital San Vicente"],
  };

  const processId = "proc-test-100";
  const donorId = "donor-test-100";
  const docId = "doc-test-100";

  beforeEach(() => {
    mockRepository = {
      findJob: jest.fn(),
      findQueuedJob: jest.fn(),
      listQueuedJobs: jest.fn(),
      createJob: jest.fn(),
      saveCandidates: jest.fn(),
      completeJob: jest.fn(),
      failJob: jest.fn(),
      listFields: jest.fn(),
      validateField: jest.fn().mockImplementation((fieldId, update) =>
        Promise.resolve({
          id: fieldId,
          validationStatus: update.status,
          confirmedValue: update.confirmedValue,
          validatedById: update.userId,
        } as any),
      ),
      propagateField: jest.fn().mockImplementation((fieldId) =>
        Promise.resolve({
          id: fieldId,
          validationStatus: "CONFIRMADO",
        } as any),
      ),
    };

    mockPrisma = {
      ocrExtractedField: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sourceDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: docId,
          processId,
          donor: { originatingIpsName: "Hospital San Vicente" },
        }),
      },
      donationProcess: {
        findFirst: jest.fn().mockResolvedValue({ id: processId }),
      },
    };

    mockEngine = {
      applyAndPropagate: jest.fn().mockResolvedValue({
        propagatedCount: 2,
        propagatedInstances: [],
        conflicts: [],
      } as any),
    } as unknown as jest.Mocked<CanonicalPropagationEngine>;

    workflow = new OcrWorkflowUseCase(
      mockRepository,
      mockPrisma as any,
      mockEngine,
    );
  });

  it("debe propagar exitosamente un lote de campos confirmados y modificados reportando conteos exactos", async () => {
    // Simular campos en base de datos
    mockPrisma.ocrExtractedField.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "f-1") {
        return Promise.resolve({
          id: "f-1",
          donorId,
          canonicalFieldKey: "donor.clinical.blood_group",
          candidateValue: "O",
          validationStatus: "PENDIENTE",
          sourceDocument: { donor: { originatingIpsName: "Hospital San Vicente" }, processId },
        });
      }
      if (where.id === "f-2") {
        return Promise.resolve({
          id: "f-2",
          donorId,
          canonicalFieldKey: "donor.clinical.clinical_service",
          candidateValue: "UCI",
          validationStatus: "PENDIENTE",
          sourceDocument: { donor: { originatingIpsName: "Hospital San Vicente" }, processId },
        });
      }
      return Promise.resolve(null);
    });

    const items = [
      { fieldId: "f-1", status: "CONFIRMADO" as const },
      { fieldId: "f-2", status: "MODIFICADO" as const, confirmedValue: "UCI Adultos 3" },
    ];

    const result = await workflow.batchPropagateToProcess(processId, items, actor);

    expect(result.total).toBe(2);
    expect(result.propagatedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("PROPAGADO");
    expect(result.results[1].status).toBe("PROPAGADO");
    expect(mockEngine.applyAndPropagate).toHaveBeenCalledTimes(2);
  });

  it("no debe abortar el lote si un campo ya existía previamente con valor idéntico (lo clasifica como OMITIDO)", async () => {
    mockPrisma.ocrExtractedField.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "f-existente") {
        return Promise.resolve({
          id: "f-existente",
          donorId,
          canonicalFieldKey: "donor.identity.document_number",
          candidateValue: "1020304050",
          validationStatus: "CONFIRMADO",
          sourceDocument: { donor: { originatingIpsName: "Hospital San Vicente" }, processId },
        });
      }
      if (where.id === "f-nuevo") {
        return Promise.resolve({
          id: "f-nuevo",
          donorId,
          canonicalFieldKey: "donor.clinical.creatinine",
          candidateValue: "1.15",
          validationStatus: "CONFIRMADO",
          sourceDocument: { donor: { originatingIpsName: "Hospital San Vicente" }, processId },
        });
      }
      return Promise.resolve(null);
    });

    // Simular que el repositorio rechaza el campo existente por ya tener valor
    mockRepository.propagateField.mockImplementation((id: string) => {
      if (id === "f-existente") {
        return Promise.reject(new Error("El campo ya contiene un valor registrado previo"));
      }
      return Promise.resolve({ id, validationStatus: "CONFIRMADO" } as any);
    });

    const items = [
      { fieldId: "f-existente", status: "CONFIRMADO" as const },
      { fieldId: "f-nuevo", status: "CONFIRMADO" as const },
    ];

    const result = await workflow.batchPropagateToProcess(processId, items, actor);

    expect(result.total).toBe(2);
    expect(result.propagatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.results.find((r) => r.fieldId === "f-existente")?.status).toBe("OMITIDO");
    expect(result.results.find((r) => r.fieldId === "f-nuevo")?.status).toBe("PROPAGADO");
  });

  it("gestiona campos en estado RECHAZADO sin intentar propagarlos al diccionario", async () => {
    mockPrisma.ocrExtractedField.findUnique.mockResolvedValue({
      id: "f-rechazado",
      donorId,
      canonicalFieldKey: "donor.clinical.cause_of_death",
      candidateValue: "Texto espurio",
      validationStatus: "PENDIENTE",
      sourceDocument: { donor: { originatingIpsName: "Hospital San Vicente" }, processId },
    });

    const items = [{ fieldId: "f-rechazado", status: "RECHAZADO" as const }];

    const result = await workflow.batchPropagateToProcess(processId, items, actor);

    expect(result.total).toBe(1);
    expect(result.propagatedCount).toBe(0);
    expect(result.results[0].status).toBe("RECHAZADO");
    expect(mockRepository.validateField).toHaveBeenCalledWith("f-rechazado", { status: "RECHAZADO", userId: actor.userId });
    expect(mockRepository.propagateField).not.toHaveBeenCalled();
    expect(mockEngine.applyAndPropagate).not.toHaveBeenCalled();
  });
});
