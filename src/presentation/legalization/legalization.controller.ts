import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { EvaluateLegalizationUseCase } from "../../application/legalization/evaluate-legalization.use-case";
import { LegalizationRequirementsError } from "../../domain/legalization/legalization";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { EvaluateLegalizationDto } from "./legalization.dto";

@ApiTags("legalization")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "COORDINATOR")
@Controller("api/v1/donors")
export class LegalizationController {
  constructor(
    private readonly evaluateLegalization: EvaluateLegalizationUseCase,
  ) {}

  @Post(":donorId/legalization")
  @ApiOperation({ summary: "Evaluar y registrar legalización" })
  create(
    @Param("donorId") donorId: string,
    @Body() dto: EvaluateLegalizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluateLegalization
      .execute(donorId, user.userId, {
        ...dto,
        representatives: dto.representatives.map((representative) => ({
          ...representative,
          signedAt: representative.signedAt
            ? new Date(representative.signedAt)
            : undefined,
        })),
      })
      .catch((error: unknown) => {
        if (error instanceof LegalizationRequirementsError) {
          throw new HttpException(
            error.message,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        throw error;
      });
  }
}
