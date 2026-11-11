import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./roles.guard";
import { SessionService } from "./session.service";
import { TokenService } from "./token.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>("JWT_SECRET").trim();
        if (!secret) {
          throw new Error("[CRITICAL] JWT_SECRET es obligatorio.");
        }
        return {
          secret,
          signOptions: {
            algorithm: "HS256",
            issuer: config.get<string>("JWT_ISSUER", "godt-backend").trim(),
            audience: config.get<string>("JWT_AUDIENCE", "godt-frontend").trim(),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    SessionService,
    AuthService,
    AuthRateLimitGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    PasswordService,
    TokenService,
    SessionService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
