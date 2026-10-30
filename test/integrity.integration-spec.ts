import { PrismaClient } from "@prisma/client";
import { PrismaDonorRecordRepository } from "../src/infrastructure/donors/prisma-donor-record.repository";
import { PrismaLegalizationRepository } from "../src/infrastructure/legalization/prisma-legalization.repository";

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" ? describe : describe.skip;

describeIntegration("Sprint 1 transactional integrity", () => {
  const prisma = new PrismaClient();
  let userId: string;
  let donorId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.systemUser.create({
      data: {
        email: `sprint1-${Date.now()}@example.com`,
        fullName: "Sprint 1 Integration",
        role: "COORDINATOR",
      },
    });
    userId = user.id;
    const donor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-S1-${Date.now()}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS-INTEGRATION",
        clinicalService: "UCI",
        fullName: "Synthetic donor",
        documentNumber: `DOC-S1-${Date.now()}`,
        createdById: userId,
      },
    });
    donorId = donor.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { entityId: donorId } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: userId } });
    const legalizations = await prisma.donationLegalization.findMany({
      where: { donorId },
      select: { id: true },
    });
    await prisma.donationRepresentative.deleteMany({
      where: { legalizationId: { in: legalizations.map(({ id }) => id) } },
    });
    await prisma.donationLegalization.deleteMany({ where: { donorId } });
    await prisma.donorRecord.deleteMany({ where: { id: donorId } });
    await prisma.systemUser.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("rolls back donor update when the audit insert fails", async () => {
    const repository = new PrismaDonorRecordRepository(prisma as never);
    await expect(
      repository.updateWithAudit(
        donorId,
        { clinicalService: "SHOULD-ROLLBACK" },
        {
          actorUserId: "00000000-0000-0000-0000-000000000000",
          action: "DONOR_UPDATED",
          entityType: "DONOR_RECORD",
          entityId: donorId,
          correlationId: donorId,
        },
      ),
    ).rejects.toThrow();
    const unchanged = await prisma.donorRecord.findUnique({
      where: { id: donorId },
    });
    expect(unchanged?.clinicalService).toBe("UCI");
  });

  it("creates Anexo 3 with two representatives and an audit event atomically", async () => {
    const repository = new PrismaLegalizationRepository(prisma as never);
    const result = await repository.createWithRepresentatives(
      donorId,
      userId,
      {
        mechanism: "CONSENTIMIENTO_FAMILIAR",
        isAdult: false,
        isColombian: true,
        isResident: true,
        oppositionRegistered: false,
        representatives: [
          {
            fullName: "Representative 1",
            documentType: "CC",
            documentNumber: "1",
            relationshipToDonor: "Parent",
          },
          {
            fullName: "Representative 2",
            documentType: "CC",
            documentNumber: "2",
            relationshipToDonor: "Parent",
          },
        ],
      },
      {
        actorUserId: userId,
        action: "DONATION_LEGALIZATION_CREATED",
        entityType: "DONATION_LEGALIZATION",
        entityId: donorId,
        correlationId: donorId,
        metadata: { mechanism: "CONSENTIMIENTO_FAMILIAR" },
      },
    );
    const count = await prisma.donationRepresentative.count({
      where: { legalizationId: result.id },
    });
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: result.id, action: "DONATION_LEGALIZATION_CREATED" },
    });
    expect(count).toBe(2);
    expect(audit).not.toBeNull();
  });
});
