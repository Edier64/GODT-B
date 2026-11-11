import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "crypto";
import { AccessTokenClaims } from "./auth.types";

const JWT_ALGORITHM = "HS256" as const;

function parseExpiresInSeconds(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = /^(\d+)([smhd])$/i.exec(trimmed);
  if (!match) {
    return 900; // 15m default
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return amount * (multipliers[unit] ?? 60);
}

@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessExpiresIn: string;
  private readonly accessExpiresInSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.get<string>("JWT_SECRET")?.trim();
    if (!secret) {
      throw new Error("[CRITICAL] JWT_SECRET es obligatorio y no está configurado.");
    }

    const nodeEnv = (this.config.get<string>("NODE_ENV") || "development").trim().toLowerCase();
    if (
      secret.length < 32 ||
      secret.includes("replace_with") ||
      secret.includes("CHANGE_ME") ||
      secret.includes("secret_at_least_32")
    ) {
      throw new Error(
        `[CRITICAL] JWT_SECRET en entorno ${nodeEnv} es inseguro o inferior a 32 caracteres.`,
      );
    }

    this.secret = secret;
    this.issuer = this.config.get<string>("JWT_ISSUER", "godt-backend").trim();
    this.audience = this.config.get<string>("JWT_AUDIENCE", "godt-frontend").trim();
    this.accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m").trim();
    this.accessExpiresInSeconds = parseExpiresInSeconds(this.accessExpiresIn);
  }

  async signAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<{ accessToken: string; expiresIn: number; jti: string }> {
    const jti = randomUUID();
    const payload = {
      sub: userId,
      sid: sessionId,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.secret,
      algorithm: JWT_ALGORITHM,
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.accessExpiresInSeconds,
    });

    return {
      accessToken,
      expiresIn: this.accessExpiresInSeconds,
      jti,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Token de acceso inválido.");
    }

    try {
      const payload = await this.jwtService.verifyAsync<Partial<AccessTokenClaims>>(token, {
        secret: this.secret,
        algorithms: [JWT_ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
      });

      if (
        typeof payload.sub !== "string" ||
        !payload.sub ||
        typeof payload.sid !== "string" ||
        !payload.sid ||
        typeof payload.jti !== "string" ||
        !payload.jti
      ) {
        throw new UnauthorizedException("Claims de token inválidos.");
      }

      return {
        sub: payload.sub,
        sid: payload.sid,
        jti: payload.jti,
        iss: payload.iss,
        aud: payload.aud,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Token de acceso inválido o expirado.");
    }
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashRefreshToken(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }
}

