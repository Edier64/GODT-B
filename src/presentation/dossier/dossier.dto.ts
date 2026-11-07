import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export const ExportTypeValues = ["FULL_ZIP", "CONSOLIDATED_PDF", "INDEX_ONLY"] as const;

export class RequestDossierExportDto {
  @ApiPropertyOptional({
    enum: ExportTypeValues,
    description: "Tipo de exportación requerida",
    default: "FULL_ZIP",
  })
  @IsOptional()
  @IsIn(ExportTypeValues)
  exportType?: (typeof ExportTypeValues)[number];

  @ApiPropertyOptional({
    description: "Indica si se incluyen documentos fuente autorizados en el paquete",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeSourceDocuments?: boolean;

  @ApiPropertyOptional({
    description: "Códigos de documentos específicos a incluir (si se omite, incluye todos los liberados)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedDocumentCodes?: string[];

  @ApiPropertyOptional({
    description: "Identificadores de documentos fuente específicos a incluir",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedSourceDocumentIds?: string[];
}
