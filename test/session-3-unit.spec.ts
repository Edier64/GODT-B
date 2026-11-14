import {
  levenshteinDistance,
  normalizeString,
  stringSimilarity,
} from "../src/application/institutions/normalization.helper";

describe("Sesión 3 — pruebas unitarias de normalización", () => {
  it("normaliza tildes, mayúsculas, puntuación y espacios", () => {
    expect(normalizeString("  Clínica   IMBANACO S.A.S.! ")).toBe(
      "clinica imbanaco s a s",
    );
  });

  it("calcula distancia cero para cadenas iguales y cuenta inserciones", () => {
    expect(levenshteinDistance("imbanaco", "imbanaco")).toBe(0);
    expect(levenshteinDistance("huv", "huv1")).toBe(1);
  });

  it("calcula similitud entre cero y uno y trata entradas vacías", () => {
    expect(stringSimilarity("Clínica Imbanaco", "clinica imbanaco")).toBe(1);
    expect(stringSimilarity("", "hospital")).toBe(0);
    expect(stringSimilarity("imbanaco", "inbanaco")).toBeGreaterThan(0.8);
  });
});
