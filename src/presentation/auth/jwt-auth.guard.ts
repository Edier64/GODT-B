import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthenticatedUser } from "./auth.types";
import { SessionService } from "./session.service";
import { TokenService } from "./token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const rawToken = authorization.slice("Bearer ".length).trim();
    if (!rawToken) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const claims = await this.tokenService.verifyAccessToken(rawToken);
    const activeUser = await this.sessionService.validateActiveSessionAndLoadUser(
      claims.sid,
      claims.sub,
    );

    request.user = activeUser;
    return true;
  }
}
