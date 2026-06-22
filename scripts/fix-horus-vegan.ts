import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: 'horus', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true, website: true, cartaProvider: true }
  })
  if (!r) { console.log('NO ENCONTRADO'); return }
  console.log('ANTES:', JSON.stringify(r, null, 2))

  const updated = await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      website: 'https://www.horusvegan.com',
      cartaProvider: 'mercat',
    },
    select: { id: true, name: true, website: true, cartaProvider: true }
  })
  console.log('\nDESPUÉS:', JSON.stringify(updated, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
