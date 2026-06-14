// ─── Normalización de categorías ───────────────────────────────────────
// Un solo archivo con todo lo relacionado a categorías del feed.
// Se usa para scoring, chips en Explorar, motivos de recomendación y gradientes.

/** Mapea nombres de categoría de la BD → categoría normalizada del feed */
export const CATEGORY_MAP: Record<string, string> = {
  // ─── Sushi & Rolls ──────────────────────────────────────────
  'Sushi': 'Sushi',
  'SUSHI': 'Sushi',
  'SUSHI DE LA CASA': 'Sushi',
  'Handrolls': 'Sushi',
  'Hand Rolls': 'Sushi',
  'HAND ROLL': 'Sushi',
  'California Rolls': 'Sushi',
  'Nikkei Rolls': 'Sushi',
  'Rolls': 'Sushi',
  'Temakis': 'Sushi',
  'Nigiri': 'Sushi',
  'Sashimi': 'Sushi',
  'SASHIMI': 'Sushi',
  'Futomaki': 'Sushi',
  'Hot Rolls': 'Sushi',
  'Especial Rolls': 'Sushi',
  'Special Rolls': 'Sushi',
  'Rolls Especiales': 'Sushi',
  'Rolls Acevichados': 'Sushi',
  'Rolls Tempura': 'Sushi',
  'Rolls Sin Arroz': 'Sushi',
  'Rolls sin Arroz': 'Sushi',
  'Makis Clásicos - California': 'Sushi',
  'Makis Clásicos - Envueltos en Palta': 'Sushi',
  'Makis Clásicos - Envueltos en Panko': 'Sushi',
  'Makis Clásicos - Envueltos en Queso': 'Sushi',
  'ROLL COBERTURA DE PALTA': 'Sushi',
  'ROLL COBERTURA DE PANKO': 'Sushi',
  'ROLL COBERTURA DE QUESO CREMA': 'Sushi',
  'ROLL COBERTURA DE SALMON': 'Sushi',
  'ROLL COBERTURA EN TEMPURA': 'Sushi',
  'Sushi de autor / Rolls Nikkei': 'Sushi',
  'Sushis de Autor': 'Sushi',
  'Sushi promos': 'Sushi',
  'PROMOCIONES DE SUSHI': 'Sushi',
  'PROMOS DE HANDROLL': 'Sushi',
  'Promociones y Sets de Piezas': 'Sushi',
  'Tablas de sushi': 'Sushi',
  'Tradicional Japones': 'Sushi',
  'Chirashis / Gohans': 'Sushi',
  'Gohan': 'Sushi',
  'Avocado / Sake': 'Sushi',

  // ─── Ceviches & Mariscos ────────────────────────────────────
  'Ceviches': 'Ceviches',
  'Ceviche': 'Ceviches',
  'CEVICHES': 'Ceviches',
  'Ceviches Y Tiraditos': 'Ceviches',
  'Pescados y Mariscos': 'Ceviches',
  'Pescados': 'Ceviches',
  'Mariscos': 'Ceviches',
  'Carpaccio': 'Ceviches',

  // ─── Pizzas ─────────────────────────────────────────────────
  'Pizzas': 'Pizzas',
  'Pizza': 'Pizzas',
  'PIZZAS': 'Pizzas',
  'Pizza a la piedra 40d.': 'Pizzas',
  'Pizza a la piedra INDIVIDUAL': 'Pizzas',
  'Pizzas Speciali': 'Pizzas',
  'Pizzas Tradizionali': 'Pizzas',
  'Arma Tu Pizza': 'Pizzas',
  'Calzone': 'Pizzas',
  'Fugazzas': 'Pizzas',

  // ─── Hamburguesas ───────────────────────────────────────────
  'Hamburguesas': 'Hamburguesas',
  'Hamburguesa': 'Hamburguesas',
  'Burgers': 'Hamburguesas',
  'Hamburguesas XL': 'Hamburguesas',
  'Hamburguesas c/ Papas': 'Hamburguesas',

  // ─── Completos & Hot Dogs ───────────────────────────────────
  'Completos': 'Completos',
  'Completos Especial': 'Completos',
  'Perros Calientes': 'Completos',

  // ─── Sándwiches ─────────────────────────────────────────────
  'Sandwiches': 'Sándwiches',
  'Sandwich': 'Sándwiches',
  'SANDWICH': 'Sándwiches',
  'SANDWICHES': 'Sándwiches',
  'Sándwiches': 'Sándwiches',
  'Sánguchez': 'Sándwiches',
  'Sandwichs': 'Sándwiches',
  'Sandwich y Hamburguesas': 'Sándwiches',
  'Antojos Salados - Sandwich': 'Sándwiches',
  'SANDWICHERIA "LOS CLASICOS DE SIEMPRE"': 'Sándwiches',
  'SANDWICHERIA "SELECCION OASIS"': 'Sándwiches',
  'PROMO SANDWICH': 'Sándwiches',
  'Panes Ciabatta': 'Sándwiches',
  'Churrascos': 'Sándwiches',
  'Churrasco Carne': 'Sándwiches',
  'Churrascos de Pollo': 'Sándwiches',
  'Lomo': 'Sándwiches',
  'Lomos c/ Papas': 'Sándwiches',
  'Pepitos': 'Sándwiches',

  // ─── Saludable (ensaladas, vegano) ────────────────────────
  'Ensaladas': 'Saludable',
  'Ensalada': 'Saludable',
  'Cremas y Ensaladas': 'Saludable',
  'Antojos Salados - Ensaladas': 'Saludable',
  '100% Vegano': 'Saludable',
  'Aperitivos 100% Veganos': 'Saludable',

  // ─── Entradas ───────────────────────────────────────────────
  'Entradas': 'Entradas',
  'Entrada': 'Entradas',
  'Entradas Frías': 'Entradas',
  'Entradas para compartir': 'Entradas',
  'Para Comenzar': 'Entradas',
  'Aperitivos': 'Entradas',
  'Para Compartir': 'Entradas',
  'Para compartir': 'Entradas',
  'PARA COMPARTIR': 'Entradas',
  'Pa Partir': 'Entradas',
  'Tablas Para Compartir': 'Entradas',
  'Picoteos': 'Entradas',
  'Piqueos': 'Entradas',
  'Antipasti': 'Entradas',
  'Gyosas y más': 'Entradas',

  // ─── Platos de fondo ───────────────────────────────────────
  'Platos Principales': 'Platos de fondo',
  'Platos principales': 'Platos de fondo',
  'Platos Calientes': 'Platos de fondo',
  'Platos De Fondo': 'Platos de fondo',
  'Platos de fondo': 'Platos de fondo',
  'Platos del Cheff': 'Platos de fondo',
  'Platos Preparados': 'Platos de fondo',
  'Platos,Tablas y Ensaladas': 'Platos de fondo',
  'Platos Niños': 'Platos de fondo',
  'Platos de Carne': 'Platos de fondo',
  'Platos con Pollo': 'Platos de fondo',
  'Platos con Vacuno': 'Platos de fondo',
  'Fondos': 'Platos de fondo',
  'Especialidad de la casa': 'Platos de fondo',
  'Especiales': 'Platos de fondo',
  'Recomendaciones': 'Platos de fondo',
  'Menú Clásico': 'Platos de fondo',
  'ALMUERZOS': 'Platos de fondo',
  'Guisos y Estofados': 'Platos de fondo',
  'Sopas': 'Platos de fondo',
  'Sopas y Caldos': 'Platos de fondo',
  'Carnes y Risottos': 'Platos de fondo',
  'Risottos': 'Platos de fondo',

  // ─── Peruana ──────────────────────────────────────────────
  'Tradiciones Peruanas': 'Peruana',
  'Comida Peruana': 'Peruana',
  'Peruana': 'Peruana',

  // ─── Parrilla ─────────────────────────────────────────────
  'Parrilladas': 'Parrilla',
  'Parrilla': 'Parrilla',
  'Carnes': 'Parrilla',
  'Chorrillanas': 'Parrilla',

  // ─── Pollo y alitas ──────────────────────────────────────
  'Pollo': 'Pollo y alitas',
  'Pollo Crispy': 'Pollo y alitas',
  'Buckets De Pollo Frito': 'Pollo y alitas',
  'Pollo Frito': 'Pollo y alitas',
  'Alitas': 'Pollo y alitas',
  'Wings': 'Pollo y alitas',

  // ─── Empanadas ──────────────────────────────────────────────
  'Empanadas': 'Empanadas',
  'Empanadas Fritas': 'Empanadas',

  // ─── Mexicana ───────────────────────────────────────────────
  'Fajitas': 'Mexicana',
  'Tacos': 'Mexicana',
  'Burritos': 'Mexicana',
  'Quesadillas': 'Mexicana',
  'QUESADILLAS': 'Mexicana',
  'Nachos': 'Mexicana',
  'Arepas': 'Arepas & Venezolana',

  // ─── Thai ─────────────────────────────────────────────────
  'Asian Street Food': 'Thai',
  'Fideos de Arroz': 'Thai',
  'Thai': 'Thai',
  'Comida Thai': 'Thai',

  // ─── China ────────────────────────────────────────────────
  'Arroz Chino': 'China',
  'Arroz': 'China',
  'China': 'China',
  'Comida China': 'China',

  // ─── India ────────────────────────────────────────────────
  'Currys': 'India',
  'India': 'India',
  'Comida India': 'India',

  // ─── Asiática (genérica) ──────────────────────────────────
  'Orientales': 'Asiática',

  // ─── Pastas ─────────────────────────────────────────────────
  'Pastas': 'Pastas',
  'Pasta': 'Pastas',
  'Espaguetti': 'Pastas',
  'Arma tu plato de pasta': 'Pastas',

  // ─── Postres ────────────────────────────────────────────────
  'Postres': 'Postres',
  'POSTRES': 'Postres',
  'Postres y Bebidas': 'Postres',
  'Toque Dulce': 'Postres',
  'Dulces Momentos': 'Postres',
  'CHEESECAKE': 'Postres',
  'TORTAS': 'Postres',
  'OTROS PASTELES': 'Postres',
  'DUBAI COLLECTION DESSERTS': 'Postres',
  'Ice Cream': 'Postres',
  'HELADOS ARTESANALES': 'Postres',
  'HELADOS SIN AZÚCAR': 'Postres',
  'CREPES DULCES': 'Postres',
  'WAFFLES DULCES': 'Postres',
  'PROMO PASTELES': 'Postres',

  // ─── Cafetería (bebidas calientes — se infieren como drink)
  'Cafetería': 'Cafetería',
  'CAFETERIA': 'Cafetería',
  'Cafeteria': 'Cafetería',
  'Café': 'Cafetería',
  'Cafe Frio': 'Cafetería',
  'CAFÉ GELATO': 'Cafetería',
  'CAFÉS - CHOCOLATES CALIENTES - INFUSIONES O TÉ': 'Cafetería',
  'Cafés Y Tés': 'Cafetería',
  'Café Arábica Especialidad - Con Leche': 'Cafetería',
  'Café Arábica Especialidad - Espresso Bar': 'Cafetería',
  'Café Arábica Frío': 'Cafetería',
  'Bebidas Calientes - Café': 'Cafetería',
  'Bebidas Calientes - Chocolate Caliente': 'Cafetería',
  'Bebidas Calientes - Té e Infusiones': 'Cafetería',
  'Bebidas Frías - Café y Té': 'Cafetería',
  'Para Llevar o Encargar - Café para disfrutar en casa': 'Cafetería',
  'Hot Drinks': 'Cafetería',

  // ─── Desayunos & Brunch (comida) ──────────────────────────
  'BOLLERIA': 'Desayunos',
  'PROMO BOLLERIA': 'Desayunos',
  'CREPES SALADAS': 'Desayunos',
  'WAFFLES SALADOS': 'Desayunos',
  'Desayunos': 'Desayunos',
  'DESAYUNOS': 'Desayunos',
  'Desayunos (Hasta las 12:30 hrs)': 'Desayunos',
  'Desayunos de Casa': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Desayuno': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Brunch': 'Desayunos',
  'Antojos Salados - Tostadas': 'Desayunos',

  // ─── Combos & Promos ────────────────────────────────────────
  'Combos': 'Combos',
  'Combos Mostrito': 'Combos',
  'Promociones': 'Combos',
  'Promociones Mix': 'Combos',
  'Promociones Premium': 'Combos',
  'Promociones de la semana hasta las 21Hs': 'Combos',
  'Menús': 'Combos',
  'Menú Kids': 'Combos',
  'Para los más pequeños': 'Combos',

  // ─── Acompañamientos & Extras ───────────────────────────────
  'Acompañamientos': 'Acompañamientos',
  'Papas Fritas': 'Acompañamientos',
  'Guarniciones': 'Acompañamientos',
  'Fritas': 'Acompañamientos',
  'Salchipapa': 'Acompañamientos',
  'POP CORN': 'Acompañamientos',
  'AGREGA A TU SANDWICH': 'Extras',
  'Adicionales': 'Extras',
  'Extras': 'Extras',
  'Salsa Extra': 'Extras',
  'Salsas': 'Extras',
  'Salsas y Extras': 'Extras',
}

