import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  OcrCandidate,
  OcrProviderPort,
} from "../../application/ocr/ocr-provider.port";

const execFileAsync = promisify(execFile);

@Injectable()
export class TesseractOcrAdapter implements OcrProviderPort {
  readonly name = "tesseract";
  constructor(private readonly config: ConfigService) {}

  async process(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<OcrCandidate[]> {
    if (input.mimeType === "application/pdf")
      throw new Error("Local Tesseract adapter requires an image page");
    const command = this.config.get<string>("TESSERACT_BIN", "tesseract");
    const imagePath = `${this.config.get<string>("DOCUMENT_STORAGE_PATH", "storage/private")}\\ocr-${Date.now()}.img`;
    const fs = await import("fs/promises");
    await fs.writeFile(imagePath, input.buffer, { flag: "wx" });
    try {
      const { stdout } = await execFileAsync(
        command,
        [
          imagePath,
          "stdout",
          "-l",
          this.config.get<string>("TESSERACT_LANG", "eng"),
        ],
        { timeout: 30000 },
      );
      return this.parseCandidateJson(stdout);
    } finally {
      await fs.unlink(imagePath).catch(() => undefined);
    }
  }

  private parseCandidateJson(raw: string): OcrCandidate[] {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error("OCR provider response must be an array");
    return parsed.map((item) => {
      if (!item || typeof item !== "object")
        throw new Error("OCR candidate is invalid");
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.canonicalFieldKey !== "string" ||
        typeof candidate.candidateValue !== "string" ||
        typeof candidate.confidenceScore !== "number" ||
        candidate.confidenceScore < 0 ||
        candidate.confidenceScore > 1
      ) {
        throw new Error("OCR candidate schema is invalid");
      }
      return {
        canonicalFieldKey: candidate.canonicalFieldKey,
        candidateValue: candidate.candidateValue,
        confidenceScore: candidate.confidenceScore,
      };
    });
  }
}
