import {
  normalizeString,
  levenshteinDistance,
  stringSimilarity,
} from "../src/application/institutions/normalization.helper";

describe("Normalization & String Similarity Helper (Fase G.1.3)", () => {
  describe("normalizeString", () => {
    it("debe remover tildes, signos diacríticos, mayúsculas y espacios duplicados", () => {
      const input = "  Clínica   IMBANACO  S.A.S.!  ";
      const normalized = normalizeString(input);
      expect(normalized).toBe("clinica imbanaco s a s");
    });

    it("debe manejar cadenas vacías o con solo espacios", () => {
      expect(normalizeString("")).toBe("");
      expect(normalizeString("   ")).toBe("");
    });

    it("debe limpiar caracteres especiales conservando números y letras", () => {
      const input = "Hospital Universitario del Valle - E.S.E. (Piso 3)";
      const normalized = normalizeString(input);
      expect(normalized).toBe("hospital universitario del valle e s e piso 3");
    });
  });

  describe("levenshteinDistance", () => {
    it("debe retornar 0 para cadenas idénticas", () => {
      expect(levenshteinDistance("imbanaco", "imbanaco")).toBe(0);
    });

    it("debe calcular la distancia correcta para inserciones y sustituciones", () => {
      expect(levenshteinDistance("valle", "valie")).toBe(1);
      expect(levenshteinDistance("huv", "huv valle")).toBe(6);
    });
  });

  describe("stringSimilarity", () => {
    it("debe retornar 1.0 para cadenas idénticas", () => {
      expect(stringSimilarity("clinica occidente", "clinica occidente")).toBe(1.0);
    });

    it("debe retornar puntuación alta para variaciones ortográficas menores", () => {
      const score = stringSimilarity("clinica imbanaco", "clinica inbanaco");
      expect(score).toBeGreaterThan(0.85);
    });

    it("debe retornar 0 si alguna cadena está vacía", () => {
      expect(stringSimilarity("", "hospital")).toBe(0);
    });
  });
});
