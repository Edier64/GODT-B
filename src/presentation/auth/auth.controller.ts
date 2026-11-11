import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Body,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CookieOptions, Request, Response } from "express";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthService } from "./auth.service";
import { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SessionClientMeta, SessionService } from "./session.service";
import { TokenService } from "./token.service";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly refreshCookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: "strict" | "lax";
  private readonly allowedOrigins: string[];
  private readonly trustProxy: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {
    this.refreshCookieName = this.config
      .get<string>("REFRESH_COOKIE_NAME", "godt_refresh_token")
      .trim();

    const nodeEnv = (this.config.get<string>("NODE_ENV") || "development").trim().toLowerCase();
    const isProductionOrStaging = nodeEnv === "production" || nodeEnv === "staging";
    const explicitSecure = (this.config.get<string>("AUTH_COOKIE_SECURE") || "")
      .trim()
      .toLowerCase();

    if (isProductionOrStaging) {
      if (explicitSecure === "false") {
        this.logger.warn(
          `AUTH_COOKIE_SECURE=false fue ignorado en entorno ${nodeEnv}; la cookie HttpOnly se forzará con flag Secure.`,
        );
      }
      this.cookieSecure = true;
    } else if (explicitSecure === "true") {
      this.cookieSecure = true;
    } else {
      this.cookieSecure = false;
    }

    this.trustProxy =
      (this.config.get<string>("TRUST_PROXY", "false") || "false").trim().toLowerCase() === "true";

    const rawSameSite = (this.config.get<string>("AUTH_COOKIE_SAMESITE", "strict") || "strict")
      .trim()
      .toLowerCase();
    this.cookieSameSite = rawSameSite === "lax" ? "lax" : "strict";

    const rawOrigins = this.config.get<string>("CORS_ORIGIN", "");
    this.allowedOrigins = rawOrigins
      ? rawOrigins
          .split(",")
          .map((o) => o.trim())
          .filter((o) => o && o !== "*")
      : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost"];
  }

  private buildCookieOptions(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: "/api/v1/auth",
      maxAge: maxAgeMs,
    };
  }

  private buildClearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: "/api/v1/auth",
    };
  }

  private extractClientMeta(req: Request): SessionClientMeta {
    const forwardedFor = this.trustProxy ? req.headers["x-forwarded-for"] : undefined;
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return {
      ipAddress: ipAddress || undefined,
      userAgent: typeof userAgent === "string" ? userAgent : undefined,
    };
  }

  private assertTrustedOriginForCookieEndpoint(req: Request): void {
    const originHeader = req.headers.origin;
    const refererHeader = req.headers.referer;

    const candidateOrigin =
      typeof originHeader === "string" && originHeader.trim()
        ? originHeader.trim()
        : typeof refererHeader === "string" && refererHeader.trim()
          ? (() => {
              try {
                return new URL(refererHeader).origin;
              } catch {
                return "";
              }
            })()
          : "";

    if (!candidateOrigin) {
      // Las llamadas sin Origin/Referer (ej. clientes servidor/curl/tests HTTP) no provienen de un navegador cross-site
      return;
    }

    if (candidateOrigin === "null") {
      throw new ForbiddenException("Origen nulo no autorizado para esta operación de sesión.");
    }

    const host = req.get("host");
    const sameOriginCandidates = host ? [`https://${host}`, `http://${host}`] : [];

    if (
      this.allowedOrigins.includes(candidateOrigin) ||
      sameOriginCandidates.includes(candidateOrigin)
    ) {
      return;
    }

    throw new ForbiddenException("Origen no autorizado para esta operación de sesión.");
  }

  private extractRefreshCookie(req: Request): string {
    const cookieVal = req.cookies?.[this.refreshCookieName];
    return typeof cookieVal === "string" ? cookieVal.trim() : "";
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: "Autenticación institucional con correo, contraseña y emisión de sesión JWT" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.extractClientMeta(req));

    res.cookie(
      this.refreshCookieName,
      result.rawRefreshToken,
      this.buildCookieOptions(this.sessionService.getRefreshTtlMs()),
    );

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: "Renovar sesión activa mediante refresh token en cookie HttpOnly" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOriginForCookieEndpoint(req);

    const rawRefreshToken = this.extractRefreshCookie(req);
    if (!rawRefreshToken) {
      res.clearCookie(this.refreshCookieName, this.buildClearCookieOptions());
      throw new UnauthorizedException("No existe una sesión activa para renovar.");
    }

    try {
      const result = await this.authService.refresh(
        rawRefreshToken,
        this.extractClientMeta(req),
      );

      res.cookie(
        this.refreshCookieName,
        result.rawRefreshToken,
        this.buildCookieOptions(this.sessionService.getRefreshTtlMs()),
      );

      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      };
    } catch (error) {
      res.clearCookie(this.refreshCookieName, this.buildClearCookieOptions());
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cerrar sesión institucional y revocar refresh token" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOriginForCookieEndpoint(req);

    const rawRefreshToken = this.extractRefreshCookie(req);
    let authUser: AuthenticatedUser | undefined;

    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      try {
        const claims = await this.tokenService.verifyAccessToken(
          authorization.slice("Bearer ".length).trim(),
        );
        authUser = {
          userId: claims.sub,
          role: "TECHNICIAN",
          sessionId: claims.sid,
        };
      } catch {
        // Ignorar si el access token ya expiró durante logout
      }
    }

    await this.authService.logout(rawRefreshToken, authUser);
    res.clearCookie(this.refreshCookieName, this.buildClearCookieOptions());

    return { success: true };
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Consultar perfil y ámbitos institucionales vigentes del usuario autenticado" })
  async getProfile(@CurrentUser() auth: AuthenticatedUser) {
    return this.authService.getProfile(auth.userId);
  }
}
