import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { PrismaCanonicalDictionaryRepository } from "../src/infrastructure/canonical/prisma-canonical-dictionary.repository";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { ApplyCanonicalValueUseCase } from "../src/application/canonical/apply-canonical-value.use-case";
import { ResolveCanonicalConflictUseCase } from "../src/application/canonical/resolve-canonical-conflict.use-case";
import { GetProcessCanonicalValuesUseCase } from "../src/application/canonical/get-process-canonical-values.use-case";
import { PrismaDonationProcessRepository } from "../src/infrastructure/processes/prisma-donation-process.repository";
import { PrismaProcessPackageRepository } from "../src/infrastructure/packages/prisma-process-package.repository";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";
import { HOMOLOGATED_CANONICAL_FIELDS } from "../src/domain/canonical/canonical-dictionary";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";

describe("PostgreSQL Real Integration — Fase C.1 Hardening", () => {
  let prisma: PrismaService;
  let repo: PrismaCanonicalDictionaryRepository;
  let processRepo: PrismaDonationProcessRepository;
  let packageRepo: PrismaProcessPackageRepository;
  let engine: CanonicalPropagationEngine;
  let applyUseCase: ApplyCanonicalValueUseCase;
  let resolveUseCase: ResolveCanonicalConflictUseCase;
  let getValuesUseCase: GetProcessCanonicalValuesUseCase;

  const runId = `test-${Date.now()}`;
  let testUser: any;
  let testDonor: any;
  let testPackage: any;
  let testPackageVersion: any;
  let testProcess: any;

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

    repo = new PrismaCanonicalDictionaryRepository(prisma);
    processRepo = new PrismaDonationProcessRepository(prisma);
    packageRepo = new PrismaProcessPackageRepository(prisma);
    engine = new CanonicalPropagationEngine(repo, prisma, mockAuditPort);
    applyUseCase = new ApplyCanonicalValueUseCase(engine, prisma);
    resolveUseCase = new ResolveCanonicalConflictUseCase(
      repo,
      processRepo,
      engine,
      mockAuditPort,
      prisma,
    );
    getValuesUseCase = new GetProcessCanonicalValuesUseCase(repo, processRepo);

    // Sembrar catálogo maestro en DB si no existe
    await repo.seedDefaultCatalog();

    // Crear Usuario de Prueba
    testUser = await prisma.systemUser.create({
      data: {
        email: `${runId}@godt.gov.co`,
        fullName: "Coordinador Pruebas Integración",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authUser.userId = testUser.id;

    // Crear Donante de Prueba
    testDonor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-${runId}`,
        documentNumber: `110022${Date.now().toString().slice(-4)}`,
        fullName: "Donante Integración Real",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: testUser.id,
      },
    });

    // Crear o recuperar Paquete y Versión de 23 posiciones
    let pkg = await prisma.processPackage.findFirst({
      where: { code: "PKG-REGIONAL-3" },
    });
    if (!pkg) {
      testPackage = await prisma.processPackage.create({
        data: {
          code: `PKG-${runId}`,
          name: "Paquete Donación Integración",
          createdById: testUser.id,
        },
      });
      pkg = testPackage;
    }

    testPackageVersion = await prisma.processPackageVersion.create({
      data: {
        packageId: pkg!.id,
        versionNumber: `v-${runId}`,
        status: "PUBLISHED",
        positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as any,
        createdById: testUser.id,
      },
    });
  });

  afterAll(async () => {
    // Limpieza de datos creados en PostgreSQL real
    try {
      if (testProcess?.id) {
        await prisma.processCanonicalHistory.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processCanonicalValue.deleteMany({ where: { processId: testProcess.id } });
        await prisma.documentInstance.updateMany({
          where: { processId: testProcess.id },
          data: { currentRevisionId: null },
        });
        await prisma.documentFieldProvenance.deleteMany({
          where: { responseRevision: { documentInstance: { processId: testProcess.id } } },
        });
        await prisma.documentResponseRevision.deleteMany({
          where: { documentInstance: { processId: testProcess.id } },
        });
        await prisma.documentInstance.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processDocument.deleteMany({ where: { processId: testProcess.id } });
        await prisma.donationProcess.delete({ where: { id: testProcess.id } });
      }
      if (testPackageVersion?.id) {
        await prisma.processPackageVersion.delete({ where: { id: testPackageVersion.id } });
      }
      if (testPackage?.id) {
        await prisma.processPackage.delete({ where: { id: testPackage.id } });
      }
      if (testDonor?.id) {
        await prisma.donorRecord.delete({ where: { id: testDonor.id } });
      }
      if (testUser?.id) {
        await prisma.systemUser.delete({ where: { id: testUser.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // 1. Creación de proceso y su paquete documental de 23 posiciones
  it("Escenario 1: Creación de un proceso y su paquete documental de 23 posiciones en PostgreSQL", async () => {
    testProcess = await prisma.donationProcess.create({
      data: {
        processCode: `PROC-${runId}`,
        donorId: testDonor.id,
        primaryIpsName: "Hospital Universitario del Valle",
        status: "EN_CURSO",
        openedById: testUser.id,
        packageVersionId: testPackageVersion.id,
      },
    });

    // Crear las 23 posiciones documentales en DB real
    for (const pos of OFFICIAL_REGIONAL_3_POSITIONS) {
      await prisma.processDocument.create({
        data: {
          processId: testProcess.id,
          positionNumber: pos.positionNumber,
          documentCode: pos.documentCode,
          title: pos.title,
          category: pos.category,
          status: "PENDIENTE",
          applicabilityStatus: pos.defaultApplicability,
          isMandatory: pos.isMandatory,
          orderIndex: pos.orderIndex,
          rules: pos.rules as any,
        },
      });
    }

    const docsInDb = await prisma.processDocument.findMany({
      where: { processId: testProcess.id },
      orderBy: { positionNumber: "asc" },
    });

    expect(docsInDb).toHaveLength(23);
    expect(docsInDb[0].documentCode).toBe("ANEXO_1");
    expect(docsInDb[22].positionNumber).toBe(23);
  });

  // 2. Creación de valores canónicos en base de datos real
  it("Escenario 2: Creación y persistencia de valores canónicos en PostgreSQL", async () => {
    const val = await repo.upsertProcessValue({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "A",
      sourceKind: "MANUAL",
      actorUserId: testUser.id,
    });

    expect(val.canonicalFieldKey).toBe("donor.clinical.blood_group");
    expect(val.currentValue).toBe("A");
    expect(val.versionNumber).toBe(1);

    // Consulta física directa a la tabla PROCESS_CANONICAL_VALUE
    const dbValue = await prisma.processCanonicalValue.findUnique({
      where: {
        processId_canonicalFieldKey: {
          processId: testProcess.id,
          canonicalFieldKey: "donor.clinical.blood_group",
        },
      },
    });
    expect(dbValue).not.toBeNull();
    expect(dbValue?.currentValue).toBe("A");
  });

  // 3. Persistencia de historial inmutable
  it("Escenario 3: Persistencia de historial inmutable de auditoría en PostgreSQL", async () => {
    const hist = await repo.addHistoryEntry({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "A",
      sourceKind: "MANUAL",
      versionNumber: 1,
      actorUserId: testUser.id,
    });

    expect(hist.id).toBeDefined();

    // Consulta física directa a la tabla PROCESS_CANONICAL_HISTORY
    const dbHistory = await prisma.processCanonicalHistory.findMany({
      where: {
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.blood_group",
      },
    });
    expect(dbHistory).toHaveLength(1);
    expect(dbHistory[0].value).toBe("A");
    expect(dbHistory[0].createdById).toBe(testUser.id);
  });

  // 4. Inserción de mediciones repetibles con contexto clínico
  it("Escenario 4: Inserción de mediciones seriadas repetibles (arterial_ph) conservando contexto", async () => {
    const now = new Date();
    const d1 = new Date(now.getTime() - 7200000);
    const d2 = new Date(now.getTime() - 3600000);
    const d3 = now;

    await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.arterial_ph",
      value: 7.31,
      sampleContext: "Gasometría Basal UCI Ingreso",
      effectiveAt: d1,
      user: authUser,
    });

    await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.arterial_ph",
      value: 7.38,
      sampleContext: "Control Post Corrección Bicarbonato",
      effectiveAt: d2,
      user: authUser,
    });

    await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.arterial_ph",
      value: 7.42,
      sampleContext: "Pre Quirófano Traslado",
      effectiveAt: d3,
      user: authUser,
    });

    // Consultar observaciones seriadas en DB real
    const observations = await repo.listObservations(
      testProcess.id,
      "donor.clinical.arterial_ph",
    );
    expect(observations).toHaveLength(3);
    // Ordenadas por fecha descendente
    expect(observations[0].value).toBe(7.42);
    expect(observations[0].sampleContext).toBe("Pre Quirófano Traslado");
    expect(observations[2].value).toBe(7.31);
    expect(observations[2].sampleContext).toBe("Gasometría Basal UCI Ingreso");
  });

  // 5. Precarga de un documento futuro respetando reglas explícitas de REPEATABLE
  it("Escenario 5: Precarga de valores en plantilla futura sin selección silenciosa de REPEATABLE", async () => {
    // Crear una plantilla y versión con mapeos mixtos
    const template = await prisma.documentTemplate.create({
      data: {
        templateCode: `TPL-${runId}`,
        name: "Plantilla Prueba Precarga",
        category: "CLINICAL",
        status: "ACTIVE",
      },
    });

    const tplVersion = await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: {
          type: "object",
          properties: {
            donor: {
              type: "object",
              properties: {
                bloodGroup: { type: "string" },
                baselinePh: { type: "number" },
                unspecifiedPh: { type: "number" },
              },
            },
          },
        },
        uiSchema: {},
        mappingConfig: [
          {
            canonicalFieldKey: "donor.clinical.blood_group",
            schemaPath: "donor.bloodGroup",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            canonicalFieldKey: "donor.clinical.arterial_ph",
            schemaPath: "donor.baselinePh",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "number",
            cardinality: "REPEATABLE",
            repeatableSelectionStrategy: "SAMPLE_CONTEXT_MATCH",
            sampleContextFilter: "Gasometría Basal UCI Ingreso",
          },
          {
            canonicalFieldKey: "donor.clinical.arterial_ph",
            schemaPath: "donor.unspecifiedPh",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "number",
            cardinality: "REPEATABLE",
            repeatableSelectionStrategy: "MANUAL_SELECTION",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    const preloaded = await engine.preloadCanonicalValues(testProcess.id, tplVersion.id);

    // 1. Campo SINGLE (bloodGroup) se precargó con "A"
    expect((preloaded.responseData.donor as any).bloodGroup).toBe("A");

    // 2. Campo REPEATABLE con SAMPLE_CONTEXT_MATCH se precargó con el pH basal (7.31)
    expect((preloaded.responseData.donor as any).baselinePh).toBe(7.31);

    // 3. Campo REPEATABLE con MANUAL_SELECTION NO se precargó con la última medición silenciosamente
    expect((preloaded.responseData.donor as any).unspecifiedPh).toBeUndefined();

    // Limpieza de plantilla temporal
    await prisma.templateVersion.delete({ where: { id: tplVersion.id } });
    await prisma.documentTemplate.delete({ where: { id: template.id } });
  });

  // 6. Actualización de documentos abiertos compatibles
  it("Escenario 6: Actualización y propagación a documentos abiertos compatibles en PostgreSQL", async () => {
    // Crear template de prueba
    const tpl = await prisma.documentTemplate.create({
      data: {
        templateCode: `TPL-SYNC-${runId}`,
        name: "Plantilla Sincronización",
        category: "CLINICAL",
        status: "ACTIVE",
      },
    });

    const tplVer = await prisma.templateVersion.create({
      data: {
        templateId: tpl.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: {
          type: "object",
          properties: {
            datosClinicos: {
              type: "object",
              properties: { grupoSanguineo: { type: "string" } },
            },
          },
        },
        uiSchema: {},
        mappingConfig: [
          {
            canonicalFieldKey: "donor.clinical.blood_group",
            schemaPath: "datosClinicos.grupoSanguineo",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    // Crear instancia abierta en PostgreSQL
    const inst = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        templateId: tpl.id,
        templateVersionId: tplVer.id,
        documentCode: "ANEXO_TEST",
        status: "EN_DILIGENCIAMIENTO",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const rev1 = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: inst.id,
        revisionNumber: 1,
        responseData: { datosClinicos: { grupoSanguineo: "A" } },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: inst.id },
      data: { currentRevisionId: rev1.id },
    });

    // Actualizar marcador canónico en el proceso a "B"
    const propRes = await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "B",
      user: authUser,
    });

    expect(propRes.propagatedCount).toBeGreaterThanOrEqual(1);

    // Verificar en DB real que la instancia recibió revisión 2 con "B"
    const updatedInst = await prisma.documentInstance.findUnique({
      where: { id: inst.id },
      include: { currentRevision: true },
    });

    expect(updatedInst?.currentRevision?.revisionNumber).toBe(2);
    expect((updatedInst?.currentRevision?.responseData as any).datosClinicos.grupoSanguineo).toBe("B");

    // Verificar procedencia persistida en PostgreSQL
    const prov = await prisma.documentFieldProvenance.findFirst({
      where: {
        responseRevisionId: updatedInst!.currentRevisionId!,
        canonicalFieldKey: "donor.clinical.blood_group",
      },
    });
    expect(prov).not.toBeNull();
    expect(prov?.sourceKind).toBe("PROCESS_CANONICAL");

    // Limpieza
    await prisma.documentInstance.update({
      where: { id: inst.id },
      data: { currentRevisionId: null },
    });
    await prisma.documentFieldProvenance.deleteMany({
      where: { responseRevision: { documentInstanceId: inst.id } },
    });
    await prisma.documentResponseRevision.deleteMany({ where: { documentInstanceId: inst.id } });
    await prisma.documentInstance.delete({ where: { id: inst.id } });
    await prisma.templateVersion.delete({ where: { id: tplVer.id } });
    await prisma.documentTemplate.delete({ where: { id: tpl.id } });
  });

  // 7. Protección de documentos completados y firmados
  it("Escenario 7: Protección de documentos en estado COMPLETADO o FIRMADO en PostgreSQL", async () => {
    const tpl = await prisma.documentTemplate.create({
      data: {
        templateCode: `TPL-SEALED-${runId}`,
        name: "Plantilla Sellada",
        category: "LEGAL",
        status: "ACTIVE",
      },
    });

    const tplVer = await prisma.templateVersion.create({
      data: {
        templateId: tpl.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: { type: "object", properties: { rh: { type: "string" } } },
        uiSchema: {},
        mappingConfig: [
          {
            canonicalFieldKey: "donor.clinical.rh_factor",
            schemaPath: "rh",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    const sealedInst = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        templateId: tpl.id,
        templateVersionId: tplVer.id,
        documentCode: "ANEXO_SEALED",
        status: "FIRMADO",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const revSealed = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: sealedInst.id,
        revisionNumber: 1,
        responseData: { rh: "POSITIVO" },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: sealedInst.id },
      data: { currentRevisionId: revSealed.id },
    });

    // Intentar propagar cambio a NEGATIVO
    const result = await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.rh_factor",
      value: "NEGATIVO",
      user: authUser,
    });

    // La instancia sellada debe figurar como SKIPPED_LOCKED
    const skipped = result.propagatedInstances.find((p) => p.instanceId === sealedInst.id);
    expect(skipped?.status).toBe("SKIPPED_LOCKED");

    // Verificar en DB real que la instancia firmada permaneció intacta en revisión 1 con "POSITIVO"
    const dbInst = await prisma.documentInstance.findUnique({
      where: { id: sealedInst.id },
      include: { currentRevision: true },
    });
    expect(dbInst?.status).toBe("FIRMADO");
    expect(dbInst?.currentRevision?.revisionNumber).toBe(1);
    expect((dbInst?.currentRevision?.responseData as any).rh).toBe("POSITIVO");

    // Limpieza
    await prisma.documentInstance.update({
      where: { id: sealedInst.id },
      data: { currentRevisionId: null },
    });
    await prisma.documentFieldProvenance.deleteMany({
      where: { responseRevision: { documentInstanceId: sealedInst.id } },
    });
    await prisma.documentResponseRevision.deleteMany({ where: { documentInstanceId: sealedInst.id } });
    await prisma.documentInstance.delete({ where: { id: sealedInst.id } });
    await prisma.templateVersion.delete({ where: { id: tplVer.id } });
    await prisma.documentTemplate.delete({ where: { id: tpl.id } });
  });

  // 8. Detección y resolución de conflictos con auditoría completa
  it("Escenario 8: Detección y resolución formal de divergencias documentales en PostgreSQL", async () => {
    const tpl = await prisma.documentTemplate.create({
      data: {
        templateCode: `TPL-CONF-${runId}`,
        name: "Plantilla Conflicto",
        category: "CLINICAL",
        status: "ACTIVE",
      },
    });

    const tplVer = await prisma.templateVersion.create({
      data: {
        templateId: tpl.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: { type: "object", properties: { nombreDonante: { type: "string" } } },
        uiSchema: {},
        mappingConfig: [
          {
            canonicalFieldKey: "donor.identity.full_name",
            schemaPath: "nombreDonante",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    // Instancia que tiene un valor local divergente
    const instDivergent = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        templateId: tpl.id,
        templateVersionId: tplVer.id,
        documentCode: "ANEXO_DIVERGENT",
        status: "EN_DILIGENCIAMIENTO",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const revDiv = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: instDivergent.id,
        revisionNumber: 1,
        responseData: { nombreDonante: "Juan Divergente" },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: instDivergent.id },
      data: { currentRevisionId: revDiv.id },
    });

    // Propagar un nuevo nombre desde otra fuente
    const propRes = await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Juan Carlos Oficial",
      user: authUser,
    });

    // Conflicto detectado en DB real
    expect(propRes.conflicts).toHaveLength(1);
    expect(propRes.conflicts[0].existingValue).toBe("Juan Divergente");

    const dbVal = await repo.findProcessValueByKey(testProcess.id, "donor.identity.full_name");
    expect(dbVal?.conflictStatus).toBe("CONFLICT_DETECTED");

    // Resolver conflicto con justificación obligatoria
    const resolved = await resolveUseCase.execute({
      processId: testProcess.id,
      canonicalFieldKey: "donor.identity.full_name",
      strategy: "ACCEPT_CANDIDATE",
      justification: "Verificado contra documento de identidad y registro civil de defunción",
      user: authUser,
    });

    expect(resolved.conflictStatus).toBe("RESOLVED");

    // Comprobar que se registró el evento de auditoría en memoria
    const auditRes = auditEventsRecorded.find((e) => e.action === "CANONICAL_CONFLICT_RESOLVED");
    expect(auditRes).toBeDefined();
    expect(auditRes.metadata.justification).toBe(
      "Verificado contra documento de identidad y registro civil de defunción",
    );

    // Limpieza
    await prisma.documentInstance.update({
      where: { id: instDivergent.id },
      data: { currentRevisionId: null },
    });
    await prisma.documentFieldProvenance.deleteMany({
      where: { responseRevision: { documentInstanceId: instDivergent.id } },
    });
    await prisma.documentResponseRevision.deleteMany({
      where: { documentInstanceId: instDivergent.id },
    });
    await prisma.documentInstance.delete({ where: { id: instDivergent.id } });
    await prisma.templateVersion.delete({ where: { id: tplVer.id } });
    await prisma.documentTemplate.delete({ where: { id: tpl.id } });
  });

  // 9. Integridad y sincronización de datos DONOR
  it("Escenario 9: Sincronización atómica entre marcador DONOR y DonorRecord en PostgreSQL", async () => {
    await applyUseCase.executeDirect({
      processId: testProcess.id,
      canonicalFieldKey: "donor.identity.full_name",
      value: "Donante Sincronizado Verificado",
      user: authUser,
    });

    // Consultar tabla DONOR_RECORD en PostgreSQL directamente
    const donorInDb = await prisma.donorRecord.findUnique({
      where: { id: testDonor.id },
    });

    expect(donorInDb?.fullName).toBe("Donante Sincronizado Verificado");
  });

  // 10. Rollback ante errores transaccionales
  it("Escenario 10: Integridad transaccional y rollback ante fallo en PostgreSQL", async () => {
    const invalidProcessId = "00000000-0000-0000-0000-000000000099";

    // Intentar upsert con clave foránea inexistente
    await expect(
      repo.upsertProcessValue({
        processId: invalidProcessId,
        canonicalFieldKey: "donor.clinical.blood_group",
        value: "O",
        sourceKind: "MANUAL",
        actorUserId: testUser.id,
      }),
    ).rejects.toThrow();

    // Confirmar que no se creó registro huérfano en PROCESS_CANONICAL_VALUE
    const orphan = await prisma.processCanonicalValue.findFirst({
      where: { processId: invalidProcessId },
    });
    expect(orphan).toBeNull();
  });

  // 11. Concurrencia optimista entre dos actualizaciones simultáneas
  it("Escenario 11: Detección de colisión concurrente con expectedVersion en PostgreSQL", async () => {
    const current = await repo.findProcessValueByKey(testProcess.id, "donor.clinical.blood_group");
    const currentVer = current?.versionNumber || 1;

    // Actualización A incrementa versión a currentVer + 1
    await repo.upsertProcessValue({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "AB",
      sourceKind: "MANUAL",
      actorUserId: testUser.id,
    });

    // Actualización B concurrente intenta guardar asumiendo la versión vieja currentVer
    await expect(
      repo.upsertProcessValue({
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.blood_group",
        value: "O",
        sourceKind: "MANUAL",
        expectedVersion: currentVer, // versión desactualizada
        actorUserId: testUser.id,
      }),
    ).rejects.toThrow(/concurrencia/);
  });

  // 12. Idempotencia ante operaciones repetidas
  it("Escenario 12: Idempotencia ante reintentos de red idénticos en PostgreSQL", async () => {
    const beforeCount = await prisma.processCanonicalHistory.count({
      where: {
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.blood_group",
      },
    });

    const testRevUuid = "00000000-0000-0000-0000-000000000123";

    // Envío 1
    const res1 = await repo.upsertProcessValue({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "AB",
      sourceKind: "MANUAL",
      sourceRevisionId: testRevUuid,
      actorUserId: testUser.id,
    });

    // Envío 2 idéntico (reintento)
    const res2 = await repo.upsertProcessValue({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "AB",
      sourceKind: "MANUAL",
      sourceRevisionId: testRevUuid,
      actorUserId: testUser.id,
    });

    // Ambas respuestas devuelven la misma versión sin duplicar
    expect(res1.versionNumber).toBe(res2.versionNumber);
    expect(res1.id).toBe(res2.id);
  });
});
