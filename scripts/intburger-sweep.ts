import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: 'intburger' }, select: { id: true, name: true } })
  if (!r) { console.log('No encontrado'); return }
  console.log('Restaurant:', r.id, r.name)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, txDishType: true, price: true },
    orderBy: { name: 'asc' }
  })
  console.log('Total platos:', dishes.length)
  for (const d of dishes) {
    console.log(`[${JSON.stringify(d.txDishType)}] $${d.price} ${d.name}`)
  }
}

main().finally(() => prisma.$disconnect())
