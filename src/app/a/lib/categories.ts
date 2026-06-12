// ─── Normalización de categorías ───────────────────────────────────────
// Un solo archivo con todo lo relacionado a categorías del feed.
// Se usa para scoring, chips en Explorar, motivos de recomendación y gradientes.

/** Mapea nombres de categoría de la BD → categoría normalizada del feed */
export const CATEGORY_MAP: Record<string, string> = {
  // ─── Sushi & Rolls ──────────────────────────────────────────
  'Sushi': 'Sushi & Rolls',
  'SUSHI': 'Sushi & Rolls',
  'SUSHI DE LA CASA': 'Sushi & Rolls',
  'Handrolls': 'Sushi & Rolls',
  'Hand Rolls': 'Sushi & Rolls',
  'HAND ROLL': 'Sushi & Rolls',
  'California Rolls': 'Sushi & Rolls',
  'Nikkei Rolls': 'Sushi & Rolls',
  'Rolls': 'Sushi & Rolls',
  'Temakis': 'Sushi & Rolls',
  'Nigiri': 'Sushi & Rolls',
  'Sashimi': 'Sushi & Rolls',
  'SASHIMI': 'Sushi & Rolls',
  'Futomaki': 'Sushi & Rolls',
  'Hot Rolls': 'Sushi & Rolls',
  'Especial Rolls': 'Sushi & Rolls',
  'Special Rolls': 'Sushi & Rolls',
  'Rolls Especiales': 'Sushi & Rolls',
  'Rolls Acevichados': 'Sushi & Rolls',
  'Rolls Tempura': 'Sushi & Rolls',
  'Rolls Sin Arroz': 'Sushi & Rolls',
  'Rolls sin Arroz': 'Sushi & Rolls',
  'Makis Clásicos - California': 'Sushi & Rolls',
  'Makis Clásicos - Envueltos en Palta': 'Sushi & Rolls',
  'Makis Clásicos - Envueltos en Panko': 'Sushi & Rolls',
  'Makis Clásicos - Envueltos en Queso': 'Sushi & Rolls',
  'ROLL COBERTURA DE PALTA': 'Sushi & Rolls',
  'ROLL COBERTURA DE PANKO': 'Sushi & Rolls',
  'ROLL COBERTURA DE QUESO CREMA': 'Sushi & Rolls',
  'ROLL COBERTURA DE SALMON': 'Sushi & Rolls',
  'ROLL COBERTURA EN TEMPURA': 'Sushi & Rolls',
  'Sushi de autor / Rolls Nikkei': 'Sushi & Rolls',
  'Sushis de Autor': 'Sushi & Rolls',
  'Sushi promos': 'Sushi & Rolls',
  'PROMOCIONES DE SUSHI': 'Sushi & Rolls',
  'PROMOS DE HANDROLL': 'Sushi & Rolls',
  'Promociones y Sets de Piezas': 'Sushi & Rolls',
  'Tablas de sushi': 'Sushi & Rolls',
  'Tradicional Japones': 'Sushi & Rolls',
  'Chirashis / Gohans': 'Sushi & Rolls',
  'Gohan': 'Sushi & Rolls',
  'Avocado / Sake': 'Sushi & Rolls',

  // ─── Ceviches & Mariscos ────────────────────────────────────
  'Ceviches': 'Ceviches & Mariscos',
  'Ceviche': 'Ceviches & Mariscos',
  'CEVICHES': 'Ceviches & Mariscos',
  'Ceviches Y Tiraditos': 'Ceviches & Mariscos',
  'Pescados y Mariscos': 'Ceviches & Mariscos',
  'Pescados': 'Ceviches & Mariscos',
  'Mariscos': 'Ceviches & Mariscos',
  'Carpaccio': 'Ceviches & Mariscos',

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

  // ─── Sandwiches ─────────────────────────────────────────────
  'Sandwiches': 'Sandwiches',
  'Sandwich': 'Sandwiches',
  'SANDWICH': 'Sandwiches',
  'SANDWICHES': 'Sandwiches',
  'Sándwiches': 'Sandwiches',
  'Sánguchez': 'Sandwiches',
  'Sandwichs': 'Sandwiches',
  'Sandwich y Hamburguesas': 'Sandwiches',
  'SANDWICHERIA "LOS CLASICOS DE SIEMPRE"': 'Sandwiches',
  'SANDWICHERIA "SELECCION OASIS"': 'Sandwiches',
  'PROMO SANDWICH': 'Sandwiches',
  'Panes Ciabatta': 'Sandwiches',
  'Churrascos': 'Sandwiches',
  'Churrasco Carne': 'Sandwiches',
  'Churrascos de Pollo': 'Sandwiches',
  'Lomo': 'Sandwiches',
  'Lomos c/ Papas': 'Sandwiches',
  'Pepitos': 'Sandwiches',

  // ─── Ensaladas ──────────────────────────────────────────────
  'Ensaladas': 'Ensaladas',
  'Ensalada': 'Ensaladas',
  'Cremas y Ensaladas': 'Ensaladas',

  // ─── Entradas ───────────────────────────────────────────────
  'Entradas': 'Entradas',
  'Entrada': 'Entradas',
  'Entradas Frías': 'Entradas',
  'Entradas para compartir': 'Entradas',
  'Para Comenzar': 'Entradas',
  'Aperitivos': 'Entradas',
  'Aperitivos 100% Veganos': 'Entradas',
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
  'Tradiciones Peruanas': 'Platos de fondo',
  'Guisos y Estofados': 'Platos de fondo',
  'Sopas': 'Platos de fondo',
  'Sopas y Caldos': 'Platos de fondo',
  'Carnes y Risottos': 'Platos de fondo',
  'Risottos': 'Platos de fondo',

  // ─── Parrilla & Carnes ─────────────────────────────────────
  'Parrilladas': 'Parrilla & Carnes',
  'Parrilla': 'Parrilla & Carnes',
  'Carnes': 'Parrilla & Carnes',
  'Pollo': 'Parrilla & Carnes',
  'Pollo Crispy': 'Parrilla & Carnes',
  'Buckets De Pollo Frito': 'Parrilla & Carnes',
  'Chorrillanas': 'Parrilla & Carnes',

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

  // ─── Asiática ───────────────────────────────────────────────
  'Asian Street Food': 'Asiática',
  'Orientales': 'Asiática',
  'Currys': 'Asiática',
  'Fideos de Arroz': 'Asiática',
  'Arroz': 'Asiática',
  'Arroz Chino': 'Asiática',

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

  // ─── Cafetería & Desayunos ──────────────────────────────────
  'Cafetería': 'Cafetería',
  'CAFETERIA': 'Cafetería',
  'BOLLERIA': 'Cafetería',
  'PROMO BOLLERIA': 'Cafetería',
  'CREPES SALADAS': 'Cafetería',
  'WAFFLES SALADOS': 'Cafetería',
  'Desayunos': 'Desayunos',
  'DESAYUNOS': 'Desayunos',
  'Desayunos (Hasta las 12:30 hrs)': 'Desayunos',
  'Desayunos de Casa': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Desayuno': 'Desayunos',
  'Mañanas Deliciosas (09:00 a 14:00 hrs) - Brunch': 'Desayunos',

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

  // ─── Vegano ─────────────────────────────────────────────────
  '100% Vegano': 'Vegano',
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
  'Sushi & Rolls': ['Ceviches & Mariscos', 'Asiática'],
  'Ceviches & Mariscos': ['Sushi & Rolls', 'Entradas'],
  'Hamburguesas': ['Sandwiches', 'Combos', 'Completos'],
  'Sandwiches': ['Hamburguesas', 'Completos'],
  'Completos': ['Hamburguesas', 'Sandwiches'],
  'Pizzas': ['Combos', 'Hamburguesas', 'Pastas'],
  'Parrilla & Carnes': ['Entradas', 'Empanadas', 'Platos de fondo'],
  'Platos de fondo': ['Parrilla & Carnes', 'Pastas', 'Asiática'],
  'Entradas': ['Ceviches & Mariscos', 'Ensaladas'],
  'Ensaladas': ['Entradas', 'Vegano'],
  'Empanadas': ['Parrilla & Carnes', 'Entradas'],
  'Mexicana': ['Entradas', 'Parrilla & Carnes', 'Arepas & Venezolana'],
  'Arepas & Venezolana': ['Mexicana', 'Sandwiches'],
  'Asiática': ['Sushi & Rolls', 'Platos de fondo'],
  'Postres': ['Cafetería', 'Desayunos'],
  'Cafetería': ['Postres', 'Desayunos'],
  'Desayunos': ['Cafetería', 'Postres'],
  'Pastas': ['Pizzas', 'Platos de fondo'],
  'Vegano': ['Ensaladas', 'Asiática'],
}

