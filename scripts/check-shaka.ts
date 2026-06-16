import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

const r = await prisma.restaurant.findUnique({
  where: { slug: 'shaka-burger' },
  select: { id: true, name: true, slug: true, menuImported: true, _count: { select: { dishes: true } } }
})
console.log(JSON.stringify(r, null, 2))
await prisma.$disconnect()
