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
  'pan', 'masa', 'harina', 'aceite', 'sal', 'salsa', 'salsas',
  'arroz', 'papas', 'papa', 'queso', 'crema', 'leche', 'huevo', 'huevos',
  'carne', 'pollo', 'pescado', 'verduras', 'lechuga', 'tomate', 'cebolla',
  'plato', 'porcion', 'servicio', 'preparacion',
  'opcion', 'alternativa', 'disponible',
  'pequeño', 'pequena', 'mediana', 'grande', 'extra',
  'coronado', 'coronada', 'especial', 'original', 'clasico', 'clasica',
  // Format/presentation words (no taste signal)
  'roll', 'rolls', 'hot', 'hand', 'california', 'special', 'tabla', 'tablas',
  'bowl', 'bowls', 'poke', 'wrap', 'wraps', 'box', 'set',
  'apanado', 'apanada', 'apanados', 'tempura', 'tempurizado', 'tempurizada',
  'flambeado', 'flambeada', 'panko', 'crispy', 'furay',
  'unidades', 'unidad', 'piezas', 'pieza', 'bocados', 'bocado',
  'bandeja', 'combo', 'promo', 'promocion', 'menu', 'barco', 'barcos',
  // Generic ingredient words (too common to be useful)
  'queso crema', 'cebolla morada', 'cebollin', 'ciboulette', 'ciboullete',
  'toques', 'puntos', 'banado', 'banada', 'envuelto', 'envuelta',
  'sesamo', 'masago', 'nori', 'furikake', 'wakame',
  'palta', 'limon', 'cilantro', 'pepino',
  // Sushi/Asian generic terms
  'maki', 'makis', 'niguiri', 'niguiris', 'sashimi', 'tataki', 'gohan',
  'gyosa', 'gyosas', 'edamame', 'edamames',
  // Numbers and measures
  'gramos', 'litro', 'litros', 'mililitros',
])

/** Normalize: lowercase + remove accents */
function norm(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Whitelist: real ingredients, flavors, proteins, and cooking styles worth tracking */
const FLAVOR_WORDS = new Set([
  // Proteins
  'salmon', 'atun', 'pulpo', 'camaron', 'camarones', 'langostino', 'langostinos',
  'cerdo', 'cordero', 'lomo', 'wagyu', 'costilla', 'costillas', 'churrasco',
  'pavo', 'jamon', 'tocino', 'chorizo', 'mechada', 'plateada',
  'reineta', 'corvina', 'merluza', 'jibia', 'calamar', 'mariscos', 'marisco',
  // Key ingredients
  'palta', 'aguacate', 'mango', 'maracuya', 'frambuesa', 'frutilla',
  'chocolate', 'nutella', 'manjar', 'caramelo', 'vainilla', 'canela',
  'trufa', 'aceituna', 'aceitunas', 'alcaparra', 'rucula',
  'champiñon', 'champinon', 'champiñones', 'champinones', 'hongos',
  'jalapeño', 'jalapeno', 'chipotle', 'habanero',
  // Cheeses
  'mozzarella', 'parmesano', 'cheddar', 'gouda', 'brie', 'gorgonzola', 'roquefort',
  // Flavors / styles
  'picante', 'ahumado', 'ahumada', 'teriyaki', 'curry', 'wasabi', 'kimchi',
  'bbq', 'barbacoa', 'mostaza', 'pesto', 'hummus', 'guacamole',
  'agridulce', 'dulce', 'acido', 'umami',
  'nikkei', 'thai', 'peruano', 'peruana', 'mexicano', 'mexicana',
  'italiano', 'italiana', 'mediterraneo', 'mediterranea',
  // Dish types (useful for preference learning)
  'ceviche', 'tiradito', 'tartar', 'carpaccio',
  'brownie', 'cheesecake', 'tiramisu', 'flan', 'mousse', 'crepe', 'waffle',
  'empanada', 'empanadas', 'arepa', 'taco', 'tacos', 'burrito', 'quesadilla',
  'pizza', 'calzone', 'focaccia',
  'ramen', 'pad', 'dim', 'sum', 'wonton', 'dumpling',
  'risotto', 'gnocchi', 'ravioli', 'lasagna', 'lasaña',
  'milanesa', 'schnitzel',
])

/** Extract keywords from dish name + optional description */
export function extractKeywords(name: string, description?: string | null): string[] {
  const text = description ? `${name} ${description}` : name
  const words = text
    .replace(/[^a-záéíóúüñ\s]/gi, ' ')
    .split(/\s+/)
    .map(norm)
    .filter(w => w.length >= 3 && FLAVOR_WORDS.has(w))

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
