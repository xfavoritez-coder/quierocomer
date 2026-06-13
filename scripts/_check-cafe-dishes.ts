import { prisma } from '../src/lib/prisma'

async function main() {
  // Amila Cafeteria
  const amila = await prisma.dish.findMany({
    where: { restaurant: { name: { contains: 'Amila' } }, isActive: true, deletedAt: null, photos: { isEmpty: false } },
    select: { name: true, category: { select: { name: true, dishType: true } } },
    orderBy: { category: { name: 'asc' } }
  })
  console.log('=== Amila Cafeteria ===')
  amila.forEach(d => console.log(`  ${d.name} | cat: ${d.category.name} | dishType: ${d.category.dishType}`))

  // Terraqueo
  const terra = await prisma.dish.findMany({
    where: { restaurant: { name: { contains: 'Terr' } }, isActive: true, deletedAt: null, photos: { isEmpty: false } },
    select: { name: true, category: { select: { name: true, dishType: true } } },
    orderBy: { category: { name: 'asc' } }
  })
  console.log('\n=== Terraqueo ===')
  terra.forEach(d => console.log(`  ${d.name} | cat: ${d.category.name} | dishType: ${d.category.dishType}`))

  await prisma.$disconnect()
}
main()
