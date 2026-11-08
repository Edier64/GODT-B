import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import {
  CreateInstitutionInput,
  InstitutionService,
} from "../../application/institutions/institution.service";

@ApiTags("institutions")
@Controller("api/v1")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get("institutions/search")
  @ApiOperation({ summary: "Búsqueda con autocompletado, alias y coincidencias aproximadas de IPS" })
  async searchInstitutions(
    @Query("q") query: string = "",
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutionService.searchInstitutions(query, user);
  }

  @Post("institutions")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Creación controlada de nueva institución con verificación de duplicados" })
  async createInstitution(
    @Body() body: CreateInstitutionInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutionService.createInstitution(body, user);
  }

  @Post("institutions/:id/request-association")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Solicitud de asociación de usuario a una IPS existente" })
  async requestAssociation(
    @Param("id") institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutionService.requestAssociation(institutionId, user);
  }

  @Get("catalogs/clinical-services")
  @ApiOperation({ summary: "Autocompletado de servicios clínicos institucionales" })
  getClinicalServices(@Query("q") query: string = "") {
    return {
      items: this.institutionService.getClinicalServices(query),
    };
  }

  @Get("catalogs/professionals")
  @ApiOperation({ summary: "Autocompletado de profesionales y personal operativo" })
  async getProfessionals(@Query("q") query: string = "") {
    return {
      items: await this.institutionService.searchProfessionals(query),
    };
  }
}
