// ─── Keyword extraction from dish name + description ────────────────
// Extracts meaningful words for fine-grained scoring.
// Uses both the dish name AND description for richer signals.

const STOPWORDS = new Set([
  // Spanish
  'de', 'del', 'con', 'sin', 'el', 'la', 'los', 'las', 'al', 'en',
  'y', 'o', 'a', 'un', 'una', 'por', 'para', 'su', 'sus', 'mas',
  'que', 'como', 'este', 'esta', 'sobre', 'nuestro', 'nuestra',
  // English
  'the', 'and', 'or', 'with', 'our', 'style',
  // Generic food/menu words (no signal)
  'plato', 'menu', 'combo', 'promo', 'especial', 'clasico', 'premium',
  'grande', 'mediano', 'chico', 'individual', 'familiar', 'doble', 'triple',
  'nuevo', 'nueva', 'mix', 'super', 'mini', 'mega', 'version',
  'unidades', 'unidad', 'porcion', 'pieza', 'piezas', 'bocados',
  'acompanado', 'acompanada', 'servido', 'servida', 'preparado', 'preparada',
  'eleccion', 'opcional', 'incluye', 'lleva', 'trae',
  'ideal', 'perfecto', 'delicioso', 'exquisito', 'fresco', 'casero', 'casera',
  'tradicional', 'artesanal', 'gourmet', 'tipo', 'estilo',
])

/** Normalize: lowercase + remove accents */
function norm(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Extract keywords from dish name + optional description */
export function extractKeywords(name: string, description?: string | null): string[] {
  // Name keywords have higher priority, but we extract from both
  const text = description ? `${name} ${description}` : name
  const words = text
    .replace(/[^a-záéíóúüñ\s]/gi, ' ')
    .split(/\s+/)
    .map(norm)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))

  return [...new Set(words)]
}

/** Score how well a dish matches user keyword preferences */
export function keywordAffinity(
  name: string,
  description: string | null,
  keywordScores: Record<string, number>,
): number {
  const keywords = extractKeywords(name, description)
  let score = 0
  let matches = 0
  for (const kw of keywords) {
    const kwScore = keywordScores[kw]
    if (kwScore) {
      score += kwScore
      matches++
    }
  }
  // Bonus when multiple keywords match (compound affinity)
  if (matches >= 2) score *= 1 + (matches - 1) * 0.15
  return score
}
