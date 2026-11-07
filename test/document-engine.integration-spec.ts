import { PrismaClient } from "@prisma/client";
import { PrismaDocumentEngineRepository } from "../src/infrastructure/document-engine/prisma-document-engine.repository";

const enabled = process.env.RUN_INTEGRATION_TESTS === "true";
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration("Document engine persistence", () => {
  const prisma = new PrismaClient();
  let userId: string;
  let donorId: string;
  let templateId: string;
  let versionId: string;
  let instanceId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.systemUser.create({
      data: {
        email: `document-engine-${Date.now()}@example.com`,
        fullName: "Usuario sintético documental",
        role: "ADMIN",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (instanceId) {
      await prisma.documentInstance.update({
        where: { id: instanceId },
        data: { currentRevisionId: null },
      });
      await prisma.documentFieldProvenance.deleteMany({
        where: { responseRevision: { documentInstanceId: instanceId } },
      });
      await prisma.documentResponseRevision.deleteMany({
        where: { documentInstanceId: instanceId },
      });
      await prisma.documentInstance.delete({ where: { id: instanceId } });
    }
    if (versionId)
      await prisma.templateVersion.delete({ where: { id: versionId } });
    if (templateId)
      await prisma.documentTemplate.delete({ where: { id: templateId } });
    if (donorId) {
      await prisma.documentFieldProvenance.deleteMany({
        where: { responseRevision: { documentInstance: { donorId } } },
      });
      await prisma.ocrExtractedField.deleteMany({ where: { donorId } });
      await prisma.ocrProcessingJob.deleteMany({
        where: { sourceDocument: { donorId } },
      });
      await prisma.sourceDocument.deleteMany({ where: { donorId } });
      await prisma.donorRecord.delete({ where: { id: donorId } });
    }
    if (userId) {
      await prisma.auditEvent.deleteMany({ where: { actorUserId: userId } });
      await prisma.systemUser.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it("preserves published versions, revisions and provenance", async () => {
    const donor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-DOC-${Date.now()}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS documental sintética",
        clinicalService: "Servicio sintético",
        fullName: "Donante sintético",
        documentNumber: `DOC-DOC-${Date.now()}`,
        createdById: userId,
      },
    });
    donorId = donor.id;

    const template = await prisma.documentTemplate.create({
      data: {
        templateCode: `synthetic-document-${Date.now()}`,
        name: "Documento sintético",
        category: "TEST",
      },
    });
    templateId = template.id;

    const version = await prisma.templateVersion.create({
      data: {
        templateId,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
          properties: { code: { type: "string" } },
          required: ["code"],
        },
        uiSchema: { sections: [{ id: "main", fields: ["code"] }] },
        mappingConfig: [],
        authorizedById: userId,
        createdById: userId,
        publishedAt: new Date(),
      },
    });
    versionId = version.id;

    const instance = await prisma.documentInstance.create({
      data: {
        donorId,
        templateId,
        templateVersionId: versionId,
        documentCode: template.templateCode,
        createdById: userId,
        updatedById: userId,
      },
    });
    instanceId = instance.id;
    const revision = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: instance.id,
        revisionNumber: 1,
        responseData: { code: "synthetic" },
        createdById: userId,
      },
    });
    await prisma.documentInstance.update({
      where: { id: instance.id },
      data: { currentRevisionId: revision.id },
    });
    const provenance = await prisma.documentFieldProvenance.create({
      data: {
        responseRevisionId: revision.id,
        fieldPath: "code",
        sourceKind: "MANUAL",
        conflictStatus: "NONE",
      },
    });

    const historical = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: instance.id,
        revisionNumber: 2,
        responseData: { code: "synthetic-2" },
        createdById: userId,
      },
    });

    const stored = await prisma.documentInstance.findUnique({
      where: { id: instance.id },
      include: { currentRevision: true, revisions: true },
    });
    expect(stored?.templateVersionId).toBe(versionId);
    expect(stored?.currentRevisionId).toBe(revision.id);
    expect(stored?.revisions).toHaveLength(2);
    expect(provenance.sourceKind).toBe("MANUAL");
    expect((donor.clinicalData as object | null) ?? null).toBeNull();
    expect(historical.responseData).toEqual({ code: "synthetic-2" });
  });

  it("validates the response against the instance template version", async () => {
    const current = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      select: { currentRevisionId: true },
    });
    const invalid = await prisma.documentResponseRevision.update({
      where: { id: current?.currentRevisionId ?? "" },
      data: { responseData: { code: 123, unexpected: true } },
    });
    expect(invalid.responseData).toEqual({ code: 123, unexpected: true });

    const repository = new PrismaDocumentEngineRepository(prisma as never);
    const result = await repository.validateInstance(instanceId, {
      userId,
      isAdmin: true,
      institutionalIps: [],
    });
    expect(result.valid).toBe(false);
    expect((result as { errors: unknown[] }).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "type", path: "$.code" }),
        expect.objectContaining({
          keyword: "additionalProperties",
          path: "$.unexpected",
        }),
      ]),
    );
    const stored = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: { currentRevision: true },
    });
    expect(stored?.status).toBe("DRAFT");
    expect(stored?.currentRevision?.validationSummary).toMatchObject({
      valid: false,
    });
  });

  it("serializes concurrent revisions and preserves the complete history", async () => {
    const repository = new PrismaDocumentEngineRepository(prisma as never);
    const access = {
      userId,
      isAdmin: true,
      institutionalIps: [],
    };
    await Promise.all([
      repository.saveRevision({
        instanceId,
        actorUserId: userId,
        access,
        responseData: { code: "concurrent-a" },
        sourceProvenance: [],
        correlationId: `concurrent-a-${Date.now()}`,
      }),
      repository.saveRevision({
        instanceId,
        actorUserId: userId,
        access,
        responseData: { code: "concurrent-b" },
        sourceProvenance: [],
        correlationId: `concurrent-b-${Date.now()}`,
      }),
    ]);

    const stored = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: { currentRevision: true, revisions: true },
    });
    const revisionNumbers = stored?.revisions
      .map((revision) => revision.revisionNumber)
      .sort((left, right) => left - right);
    expect(revisionNumbers).toEqual([1, 2, 3, 4]);
    expect(stored?.currentRevision?.documentInstanceId).toBe(instanceId);
    expect([3, 4]).toContain(stored?.currentRevision?.revisionNumber);
  });

  it("Caso 1 regression: preserves existing provenance when saving revision without sourceProvenance", async () => {
    const repository = new PrismaDocumentEngineRepository(prisma as never);
    const access = {
      userId,
      isAdmin: true,
      institutionalIps: [],
    };

    // Step 1: Save a revision WITH provenance and canonicalFieldKey
    await repository.saveRevision({
      instanceId,
      actorUserId: userId,
      access,
      responseData: { code: "with-provenance" },
      sourceProvenance: [
        {
          fieldPath: "code",
          sourceKind: "MANUAL",
          canonicalFieldKey: "donor.code",
        },
      ],
      correlationId: `caso1-with-prov-${Date.now()}`,
    });

    const midStored = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: {
        currentRevision: {
          include: { provenance: true },
        },
      },
    });
    expect(midStored?.currentRevision?.provenance.length).toBe(1);
    expect(midStored?.currentRevision?.provenance[0].canonicalFieldKey).toBe(
      "donor.code",
    );

    // Step 2: Save subsequent revision WITHOUT sourceProvenance payload (omitted)
    await repository.saveRevision({
      instanceId,
      actorUserId: userId,
      access,
      responseData: { code: "inherited-provenance" },
      correlationId: `caso1-inherit-${Date.now()}`,
    });

    const stored = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: {
        currentRevision: {
          include: { provenance: true },
        },
      },
    });

    expect(stored?.currentRevision?.provenance.length).toBe(1);
    expect(stored?.currentRevision?.provenance[0].fieldPath).toBe("code");
    expect(stored?.currentRevision?.provenance[0].sourceKind).toBe("MANUAL");
    expect(stored?.currentRevision?.provenance[0].canonicalFieldKey).toBe(
      "donor.code",
    );
  });

  it("Caso 4 regression: listTemplates returns official templates with published versions, without duplicates or PENDING_HOMOLOGATION", async () => {
    const { seedOfficialTemplates } = await import(
      "../src/application/document-engine/official-template-definitions"
    );

    // Seeding is idempotent
    const count1 = await seedOfficialTemplates(prisma as never, userId);
    const count2 = await seedOfficialTemplates(prisma as never, userId);
    expect(count1).toBe(19);
    expect(count2).toBe(19);

    const repository = new PrismaDocumentEngineRepository(prisma as never);
    const access = {
      userId,
      isAdmin: false,
      institutionalIps: ["Hospital Universitario del Valle"],
    };

    const templates = (await repository.listTemplates(access)) as Array<{
      templateCode: string;
      name: string;
      category: string;
      versions: Array<{ id: string; status: string }>;
    }>;

    expect(templates.length).toBeGreaterThanOrEqual(19);

    for (const t of templates) {
      // Must have at least 1 published version visible to non-admin
      expect(t.versions.length).toBeGreaterThan(0);
      expect(t.versions[0].status).toBe("PUBLISHED");

      // No duplicated test suffixes
      expect(t.templateCode).not.toMatch(/^TPL-/);
      expect(t.templateCode).not.toMatch(/-\d{4}$/);

      // Positions 20 to 23 must NOT exist in the executable template catalog
      expect(t.category).not.toBe("PENDING_HOMOLOGATION");
      expect(t.templateCode).not.toMatch(/POS_NORMATIVA_/i);
    }
  });

  it("Auditoría G.1.2 — Escenario obligatorio de procedencia: modificación manual nunca conserva OCR_CONFIRMED y campos no modificados conservan procedencia original", async () => {
    const repository = new PrismaDocumentEngineRepository(prisma as never);
    const access = {
      userId,
      isAdmin: true,
      institutionalIps: [],
    };

    // 1. Crear documento fuente, trabajo OCR y campos OCR confirmados para el donante
    const testDoc = await prisma.sourceDocument.create({
      data: {
        donorId,
        uploadedById: userId,
        originalFilename: "historia_clinica_test.pdf",
        mimeType: "application/pdf",
        documentCategory: "CLINICAL_RECORD",
        objectStorageKey: `test/${Date.now()}/hc.pdf`,
        sha256Hash: `${Date.now()}`.padEnd(64, "a"),
        status: "PROCESSED",
      },
    });

    const job = await prisma.ocrProcessingJob.create({
      data: {
        sourceDocumentId: testDoc.id,
        requestedById: userId,
        providerName: "LOCAL_TESSERACT",
        status: "COMPLETADO",
        correlationId: `corr-job-${Date.now()}`,
      },
    });

    const ocrField1 = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: job.id,
        sourceDocumentId: testDoc.id,
        donorId,
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: "O+",
        confirmedValue: "O+",
        confidenceScore: 0.98,
        validationStatus: "CONFIRMADO",
        validatedById: userId,
        validatedAt: new Date(),
      },
    });

    const ocrField2 = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: job.id,
        sourceDocumentId: testDoc.id,
        donorId,
        canonicalFieldKey: "donor.clinical.rh_factor",
        candidateValue: "POSITIVO",
        confirmedValue: "POSITIVO",
        confidenceScore: 0.99,
        validationStatus: "CONFIRMADO",
        validatedById: userId,
        validatedAt: new Date(),
      },
    });

    // 2. Guardar revisión inicial con ambos campos como OCR_CONFIRMED
    await repository.saveRevision({
      instanceId,
      actorUserId: userId,
      access,
      responseData: {
        bloodGroup: "O+",
        rhFactor: "POSITIVO",
        notes: "Dato local sin procedencia externa",
      },
      sourceProvenance: [
        {
          fieldPath: "bloodGroup",
          canonicalFieldKey: "donor.clinical.blood_group",
          sourceKind: "OCR_CONFIRMED",
          sourceDocumentId: testDoc.id,
          ocrFieldId: ocrField1.id,
          sourceValue: "O+",
        },
        {
          fieldPath: "rhFactor",
          canonicalFieldKey: "donor.clinical.rh_factor",
          sourceKind: "OCR_CONFIRMED",
          sourceDocumentId: testDoc.id,
          ocrFieldId: ocrField2.id,
          sourceValue: "POSITIVO",
        },
      ],
      correlationId: `audit-ocr-init-${Date.now()}`,
    });

    // 3. Crear nueva revisión modificando manualmente 'bloodGroup' de 'O+' a 'A+',
    // dejando 'rhFactor' intacto ('POSITIVO') y guardando SIN enviar sourceProvenance
    await repository.saveRevision({
      instanceId,
      actorUserId: userId,
      access,
      responseData: {
        bloodGroup: "A+", // Modificado manualmente por el operador
        rhFactor: "POSITIVO", // Sin modificaciones
        notes: "Dato local modificado",
      },
      correlationId: `audit-ocr-manual-edit-${Date.now()}`,
    });

    // 4. Recuperar la nueva revisión y verificar procedencia resultante
    const instance = await prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: {
        currentRevision: {
          include: { provenance: true },
        },
      },
    });

    const currentProv = instance?.currentRevision?.provenance || [];
    const bloodGroupProv = currentProv.find((p) => p.fieldPath === "bloodGroup");
    const rhFactorProv = currentProv.find((p) => p.fieldPath === "rhFactor");

    // Verificación de campo modificado manualmente:
    expect(bloodGroupProv).toBeDefined();
    expect(bloodGroupProv?.sourceKind).toBe("MANUAL"); // NUNCA debe ser OCR_CONFIRMED
    expect(bloodGroupProv?.ocrFieldId).toBeNull();
    expect(bloodGroupProv?.sourceDocumentId).toBeNull();
    expect(bloodGroupProv?.sourceValue).toBe("A+");
    expect(bloodGroupProv?.canonicalFieldKey).toBe("donor.clinical.blood_group"); // Mantiene key canónico

    // Verificación de campo sin modificaciones:
    expect(rhFactorProv).toBeDefined();
    expect(rhFactorProv?.sourceKind).toBe("OCR_CONFIRMED"); // Conserva la procedencia de OCR
    expect(rhFactorProv?.ocrFieldId).toBe(ocrField2.id);
    expect(rhFactorProv?.sourceDocumentId).toBe(testDoc.id);
    expect(rhFactorProv?.sourceValue).toBe("POSITIVO");

    // Limpieza
    await prisma.documentFieldProvenance.deleteMany({
      where: {
        OR: [
          { ocrFieldId: { in: [ocrField1.id, ocrField2.id] } },
          { sourceDocumentId: testDoc.id },
        ],
      },
    });
    await prisma.ocrExtractedField.deleteMany({
      where: { id: { in: [ocrField1.id, ocrField2.id] } },
    });
    await prisma.ocrProcessingJob.deleteMany({
      where: { id: job.id },
    });
    await prisma.sourceDocument.deleteMany({
      where: { id: testDoc.id },
    });
  });
});
