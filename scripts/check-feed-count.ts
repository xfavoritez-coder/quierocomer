import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Total restaurantes activos
  const total = await prisma.restaurant.count({ where: { isActive: true, isDemo: false } })
  console.log('Total restaurantes activos (no demo):', total)

  // Restaurantes agregados el 17-18 de junio
  const recientes = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      createdAt: { gte: new Date('2026-06-17T00:00:00Z'), lte: new Date('2026-06-18T23:59:59Z') }
    },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  })
  console.log('\nAgregados 17-18 junio:', recientes.length)
  recientes.forEach(r => console.log(' -', r.name, r.createdAt.toISOString().slice(0,16)))

  const excluirIds = recientes.map(r => r.id)

  // Restaurantes que cumplen condiciones del feed (excluidos los del 17-18 jun)
  const feedCondition: any = {
    isActive: true,
    isDemo: false,
    lat: { not: null },
    lng: { not: null },
    googleMapsUrl: { not: null },
    googleRating: { not: null },
    ...(excluirIds.length > 0 ? { id: { notIn: excluirIds } } : {}),
    dishes: {
      some: {
        isActive: true,
        deletedAt: null,
        hiddenFromFeed: false,
        photos: { isEmpty: false },
        price: { gt: 0 },
        category: {
          dishType: { not: 'drink' }
        }
      }
    }
  }

  const enFeed = await prisma.restaurant.count({ where: feedCondition })
  console.log('\nRestaurantes en el feed (excl. 17-18 jun):', enFeed)

  // Sin restricción de fechas
  const enFeedTotal = await prisma.restaurant.count({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
      googleMapsUrl: { not: null },
      googleRating: { not: null },
      dishes: {
        some: {
          isActive: true,
          deletedAt: null,
          hiddenFromFeed: false,
          photos: { isEmpty: false },
          price: { gt: 0 },
          category: { dishType: { not: 'drink' } }
        }
      }
    }
  })
  console.log('Restaurantes en el feed (total, con 17-18 jun):', enFeedTotal)
}

main().catch(console.error).finally(() => prisma.$disconnect())
