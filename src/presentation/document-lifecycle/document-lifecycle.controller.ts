import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
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
import { ValidateDocumentInstanceUseCase } from "../../application/document-lifecycle/validate-document-instance.use-case";
import { CompleteDocumentInstanceUseCase } from "../../application/document-lifecycle/complete-document-instance.use-case";
import { GenerateDocumentSnapshotUseCase } from "../../application/document-lifecycle/generate-document-snapshot.use-case";
import { ManageDocumentParticipantsUseCase } from "../../application/document-lifecycle/manage-document-participants.use-case";
import { SignDocumentSnapshotUseCase } from "../../application/document-lifecycle/sign-document-snapshot.use-case";
import { ReleaseDocumentInstanceUseCase } from "../../application/document-lifecycle/release-document-instance.use-case";
import { ManageCustodyEventsUseCase } from "../../application/document-lifecycle/manage-custody-events.use-case";
import { GetDocumentSnapshotUseCase } from "../../application/document-lifecycle/get-document-snapshot.use-case";
import {
  AssignDocumentParticipantDto,
  CreateCustodyEventDto,
  SignDocumentSnapshotDto,
} from "./document-lifecycle.dto";
import {
  CustodySequenceError,
  DocumentLockedError,
  DocumentParticipantNotFoundError,
  InvalidLifecycleTransitionError,
  MissingRequiredSignaturesError,
  SnapshotIntegrityError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@ApiTags("document-lifecycle")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class DocumentLifecycleController {
  constructor(
    private readonly validateUseCase: ValidateDocumentInstanceUseCase,
    private readonly completeUseCase: CompleteDocumentInstanceUseCase,
    private readonly snapshotUseCase: GenerateDocumentSnapshotUseCase,
    private readonly participantsUseCase: ManageDocumentParticipantsUseCase,
    private readonly signUseCase: SignDocumentSnapshotUseCase,
    private readonly releaseUseCase: ReleaseDocumentInstanceUseCase,
    private readonly custodyUseCase: ManageCustodyEventsUseCase,
    private readonly getSnapshotUseCase: GetDocumentSnapshotUseCase,
  ) {}

  @Post("document-instances/:id/validate-lifecycle")
  @ApiOperation({ summary: "Validar estructura del documento y avanzar a VALIDADO" })
  async validate(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.validateUseCase.execute({ instanceId: id, user }),
    );
  }

  @Post("document-instances/:id/complete")
  @ApiOperation({ summary: "Completar formalmente el diligenciamiento documental" })
  async complete(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.completeUseCase.execute({ instanceId: id, user }),
    );
  }

  @Post("document-instances/:id/generate-snapshot")
  @ApiOperation({ summary: "Generar snapshot inmutable y representación PDF oficial" })
  async generateSnapshot(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(async () => {
      const res = await this.snapshotUseCase.execute({ instanceId: id, user });
      return {
        snapshot: res.generatedPdf,
        sha256Hash: res.sha256Hash,
        resultingStatus: res.resultingStatus,
      };
    });
  }

  @Post("document-instances/:id/release")
  @ApiOperation({ summary: "Liberar y cerrar el documento en el expediente" })
  async release(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.releaseUseCase.execute({ instanceId: id, user }),
    );
  }

  // --- Participantes Documentales ---
  @Get("document-instances/:id/participants")
  @ApiOperation({ summary: "Listar participantes asignados a este documento" })
  async listParticipants(@Param("id") id: string) {
    return this.handleErrors(() => this.participantsUseCase.list(id));
  }

  @Post("document-instances/:id/participants")
  @ApiOperation({ summary: "Asignar participante / firmante a este documento" })
  async assignParticipant(
    @Param("id") id: string,
    @Body() dto: AssignDocumentParticipantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.participantsUseCase.assign({
        instanceId: id,
        ...dto,
        user,
      }),
    );
  }

  @Delete("document-instances/:id/participants/:participantId")
  @ApiOperation({ summary: "Eliminar participante asignado a este documento" })
  async removeParticipant(
    @Param("participantId") participantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.participantsUseCase.remove(participantId, user),
    );
  }

  // --- Firmas y Atestaciones ---
  @Post("document-instances/:id/snapshots/:snapshotId/sign")
  @ApiOperation({ summary: "Registrar firma o atestación sobre un snapshot inmutable" })
  async sign(
    @Param("id") id: string,
    @Param("snapshotId") snapshotId: string,
    @Body() dto: SignDocumentSnapshotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.signUseCase.execute({
        instanceId: id,
        snapshotId,
        participantId: dto.participantId,
        signatureType: dto.signatureType,
        evidenceData: dto.evidenceData,
        user,
      }),
    );
  }

  // --- Snapshots y Descarga de PDF ---
  @Get("document-instances/:id/snapshots")
  @ApiOperation({ summary: "Listar versiones de snapshots generados para una instancia" })
  async listSnapshots(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.getSnapshotUseCase.listSnapshots(id, user),
    );
  }

  @Get("document-snapshots/:snapshotId")
  @ApiOperation({ summary: "Obtener detalle y metadata de un snapshot específico" })
  async getSnapshot(
    @Param("snapshotId") snapshotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.getSnapshotUseCase.getSnapshot(snapshotId, user),
    );
  }

  @Get("document-snapshots/:snapshotId/download")
  @ApiOperation({ summary: "Descarga autenticada del archivo PDF oficial" })
  async downloadPdf(
    @Param("snapshotId") snapshotId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    try {
      const file = await this.getSnapshotUseCase.downloadPdf(snapshotId, user);
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
      res.setHeader("X-Document-SHA256", file.sha256Hash);
      res.send(file.buffer);
    } catch (error) {
      if (error instanceof DonationProcessNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonationProcessAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      throw error;
    }
  }

  // --- Cadena de Custodia (Anexo 8) ---
  @Get("document-instances/:id/custody-events")
  @ApiOperation({ summary: "Consultar secuencia histórica de eventos de custodia" })
  async listCustodyEvents(@Param("id") id: string) {
    return this.handleErrors(() => this.custodyUseCase.list(id));
  }

  @Post("document-instances/:id/custody-events")
  @ApiOperation({ summary: "Registrar nuevo evento secuencial de cadena de custodia" })
  async appendCustodyEvent(
    @Param("id") id: string,
    @Body() dto: CreateCustodyEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleErrors(() =>
      this.custodyUseCase.append({
        instanceId: id,
        ...dto,
        occurredAt: new Date(dto.occurredAt),
        user,
      }),
    );
  }

  private async handleErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DonationProcessNotFoundError || error instanceof DocumentParticipantNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonationProcessAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      if (
        error instanceof InvalidLifecycleTransitionError ||
        error instanceof DocumentLockedError ||
        error instanceof MissingRequiredSignaturesError ||
        error instanceof SnapshotIntegrityError ||
        error instanceof CustodySequenceError
      ) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw error;
    }
  }
}
