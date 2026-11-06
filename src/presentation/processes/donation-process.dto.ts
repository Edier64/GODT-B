import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export const DonationProcessStatusValues = [
  "EN_VALORACION",
  "EN_CURSO",
  "COMPLETADO",
  "CANCELADO",
  "SUSPENDIDO",
] as const;

export const ProcessInstitutionRoleValues = [
  "IPS_GENERADORA",
  "IPS_EXTRACTORA",
  "BANCO_TEJIDOS",
  "IPS_TRASPLANTADORA",
  "INMLCF",
  "COORDINACION_REGIONAL",
  "OTRO",
] as const;

export const ProcessParticipantRoleValues = [
  "COORDINADOR_OPERATIVO",
  "MEDICO_CERTIFICADOR",
  "MEDICO_TRATANTE",
  "CIRUJANO_RESCATE",
  "TECNICO_TEJIDOS",
  "DEUDO_NOTIFICADO",
  "REPRESENTANTE_LEGAL",
  "TESTIGO",
  "CUSTODIO",
  "OTRO",
] as const;

export class CreateProcessInstitutionDto {
  @ApiProperty({ description: "Nombre de la institución" })
  @IsString()
  @IsNotEmpty()
  institutionName!: string;

  @ApiProperty({
    enum: ProcessInstitutionRoleValues,
    description: "Rol operativo de la institución",
  })
  @IsEnum(ProcessInstitutionRoleValues)
  role!: (typeof ProcessInstitutionRoleValues)[number];

  @ApiPropertyOptional({ description: "Notas adicionales" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProcessParticipantDto {
  @ApiProperty({ description: "Nombre completo de la persona" })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    enum: ProcessParticipantRoleValues,
    description: "Rol en el proceso de donación",
  })
  @IsEnum(ProcessParticipantRoleValues)
  role!: (typeof ProcessParticipantRoleValues)[number];

  @ApiPropertyOptional({ description: "Tipo de documento (CC, TI, CE...)" })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ description: "Número de documento de identidad" })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ description: "Registro médico o profesional" })
  @IsOptional()
  @IsString()
  professionalId?: string;

  @ApiPropertyOptional({ description: "Institución a la que pertenece" })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiPropertyOptional({ description: "Parentesco con el donante (si aplica)" })
  @IsOptional()
  @IsString()
  relationshipToDonor?: string;

  @ApiPropertyOptional({ description: "Teléfono de contacto" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: "Correo electrónico" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: "Notas" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "UUID de usuario de sistema si aplica" })
  @IsOptional()
  @IsUUID()
  systemUserId?: string;
}

export class CreateDonationProcessDto {
  @ApiProperty({ description: "UUID del donante asociado" })
  @IsUUID()
  @IsNotEmpty()
  donorId!: string;

  @ApiProperty({ description: "IPS principal donde se apertura el proceso" })
  @IsString()
  @IsNotEmpty()
  primaryIpsName!: string;

  @ApiPropertyOptional({
    description: "Código legible de operativo (opcional, generado automáticamente si se omite)",
  })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: "Observaciones de apertura" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateProcessInstitutionDto],
    description: "Instituciones participantes iniciales",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcessInstitutionDto)
  institutions?: CreateProcessInstitutionDto[];

  @ApiPropertyOptional({
    type: [CreateProcessParticipantDto],
    description: "Participantes iniciales",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcessParticipantDto)
  participants?: CreateProcessParticipantDto[];
}

export class UpdateDonationProcessDto {
  @ApiPropertyOptional({
    enum: DonationProcessStatusValues,
    description: "Estado del proceso",
  })
  @IsOptional()
  @IsEnum(DonationProcessStatusValues)
  status?: (typeof DonationProcessStatusValues)[number];

  @ApiPropertyOptional({ description: "IPS principal" })
  @IsOptional()
  @IsString()
  primaryIpsName?: string;

  @ApiPropertyOptional({ description: "Observaciones del proceso" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListDonationProcessesQueryDto {
  @ApiPropertyOptional({
    enum: DonationProcessStatusValues,
    description: "Filtrar por estado",
  })
  @IsOptional()
  @IsEnum(DonationProcessStatusValues)
  status?: (typeof DonationProcessStatusValues)[number];

  @ApiPropertyOptional({ description: "Filtrar por UUID de donante" })
  @IsOptional()
  @IsUUID()
  donorId?: string;

  @ApiPropertyOptional({ description: "Filtrar por nombre de IPS" })
  @IsOptional()
  @IsString()
  primaryIpsName?: string;

  @ApiPropertyOptional({ default: 1, description: "Número de página" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, description: "Registros por página" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 10;
}

