import { PrismaClient } from "@prisma/client";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("Prisma data model", () => {
  const prisma = new PrismaClient();
  let userId: string;
  let secondUserId: string;
  let donorId: string;
  let legalizationId: string;
  let sourceDocumentId: string;
  let ocrJobId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.systemUser.create({
      data: {
        email: `integration-${Date.now()}@example.com`,
        fullName: "Usuario sintético integración",
        role: "ADMIN",
      },
    });
    const secondUser = await prisma.systemUser.create({
      data: {
        email: `integration-second-${Date.now()}@example.com`,
        fullName: "Segundo usuario sintético",
        role: "COORDINATOR",
      },
    });
    userId = user.id;
    secondUserId = secondUser.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.ocrExtractedField.deleteMany({ where: { donorId } });
      await prisma.ocrProcessingJob.deleteMany({ where: { id: ocrJobId } });
      await prisma.sourceDocument.deleteMany({
        where: { id: sourceDocumentId },
      });
      await prisma.donationRepresentative.deleteMany({
        where: { legalizationId },
      });
      await prisma.donationLegalization.deleteMany({
        where: { id: legalizationId },
      });
      await prisma.brainDeathCertification.deleteMany({ where: { donorId } });
      await prisma.donorRecord.deleteMany({ where: { id: donorId } });
      await prisma.systemUser.deleteMany({
        where: { id: { in: [userId, secondUserId] } },
      });
    }
    await prisma.$disconnect();
  });

  it("enforces donor uniqueness and OCR traceability", async () => {
    const donor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-INTEGRATION-${Date.now()}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS sintética",
        clinicalService: "Servicio sintético",
        fullName: "Donante sintético",
        documentNumber: `DOC-${Date.now()}`,
        createdById: userId,
      },
    });
    donorId = donor.id;

    const legalization = await prisma.donationLegalization.create({
      data: {
        donorId,
        mechanism: "PRESUNCION_LEGAL",
        officerInChargeId: userId,
        status: "PENDIENTE",
      },
    });
    legalizationId = legalization.id;

    await expect(
      prisma.donationLegalization.create({
        data: {
          donorId,
          mechanism: "PRESUNCION_LEGAL",
          officerInChargeId: userId,
          status: "PENDIENTE",
        },
      }),
    ).rejects.toThrow();

    const sourceDocument = await prisma.sourceDocument.create({
      data: {
        donorId,
        uploadedById: userId,
        originalFilename: "synthetic.pdf",
        mimeType: "application/pdf",
        documentCategory: "SINTETICO",
        objectStorageKey: `integration/${donorId}/synthetic.pdf`,
        sha256Hash: "a".repeat(64),
        status: "UPLOADED",
      },
    });
    sourceDocumentId = sourceDocument.id;

    const job = await prisma.ocrProcessingJob.create({
      data: {
        sourceDocumentId,
        requestedById: userId,
        providerName: "SYNTHETIC",
        status: "COMPLETADO",
        correlationId: `integration-${Date.now()}`,
      },
    });
    ocrJobId = job.id;

    const field = await prisma.ocrExtractedField.create({
      data: {
        ocrJobId,
        sourceDocumentId,
        donorId,
        canonicalFieldKey: "synthetic_field",
        candidateValue: "candidate",
        confidenceScore: 0.9,
        validationStatus: "CONFIRMADO",
        confirmedValue: "confirmed",
        validatedById: secondUserId,
        validatedAt: new Date(),
      },
    });

    expect(field.confirmedValue).toBe("confirmed");
    await expect(
      prisma.ocrExtractedField.create({
        data: {
          ocrJobId,
          sourceDocumentId,
          donorId,
          canonicalFieldKey: "invalid_confidence",
          candidateValue: "candidate",
          confidenceScore: 1.1,
          validationStatus: "PENDIENTE",
        },
      }),
    ).rejects.toThrow();
  });
});
