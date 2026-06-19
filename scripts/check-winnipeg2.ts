import { prisma } from '@/lib/prisma'
async function main() {
  const dishes = await prisma.dish.findMany({
    where: { restaurant: { slug: { contains: 'winnipeg' } } },
    select: { name: true, txDishType: true, description: true }
  })
  for (const d of dishes) console.log(d.name, '->', JSON.stringify(d.txDishType))
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
