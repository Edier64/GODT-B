/**
 * Normaliza cadenas de texto para búsqueda y prevención de duplicados:
 * - Mayúsculas y minúsculas homogéneas
 * - Descomposición de acentos y caracteres Unicode (NFD)
 * - Eliminación de puntuación irrelevante
 * - Compactación de espacios repetidos
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // remover caracteres especiales
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distancia de Levenshtein entre dos cadenas normalizadas
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a || "";
  const s2 = b || "";
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // eliminación
        dp[i][j - 1] + 1, // inserción
        dp[i - 1][j - 1] + cost, // sustitución
      );
    }
  }

  return dp[m][n];
}

/**
 * Similaridad normalizada entre 0.0 y 1.0 (1.0 = idénticas)
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(normA, normB);
  return 1.0 - dist / maxLen;
}

