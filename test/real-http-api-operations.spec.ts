import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { seedOfficialTemplates } from "../src/application/document-engine/official-template-definitions";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";

describe("Real HTTP API Operations Suite (20 Operaciones) — Fase D.3 Validación Real", () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;

  const runId = Date.now();
  let authToken: string;
  let testUserId: string;
  let testDonorId: string;
  let testPackageVersionId: string;
  let createdProcessId: string;
  let firstDocumentId: string;
  let anexo8DocumentId: string;
  let anexo8InstanceId: string;
  let documentTemplateId: string;
  let activeInstanceId: string;
  let generatedSnapshotId: string;
  let participantId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    // 1. Asegurar plantillas oficiales sembradas
    await seedOfficialTemplates(prisma);

    // 2. Asegurar usuario de prueba coordinador en PostgreSQL
    testUserId = randomUUID();
    const testEmail = `coordinador.${runId}@godt.gov.co`;
    await prisma.systemUser.create({
      data: {
        id: testUserId,
        email: testEmail,
        fullName: "Dr. Coordinador Pruebas HTTP",
        role: "COORDINATOR",
        isActive: true,
      },
    });

    // 3. Crear Donante y Paquete Documental para pruebas
    const donor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-HTTP-${String(runId).slice(-6)}`,
        documentNumber: `HTTP-${String(runId).slice(-8)}`,
        fullName: "Donante Verificación HTTP",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: testUserId,
      },
    });
    testDonorId = donor.id;

    // Paquete activo oficial
    let pkg = await prisma.processPackage.findFirst({
      where: { code: "PKG-REGIONAL-3" },
      include: {
        versions: {
          where: { status: "PUBLISHED" },
          take: 1,
        },
      },
    });

    if (!pkg || !pkg.versions.length) {
      pkg = await prisma.processPackage.create({
        data: {
          code: `PKG-REGIONAL-3-${runId}`,
          name: "Paquete Oficial Regional 3 Test",
          isActive: true,
          createdById: testUserId,
          versions: {
            create: {
              versionNumber: "1.0.0",
              status: "PUBLISHED",
              effectiveFrom: new Date("2026-01-01"),
              positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as any,
              createdById: testUserId,
              authorizedById: testUserId,
            },
          },
        },
        include: { versions: true },
      });
      testPackageVersionId = pkg.versions[0].id;
    } else {
      testPackageVersionId = pkg.versions[0].id;
    }

    // 4. Iniciar aplicación NestJS completa en memoria/puerto efímero
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0);

    const port = (app.getHttpServer().address() as any).port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 35000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  // -------------------------------------------------------------
  // OPERACIÓN 1: Login institucional y obtención de token
  // POST /api/v1/auth/login
  // -------------------------------------------------------------
  it("Operación 1: Login institucional — POST /api/v1/auth/login", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `coordinador.${runId}@godt.gov.co` }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.accessToken).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(`coordinador.${runId}@godt.gov.co`);
    authToken = data.accessToken;
  });

  // -------------------------------------------------------------
  // OPERACIÓN 2: Creación de proceso de donación
  // POST /api/v1/donation-processes
  // -------------------------------------------------------------
  it("Operación 2: Creación de proceso de donación — POST /api/v1/donation-processes", async () => {
    const res = await fetch(`${baseUrl}/api/v1/donation-processes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        donorId: testDonorId,
        primaryIpsName: "Hospital Universitario del Valle",
        processCode: `PROC-HTTP-${runId}`,
        notes: "Proceso abierto para validación de 20 operaciones HTTP reales",
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.processCode).toBe(`PROC-HTTP-${runId}`);
    createdProcessId = data.id;
  });

  // -------------------------------------------------------------
  // OPERACIÓN 3: Consulta de lista de procesos
  // GET /api/v1/donation-processes
  // -------------------------------------------------------------
  it("Operación 3: Lista de procesos — GET /api/v1/donation-processes", async () => {
    const res = await fetch(`${baseUrl}/api/v1/donation-processes`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items || data)).toBe(true);
    const items = data.items || data;
    const found = items.find((p: any) => p.id === createdProcessId);
    expect(found).toBeDefined();
  });

  // -------------------------------------------------------------
  // OPERACIÓN 4: Consulta de detalle de proceso
  // GET /api/v1/donation-processes/:id
  // -------------------------------------------------------------
  it("Operación 4: Detalle de proceso — GET /api/v1/donation-processes/:id", async () => {
    const res = await fetch(`${baseUrl}/api/v1/donation-processes/${createdProcessId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdProcessId);
    expect(data.primaryIpsName).toBe("Hospital Universitario del Valle");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 5: Consulta de las 23 posiciones documentales del paquete
  // GET /api/v1/donation-processes/:id/documents
  // -------------------------------------------------------------
  it("Operación 5: 23 posiciones documentales — GET /api/v1/donation-processes/:id/documents", async () => {
    const res = await fetch(`${baseUrl}/api/v1/donation-processes/${createdProcessId}/documents`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.documents).toBeDefined();
    expect(data.documents.length).toBe(23);

    // Posición 1 (Anexo 1)
    const doc1 = data.documents.find((d: any) => d.positionNumber === 1);
    expect(doc1).toBeDefined();
    expect(doc1.documentCode).toBe("ANEXO_1");
    firstDocumentId = doc1.id;

    // Posición 18 (Anexo 8 - Cadena de Custodia)
    const doc8 = data.documents.find((d: any) => d.positionNumber === 18);
    expect(doc8).toBeDefined();
    anexo8DocumentId = doc8.id;

    // Posiciones 20 a 23 como PENDING_HOMOLOGATION
    const pendingPos = data.documents.filter((d: any) => d.positionNumber >= 20);
    expect(pendingPos.length).toBe(4);
    for (const p of pendingPos) {
      expect(p.category).toBe("PENDING_HOMOLOGATION");
    }
  });

  // -------------------------------------------------------------
  // OPERACIÓN 6: Actualización de aplicabilidad documental
  // PATCH /api/v1/donation-processes/:id/documents/:docId/applicability
  // -------------------------------------------------------------
  it("Operación 6: Actualización de aplicabilidad — PATCH .../applicability", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/documents/${firstDocumentId}/applicability`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          applicabilityStatus: "APLICABLE",
        }),
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applicabilityStatus).toBe("APLICABLE");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 7: Apertura / iniciación de documento
  // POST /api/v1/donation-processes/:id/documents/:docId/initiate
  // -------------------------------------------------------------
  it("Operación 7: Iniciación documental — POST .../initiate", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/documents/${firstDocumentId}/initiate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.instanceId).toBeDefined();
    activeInstanceId = data.instanceId;

    // Obtener la plantilla asociada para la operación 8
    const inst = await prisma.documentInstance.findUnique({
      where: { id: activeInstanceId },
      include: { template: true },
    });
    expect(inst).toBeDefined();
    documentTemplateId = inst!.templateId;

    // También iniciar Anexo 8 para las operaciones de custodia
    const res8 = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/documents/${anexo8DocumentId}/initiate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    expect([200, 201]).toContain(res8.status);
    const data8 = await res8.json();
    anexo8InstanceId = data8.instanceId;
  });

  // -------------------------------------------------------------
  // OPERACIÓN 8: Consulta de versión de plantilla
  // GET /api/v1/document-catalog/:templateId/versions
  // -------------------------------------------------------------
  it("Operación 8: Versiones de plantilla — GET /api/v1/document-catalog/:id/versions", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-catalog/${documentTemplateId}/versions`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].versionNumber).toBe("1.0.0");
    expect(data[0].status).toBe("PUBLISHED");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 9: Guardado de borrador / revisión documental
  // PATCH /api/v1/document-instances/:instanceId
  // -------------------------------------------------------------
  it("Operación 9: Guardado de revisión — PATCH /api/v1/document-instances/:id", async () => {
    const payload = {
      responseData: {
        nombreDonante: "Donante Verificación HTTP",
        tipoIdentificacion: "CC",
        numeroIdentificacion: `HTTP-${runId}`,
        edad: 38,
        sexo: "MASCULINO",
        grupoSanguineo: "O",
        factorRh: "POSITIVO",
        ipsGeneradora: "Hospital Universitario del Valle",
        causaMuerte: "Trauma Craneoencefálico Severo",
        glasgowScore: 3,
        muerteEncefalicaConfirmada: true,
        tensionArterialSistolica: 120,
        tensionArterialDiastolica: 80,
        frecuenciaCardiaca: 82,
        temperaturaCorporal: 36.5,
      },
    };

    const res = await fetch(`${baseUrl}/api/v1/document-instances/${activeInstanceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const revNum = data.currentRevision?.revisionNumber ?? data.revisionNumber;
    expect(revNum).toBeGreaterThanOrEqual(1);

    // Asignar participante para que requiera firma y no salte a LIBERADO directamente
    const assignRes = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fullName: "Dra. Elena Ramos",
          documentType: "CC",
          documentNumber: "31888999",
          signerRole: "COORDINADOR_OPERATIVO",
          isSigner: true,
          signatureRequired: true,
          signatureOrder: 1,
        }),
      },
    );
    expect([200, 201]).toContain(assignRes.status);
    const assigned = await assignRes.json();
    participantId = assigned.id;
  });

  // -------------------------------------------------------------
  // OPERACIÓN 10: Validación de documento
  // POST /api/v1/document-instances/:instanceId/lifecycle/validate
  // -------------------------------------------------------------
  it("Operación 10: Validación formal — POST .../lifecycle/validate", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/validate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.status).toBe("VALIDADO");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 11: Completitud formal de documento
  // POST /api/v1/document-instances/:instanceId/lifecycle/complete
  // -------------------------------------------------------------
  it("Operación 11: Completitud formal — POST .../lifecycle/complete", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/complete`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.status).toBe("COMPLETADO");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 12: Generación de snapshot y PDF
  // POST /api/v1/document-instances/:instanceId/lifecycle/snapshot
  // -------------------------------------------------------------
  it("Operación 12: Generación de snapshot y PDF — POST .../lifecycle/snapshot", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/snapshot`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.snapshot).toBeDefined();
    expect(data.snapshot.id).toBeDefined();
    expect(data.sha256Hash).toBeDefined();
    generatedSnapshotId = data.snapshot.id;
  });

  // -------------------------------------------------------------
  // OPERACIÓN 13: Descarga / consulta de PDF generado
  // GET /api/v1/document-instances/:id/lifecycle/snapshots/:snapId/download
  // -------------------------------------------------------------
  it("Operación 13: Descarga de PDF generado — GET .../lifecycle/snapshots/:snapId/download", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/snapshots/${generatedSnapshotId}/download`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(100);
    const header = Buffer.from(arrayBuffer.slice(0, 4)).toString("ascii");
    expect(header).toBe("%PDF");
  });

  // -------------------------------------------------------------
  // OPERACIÓN 14: Consulta de participantes documentales
  // GET /api/v1/document-instances/:instanceId/lifecycle/participants
  // -------------------------------------------------------------
  it("Operación 14: Participantes documentales — GET .../lifecycle/participants", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/participants`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((p: any) => p.id === participantId)).toBe(true);
  });

  // -------------------------------------------------------------
  // OPERACIÓN 15: Registro de firma / atestación
  // POST /api/v1/document-instances/:instanceId/lifecycle/snapshots/:snapId/sign
  // -------------------------------------------------------------
  it("Operación 15: Registro de firma / atestación — POST .../lifecycle/snapshots/:snapId/sign", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${activeInstanceId}/lifecycle/snapshots/${generatedSnapshotId}/sign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          participantId,
          signatureType: "ATESTACION_USUARIO",
          attestationText: "Certifico la veracidad de los datos registrados en el presente documento.",
        }),
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(["VALIDA", "FIRMADO"]).toContain(data.signature?.status || data.status);
    expect(data.resultingStatus).toBeDefined();
  });

  // -------------------------------------------------------------
  // OPERACIÓN 16: Consulta de valores canónicos del proceso
  // GET /api/v1/donation-processes/:id/canonical-values/:fieldKey/history
  // -------------------------------------------------------------
  it("Operación 16: Historial de valor canónico — GET .../canonical-values/:fieldKey/history", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/canonical-values/donor.identity.full_name/history`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  // -------------------------------------------------------------
  // OPERACIÓN 17: Consulta de eventos de cadena de custodia
  // GET /api/v1/document-instances/:instanceId/lifecycle/custody-events
  // -------------------------------------------------------------
  it("Operación 17: Consulta de eventos de custodia — GET .../lifecycle/custody-events", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${anexo8InstanceId}/lifecycle/custody-events`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // -------------------------------------------------------------
  // OPERACIÓN 18: Anexo de evento de custodia inmutable
  // POST /api/v1/document-instances/:instanceId/lifecycle/custody-events
  // -------------------------------------------------------------
  it("Operación 18: Registro de evento de custodia — POST .../lifecycle/custody-events", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/document-instances/${anexo8InstanceId}/lifecycle/custody-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          eventType: "RECOLECCION",
          itemDescription: "Muestra de sangre EDTA y suero refrigerada a 4°C",
          containerCode: `CONT-HTTP-${runId}`,
          sealNumber: `SEAL-HTTP-${runId}`,
          temperatureCelsius: 4.0,
          transferorName: "Dra. Elena Ramos",
          transferorInstitution: "Hospital Universitario del Valle",
          receiverName: "Tec. Carlos Mendoza",
          receiverInstitution: "Banco de Tejidos Regional 3",
          occurredAt: new Date().toISOString(),
          location: "Quirófano 2 — HUV",
          integrityVerified: true,
          observations: "Sello intacto y cadena de frío garantizada",
        }),
      },
    );

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.sequenceNumber).toBe(1);
    expect(data.containerCode).toBe(`CONT-HTTP-${runId}`);
    expect(data.integrityVerified).toBe(true);
  });

  // -------------------------------------------------------------
  // OPERACIÓN 19: Consulta de observaciones / auditoría de propagación
  // GET /api/v1/donation-processes/:id/canonical-values/:fieldKey/observations
  // -------------------------------------------------------------
  it("Operación 19: Observaciones canónicas repetibles — GET .../canonical-values/:fieldKey/observations", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/canonical-values/donor.hemodynamics.temperature/observations`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // -------------------------------------------------------------
  // OPERACIÓN 20: Consulta de resolución de conflictos de propagación
  // GET /api/v1/donation-processes/:id/canonical-values/:fieldKey/conflicts
  // -------------------------------------------------------------
  it("Operación 20: Conflictos de valores canónicos — GET .../canonical-values/:fieldKey/conflicts", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/donation-processes/${createdProcessId}/canonical-values/donor.identity.full_name/conflicts`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
