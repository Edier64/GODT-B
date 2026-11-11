import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { PasswordService } from "../src/presentation/auth/password.service";

const runPgAuthTests = process.env.RUN_PG_INTEGRATION === "true";
const describePg = runPgAuthTests ? describe : describe.skip;

describePg("PostgreSQL Auth Integration (USER_CREDENTIAL + AUTH_SESSION + USER_INSTITUTION_SCOPE)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let baseUrl: string;
  let userId: string;
  let institutionId: string;
  const email = `auth.pg.${Date.now()}@godt.gov.co`;
  const password = "PgIntegrationPassword#2026";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0);

    const addr = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    prisma = moduleRef.get(PrismaService);
    passwordService = moduleRef.get(PasswordService);

    const inst = await prisma.institutionEntity.upsert({
      where: { name: "Hospital Universitario del Valle" },
      update: { status: "ACTIVE" },
      create: {
        name: "Hospital Universitario del Valle",
        normalizedName: "hospital universitario del valle",
        city: "Cali",
        status: "ACTIVE",
      },
    });
    institutionId = inst.id;

    userId = randomUUID();
    const hash = await passwordService.hashPassword(password);
    await prisma.systemUser.create({
      data: {
        id: userId,
        email,
        fullName: "Dra. Integración PostgreSQL",
        role: UserRole.COORDINATOR,
        isActive: true,
        credential: { create: { passwordHash: hash } },
        institutionScopes: { create: { institutionId, status: "APPROVED" } },
      },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.systemUser.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await app?.close();
  }, 20000);

  it("autentica contra PostgreSQL, rota sesión y revoca tras logout", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.user.institutionalIps).toContain("Hospital Universitario del Valle");

    const cookieHeader = loginRes.headers.getSetCookie().find((c) => c.startsWith("godt_refresh_token="));
    const rt = cookieHeader?.split(";")[0]?.split("=")[1];
    expect(rt).toBeTruthy();

    const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt}` },
    });
    expect(refreshRes.status).toBe(200);
    const refreshed = await refreshRes.json();
    const rt2Header = refreshRes.headers.getSetCookie().find((c) => c.startsWith("godt_refresh_token="));
    const rt2 = rt2Header?.split(";")[0]?.split("=")[1];
    expect(rt2).toBeTruthy();
    expect(rt2).not.toBe(rt);

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    });
    expect(meRes.status).toBe(200);

    // Logout real contra PostgreSQL revoca la sesión y bloquea tanto refresh como /me
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`,
        Cookie: `godt_refresh_token=${rt2}`,
      },
    });
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    });
    expect(meAfterLogout.status).toBe(401);

    const refreshAfterLogout = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt2}` },
    });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("detecta reutilización de refresh token y revoca la familia completa en PostgreSQL", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(loginRes.status).toBe(200);
    const rt1 = loginRes.headers
      .getSetCookie()
      .find((c) => c.startsWith("godt_refresh_token="))
      ?.split(";")[0]
      ?.split("=")[1];
    expect(rt1).toBeTruthy();

    const refRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt1}` },
    });
    expect(refRes.status).toBe(200);
    const { accessToken: accessToken2 } = await refRes.json();
    const rt2 = refRes.headers
      .getSetCookie()
      .find((c) => c.startsWith("godt_refresh_token="))
      ?.split(";")[0]
      ?.split("=")[1];
    expect(rt2).toBeTruthy();

    // Reutilización del rt1 ya rotado -> 401 y revocación de toda la familia
    const reuseRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt1}` },
    });
    expect(reuseRes.status).toBe(401);

    const rt2AfterReuse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt2}` },
    });
    expect(rt2AfterReuse.status).toBe(401);

    const meAfterReuse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken2}` },
    });
    expect(meAfterReuse.status).toBe(401);
  });
});

