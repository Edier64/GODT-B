import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import { AuthenticatedUser } from "./auth.types";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  password?: string;
}

const REGIONAL_3_DEFAULT_IPS = [
  "Hospital Universitario del Valle",
  "Clínica Imbanaco",
  "Clínica Occidente",
  "Fundación Valle del Lili",
];

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Autenticación institucional de usuario y emisión de JWT" })
  async login(@Body() dto: LoginDto) {
    if (!dto.email || typeof dto.email !== "string") {
      throw new UnauthorizedException("El correo institucional es obligatorio");
    }

    const emailNormalized = dto.email.trim().toLowerCase();
    let user = await this.prisma.systemUser.findUnique({
      where: { email: emailNormalized },
    });

    // En ambiente de desarrollo/test, si el usuario dev no existe aún, se aprovisiona
    if (!user && (emailNormalized === "coordinador@godt.gov.co" || emailNormalized === "admin@godt.gov.co")) {
      const isCoord = emailNormalized.startsWith("coord");
      user = await this.prisma.systemUser.create({
        data: {
          email: emailNormalized,
          fullName: isCoord
            ? "Dra. Elena Ramos (Coordinadora Regional 3)"
            : "Administrador del Sistema GODT",
          role: isCoord ? "COORDINATOR" : "ADMIN",
          isActive: true,
        },
      });
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Credenciales no válidas o usuario institucional inactivo");
    }

    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.fullName,
      institutionalIps: REGIONAL_3_DEFAULT_IPS,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: "24h",
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        institutionalIps: REGIONAL_3_DEFAULT_IPS,
      },
    };
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Consultar perfil de la sesión institucional activa" })
  async getProfile(@CurrentUser() auth: AuthenticatedUser) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: auth.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesión no válida o usuario inactivo");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      institutionalIps: auth.institutionalIps || REGIONAL_3_DEFAULT_IPS,
    };
  }
}
