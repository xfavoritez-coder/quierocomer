import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const user = await p.user.findUnique({
    where: { email: 'guffisushi@gmail.com' },
    select: { id: true, email: true, name: true, createdAt: true }
  })
  console.log('User:', JSON.stringify(user, null, 2))

  if (!user) { console.log('No existe el usuario'); return }

  const clients = await p.restaurantClient.findMany({
    where: { userId: user.id },
    select: { id: true, restaurantId: true, source: true, createdAt: true, restaurant: { select: { name: true } } }
  })
  console.log('\nRestaurantClients:', JSON.stringify(clients, null, 2))

  // Check EmailLog
  try {
    const emails = await (p as any).emailLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, subject: true, status: true, createdAt: true, restaurantId: true }
    })
    console.log('\nEmailLogs:', JSON.stringify(emails, null, 2))
  } catch (e) {
    console.log('EmailLog error:', (e as any).message)
    // Try alternative table name
    try {
      const emails2 = await (p as any).emailLog.findMany({ take: 1 })
      console.log('Sample emailLog:', emails2)
    } catch {}
  }

  // Check BirthdayGift or similar
  try {
    const gifts = await (p as any).birthdayGift.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    console.log('\nBirthdayGifts:', JSON.stringify(gifts, null, 2))
  } catch (e) {
    console.log('BirthdayGift error:', (e as any).message)
  }
}

main().finally(() => p.$disconnect())
