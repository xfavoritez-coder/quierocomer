import { prisma } from '../src/lib/prisma'
import { normalizeCategory, inferMealTime } from '../src/app/a/lib/categories'

async function main() {
  // All categories with photos, grouped by restaurant
  const cats = await prisma.category.findMany({
    where: { dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    select: { name: true, dishType: true, restaurant: { select: { name: true } }, _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } } },
    orderBy: { restaurant: { name: 'asc' } }
  })

  // Find categories that COULD be breakfast but aren't mapped
  const keywords = ['desayuno', 'brunch', 'mañana', 'morning', 'tostada', 'bolleri', 'croissant', 'waffle', 'crepe', 'panque', 'cereal', 'avena', 'granola', 'huevo', 'omelette', 'café', 'cafe', 'cafeteria', 'tea', 'te ', 'chai', 'latte', 'capuccino', 'espresso']

  console.log('=== Categories that might be breakfast but NOT mapped as desayuno ===\n')
  cats.forEach(c => {
    const norm = normalizeCategory(c.name)
    const meal = inferMealTime(norm)
    const lower = c.name.toLowerCase()
    const matches = keywords.some(k => lower.includes(k))
    if (matches && meal !== 'desayuno') {
      console.log(`  "${c.name}" → ${norm} (${meal}) | ${c.restaurant.name} | ${c._count.dishes} dishes | dishType: ${c.dishType}`)
    }
  })

  // La Foresta specifically
  console.log('\n=== La Foresta categories ===')
  cats.filter(c => c.restaurant.name.includes('Foresta')).forEach(c => {
    const norm = normalizeCategory(c.name)
    const meal = inferMealTime(norm)
    console.log(`  "${c.name}" → ${norm} (${meal}) | ${c._count.dishes} dishes | dishType: ${c.dishType}`)
  })

  await prisma.$disconnect()
}
main()
