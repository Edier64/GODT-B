import {
  Body,
  Controller,
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
import { CreateDonorUseCase } from "../../application/donors/create-donor.use-case";
import {
  DonorAccessDeniedError,
  DonorNotFoundError,
} from "../../application/donors/donor-errors";
import { GetDonorUseCase } from "../../application/donors/get-donor.use-case";
import { ListDonorsUseCase } from "../../application/donors/list-donors.use-case";
import { UpdateDonorUseCase } from "../../application/donors/update-donor.use-case";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  CreateDonorDto,
  ListDonorsQueryDto,
  UpdateDonorDto,
} from "./donor.dto";

@ApiTags("donors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/donors")
export class DonorsController {
  constructor(
    private readonly createDonor: CreateDonorUseCase,
    private readonly getDonor: GetDonorUseCase,
    private readonly listDonors: ListDonorsUseCase,
    private readonly updateDonor: UpdateDonorUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: "Crear expediente maestro" })
  create(@Body() dto: CreateDonorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createDonor
      .execute(dto, user.userId)
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          error.message.includes("Unique constraint")
        ) {
          throw new HttpException(
            "RND code already exists",
            HttpStatus.CONFLICT,
          );
        }
        throw error;
      });
  }

  @Get()
  @ApiOperation({ summary: "Listar expedientes maestros" })
  list(
    @Query() query: ListDonorsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listDonors.execute(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Consultar expediente maestro" })
  get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.getDonor.execute(id, user).catch((error: unknown) => {
      if (error instanceof DonorNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonorAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      throw error;
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar datos permitidos del expediente" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateDonorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateDonor.execute(id, dto, user).catch((error: unknown) => {
      if (error instanceof DonorNotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof DonorAccessDeniedError) {
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }
      throw error;
    });
  }
}