/** Solo se excluyen extras/salsas (no son platos ni bebidas reales) */
export const EXCLUDED_CATEGORIES = new Set([
  'Extras', 'Adicionales', 'Salsa Extra', 'Salsas', 'Salsas y Extras',
  'AGREGA A TU SANDWICH',
])

/** Normaliza una categoría de la BD. Si no está en el mapa, usa el nombre original. */
export function normalizeCategory(name: string): string {
  return CATEGORY_MAP[name] ?? name
}

/** Verifica si una categoría debe excluirse del feed */
export function isExcludedCategory(name: string): boolean {
  if (EXCLUDED_CATEGORIES.has(name)) return true
  const norm = CATEGORY_MAP[name]
  if (norm === 'Extras') return true
  return false
}

/** Categorías normalizadas que son bebidas (override dishType de BD) */
const DRINK_CATEGORIES = new Set(['Cafetería'])

/** Override dishType de la BD cuando la categoría normalizada indica otra cosa */
export function inferDishType(categoriaNorm: string, dbDishType: string): string {
  if (DRINK_CATEGORIES.has(categoriaNorm)) return 'drink'
  return dbDishType
}

/** Categorías normalizadas que son desayuno */
export const BREAKFAST_CATEGORIES = new Set([
  'Desayunos', 'Cafetería',
])

