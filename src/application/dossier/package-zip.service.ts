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
}

export interface PackageZipResult {
  zipBuffer: Buffer;
  sha256Hash: string;
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

    // 1. Carpeta 00_INDICE
    archive.append(input.indexPdfBuffer, {
      name: `${rootFolder}/00_INDICE/indice_expediente.pdf`,
    });
    archive.append(JSON.stringify(input.indexJsonSummary, null, 2), {
      name: `${rootFolder}/00_INDICE/resumen_expediente.json`,
    });

    // 2. Carpeta 01_DOCUMENTOS_LIBERADOS
    for (const doc of input.releasedPdfs) {
      archive.append(doc.buffer, {
        name: `${rootFolder}/01_DOCUMENTOS_LIBERADOS/${doc.filename}`,
      });
    }

    // 3. Carpeta 02_DOCUMENTO_CONSOLIDADO
    if (input.consolidatedPdfBuffer) {
      archive.append(input.consolidatedPdfBuffer, {
        name: `${rootFolder}/02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf`,
      });
    }

    // 4. Carpeta 03_EVIDENCIAS
    archive.append(JSON.stringify(input.manifest, null, 2), {
      name: `${rootFolder}/03_EVIDENCIAS/manifiesto_integridad.json`,
    });
    archive.append(JSON.stringify(input.evidenciasAtestacionesJson, null, 2), {
      name: `${rootFolder}/03_EVIDENCIAS/evidencias_atestaciones.json`,
    });

    // 5. Carpeta 04_CADENA_CUSTODIA
    if (input.custodyFiles && input.custodyFiles.length > 0) {
      for (const cf of input.custodyFiles) {
        archive.append(cf.buffer, {
          name: `${rootFolder}/04_CADENA_CUSTODIA/${cf.filename}`,
        });
      }
    }

    // 6. Carpeta 05_FUENTES_COMPLEMENTARIAS (si fueron seleccionadas y autorizadas)
    if (input.sourceDocuments && input.sourceDocuments.length > 0) {
      for (const src of input.sourceDocuments) {
        archive.append(src.buffer, {
          name: `${rootFolder}/05_FUENTES_COMPLEMENTARIAS/${src.category}/${src.filename}`,
        });
      }
    }

    // 7. README.txt institucional
    const readmeContent = this.buildReadme(input.manifest);
    archive.append(readmeContent, {
      name: `${rootFolder}/README.txt`,
    });

    // Esperar a que el archivo ZIP se finalice y el stream termine
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", (err: any) => reject(err));
      archive.on("error", (err: any) => reject(err));
      archive.finalize().catch((err: any) => reject(err));
    });

    const zipBuffer = Buffer.concat(chunks);
    const sha256Hash = createHash("sha256").update(zipBuffer).digest("hex");
    const fileName = `${rootFolder}.zip`;

    // Guardar en almacenamiento privado
    const stored = await this.storage.put({
      buffer: zipBuffer,
      originalFilename: fileName,
      mimeType: "application/zip",
    });

    return {
      zipBuffer,
      sha256Hash,
      sizeBytes: zipBuffer.length,
      storageKey: stored.storageKey,
      fileName,
    };
  }

  private buildReadme(manifest: DossierManifest): string {
    return `================================================================================
                    SISTEMA GODT REGIONAL 3 — EXPEDIENTE DOCUMENTAL
                    REPÚBLICA DE COLOMBIA — RED DE TRASPLANTES
================================================================================

PROCESO DE OPERATIVO:  ${manifest.processCode}
CÓDIGO RND DONANTE:    ${manifest.donorRndCode || "N/A"}
IPS DE APERTURA:       ${manifest.primaryIpsName}
FECHA DE EXPORTACIÓN:  ${manifest.generatedAt}
USUARIO AUDITOR:       ${manifest.generatedBy.fullName} (${manifest.generatedBy.email})
ROL:                   ${manifest.generatedBy.role}

ESTRUCTURA DEL EXPEDIENTE:
--------------------------------------------------------------------------------
00_INDICE/
  - indice_expediente.pdf: Carátula e inventario de las 23 posiciones con rangos
    de página y firmas.
  - resumen_expediente.json: Metadatos estructurados para auditoría digital.

01_DOCUMENTOS_LIBERADOS/
  - Formatos oficiales del proceso en su estado LIBERADO con sus firmas vigentes.
  - Los archivos preservan sus binarios y hashes SHA-256 originales inmutables.

02_DOCUMENTO_CONSOLIDADO/
  - expediente_consolidado.pdf: Documento unificado de lectura continua que reúne
    la carátula y los formatos liberados para consulta rápida asistencial y judicial.

03_EVIDENCIAS/
  - manifiesto_integridad.json: Catálogo criptográfico de todos los elementos con
    hashes SHA-256 para verificación forense.
  - evidencias_atestaciones.json: Bitácora de atestaciones bajo juramento y firmas.

04_CADENA_CUSTODIA/
  - Documentos y registros inmutables de trazabilidad de órganos, contenedores y
    temperatura (Anexo 8).

05_FUENTES_COMPLEMENTARIAS/ (Opcional bajo autorización estricta)
  - Documentos fuente originales asociados y expresamente autorizados.

AVISO LEGAL Y DE PRIVACIDAD:
--------------------------------------------------------------------------------
Este expediente contiene información médico-legal y de trazabilidad clínica
confidencial regulada por las leyes de donación y trasplante de la República
de Colombia y la Ley Estatutaria de Protección de Datos Personales (Ley 1581 de 2012).
Queda prohibida su reproducción o divulgación no autorizada.
================================================================================`;
  }
}
