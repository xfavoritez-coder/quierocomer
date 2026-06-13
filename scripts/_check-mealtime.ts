import { prisma } from '../src/lib/prisma'
import { normalizeCategory, inferMealTime, isExcludedCategory } from '../src/app/a/lib/categories'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { name: true, category: { select: { name: true, dishType: true } } },
    take: 5000,
  })

  let desayuno = 0
  let almuerzo = 0
  let excluded = 0

  for (const d of dishes) {
    if (isExcludedCategory(d.category.name)) { excluded++; continue }
    const norm = normalizeCategory(d.category.name)
    const meal = inferMealTime(norm)
    if (meal === 'desayuno') desayuno++
    else almuerzo++
  }

  console.log(`Desayuno: ${desayuno}, Almuerzo/Cena: ${almuerzo}, Excluidos: ${excluded}`)

  // Show some desayuno dishes
  const breakfastDishes = dishes
    .filter(d => !isExcludedCategory(d.category.name) && inferMealTime(normalizeCategory(d.category.name)) === 'desayuno')
    .slice(0, 10)
  console.log('\nDesayuno dishes:')
  breakfastDishes.forEach(d => console.log(`  ${d.name} | cat: ${d.category.name} | norm: ${normalizeCategory(d.category.name)} | dishType: ${d.category.dishType}`))

  await prisma.$disconnect()
}
main()