/** Inferir momento del día de un plato basado en su categoría normalizada */
export type MealTime = 'desayuno' | 'almuerzo_cena'

export function inferMealTime(categoriaNorm: string): MealTime {
  if (BREAKFAST_CATEGORIES.has(categoriaNorm)) return 'desayuno'
  return 'almuerzo_cena'
}

/** Sugerir momento del día según la hora actual */
export function getSuggestedMealTime(): { mealTime: MealTime; label: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { mealTime: 'desayuno', label: 'Desayunos' }
  return { mealTime: 'almuerzo_cena', label: 'Almuerzos y cenas' }
}

/** Mapa de adyacencia — para recomendaciones de descubrimiento */
export const ADJACENT_CATEGORIES: Record<string, string[]> = {
  'Sushi': ['Ceviches', 'Thai', 'China'],
  'Ceviches': ['Sushi', 'Peruana', 'Entradas'],
  'Hamburguesas': ['Sándwiches', 'Combos', 'Completos', 'Pollo y alitas'],
  'Sándwiches': ['Hamburguesas', 'Completos'],
  'Completos': ['Hamburguesas', 'Sándwiches'],
  'Pizzas': ['Combos', 'Hamburguesas', 'Pastas'],
  'Parrilla': ['Entradas', 'Empanadas', 'Platos de fondo'],
  'Platos de fondo': ['Parrilla', 'Pastas', 'Peruana'],
  'Entradas': ['Ceviches', 'Saludable'],
  'Saludable': ['Entradas', 'Peruana'],
  'Empanadas': ['Parrilla', 'Entradas'],
  'Mexicana': ['Entradas', 'Parrilla', 'Arepas & Venezolana'],
  'Arepas & Venezolana': ['Mexicana', 'Sándwiches'],
  'Thai': ['China', 'India', 'Sushi'],
  'China': ['Thai', 'India', 'Sushi'],
  'India': ['Thai', 'China'],
  'Peruana': ['Ceviches', 'Platos de fondo', 'Mexicana'],
  'Pollo y alitas': ['Hamburguesas', 'Sándwiches', 'Parrilla'],
  'Asiática': ['Sushi', 'Thai', 'China', 'India'],
  'Postres': ['Cafetería', 'Desayunos'],
  'Cafetería': ['Postres', 'Desayunos'],
  'Desayunos': ['Cafetería', 'Postres'],
  'Pastas': ['Pizzas', 'Platos de fondo'],
}

