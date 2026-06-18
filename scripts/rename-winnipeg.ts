import { prisma } from '@/lib/prisma'
async function main() {
  const r = await prisma.restaurant.updateMany({
    where: { slug: { contains: 'winnipeg' } },
    data: { name: 'Winnipeg Restomar' }
  })
  console.log('Updated:', r.count, 'restaurants')
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
