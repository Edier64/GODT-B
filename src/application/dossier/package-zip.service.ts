import { Inject, Injectable } from "@nestjs/common";
import archiver from "archiver";
import { createHash } from "crypto";
import { Writable } from "stream";
import { DossierManifest } from "../../domain/dossier/dossier.types";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";

export interface PackageZipInput {
  manifest: DossierManifest;
  indexPdfBuffer: Buffer;
  indexJsonSummary: Record<string, unknown>;
  consolidatedPdfBuffer?: Buffer | null;
  evidenciasAtestacionesJson: Record<string, unknown>;
  releasedPdfs: Array<{
    documentCode: string;
    positionNumber: number;
    filename: string;
    buffer: Buffer;
  }>;
  custodyFiles?: Array<{
    filename: string;
    buffer: Buffer;
  }>;
  sourceDocuments?: Array<{
    filename: string;
    category: string;
    buffer: Buffer;
  }>;
  readmeBuffer?: Buffer;
}

export interface PackageZipResult {
  zipBuffer: Buffer;
  sha256Hash: string;
  packageChecksumSha256: string;
  sizeBytes: number;
  storageKey: string;
  fileName: string;
}

@Injectable()
export class PackageZipService {
  constructor(
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
  ) {}

  async createPackage(input: PackageZipInput): Promise<PackageZipResult> {
    const rootFolder = `GODT_EXPEDIENTE_${input.manifest.processCode}`;
    const archive = (archiver as any)("zip", { zlib: { level: 9 } });

    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });

    archive.pipe(stream);

    // Fecha fija normalizada para garantizar reproducibilidad binaria de empaquetado
    const normalizedDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    const entryOptions = (name: string) => ({
      name,
      date: normalizedDate,
      mode: 0o644,
    });

    // 1. Carpeta 00_INDICE
    archive.append(
      input.indexPdfBuffer,
      entryOptions(`${rootFolder}/00_INDICE/indice_expediente.pdf`),
    );
    archive.append(
      Buffer.from(JSON.stringify(input.indexJsonSummary, null, 2), "utf-8"),
      entryOptions(`${rootFolder}/00_INDICE/resumen_expediente.json`),
    );

    // 2. Carpeta 01_DOCUMENTOS_LIBERADOS (Documentos originales sin alteración de bytes)
    const sortedReleased = [...input.releasedPdfs].sort((a, b) =>
      a.positionNumber !== b.positionNumber
        ? a.positionNumber - b.positionNumber
        : a.filename.localeCompare(b.filename),
    );

    for (const doc of sortedReleased) {
      archive.append(
        doc.buffer,
        entryOptions(`${rootFolder}/01_DOCUMENTOS_LIBERADOS/${doc.filename}`),
      );
    }

    // 3. Carpeta 02_DOCUMENTO_CONSOLIDADO
    if (input.consolidatedPdfBuffer) {
      archive.append(
        input.consolidatedPdfBuffer,
        entryOptions(`${rootFolder}/02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf`),
      );
    }

    // 4. Carpeta 03_EVIDENCIAS
    archive.append(
      Buffer.from(JSON.stringify(input.manifest, null, 2), "utf-8"),
      entryOptions(`${rootFolder}/03_EVIDENCIAS/manifiesto_integridad.json`),
    );
    archive.append(
      Buffer.from(JSON.stringify(input.evidenciasAtestacionesJson, null, 2), "utf-8"),
      entryOptions(`${rootFolder}/03_EVIDENCIAS/evidencias_atestaciones.json`),
    );

    // 5. Carpeta 04_CADENA_CUSTODIA (Eventos y referencias; sin duplicación de binarios)
    if (input.custodyFiles && input.custodyFiles.length > 0) {
      const sortedCustody = [...input.custodyFiles].sort((a, b) =>
        a.filename.localeCompare(b.filename),
      );
      for (const cf of sortedCustody) {
        archive.append(
          cf.buffer,
          entryOptions(`${rootFolder}/04_CADENA_CUSTODIA/${cf.filename}`),
        );
      }
    }

    // 6. Carpeta 05_FUENTES_COMPLEMENTARIAS (si fueron seleccionadas y autorizadas)
    if (input.sourceDocuments && input.sourceDocuments.length > 0) {
      const sortedSources = [...input.sourceDocuments].sort((a, b) =>
        a.filename.localeCompare(b.filename),
      );
      for (const src of sortedSources) {
        archive.append(
          src.buffer,
          entryOptions(`${rootFolder}/05_FUENTES_COMPLEMENTARIAS/${src.category}/${src.filename}`),
        );
      }
    }

    // 7. README.txt institucional
    const readmeBuf =
      input.readmeBuffer || Buffer.from(this.buildReadme(input.manifest), "utf-8");
    archive.append(
      readmeBuf,
      entryOptions(`${rootFolder}/README.txt`),
    );

    // Finalizar archivo ZIP y esperar cierre completo del stream
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", (err: any) => reject(err));
      archive.on("error", (err: any) => reject(err));
      archive.finalize().catch((err: any) => reject(err));
    });

    const zipBuffer = Buffer.concat(chunks);
    const packageChecksumSha256 = createHash("sha256").update(zipBuffer).digest("hex");
    const fileName = `${rootFolder}.zip`;

    // Guardar en almacenamiento privado
    const stored = await this.storage.put({
      buffer: zipBuffer,
      originalFilename: fileName,
      mimeType: "application/zip",
    });

    return {
      zipBuffer,
      sha256Hash: packageChecksumSha256,
      packageChecksumSha256,
      sizeBytes: zipBuffer.length,
      storageKey: stored.storageKey,
      fileName,
    };
  }

  public buildReadme(manifest: DossierManifest): string {
    return `================================================================================
                    SISTEMA GODT REGIONAL 3 — EXPEDIENTE DOCUMENTAL
                    REPÚBLICA DE COLOMBIA — RED DE TRASPLANTES
================================================================================

PROCESO OPERATIVO:     ${manifest.processCode}
CÓDIGO RND DONANTE:    ${manifest.donorRndCode || "N/A"}
IPS DE APERTURA:       ${manifest.primaryIpsName}
FECHA DE CONSOLIDACIÓN: ${manifest.generatedAt}
SOLICITANTE:           ${manifest.generatedBy.fullName} (${manifest.generatedBy.role})
VERSIÓN DE PAQUETE:    ${manifest.packageVersion || "Estándar 23 posiciones"}
DIGEST CANÓNICO:       ${manifest.manifestDigest || "N/A"}

--------------------------------------------------------------------------------
ESTRUCTURA DEL EXPEDIENTE (TAXONOMÍA DE 6 CARPETAS):
--------------------------------------------------------------------------------
00_INDICE/
  - indice_expediente.pdf: Carátula institucional y tabla de contenido paginada.
  - resumen_expediente.json: Metadatos y foliación en formato interoperable.

01_DOCUMENTOS_LIBERADOS/
  - Contiene los archivos PDF originales emitidos y firmados para cada posición.
  - Sus bytes y hashes SHA-256 se preservan intactos, idénticos a su liberación.

02_DOCUMENTO_CONSOLIDADO/
  - expediente_consolidado.pdf: Documento continuo para lectura secuencial.
  - AVISO: Generado para consulta y auditoría rápida. No traslada ni sustituye
    las firmas electrónicas individuales contenidas en 01_DOCUMENTOS_LIBERADOS.

03_EVIDENCIAS/
  - manifiesto_integridad.json: Inventario y hashes SHA-256 de los archivos.
  - evidencias_atestaciones.json: Trazabilidad forense de firmas y custodias.

04_CADENA_CUSTODIA/
  - eventos_custodia_inmutables.json: Línea de tiempo de recepción y traspaso.
  - referencia_anexo_8.json: Puntero al documento oficial de cadena de custodia.

05_FUENTES_COMPLEMENTARIAS/
  - Documentos clínicos de origen (historias clínicas, análisis de hemodilución).
  - Incluidos exclusivamente bajo autorización y justificación jurídica expresa.

--------------------------------------------------------------------------------
CONFIDENCIALIDAD Y RÉGIMEN DE DATOS SENSIBLES (LEY 1581 DE 2012 / RES. 3100):
La información de este expediente reviste carácter confidencial y reserva legal.
El uso o divulgación indebida compromete la responsabilidad administrativa,
disciplinaria y penal del custodio.
================================================================================
`;
  }
}
