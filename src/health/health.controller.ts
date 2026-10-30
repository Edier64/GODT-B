import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Verifica la disponibilidad de PostgreSQL y Redis" })
  @ApiResponse({ status: 200, description: "Dependencias disponibles" })
  check() {
    return this.healthService.check();
  }
}
