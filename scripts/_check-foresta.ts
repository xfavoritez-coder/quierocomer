import { prisma } from '../src/lib/prisma'

async function main() {
  const r = await prisma.restaurant.findMany({
    where: { name: { contains: 'foresta', mode: 'insensitive' } },
    select: { name: true, slug: true, isActive: true, isDemo: true, _count: { select: { dishes: { where: { isActive: true, deletedAt: null } } } } }
  })
  console.log('Foresta:', JSON.stringify(r, null, 2))

  // Also check categories with desayuno in name
  const cats = await prisma.category.findMany({
    where: {
      name: { contains: 'desayuno', mode: 'insensitive' },
      dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } }
    },
    select: { name: true, restaurant: { select: { name: true } }, _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } } }
  })
  console.log('\nAll desayuno categories with photos:')
  cats.forEach(c => console.log(`  ${c.name} — ${c.restaurant.name} (${c._count.dishes} dishes)`))

  await prisma.$disconnect()
}
main()
