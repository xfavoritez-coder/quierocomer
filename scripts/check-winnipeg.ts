import { prisma } from '@/lib/prisma'
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { slug: { contains: 'winnipeg' } },
    select: { id: true, name: true, slug: true }
  })
  console.log(JSON.stringify(r))

  // Also check the empanadas dish txDishType
  const d = await prisma.dish.findFirst({
    where: { restaurant: { slug: { contains: 'winnipeg' } }, name: { contains: 'empanada', mode: 'insensitive' } },
    select: { name: true, txDishType: true, description: true }
  })
  console.log(JSON.stringify(d))
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
