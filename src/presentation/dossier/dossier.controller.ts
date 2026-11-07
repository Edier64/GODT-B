import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { RequestDossierExportDto } from "./dossier.dto";
import { RequestDossierExportUseCase } from "../../application/dossier/request-dossier-export.use-case";
import { GetDossierExportUseCase } from "../../application/dossier/get-dossier-export.use-case";
import { ListDossierExportsUseCase } from "../../application/dossier/list-dossier-exports.use-case";
import { VerifyDossierIntegrityUseCase } from "../../application/dossier/verify-dossier-integrity.use-case";
import { FILE_STORAGE_PORT, FileStoragePort } from "../../application/documents/file-storage.port";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../../application/audit/audit-event.port";
import {
  DossierAccessDeniedError,
  DossierNotFoundError,
  DossierQueueUnavailableError,
  DossierValidationError,
} from "../../domain/dossier/dossier.types";

@ApiTags("Expediente Documental Consolidado")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/donation-processes/:processId/dossier")
export class DossierController {
  constructor(
    private readonly requestExportUseCase: RequestDossierExportUseCase,
    private readonly getExportUseCase: GetDossierExportUseCase,
    private readonly listExportsUseCase: ListDossierExportsUseCase,
    private readonly verifyIntegrityUseCase: VerifyDossierIntegrityUseCase,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  @Post("exports")
  @ApiOperation({ summary: "Solicitar la consolidación y exportación del expediente documental" })
  async requestExport(
    @Param("processId") processId: string,
    @Body() dto: RequestDossierExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.requestExportUseCase.execute({
        processId,
        user,
        exportType: dto.exportType,
        includeSourceDocuments: dto.includeSourceDocuments,
        selectedDocumentCodes: dto.selectedDocumentCodes,
        selectedSourceDocumentIds: dto.selectedSourceDocumentIds,
      }),
    );
  }

  @Get("exports")
  @ApiOperation({ summary: "Consultar el historial de exportaciones del expediente" })
  async listExports(
    @Param("processId") processId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() => this.listExportsUseCase.execute(processId, user));
  }

  @Get("exports/:exportId")
  @ApiOperation({ summary: "Consultar el estado y metadatos de una exportación específica" })
  async getExport(
    @Param("exportId") exportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() => this.getExportUseCase.execute(exportId, user));
  }

  @Get("exports/:exportId/download")
  @ApiOperation({ summary: "Descargar el paquete completo del expediente en archivo ZIP" })
  async downloadZip(
    @Param("processId") processId: string,
    @Param("exportId") exportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    try {
      const record = await this.getExportUseCase.execute(exportId, user);

      if (record.status !== "COMPLETED" || !record.zipStorageKey) {
        throw new HttpException(
          "El archivo ZIP del expediente aún no se encuentra disponible o no ha finalizado su procesamiento",
          HttpStatus.BAD_REQUEST,
        );
      }

      const buffer = await this.storage.get(record.zipStorageKey);
      const filename = `GODT_EXPEDIENTE_${record.process.processCode}.zip`;

      await this.audit.record({
        actorUserId: user.userId,
        action: "DOSSIER_DOWNLOADED",
        entityType: "PROCESS_DOSSIER_EXPORT",
        entityId: exportId,
        correlationId: processId,
        metadata: {
          downloadType: "FULL_ZIP",
          filename,
          sizeBytes: buffer.length,
          sha256: record.zipSha256,
        },
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      if (record.zipSha256) {
        res.setHeader("ETag", `"${record.zipSha256}"`);
      }
      res.send(buffer);
    } catch (err) {
      this.translateError(err);
    }
  }

  @Get("exports/:exportId/consolidated-pdf")
  @ApiOperation({ summary: "Visualizar o descargar el PDF unificado de consulta continua" })
  async downloadConsolidatedPdf(
    @Param("processId") processId: string,
    @Param("exportId") exportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    try {
      const record = await this.getExportUseCase.execute(exportId, user);

      if (!record.consolidatedPdfStorageKey) {
        throw new HttpException(
          "El PDF consolidado no se encuentra disponible para esta exportación",
          HttpStatus.NOT_FOUND,
        );
      }

      const buffer = await this.storage.get(record.consolidatedPdfStorageKey);
      const filename = `expediente_consolidado_${record.process.processCode}.pdf`;

      await this.audit.record({
        actorUserId: user.userId,
        action: "DOSSIER_DOWNLOADED",
        entityType: "PROCESS_DOSSIER_EXPORT",
        entityId: exportId,
        correlationId: processId,
        metadata: {
          downloadType: "CONSOLIDATED_PDF",
          filename,
          sizeBytes: buffer.length,
          sha256: record.consolidatedPdfSha256,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      if (record.consolidatedPdfSha256) {
        res.setHeader("ETag", `"${record.consolidatedPdfSha256}"`);
      }
      res.send(buffer);
    } catch (err) {
      this.translateError(err);
    }
  }

  @Get("exports/:exportId/manifest")
  @ApiOperation({ summary: "Obtener el manifiesto criptográfico de integridad en formato JSON" })
  async getManifest(
    @Param("exportId") exportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(async () => {
      const record = await this.getExportUseCase.execute(exportId, user);
      if (!record.manifestData) {
        throw new HttpException("El manifiesto aún no ha sido generado", HttpStatus.NOT_FOUND);
      }
      return record.manifestData;
    });
  }

  @Post("exports/:exportId/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verificar la integridad criptográfica de todos los elementos del expediente" })
  async verifyIntegrity(
    @Param("exportId") exportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() => this.verifyIntegrityUseCase.execute(exportId, user));
  }

  private async handleErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.translateError(err);
    }
  }

  private translateError(err: unknown): never {
    if (err instanceof HttpException) {
      throw err;
    }
    if (err instanceof DossierNotFoundError) {
      throw new HttpException(err.message, HttpStatus.NOT_FOUND);
    }
    if (err instanceof DossierAccessDeniedError) {
      throw new HttpException(err.message, HttpStatus.FORBIDDEN);
    }
    if (err instanceof DossierValidationError) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
    if (err instanceof DossierQueueUnavailableError) {
      throw new HttpException(err.message, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const msg = (err as any)?.message || "Error interno del servidor en módulo de expediente";
    throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