/** Gradientes por categoría normalizada — fallback cuando no hay foto */
export const CATEGORY_GRADIENTS: Record<string, string> = {
  'Sushi':       'linear-gradient(135deg, #1a1a2e, #e94560)',
  'Ceviches':    'linear-gradient(135deg, #0f3460, #16c79a)',
  'Pizzas':              'linear-gradient(135deg, #b83b5e, #f08a5d)',
  'Hamburguesas':        'linear-gradient(135deg, #3d1e00, #f4a623)',
  'Completos':           'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Sándwiches':          'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Saludable':           'linear-gradient(135deg, #1b4332, #52b788)',
  'Entradas':            'linear-gradient(135deg, #3a0ca3, #f72585)',
  'Postres':             'linear-gradient(135deg, #7b2869, #f4a9c0)',
  'Parrilla':            'linear-gradient(135deg, #2d0000, #c1121f)',
  'Platos de fondo':     'linear-gradient(135deg, #2d0000, #a4161a)',
  'Empanadas':           'linear-gradient(135deg, #6b4226, #d4a373)',
  'Mexicana':            'linear-gradient(135deg, #3d0c02, #e36414)',
  'Arepas & Venezolana': 'linear-gradient(135deg, #3d0c02, #e6a157)',
  'Thai':                'linear-gradient(135deg, #4a1942, #e6a157)',
  'China':               'linear-gradient(135deg, #8b0000, #d4a373)',
  'India':               'linear-gradient(135deg, #b8860b, #e36414)',
  'Peruana':             'linear-gradient(135deg, #8b4513, #f4a623)',
  'Pollo y alitas':      'linear-gradient(135deg, #8b4513, #f08a5d)',
  'Asiática':            'linear-gradient(135deg, #1a1a2e, #d4a373)',
  'Combos':              'linear-gradient(135deg, #1b1b2f, #f4a623)',
  'Acompañamientos':     'linear-gradient(135deg, #4a4e69, #c9ada7)',
  'Cafetería':           'linear-gradient(135deg, #2b1a0e, #a67c52)',
  'Desayunos':           'linear-gradient(135deg, #4a3728, #f4a623)',
  'Pastas':              'linear-gradient(135deg, #6b4226, #e6a157)',
}

