import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

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
  mappingConfig!: unknown[];

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
  sourceProvenance?: Array<Record<string, unknown>>;
}

export class SaveRevisionDto {
  @IsObject()
  responseData!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sourceProvenance?: Array<Record<string, unknown>>;
}
