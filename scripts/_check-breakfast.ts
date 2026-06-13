import { prisma } from '../src/lib/prisma'
import { normalizeCategory, inferMealTime } from '../src/app/a/lib/categories'

async function main() {
  const cats = await prisma.category.findMany({
    where: { dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    select: { name: true, dishType: true, _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } } }
  })

  console.log('Categories that normalize to breakfast:')
  cats.forEach(c => {
    const norm = normalizeCategory(c.name)
    const meal = inferMealTime(norm)
    if (meal === 'desayuno') {
      console.log(`  ${c.name} → ${norm} → ${meal} (${c._count.dishes} dishes, dishType: ${c.dishType})`)
    }
  })

  console.log('\nAll normalized categories and their mealTime:')
  const normSet = new Set<string>()
  cats.forEach(c => normSet.add(normalizeCategory(c.name)))
  ;[...normSet].sort().forEach(n => console.log(`  ${n} → ${inferMealTime(n)}`))

  await prisma.$disconnect()
}
main()
