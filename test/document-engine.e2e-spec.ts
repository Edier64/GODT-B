import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient, UserRole } from "@prisma/client";
import { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { SessionService } from "../src/presentation/auth/session.service";
import { TokenService } from "../src/presentation/auth/token.service";

const enabled = process.env.RUN_E2E_TESTS === "true";
const describeE2e = enabled ? describe : describe.skip;
type HttpRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};
type HttpResponse = {
  status: number;
  text: () => Promise<string>;
  json: <T>() => Promise<T>;
};

describeE2e("Document engine HTTP", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;
  let adminToken: string;
  let ipsAToken: string;
  let noScopeToken: string;
  let donorAId: string;
  let donorBId: string;
  let publishedVersionId: string;
  let draftVersionId: string;
  let templateId: string;
  const createdUserIds: string[] = [];

  async function request(
    path: string,
    token: string,
    init: HttpRequestInit = {},
  ): Promise<HttpResponse> {
    const url = new URL(path, baseUrl);
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        url,
        {
          method: init.method ?? "GET",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            connection: "close",
            ...(init.headers ?? {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: response.statusCode ?? 0,
              text: async () => body,
              json: async <T>() => JSON.parse(body) as T,
            });
          });
        },
      );
      request.on("error", reject);
      if (init.body) request.write(init.body);
      request.end();
    });
  }

  async function createUser(role: UserRole) {
    const user = await prisma.systemUser.create({
      data: {
        email: `${randomUUID()}@e2e.example`,
        fullName: `Usuario E2E ${role}`,
        role,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const tokenService = app.get(TokenService);
    const sessionService = app.get(SessionService);
    const admin = await createUser(UserRole.ADMIN);
    const ipsA = await createUser(UserRole.TECHNICIAN);
    const noScope = await createUser(UserRole.TECHNICIAN);

    const instA = await prisma.institutionEntity.upsert({
      where: { name: "IPS A" },
      update: { status: "ACTIVE" },
      create: {
        name: "IPS A",
        normalizedName: "ips a",
        city: "Cali",
        status: "ACTIVE",
      },
    });
    await prisma.userInstitutionScope.create({
      data: { userId: ipsA.id, institutionId: instA.id, status: "APPROVED" },
    });

    const adminSession = await sessionService.createSession(admin.id);
    const ipsASession = await sessionService.createSession(ipsA.id);
    const noScopeSession = await sessionService.createSession(noScope.id);

    adminToken = (await tokenService.signAccessToken(admin.id, adminSession.session.id)).accessToken;
    ipsAToken = (await tokenService.signAccessToken(ipsA.id, ipsASession.session.id)).accessToken;
    noScopeToken = (await tokenService.signAccessToken(noScope.id, noScopeSession.session.id)).accessToken;

    const donorA = await prisma.donorRecord.create({
      data: {
        rndCode: `E2E-A-${randomUUID()}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS A",
        clinicalService: "Servicio E2E",
        fullName: "Donante E2E A",
        documentNumber: `E2E-A-${randomUUID()}`,
        createdById: ipsA.id,
      },
    });
    donorAId = donorA.id;
    const donorB = await prisma.donorRecord.create({
      data: {
        rndCode: `E2E-B-${randomUUID()}`,
        status: "EN_VALORACION",
        originatingIpsName: "IPS B",
        clinicalService: "Servicio E2E",
        fullName: "Donante E2E B",
        documentNumber: `E2E-B-${randomUUID()}`,
        createdById: ipsA.id,
      },
    });
    donorBId = donorB.id;

    const templateResponse = await request(
      "/api/v1/document-catalog",
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({
          templateCode: `e2e-${randomUUID()}`,
          name: "Plantilla E2E",
          category: "TEST",
        }),
      },
    );
    expect(templateResponse.status).toBe(201);
    const template = (await templateResponse.json()) as { id: string };
    templateId = template.id;

    const versionResponse = await request(
      `/api/v1/document-catalog/${templateId}/versions`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({
          versionNumber: "1.0.0",
          effectiveFrom: new Date().toISOString(),
          jsonSchema: {
            type: "object",
            properties: {
              code: { type: "string" },
              protectedValue: { type: "string" },
            },
            required: ["code", "protectedValue"],
          },
          uiSchema: {
            sections: [{ id: "main", fields: ["code", "protectedValue"] }],
            fieldConfigs: { "$.protectedValue": { readonly: true } },
          },
          mappingConfig: [],
        }),
      },
    );
    expect(versionResponse.status).toBe(201);
    const version = (await versionResponse.json()) as { id: string };
    publishedVersionId = version.id;
    expect(
      (
        await request(
          `/api/v1/document-catalog/${templateId}/versions/${publishedVersionId}/validate`,
          adminToken,
          { method: "POST" },
        )
      ).status,
    ).toBe(201);

    const draftResponse = await request(
      `/api/v1/document-catalog/${templateId}/versions`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({
          versionNumber: "2.0.0",
          effectiveFrom: new Date().toISOString(),
          jsonSchema: { type: "object" },
          uiSchema: { sections: [] },
          mappingConfig: [],
        }),
      },
    );
    expect(draftResponse.status).toBe(201);
    draftVersionId = ((await draftResponse.json()) as { id: string }).id;
    expect(
      (
        await request(
          `/api/v1/document-catalog/${templateId}/versions/${publishedVersionId}/publish`,
          adminToken,
          { method: "POST" },
        )
      ).status,
    ).toBe(201);
  });

  afterAll(async () => {
    if (templateId) {
      const instances = await prisma.documentInstance.findMany({
        where: { templateId },
        select: { id: true },
      });
      for (const instance of instances) {
        await prisma.documentInstance.update({
          where: { id: instance.id },
          data: { currentRevisionId: null },
        });
        await prisma.documentFieldProvenance.deleteMany({
          where: { responseRevision: { documentInstanceId: instance.id } },
        });
        await prisma.documentResponseRevision.deleteMany({
          where: { documentInstanceId: instance.id },
        });
      }
      await prisma.documentInstance.deleteMany({ where: { templateId } });
      await prisma.templateVersion.deleteMany({ where: { templateId } });
      await prisma.documentTemplate.delete({ where: { id: templateId } });
    }
    if (donorAId) await prisma.donorRecord.delete({ where: { id: donorAId } });
    if (donorBId) await prisma.donorRecord.delete({ where: { id: donorBId } });
    if (createdUserIds.length) {
      await prisma.auditEvent.deleteMany({
        where: { actorUserId: { in: createdUserIds } },
      });
      await prisma.systemUser.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (app) {
      const server = app.getHttpServer() as {
        closeAllConnections?: () => void;
        closeIdleConnections?: () => void;
      };
      server.closeAllConnections?.();
      server.closeIdleConnections?.();
      await app.get(PrismaService).$disconnect();
      await app.close();
    }
    await prisma.$disconnect();
  });

  it("denies catalog access to a non-admin without IPS scope", async () => {
    const response = await request("/api/v1/document-catalog", noScopeToken);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Plantilla E2E");
  });

  it("denies cross-IPS access and allows the owning IPS", async () => {
    const own = await request(
      `/api/v1/donors/${donorAId}/document-instances`,
      ipsAToken,
    );
    expect(own.status).toBe(200);

    const cross = await request(
      `/api/v1/donors/${donorBId}/document-instances`,
      ipsAToken,
    );
    expect(cross.status).toBe(403);
  });

  it("creates an instance only with a published version and keeps revisions", async () => {
    const draft = await request(
      `/api/v1/donors/${donorAId}/document-instances`,
      ipsAToken,
      {
        method: "POST",
        body: JSON.stringify({
          templateVersionId: draftVersionId,
          responseData: {},
        }),
      },
    );
    expect(draft.status).toBe(422);

    const created = await request(
      `/api/v1/donors/${donorAId}/document-instances`,
      ipsAToken,
      {
        method: "POST",
        body: JSON.stringify({
          templateVersionId: publishedVersionId,
          responseData: { code: "one", protectedValue: "source" },
        }),
      },
    );
    expect(created.status).toBe(201);
    const instance = (await created.json()) as { id: string };

    const revision = await request(
      `/api/v1/document-instances/${instance.id}`,
      ipsAToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          responseData: { code: "two", protectedValue: "source" },
        }),
      },
    );
    expect(revision.status).toBe(200);

    const stored = await prisma.documentInstance.findUnique({
      where: { id: instance.id },
      include: { revisions: true },
    });
    expect(stored?.revisions.map((item) => item.revisionNumber).sort()).toEqual(
      [1, 2],
    );
    expect(stored?.currentRevisionId).toBe(
      stored?.revisions.find((item) => item.revisionNumber === 2)?.id,
    );

    const protectedAttempt = await request(
      `/api/v1/document-instances/${instance.id}`,
      ipsAToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          responseData: { code: "three", protectedValue: "tampered" },
        }),
      },
    );
    expect(protectedAttempt.status).toBe(422);
    const afterProtectedAttempt = await prisma.documentInstance.findUnique({
      where: { id: instance.id },
      include: { currentRevision: true },
    });
    expect(afterProtectedAttempt?.currentRevision?.responseData).toEqual({
      code: "two",
      protectedValue: "source",
    });
  });

  it("rejects administrative publication by a non-admin", async () => {
    const response = await request(
      `/api/v1/document-catalog/${templateId}/versions/${draftVersionId}/publish`,
      ipsAToken,
      { method: "POST" },
    );
    expect(response.status).toBe(403);
  });

  it("rejects mappings outside the canonical catalog", async () => {
    const response = await request(
      `/api/v1/document-catalog/${templateId}/versions`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({
          versionNumber: "3.0.0",
          effectiveFrom: new Date().toISOString(),
          jsonSchema: { type: "object" },
          uiSchema: { sections: [] },
          mappingConfig: [
            {
              targetKey: "clinicalData.arbitrary",
              sourcePath: "request.body",
              sourceKind: "MANUAL",
              dataType: "string",
              writable: true,
            },
          ],
        }),
      },
    );
    expect(response.status).toBe(422);
  });

  it("requires explicit conflict resolution before a new revision", async () => {
    const created = await request(
      `/api/v1/donors/${donorAId}/document-instances`,
      ipsAToken,
      {
        method: "POST",
        body: JSON.stringify({
          templateVersionId: publishedVersionId,
          responseData: { code: "conflict", protectedValue: "source" },
          sourceProvenance: [
            {
              fieldPath: "code",
              sourceKind: "MANUAL",
              sourceValue: "source-a",
            },
            {
              fieldPath: "code",
              sourceKind: "DONOR_RECORD",
              sourceValue: "source-b",
            },
          ],
        }),
      },
    );
    expect(created.status).toBe(201);
    const instance = (await created.json()) as { id: string };

    const blocked = await request(
      `/api/v1/document-instances/${instance.id}`,
      ipsAToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          responseData: { code: "next", protectedValue: "source" },
        }),
      },
    );
    expect(blocked.status).toBe(409);

    const resolved = await request(
      `/api/v1/document-instances/${instance.id}/conflicts/resolve`,
      ipsAToken,
      {
        method: "POST",
        body: JSON.stringify({
          fieldPath: "code",
          decision: "MANUAL_SELECTED",
          justification: "Decision made during E2E test",
        }),
      },
    );
    expect(resolved.status).toBe(201);
  });

  it("enforces published-version immutability in persistence", async () => {
    await expect(
      prisma.templateVersion.update({
        where: { id: publishedVersionId },
        data: { jsonSchema: { type: "string" } },
      }),
    ).rejects.toThrow("Published template versions are immutable");
  });
});
