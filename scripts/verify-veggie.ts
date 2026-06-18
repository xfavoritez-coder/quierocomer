import { prisma } from '@/lib/prisma'
async function main() {
  const dishes = await prisma.dish.findMany({
    where: { restaurant: { slug: 'toast-crew' } },
    select: { name: true, txDishType: true }
  })
  for (const d of dishes) console.log(d.name.slice(0,40), JSON.stringify(d.txDishType))
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
