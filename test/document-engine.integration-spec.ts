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
    if (donorId) await prisma.donorRecord.delete({ where: { id: donorId } });
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
});
