import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import {
  CanonicalFieldDefinition,
  HOMOLOGATED_CANONICAL_FIELDS,
  ProcessCanonicalHistory,
  ProcessCanonicalValue,
} from "../src/domain/canonical/canonical-dictionary";
import { CanonicalDictionaryRepository } from "../src/application/canonical/canonical-dictionary.repository";
import { AuditEventPort } from "../src/application/audit/audit-event.port";

describe("Canonical Conflict Matrix & Propagation Engine (Fase G.1.3.1 Audit)", () => {
  let catalogMap: Map<string, CanonicalFieldDefinition>;
  let processValuesMap: Map<string, ProcessCanonicalValue>;
  let historyList: ProcessCanonicalHistory[];
  let instancesMap: Map<string, any>;
  let revisionsMap: Map<string, any>;

  let mockRepo: CanonicalDictionaryRepository;
  let mockPrisma: any;
  let mockAudit: AuditEventPort;
  let engine: CanonicalPropagationEngine;

  const actorUserId = "user-auditor-01";
  const processId = "proc-audit-2026-001";

  beforeEach(() => {
    catalogMap = new Map();
    for (const f of HOMOLOGATED_CANONICAL_FIELDS) {
      catalogMap.set(f.canonicalFieldKey, {
        ...f,
        id: `def-${f.canonicalFieldKey}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Campo estrictamente LOCAL para el escenario 1
    catalogMap.set("local.internal_notes", {
      id: "def-local-1",
      canonicalFieldKey: "local.internal_notes",
      displayName: "Notas Locales de Valoración",
      dataType: "string",
      scope: "PROCESS",
      sharingPolicy: "LOCAL",
      cardinality: "SINGLE",
      description: "Campo interno de uso exclusivo por documento",
      unit: null,
      allowedSources: ["MANUAL", "OCR_CONFIRMED"],
      writable: true,
      validationRules: null,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    processValuesMap = new Map();
    historyList = [];
    instancesMap = new Map();
    revisionsMap = new Map();

    mockRepo = {
      listCatalog: jest.fn().mockImplementation(async () => Array.from(catalogMap.values())),
      findFieldByKey: jest.fn().mockImplementation(async (k) => catalogMap.get(k) || null),
      seedDefaultCatalog: jest.fn().mockImplementation(async () => {}),
      findProcessValues: jest.fn().mockImplementation(async (pId) => Array.from(processValuesMap.values()).filter((v) => v.processId === pId)),
      findProcessValueByKey: jest.fn().mockImplementation(async (pId, k) => processValuesMap.get(`${pId}:${k}`) || null),
      listHistory: jest.fn().mockImplementation(async (pId, k) => historyList.filter((h) => h.processId === pId && h.canonicalFieldKey === k)),
      listObservations: jest.fn().mockImplementation(async () => []),
      updateConflictStatus: jest.fn().mockResolvedValue({}),
      upsertProcessValue: jest.fn().mockImplementation(async (data) => {
        const key = `${data.processId}:${data.canonicalFieldKey}`;
        const existing = processValuesMap.get(key);
        const vNum = (existing?.versionNumber || 0) + 1;
        const val: ProcessCanonicalValue = {
          id: existing?.id || `pval-${Date.now()}`,
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
          currentValue: data.value,
          unit: data.unit ?? null,
          sampleContext: data.sampleContext ?? null,
          effectiveAt: data.effectiveAt,
          sourceKind: data.sourceKind,
          sourceInstanceId: data.sourceInstanceId ?? null,
          sourceRevisionId: data.sourceRevisionId ?? null,
          versionNumber: vNum,
          conflictStatus: "NONE",
          conflictDetails: null,
          updatedById: data.actorUserId,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        processValuesMap.set(key, val);
        return val;
      }),
      addHistoryEntry: jest.fn().mockImplementation(async (data) => {
        const entry: ProcessCanonicalHistory = {
          id: `hist-${Date.now()}`,
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
          value: data.value,
          unit: data.unit ?? null,
          sampleContext: data.sampleContext ?? null,
          effectiveAt: data.effectiveAt,
          sourceKind: data.sourceKind,
          sourceInstanceId: data.sourceInstanceId ?? null,
          sourceRevisionId: data.sourceRevisionId ?? null,
          versionNumber: data.versionNumber,
          createdById: data.actorUserId,
          createdAt: new Date(),
        };
        historyList.push(entry);
        return entry;
      }),
    };

    mockPrisma = {
      donationProcess: {
        findUnique: jest.fn().mockResolvedValue({
          id: processId,
          donorId: "donor-01",
          donor: { id: "donor-01", fullName: "Donante Inicial" },
        }),
      },
      donorRecord: {
        update: jest.fn().mockResolvedValue({}),
      },
      documentInstance: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(instancesMap.values()))),
        update: jest.fn(),
      },
      documentResponseRevision: {
        create: jest.fn().mockImplementation((args) => {
          const rev = { id: `rev-${Date.now()}`, ...args.data };
          revisionsMap.set(rev.id, rev);
          return Promise.resolve(rev);
        }),
      },
      documentFieldProvenance: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    engine = new CanonicalPropagationEngine(mockRepo, mockPrisma, mockAudit);
  });

  // -------------------------------------------------------------
  // ESCENARIO 1: Campo Local (No propaga ni genera conflicto)
  // -------------------------------------------------------------
  it("Escenario 1: Local field - cambios en campo local no propagan ni crean conflicto", async () => {
    // Instancia abierta con campo local mapeado
    instancesMap.set("inst-local", {
      id: "inst-local",
      documentCode: "ANEXO_1",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [{ schemaPath: "notes", canonicalFieldKey: "local.internal_notes" }],
      },
      currentRevision: { responseData: { notes: "Nota local previa" } },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "local.internal_notes",
      value: "Nueva nota confidencial local",
      sourceKind: "MANUAL",
      actorUserId,
    });

    expect(result.sharingPolicy).toBe("LOCAL");
    expect(result.propagatedCount).toBe(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.propagatedInstances).toHaveLength(0);
  });

  // -------------------------------------------------------------
  // ESCENARIO 2: Campo Compartido (Propagación limpia)
  // -------------------------------------------------------------
  it("Escenario 2: Shared field - actualización de marcador compartido propaga a instancias abiertas", async () => {
    instancesMap.set("inst-target", {
      id: "inst-target",
      documentCode: "ANEXO_2",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [
          { schemaPath: "donor.fullName", canonicalFieldKey: "donor.identity.full_name" },
        ],
      },
      currentRevision: { responseData: {} },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Carlos Alberto Rodríguez",
      sourceKind: "MANUAL",
      actorUserId,
    });

    expect(result.propagatedCount).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.propagatedInstances[0].status).toBe("UPDATED");
    expect(result.propagatedInstances[0].documentCode).toBe("ANEXO_2");
  });

  // -------------------------------------------------------------
  // ESCENARIO 3: Mapeo Incompleto o Faltante (Tolerancia a fallos)
  // -------------------------------------------------------------
  it("Escenario 3: Incomplete mapping - plantilla con mapeo corrupto o nulo no interrumpe el motor", async () => {
    instancesMap.set("inst-corrupt", {
      id: "inst-corrupt",
      documentCode: "ANEXO_4",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [
          null, // elemento nulo
          { schemaPath: "" }, // sin canonicalFieldKey
          { canonicalFieldKey: "other.unrelated.field" },
        ],
      },
      currentRevision: { responseData: {} },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Carlos Alberto Rodríguez",
      sourceKind: "MANUAL",
      actorUserId,
    });

    expect(result.conflicts).toHaveLength(0);
    expect(result.propagatedCount).toBe(0);
  });

  // -------------------------------------------------------------
  // ESCENARIO 4: Conflicto Real Detectado (Divergencia entre fuentes)
  // -------------------------------------------------------------
  it("Escenario 4: Real conflict - detecta divergencia entre documentos sin sobreescribir silenciosamente", async () => {
    // Instancia origen con valor previo sincronizado
    instancesMap.set("inst-origin", {
      id: "inst-origin",
      documentCode: "ANEXO_1",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [{ schemaPath: "patientName", canonicalFieldKey: "donor.identity.full_name" }],
      },
      currentRevision: { responseData: { patientName: "Nombre Anterior A" } },
    });

    // Instancia destino que tiene un valor diferente y NO sincronizado previamente
    instancesMap.set("inst-divergent", {
      id: "inst-divergent",
      documentCode: "ANEXO_3",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [{ schemaPath: "donorName", canonicalFieldKey: "donor.identity.full_name" }],
      },
      currentRevision: {
        responseData: { donorName: "Nombre Divergente Registrado B" },
        provenance: [{ fieldPath: "donorName", sourceKind: "OCR_CONFIRMED", validatedAt: new Date() }],
      },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Nuevo Nombre Oficial C",
      sourceKind: "MANUAL",
      sourceInstanceId: "inst-origin",
      actorUserId,
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].documentCode).toBe("ANEXO_3");
    expect(result.conflicts[0].existingValue).toBe("Nombre Divergente Registrado B");
    expect(result.conflicts[0].proposedValue).toBe("Nuevo Nombre Oficial C");
    expect(result.propagatedCount).toBe(0);
  });

  // -------------------------------------------------------------
  // ESCENARIO 5: Sobreescritura Manual con Justificación
  // -------------------------------------------------------------
  it("Escenario 5: Manual override with justification - sobreescritura auditada con justificación clínica", async () => {
    instancesMap.set("inst-override", {
      id: "inst-override",
      documentCode: "ANEXO_3",
      status: "EN_DILIGENCIAMIENTO",
      templateVersion: {
        mappingConfig: [{ schemaPath: "donorName", canonicalFieldKey: "donor.identity.full_name" }],
      },
      currentRevision: {
        responseData: { donorName: "Nombre Erróneo" },
      },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Nombre Verificado Por Registraduría",
      sourceKind: "MANUAL",
      actorUserId,
      conflictResolution: {
        strategy: "ACCEPT_CANDIDATE",
        justification: "Verificación documental directa con cédula física y huella dactilar.",
      },
    });

    expect(result.conflicts).toHaveLength(0);
    expect(result.propagatedCount).toBe(1);
    expect(result.propagatedInstances[0].status).toBe("UPDATED");
  });

  // -------------------------------------------------------------
  // ESCENARIO 6: Campo Intacto / Protección de Documentos Cerrados
  // -------------------------------------------------------------
  it("Escenario 6: Intact field - documento firmado o KEEP_CURRENT permanece inmutable", async () => {
    instancesMap.set("inst-signed", {
      id: "inst-signed",
      documentCode: "ANEXO_1",
      status: "FIRMADO", // Documento cerrado y sellado
      templateVersion: {
        mappingConfig: [{ schemaPath: "patientName", canonicalFieldKey: "donor.identity.full_name" }],
      },
      currentRevision: { responseData: { patientName: "Nombre Sellado Inmutable" } },
    });

    const result = await engine.applyAndPropagate({
      processId,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Intento de Sobreescritura",
      sourceKind: "MANUAL",
      actorUserId,
    });

    expect(result.propagatedCount).toBe(0);
    expect(result.propagatedInstances[0].status).toBe("SKIPPED_LOCKED");
    expect(result.conflicts).toHaveLength(0);
  });
});
