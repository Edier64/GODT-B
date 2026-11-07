/**
 * Nomenclatura oficial homologada de documentos del expediente GODT Regional 3.
 * Basada en docs/document-inventory.md y OFFICIAL_REGIONAL_3_POSITIONS.
 *
 * Evita confusiones normativas:
 * - Posición 2: Anexo 2 corresponde a Notificación a Deudos / Presunción Legal (Ley 1805/2016).
 * - Posición 3: Anexo 3 corresponde a Consentimiento Informado Familiar cuando aplique.
 * - Posición 13: Anexo 7 Extracción de Otros Órganos (con componente y lateralidad).
 * - Posición 18: Anexo 8 Acta de Cadena de Custodia (único en 01_DOCUMENTOS_LIBERADOS).
 */

export interface OfficialPositionNaming {
  positionNumber: number;
  officialCode: string;
  officialTitle: string;
  baseFileName: string;
}

export const OFFICIAL_DOSSIER_NAMING: Record<number, OfficialPositionNaming> = {
  1: {
    positionNumber: 1,
    officialCode: "ANEXO_1",
    officialTitle: "Anexo 1 — Valoración y alerta de posible donante",
    baseFileName: "POS_01_ANEXO_1_VALORACION_ALERTA",
  },
  2: {
    positionNumber: 2,
    officialCode: "ANEXO_2",
    officialTitle: "Anexo 2 — Notificación a deudos / Legalización por presunción legal",
    baseFileName: "POS_02_ANEXO_2_NOTIFICACION_DEUDOS",
  },
  3: {
    positionNumber: 3,
    officialCode: "ANEXO_3",
    officialTitle: "Anexo 3 — Consentimiento informado de donación / Legalización familiar",
    baseFileName: "POS_03_ANEXO_3_CONSENTIMIENTO_FAMILIAR",
  },
  4: {
    positionNumber: 4,
    officialCode: "ANEXO_4",
    officialTitle: "Anexo 4 — Registro de donante y oferta de órganos y tejidos",
    baseFileName: "POS_04_ANEXO_4_REGISTRO_OFERTA",
  },
  5: {
    positionNumber: 5,
    officialCode: "ANEXO_5",
    officialTitle: "Anexo 5 — Formato de remisión de muestras para laboratorio e inmunogenética",
    baseFileName: "POS_05_ANEXO_5_REMISION_MUESTRAS",
  },
  6: {
    positionNumber: 6,
    officialCode: "ANEXO_6",
    officialTitle: "Anexo 6 — Registro general de extracción de órganos y tejidos",
    baseFileName: "POS_06_ANEXO_6_REGISTRO_EXTRACCION",
  },
  7: {
    positionNumber: 7,
    officialCode: "ANEXO_7_OCULAR",
    officialTitle: "Anexo 7 — Acta de rescate de tejido ocular",
    baseFileName: "POS_07_ANEXO_7_RESCATE_TEJIDO_OCULAR",
  },
  8: {
    positionNumber: 8,
    officialCode: "ANEXO_7_CARDIOVASCULAR",
    officialTitle: "Anexo 7 — Acta de rescate de tejido cardiovascular",
    baseFileName: "POS_08_ANEXO_7_RESCATE_TEJIDO_CARDIOVASCULAR",
  },
  9: {
    positionNumber: 9,
    officialCode: "ANEXO_7_OSTEOMUSCULAR",
    officialTitle: "Anexo 7 — Acta de rescate de tejido osteomuscular",
    baseFileName: "POS_09_ANEXO_7_RESCATE_TEJIDO_OSTEOMUSCULAR",
  },
  10: {
    positionNumber: 10,
    officialCode: "ANEXO_7_PIEL",
    officialTitle: "Anexo 7 — Acta de rescate de tejido piel",
    baseFileName: "POS_10_ANEXO_7_RESCATE_TEJIDO_PIEL",
  },
  11: {
    positionNumber: 11,
    officialCode: "ANEXO_7_CORAZON",
    officialTitle: "Anexo 7 — Ficha de extracción de corazón (Cardiectomía)",
    baseFileName: "POS_11_ANEXO_7_EXTRACCION_CORAZON",
  },
  12: {
    positionNumber: 12,
    officialCode: "ANEXO_7_HIGADO",
    officialTitle: "Anexo 7 — Ficha de extracción de hígado (Hepatectomía)",
    baseFileName: "POS_12_ANEXO_7_EXTRACCION_HIGADO",
  },
  13: {
    positionNumber: 13,
    officialCode: "ANEXO_7_OTROS_ORGANOS",
    officialTitle: "Anexo 7 — Ficha de extracción de otros órganos",
    baseFileName: "POS_13_ANEXO_7_EXTRACCION_OTROS_ORGANOS",
  },
  14: {
    positionNumber: 14,
    officialCode: "ANEXO_7_PANCREAS",
    officialTitle: "Anexo 7 — Ficha de extracción de páncreas",
    baseFileName: "POS_14_ANEXO_7_EXTRACCION_PANCREAS",
  },
  15: {
    positionNumber: 15,
    officialCode: "ANEXO_7_PULMON",
    officialTitle: "Anexo 7 — Ficha de extracción de pulmón (Neumonectomía)",
    baseFileName: "POS_15_ANEXO_7_EXTRACCION_PULMON",
  },
  16: {
    positionNumber: 16,
    officialCode: "ANEXO_7_RINON_DERECHO",
    officialTitle: "Anexo 7 — Ficha de extracción riñón derecho (Nefrectomía)",
    baseFileName: "POS_16_ANEXO_7_NEFRECTOMIA_RINON_DERECHO",
  },
  17: {
    positionNumber: 17,
    officialCode: "ANEXO_7_RINON_IZQUIERDO",
    officialTitle: "Anexo 7 — Ficha de extracción riñón izquierdo (Nefrectomía)",
    baseFileName: "POS_17_ANEXO_7_NEFRECTOMIA_RINON_IZQUIERDO",
  },
  18: {
    positionNumber: 18,
    officialCode: "ANEXO_8",
    officialTitle: "Anexo 8 — Formato cadena de custodia EMP y evidencias",
    baseFileName: "POS_18_ANEXO_8_ACTA_CADENA_CUSTODIA",
  },
  19: {
    positionNumber: 19,
    officialCode: "ANEXO_9",
    officialTitle: "Anexo 9 — Carta de entrega de cuerpo a INMLCF",
    baseFileName: "POS_19_ANEXO_9_ENTREGA_CUERPO_INMLCF",
  },
};

export function getOfficialDossierFilename(
  positionNumber: number,
  documentCode?: string,
  versionNumber?: number,
): string {
  const naming = OFFICIAL_DOSSIER_NAMING[positionNumber];
  if (naming) {
    const vSuffix = versionNumber && versionNumber > 1 ? `_v${versionNumber}` : "";
    return `${naming.baseFileName}${vSuffix}.pdf`;
  }
  const posPadded = String(positionNumber).padStart(2, "0");
  const codeClean = (documentCode || "DOC").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const vSuffix = versionNumber && versionNumber > 1 ? `_v${versionNumber}` : "";
  return `POS_${posPadded}_${codeClean}${vSuffix}.pdf`;
}
