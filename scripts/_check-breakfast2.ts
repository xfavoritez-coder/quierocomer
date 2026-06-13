import { prisma } from '../src/lib/prisma'

async function main() {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true, deletedAt: null, photos: { isEmpty: false }, price: { gt: 0 },
      restaurant: { isActive: true, isDemo: false },
      category: { name: { in: ['Desayunos', 'DESAYUNOS', 'Desayunos (Hasta las 12:30 hrs)', 'Cafetería', 'CAFETERIA', 'BOLLERIA', 'PROMO BOLLERIA', 'CREPES SALADAS', 'WAFFLES SALADOS'] } }
    },
    select: { name: true, category: { select: { name: true, dishType: true } }, restaurant: { select: { name: true } } },
    take: 10
  })
  console.log('Breakfast dishes with photo:', dishes.length)
  dishes.forEach(d => console.log(`  ${d.name} | ${d.category.name} (${d.category.dishType}) | ${d.restaurant.name}`))
  await prisma.$disconnect()
}
main()
