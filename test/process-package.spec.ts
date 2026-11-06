import { ListProcessDocumentsUseCase } from "../src/application/packages/list-process-documents.use-case";
import { UpdateDocumentApplicabilityUseCase } from "../src/application/packages/update-document-applicability.use-case";
import { InitiateProcessDocumentUseCase } from "../src/application/packages/initiate-process-document.use-case";
import { EvaluateDocumentDependenciesUseCase } from "../src/application/packages/evaluate-document-dependencies.use-case";
import { CreateDonationProcessUseCase } from "../src/application/processes/create-donation-process.use-case";
import {
  DocumentApplicability,
  OFFICIAL_REGIONAL_3_POSITIONS,
  PackagePositionDefinition,
  ProcessDocument,
  ProcessDocumentConflictError,
  ProcessDocumentNotFoundError,
  ProcessDocumentStatus,
  ProcessPackage,
  ProcessPackageValidationError,
  ProcessPackageVersion,
} from "../src/domain/packages/process-package";
import { ProcessPackageRepository } from "../src/application/packages/process-package.repository";
import { DonationProcessRepository } from "../src/application/processes/donation-process.repository";
import { DonorRecordRepository } from "../src/application/donors/donor-record.repository";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { DonationProcess } from "../src/domain/processes/donation-process";
import { DonorRecord } from "../src/domain/donors/donor-record";

