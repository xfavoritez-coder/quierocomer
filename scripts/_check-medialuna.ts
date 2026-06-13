import { prisma } from '../src/lib/prisma'

async function main() {
  const d = await prisma.dish.findFirst({
    where: { name: { contains: 'Medialuna' }, restaurant: { name: { contains: 'Amila' } } },
    select: { name: true, photos: true, category: { select: { name: true } } }
  })
  console.log('Medialuna:', JSON.stringify(d, null, 2))

  // Check all Amila BOLLERIA dishes photos
  const all = await prisma.dish.findMany({
    where: { restaurant: { name: { contains: 'Amila' } }, category: { name: 'BOLLERIA' }, isActive: true },
    select: { name: true, photos: true }
  })
  console.log('\nAmila BOLLERIA dishes:')
  all.forEach(d => console.log(`  ${d.name} | photos: ${d.photos.length > 0 ? d.photos[0].substring(0, 60) + '...' : 'NONE'}`))

  await prisma.$disconnect()
}
main()
