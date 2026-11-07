import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import type { Express } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/auth.types";
import { GetSourceDocumentUseCase } from "../../application/documents/get-source-document.use-case";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
  DocumentValidationError,
  DuplicateDocumentError,
} from "../../application/documents/document-errors";
import { UploadSourceDocumentUseCase } from "../../application/documents/upload-source-document.use-case";

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1")
export class DocumentsController {
  constructor(
    private readonly upload: UploadSourceDocumentUseCase,
    private readonly documents: GetSourceDocumentUseCase,
  ) {}

  @Post("donors/:donorId/documents")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "documentCategory"],
      properties: {
        file: { type: "string", format: "binary" },
        documentCategory: { type: "string", example: "CERTIFICACION" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: "Cargar documento privado del expediente" })
  async create(
    @Param("donorId") donorId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("documentCategory") documentCategory: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    try {
      if (!file)
        throw new DocumentValidationError("A document file is required");
      return await this.upload.execute({
        donorId,
        uploadedById: actor.userId,
        originalFilename: file.originalname,
        declaredMimeType: file.mimetype,
        buffer: file.buffer,
        documentCategory,
        actor,
      });
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  @Post("processes/:processId/documents")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        documentCategory: { type: "string", example: "CLINICAL_SOURCE" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: "Cargar documento fuente al proceso de donación" })
  async createForProcess(
    @Param("processId") processId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("documentCategory") documentCategory: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    try {
      if (!file)
        throw new DocumentValidationError("A document file is required");
      return await this.upload.execute({
        processId,
        uploadedById: actor.userId,
        originalFilename: file.originalname,
        declaredMimeType: file.mimetype,
        buffer: file.buffer,
        documentCategory: documentCategory || "CLINICAL_SOURCE",
        actor,
      });
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  @Get("processes/:processId/documents")
  @ApiOperation({ summary: "Listar documentos fuente del proceso de donación" })
  listForProcess(
    @Param("processId") processId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documents.listByProcessId(processId, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Get("donors/:donorId/documents")
  list(
    @Param("donorId") donorId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documents.list(donorId, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Get("documents/:id")
  get(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.get(id, actor).catch((error: unknown) => {
      throw this.toHttp(error);
    });
  }

  @Get("documents/:id/download")
  async download(
    @Param("id") id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() response: Response,
  ) {
    try {
      const { document, buffer } = await this.documents.download(id, actor);
      response.setHeader("Content-Type", document.mimeType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.originalFilename.replace(/["\r\n]/g, "")}"`,
      );
      response.send(buffer);
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private toHttp(error: unknown): HttpException {
    if (error instanceof DocumentAccessDeniedError)
      return new HttpException("Document access denied", HttpStatus.FORBIDDEN);
    if (error instanceof DocumentNotFoundError)
      return new HttpException("Document not found", HttpStatus.NOT_FOUND);
    if (error instanceof DuplicateDocumentError)
      return new HttpException(error.message, HttpStatus.CONFLICT);
    if (error instanceof DocumentValidationError)
      return new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
    return error instanceof HttpException
      ? error
      : new HttpException(
          "Document operation failed",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
  }
}
