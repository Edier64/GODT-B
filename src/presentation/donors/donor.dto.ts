import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const donorStatuses = ["EN_VALORACION", "ACTIVO", "CERRADO"] as const;

export class CreateDonorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  rndCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  originatingIpsName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clinicalService!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentNumber!: string;

  @ApiPropertyOptional({ enum: donorStatuses })
  @IsOptional()
  @IsIn(donorStatuses)
  status?: (typeof donorStatuses)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  anthropometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rhFactor?: string;
}

export class UpdateDonorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  originatingIpsName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clinicalService?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentNumber?: string;

  @ApiPropertyOptional({ enum: donorStatuses })
  @IsOptional()
  @IsIn(donorStatuses)
  status?: (typeof donorStatuses)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  anthropometry?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rhFactor?: string;
}

export class ListDonorsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  rndCode?: string;

  @ApiPropertyOptional({ enum: donorStatuses })
  @IsOptional()
  @IsIn(donorStatuses)
  status?: (typeof donorStatuses)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
