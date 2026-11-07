import { Injectable } from "@nestjs/common";
import { OcrCandidate } from "./ocr-provider.port";

export interface ExtractionContext {
  pageNumber?: number;
  templateCode?: string;
  sourceCategory?: string;
}

@Injectable()
export class LocalRulesExtractionProvider {
  readonly name = "local-rules";
  readonly isLocal = true;

  /**
   * Extrae campos canónicos a partir de texto no estructurado usando reglas clínicas,
   * expresiones regulares deterministas y normalización estricta para Regional 3.
   */
  extract(rawText: string, context?: ExtractionContext): OcrCandidate[] {
    if (!rawText || !rawText.trim()) return [];

    const candidates: OcrCandidate[] = [];
    const text = rawText.replace(/\r/g, "");
    const pageNumber = context?.pageNumber ?? 1;

    // 1. Número de documento de identidad
    const docMatch = text.match(
      /(?:(?:C[ée]dula(?:\s+de\s+Ciudadan[íi]a)?|Identificaci[oó]n|Doc(?:\.|umento)?|C\.?C\.?|T\.?I\.?)\s*[:#\s-]?\s*)([0-9]{6,12})/i,
    );
    if (docMatch && docMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.identity.document_number",
        candidateValue: docMatch[1].trim(),
        confidenceScore: 0.95,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, docMatch.index ?? 0, docMatch[0].length),
          rule: "DONOR_DOCUMENT_NUMBER",
        },
      });

