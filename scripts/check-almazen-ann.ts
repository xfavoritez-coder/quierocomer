import { config } from 'dotenv'; config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: 'alma', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })
  console.log('Restaurante:', JSON.stringify(r))

  if (r) {
    const anns = await prisma.announcement.findMany({ where: { restaurantId: r.id } })
    console.log('Announcements:', JSON.stringify(anns, null, 2))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
