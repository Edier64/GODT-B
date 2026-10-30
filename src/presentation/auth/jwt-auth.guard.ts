import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { UserRole } from "@prisma/client";
import { AuthenticatedUser } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token is required");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        role?: UserRole;
      }>(authorization.slice("Bearer ".length));
      if (
        !payload.sub ||
        !payload.role ||
        !Object.values(UserRole).includes(payload.role)
      ) {
        throw new UnauthorizedException("JWT payload is invalid");
      }
      request.user = { userId: payload.sub, role: payload.role };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("JWT token is invalid");
    }
  }
}
