import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'
import { CATEGORY_MAP, isExcludedCategory } from '../src/app/a/lib/categories'

async function main() {
  const cats = await prisma.category.findMany({
    where: { restaurant: { isActive: true, isDemo: false } },
    select: {
      name: true,
      _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } },
      restaurant: { select: { name: true } },
    },
  })

  const notMapped = cats.filter(c => {
    if (c._count.dishes === 0) return false
    const n = c.name.trim()
    if (isExcludedCategory(n)) return false
    if (CATEGORY_MAP[n]) return false
    return true
  })

  notMapped.sort((a, b) => b._count.dishes - a._count.dishes)

  console.log('Categorías sin mapear (con platos con foto):')
  for (const c of notMapped) {
    console.log(`  ${c._count.dishes}\t${c.name}\t(${c.restaurant.name})`)
  }
  console.log(`\nTotal: ${notMapped.length} categorías, ${notMapped.reduce((s, c) => s + c._count.dishes, 0)} platos sin categoría canónica`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e.message)
  await prisma.$disconnect()
})