describe("ProcessPackage & 23 Positions Use Cases (Phase B)", () => {
  let documents: Map<string, ProcessDocument>;
  let processes: Map<string, DonationProcess>;
  let packages: Map<string, ProcessPackage>;
  let packageVersions: Map<string, ProcessPackageVersion>;
  let mockPackageRepo: ProcessPackageRepository;
  let mockProcessRepo: DonationProcessRepository;
  let mockDonorRepo: Partial<DonorRecordRepository>;
  let mockAuditPort: AuditEventPort;
  let mockPrisma: any;
  let auditLogs: unknown[];

  const adminUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "ADMIN",
    institutionalIps: [],
  };

  const coordinatorUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000002",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const foreignUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000003",
    role: "COORDINATOR",
    institutionalIps: ["Clínica Imbanaco"],
  };

  const mockProcess: DonationProcess = {
    id: "proc-test-01",
    processCode: "PROC-2026-0001",
    donorId: "donor-01",
    status: "EN_VALORACION",
    primaryIpsName: "Hospital Universitario del Valle",
    openedById: adminUser.userId,
    openedAt: new Date(),
    closedById: null,
    closedAt: null,
    notes: null,
    packageVersionId: "pkg-ver-01",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDonor: DonorRecord = {
    id: "donor-01",
    rndCode: "RND-2026-0001",
    status: "EN_VALORACION",
    originatingIpsName: "Hospital Universitario del Valle",
    clinicalService: "UCI Adultos",
    fullName: "Carlos Donante Prueba",
    documentNumber: "88888888",
    anthropometry: null,
    bloodGroup: "O",
    rhFactor: "POSITIVO",
    clinicalData: null,
    createdById: adminUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    documents = new Map();
    processes = new Map();
    packages = new Map();
    packageVersions = new Map();
    auditLogs = [];

    processes.set(mockProcess.id, { ...mockProcess });

    mockAuditPort = {
      record: jest.fn().mockImplementation((event) => {
        auditLogs.push(event);
        return Promise.resolve();
      }),
    };

    mockProcessRepo = {
      create: jest.fn().mockImplementation(async (input, actorUserId, code) => {
        const id = `proc-${Date.now()}`;
        const newProc: DonationProcess = {
          id,
          processCode: code,
          donorId: input.donorId,
          status: "EN_VALORACION",
          primaryIpsName: input.primaryIpsName,
          openedById: actorUserId,
          openedAt: new Date(),
          closedById: null,
          closedAt: null,
          notes: input.notes || null,
          packageVersionId: input.packageVersionId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        processes.set(id, newProc);
        return newProc;
      }),
      findById: jest.fn().mockImplementation(async (id) => processes.get(id) || null),
      findByCode: jest.fn().mockImplementation(async (code) => {
        for (const p of processes.values()) {
          if (p.processCode === code) return p;
        }
        return null;
      }),
      findMany: jest.fn().mockImplementation(async () => ({
        items: Array.from(processes.values()),
        total: processes.size,
      })),
      countByYear: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async (id, input) => {
        const existing = processes.get(id);
        if (!existing) throw new Error("Not found");
        const updated = { ...existing, ...input, updatedAt: new Date() };
        processes.set(id, updated);
        return updated;
      }),
      addInstitution: jest.fn(),
      removeInstitution: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
    };

    mockDonorRepo = {
      findById: jest.fn().mockImplementation(async (id) => (id === mockDonor.id ? mockDonor : null)),
    };

    mockPackageRepo = {
      findActivePackage: jest.fn().mockImplementation(async () => {
        const p = Array.from(packages.values())[0];
        return p || null;
      }),
      findPackageByCode: jest.fn().mockImplementation(async (code) => packages.get(code) || null),
      findLatestPublishedVersion: jest.fn().mockImplementation(async (packageId) => {
        for (const v of packageVersions.values()) {
          if (v.packageId === packageId && v.status === "PUBLISHED") return v;
        }
        return null;
      }),
      findVersionById: jest.fn().mockImplementation(async (id) => packageVersions.get(id) || null),
      createDefaultPackage: jest.fn().mockImplementation(async (actorUserId) => {
        const pkg: ProcessPackage = {
          id: "pkg-reg-03",
          code: "PAQUETE_REGIONAL_3",
          name: "Paquete Documental Operativo Regional 3",
          isActive: true,
          createdById: actorUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        packages.set(pkg.id, pkg);
        const ver: ProcessPackageVersion = {
          id: "ver-reg-03-v1",
          packageId: pkg.id,
          versionNumber: "1.0.0",
          status: "PUBLISHED",
          effectiveFrom: new Date(),
          positionsConfig: [...OFFICIAL_REGIONAL_3_POSITIONS],
          publishedAt: new Date(),
          createdById: actorUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        packageVersions.set(ver.id, ver);
        return ver;
      }),
      createProcessDocuments: jest.fn().mockImplementation(async (processId, positions: PackagePositionDefinition[]) => {
        const created: ProcessDocument[] = [];
        for (const pos of positions) {
          const docId = `doc-${processId}-${pos.positionNumber}`;
          if (!documents.has(docId)) {
            const newDoc: ProcessDocument = {
              id: docId,
              processId,
              positionNumber: pos.positionNumber,
              documentCode: pos.documentCode,
              title: pos.title,
              category: pos.category,
              orderIndex: pos.orderIndex,
              isMandatory: pos.isMandatory,
              status: "PENDIENTE",
              applicabilityStatus: pos.defaultApplicability,
              nonApplicabilityReason: null,
              rules: pos.rules || null,
              templateId: null,
              templateVersionId: null,
              currentInstanceId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            documents.set(docId, newDoc);
            created.push(newDoc);
          }
        }
        return created;
      }),
      listProcessDocuments: jest.fn().mockImplementation(async (processId) => {
        return Array.from(documents.values())
          .filter((d) => d.processId === processId)
          .sort((a, b) => a.orderIndex - b.orderIndex);
      }),
      findProcessDocumentById: jest.fn().mockImplementation(async (id) => documents.get(id) || null),
      findProcessDocumentByCode: jest.fn().mockImplementation(async (processId, code) => {
        for (const d of documents.values()) {
          if (d.processId === processId && d.documentCode === code) return d;
        }
        return null;
      }),
      updateProcessDocumentApplicability: jest.fn().mockImplementation(
        async (id, applicabilityStatus: DocumentApplicability, nonApplicabilityReason?: string) => {
          const doc = documents.get(id);
          if (!doc) throw new Error("Document not found");
          const updated = {
            ...doc,
            applicabilityStatus,
            nonApplicabilityReason: nonApplicabilityReason || null,
            updatedAt: new Date(),
          };
          documents.set(id, updated);
          return updated;
        },
      ),
      updateProcessDocumentStatus: jest.fn().mockImplementation(
        async (id, status: ProcessDocumentStatus) => {
          const doc = documents.get(id);
          if (!doc) throw new Error("Document not found");
          const updated = { ...doc, status, updatedAt: new Date() };
          documents.set(id, updated);
          return updated;
        },
      ),
      setProcessDocumentInstance: jest.fn().mockImplementation(async (docId, instanceId) => {
        const doc = documents.get(docId);
        if (!doc) throw new Error("Document not found");
        const updated = { ...doc, currentInstanceId: instanceId, updatedAt: new Date() };
        documents.set(docId, updated);
        return updated;
      }),
      linkTemplateToDocument: jest.fn().mockImplementation(async (docId, templateId, templateVersionId) => {
        const doc = documents.get(docId);
        if (!doc) throw new Error("Document not found");
        const updated = { ...doc, templateId, templateVersionId, updatedAt: new Date() };
        documents.set(docId, updated);
        return updated;
      }),
    };

    mockPrisma = {
      documentTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tpl-anexo-01",
          templateCode: "anexo_01",
          name: "Anexo 1 - Voluntad y Entrevista Familiar",
          versions: [
            {
              id: "tpl-ver-01",
              status: "PUBLISHED",
              schemaDefinition: { fields: [] },
              layoutDefinition: {},
            },
          ],
        }),
      },
      documentInstance: {
        create: jest.fn().mockResolvedValue({
          id: "inst-001",
          donorId: mockProcess.donorId,
          processId: mockProcess.id,
          processDocumentId: "doc-proc-test-01-1",
          templateVersionId: "tpl-ver-01",
          status: "DRAFT",
          revisionNumber: 1,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  });

  describe("Process Opening & 23 Positions Generation", () => {
    it("should automatically seed exact 23 normative positions when creating a new process", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockProcessRepo,
        mockDonorRepo as DonorRecordRepository,
        mockAuditPort,
        mockPackageRepo,
      );

      const created = await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      expect(created).toBeDefined();
      expect(created.processCode).toMatch(/^PROC-2026-\d{4}$/);

      const docs = await mockPackageRepo.listProcessDocuments(created.id);
      expect(docs).toHaveLength(23);
      expect(docs[0].positionNumber === 1 || docs[0].orderIndex === 1).toBe(true);
      expect(docs[0].documentCode).toBe("ANEXO_1");
      expect(docs[22].documentCode).toBe("POS_NORMATIVA_23");
      expect(docs[22].category).toBe("PENDING_HOMOLOGATION");
    });

    it("should be idempotent and not duplicate positions on re-seeding", async () => {
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);
      let docs = await mockPackageRepo.listProcessDocuments(mockProcess.id);
      expect(docs).toHaveLength(23);

      // Re-run creation with same positions
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);
      docs = await mockPackageRepo.listProcessDocuments(mockProcess.id);
      expect(docs).toHaveLength(23);
    });
  });

  describe("ListProcessDocumentsUseCase", () => {
    it("should list 23 positions with calculated metrics and progress percentage", async () => {
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);

      const listUseCase = new ListProcessDocumentsUseCase(mockPackageRepo, mockProcessRepo);
      const summary = await listUseCase.execute(mockProcess.id, coordinatorUser);

      expect(summary.totalPositions).toBe(23);
      expect(summary.applicableCount).toBeGreaterThan(0);
      expect(summary.progressPercentage).toBe(0);

      // Mark one applicable as COMPLETADO
      const firstDoc = summary.documents[0];
      await mockPackageRepo.updateProcessDocumentStatus(firstDoc.id, "COMPLETADO");

      const updatedSummary = await listUseCase.execute(mockProcess.id, coordinatorUser);
      expect(updatedSummary.completedCount).toBe(1);
      expect(updatedSummary.signedCount).toBe(0);
      expect(updatedSummary.progressPercentage).toBe(
        Math.round((1 / updatedSummary.applicableCount) * 100),
      );

      // Mark second applicable as FIRMADO
      const secondDoc = summary.documents[1];
      await mockPackageRepo.updateProcessDocumentStatus(secondDoc.id, "FIRMADO");

      const signedSummary = await listUseCase.execute(mockProcess.id, coordinatorUser);
      expect(signedSummary.completedCount).toBe(1);
      expect(signedSummary.signedCount).toBe(1);
      expect(signedSummary.progressPercentage).toBe(
        Math.round((2 / signedSummary.applicableCount) * 100),
      );
    });

    it("should handle division by zero gracefully if all documents are marked NO_APLICA", async () => {
      const allDocs = await mockPackageRepo.listProcessDocuments(mockProcess.id);
      for (const d of allDocs) {
        await mockPackageRepo.updateProcessDocumentApplicability(d.id, "NO_APLICA", "Descarte total de prueba");
      }

      const listUseCase = new ListProcessDocumentsUseCase(mockPackageRepo, mockProcessRepo);
      const summary = await listUseCase.execute(mockProcess.id, coordinatorUser);

      expect(summary.applicableCount).toBe(0);
      expect(summary.progressPercentage).toBe(0);
      expect(Number.isNaN(summary.progressPercentage)).toBe(false);
    });

    it("should deny access if user does not belong to process primary IPS and is not admin", async () => {
      const listUseCase = new ListProcessDocumentsUseCase(mockPackageRepo, mockProcessRepo);

      await expect(listUseCase.execute(mockProcess.id, foreignUser)).rejects.toThrow(
        "No tiene autorización para consultar los documentos de este proceso",
      );
    });
  });

  describe("UpdateDocumentApplicabilityUseCase", () => {
    beforeEach(async () => {
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);
    });

    it("should update applicability to NO_APLICA when justification is provided", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      const useCase = new UpdateDocumentApplicabilityUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
      );

      const result = await useCase.execute(
        doc.id,
        {
          applicabilityStatus: "NO_APLICA",
          nonApplicabilityReason: "Donante sin consentimiento para rescate de tejidos",
        },
        coordinatorUser,
      );

      expect(result.applicabilityStatus).toBe("NO_APLICA");
      expect(result.nonApplicabilityReason).toBe("Donante sin consentimiento para rescate de tejidos");

      const fetched = await mockPackageRepo.findProcessDocumentById(doc.id);
      expect(fetched?.status).toBe("NO_APLICA");
      expect(mockAuditPort.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DOCUMENT_APPLICABILITY_CHANGED",
          entityId: doc.id,
        }),
      );
    });

    it("should reject NO_APLICA without justification", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      const useCase = new UpdateDocumentApplicabilityUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
      );

      await expect(
        useCase.execute(
          doc.id,
          {
            applicabilityStatus: "NO_APLICA",
            nonApplicabilityReason: "   ",
          },
          coordinatorUser,
        ),
      ).rejects.toThrow(ProcessPackageValidationError);
    });

    it("should block changing a COMPLETADO or FIRMADO document to NO_APLICA", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      await mockPackageRepo.updateProcessDocumentStatus(doc.id, "COMPLETADO");

      const useCase = new UpdateDocumentApplicabilityUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
      );

      await expect(
        useCase.execute(
          doc.id,
          {
            applicabilityStatus: "NO_APLICA",
            nonApplicabilityReason: "Ya no aplica según médico",
          },
          coordinatorUser,
        ),
      ).rejects.toThrow(ProcessDocumentConflictError);
    });
  });

  describe("InitiateProcessDocumentUseCase", () => {
    beforeEach(async () => {
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);
    });

    it("should block initiation if document is marked as NO_APLICA", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      await mockPackageRepo.updateProcessDocumentApplicability(
        doc.id,
        "NO_APLICA",
        "Justificación válida",
      );

      const useCase = new InitiateProcessDocumentUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
        mockPrisma,
      );

      await expect(useCase.execute(doc.id, coordinatorUser)).rejects.toThrow(
        ProcessDocumentConflictError,
      );
    });

    it("should reject initiation of positions pending homologation when template does not exist", async () => {
      // Posición 20 (POS_NORMATIVA_20)
      const pendingDoc = (await mockPackageRepo.listProcessDocuments(mockProcess.id)).find(
        (d) => d.category === "PENDING_HOMOLOGATION",
      )!;

      // Mock template not found for pending homologation
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const useCase = new InitiateProcessDocumentUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
        mockPrisma,
      );

      await expect(useCase.execute(pendingDoc.id, coordinatorUser)).rejects.toThrow(
        ProcessPackageValidationError,
      );
    });

    it("should initiate document instance in DRAFT status when template is available", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      const useCase = new InitiateProcessDocumentUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
        mockPrisma,
      );

      const result = await useCase.execute(doc.id, coordinatorUser);
      expect(result.instanceId).toBe("inst-001");
      expect(result.document.currentInstanceId).toBe("inst-001");
      expect(mockPrisma.documentInstance.create).toHaveBeenCalled();
    });

    it("should be idempotent and return existing instanceId without re-creating", async () => {
      const doc = (await mockPackageRepo.listProcessDocuments(mockProcess.id))[0];
      await mockPackageRepo.setProcessDocumentInstance(doc.id, "inst-existing-99");

      const useCase = new InitiateProcessDocumentUseCase(
        mockPackageRepo,
        mockProcessRepo,
        mockAuditPort,
        mockPrisma,
      );

      const result = await useCase.execute(doc.id, coordinatorUser);
      expect(result.instanceId).toBe("inst-existing-99");
      expect(mockPrisma.documentInstance.create).not.toHaveBeenCalled();
    });
  });

  describe("EvaluateDocumentDependenciesUseCase", () => {
    beforeEach(async () => {
      await mockPackageRepo.createProcessDocuments(mockProcess.id, [...OFFICIAL_REGIONAL_3_POSITIONS]);
    });

    it("should report dependency unsatisfied if prerequisite document is not completed or signed", async () => {
      // ANEXO_4 depends on ANEXO_1
      const anexo4 = (await mockPackageRepo.listProcessDocuments(mockProcess.id)).find(
        (d) => d.documentCode === "ANEXO_4",
      )!;

      const evalUseCase = new EvaluateDocumentDependenciesUseCase(
        mockPackageRepo,
        mockProcessRepo,
      );
      const evalResult = await evalUseCase.execute(anexo4.id, coordinatorUser);

      expect(evalResult.isSatisfied).toBe(false);
      expect(evalResult.canInitiateDraft).toBe(true);
      expect(evalResult.canApproveOrSign).toBe(false);
      expect(evalResult.blockingReasons.length).toBeGreaterThan(0);
      expect(evalResult.blockingReasons[0]).toContain("ANEXO_1");
    });

    it("should report dependency satisfied once prerequisite document is completed", async () => {
      const anexo1 = (await mockPackageRepo.listProcessDocuments(mockProcess.id)).find(
        (d) => d.documentCode === "ANEXO_1",
      )!;
      await mockPackageRepo.updateProcessDocumentStatus(anexo1.id, "COMPLETADO");

      const anexo4 = (await mockPackageRepo.listProcessDocuments(mockProcess.id)).find(
        (d) => d.documentCode === "ANEXO_4",
      )!;

      const evalUseCase = new EvaluateDocumentDependenciesUseCase(
        mockPackageRepo,
        mockProcessRepo,
      );
      const evalResult = await evalUseCase.execute(anexo4.id, coordinatorUser);

      expect(evalResult.isSatisfied).toBe(true);
      expect(evalResult.canInitiateDraft).toBe(true);
      expect(evalResult.canApproveOrSign).toBe(true);
      expect(evalResult.blockingReasons).toHaveLength(0);
    });

    it("should allow multiple tissue and organ variants to coexist in the same process", async () => {
      const docs = await mockPackageRepo.listProcessDocuments(mockProcess.id);
      const tissueVariants = docs.filter((d) => d.category === "TISSUE");
      const organVariants = docs.filter((d) => d.category === "ORGAN");

      expect(tissueVariants.length).toBe(4); // Ocular, Cardio, Osteo, Piel
      expect(organVariants.length).toBe(7); // Corazón, Hígado, Otros Órganos, Páncreas, Pulmón, Riñón D., Riñón I.

      // All can be activated independently according to clinical recovery
      for (const t of tissueVariants) {
        expect(t.applicabilityStatus).toBe("CONDICIONAL");
      }
      for (const o of organVariants) {
        expect(o.applicabilityStatus).toBe("CONDICIONAL");
      }
    });
  });
});
