import { prisma } from '../src/lib/prisma'
import { normalizeCategory, inferMealTime, inferDishType, CATEGORY_MAP } from '../src/app/a/lib/categories'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { name: true, category: { select: { name: true, dishType: true } }, restaurant: { select: { name: true } } },
    take: 5000,
  })

  // All breakfast
  const allBreakfast = dishes.filter(d => {
    const norm = normalizeCategory(d.category.name)
    return inferMealTime(norm) === 'desayuno'
  })

  console.log('Total desayuno (all types):', allBreakfast.length)

  // Split by inferred tipo
  const byTipo: Record<string, number> = {}
  allBreakfast.forEach(d => {
    const norm = normalizeCategory(d.category.name)
    const tipo = inferDishType(norm, d.category.dishType)
    byTipo[tipo] = (byTipo[tipo] || 0) + 1
  })
  console.log('By tipo:', byTipo)

  // By restaurant
  const byRest: Record<string, number> = {}
  allBreakfast.forEach(d => { byRest[d.restaurant.name] = (byRest[d.restaurant.name] || 0) + 1 })
  console.log('\nBy restaurant:')
  Object.entries(byRest).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => console.log(`  ${r}: ${c}`))

  // The ones that are drink (Cafetería override)
  console.log('\nDesayuno drinks (Cafetería → drink):')
  allBreakfast
    .filter(d => inferDishType(normalizeCategory(d.category.name), d.category.dishType) === 'drink')
    .forEach(d => console.log(`  ${d.name} | ${d.category.name} | ${d.restaurant.name}`))

  // Categories that could be breakfast but aren't mapped
  const unmapped = new Set<string>()
  dishes.forEach(d => {
    const name = d.category.name.toLowerCase()
    if ((name.includes('desayuno') || name.includes('brunch') || name.includes('morning') || name.includes('mañana') || name.includes('tostada')) && inferMealTime(normalizeCategory(d.category.name)) !== 'desayuno') {
      unmapped.add(`${d.category.name} → ${normalizeCategory(d.category.name)}`)
    }
  })
  if (unmapped.size > 0) {
    console.log('\nPossible breakfast categories NOT mapped:')
    ;[...unmapped].forEach(u => console.log(`  ${u}`))
  }

  await prisma.$disconnect()
}
main()
