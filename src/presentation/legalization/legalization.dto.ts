import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RepresentativeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  relationshipToDonor!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatureStorageKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}

export class EvaluateLegalizationDto {
  @ApiProperty({ enum: ["PRESUNCION_LEGAL", "CONSENTIMIENTO_FAMILIAR"] })
  @IsIn(["PRESUNCION_LEGAL", "CONSENTIMIENTO_FAMILIAR"])
  mechanism!: "PRESUNCION_LEGAL" | "CONSENTIMIENTO_FAMILIAR";

  @ApiProperty()
  @IsBoolean()
  isAdult!: boolean;

  @ApiProperty()
  @IsBoolean()
  isColombian!: boolean;

  @ApiProperty()
  @IsBoolean()
  isResident!: boolean;

  @ApiProperty()
  @IsBoolean()
  oppositionRegistered!: boolean;

  @ApiProperty({ type: [RepresentativeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepresentativeDto)
  representatives!: RepresentativeDto[];
}
