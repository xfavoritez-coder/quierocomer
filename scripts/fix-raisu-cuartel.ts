import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Info actual de Raisu y Cuartel 50
  const raisu = await prisma.restaurant.findUnique({
    where: { slug: 'raisu' },
    select: { id: true, name: true, address: true, lat: true, lng: true, googleMapsUrl: true },
  })
  console.log('Raisu actual:', JSON.stringify(raisu, null, 2))

  const cuartel = await prisma.restaurant.findFirst({
    where: { name: { contains: 'cuartel', mode: 'insensitive' } },
    select: { id: true, name: true, address: true, lat: true, lng: true, googleMapsUrl: true, slug: true },
  })
  console.log('\nCuartel 50:', JSON.stringify(cuartel, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
