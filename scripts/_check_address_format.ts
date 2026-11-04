import { prisma } from '@/lib/prisma'

async function main() {
  const orders = await prisma.posOrder.findMany({
    where: { addressLine: { contains: 'hile' } },
    select: { addressLine: true, addressParts: true },
    take: 5,
  })
  orders.forEach(o => console.log(JSON.stringify(o)))
}

main().catch(console.error).finally(() => prisma.$disconnect())
