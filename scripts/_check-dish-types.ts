import { prisma } from '../src/lib/prisma'

async function main() {
  const types = await prisma.category.groupBy({
    by: ['dishType'],
    where: { dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    _count: true
  })
  console.log('dishType distribution:', types)

  // All categories with their dishType
  const cats = await prisma.category.findMany({
    where: { dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } },
    select: { name: true, dishType: true, _count: { select: { dishes: { where: { isActive: true, deletedAt: null, photos: { isEmpty: false } } } } } },
    orderBy: { name: 'asc' }
  })

  console.log('\nCategories marked as drink:')
  cats.filter(c => c.dishType === 'drink').forEach(c => console.log(`  ${c.name} (${c._count.dishes} dishes)`))

  console.log('\nCategories marked as dessert:')
  cats.filter(c => c.dishType === 'dessert').forEach(c => console.log(`  ${c.name} (${c._count.dishes} dishes)`))

  console.log('\nCategories marked as food (sample):')
  cats.filter(c => c.dishType === 'food').slice(0, 30).forEach(c => console.log(`  ${c.name} (${c._count.dishes} dishes)`))

  await prisma.$disconnect()
}
main()
