import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: 'socio', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true }
  })
  if (!r) { console.log('NO ENCONTRADO'); return }
  console.log('RESTAURANTE:', r.id, r.name, r.slug)

  const cats = await prisma.category.findMany({
    where: { restaurantId: r.id },
    select: { id: true, name: true, dishType: true },
    orderBy: { position: 'asc' }
  })
  console.log('\nCATEGORIAS:')
  cats.forEach(c => console.log(' ', c.id, '|', c.name, '|', c.dishType))

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null },
    select: { id: true, name: true, categoryId: true, hiddenFromFeed: true, isActive: true, txDishType: true },
    orderBy: [{ categoryId: 'asc' }, { position: 'asc' }]
  })
  console.log('\nPLATOS (' + dishes.length + ' total):')
  dishes.forEach(d => {
    const cat = cats.find(c => c.id === d.categoryId)
    console.log(
      (d.hiddenFromFeed ? '[HIDDEN]' : '[VIS]  '),
      '|', (cat?.name ?? '?').padEnd(22),
      '|', d.name,
      '|', (d.txDishType ?? []).join(',')
    )
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
