import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CustodyEventType, SignatureType } from "../../domain/document-lifecycle/document-lifecycle";

export class AssignDocumentParticipantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processParticipantId?: string;

  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ description: "Rol dentro de este documento (ej. COORDINADOR, CIRUJANO_RESCATE, TESTIGO)" })
  @IsString()
  signerRole!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSigner?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  signatureRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  signatureOrder?: number;
}

export class SignDocumentSnapshotDto {
  @ApiProperty()
  @IsString()
  participantId!: string;

  @ApiProperty({ enum: ["ATESTACION_USUARIO", "MANUSCRITA_PRESENCIAL", "DIBUJADA_UI", "DIGITAL_CERTIFICADA"] })
  @IsString()
  signatureType!: SignatureType;

  @ApiPropertyOptional()
  @IsOptional()
  evidenceData?: Record<string, unknown>;
}

export class CreateCustodyEventDto {
  @ApiProperty({ enum: ["RECOLECCION", "TRANSPORTE", "ENTREGA", "RECEPCION", "DISPOSICION"] })
  @IsString()
  eventType!: CustodyEventType;

  @ApiProperty()
  @IsString()
  itemDescription!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  containerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperatureCelsius?: number;

  @ApiProperty()
  @IsString()
  transferorName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferorInstitution?: string;

  @ApiProperty()
  @IsString()
  receiverName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiverInstitution?: string;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;

  @ApiProperty()
  @IsString()
  location!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  integrityVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}
