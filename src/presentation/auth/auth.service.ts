import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuthUserProfile, AuthenticatedUser } from "./auth.types";
import { LoginDto } from "./dto/login.dto";
import { PasswordService } from "./password.service";
import {
  SessionClientMeta,
  SessionService,
  SystemUserWithActiveScopes,
  USER_WITH_APPROVED_SCOPES_INCLUDE,
  extractApprovedInstitutionalIps,
} from "./session.service";
import { TokenService } from "./token.service";

const GENERIC_AUTH_ERROR = "Credenciales institucionales inválidas.";

export interface AuthResultInternal {
  accessToken: string;
  expiresIn: number;
  user: AuthUserProfile;
  rawRefreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  private toUserProfile(
    user: SystemUserWithActiveScopes,
    institutionalIps?: string[],
  ): AuthUserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      institutionalIps: institutionalIps ?? extractApprovedInstitutionalIps(user),
    };
  }

  async login(dto: LoginDto, meta?: SessionClientMeta): Promise<AuthResultInternal> {
    const emailNormalized = typeof dto.email === "string" ? dto.email.trim().toLowerCase() : "";
    const plainPassword = typeof dto.password === "string" ? dto.password : "";

    if (!emailNormalized || plainPassword.trim().length === 0 || plainPassword.length > 128) {
      await this.passwordService.verifyDummy(plainPassword);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const user = await this.prisma.systemUser.findUnique({
      where: { email: emailNormalized },
      include: {
        credential: true,
        ...USER_WITH_APPROVED_SCOPES_INCLUDE,
      },
    });

    if (!user || !user.credential || !user.isActive) {
      await this.passwordService.verifyDummy(plainPassword);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const validPassword = await this.passwordService.verifyPassword(
      user.credential.passwordHash,
      plainPassword,
    );

    if (!validPassword) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (this.passwordService.needsRehash(user.credential.passwordHash)) {
      await this.passwordService.updateUserPassword(user.id, plainPassword);
    }

    const { session, rawRefreshToken } = await this.sessionService.createSession(user.id, meta);
    const { accessToken, expiresIn } = await this.tokenService.signAccessToken(
      user.id,
      session.id,
    );

    return {
      accessToken,
      expiresIn,
      user: this.toUserProfile(user),
      rawRefreshToken,
    };
  }

  async refresh(rawRefreshToken: string, meta?: SessionClientMeta): Promise<AuthResultInternal> {
    const rotated = await this.sessionService.rotateSession(rawRefreshToken, meta);
    const { accessToken, expiresIn } = await this.tokenService.signAccessToken(
      rotated.user.id,
      rotated.session.id,
    );

    return {
      accessToken,
      expiresIn,
      user: this.toUserProfile(rotated.user, rotated.institutionalIps),
      rawRefreshToken: rotated.rawRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string, authUser?: AuthenticatedUser): Promise<void> {
    if (rawRefreshToken) {
      await this.sessionService.revokeByRefreshToken(rawRefreshToken, "USER_LOGOUT");
    }
    if (authUser?.sessionId) {
      await this.sessionService.revokeSessionById(authUser.sessionId, "USER_LOGOUT");
    }
  }

  async getProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: userId },
      include: USER_WITH_APPROVED_SCOPES_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesión no válida o usuario inactivo.");
    }

    return this.toUserProfile(user);
  }
}

