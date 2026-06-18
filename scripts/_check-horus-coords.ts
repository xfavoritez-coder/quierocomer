import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })
async function main() {
  const r = await prisma.restaurant.findFirst({ 
    where: { name: { contains: 'Horus', mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true, slug: true, lat: true, lng: true, googlePlaceId: true }
  })
  console.log(JSON.stringify(r, null, 2))
  await prisma.$disconnect()
}
main()
