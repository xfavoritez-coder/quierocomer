import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Restaurantes en el feed (mismas condiciones que feed-queries.ts)
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
      OR: [
        { googleMapsUrl: { not: null }, googleRating: { not: null } },
        { isShowcase: true },
      ],
    },
    select: { id: true, name: true },
  })
  console.log(`Restaurantes en el feed: ${restaurants.length}`)

  const ids = restaurants.map(r => r.id)

  // Total platos activos con foto y precio > 0
  const totalPlatos = await prisma.dish.count({
    where: {
      restaurantId: { in: ids },
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
      price: { gt: 0 },
    },
  })

  // Platos SIN taxonomía (txDishType vacío)
  const sinTax = await prisma.dish.count({
    where: {
      restaurantId: { in: ids },
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
      price: { gt: 0 },
      txDishType: { isEmpty: true },
    },
  })

  // Platos CON taxonomía
  const conTax = totalPlatos - sinTax

  const BATCH_SIZE = 30
  const CONCURRENCY = 2
  const SECS_PER_BATCH = 4

  const batchesTodos = Math.ceil(totalPlatos / BATCH_SIZE)
  const batchesSinTax = Math.ceil(sinTax / BATCH_SIZE)

  const minsTodos = Math.round((batchesTodos / CONCURRENCY) * SECS_PER_BATCH / 60)
  const minsSinTax = Math.round((batchesSinTax / CONCURRENCY) * SECS_PER_BATCH / 60)

  // Estimado de costo: ~800 tokens input + 200 output por plato, precio Sonnet ~$3/Mtok input, $15/Mtok output
  const costTodos = ((totalPlatos * 800 * 3) + (totalPlatos * 200 * 15)) / 1_000_000
  const costSinTax = ((sinTax * 800 * 3) + (sinTax * 200 * 15)) / 1_000_000

  console.log(`\n--- Platos ---`)
  console.log(`Total con foto y precio > 0: ${totalPlatos}`)
  console.log(`Con taxonomía: ${conTax}`)
  console.log(`Sin taxonomía: ${sinTax}`)

  console.log(`\n--- Si clasificamos TODOS ---`)
  console.log(`Batches de ${BATCH_SIZE}: ${batchesTodos}`)
  console.log(`Tiempo estimado (concurrencia ${CONCURRENCY}): ~${minsTodos} min`)
  console.log(`Costo estimado: ~$${costTodos.toFixed(2)} USD`)

  console.log(`\n--- Si clasificamos solo los SIN taxonomía ---`)
  console.log(`Batches de ${BATCH_SIZE}: ${batchesSinTax}`)
  console.log(`Tiempo estimado (concurrencia ${CONCURRENCY}): ~${minsSinTax} min`)
  console.log(`Costo estimado: ~$${costSinTax.toFixed(2)} USD`)

  // Top 10 restaurantes con más platos sin taxonomía
  const porRestaurant = await prisma.dish.groupBy({
    by: ['restaurantId'],
    where: {
      restaurantId: { in: ids },
      isActive: true,
      deletedAt: null,
      txDishType: { isEmpty: true },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const restMap = Object.fromEntries(restaurants.map(r => [r.id, r.name]))
  console.log(`\n--- Top 10 restaurantes con más platos sin taxonomía ---`)
  for (const r of porRestaurant) {
    console.log(` ${r._count.id.toString().padStart(3)} platos — ${restMap[r.restaurantId]}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