      // Deducir tipo de documento si está explícito
      const docTypeMatch = docMatch[0].match(/\b(CC|TI|CE|PASAPORTE|RC)\b/i);
      if (docTypeMatch) {
        candidates.push({
          canonicalFieldKey: "donor.identity.document_type",
          candidateValue: docTypeMatch[1].toUpperCase(),
          confidenceScore: 0.92,
          pageNumber,
          boundingBox: {
            snippet: this.getSnippet(text, docMatch.index ?? 0, docMatch[0].length),
            rule: "DONOR_DOCUMENT_TYPE",
          },
        });
      }
    }

    // 2. Nombre completo del donante / paciente
    const nameMatch = text.match(
      /(?:(?:Nombre(?:s)?(?:\s+y\s+Apellidos)?|Paciente|Donante|Fallecido)\s*[:\s-]\s*)([A-ZÁÉÍÓÚÑa-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]{2,}){1,4})/i,
    );
    if (nameMatch && nameMatch[1]) {
      const cleanName = nameMatch[1].trim();
      if (!/^(del|los|las|san|santa|uci|hospital|ips)\b/i.test(cleanName)) {
        candidates.push({
          canonicalFieldKey: "donor.identity.full_name",
          candidateValue: cleanName,
          confidenceScore: 0.92,
          pageNumber,
          boundingBox: {
            snippet: this.getSnippet(text, nameMatch.index ?? 0, nameMatch[0].length),
            rule: "DONOR_FULL_NAME",
          },
        });
      }
    }

    // 3. Grupo sanguíneo y Factor Rh
    const bloodMatch = text.match(
      /(?:(?:Grupo(?:\s+Sangu[íi]neo)?|GS|Hemoclasificaci[oó]n)\s*[:\s-]?\s*)([ABO]{1,2})\s*([+-]|POS(?:ITIVO)?|NEG(?:ATIVO)?)?/i,
    );
    if (bloodMatch && bloodMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.clinical.blood_group",
        candidateValue: bloodMatch[1].toUpperCase(),
        confidenceScore: 0.96,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, bloodMatch.index ?? 0, bloodMatch[0].length),
          rule: "BLOOD_GROUP",
        },
      });

      if (bloodMatch[2]) {
        const rawRh = bloodMatch[2].toUpperCase();
        const normalizedRh = rawRh.startsWith("+") || rawRh.includes("POS") ? "+" : "-";
        candidates.push({
          canonicalFieldKey: "donor.clinical.rh_factor",
          candidateValue: normalizedRh,
          confidenceScore: 0.96,
          pageNumber,
          boundingBox: {
            snippet: this.getSnippet(text, bloodMatch.index ?? 0, bloodMatch[0].length),
            rule: "RH_FACTOR",
          },
        });
      }
    }

    // 4. Edad
    const ageMatch = text.match(
      /(?:Edad\s*[:\s-]\s*)([0-9]{1,3})\s*(?:a[ñn]os)?/i,
    );
    if (ageMatch && ageMatch[1]) {
      const ageNum = parseInt(ageMatch[1], 10);
      if (ageNum >= 0 && ageNum <= 125) {
        candidates.push({
          canonicalFieldKey: "donor.demographics.age",
          candidateValue: String(ageNum),
          confidenceScore: 0.94,
          pageNumber,
          boundingBox: {
            snippet: this.getSnippet(text, ageMatch.index ?? 0, ageMatch[0].length),
            rule: "DONOR_AGE",
          },
        });
      }
    }

    // 5. Sexo
    const sexMatch = text.match(
      /(?:Sexo\s*[:\s-]\s*)(MASCULINO|FEMENINO|HOMBRE|MUJER|M|F)\b/i,
    );
    if (sexMatch && sexMatch[1]) {
      const rawSex = sexMatch[1].toUpperCase();
      const normalizedSex =
        rawSex.startsWith("MASC") || rawSex === "M" || rawSex === "HOMBRE"
          ? "MASCULINO"
          : "FEMENINO";
      candidates.push({
        canonicalFieldKey: "donor.demographics.sex",
        candidateValue: normalizedSex,
        confidenceScore: 0.93,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, sexMatch.index ?? 0, sexMatch[0].length),
          rule: "DONOR_SEX",
        },
      });
    }

    // 6. IPS Generadora / Hospital
    const ipsMatch = text.match(
      /(?:(?:IPS(?:\s+Generadora)?|Hospital(?:\s+de)?|Instituci[oó]n|Cl[íi]nica)\s*[:\s-]\s*)([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.-]{4,60})/i,
    );
    if (ipsMatch && ipsMatch[1]) {
      const cleanIps = ipsMatch[1].trim();
      candidates.push({
        canonicalFieldKey: "donor.institution.originating_ips",
        candidateValue: cleanIps,
        confidenceScore: 0.88,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, ipsMatch.index ?? 0, ipsMatch[0].length),
          rule: "ORIGINATING_IPS",
        },
      });
    }

    // 7. Servicio Clínico
    const serviceMatch = text.match(
      /(?:(?:Servicio(?:\s+Cl[íi]nico)?|Ubicaci[oó]n)\s*[:\s-]\s*)(UCI(?:\s+[A-Za-z0-9]+)?|Urgencias|Hospitalizaci[oó]n|Quir[oó]fano|Reanimaci[oó]n)/i,
    );
    if (serviceMatch && serviceMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.clinical.clinical_service",
        candidateValue: serviceMatch[1].trim().toUpperCase(),
        confidenceScore: 0.90,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, serviceMatch.index ?? 0, serviceMatch[0].length),
          rule: "CLINICAL_SERVICE",
        },
      });
    }

    // 8. Causa de Muerte
    const causeMatch = text.match(
      /(?:(?:Causa(?:\s+de)?\s+(?:Muerte|Fallecimiento)|Diagn[oó]stico(?:\s+de\s+Ingreso)?)\s*[:\s-]\s*)([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,.-]{4,80})/i,
    );
    if (causeMatch && causeMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.clinical.cause_of_death",
        candidateValue: causeMatch[1].trim(),
        confidenceScore: 0.86,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, causeMatch.index ?? 0, causeMatch[0].length),
          rule: "CAUSE_OF_DEATH",
        },
      });
    }

    // 9. Creatinina
    const creatMatch = text.match(
      /(?:Creatinina(?:\s+s[ée]rica)?\s*[:\s-]?\s*)([0-9]+(?:\.[0-9]{1,2})?)\s*(?:mg\/dL)?/i,
    );
    if (creatMatch && creatMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: creatMatch[1].trim(),
        confidenceScore: 0.94,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, creatMatch.index ?? 0, creatMatch[0].length),
          rule: "CREATININE",
        },
      });
    }

    // 10. pH Arterial
    const phMatch = text.match(
      /(?:pH(?:\s+arterial)?\s*[:\s-]?\s*)([67]\.[0-9]{1,3})/i,
    );
    if (phMatch && phMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.clinical.arterial_ph",
        candidateValue: phMatch[1].trim(),
        confidenceScore: 0.95,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, phMatch.index ?? 0, phMatch[0].length),
          rule: "ARTERIAL_PH",
        },
      });
    }

    // 11. Código RND
    const rndMatch = text.match(
      /(?:(?:C[oó]digo\s+RND|Consulta\s+RND|RND)\s*[:\s-]?\s*)([A-Za-z0-9-]{6,25})/i,
    );
    if (rndMatch && rndMatch[1]) {
      candidates.push({
        canonicalFieldKey: "donor.registration.rnd_code",
        candidateValue: rndMatch[1].trim(),
        confidenceScore: 0.95,
        pageNumber,
        boundingBox: {
          snippet: this.getSnippet(text, rndMatch.index ?? 0, rndMatch[0].length),
          rule: "RND_CODE",
        },
      });
    }

    return candidates;
  }

  private getSnippet(fullText: string, startIndex: number, matchLength: number): string {
    const start = Math.max(0, startIndex - 25);
    const end = Math.min(fullText.length, startIndex + matchLength + 25);
    return fullText.substring(start, end).replace(/\s+/g, " ").trim();
  }
}
