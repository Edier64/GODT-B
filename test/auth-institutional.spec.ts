import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { AuthRateLimitGuard } from "../src/presentation/auth/auth-rate-limit.guard";
import { AuthController } from "../src/presentation/auth/auth.controller";
import { AuthService } from "../src/presentation/auth/auth.service";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { CurrentUser } from "../src/presentation/auth/current-user.decorator";
import { JwtAuthGuard } from "../src/presentation/auth/jwt-auth.guard";
import { PasswordService } from "../src/presentation/auth/password.service";
import { Roles } from "../src/presentation/auth/roles.decorator";
import { RolesGuard } from "../src/presentation/auth/roles.guard";
import { SessionService } from "../src/presentation/auth/session.service";
import { TokenService } from "../src/presentation/auth/token.service";

@Controller("api/v1/test-protected")
@UseGuardsCompat()
class ProtectedTestController {
  @Get("me")
  getCaller(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get("admin-only")
  @Roles(UserRole.ADMIN)
  adminOnly(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, role: user.role, ips: user.institutionalIps };
  }
}

function UseGuardsCompat() {
  return (target: Function) => {
    const { UseGuards } = require("@nestjs/common");
    UseGuards(JwtAuthGuard, RolesGuard)(target);
  };
}

function createStatefulAuthPrisma() {
  const users = new Map<string, any>();
  const credentials = new Map<string, any>();
  const institutions = new Map<string, any>();
  const scopes: Array<{ userId: string; institutionId: string; status: string }> = [];
  const sessions = new Map<string, any>();

  const getApprovedScopes = (userId: string) =>
    scopes
      .filter((s) => s.userId === userId && s.status === "APPROVED")
      .map((s) => institutions.get(s.institutionId))
      .filter((inst) => inst && inst.status === "ACTIVE")
      .map((inst) => ({
        institution: { id: inst.id, name: inst.name, status: inst.status },
      }));

  const attachUserIncludes = (user: any, include: any) => {
    if (!user) return null;
    const copy = { ...user };
    if (include?.credential) {
      copy.credential = credentials.get(user.id) ?? null;
    }
    if (include?.institutionScopes) {
      copy.institutionScopes = getApprovedScopes(user.id);
    }
    return copy;
  };

  const prismaMock: any = {
    __store: { users, credentials, institutions, scopes, sessions },
    systemUser: {
      create: jest.fn(async ({ data }: any) => {
        const id = data.id ?? randomUUID();
        const row = { id, createdAt: new Date(), ...data };
        users.set(id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let found: any = null;
        if (where.id) found = users.get(where.id) ?? null;
        else if (where.email) {
          for (const u of users.values()) {
            if (u.email === where.email) {
              found = u;
              break;
            }
          }
        }
        return attachUserIncludes(found, include);
      }),
    },
    userCredential: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = credentials.get(where.userId);
        const now = new Date();
        const row = existing
          ? { ...existing, ...update, updatedAt: now }
          : { id: randomUUID(), createdAt: now, updatedAt: now, ...create };
        credentials.set(where.userId, row);
        return row;
      }),
    },
    authSession: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: data.id ?? randomUUID(),
          revokedAt: null,
          revocationReason: null,
          replacedById: null,
          createdAt: new Date(),
          ...data,
        };
        sessions.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let found: any = null;
        if (where.id) found = sessions.get(where.id) ?? null;
        else if (where.refreshTokenHash) {
          for (const s of sessions.values()) {
            if (s.refreshTokenHash === where.refreshTokenHash) {
              found = s;
              break;
            }
          }
        }
        if (!found) return null;
        const copy = { ...found };
        if (include?.user) {
          copy.user = attachUserIncludes(users.get(found.userId) ?? null, include.user.include);
        }
        return copy;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = sessions.get(where.id);
        if (!row) throw new Error("Session not found");
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          const matchId = !where.id || s.id === where.id;
          const matchUser = !where.userId || s.userId === where.userId;
          const matchFamily = !where.familyId || s.familyId === where.familyId;
          const matchRevoked = where.revokedAt === undefined || s.revokedAt === where.revokedAt;
          if (matchId && matchUser && matchFamily && matchRevoked) {
            Object.assign(s, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
  };

  return prismaMock;
}

