import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { ListCanonicalCatalogUseCase } from "../../application/canonical/list-canonical-catalog.use-case";
import { GetProcessCanonicalValuesUseCase } from "../../application/canonical/get-process-canonical-values.use-case";
import { ApplyCanonicalValueUseCase } from "../../application/canonical/apply-canonical-value.use-case";
import { ResolveCanonicalConflictUseCase } from "../../application/canonical/resolve-canonical-conflict.use-case";
import {
  ApplyCanonicalValueDto,
  ResolveCanonicalConflictDto,
} from "./canonical-dictionary.dto";
import {
  CanonicalConcurrencyError,
  CanonicalConflictError,
  CanonicalFieldNotFoundError,
  CanonicalValidationError,
} from "../../domain/canonical/canonical-dictionary";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import {
  ProcessDocumentConflictError,
  ProcessDocumentNotFoundError,
} from "../../domain/packages/process-package";

@ApiTags("canonical-dictionary")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class CanonicalDictionaryController {
  constructor(
    private readonly listCatalog: ListCanonicalCatalogUseCase,
    private readonly getProcessValues: GetProcessCanonicalValuesUseCase,
    private readonly applyCanonicalValue: ApplyCanonicalValueUseCase,
    private readonly resolveConflict: ResolveCanonicalConflictUseCase,
  ) {}

  @Get("canonical-fields/catalog")
  @ApiOperation({ summary: "Consultar catálogo maestro de marcadores canónicos homologados" })
  async getCatalog() {
    return this.run(() => this.listCatalog.execute());
  }

  @Get("donation-processes/:id/canonical-values")
  @ApiOperation({ summary: "Consultar todos los valores canónicos vigentes de un proceso" })
  async listValues(
    @Param("id") processId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.getProcessValues.listValues(processId, user));
  }

  @Get("donation-processes/:id/canonical-values/:fieldKey")
  @ApiOperation({ summary: "Consultar un valor canónico específico por clave" })
  async getValue(
    @Param("id") processId: string,
    @Param("fieldKey") fieldKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.getProcessValues.getValue(processId, fieldKey, user));
  }

  @Get("donation-processes/:id/canonical-values/:fieldKey/history")
  @ApiOperation({ summary: "Consultar historial de revisiones y mediciones repetibles de un marcador" })
  async getHistory(
    @Param("id") processId: string,
    @Param("fieldKey") fieldKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.getProcessValues.getHistory(processId, fieldKey, user));
  }

  @Get("donation-processes/:id/canonical-values/:fieldKey/observations")
  @ApiOperation({ summary: "Consultar serie temporal de observaciones clínicas repetibles (pH, creatinina)" })
  async getObservations(
    @Param("id") processId: string,
    @Param("fieldKey") fieldKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.getProcessValues.getObservations(processId, fieldKey, user));
  }

  @Get("donation-processes/:id/canonical-values/:fieldKey/conflicts")
  @ApiOperation({ summary: "Consultar conflictos activos de valores canónicos en el proceso" })
  async getConflicts(
    @Param("id") processId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.getProcessValues.getConflicts(processId, user));
  }

  @Post("document-instances/:id/canonical-values")
  @ApiOperation({ summary: "Ingresar o actualizar un valor canónico desde una instancia y propagar a compatibles" })
  async applyFromInstance(
    @Param("id") instanceId: string,
    @Body() dto: ApplyCanonicalValueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.applyCanonicalValue.executeFromInstance({
        instanceId,
        canonicalFieldKey: dto.canonicalFieldKey,
        value: dto.value,
        unit: dto.unit,
        sampleContext: dto.sampleContext,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
        sourceKind: dto.sourceKind,
        conflictResolution: dto.conflictResolution,
        user,
      }),
    );
  }

  @Post("donation-processes/:id/canonical-values")
  @ApiOperation({ summary: "Ingresar o actualizar un valor canónico directamente a nivel de proceso" })
  async applyDirect(
    @Param("id") processId: string,
    @Body() dto: ApplyCanonicalValueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() =>
      this.applyCanonicalValue.executeDirect({
        processId,
        canonicalFieldKey: dto.canonicalFieldKey,
        value: dto.value,
        unit: dto.unit,
        sampleContext: dto.sampleContext,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
        sourceKind: dto.sourceKind,
        conflictResolution: dto.conflictResolution,
        user,
      }),
    );
  }

  @Post([
    "donation-processes/:id/canonical-values/:fieldKey/resolve-conflict",
    "donation-processes/:id/canonical-values/resolve-conflict",
  ])
  @ApiOperation({ summary: "Resolver un conflicto de valor canónico con justificación auditada" })
  async resolve(
    @Param("id") processId: string,
    @Param("fieldKey") paramFieldKey: string | undefined,
    @Body() dto: ResolveCanonicalConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const key = paramFieldKey || dto.canonicalFieldKey;
    if (!key) {
      throw new HttpException(
        "Debe proporcionar canonicalFieldKey en la URL o en el cuerpo de la solicitud",
        HttpStatus.BAD_REQUEST,
      );
    }
    const resolvedValue =
      dto.resolvedValue !== undefined ? dto.resolvedValue : dto.manualValue;
    return this.run(() =>
      this.resolveConflict.execute({
        processId,
        canonicalFieldKey: key,
        strategy: dto.strategy,
        resolvedValue,
        justification: dto.justification,
        user,
      }),
    );
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof CanonicalFieldNotFoundError ||
        error instanceof DonationProcessNotFoundError ||
        error instanceof ProcessDocumentNotFoundError
      ) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonationProcessAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      if (error instanceof CanonicalValidationError) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (
        error instanceof CanonicalConflictError ||
        error instanceof CanonicalConcurrencyError ||
        error instanceof ProcessDocumentConflictError
      ) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : "Error interno del servidor",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

