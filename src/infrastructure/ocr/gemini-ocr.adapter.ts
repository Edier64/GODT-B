import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OcrCandidate,
  OcrProviderPort,
} from "../../application/ocr/ocr-provider.port";

@Injectable()
export class GeminiOcrAdapter implements OcrProviderPort {
  readonly name = "gemini";
  constructor(private readonly config: ConfigService) {}

  async process(input: {
    buffer: Buffer;
    mimeType: string;
  }): Promise<OcrCandidate[]> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    const model = this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: input.mimeType,
                    data: input.buffer.toString("base64"),
                  },
                },
                {
                  text: "Return only a JSON array of candidates with canonicalFieldKey, candidateValue and confidenceScore. Use only the configured canonical dictionary.",
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Gemini OCR request failed with status ${response.status}`,
      );
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.find(
      (part) => part.text,
    )?.text;
    if (!text) throw new Error("Gemini OCR response is empty");
    const json = text
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed: unknown = JSON.parse(json);
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
