import { prisma } from '../src/lib/prisma'
import { isExcludedCategory } from '../src/app/a/lib/categories'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { category: { select: { name: true, dishType: true } } },
    take: 5000,
  })

  const counts: Record<string, number> = {}
  for (const d of dishes) {
    if (isExcludedCategory(d.category.name)) continue
    const t = d.category.dishType
    counts[t] = (counts[t] || 0) + 1
  }
  console.log('dishType counts (non-excluded):', counts)

  // Sample entry dishes
  const entries = dishes.filter(d => d.category.dishType === 'entry' && !isExcludedCategory(d.category.name))
  console.log('\nEntry dishes:', entries.length)
  entries.slice(0, 5).forEach(d => console.log(`  cat: ${d.category.name} (${d.category.dishType})`))

  // Sample dessert dishes
  const desserts = dishes.filter(d => d.category.dishType === 'dessert' && !isExcludedCategory(d.category.name))
  console.log('\nDessert dishes:', desserts.length)
  desserts.slice(0, 5).forEach(d => console.log(`  cat: ${d.category.name} (${d.category.dishType})`))

  await prisma.$disconnect()
}
main()
