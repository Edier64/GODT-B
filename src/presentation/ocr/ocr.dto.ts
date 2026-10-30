import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export enum OcrDecision {
  CONFIRMADO = "CONFIRMADO",
  MODIFICADO = "MODIFICADO",
  RECHAZADO = "RECHAZADO",
}

export class ValidateOcrFieldDto {
  @IsEnum(OcrDecision)
  status!: OcrDecision;

  @IsOptional()
  @IsString()
  @MinLength(1)
  confirmedValue?: string;
}

export class PropagateOcrFieldDto {
  @IsString()
  fieldId!: string;
}
