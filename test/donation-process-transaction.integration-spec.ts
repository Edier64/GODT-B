import { PrismaClient } from "@prisma/client";
import { PrismaDonationProcessRepository } from "../src/infrastructure/processes/prisma-donation-process.repository";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration("DonationProcess Transactional Integrity (ACID Rollback)", () => {
  const prisma = new PrismaClient();
  let repository: PrismaDonationProcessRepository;
  let testUserId: string;
  let testPackageId: string;
  let packageVersionId: string;

  beforeAll(async () => {
    await prisma.$connect();
    repository = new PrismaDonationProcessRepository(prisma as any);

    // Create synthetic test user
    const user = await prisma.systemUser.create({
      data: {
        email: `tx-test-${Date.now()}@test.org`,
        fullName: "Auditor Transaccional",
        role: "ADMIN",
      },
    });
    testUserId = user.id;

    // Create Package and Version
    const runId = Date.now();
    const pkg = await prisma.processPackage.create({
      data: {
        code: `PKG-TX-${runId}`,
        name: "Paquete Transaccional Test",
        createdById: testUserId,
      },
    });
    testPackageId = pkg.id;

    const version = await prisma.processPackageVersion.create({
      data: {
        packageId: testPackageId,
        versionNumber: "1.0.0",
        status: "PUBLISHED",
        positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as any,
        createdById: testUserId,
      },
    });
    packageVersionId = version.id;
  });

  afterAll(async () => {
    try {
      if (packageVersionId) {
        await prisma.processPackageVersion.deleteMany({
          where: { id: packageVersionId },
        });
      }
      if (testPackageId) {
        await prisma.processPackage.deleteMany({
          where: { id: testPackageId },
        });
      }
      if (testUserId) {
        await prisma.auditEvent.deleteMany({
          where: { actorUserId: testUserId },
        });
        await prisma.systemUser.deleteMany({
          where: { id: testUserId },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("successfully creates donor, process, 23 document positions, and audit event in a single atomic transaction", async () => {
    const timestamp = Date.now();
    const rndCode = `PROV-RND-TX-SUCCESS-${timestamp}`;
    const docNumber = `PROV-DOC-TX-SUCCESS-${timestamp}`;
    const processCode = `PROC-TX-SUCCESS-${timestamp}`;

    const createdProcess = await repository.createTransactional({
      processCode,
      packageVersionId,
      openedById: testUserId,
      provisionalDonorInput: {
        rndCode,
        documentNumber: docNumber,
        fullName: "Donante Atómico Exitoso",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        status: "EN_VALORACION",
      },
      processInput: {
        primaryIpsName: "Hospital Universitario del Valle",
        notes: "Proceso creado en transacción atómica",
      },
      positions: OFFICIAL_REGIONAL_3_POSITIONS.map((pos) => ({
        positionNumber: pos.positionNumber,
        documentCode: pos.documentCode,
        title: pos.title,
        category: pos.category,
        orderIndex: pos.positionNumber,
        isMandatory: pos.isMandatory,
        defaultApplicability: pos.defaultApplicability,
      })),
      auditEvents: [
        {
          actorUserId: testUserId,
          action: "PROCESS_OPENED",
          entityType: "DONATION_PROCESS",
          correlationId: `corr-tx-${timestamp}`,
          metadata: { note: "Prueba transaccional exitosa" },
        },
      ],
    });

    expect(createdProcess).toBeDefined();
    expect(createdProcess.processCode).toBe(processCode);

    // Verify all records were persisted in real DB
    const dbDonor = await prisma.donorRecord.findUnique({
      where: { rndCode },
    });
    expect(dbDonor).not.toBeNull();
    expect(dbDonor!.fullName).toBe("Donante Atómico Exitoso");

    const dbProcess = await prisma.donationProcess.findUnique({
      where: { processCode },
      include: { documents: true },
    });
    expect(dbProcess).not.toBeNull();
    expect(dbProcess!.documents.length).toBe(23);

    const dbAudit = await prisma.auditEvent.findFirst({
      where: { correlationId: `corr-tx-${timestamp}` },
    });
    expect(dbAudit).not.toBeNull();

    // Cleanup created records
    await prisma.processDocument.deleteMany({ where: { processId: dbProcess!.id } });
    await prisma.auditEvent.deleteMany({ where: { entityId: dbProcess!.id } });
    await prisma.donationProcess.delete({ where: { id: dbProcess!.id } });
    await prisma.donorRecord.delete({ where: { id: dbDonor!.id } });
  });

  it("rolls back completely and leaves ZERO orphan records when document creation fails", async () => {
    const timestamp = Date.now();
    const rndCode = `PROV-RND-TX-FAIL-${timestamp}`;
    const docNumber = `PROV-DOC-TX-FAIL-${timestamp}`;
    const processCode = `PROC-TX-FAIL-${timestamp}`;

    // Pass invalid document position data (violates non-nullable documentCode constraint in DB schema)
    const invalidPositions = [
      {
        positionNumber: 1,
        documentCode: null as any, // Violates NOT NULL constraint in DB schema
        title: "Documento Inválido",
        category: "LEGAL",
        orderIndex: 1,
        isMandatory: true,
      },
    ];

    let errorThrown = false;
    try {
      await repository.createTransactional({
        processCode,
        packageVersionId,
        openedById: testUserId,
        provisionalDonorInput: {
          rndCode,
          documentNumber: docNumber,
          fullName: "Donante que Debe Revertir",
          originatingIpsName: "Hospital Universitario del Valle",
          clinicalService: "Urgencias",
          status: "EN_VALORACION",
        },
        processInput: {
          primaryIpsName: "Hospital Universitario del Valle",
          notes: "Este proceso debe fallar y hacer rollback completo",
        },
        positions: invalidPositions as any,
        auditEvents: [],
      });
    } catch (error) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);

    // Verify ACID rollback: zero orphan records
    const orphanDonor = await prisma.donorRecord.findUnique({
      where: { rndCode },
    });
    expect(orphanDonor).toBeNull();

    const orphanProcess = await prisma.donationProcess.findUnique({
      where: { processCode },
    });
    expect(orphanProcess).toBeNull();

    const orphanDocs = await prisma.processDocument.findMany({
      where: { title: "Documento Inválido" },
    });
    expect(orphanDocs.length).toBe(0);
  });
});
