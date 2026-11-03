import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  OcrCandidate,
  OcrProviderPort,
} from "../../application/ocr/ocr-provider.port";
import {
  PDF_RASTERIZER,
  PdfRasterizerPort,
} from "../../application/ocr/pdf-rasterizer.port";

const execFileAsync = promisify(execFile);

@Injectable()
export class TesseractOcrAdapter implements OcrProviderPort {
  readonly name = "tesseract";
  constructor(
    private readonly config: ConfigService,
    @Inject(PDF_RASTERIZER) private readonly rasterizer: PdfRasterizerPort,
  ) {}

  async process(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<OcrCandidate[]> {
    const pages =
      input.mimeType === "application/pdf"
        ? await this.rasterizer.rasterize(input.buffer)
        : [input.buffer];
    const candidates: OcrCandidate[] = [];
    for (const [index, page] of pages.entries()) {
      candidates.push(...(await this.processPage(page, index + 1)));
    }
    return candidates;
  }

  private async processPage(
    buffer: Buffer,
    pageNumber: number,
  ): Promise<OcrCandidate[]> {
    const command = this.config.get<string>("TESSERACT_BIN", "tesseract");
    const directory = await mkdtemp(join(tmpdir(), "godt-ocr-"));
    const imagePath = join(directory, "page.png");
    try {
      await writeFile(imagePath, buffer, { flag: "wx" });
      const { stdout } = await execFileAsync(
        command,
        [
          imagePath,
          "stdout",
          "-l",
          this.config.get<string>("TESSERACT_LANG", "eng"),
          "tsv",
        ],
        {
          timeout: this.config.get<number>("TESSERACT_TIMEOUT_MS", 30000),
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      return mapTesseractTsv(stdout, this.fieldAliases(), pageNumber);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private fieldAliases(): Record<string, string[]> {
    const raw = this.config.get<string>("OCR_FIELD_ALIASES", "");
    if (!raw) throw new Error("OCR_FIELD_ALIASES is not configured");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("OCR_FIELD_ALIASES must be a JSON object");
    }
    const aliases: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(parsed)) {
      if (
        !Array.isArray(values) ||
        !values.every((value) => typeof value === "string" && value.trim())
      ) {
        throw new Error("OCR_FIELD_ALIASES contains an invalid mapping");
      }
      aliases[key] = values.map((value) => value.trim());
    }
    return aliases;
  }
}

interface TesseractLine {
  text: string;
  confidence: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function mapTesseractTsv(
  raw: string,
  aliases: Record<string, string[]>,
  pageNumber = 1,
): OcrCandidate[] {
  const lines = new Map<string, TesseractLine[]>();
  for (const row of raw.split(/\r?\n/).slice(1)) {
    const columns = row.split("\t");
    if (columns.length < 12 || !columns[11]?.trim()) continue;
    const confidence = Number(columns[10]);
    const left = Number(columns[6]);
    const top = Number(columns[7]);
    const width = Number(columns[8]);
    const height = Number(columns[9]);
    if (
      ![confidence, left, top, width, height].every(Number.isFinite) ||
      confidence < 0
    )
      continue;
    const key = `${columns[1]}:${columns[2]}:${columns[3]}:${columns[4]}`;
    const values = lines.get(key) ?? [];
    values.push({
      text: columns[11].trim(),
      confidence,
      left,
      top,
      right: left + width,
      bottom: top + height,
    });
    lines.set(key, values);
  }
  const candidates: OcrCandidate[] = [];
  for (const [canonicalFieldKey, fieldAliases] of Object.entries(aliases)) {
    for (const words of lines.values()) {
      const text = words.map((word) => word.text).join(" ");
      const alias = fieldAliases.find((value) =>
        new RegExp(`^${escapeRegExp(value)}\\s*[:\\-]\\s*(.+)$`, "i").test(
          text,
        ),
      );
      if (!alias) continue;
      const match = text.match(
        new RegExp(`^${escapeRegExp(alias)}\\s*[:\\-]\\s*(.+)$`, "i"),
      );
      const candidateValue = match?.[1]?.trim();
      if (!candidateValue) continue;
      candidates.push({
        canonicalFieldKey,
        candidateValue,
        confidenceScore: Math.min(
          1,
          Math.max(
            0,
            words.reduce((sum, word) => sum + word.confidence, 0) /
              words.length /
              100,
          ),
        ),
        pageNumber,
        boundingBox: {
          left: Math.min(...words.map((word) => word.left)),
          top: Math.min(...words.map((word) => word.top)),
          right: Math.max(...words.map((word) => word.right)),
          bottom: Math.max(...words.map((word) => word.bottom)),
        },
      });
      break;
    }
  }
  return candidates;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
