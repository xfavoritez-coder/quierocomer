import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

async function main() {
  const updated = await prisma.restaurant.updateMany({
    where: { slug: { in: ['restaurant-wang-jiao', 'restaurant-xing-xing'] } },
    data: { description: 'Restaurante de comida china' }
  })
  console.log(`✓ ${updated.count} restaurantes actualizados con descripción "comida china"`)
  await prisma.$disconnect()
}
main()
