import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { ApplyCanonicalValueUseCase } from "../src/application/canonical/apply-canonical-value.use-case";
import { ResolveCanonicalConflictUseCase } from "../src/application/canonical/resolve-canonical-conflict.use-case";
import { GetProcessCanonicalValuesUseCase } from "../src/application/canonical/get-process-canonical-values.use-case";
import { ListCanonicalCatalogUseCase } from "../src/application/canonical/list-canonical-catalog.use-case";
import {
  CanonicalFieldDefinition,
  CanonicalValidationError,
  HOMOLOGATED_CANONICAL_FIELDS,
  ProcessCanonicalHistory,
  ProcessCanonicalValue,
} from "../src/domain/canonical/canonical-dictionary";
import { CanonicalDictionaryRepository } from "../src/application/canonical/canonical-dictionary.repository";
import { DonationProcessRepository } from "../src/application/processes/donation-process.repository";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { DonationProcess } from "../src/domain/processes/donation-process";

describe("Canonical Dictionary, Shared Markers & Propagation Engine (Phase C)", () => {
  let catalogMap: Map<string, CanonicalFieldDefinition>;
  let processValuesMap: Map<string, ProcessCanonicalValue>;
  let historyList: ProcessCanonicalHistory[];
  let instancesMap: Map<string, any>;
  let revisionsMap: Map<string, any>;
  let provenanceList: any[];
  let processesMap: Map<string, DonationProcess>;
  let auditLogs: unknown[];

  let mockRepo: CanonicalDictionaryRepository;
  let mockProcessRepo: DonationProcessRepository;
  let mockAuditPort: AuditEventPort;
  let mockPrisma: any;

  let propagationEngine: CanonicalPropagationEngine;
  let applyUseCase: ApplyCanonicalValueUseCase;
  let resolveUseCase: ResolveCanonicalConflictUseCase;
  let getValuesUseCase: GetProcessCanonicalValuesUseCase;
  let listCatalogUseCase: ListCanonicalCatalogUseCase;

  const coordinatorUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const foreignUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000002",
    role: "COORDINATOR",
    institutionalIps: ["Clínica Imbanaco"],
  };

  const mockProcess: DonationProcess = {
    id: "proc-canonical-01",
    processCode: "PROC-2026-0099",
    donorId: "donor-can-01",
    status: "EN_CURSO",
    primaryIpsName: "Hospital Universitario del Valle",
    openedById: coordinatorUser.userId,
    openedAt: new Date(),
    closedById: null,
    closedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Plantilla Anexo 1
  const templateAnexo1 = {
    id: "tpl-anexo-1",
    templateCode: "anexo_01",
    name: "Anexo 1 - Valoración Inicial",
    versions: [
      {
        id: "ver-anexo-1",
        versionNumber: "1.0.0",
        mappingConfig: [
          {
            schemaPath: "patient.fullName",
            canonicalFieldKey: "donor.identity.full_name",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "clinical.bloodGroup",
            canonicalFieldKey: "donor.clinical.blood_group",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "labs.arterialPh",
            canonicalFieldKey: "donor.clinical.arterial_ph",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "number",
          },
        ],
      },
    ],
  };

  // Plantilla Anexo 4
  const templateAnexo4 = {
    id: "tpl-anexo-4",
    templateCode: "anexo_04",
    name: "Anexo 4 - Registro y Oferta",
    versions: [
      {
        id: "ver-anexo-4",
        versionNumber: "1.0.0",
        mappingConfig: [
          {
            schemaPath: "donor.fullName",
            canonicalFieldKey: "donor.identity.full_name",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "donor.bloodGroup",
            canonicalFieldKey: "donor.clinical.blood_group",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "evaluation.arterialPh",
            canonicalFieldKey: "donor.clinical.arterial_ph",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "number",
          },
        ],
      },
    ],
  };

  // Plantilla Anexo 6
  const templateAnexo6 = {
    id: "tpl-anexo-6",
    templateCode: "anexo_06",
    name: "Anexo 6 - Extracción de Componentes",
    versions: [
      {
        id: "ver-anexo-6",
        versionNumber: "1.0.0",
        mappingConfig: [
          {
            schemaPath: "datosDonante.nombreCompleto",
            canonicalFieldKey: "donor.identity.full_name",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "datosDonante.grupoSanguineo",
            canonicalFieldKey: "donor.clinical.blood_group",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            schemaPath: "tiemposQuirurgicos.clampeoAortico",
            canonicalFieldKey: "process.recovery.aortic_clamp_at",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "date-time",
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    catalogMap = new Map();
    processValuesMap = new Map();
    historyList = [];
    instancesMap = new Map();
    revisionsMap = new Map();
    provenanceList = [];
    processesMap = new Map();
    auditLogs = [];

    processesMap.set(mockProcess.id, { ...mockProcess });

    // Sembrar catálogo inicial en memoria
    for (const def of HOMOLOGATED_CANONICAL_FIELDS) {
      catalogMap.set(def.canonicalFieldKey, {
        ...def,
        id: `def-${def.canonicalFieldKey}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    mockAuditPort = {
      record: jest.fn().mockImplementation((event) => {
        auditLogs.push(event);
        return Promise.resolve();
      }),
    };

    mockRepo = {
      listCatalog: jest.fn().mockImplementation(async () => Array.from(catalogMap.values())),
      findFieldByKey: jest.fn().mockImplementation(async (key) => catalogMap.get(key) || null),
      seedDefaultCatalog: jest.fn().mockImplementation(async () => {
        for (const def of HOMOLOGATED_CANONICAL_FIELDS) {
          if (!catalogMap.has(def.canonicalFieldKey)) {
            catalogMap.set(def.canonicalFieldKey, {
              ...def,
              id: `def-${def.canonicalFieldKey}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }),
      findProcessValues: jest.fn().mockImplementation(async (processId) => {
        return Array.from(processValuesMap.values()).filter((v) => v.processId === processId);
      }),
      findProcessValueByKey: jest.fn().mockImplementation(async (processId, key) => {
        return processValuesMap.get(`${processId}:${key}`) || null;
      }),
      upsertProcessValue: jest.fn().mockImplementation(async (data) => {
        const compositeKey = `${data.processId}:${data.canonicalFieldKey}`;
        const existing = processValuesMap.get(compositeKey);
        const versionNumber = existing ? existing.versionNumber + 1 : 1;
        const saved: ProcessCanonicalValue = {
          id: existing?.id || `pcv-${Date.now()}-${Math.random()}`,
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
          currentValue: data.value,
          unit: data.unit || null,
          effectiveAt: data.effectiveAt || new Date(),
          sampleContext: data.sampleContext || null,
          sourceKind: data.sourceKind,
          sourceInstanceId: data.sourceInstanceId || null,
          sourceRevisionId: data.sourceRevisionId || null,
          versionNumber,
          conflictStatus: "NONE",
          conflictDetails: null,
          updatedById: data.actorUserId,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        processValuesMap.set(compositeKey, saved);
        return saved;
      }),
      addHistoryEntry: jest.fn().mockImplementation(async (data) => {
        const entry: ProcessCanonicalHistory = {
          id: `pch-${Date.now()}-${Math.random()}`,
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
          value: data.value,
          unit: data.unit || null,
          effectiveAt: data.effectiveAt || new Date(),
          sampleContext: data.sampleContext || null,
          sourceKind: data.sourceKind,
          sourceInstanceId: data.sourceInstanceId || null,
          sourceRevisionId: data.sourceRevisionId || null,
          sourceDocumentId: data.sourceDocumentId || null,
          versionNumber: data.versionNumber,
          createdById: data.actorUserId,
          createdAt: new Date(),
        };
        historyList.push(entry);
        return entry;
      }),
      listHistory: jest.fn().mockImplementation(async (processId, key) => {
        return historyList.filter((h) => h.processId === processId && h.canonicalFieldKey === key);
      }),
      listObservations: jest.fn().mockImplementation(async (processId, key, contextFilter) => {
        return historyList
          .filter((h) => h.processId === processId && h.canonicalFieldKey === key)
          .filter((h) => (!contextFilter ? true : h.sampleContext === contextFilter))
          .sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime());
      }),
      updateConflictStatus: jest.fn().mockImplementation(async (processId, key, status, details, actorUserId) => {
        const compositeKey = `${processId}:${key}`;
        const existing = processValuesMap.get(compositeKey);
        if (!existing) throw new Error("Not found");
        const updated = {
          ...existing,
          conflictStatus: status,
          conflictDetails: details || null,
          updatedById: actorUserId || existing.updatedById,
          updatedAt: new Date(),
        };
        processValuesMap.set(compositeKey, updated);
        return updated;
      }),
    };

    mockProcessRepo = {
      findById: jest.fn().mockImplementation(async (id) => processesMap.get(id) || null),
      findByCode: jest.fn().mockImplementation(async (code) => {
        for (const p of processesMap.values()) {
          if (p.processCode === code) return p;
        }
        return null;
      }),
      findMany: jest.fn().mockImplementation(async () => ({
        items: Array.from(processesMap.values()),
        total: processesMap.size,
      })),
      create: jest.fn(),
      update: jest.fn(),
      addInstitution: jest.fn(),
      removeInstitution: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      countByYear: jest.fn().mockResolvedValue(0),
    };

    mockPrisma = {
      donationProcess: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const proc = processesMap.get(where.id);
          if (!proc) return null;
          return {
            ...proc,
            donor: {
              id: proc.donorId,
              fullName: "Donante Original",
              documentNumber: "11223344",
              bloodGroup: "O",
              rhFactor: "POSITIVO",
              rndCode: "RND-2026-0001",
              originatingIpsName: proc.primaryIpsName,
            },
          };
        }),
      },
      donorRecord: {
        update: jest.fn().mockResolvedValue({}),
      },
      templateVersion: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === "ver-anexo-1") return templateAnexo1.versions[0];
          if (where.id === "ver-anexo-4") return templateAnexo4.versions[0];
          if (where.id === "ver-anexo-6") return templateAnexo6.versions[0];
          return null;
        }),
      },
      documentInstance: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return instancesMap.get(where.id) || null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return Array.from(instancesMap.values()).filter((i) => i.processId === where.processId);
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const existing = instancesMap.get(where.id);
          if (!existing) throw new Error("Instance not found");
          const updated = { ...existing, ...data };
          instancesMap.set(where.id, updated);
          return updated;
        }),
      },
      documentResponseRevision: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const id = `rev-${Date.now()}-${Math.random()}`;
          const newRev = { id, ...data, createdAt: new Date() };
          revisionsMap.set(id, newRev);
          // Actualizar el currentRevision de la instancia en memoria
          const inst = instancesMap.get(data.documentInstanceId);
          if (inst) {
            inst.currentRevisionId = id;
            inst.currentRevision = newRev;
          }
          return newRev;
        }),
      },
      documentFieldProvenance: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const prov = { id: `prov-${Date.now()}-${Math.random()}`, ...data, createdAt: new Date() };
          provenanceList.push(prov);
          return prov;
        }),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          let count = 0;
          for (const prov of provenanceList) {
            if (
              (!where.documentInstanceId || prov.documentInstanceId === where.documentInstanceId) &&
              (!where.fieldPath || prov.fieldPath === where.fieldPath)
            ) {
              Object.assign(prov, data);
              count++;
            }
          }
          return { count };
        }),
      },
    };

    propagationEngine = new CanonicalPropagationEngine(mockRepo, mockPrisma, mockAuditPort);
    applyUseCase = new ApplyCanonicalValueUseCase(propagationEngine, mockPrisma);
    resolveUseCase = new ResolveCanonicalConflictUseCase(mockRepo, mockProcessRepo, propagationEngine, mockAuditPort, mockPrisma);
    getValuesUseCase = new GetProcessCanonicalValuesUseCase(mockRepo, mockProcessRepo);
    listCatalogUseCase = new ListCanonicalCatalogUseCase(mockRepo);
  });

  // Helper para inicializar instancias en memoria
  function createMockInstance(id: string, code: string, templateVersion: any, status = "DRAFT", initialData = {}) {
    const revId = `rev-${id}-1`;
    const rev = {
      id: revId,
      documentInstanceId: id,
      revisionNumber: 1,
      responseData: initialData,
      createdAt: new Date(),
    };
    revisionsMap.set(revId, rev);

    const instance = {
      id,
      processId: mockProcess.id,
      documentCode: code,
      templateVersionId: templateVersion.versions[0].id,
      templateVersion: templateVersion.versions[0],
      status,
      currentRevisionId: revId,
      currentRevision: rev,
      process: mockProcess,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    instancesMap.set(id, instance);
    return instance;
  }

  describe("Caso A: Diligenciamiento manual sin historia clínica y precarga cruzada", () => {
    it("debe capturar un campo compartido en Anexo 1, persistir valor canónico y precargarlo en Anexo 4 y 6", async () => {
      // 1. Instancia de Anexo 1
      const instAnexo1 = createMockInstance("inst-anexo-1", "ANEXO_1", templateAnexo1);
      // Instancia abierta de Anexo 4 vacía
      const instAnexo4 = createMockInstance("inst-anexo-4", "ANEXO_4", templateAnexo4);

      // 2. Diligenciar manualmente grupo sanguíneo "B" desde Anexo 1
      const propResult = await applyUseCase.executeFromInstance({
        instanceId: instAnexo1.id,
        canonicalFieldKey: "donor.clinical.blood_group",
        value: "B",
        user: coordinatorUser,
      });

      expect(propResult.canonicalFieldKey).toBe("donor.clinical.blood_group");
      expect(propResult.currentValue).toBe("B");
      expect(propResult.propagatedCount).toBe(1); // Propagó a Anexo 4

      // 3. Verificar que el valor canónico se guardó en el proceso
      const canonicalVal = await getValuesUseCase.getValue(mockProcess.id, "donor.clinical.blood_group", coordinatorUser);
      expect(canonicalVal.currentValue).toBe("B");
      expect(canonicalVal.sourceKind).toBe("MANUAL");

      // 4. Verificar que Anexo 4 recibió el dato en su responseData
      const updatedAnexo4 = instancesMap.get(instAnexo4.id);
      expect(updatedAnexo4.currentRevision.responseData.donor.bloodGroup).toBe("B");

      // 5. Comprobar procedencia registrada
      const prov = provenanceList.find(
        (p) => p.canonicalFieldKey === "donor.clinical.blood_group" && p.sourceKind === "PROCESS_CANONICAL",
      );
      expect(prov).toBeDefined();
      expect(prov.sourceValue).toBe("B");
    });
  });

  describe("Caso B: Actualización de dato canónico y propagación", () => {
    it("debe propagar la rectificación de un dato canónico a todas las instancias abiertas compatibles", async () => {
      const instAnexo1 = createMockInstance("inst-anexo-1", "ANEXO_1", templateAnexo1, "EN_DILIGENCIAMIENTO", {
        clinical: { bloodGroup: "O" },
      });
      const instAnexo4 = createMockInstance("inst-anexo-4", "ANEXO_4", templateAnexo4, "EN_DILIGENCIAMIENTO", {
        donor: { bloodGroup: "O" },
      });
      const instAnexo6 = createMockInstance("inst-anexo-6", "ANEXO_6", templateAnexo6, "EN_DILIGENCIAMIENTO", {
        datosDonante: { grupoSanguineo: "O" },
      });

      // Modificar a "AB" desde Anexo 4
      const result = await applyUseCase.executeFromInstance({
        instanceId: instAnexo4.id,
        canonicalFieldKey: "donor.clinical.blood_group",
        value: "AB",
        user: coordinatorUser,
      });

      expect(result.propagatedCount).toBe(2); // Propagó a Anexo 1 y Anexo 6

      // Comprobar que Anexo 1 y Anexo 6 tienen "AB"
      expect(instancesMap.get(instAnexo1.id).currentRevision.responseData.clinical.bloodGroup).toBe("AB");
      expect(instancesMap.get(instAnexo6.id).currentRevision.responseData.datosDonante.grupoSanguineo).toBe("AB");
    });
  });

  describe("Caso C: Documento futuro no iniciado recibe valor canónico vigente al crearse", () => {
    it("debe precargar valores canónicos en una plantilla cuando la instancia se inicia posteriormente", async () => {
      // 1. Registrar fecha/hora de clampeo aórtico directamente en el proceso
      await applyUseCase.executeDirect({
        processId: mockProcess.id,
        canonicalFieldKey: "process.recovery.aortic_clamp_at",
        value: "2026-11-06T14:30:00.000Z",
        user: coordinatorUser,
      });

      // 2. Anexo 6 no ha sido iniciado todavía. Al solicitar precarga para Anexo 6:
      const preloaded = await propagationEngine.preloadCanonicalValues(mockProcess.id, "ver-anexo-6");

      expect(preloaded.responseData.tiemposQuirurgicos).toBeDefined();
      expect((preloaded.responseData.tiemposQuirurgicos as any).clampeoAortico).toBe("2026-11-06T14:30:00.000Z");
      expect(preloaded.provenance).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            canonicalFieldKey: "process.recovery.aortic_clamp_at",
            sourceValue: "2026-11-06T14:30:00.000Z",
          }),
        ]),
      );
    });
  });

  describe("Caso D: Detección de conflicto y resolución autorizada", () => {
    it("no debe sobrescribir silenciosamente si una instancia destino tiene un valor divergente previo", async () => {
      createMockInstance("inst-anexo-1", "ANEXO_1", templateAnexo1, "EN_DILIGENCIAMIENTO", {
        patient: { fullName: "Carlos Pérez" },
      });
      // Anexo 4 fue llenado localmente con un nombre divergente
      createMockInstance("inst-anexo-4", "ANEXO_4", templateAnexo4, "EN_DILIGENCIAMIENTO", {
        donor: { fullName: "Carlos Pérez Gómez" },
      });

      // Actualizar canónico desde Anexo 1 a "Carlos Alberto Pérez"
      const result = await applyUseCase.executeFromInstance({
        instanceId: "inst-anexo-1",
        canonicalFieldKey: "donor.identity.full_name",
        value: "Carlos Alberto Pérez",
        user: coordinatorUser,
      });

      // Anexo 4 no debe haber sido sobreescrito silenciosamente
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].documentCode).toBe("ANEXO_4");
      expect(result.conflicts[0].existingValue).toBe("Carlos Pérez Gómez");

      const anexo4Inst = instancesMap.get("inst-anexo-4");
      expect(anexo4Inst.currentRevision.responseData.donor.fullName).toBe("Carlos Pérez Gómez");

      // Comprobar que el valor canónico quedó marcado con conflicto detectado
      const canonicalVal = await getValuesUseCase.getValue(mockProcess.id, "donor.identity.full_name", coordinatorUser);
      expect(canonicalVal.conflictStatus).toBe("CONFLICT_DETECTED");

      // Resolver conflicto con estrategia ACCEPT_CANDIDATE y justificación obligatoria
      const resolved = await resolveUseCase.execute({
        processId: mockProcess.id,
        canonicalFieldKey: "donor.identity.full_name",
        strategy: "ACCEPT_CANDIDATE",
        justification: "Confirmado con fotocopia de cédula de ciudadanía aportada por deudos",
        user: coordinatorUser,
      });

      expect(resolved.conflictStatus).toBe("RESOLVED");
      // Ahora Anexo 4 sí fue actualizado a la verdad ratificada
      expect(instancesMap.get("inst-anexo-4").currentRevision.responseData.donor.fullName).toBe("Carlos Alberto Pérez");
    });
  });

  describe("Caso E: Mediciones clínicas repetibles (arterial_ph)", () => {
    it("debe preservar todas las mediciones temporales de pH en el historial sin sobreescribir", async () => {
      const dates = [
        new Date("2026-11-06T08:00:00Z"),
        new Date("2026-11-06T10:30:00Z"),
        new Date("2026-11-06T13:00:00Z"),
      ];

      // Registrar 3 gasometrías seriadas
      await applyUseCase.executeDirect({
        processId: mockProcess.id,
        canonicalFieldKey: "donor.clinical.arterial_ph",
        value: 7.32,
        sampleContext: "Gasometría basal de ingreso",
        effectiveAt: dates[0],
        user: coordinatorUser,
      });

      await applyUseCase.executeDirect({
        processId: mockProcess.id,
        canonicalFieldKey: "donor.clinical.arterial_ph",
        value: 7.38,
        sampleContext: "Control post-corrección de bicarbonato",
        effectiveAt: dates[1],
        user: coordinatorUser,
      });

      await applyUseCase.executeDirect({
        processId: mockProcess.id,
        canonicalFieldKey: "donor.clinical.arterial_ph",
        value: 7.42,
        sampleContext: "Gasometría previa a quirófano",
        effectiveAt: dates[2],
        user: coordinatorUser,
      });

      // El historial debe contener exactamente las 3 mediciones inmutables
      const history = await getValuesUseCase.getHistory(mockProcess.id, "donor.clinical.arterial_ph", coordinatorUser);
      expect(history).toHaveLength(3);
      expect(history[0].value).toBe(7.32);
      expect(history[0].sampleContext).toBe("Gasometría basal de ingreso");
      expect(history[1].value).toBe(7.38);
      expect(history[2].value).toBe(7.42);

      // El valor vigente es el último registrado (7.42)
      const current = await getValuesUseCase.getValue(mockProcess.id, "donor.clinical.arterial_ph", coordinatorUser);
      expect(current.currentValue).toBe(7.42);
      expect(current.versionNumber).toBe(3);
    });
  });

  describe("Caso F: Protección de documentos completados y firmados", () => {
    it("no debe modificar ni sobreescribir instancias en estado COMPLETADO o FIRMADO", async () => {
      createMockInstance("inst-anexo-1", "ANEXO_1", templateAnexo1, "EN_DILIGENCIAMIENTO");
      // Anexo 4 completado y Anexo 6 firmado
      const instAnexo4 = createMockInstance("inst-anexo-4", "ANEXO_4", templateAnexo4, "COMPLETADO", {
        donor: { bloodGroup: "O" },
      });
      const instAnexo6 = createMockInstance("inst-anexo-6", "ANEXO_6", templateAnexo6, "FIRMADO", {
        datosDonante: { grupoSanguineo: "O" },
      });

      // Modificar grupo sanguíneo desde Anexo 1
      const result = await applyUseCase.executeFromInstance({
        instanceId: "inst-anexo-1",
        canonicalFieldKey: "donor.clinical.blood_group",
        value: "A",
        user: coordinatorUser,
      });

      expect(result.propagatedCount).toBe(0); // Ninguno editable
      expect(result.propagatedInstances).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ instanceId: instAnexo4.id, status: "SKIPPED_LOCKED" }),
          expect.objectContaining({ instanceId: instAnexo6.id, status: "SKIPPED_LOCKED" }),
        ]),
      );

      // Los datos de Anexo 4 y 6 permanecen inmutables en "O"
      expect(instancesMap.get(instAnexo4.id).currentRevision.responseData.donor.bloodGroup).toBe("O");
      expect(instancesMap.get(instAnexo6.id).currentRevision.responseData.datosDonante.grupoSanguineo).toBe("O");
    });
  });

  describe("Validación de Políticas y Restricciones de Seguridad", () => {
    it("debe rechazar modificación manual de campos READONLY_DERIVED como rnd_code", async () => {
      createMockInstance("inst-anexo-1", "ANEXO_1", templateAnexo1);

      await expect(
        applyUseCase.executeFromInstance({
          instanceId: "inst-anexo-1",
          canonicalFieldKey: "donor.registration.rnd_code",
          value: "RND-HACK-001",
          user: coordinatorUser,
        }),
      ).rejects.toThrow(CanonicalValidationError);
    });

    it("debe denegar acceso a usuarios no autorizados por alcance institucional", async () => {
      await expect(
        getValuesUseCase.listValues(mockProcess.id, foreignUser),
      ).rejects.toThrow("No tiene autorización para consultar los valores canónicos de este proceso");
    });
  });
});

