import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class MappingConfigDto {
  @IsString()
  targetKey!: string;

  @IsString()
  sourcePath!: string;

  @IsString()
  sourceKind!: string;

  @IsString()
  dataType!: string;

  @IsOptional()
  writable?: boolean;
}

export class SourceProvenanceDto {
  @IsString()
  fieldPath!: string;

  @IsString()
  sourceKind!: string;

  @IsOptional()
  @IsString()
  canonicalFieldKey?: string;

  @IsOptional()
  @IsUUID()
  sourceEntityId?: string;

  @IsOptional()
  @IsUUID()
  sourceDocumentId?: string;

  @IsOptional()
  @IsUUID()
  ocrFieldId?: string;

  @IsOptional()
  @IsString()
  conflictStatus?: string;

  @IsOptional()
  @IsObject()
  conflictDetails?: Record<string, unknown>;

  @IsOptional()
  sourceValue?: unknown;
}

export class CreateTemplateDto {
  @IsString()
  templateCode!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateVersionDto {
  @IsString()
  versionNumber!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsObject()
  jsonSchema!: Record<string, unknown>;

  @IsObject()
  uiSchema!: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingConfigDto)
  mappingConfig!: MappingConfigDto[];

  @IsOptional()
  dependencyConfig?: unknown;

  @IsOptional()
  @IsObject()
  generationConfig?: Record<string, unknown>;
}

export class CreateInstanceDto {
  @IsUUID()
  templateVersionId!: string;

  @IsObject()
  responseData!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceProvenanceDto)
  sourceProvenance?: SourceProvenanceDto[];
}

export class SaveRevisionDto {
  @IsObject()
  responseData!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceProvenanceDto)
  sourceProvenance?: SourceProvenanceDto[];
}

export class ResolveConflictDto {
  @IsString()
  fieldPath!: string;

  @IsString()
  decision!: string;

  @IsString()
  justification!: string;
}
