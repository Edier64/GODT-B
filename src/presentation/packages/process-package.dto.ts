import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DocumentApplicability } from "../../domain/packages/process-package";

export const DocumentApplicabilityValues = [
  "APLICABLE",
  "NO_APLICA",
  "CONDICIONAL",
  "PENDIENTE_CRITERIO",
] as const;

export class UpdateDocumentApplicabilityDto {
  @ApiProperty({
    description: "Estado de aplicabilidad de la posición documental",
    enum: DocumentApplicabilityValues,
  })
  @IsIn(DocumentApplicabilityValues)
  applicabilityStatus!: DocumentApplicability;

  @ApiPropertyOptional({
    description: "Justificación clínica o legal de la no aplicabilidad (requerida cuando applicabilityStatus es NO_APLICA)",
  })
  @IsOptional()
  @IsString()
  nonApplicabilityReason?: string;
}