/** Gradientes por categoría normalizada — fallback cuando no hay foto */
export const CATEGORY_GRADIENTS: Record<string, string> = {
  'Sushi & Rolls':       'linear-gradient(135deg, #1a1a2e, #e94560)',
  'Ceviches & Mariscos': 'linear-gradient(135deg, #0f3460, #16c79a)',
  'Pizzas':              'linear-gradient(135deg, #b83b5e, #f08a5d)',
  'Hamburguesas':        'linear-gradient(135deg, #3d1e00, #f4a623)',
  'Completos':           'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Sandwiches':          'linear-gradient(135deg, #5c3d2e, #e6a157)',
  'Ensaladas':           'linear-gradient(135deg, #1b4332, #52b788)',
  'Entradas':            'linear-gradient(135deg, #3a0ca3, #f72585)',
  'Postres':             'linear-gradient(135deg, #7b2869, #f4a9c0)',
  'Parrilla & Carnes':   'linear-gradient(135deg, #2d0000, #c1121f)',
  'Platos de fondo':     'linear-gradient(135deg, #2d0000, #a4161a)',
  'Empanadas':           'linear-gradient(135deg, #6b4226, #d4a373)',
  'Mexicana':            'linear-gradient(135deg, #3d0c02, #e36414)',
  'Arepas & Venezolana': 'linear-gradient(135deg, #3d0c02, #e6a157)',
  'Asiática':            'linear-gradient(135deg, #1a1a2e, #d4a373)',
  'Combos':              'linear-gradient(135deg, #1b1b2f, #f4a623)',
  'Acompañamientos':     'linear-gradient(135deg, #4a4e69, #c9ada7)',
  'Cafetería':           'linear-gradient(135deg, #2b1a0e, #a67c52)',
  'Desayunos':           'linear-gradient(135deg, #4a3728, #f4a623)',
  'Pastas':              'linear-gradient(135deg, #6b4226, #e6a157)',
  'Vegano':              'linear-gradient(135deg, #1b4332, #95d5b2)',
}

export const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e, #f4a623)'

export function getCategoryGradient(categoriaNorm: string): string {
  return CATEGORY_GRADIENTS[categoriaNorm] ?? DEFAULT_GRADIENT
}

/** Lista ordenada de categorías normalizadas para los chips de Explorar */
export function getDisplayCategories(): string[] {
  return [
    'Pizzas',
    'Hamburguesas',
    'Sushi & Rolls',
    'Ceviches & Mariscos',
    'Ensaladas',
    'Parrilla & Carnes',
    'Sandwiches',
    'Pastas',
    'Empanadas',
    'Mexicana',
    'Asiática',
    'Postres',
    'Desayunos',
    'Completos',
    'Vegano',
    'Entradas',
  ]
}
