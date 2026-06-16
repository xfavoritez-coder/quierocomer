import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: 'restaurant-xing-xing' },
    select: {
      id: true, name: true, isActive: true, lat: true, lng: true,
      googleRating: true, googleMapsUrl: true,
      _count: {
        select: {
          dishes: { where: { isActive: true, deletedAt: null } }
        }
      }
    }
  })
  console.log('Restaurante:', JSON.stringify(r, null, 2))

  // Platos con fotos
  const withPhotos = await prisma.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(*) as count FROM "Dish" d
    WHERE d."restaurantId" = ${r!.id}
    AND d."isActive" = true
    AND d."deletedAt" IS NULL
    AND array_length(d.photos, 1) > 0
    AND d.price > 0
  `
  console.log('Platos con fotos y precio > 0:', Number(withPhotos[0].count))

  await prisma.$disconnect()
}
main()
