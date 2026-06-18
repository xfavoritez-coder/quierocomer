import { prisma } from '@/lib/prisma'

async function main() {
  const d = await prisma.dish.findFirst({
    where: { restaurant: { slug: 'toast-crew' }, name: { contains: 'veggie', mode: 'insensitive' } },
    select: { name: true, description: true, txDishType: true }
  })
  console.log(JSON.stringify(d, null, 2))
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
