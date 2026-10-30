import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DocumentEngineService } from "../../application/document-engine/document-engine.service";
import {
  DocumentEngineAccessDeniedError,
  DocumentEngineNotFoundError,
  DocumentEngineValidationError,
} from "../../application/document-engine/document-engine.errors";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  CreateInstanceDto,
  CreateTemplateDto,
  CreateVersionDto,
  SaveRevisionDto,
  UpdateTemplateDto,
} from "./document-engine.dto";

@ApiTags("document-engine")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class DocumentEngineController {
  constructor(private readonly engine: DocumentEngineService) {}

  @Get("document-catalog")
  @ApiOperation({ summary: "Consultar catálogo documental" })
  listTemplates() {
    return this.engine.listTemplates();
  }

  @Post("document-catalog")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.createTemplate({ ...dto, actorUserId: user.userId }),
    );
  }

  @Patch("document-catalog/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  updateTemplate(
    @Param("id") id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.engine.updateTemplate(id, dto, user.userId));
  }

  @Post("document-catalog/:id/versions")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  createVersion(
    @Param("id") templateId: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.createVersion({
        ...dto,
        templateId,
        effectiveFrom: new Date(dto.effectiveFrom),
        actorUserId: user.userId,
      }),
    );
  }

  @Get("document-catalog/:id/versions")
  listVersions(@Param("id") templateId: string) {
    return this.engine.listVersions(templateId);
  }

  @Post("document-catalog/:id/versions/:versionId/validate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  validateVersion(
    @Param("versionId") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.engine.validateVersion(id, user.userId));
  }

  @Post("document-catalog/:id/versions/:versionId/publish")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  publishVersion(
    @Param("versionId") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.engine.publishVersion(id, user.userId));
  }

  @Post("donors/:donorId/document-instances")
  createInstance(
    @Param("donorId") donorId: string,
    @Body() dto: CreateInstanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.createInstance({
        ...dto,
        donorId,
        actorUserId: user.userId,
        institutionalIps:
          user.role === "ADMIN" ? undefined : user.institutionalIps,
      }),
    );
  }

  @Get("donors/:donorId/document-instances")
  listInstances(
    @Param("donorId") donorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.listInstances(
        donorId,
        user.userId,
        user.role === "ADMIN" ? undefined : user.institutionalIps,
      ),
    );
  }

  @Get("document-instances/:id")
  getInstance(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.run(() =>
      this.engine.getInstance(
        id,
        user.userId,
        user.role === "ADMIN" ? undefined : user.institutionalIps,
      ),
    );
  }

  @Patch("document-instances/:id")
  saveRevision(
    @Param("id") instanceId: string,
    @Body() dto: SaveRevisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.saveRevision({
        ...dto,
        instanceId,
        actorUserId: user.userId,
        institutionalIps:
          user.role === "ADMIN" ? undefined : user.institutionalIps,
      }),
    );
  }

  @Post("document-instances/:id/validate")
  validateInstance(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.engine.validateInstance(
        id,
        user.userId,
        user.role === "ADMIN" ? undefined : user.institutionalIps,
      ),
    );
  }

  private async run<T>(operation: () => Promise<T> | T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DocumentEngineNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DocumentEngineAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      if (error instanceof DocumentEngineValidationError) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw error;
    }
  }
}
