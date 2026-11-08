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
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { StartOcrUseCase } from "../../application/ocr/start-ocr.use-case";
import { OcrWorkflowUseCase } from "../../application/ocr/ocr-workflow.use-case";
import {
  OcrAccessDeniedError,
  OcrConcurrencyError,
  OcrNotFoundError,
  OcrValidationError,
} from "../../application/ocr/ocr-errors";
import {
  BatchPropagateOcrFieldsDto,
  PropagateOcrFieldDto,
  ValidateOcrFieldDto,
} from "./ocr.dto";

@ApiTags("ocr")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class OcrController {
  constructor(
    private readonly start: StartOcrUseCase,
    private readonly workflow: OcrWorkflowUseCase,
  ) {}

  @Post("documents/:documentId/ocr")
  @ApiOperation({ summary: "Crear trabajo OCR asíncrono" })
  startJob(
    @Param("documentId") id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.start.execute(id, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Get("ocr/jobs/:jobId")
  getJob(@Param("jobId") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.workflow.getJob(id, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Get("ocr/jobs/:jobId/fields")
  fields(@Param("jobId") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.workflow.fields(id, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Patch("ocr/fields/:fieldId/validation")
  validate(
    @Param("fieldId") id: string,
    @Body()
    input: ValidateOcrFieldDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.workflow.validate(id, input, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Post("donors/:donorId/clinical-data/propagate")
  propagate(
    @Param("donorId") donorId: string,
    @Body() input: PropagateOcrFieldDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.workflow
      .propagate(donorId, input.fieldId, actor)
      .catch((error: unknown) => {
        throw this.toHttp(error);
      });
  }

  @Post("processes/:processId/ocr/propagate")
  @ApiOperation({ summary: "Propagar campo OCR validado a datos canónicos del proceso" })
  propagateToProcess(
    @Param("processId") processId: string,
    @Body() input: PropagateOcrFieldDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.workflow
      .propagateToProcess(processId, input.fieldId, actor)
      .catch((error: unknown) => {
        throw this.toHttp(error);
      });
  }

  @Post("processes/:processId/ocr/batch-propagate")
  @ApiOperation({
    summary:
      "Validar y propagar en bloque múltiples campos OCR a datos canónicos del proceso",
  })
  batchPropagateToProcess(
    @Param("processId") processId: string,
    @Body() input: BatchPropagateOcrFieldsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.workflow
      .batchPropagateToProcess(processId, input.items || [], actor)
      .catch((error: unknown) => {
        throw this.toHttp(error);
      });
  }

  private toHttp(error: unknown): HttpException {
    if (error instanceof OcrAccessDeniedError)
      return new HttpException("OCR access denied", HttpStatus.FORBIDDEN);
    if (error instanceof OcrNotFoundError)
      return new HttpException("OCR resource not found", HttpStatus.NOT_FOUND);
    if (error instanceof OcrValidationError)
      return new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
    if (error instanceof OcrConcurrencyError)
      return new HttpException(error.message, HttpStatus.CONFLICT);
    return error instanceof HttpException
      ? error
      : new HttpException(
          "OCR operation failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
  }
}
