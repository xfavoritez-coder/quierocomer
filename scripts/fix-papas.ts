import { prisma } from '@/lib/prisma'

async function main() {
  const all = await prisma.dish.findMany({
    where: { txDishType: { has: 'papas fritas' } },
    select: { id: true, name: true, txDishType: true }
  })
  console.log('Total with papas fritas in txDishType:', all.length)
  
  const toFix = all.filter(d => !/papa|salchipapa/i.test(d.name) && d.txDishType.length > 1)
  console.log('To fix:', toFix.length)
  
  for (const d of toFix) {
    console.log(' ', d.name.slice(0, 60), JSON.stringify(d.txDishType))
  }
  
  if (toFix.length > 0) {
    for (const d of toFix) {
      await prisma.dish.update({
        where: { id: d.id },
        data: { txDishType: d.txDishType.filter(t => t !== 'papas fritas') }
      })
    }
    console.log('Fixed', toFix.length, 'dishes')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