function extractRefreshCookieValue(setCookieHeaders: string[]): string | null {
  for (const header of setCookieHeaders) {
    const match = /^godt_refresh_token=([^;]+)/.exec(header);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

describe("GODT Auth Institucional Real (Argon2id + JWT + Refresh Rotation + RBAC)", () => {
  const TEST_JWT_SECRET = "test-suite-jwt-secret-minimum-32-chars-2026";
  let app: INestApplication;
  let baseUrl: string;
  let prismaMock: ReturnType<typeof createStatefulAuthPrisma>;
  let passwordService: PasswordService;
  let jwtService: JwtService;

  const userPass = "ClaveClinicaSegura#2026";
  let coordUserId: string;
  let adminUserId: string;
  let inactiveUserId: string;
  let noCredUserId: string;
  let instHuvId: string;
  let instImbId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_ISSUER = "godt-backend";
    process.env.JWT_AUDIENCE = "godt-frontend";
    process.env.AUTH_RATE_LIMIT_MAX = "50";

    prismaMock = createStatefulAuthPrisma();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { algorithm: "HS256", issuer: "godt-backend", audience: "godt-frontend" },
        }),
      ],
      controllers: [AuthController, ProtectedTestController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        PasswordService,
        TokenService,
        SessionService,
        AuthService,
        AuthRateLimitGuard,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    const addr = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    passwordService = moduleRef.get(PasswordService);
    jwtService = moduleRef.get(JwtService);

    instHuvId = randomUUID();
    instImbId = randomUUID();
    prismaMock.__store.institutions.set(instHuvId, {
      id: instHuvId,
      name: "Hospital Universitario del Valle",
      status: "ACTIVE",
    });
    prismaMock.__store.institutions.set(instImbId, {
      id: instImbId,
      name: "Clínica Imbanaco",
      status: "ACTIVE",
    });

    coordUserId = randomUUID();
    adminUserId = randomUUID();
    inactiveUserId = randomUUID();
    noCredUserId = randomUUID();

    const hash = await passwordService.hashPassword(userPass);

    prismaMock.__store.users.set(coordUserId, {
      id: coordUserId,
      email: "dra.elena@godt.gov.co",
      fullName: "Dra. Elena Ramos",
      role: UserRole.COORDINATOR,
      isActive: true,
    });
    prismaMock.__store.credentials.set(coordUserId, {
      id: randomUUID(),
      userId: coordUserId,
      passwordHash: hash,
      passwordUpdatedAt: new Date(),
    });
    prismaMock.__store.scopes.push({
      userId: coordUserId,
      institutionId: instHuvId,
      status: "APPROVED",
    });

    prismaMock.__store.users.set(adminUserId, {
      id: adminUserId,
      email: "admin.regional@godt.gov.co",
      fullName: "Administrador Regional",
      role: UserRole.ADMIN,
      isActive: true,
    });
    prismaMock.__store.credentials.set(adminUserId, {
      id: randomUUID(),
      userId: adminUserId,
      passwordHash: hash,
      passwordUpdatedAt: new Date(),
    });

    prismaMock.__store.users.set(inactiveUserId, {
      id: inactiveUserId,
      email: "inactivo@godt.gov.co",
      fullName: "Usuario Inactivo",
      role: UserRole.TECHNICIAN,
      isActive: false,
    });
    prismaMock.__store.credentials.set(inactiveUserId, {
      id: randomUUID(),
      userId: inactiveUserId,
      passwordHash: hash,
      passwordUpdatedAt: new Date(),
    });

    prismaMock.__store.users.set(noCredUserId, {
      id: noCredUserId,
      email: "sincredencial@godt.gov.co",
      fullName: "Usuario Sin Credencial",
      role: UserRole.SURGEON,
      isActive: true,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("7. Hash Argon2id con salt único y verificación correcta", async () => {
    const h1 = await passwordService.hashPassword(userPass);
    const h2 = await passwordService.hashPassword(userPass);

    expect(h1.startsWith("$argon2id$")).toBe(true);
    expect(h1).not.toBe(h2);
    expect(await passwordService.verifyPassword(h1, userPass)).toBe(true);
    expect(await passwordService.verifyPassword(h1, "otra-clave")).toBe(false);
    expect(await passwordService.verifyPassword("invalid-hash", userPass)).toBe(false);
  });

  it("1 & 8. Login correcto normalizando email, emite JWT mínimo y cookie HttpOnly sin exponer refreshToken ni passwordHash", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "  DRA.ELENA@GODT.GOV.CO  ", password: userPass }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.accessToken).toBe("string");
    expect(body.expiresIn).toBe(900);
    expect(body.rawRefreshToken).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
    expect(body.user).toEqual({
      id: coordUserId,
      email: "dra.elena@godt.gov.co",
      fullName: "Dra. Elena Ramos",
      role: "COORDINATOR",
      institutionalIps: ["Hospital Universitario del Valle"],
    });
    expect(JSON.stringify(body)).not.toContain("$argon2id$");
    expect(JSON.stringify(body)).not.toContain(userPass);

    // JWT no debe almacenar role ni institutionalIps
    const decoded = jwtService.decode(body.accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe(coordUserId);
    expect(typeof decoded.sid).toBe("string");
    expect(typeof decoded.jti).toBe("string");
    expect(decoded.iss).toBe("godt-backend");
    expect(decoded.aud).toBe("godt-frontend");
    expect(decoded.role).toBeUndefined();
    expect(decoded.institutionalIps).toBeUndefined();

    const setCookies = res.headers.getSetCookie();
    const refreshCookieHeader = setCookies.find((c) => c.startsWith("godt_refresh_token="));
    expect(refreshCookieHeader).toBeDefined();
    expect(refreshCookieHeader).toContain("HttpOnly");
    expect(refreshCookieHeader).toContain("SameSite=Strict");
    expect(refreshCookieHeader).toContain("Path=/api/v1/auth");
  });

  it("2, 3, 5, 6 & 9. Correo inexistente, contraseña incorrecta, inactivo, sin credencial y dev legacy retornan 401 genérico sin crear usuarios", async () => {
    const createCountBefore = prismaMock.systemUser.create.mock.calls.length;

    const attempts = [
      { email: "noexiste@godt.gov.co", password: userPass },
      { email: "dra.elena@godt.gov.co", password: "WrongPassword123!" },
      { email: "inactivo@godt.gov.co", password: userPass },
      { email: "sincredencial@godt.gov.co", password: userPass },
      { email: "coordinador@godt.gov.co", password: "CualquierPassword123" },
    ];

    const messages: string[] = [];
    for (const payload of attempts) {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      messages.push(data.message);
    }

    // Todos deben entregar exactamente el mismo mensaje genérico
    expect(new Set(messages).size).toBe(1);
    expect(prismaMock.systemUser.create.mock.calls.length).toBe(createCountBefore);
  });

  it("4. Contraseña vacía es rechazada con 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("10, 11 & 12. JWT válido accede a /me, JWT expirado e inválido son rechazados con 401", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: userPass }),
    });
    const { accessToken } = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.status).toBe(200);
    const me = await meRes.json();
    expect(me.id).toBe(coordUserId);
    expect(me.passwordHash).toBeUndefined();

    // JWT expirado
    const expiredToken = await jwtService.signAsync(
      { sub: coordUserId, sid: "00000000-0000-0000-0000-000000000001", jti: randomUUID() },
      { expiresIn: -10 },
    );
    const expRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(expRes.status).toBe(401);

    // JWT firmado con otro secreto / audiencia incorrecta
    const forgedToken = await jwtService.signAsync(
      { sub: coordUserId, sid: "00000000-0000-0000-0000-000000000001", jti: randomUUID() },
      { secret: "wrong-secret-key-wrong-secret-key", audience: "godt-frontend" },
    );
    const forgedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    expect(forgedRes.status).toBe(401);
  });

  it("13, 14 & 15. Refresh exitoso, rotación de refresh token y revocación de familia ante reutilización", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: userPass }),
    });
    expect(loginRes.status).toBe(200);
    const refreshToken1 = extractRefreshCookieValue(loginRes.headers.getSetCookie());
    expect(refreshToken1).toBeTruthy();

    // Refresh válido -> rota a refreshToken2
    const refRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${refreshToken1}` },
    });
    expect(refRes.status).toBe(200);
    const refBody = await refRes.json();
    expect(typeof refBody.accessToken).toBe("string");
    expect(refBody.refreshToken).toBeUndefined();
    const refreshToken2 = extractRefreshCookieValue(refRes.headers.getSetCookie());
    expect(refreshToken2).toBeTruthy();
    expect(refreshToken2).not.toBe(refreshToken1);

    // El nuevo accessToken2 funciona
    const me2 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${refBody.accessToken}` },
    });
    expect(me2.status).toBe(200);

    // Atacante reutiliza refreshToken1 -> 401 y revoca TODA la familia (incluido refreshToken2 y accessToken2)
    const reuseRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${refreshToken1}` },
    });
    expect(reuseRes.status).toBe(401);

    // El refreshToken2 legítimo ahora también está revocado!
    const ref2AfterReuse = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${refreshToken2}` },
    });
    expect(ref2AfterReuse.status).toBe(401);

    // Incluso accessToken2 vigente queda rechazado porque su sesión fue revocada
    const meAfterReuse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${refBody.accessToken}` },
    });
    expect(meAfterReuse.status).toBe(401);
  });

  it("16 & 17. Logout revoca la sesión inmediatamente y limpia la cookie", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: userPass }),
    });
    const { accessToken } = await loginRes.json();
    const rt = extractRefreshCookieValue(loginRes.headers.getSetCookie());

    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `godt_refresh_token=${rt}`,
      },
    });
    expect(logoutRes.status).toBe(200);
    const clearHeader = logoutRes.headers.getSetCookie().find((c) => c.startsWith("godt_refresh_token="));
    expect(clearHeader).toBeDefined();
    expect(clearHeader).toContain("godt_refresh_token=;");

    // El access token ya no sirve después de logout
    const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meAfterLogout.status).toBe(401);

    // El refresh token tampoco sirve
    const refreshAfterLogout = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `godt_refresh_token=${rt}` },
    });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("18, 19, 20 & 21. Usuario desactivado, cambio de rol y cambio de IPS se reflejan inmediatamente sin re-emitir JWT", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: userPass }),
    });
    const { accessToken } = await loginRes.json();

    // 21. COORDINATOR no accede a ruta ADMIN -> 403
    const deniedAdmin = await fetch(`${baseUrl}/api/v1/test-protected/admin-only`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(deniedAdmin.status).toBe(403);

    // 19. Cambio de rol en PostgreSQL a ADMIN -> siguiente request ya tiene ADMIN!
    const coordRecord = prismaMock.__store.users.get(coordUserId);
    coordRecord.role = UserRole.ADMIN;
    const allowedAdmin = await fetch(`${baseUrl}/api/v1/test-protected/admin-only`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(allowedAdmin.status).toBe(200);
    coordRecord.role = UserRole.COORDINATOR;

    // 20. Cambio de ámbito institucional -> siguiente consulta refleja IPS actualizadas
    prismaMock.__store.scopes.push({
      userId: coordUserId,
      institutionId: instImbId,
      status: "APPROVED",
    });
    const meUpdatedIps = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meUpdatedJson = await meUpdatedIps.json();
    expect(meUpdatedJson.institutionalIps).toEqual([
      "Hospital Universitario del Valle",
      "Clínica Imbanaco",
    ]);

    // 18. Desactivar usuario -> siguiente request falla con 401
    coordRecord.isActive = false;
    const deactivatedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(deactivatedRes.status).toBe(401);
    coordRecord.isActive = true;

    // CSRF Origin check bloquea origen no autorizado en /refresh
    const csrfBlocked = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Origin: "https://evil.example.com" },
    });
    expect(csrfBlocked.status).toBe(403);
  });

  it("22. Rotación concurrente del mismo refresh token no permite dos sesiones válidas", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dra.elena@godt.gov.co", password: userPass }),
    });
    expect(loginRes.status).toBe(200);
    const rt = extractRefreshCookieValue(loginRes.headers.getSetCookie());
    expect(rt).toBeTruthy();

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `godt_refresh_token=${rt}` },
      }),
      fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `godt_refresh_token=${rt}` },
      }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 401]);
  });

  it("23. Seguridad de configuración: JWT_SECRET débil falla en cualquier entorno, Secure no puede desactivarse en producción y rate-limit bloquea spoofing X-Forwarded-For", () => {
    const devWeakConfig = new ConfigService({
      NODE_ENV: "development",
      JWT_SECRET: "short-secret",
    });
    expect(() => new TokenService(jwtService, devWeakConfig)).toThrow(/32 caracteres/i);

    const placeholderConfig = new ConfigService({
      NODE_ENV: "development",
      JWT_SECRET: "replace_with_a_long_random_secret_at_least_32_characters_randomly_generated",
    });
    expect(() => new TokenService(jwtService, placeholderConfig)).toThrow(/inseguro/i);

    const prodCookieController = new AuthController(
      {} as AuthService,
      {} as SessionService,
      {} as TokenService,
      new ConfigService({
        NODE_ENV: "production",
        AUTH_COOKIE_SECURE: "false",
      }),
    );
    expect((prodCookieController as any).cookieSecure).toBe(true);

    const guard = new AuthRateLimitGuard(
      new ConfigService({
        AUTH_RATE_LIMIT_ENABLED: "true",
        AUTH_RATE_LIMIT_MAX: "2",
        AUTH_RATE_LIMIT_IP_MAX: "4",
        AUTH_RATE_LIMIT_WINDOW_MS: "60000",
        TRUST_PROXY: "false",
      }),
    );
    const makeCtx = (email: string, xff: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            path: "/api/v1/auth/login",
            ip: "10.0.0.5",
            socket: { remoteAddress: "10.0.0.5" },
            headers: { "x-forwarded-for": xff },
            body: { email },
          }),
        }),
      }) as any;

    expect(guard.canActivate(makeCtx("u1@godt.gov.co", "1.1.1.1"))).toBe(true);
    expect(guard.canActivate(makeCtx("u2@godt.gov.co", "2.2.2.2"))).toBe(true);
    expect(guard.canActivate(makeCtx("u3@godt.gov.co", "3.3.3.3"))).toBe(true);
    expect(guard.canActivate(makeCtx("u4@godt.gov.co", "4.4.4.4"))).toBe(true);
    expect(() => guard.canActivate(makeCtx("u5@godt.gov.co", "5.5.5.5"))).toThrow();
  });
});
