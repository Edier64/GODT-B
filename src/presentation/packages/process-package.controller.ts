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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { ListProcessDocumentsUseCase } from "../../application/packages/list-process-documents.use-case";
import { UpdateDocumentApplicabilityUseCase } from "../../application/packages/update-document-applicability.use-case";
import { InitiateProcessDocumentUseCase } from "../../application/packages/initiate-process-document.use-case";
import { EvaluateDocumentDependenciesUseCase } from "../../application/packages/evaluate-document-dependencies.use-case";
import { UpdateDocumentApplicabilityDto } from "./process-package.dto";
import {
  ProcessDocumentConflictError,
  ProcessDocumentNotFoundError,
  ProcessPackageNotFoundError,
  ProcessPackageValidationError,
} from "../../domain/packages/process-package";
import {
  DonationProcessAccessDeniedError,
  DonationProcessConflictError,
  DonationProcessNotFoundError,
  DonationProcessValidationError,
} from "../../domain/processes/donation-process";
import { PROCESS_PACKAGE_REPOSITORY, ProcessPackageRepository } from "../../application/packages/process-package.repository";
import { Inject } from "@nestjs/common";

@ApiTags("process-packages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class ProcessPackageController {
  constructor(
    private readonly listDocuments: ListProcessDocumentsUseCase,
    private readonly updateApplicability: UpdateDocumentApplicabilityUseCase,
    private readonly initiateDocument: InitiateProcessDocumentUseCase,
    private readonly evaluateDependencies: EvaluateDocumentDependenciesUseCase,
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository: ProcessPackageRepository,
  ) {}

  @Get("process-packages/active")
  @ApiOperation({ summary: "Consultar paquete documental activo y su versión oficial" })
  async getActivePackage() {
    return this.run(async () => {
      const activePackage = await this.packageRepository.findActivePackage();
      if (!activePackage) {
        throw new ProcessPackageNotFoundError("No se encontró paquete documental activo");
      }
      return activePackage;
    });
  }

  @Get("donation-processes/:processId/documents")
  @ApiOperation({ summary: "Listar las 23 posiciones documentales de un proceso con métricas de avance" })
  async listDocumentsForProcess(
    @Param("processId") processId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.listDocuments.execute(processId, user));
  }

  @Patch("donation-processes/:processId/documents/:documentId/applicability")
  @ApiOperation({ summary: "Modificar aplicabilidad de una posición documental (requiere justificación si NO_APLICA)" })
  async updateDocumentApplicability(
    @Param("processId") _processId: string,
    @Param("documentId") documentId: string,
    @Body() dto: UpdateDocumentApplicabilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.updateApplicability.execute(documentId, dto, user));
  }

  @Post("donation-processes/:processId/documents/:documentId/initiate")
  @ApiOperation({ summary: "Iniciar instancia de diligenciamiento para una posición documental" })
  async initiateProcessDocument(
    @Param("processId") _processId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.initiateDocument.execute(documentId, user));
  }

  @Get("donation-processes/:processId/documents/:documentId/dependencies")
  @ApiOperation({ summary: "Evaluar dependencias declarativas de una posición documental" })
  async evaluateDocumentDependencies(
    @Param("processId") _processId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.evaluateDependencies.execute(documentId, user));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof ProcessPackageNotFoundError ||
        error instanceof ProcessDocumentNotFoundError ||
        error instanceof DonationProcessNotFoundError
      ) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonationProcessAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      if (
        error instanceof ProcessPackageValidationError ||
        error instanceof DonationProcessValidationError
      ) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (
        error instanceof ProcessDocumentConflictError ||
        error instanceof DonationProcessConflictError
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

