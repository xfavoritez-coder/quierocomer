import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
})

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true, isDemo: false },
    select: { name: true, slug: true, address: true },
    orderBy: { name: 'asc' }
  })

  const withAddr = restaurants.filter(r => r.address && r.address.trim().length > 0)
  const withoutAddr = restaurants.filter(r => !r.address || r.address.trim().length === 0)

  console.log(`Con dirección: ${withAddr.length}`)
  withAddr.forEach(r => console.log(`  ✓ ${r.name} — ${r.address}`))

  console.log(`\nSin dirección: ${withoutAddr.length}`)
  withoutAddr.forEach(r => console.log(`  ✗ ${r.name} (${r.slug})`))

  await prisma.$disconnect()
}
main()
