/**
 * Muestra la taxonomía dos-dimensional de Oceanika:
 * leaf (tipo de plato) + cuisineTag (cocina de la sección)
 *
 * Uso: npx ts-node --skip-project scripts/check-oceanika-taxonomy.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SLUG = process.env.SLUG ?? "oceanika-sushi-ii"

// ── Inline de la lógica de resolveDishLeaf ──────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'Sushi': 'Sushi', 'SUSHI': 'Sushi', 'Rolls': 'Sushi', 'Rolls Tempura': 'Sushi',
  'Hot Rolls': 'Sushi', 'Rolls Especiales': 'Sushi', 'Rolls Acevichados': 'Sushi',
  'Rolls Sin Arroz': 'Sushi', 'Handrolls': 'Sushi', 'Temakis': 'Sushi',
  'Nigiri': 'Sushi', 'Sashimi': 'Sushi', 'Gohan': 'Sushi', 'Chirashis / Gohans': 'Sushi',
  'Ceviches': 'Ceviches', 'Mariscos': 'Mariscos', 'Pescados y Mariscos': 'Mariscos',
  'Entradas': 'Entradas', 'Para Compartir': 'Entradas', 'Para compartir': 'Entradas',
  'Postres': 'Postres', 'Combos': 'Combos',
}

const QC_LEAVES = new Set([
  'Sushi', 'Ceviches', 'Mariscos', 'Pizzas', 'Hamburguesas', 'Completos',
  'Sándwiches', 'Saludable', 'Entradas', 'Postres', 'Helados', 'Parrilla',
  'Empanadas', 'Mexicana', 'Venezolana', 'Thai', 'China', 'India', 'Peruana',
  'Pollo y alitas', 'Asiática', 'Pastas', 'Desayunos', 'Cafetería', 'Amasandería',
  'Smoothies', 'Milkshakes', 'Bebidas', 'Bowls', 'Ensaladas', 'Combos',
  'Ramen', 'Gyoza', 'Japonesa', 'Papas fritas', 'Extras',
])

const CUISINE_TAGS = new Set(['Peruana', 'China', 'Thai', 'India', 'Japonesa', 'Italiana', 'Griega'])

const PATTERNS: Array<{ pattern: RegExp; norm: string }> = [
  { pattern: /^rolls?\b/i, norm: 'Sushi' },
  { pattern: /^temakis?\b/i, norm: 'Sushi' },
  { pattern: /^sashimis?\b/i, norm: 'Sushi' },
  { pattern: /^nigiris?\b/i, norm: 'Sushi' },
  { pattern: /^hosomakis?\b/i, norm: 'Sushi' },
  { pattern: /^ceviches?\b/i, norm: 'Ceviches' },
  { pattern: /^tiraditos?\b/i, norm: 'Ceviches' },
  { pattern: /^mariscos?\b/i, norm: 'Mariscos' },
  { pattern: /^pescados?\b/i, norm: 'Mariscos' },
  { pattern: /^entradas?\b/i, norm: 'Entradas' },
  { pattern: /^para\s+(compartir|comenzar)/i, norm: 'Entradas' },
  { pattern: /\bperuana?s?\b|\bperuano\b/i, norm: 'Peruana' },
  { pattern: /^postres?\b/i, norm: 'Postres' },
  { pattern: /^bebidas?\b/i, norm: 'Bebidas' },
  { pattern: /^combos?\b/i, norm: 'Combos' },
]

function normalizeCategory(name: string): string {
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name]
  for (const { pattern, norm } of PATTERNS) {
    if (pattern.test(name.trim())) return norm
  }
  return name
}

function inferFromDishName(text: string): string | null {
  const n = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/sushi|roll\b|maki|temaki|nigiri|uramaki|sashimi/.test(n)) return 'Sushi'
  if (/ceviche|tiradito/.test(n)) return 'Ceviches'
  if (/marisco|jaiba|camaron|langostino|pulpo|calamar|mejillon|\bpescado\b|merluza|reineta|congrio|corvina|trucha\b/.test(n)) return 'Mariscos'
  if (/pollo|pechuga|alita|wing|broaster|tenders/.test(n)) return 'Pollo y alitas'
  if (/\blomo\b|bistec|bife\b|costill|chuleta\b/.test(n)) return 'Parrilla'
  if (/pasta|tallar[ií]n|fettuccin|spaghett|carbonara/.test(n)) return 'Pastas'
  if (/empanada/.test(n)) return 'Empanadas'
  if (/ensalada/.test(n)) return 'Ensaladas'
  if (/gyoza|dumpling/.test(n)) return 'Gyoza'
  if (/ramen/.test(n)) return 'Ramen'
  if (/yakimeshi|yakisoba|yakiudon|teriyaki|katsu\b|tonkatsu|udon\b|tempura|karaage|donburi/.test(n)) return 'Japonesa'
  if (/arepa|cachapa|tequeno/.test(n)) return 'Venezolana'
  if (/taco|burrito|quesadilla|fajita/.test(n)) return 'Mexicana'
  if (/postre|torta\b|brownie|mousse|cheesecake|waffle/.test(n)) return 'Postres'
  if (/helado|ice\s*cream/.test(n)) return 'Helados'
  return null
}

function resolveDishLeaf(dishName: string, catName: string, description: string | null): string {
  const catNorm = normalizeCategory(catName)
  if (QC_LEAVES.has(catNorm) && !CUISINE_TAGS.has(catNorm)) return catNorm
  // Si es cocina, inferir tipo desde nombre primero
  const fromName = inferFromDishName(dishName)
  if (fromName) return fromName
  // Fallback a descripción
  if (description) {
    const fromDesc = inferFromDishName(description)
    if (fromDesc) return fromDesc
  }
  // Último recurso: usar la cocina misma como leaf
  if (QC_LEAVES.has(catNorm)) return catNorm
  return '—'
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  })
  if (!restaurant) { console.error(`No encontré: ${SLUG}`); process.exit(1) }
  console.log(`\n🍣 ${restaurant.name}\n${'─'.repeat(60)}`)

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    select: {
      name: true, cuisineTag: true,
      dishes: {
        where: { deletedAt: null, isActive: true },
        select: { name: true, description: true, flavorTags: true, dishDiet: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  })

  for (const cat of categories) {
    const tag = cat.cuisineTag ? ` [cocina: ${cat.cuisineTag}]` : ''
    console.log(`\n📂 ${cat.name}${tag}`)
    for (const dish of cat.dishes) {
      const leaf = resolveDishLeaf(dish.name, cat.name, dish.description)
      const flavors = (dish.flavorTags as string[]).length > 0 ? ` 🔸${(dish.flavorTags as string[]).join(', ')}` : ''
      const diet = dish.dishDiet !== 'OMNIVORE' ? ` 🥦${dish.dishDiet}` : ''
      console.log(`   ${dish.name}`)
      console.log(`     → leaf: ${leaf}${flavors}${diet}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
