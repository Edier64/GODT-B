import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Express } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { CreateDonationProcessUseCase } from "../../application/processes/create-donation-process.use-case";
import { GetDonationProcessUseCase } from "../../application/processes/get-donation-process.use-case";
import { ListDonationProcessesUseCase } from "../../application/processes/list-donation-processes.use-case";
import { UpdateDonationProcessUseCase } from "../../application/processes/update-donation-process.use-case";
import { AddProcessInstitutionUseCase } from "../../application/processes/add-institution.use-case";
import { AddProcessParticipantUseCase } from "../../application/processes/add-participant.use-case";
import { GetDashboardSummaryUseCase } from "../../application/processes/get-dashboard-summary.use-case";
import { IntakeDonorFromClinicalHistoryUseCase } from "../../application/processes/intake-donor-from-clinical-history.use-case";
import {
  CreateDonationProcessDto,
  CreateProcessInstitutionDto,
  CreateProcessParticipantDto,
  ListDonationProcessesQueryDto,
  UpdateDonationProcessDto,
} from "./donation-process.dto";
import {
  DonationProcessAccessDeniedError,
  DonationProcessConflictError,
  DonationProcessNotFoundError,
  DonationProcessValidationError,
} from "../../domain/processes/donation-process";

@ApiTags("donation-processes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/donation-processes")
export class DonationProcessController {
  constructor(
    private readonly createProcess: CreateDonationProcessUseCase,
    private readonly getProcess: GetDonationProcessUseCase,
    private readonly listProcesses: ListDonationProcessesUseCase,
    private readonly updateProcess: UpdateDonationProcessUseCase,
    private readonly addInstitution: AddProcessInstitutionUseCase,
    private readonly addParticipant: AddProcessParticipantUseCase,
    private readonly getDashboardSummary: GetDashboardSummaryUseCase,
    private readonly intakeFromClinicalHistoryUseCase: IntakeDonorFromClinicalHistoryUseCase,
  ) {}

  @Post("intake-from-clinical-history")
  @ApiOperation({
    summary:
      "Crear proceso operativo desde historia clínica cargada por el usuario (OCR/IA)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "primaryIpsName"],
      properties: {
        file: { type: "string", format: "binary" },
        primaryIpsName: { type: "string" },
        notes: { type: "string" },
        processCode: { type: "string" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async intakeFromClinicalHistory(
    @UploadedFile() file: Express.Multer.File,
    @Body("primaryIpsName") primaryIpsName: string,
    @Body("notes") notes: string,
    @Body("processCode") processCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new HttpException(
        "Se requiere un archivo de historia clínica (PDF, DOCX, JPG, PNG, WEBP, TIFF o BMP)",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.run(() =>
      this.intakeFromClinicalHistoryUseCase.execute({
        primaryIpsName,
        notes,
        processCode,
        file: {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        actor: user,
      }),
    );
  }

  @Post()
  @ApiOperation({ summary: "Apertura de proceso de donación" })
  async create(
    @Body() dto: CreateDonationProcessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.createProcess.execute(dto, user));
  }

  @Get("dashboard/summary")
  @ApiOperation({ summary: "Obtener métricas agregadas del tablero de control" })
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.run(() => this.getDashboardSummary.execute(user));
  }

  @Get()
  @ApiOperation({ summary: "Listar procesos de donación con filtros" })
  async list(
    @Query() query: ListDonationProcessesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.listProcesses.execute(query, user));
  }

  @Get(":id")
  @ApiOperation({ summary: "Consultar proceso de donación por ID" })
  async get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.run(() => this.getProcess.execute(id, user));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar datos o estado del proceso de donación" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateDonationProcessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.updateProcess.execute(id, dto, user));
  }

  @Post(":id/institutions")
  @ApiOperation({ summary: "Asociar institución participante al proceso" })
  async addInst(
    @Param("id") id: string,
    @Body() dto: CreateProcessInstitutionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.addInstitution.execute(id, dto, user));
  }

  @Post(":id/participants")
  @ApiOperation({ summary: "Asociar participante al proceso" })
  async addPart(
    @Param("id") id: string,
    @Body() dto: CreateProcessParticipantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.addParticipant.execute(id, dto, user));
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof DonationProcessNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonationProcessAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      if (error instanceof DonationProcessValidationError) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (error instanceof DonationProcessConflictError) {
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

