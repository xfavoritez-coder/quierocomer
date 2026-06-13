import { prisma } from '../src/lib/prisma'
import { CATEGORY_MAP } from '../src/app/a/lib/categories'

async function main() {
  const cats = await prisma.category.findMany({
    where: { dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    select: { name: true, _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } } }
  })

  const pf = cats.filter(c => (CATEGORY_MAP[c.name] || c.name) === 'Platos de fondo')
  console.log('Categorías que mapean a "Platos de fondo":')
  pf.forEach(c => console.log(`  "${c.name}" → ${c._count.dishes} platos`))
  console.log('Total:', pf.reduce((s, c) => s + c._count.dishes, 0))

  await prisma.$disconnect()
}
main()
