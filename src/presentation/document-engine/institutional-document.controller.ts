import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { InstitutionalDocumentService } from "../../application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../../application/pdf/pdf-render-engine.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

@ApiTags("document-templates")
@Controller("api/v1")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InstitutionalDocumentController {
  constructor(
    private readonly institutionalDocs: InstitutionalDocumentService,
    private readonly pdfRenderer: PdfRenderEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("document-templates/institutional-inventory")
  @ApiOperation({ summary: "Consultar inventario técnico completo de los 19 formatos oficiales y soportes clínicos" })
  getInventory() {
    return {
      totalTemplates: 19,
      complementaryDocuments: 4,
      items: this.institutionalDocs.listInstitutionalInventory(),
    };
  }

  @Get("document-templates/:code/original-metadata")
  @ApiOperation({ summary: "Consultar metadatos técnicos de un formato institucional original (páginas, hash, dimensiones)" })
  getOriginalMetadata(@Param("code") code: string) {
    return this.institutionalDocs.getOriginalMetadata(code);
  }

  @Get("document-templates/:code/original-file")
  @ApiOperation({ summary: "Visualizar o descargar el formato institucional original vacío en PDF" })
  getOriginalFile(
    @Param("code") code: string,
    @Query("download") download: string,
    @Res() res: Response,
  ) {
    const metadata = this.institutionalDocs.getOriginalMetadata(code);
    const buffer = this.institutionalDocs.getOriginalDocumentBuffer(code);

    const disposition = download === "true" ? "attachment" : "inline";
    res.setHeader("Content-Type", metadata.mimeType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${metadata.filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("ETag", `"${metadata.sha256Hash}"`);
    res.end(buffer);
  }

  @Get("document-instances/:id/preview-pdf")
  @ApiOperation({ summary: "Generar y visualizar en tiempo real el formato institucional diligenciado sobre el original" })
  async getPreviewPdf(
    @Param("id") instanceId: string,
    @Query("download") download: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: {
        donor: true,
        process: true,
        processDocument: true,
        templateVersion: true,
        currentRevision: true,
        documentParticipants: {
          include: {
            signatures: true,
          },
        },
        custodyEvents: {
          orderBy: { sequenceNumber: "asc" },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(`Instancia '${instanceId}' no encontrada.`);
    }

    const responseData = (instance.currentRevision?.responseData as Record<string, unknown>) || {};
    const revisionNumber = instance.currentRevision?.revisionNumber ?? 1;

    const pdfBuffer = await this.pdfRenderer.render({
      documentCode: instance.documentCode,
      title: instance.processDocument?.title || instance.documentCode,
      data: responseData,
      metadata: {
        processCode: instance.process?.processCode || "PROC-N/A",
        rndCode: instance.donor.rndCode,
        donorName: instance.donor.fullName,
        donorDocument: instance.donor.documentNumber,
        primaryIpsName: instance.process?.primaryIpsName || instance.donor.originatingIpsName,
        revisionNumber,
        templateVersion: instance.templateVersion.versionNumber,
        generatedAt: instance.currentRevision?.createdAt || new Date(),
        generatedByName: user.role,
        snapshotDigest: instance.currentRevisionId || undefined,
        signatures: instance.documentParticipants.map((p) => ({
          signerRole: p.signerRole,
          fullName: p.fullName,
          signatureType: "ATESTACION_USUARIO",
          status: p.status,
          signedAt: p.signatures?.[0]?.signedAt || undefined,
        })),
        custodyEvents: instance.custodyEvents.map((c) => ({
          sequenceNumber: c.sequenceNumber,
          eventType: c.eventType,
          itemDescription: c.itemDescription,
          containerCode: c.containerCode,
          sealNumber: c.sealNumber,
          temperatureCelsius: c.temperatureCelsius ? Number(c.temperatureCelsius) : null,
          transferorName: c.transferorName,
          transferorInstitution: c.transferorInstitution,
          receiverName: c.receiverName,
          receiverInstitution: c.receiverInstitution,
          occurredAt: c.occurredAt,
          location: c.location,
          integrityVerified: c.integrityVerified,
          observations: c.observations,
        })),
      },
    });

    const disposition = download === "true" ? "attachment" : "inline";
    const filename = `${instance.documentCode}_PROC-${instance.process?.processCode || "REV"}_v${revisionNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);
  }
}