export const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #f4a623)'

export function getCategoryGradient(categoriaNorm: string): string {
  return CATEGORY_GRADIENTS[categoriaNorm] ?? DEFAULT_GRADIENT
}

/** Categorías del feed para los chips de UI */
export type DisplayCategory = {
  icon: string
  label: string
  norm: string
}

export function getDisplayCategories(): DisplayCategory[] {
  return [
    { icon: '🍔', label: 'Hamburguesas', norm: 'Hamburguesas' },
    { icon: '🍕', label: 'Pizzas', norm: 'Pizzas' },
    { icon: '🍣', label: 'Sushi', norm: 'Sushi' },
    { icon: '🌮', label: 'Mexicana', norm: 'Mexicana' },
    { icon: '🍛', label: 'Peruana', norm: 'Peruana' },
    { icon: '🇹🇭', label: 'Thai', norm: 'Thai' },
    { icon: '🥡', label: 'China', norm: 'China' },
    { icon: '🍛', label: 'India', norm: 'India' },
    { icon: '🥩', label: 'Parrilla', norm: 'Parrilla' },
    { icon: '🐟', label: 'Ceviches', norm: 'Ceviches' },
    { icon: '🍗', label: 'Pollo', norm: 'Pollo y alitas' },
    { icon: '🥪', label: 'Sándwiches', norm: 'Sándwiches' },
    { icon: '🥗', label: 'Saludable', norm: 'Saludable' },
    { icon: '🍰', label: 'Postres', norm: 'Postres' },
    { icon: '🥐', label: 'Desayunos', norm: 'Desayunos' },
    { icon: '☕', label: 'Cafetería', norm: 'Cafetería' },
  ]
}
