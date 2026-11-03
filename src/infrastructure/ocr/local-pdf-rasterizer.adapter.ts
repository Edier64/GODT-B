import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PdfRasterizerPort } from "../../application/ocr/pdf-rasterizer.port";

const execFileAsync = promisify(execFile);

@Injectable()
export class LocalPdfRasterizerAdapter implements PdfRasterizerPort {
  constructor(private readonly config: ConfigService) {}

  async rasterize(buffer: Buffer): Promise<Buffer[]> {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("PDF signature is invalid");
    }
    const maxPages = this.config.get<number>("OCR_PDF_MAX_PAGES", 10);
    const resolution = this.config.get<number>("OCR_PDF_DPI", 150);
    const timeout = this.config.get<number>("OCR_PDF_TIMEOUT_MS", 30000);
    const maxRasterBytes = this.config.get<number>(
      "OCR_PDF_MAX_RASTER_BYTES",
      50 * 1024 * 1024,
    );
    const pdfInfo = this.config.get<string>("PDFINFO_BIN", "pdfinfo");
    const rasterizer = this.config.get<string>("PDFTOPPM_BIN", "pdftoppm");
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
      throw new Error("OCR_PDF_MAX_PAGES is invalid");
    }
    if (!Number.isInteger(resolution) || resolution < 72 || resolution > 300) {
      throw new Error("OCR_PDF_DPI is invalid");
    }
    if (!Number.isInteger(maxRasterBytes) || maxRasterBytes < 1024 * 1024) {
      throw new Error("OCR_PDF_MAX_RASTER_BYTES is invalid");
    }

    const directory = await mkdtemp(join(tmpdir(), "godt-pdf-"));
    const inputPath = join(directory, "source.pdf");
    const outputPrefix = join(directory, "page");
    try {
      await writeFile(inputPath, buffer, { flag: "wx" });
      const { stdout } = await execFileAsync(pdfInfo, [inputPath], { timeout });
      const pages = this.parsePageCount(stdout);
      if (pages < 1 || pages > maxPages) {
        throw new Error(
          `PDF page count exceeds the configured limit of ${maxPages}`,
        );
      }
      await execFileAsync(
        rasterizer,
        [
          "-png",
          "-r",
          String(resolution),
          "-f",
          "1",
          "-l",
          String(pages),
          inputPath,
          outputPrefix,
        ],
        { timeout, maxBuffer: 1024 * 1024 },
      );
      const files = (await readdir(directory))
        .filter((name) => /^page-\d+\.png$/i.test(name))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true }),
        );
      if (files.length !== pages)
        throw new Error("PDF rasterizer returned an incomplete page set");
      let totalBytes = 0;
      const output: Buffer[] = [];
      for (const file of files) {
        const path = join(directory, file);
        totalBytes += (await stat(path)).size;
        if (totalBytes > maxRasterBytes) {
          throw new Error(
            "PDF rasterized output exceeds the configured byte limit",
          );
        }
        output.push(await readFile(path));
      }
      return output;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private parsePageCount(output: string): number {
    const match = output.match(/^Pages:\s+(\d+)$/im);
    const pages = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(pages))
      throw new Error("PDF page count is unavailable");
    return pages;
  }
}
