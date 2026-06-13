import { prisma } from '../src/lib/prisma'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } },
    select: { name: true, photos: true, restaurant: { select: { name: true } } },
    take: 100,
    orderBy: { createdAt: 'desc' }
  })

  const empty = dishes.filter(d => !d.photos[0] || d.photos[0] === '' || d.photos[0] === 'null')
  console.log(`Total: ${dishes.length}, Empty photo URL: ${empty.length}`)
  empty.forEach(d => console.log(`  ${d.name} | photos: ${JSON.stringify(d.photos)} | ${d.restaurant.name}`))

  // Check total dishes now vs before
  const total = await prisma.dish.count({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 }, restaurant: { isActive: true, isDemo: false } }
  })
  console.log(`\nTotal dishes with photos: ${total}`)

  await prisma.$disconnect()
}
main()
