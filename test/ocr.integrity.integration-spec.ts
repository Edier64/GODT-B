import { PrismaClient } from "@prisma/client";
import { PrismaOcrRepository } from "../src/infrastructure/ocr/prisma-ocr.repository";

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" ? describe : describe.skip;

describeIntegration("Sprint 2 OCR integrity", () => {
  const prisma = new PrismaClient();
  let userId: string;
  let secondUserId: string;
  let donorId: string;
  let documentId: string;
  let jobId: string;
  const fieldIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now();
    const user = await prisma.systemUser.create({
      data: {
        email: `ocr-${suffix}@example.com`,
        fullName: "OCR Integration",
        role: "COORDINATOR",
      },
    });
    const secondUser = await prisma.systemUser.create({
      data: {
        email: `ocr-second-${suffix}@example.com`,
        fullName: "OCR Second Validator",
        role: "COORDINATOR",
      },
    });
    userId = user.id;
    secondUserId = secondUser.id;
    const donor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-OCR-${suffix}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS-OCR",
        clinicalService: "UCI",
        fullName: "Synthetic OCR donor",
        documentNumber: `DOC-OCR-${suffix}`,
        createdById: userId,
      },
    });
    donorId = donor.id;
    const document = await prisma.sourceDocument.create({
      data: {
        donorId,
        uploadedById: userId,
        originalFilename: "synthetic.pdf",
        mimeType: "application/pdf",
        documentCategory: "SYNTHETIC",
        objectStorageKey: `synthetic-${suffix}.pdf`,
        sha256Hash: suffix.toString().padStart(64, "0"),
        status: "RECIBIDO",
      },
    });
    documentId = document.id;
    const job = await prisma.ocrProcessingJob.create({
      data: {
        sourceDocumentId: documentId,
        requestedById: userId,
        providerName: "test",
        status: "COMPLETADO",
        correlationId: `ocr-${suffix}`,
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: { in: [userId, secondUserId] } },
    });
    await prisma.ocrExtractedField.deleteMany({
      where: { id: { in: fieldIds } },
    });
    await prisma.ocrProcessingJob.deleteMany({ where: { id: jobId } });
    await prisma.sourceDocument.deleteMany({ where: { id: documentId } });
    await prisma.donorRecord.deleteMany({ where: { id: donorId } });
    await prisma.systemUser.deleteMany({
      where: { id: { in: [userId, secondUserId] } },
    });
    await prisma.$disconnect();
  });

  it("does not propagate PENDING and propagates CONFIRMED", async () => {
    const repository = new PrismaOcrRepository(prisma as never);
    const pending = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: jobId,
        sourceDocumentId: documentId,
        donorId,
        canonicalFieldKey: "bloodGroup",
        candidateValue: "O",
        confidenceScore: 0.9,
        validationStatus: "PENDIENTE",
      },
    });
    fieldIds.push(pending.id);
    await expect(repository.propagateField(pending.id, userId)).rejects.toThrow(
      "Only confirmed or modified",
    );
    expect(
      (await prisma.donorRecord.findUnique({ where: { id: donorId } }))
        ?.clinicalData,
    ).toBeNull();

    await repository.validateField(pending.id, {
      status: "CONFIRMADO",
      userId,
    });
    await repository.propagateField(pending.id, userId);
    expect(
      (await prisma.donorRecord.findUnique({ where: { id: donorId } }))
        ?.clinicalData,
    ).toEqual({ bloodGroup: "O" });
  });

  it("propagates MODIFIED while preserving the OCR candidate", async () => {
    const repository = new PrismaOcrRepository(prisma as never);
    const field = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: jobId,
        sourceDocumentId: documentId,
        donorId,
        canonicalFieldKey: "rhFactor",
        candidateValue: "positive",
        confidenceScore: 0.8,
        validationStatus: "PENDIENTE",
      },
    });
    fieldIds.push(field.id);
    await repository.validateField(field.id, {
      status: "MODIFICADO",
      confirmedValue: "negative",
      userId,
    });
    await repository.propagateField(field.id, userId);
    const saved = await prisma.ocrExtractedField.findUnique({
      where: { id: field.id },
    });
    expect(saved?.candidateValue).toBe("positive");
    expect(saved?.confirmedValue).toBe("negative");
    expect(
      (await prisma.donorRecord.findUnique({ where: { id: donorId } }))
        ?.clinicalData,
    ).toEqual({ bloodGroup: "O", rhFactor: "negative" });
  });

  it("allows only one concurrent validation of a pending field", async () => {
    const repository = new PrismaOcrRepository(prisma as never);
    const field = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId: jobId,
        sourceDocumentId: documentId,
        donorId,
        canonicalFieldKey: "clinicalService",
        candidateValue: "UCI",
        confidenceScore: 0.7,
        validationStatus: "PENDIENTE",
      },
    });
    fieldIds.push(field.id);
    const results = await Promise.allSettled([
      repository.validateField(field.id, {
        status: "CONFIRMADO",
        userId,
      }),
      repository.validateField(field.id, {
        status: "RECHAZADO",
        userId: secondUserId,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });
});
