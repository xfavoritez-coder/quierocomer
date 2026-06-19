import { config } from 'dotenv'
config({ path: '.env.local' })

const { PrismaClient } = await import('@prisma/client')
const p = new PrismaClient()

const user = await p.user.findUnique({
  where: { email: 'guffisushi@gmail.com' },
  select: { id: true, email: true, name: true, createdAt: true }
})
console.log('User:', JSON.stringify(user, null, 2))

if (user) {
  const clients = await p.restaurantClient.findMany({
    where: { userId: user.id },
    select: { id: true, source: true, createdAt: true, restaurant: { select: { name: true } } }
  })
  console.log('RestaurantClients:', JSON.stringify(clients, null, 2))

  // Check EmailLog
  const models = Object.keys(p).filter(k => !k.startsWith('_') && !k.startsWith('$'))
  console.log('Available models:', models.filter(m => m.toLowerCase().includes('email') || m.toLowerCase().includes('log') || m.toLowerCase().includes('gift') || m.toLowerCase().includes('birthday')))

  try {
    const emails = await p.emailLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, subject: true, status: true, createdAt: true }
    })
    console.log('EmailLogs:', JSON.stringify(emails, null, 2))
  } catch(e) { console.log('emailLog err:', e.message) }
}

await p.$disconnect()
