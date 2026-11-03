import { prisma } from '@/lib/prisma'

async function main() {
  const orderId = 'cmw0xmj4u000bjm07imeh7sds'
  
  const oo = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, statusHistory: true, restaurantId: true }
  })
  console.log('OnlineOrder:', JSON.stringify(oo, null, 2))
  
  const pos = await prisma.posOrder.findFirst({
    where: { externalId: `oo-${orderId}` },
    select: { id: true, opsStage: true, assignedDriverId: true, assignedTo: true, isAssigned: true, posStatus: true }
  })
  console.log('PosOrder:', JSON.stringify(pos, null, 2))
  
  if (oo?.restaurantId) {
    const drivers = await prisma.driver.findMany({
      where: { restaurantId: oo.restaurantId },
      select: { id: true, displayName: true, active: true }
    })
    console.log('Drivers for restaurant:', JSON.stringify(drivers, null, 2))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
