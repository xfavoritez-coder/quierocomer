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
  // Cooking/presentation words (no flavor signal)
  'envuelto', 'envuelta', 'envueltos', 'cubierto', 'cubierta', 'cubiertos',
  'relleno', 'rellena', 'rellenos', 'base', 'sobre', 'capa',
  'frito', 'frita', 'fritos', 'fritas', 'horneado', 'horneada',
  'grillado', 'grillada', 'salteado', 'salteada', 'cocido', 'cocida',
  'trozo', 'trozos', 'corte', 'filete', 'lonjas', 'rodajas',
  'cobertura', 'topping', 'acompanamiento',
  'sabor', 'sabores', 'seleccion', 'variedad', 'variedades', 'surtido',
  'receta', 'estilo', 'manera', 'forma', 'modo',
  'cremoso', 'cremosa', 'crocante', 'crujiente', 'suave', 'tierno', 'tierna',
  'caliente', 'frio', 'fria', 'natural', 'hecho', 'hecha',
  'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'cada', 'todo', 'toda', 'todos', 'todas', 'mas', 'muy', 'bien',
  'rico', 'rica', 'ricos', 'ricas', 'bueno', 'buena',
  // Colors and sizes (no signal)
  'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde',
  'amarillo', 'amarilla', 'dorado', 'dorada',
  // Common filler words in dish descriptions
  'estilo', 'casa', 'nuestro', 'nuestra', 'especial', 'original',
  'toque', 'punto', 'justo', 'autentico', 'autentica',
  'buen', 'mejor', 'favorito', 'favorita', 'clasica',
  'acompana', 'incluye', 'contiene', 'viene', 'lleva',
  'pan', 'masa', 'harina', 'aceite', 'sal',
  'plato', 'porcion', 'servicio', 'preparacion',
  'opcion', 'alternativa', 'disponible',
  'pequeño', 'pequena', 'mediana', 'grande', 'extra',
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
