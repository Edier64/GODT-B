import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CanonicalSourceKind,
  ConflictResolutionStrategy,
} from "../../domain/canonical/canonical-dictionary";

export class ConflictResolutionDto {
  @ApiProperty({
    description: "Estrategia para resolver la divergencia",
    enum: ["ACCEPT_CANDIDATE", "KEEP_CURRENT", "MANUAL_OVERRIDE"],
  })
  @IsIn(["ACCEPT_CANDIDATE", "KEEP_CURRENT", "MANUAL_OVERRIDE"])
  strategy!: ConflictResolutionStrategy;

  @ApiPropertyOptional({
    description: "Justificación médica o legal de la resolución",
  })
  @IsOptional()
  @IsString()
  justification?: string;
}

export class ApplyCanonicalValueDto {
  @ApiProperty({
    description: "Clave del marcador canónico",
    example: "donor.clinical.blood_group",
  })
  @IsString()
  @IsNotEmpty()
  canonicalFieldKey!: string;

  @ApiProperty({
    description: "Valor a aplicar y propagar",
    example: "O",
  })
  @IsNotEmpty()
  value!: unknown;

  @ApiPropertyOptional({
    description: "Unidad de medida si aplica",
    example: "mg/dL",
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: "Contexto de la muestra o medición",
    example: "Gasometría de ingreso",
  })
  @IsOptional()
  @IsString()
  sampleContext?: string;

  @ApiPropertyOptional({
    description: "Fecha y hora efectiva del dato",
  })
  @IsOptional()
  @IsString()
  effectiveAt?: string;

  @ApiPropertyOptional({
    description: "Procedencia del valor",
    enum: [
      "MANUAL",
      "DONOR_RECORD",
      "PROCESS_CANONICAL",
      "OCR_CONFIRMED",
      "OCR_MODIFIED",
      "CALCULATED",
    ],
  })
  @IsOptional()
  @IsIn([
    "MANUAL",
    "DONOR_RECORD",
    "PROCESS_CANONICAL",
    "OCR_CONFIRMED",
    "OCR_MODIFIED",
    "CALCULATED",
  ])
  sourceKind?: CanonicalSourceKind;

  @ApiPropertyOptional({
    description: "Resolución explícita en caso de conflicto detectado",
    type: ConflictResolutionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConflictResolutionDto)
  conflictResolution?: ConflictResolutionDto;
}

export class ResolveCanonicalConflictDto {
  @ApiPropertyOptional({
    description: "Clave del marcador canónico si se envía en el cuerpo",
  })
  @IsOptional()
  @IsString()
  canonicalFieldKey?: string;

  @ApiProperty({
    description: "Estrategia seleccionada para resolver el conflicto",
    enum: ["ACCEPT_CANDIDATE", "KEEP_CURRENT", "MANUAL_OVERRIDE"],
  })
  @IsIn(["ACCEPT_CANDIDATE", "KEEP_CURRENT", "MANUAL_OVERRIDE"])
  strategy!: ConflictResolutionStrategy;

  @ApiPropertyOptional({
    description: "Valor manual rectificado si la estrategia es MANUAL_OVERRIDE",
  })
  @IsOptional()
  resolvedValue?: unknown;

  @ApiPropertyOptional({
    description: "Alias compatible para resolvedValue cuando el cliente envía manualValue",
  })
  @IsOptional()
  manualValue?: unknown;

  @ApiProperty({
    description: "Justificación obligatoria de la resolución",
    example: "Verificado telefónicamente con laboratorio central de la IPS",
  })
  @IsString()
  @IsNotEmpty()
  justification!: string;
}

