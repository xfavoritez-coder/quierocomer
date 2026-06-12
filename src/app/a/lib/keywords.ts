// ─── Keyword extraction from dish names ────────────────────────────
// Extracts meaningful words from dish names for fine-grained scoring.
// "Salmon Roll Nikkei" → ["salmon", "roll", "nikkei"]

const STOPWORDS = new Set([
  'de', 'del', 'con', 'sin', 'el', 'la', 'los', 'las', 'al', 'en',
  'y', 'o', 'a', 'un', 'una', 'por', 'para', 'su', 'sus', 'mas',
  'the', 'and', 'or', 'with', 'our',
  // Generic food words that don't add signal
  'plato', 'menu', 'combo', 'promo', 'especial', 'clasico', 'premium',
  'grande', 'mediano', 'chico', 'individual', 'familiar', 'doble', 'triple',
  'nuevo', 'nueva', 'mix', 'super', 'mini', 'mega',
  'unidades', 'unidad', 'porcion', 'pieza', 'piezas',
])

/** Normalize a word: lowercase, remove accents */
function normalize(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Extract meaningful keywords from a dish name */
export function extractKeywords(dishName: string): string[] {
  const words = dishName
    .replace(/[^a-záéíóúüñ\s]/gi, ' ')  // remove non-letters
    .split(/\s+/)
    .map(normalize)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))

  // Deduplicate
  return [...new Set(words)]
}

/** Get keyword overlap score between a dish name and keyword scores */
export function keywordAffinity(
  dishName: string,
  keywordScores: Record<string, number>,
): number {
  const keywords = extractKeywords(dishName)
  let score = 0
  for (const kw of keywords) {
    if (keywordScores[kw]) {
      score += keywordScores[kw]
    }
  }
  return score
}
