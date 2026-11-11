import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthSession, Prisma, SystemUser, UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { TokenService } from "./token.service";

export interface SessionClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

export type SystemUserWithActiveScopes = SystemUser & {
  institutionScopes: Array<{
    institution: {
      id: string;
      name: string;
      status: string;
    };
  }>;
};

export const USER_WITH_APPROVED_SCOPES_INCLUDE = {
  institutionScopes: {
    where: {
      status: "APPROVED",
      institution: {
        status: "ACTIVE",
      },
    },
    select: {
      institution: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.SystemUserInclude;

export function extractApprovedInstitutionalIps(user: SystemUserWithActiveScopes): string[] {
  return user.institutionScopes
    .filter((scope) => scope.institution.status === "ACTIVE")
    .map((scope) => scope.institution.name);
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {
    const ttlDays = Number(this.config.get<string>("REFRESH_TOKEN_TTL_DAYS", "7"));
    const safeDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7;
    this.refreshTtlMs = safeDays * 24 * 60 * 60 * 1000;
  }

  getRefreshTtlMs(): number {
    return this.refreshTtlMs;
  }

  async createSession(
    userId: string,
    meta?: SessionClientMeta,
  ): Promise<{ session: AuthSession; rawRefreshToken: string }> {
    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.refreshTtlMs);

    const session = await this.prisma.authSession.create({
      data: {
        userId,
        familyId: randomUUID(),
        refreshTokenHash,
        expiresAt,
        ipAddress: meta?.ipAddress?.slice(0, 64) || null,
        userAgent: meta?.userAgent?.slice(0, 512) || null,
        lastUsedAt: now,
      },
    });

    return { session, rawRefreshToken };
  }

  async rotateSession(
    rawRefreshToken: string,
    meta?: SessionClientMeta,
  ): Promise<{
    session: AuthSession;
    rawRefreshToken: string;
    user: SystemUserWithActiveScopes;
    institutionalIps: string[];
  }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
      throw new UnauthorizedException("Refresh token requerido.");
    }

    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: USER_WITH_APPROVED_SCOPES_INCLUDE,
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException("Sesión no válida o expirada.");
    }

    const now = new Date();

    // Detección de reutilización de un refresh token previamente revocado o rotado
    if (existing.revokedAt !== null) {
      await this.revokeFamily(existing.familyId, "REFRESH_TOKEN_REUSE_DETECTED");
      this.logger.warn(
        `Detección de reutilización de refresh token para userId=${existing.userId}, familyId=${existing.familyId}. Familia revocada.`,
      );
      throw new UnauthorizedException("Sesión revocada por seguridad. Inicie sesión nuevamente.");
    }

    if (existing.expiresAt <= now) {
      await this.prisma.authSession.update({
        where: { id: existing.id },
        data: { revokedAt: now, revocationReason: "EXPIRED" },
      });
      throw new UnauthorizedException("Sesión expirada. Inicie sesión nuevamente.");
    }

    if (!existing.user || !existing.user.isActive) {
      await this.revokeFamily(existing.familyId, "USER_INACTIVE");
      throw new UnauthorizedException("Usuario institucional inactivo.");
    }

    const nextRawRefreshToken = this.tokenService.generateRefreshToken();
    const nextRefreshTokenHash = this.tokenService.hashRefreshToken(nextRawRefreshToken);
    const nextExpiresAt = new Date(now.getTime() + this.refreshTtlMs);
    const nextSessionId = randomUUID();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.authSession.updateMany({
        where: {
          id: existing.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: "ROTATED",
          replacedById: nextSessionId,
          lastUsedAt: now,
        },
      });

      if (claim.count === 0) {
        return null;
      }

      return tx.authSession.create({
        data: {
          id: nextSessionId,
          userId: existing.userId,
          familyId: existing.familyId,
          refreshTokenHash: nextRefreshTokenHash,
          expiresAt: nextExpiresAt,
          ipAddress: meta?.ipAddress?.slice(0, 64) ?? existing.ipAddress,
          userAgent: meta?.userAgent?.slice(0, 512) ?? existing.userAgent,
          lastUsedAt: now,
        },
      });
    });

    if (!rotated) {
      await this.revokeFamily(existing.familyId, "REFRESH_TOKEN_REUSE_DETECTED");
      this.logger.warn(
        `Colisión/reutilización concurrente de refresh token para userId=${existing.userId}, familyId=${existing.familyId}. Familia revocada.`,
      );
      throw new UnauthorizedException("Sesión revocada por seguridad. Inicie sesión nuevamente.");
    }

    return {
      session: rotated,
      rawRefreshToken: nextRawRefreshToken,
      user: existing.user,
      institutionalIps: extractApprovedInstitutionalIps(existing.user),
    };
  }

  async revokeByRefreshToken(rawRefreshToken: string, reason = "USER_LOGOUT"): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { familyId: true },
    });
    if (session) {
      await this.revokeFamily(session.familyId, reason);
    }
  }

  async revokeSessionById(sessionId: string, reason = "SESSION_REVOKED"): Promise<void> {
    if (!sessionId) return;
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { familyId: true },
    });
    if (session) {
      await this.revokeFamily(session.familyId, reason);
    }
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }

  async revokeAllUserSessions(userId: string, reason = "USER_SESSIONS_REVOKED"): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }

  async validateActiveSessionAndLoadUser(
    sessionId: string,
    userId: string,
  ): Promise<{
    userId: string;
    role: UserRole;
    institutionalIps: string[];
    sessionId: string;
  }> {
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: USER_WITH_APPROVED_SCOPES_INCLUDE,
        },
      },
    });

    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      !session.user ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException("Sesión no válida, revocada o usuario inactivo.");
    }

    return {
      userId: session.user.id,
      role: session.user.role,
      institutionalIps: extractApprovedInstitutionalIps(session.user),
      sessionId: session.id,
    };
  }
}

