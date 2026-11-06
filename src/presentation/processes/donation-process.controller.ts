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
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { CreateDonationProcessUseCase } from "../../application/processes/create-donation-process.use-case";
import { GetDonationProcessUseCase } from "../../application/processes/get-donation-process.use-case";
import { ListDonationProcessesUseCase } from "../../application/processes/list-donation-processes.use-case";
import { UpdateDonationProcessUseCase } from "../../application/processes/update-donation-process.use-case";
import { AddProcessInstitutionUseCase } from "../../application/processes/add-institution.use-case";
import { AddProcessParticipantUseCase } from "../../application/processes/add-participant.use-case";
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
  ) {}

  @Post()
  @ApiOperation({ summary: "Apertura de proceso de donación" })
  async create(
    @Body() dto: CreateDonationProcessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.run(() => this.createProcess.execute(dto, user));
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

